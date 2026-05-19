'use client';

/**
 * TripDetailClient — client island for single trip detail/actions (Issue 013).
 *
 * Actions: block seats, reassign bus, sales-toggle, cancel, paired-return.
 * All mutations use X-CSRF-Token via tripsClient.ts.
 */

import { useState } from 'react';
import type { TripDto } from '@/lib/trips/tripDto';
import {
  blockSeatsApi,
  reassignBusApi,
  cancelTripApi,
  salesToggleApi,
  pairedReturnApi,
} from '@/lib/api/tripsClient';

interface Props {
  trip: TripDto;
}

function translateError(code: string): string {
  switch (code) {
    case 'bus_deactivated': return 'Xe đã bị vô hiệu hoá';
    case 'bus_in_maintenance': return 'Xe đang bảo trì';
    case 'already_cancelled': return 'Chuyến đã bị huỷ';
    case 'block_exceeds_available': return 'Số ghế chặn vượt số ghế còn';
    case 'capacity_too_small': return 'Xe mới không đủ chỗ cho đặt vé hiện tại';
    case 'bus_overlap_with_outbound': return 'Xe bận chuyến khác cùng giờ';
    case 'no_reverse_route': return 'Không tìm thấy tuyến ngược chiều';
    case 'not_found': return 'Không tìm thấy';
    case 'invalid_input': return 'Dữ liệu không hợp lệ';
    default: return 'Đã xảy ra lỗi';
  }
}

export default function TripDetailClient({ trip: initialTrip }: Props) {
  const [trip, setTrip] = useState<TripDto>(initialTrip);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>('');

  // Block seats
  const [blockCount, setBlockCount] = useState<number>(trip.blockedSeats);

  // Reassign bus
  const [newBusId, setNewBusId] = useState('');

  // Paired return
  const [returnDep, setReturnDep] = useState('');
  const [returnPrice, setReturnPrice] = useState<number>(trip.price ?? 0);

  async function handleBlockSeats() {
    setBusy(true);
    setMessage('');
    try {
      const res = await blockSeatsApi(trip.id, blockCount);
      setTrip(res.trip);
      setMessage('Đã cập nhật ghế chặn.');
    } catch (err: unknown) {
      const data = (err as { data?: { error?: string } }).data;
      setMessage(translateError(data?.error ?? ''));
    } finally {
      setBusy(false);
    }
  }

  async function handleReassignBus() {
    if (!newBusId.trim()) { setMessage('Nhập ID xe mới.'); return; }
    setBusy(true);
    setMessage('');
    try {
      const res = await reassignBusApi(trip.id, newBusId.trim());
      setTrip(res.trip);
      setNewBusId('');
      setMessage('Đã đổi xe.');
    } catch (err: unknown) {
      const data = (err as { data?: { error?: string; required?: number; provided?: number } }).data;
      if (data?.error === 'capacity_too_small') {
        setMessage(`Xe mới không đủ chỗ: cần ${data.required}, xe có ${data.provided}.`);
      } else {
        setMessage(translateError(data?.error ?? ''));
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleSalesToggle() {
    setBusy(true);
    setMessage('');
    try {
      const res = await salesToggleApi(trip.id, !trip.salesClosed);
      setTrip(res.trip);
      setMessage(res.trip.salesClosed ? 'Đã đóng bán vé.' : 'Đã mở bán vé.');
    } catch (err: unknown) {
      const data = (err as { data?: { error?: string } }).data;
      setMessage(translateError(data?.error ?? ''));
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    const reason = prompt('Lý do huỷ chuyến (tối thiểu 10 ký tự):');
    if (!reason || reason.length < 10) {
      setMessage('Lý do phải có ít nhất 10 ký tự.');
      return;
    }
    if (!confirm('Huỷ chuyến này? Hành động không thể hoàn tác.')) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await cancelTripApi(trip.id, reason);
      setMessage(
        `Đã huỷ chuyến. Đặt vé bị huỷ: ${result.cancelledBookings}. Giữ chỗ bị huỷ: ${result.cancelledHolds}. SMS: ${result.notificationsEnqueued}.`
      );
      setTrip({ ...trip, status: 'cancelled' });
    } catch (err: unknown) {
      const data = (err as { data?: { error?: string } }).data;
      setMessage(translateError(data?.error ?? ''));
    } finally {
      setBusy(false);
    }
  }

  async function handlePairedReturn() {
    if (!returnDep) { setMessage('Chọn giờ khởi hành chuyến về.'); return; }
    setBusy(true);
    setMessage('');
    try {
      const res = await pairedReturnApi(trip.id, {
        returnDepartureAt: new Date(returnDep).toISOString(),
        price: returnPrice || undefined,
      });
      setMessage(`Đã tạo chuyến về: ${res.returnTrip.id.slice(0, 8)}…`);
    } catch (err: unknown) {
      const data = (err as { data?: { error?: string } }).data;
      setMessage(translateError(data?.error ?? ''));
    } finally {
      setBusy(false);
    }
  }

  const cancelled = trip.status === 'cancelled';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {message && (
        <div
          data-testid="trip-detail-message"
          style={{ padding: 12, background: '#f4f4f4', borderRadius: 4 }}
        >
          {message}
        </div>
      )}

      {/* Trip summary */}
      <section style={{ padding: 16, border: '1px solid #ddd', borderRadius: 4 }}>
        <h2 style={{ marginTop: 0 }}>Thông tin chuyến</h2>
        <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 16px' }}>
          <dt>ID</dt><dd data-testid="trip-id" style={{ fontFamily: 'monospace' }}>{trip.id}</dd>
          <dt>Tuyến</dt><dd>{trip.routeId}</dd>
          <dt>Xe</dt><dd>{trip.busId}</dd>
          <dt>Khởi hành</dt><dd>{new Date(trip.departureAt).toLocaleString('vi-VN')}</dd>
          <dt>Giá</dt><dd>{trip.price?.toLocaleString('vi-VN')}đ</dd>
          <dt>Trạng thái</dt><dd data-testid="trip-status">{trip.status}</dd>
          <dt>Đóng bán</dt><dd>{trip.salesClosed ? 'Có' : 'Không'}</dd>
          <dt>Ghế còn</dt><dd data-testid="trip-available">{trip.availableSeats}</dd>
          <dt>Ghế chặn</dt><dd>{trip.blockedSeats}</dd>
        </dl>
      </section>

      {!cancelled && (
        <>
          {/* Block seats */}
          <section style={{ padding: 16, border: '1px solid #ddd', borderRadius: 4 }}>
            <h2 style={{ marginTop: 0 }}>Chặn ghế</h2>
            <label>
              Số ghế chặn
              <input
                type="number"
                value={blockCount}
                onChange={(e) => setBlockCount(parseInt(e.target.value, 10))}
                min={0}
                data-testid="block-seats-input"
                style={{ marginLeft: 8, width: 80 }}
              />
            </label>
            <button
              type="button"
              onClick={handleBlockSeats}
              disabled={busy}
              data-testid="block-seats-submit"
              style={{ marginLeft: 8 }}
            >
              Cập nhật
            </button>
          </section>

          {/* Reassign bus */}
          <section style={{ padding: 16, border: '1px solid #ddd', borderRadius: 4 }}>
            <h2 style={{ marginTop: 0 }}>Đổi xe</h2>
            <input
              type="text"
              value={newBusId}
              onChange={(e) => setNewBusId(e.target.value)}
              placeholder="ID xe mới"
              data-testid="reassign-bus-input"
              style={{ width: 240 }}
            />
            <button
              type="button"
              onClick={handleReassignBus}
              disabled={busy}
              data-testid="reassign-bus-submit"
              style={{ marginLeft: 8 }}
            >
              Đổi xe
            </button>
          </section>

          {/* Sales toggle */}
          <section style={{ padding: 16, border: '1px solid #ddd', borderRadius: 4 }}>
            <h2 style={{ marginTop: 0 }}>Bán vé</h2>
            <button
              type="button"
              onClick={handleSalesToggle}
              disabled={busy}
              data-testid="sales-toggle-btn"
            >
              {trip.salesClosed ? 'Mở bán vé' : 'Đóng bán vé'}
            </button>
          </section>

          {/* Paired return */}
          <section style={{ padding: 16, border: '1px solid #ddd', borderRadius: 4 }}>
            <h2 style={{ marginTop: 0 }}>Tạo chuyến về</h2>
            <label style={{ display: 'block', marginBottom: 8 }}>
              Giờ khởi hành chuyến về
              <input
                type="datetime-local"
                value={returnDep}
                onChange={(e) => setReturnDep(e.target.value)}
                data-testid="return-departure-input"
                style={{ display: 'block', marginTop: 4 }}
              />
            </label>
            <label style={{ display: 'block', marginBottom: 8 }}>
              Giá (để trống = dùng giá chuyến đi)
              <input
                type="number"
                value={returnPrice}
                onChange={(e) => setReturnPrice(parseInt(e.target.value, 10))}
                min={0}
                data-testid="return-price-input"
                style={{ display: 'block', width: 160, marginTop: 4 }}
              />
            </label>
            <button
              type="button"
              onClick={handlePairedReturn}
              disabled={busy}
              data-testid="paired-return-submit"
            >
              Tạo chuyến về
            </button>
          </section>

          {/* Cancel */}
          <section style={{ padding: 16, border: '1px solid #fcc', borderRadius: 4 }}>
            <h2 style={{ marginTop: 0, color: '#c00' }}>Huỷ chuyến</h2>
            <button
              type="button"
              onClick={handleCancel}
              disabled={busy}
              data-testid="cancel-trip-btn"
              style={{ background: '#c00', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 4 }}
            >
              Huỷ chuyến
            </button>
          </section>
        </>
      )}
    </div>
  );
}
