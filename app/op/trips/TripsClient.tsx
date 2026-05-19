'use client';

/**
 * TripsClient — client island for operator trip list (Issue 013).
 *
 * CSRF double-submit: X-CSRF-Token header on all non-GET requests via tripsClient.ts.
 *
 * Error codes (Vietnamese labels):
 *   bus_deactivated        → "Xe đã bị vô hiệu hoá"
 *   bus_in_maintenance     → "Xe đang bảo trì"
 *   not_found              → "Không tìm thấy"
 *   invalid_input          → "Dữ liệu không hợp lệ"
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { TripDto } from '@/lib/trips/tripDto';
import {
  cancelTripApi,
  salesToggleApi,
} from '@/lib/api/tripsClient';

interface Props {
  initialTrips: TripDto[];
}

function translateError(code: string): string {
  switch (code) {
    case 'bus_deactivated': return 'Xe đã bị vô hiệu hoá';
    case 'bus_in_maintenance': return 'Xe đang bảo trì';
    case 'already_cancelled': return 'Chuyến đã bị huỷ';
    case 'not_found': return 'Không tìm thấy';
    case 'invalid_input': return 'Dữ liệu không hợp lệ';
    default: return 'Đã xảy ra lỗi';
  }
}

export default function TripsClient({ initialTrips }: Props) {
  const router = useRouter();
  const [trips, setTrips] = useState<TripDto[]>(initialTrips);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>('');

  async function refreshTrips() {
    const res = await fetch('/api/op/trips', { credentials: 'same-origin' });
    if (res.ok) {
      const json = await res.json();
      setTrips(json.trips ?? []);
    }
  }

  async function handleSalesToggle(tripId: string, salesClosed: boolean) {
    setBusy(true);
    setMessage('');
    try {
      await salesToggleApi(tripId, salesClosed);
      setMessage(salesClosed ? 'Đã đóng bán vé.' : 'Đã mở bán vé.');
      await refreshTrips();
    } catch (err: unknown) {
      const data = (err as { data?: { error?: string } }).data;
      setMessage(translateError(data?.error ?? ''));
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel(tripId: string) {
    const reason = prompt('Lý do huỷ chuyến (tối thiểu 10 ký tự):');
    if (!reason || reason.length < 10) {
      setMessage('Lý do phải có ít nhất 10 ký tự.');
      return;
    }
    if (!confirm('Huỷ chuyến này? Hành động không thể hoàn tác.')) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await cancelTripApi(tripId, reason);
      setMessage(
        `Đã huỷ chuyến. Đặt vé bị huỷ: ${result.cancelledBookings}. Giữ chỗ bị huỷ: ${result.cancelledHolds}. SMS: ${result.notificationsEnqueued}.`
      );
      await refreshTrips();
    } catch (err: unknown) {
      const data = (err as { data?: { error?: string } }).data;
      setMessage(translateError(data?.error ?? ''));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {message && (
        <div
          data-testid="trips-message"
          style={{ padding: 12, marginBottom: 16, background: '#f4f4f4', borderRadius: 4 }}
        >
          {message}
        </div>
      )}

      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={() => router.push('/op/trips/new')}
          data-testid="create-trip-btn"
        >
          Tạo chuyến mới
        </button>
        <button
          type="button"
          onClick={() => router.push('/op/trip-templates')}
          data-testid="templates-link"
        >
          Quản lý lịch cố định
        </button>
      </div>

      <section>
        <h2>Danh sách chuyến ({trips.length})</h2>
        {trips.length === 0 ? (
          <p>Chưa có chuyến nào.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }} data-testid="trips-table">
            <thead>
              <tr style={{ background: '#f4f4f4' }}>
                <th style={{ padding: 8, textAlign: 'left' }}>ID</th>
                <th style={{ padding: 8, textAlign: 'left' }}>Khởi hành</th>
                <th style={{ padding: 8, textAlign: 'left' }}>Giá</th>
                <th style={{ padding: 8, textAlign: 'left' }}>Trạng thái</th>
                <th style={{ padding: 8, textAlign: 'left' }}>Ghế còn</th>
                <th style={{ padding: 8, textAlign: 'left' }}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {trips.map((trip) => (
                <tr key={trip.id} data-testid={`trip-row-${trip.id}`}>
                  <td style={{ padding: 8, fontFamily: 'monospace', fontSize: 12 }}>
                    <a
                      href={`/op/trips/${trip.id}`}
                      data-testid={`trip-detail-link-${trip.id}`}
                    >
                      {trip.id.slice(0, 8)}…
                    </a>
                  </td>
                  <td style={{ padding: 8 }}>
                    {new Date(trip.departureAt).toLocaleString('vi-VN')}
                  </td>
                  <td style={{ padding: 8 }}>{trip.price?.toLocaleString('vi-VN')}đ</td>
                  <td style={{ padding: 8 }}>
                    {trip.status}
                    {trip.salesClosed ? ' (đóng bán)' : ''}
                  </td>
                  <td style={{ padding: 8 }} data-testid={`trip-available-${trip.id}`}>
                    {trip.availableSeats}
                  </td>
                  <td style={{ padding: 8 }}>
                    {trip.status !== 'cancelled' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleSalesToggle(trip.id, !trip.salesClosed)}
                          disabled={busy}
                          data-testid={`trip-toggle-sales-${trip.id}`}
                        >
                          {trip.salesClosed ? 'Mở bán' : 'Đóng bán'}
                        </button>{' '}
                        <button
                          type="button"
                          onClick={() => handleCancel(trip.id)}
                          disabled={busy}
                          data-testid={`trip-cancel-${trip.id}`}
                          style={{ color: 'red' }}
                        >
                          Huỷ
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
