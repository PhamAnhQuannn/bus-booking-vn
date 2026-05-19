'use client';

/**
 * StaffDashboardClient — single-trip client island for the staff dashboard (Issue 018).
 *
 * Staff see ONLY their assigned trip. Renders a tab switch between the booking
 * queue and the boarding manifest for that one trip, plus depart/complete actions.
 *
 * All reads target the Issue 014 endpoints (GET /api/op/bookings?tripId=,
 * GET /api/op/manifest/:tripId) which the staff-scope guard constrains to the
 * assigned trip. depart/complete POST through tripsClient (X-CSRF-Token header).
 */

import { useState } from 'react';
import { departTripApi, completeTripApi } from '@/lib/api/tripsClient';
import type { BookingQueueRow } from '@/lib/booking/toBookingQueueRow';
import type { ManifestRow } from '@/lib/manifest/getManifest';
import type { TripDto } from '@/lib/trips/tripDto';

interface Props {
  tripId: string;
  trip: TripDto | null;
  initialQueueRows: BookingQueueRow[];
  initialManifestRows: ManifestRow[];
  initialManifestGeneratedAt: string | null;
}

const CONTACT_LABELS: Record<string, string> = {
  pending: 'Chưa gọi',
  reached: 'Đã liên lạc',
  no_answer: 'Không bắt máy',
  callback: 'Gọi lại sau',
};

type Tab = 'queue' | 'manifest';

export default function StaffDashboardClient({
  tripId,
  trip,
  initialQueueRows,
  initialManifestRows,
  initialManifestGeneratedAt,
}: Props) {
  const [tab, setTab] = useState<Tab>('queue');
  const [queueRows, setQueueRows] = useState<BookingQueueRow[]>(initialQueueRows);
  const [manifestRows, setManifestRows] = useState<ManifestRow[]>(initialManifestRows);
  const [generatedAt, setGeneratedAt] = useState<string | null>(initialManifestGeneratedAt);
  const [status, setStatus] = useState<TripDto['status'] | null>(trip?.status ?? null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function refreshQueue() {
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch(`/api/op/bookings?tripId=${encodeURIComponent(tripId)}`, {
        credentials: 'same-origin',
      });
      if (!res.ok) {
        setMessage('Lỗi tải hàng đợi.');
        return;
      }
      const json = await res.json();
      setQueueRows(json.rows ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function refreshManifest() {
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch(`/api/op/manifest/${tripId}`, { credentials: 'same-origin' });
      if (!res.ok) {
        setMessage('Lỗi tải manifest.');
        return;
      }
      const json = await res.json();
      setManifestRows(json.rows ?? []);
      setGeneratedAt(json.generatedAt ?? new Date().toISOString());
    } finally {
      setLoading(false);
    }
  }

  async function handleDepart() {
    setBusy(true);
    setMessage('');
    try {
      const { trip: updated, alreadyDeparted } = await departTripApi(tripId);
      setStatus(updated.status);
      setMessage(alreadyDeparted ? 'Chuyến đã được đánh dấu khởi hành.' : 'Đã đánh dấu khởi hành.');
    } catch {
      setMessage('Không thể đánh dấu khởi hành.');
    } finally {
      setBusy(false);
    }
  }

  async function handleComplete() {
    setBusy(true);
    setMessage('');
    try {
      const { trip: updated, alreadyCompleted } = await completeTripApi(tripId);
      setStatus(updated.status);
      setMessage(alreadyCompleted ? 'Chuyến đã được đánh dấu hoàn thành.' : 'Đã đánh dấu hoàn thành.');
    } catch {
      setMessage('Không thể đánh dấu hoàn thành.');
    } finally {
      setBusy(false);
    }
  }

  const tabBtn = (active: boolean): React.CSSProperties => ({
    padding: '8px 16px',
    border: '1px solid #ccc',
    borderBottom: active ? '2px solid #2c3e50' : '1px solid #ccc',
    background: active ? '#fff' : '#f4f4f4',
    fontWeight: active ? 600 : 400,
    cursor: 'pointer',
  });

  return (
    <div>
      {message && (
        <div
          data-testid="staff-message"
          style={{ padding: 12, marginBottom: 16, background: '#fff3cd', borderRadius: 4 }}
        >
          {message}
        </div>
      )}

      <div
        data-testid="trip-status"
        style={{ marginBottom: 16, color: '#555' }}
      >
        Trạng thái chuyến: <strong>{status ?? '—'}</strong>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <button
          type="button"
          onClick={handleDepart}
          disabled={busy || status === 'departed' || status === 'completed' || status === 'cancelled'}
          data-testid="depart-btn"
        >
          Đánh dấu khởi hành
        </button>
        <button
          type="button"
          onClick={handleComplete}
          disabled={busy || status === 'completed' || status === 'cancelled'}
          data-testid="complete-btn"
        >
          Đánh dấu hoàn thành
        </button>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => setTab('queue')}
          style={tabBtn(tab === 'queue')}
          data-testid="tab-queue"
        >
          Hàng đợi
        </button>
        <button
          type="button"
          onClick={() => setTab('manifest')}
          style={tabBtn(tab === 'manifest')}
          data-testid="tab-manifest"
        >
          Manifest
        </button>
      </div>

      {tab === 'queue' ? (
        <div data-testid="queue-panel">
          <button
            type="button"
            onClick={refreshQueue}
            disabled={loading}
            data-testid="queue-refresh-btn"
            style={{ marginBottom: 12 }}
          >
            {loading ? 'Đang tải…' : 'Làm mới'}
          </button>
          {queueRows.length === 0 ? (
            <p>Không có đặt vé nào.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }} data-testid="staff-queue-table">
              <thead>
                <tr style={{ background: '#f4f4f4' }}>
                  <th style={{ padding: 8, textAlign: 'left' }}>Mã đặt</th>
                  <th style={{ padding: 8, textAlign: 'left' }}>Hành khách</th>
                  <th style={{ padding: 8, textAlign: 'left' }}>SĐT</th>
                  <th style={{ padding: 8, textAlign: 'left' }}>Vé</th>
                  <th style={{ padding: 8, textAlign: 'left' }}>Liên lạc</th>
                  <th style={{ padding: 8, textAlign: 'left' }}>Điểm đón</th>
                  <th style={{ padding: 8, textAlign: 'left' }}>TT thanh toán</th>
                  <th style={{ padding: 8, textAlign: 'left' }}>Cờ</th>
                </tr>
              </thead>
              <tbody>
                {queueRows.map((row) => (
                  <tr
                    key={row.id}
                    data-testid={`staff-booking-row-${row.id}`}
                    style={{
                      background: row.escalatedAt ? '#fff3cd' : 'transparent',
                      borderBottom: '1px solid #eee',
                    }}
                  >
                    <td style={{ padding: 8 }}>
                      <a href={`/op/dashboard/${row.id}`}>{row.bookingRef}</a>
                    </td>
                    <td style={{ padding: 8 }}>{row.buyerName}</td>
                    <td style={{ padding: 8 }}>{row.buyerPhone}</td>
                    <td style={{ padding: 8 }}>{row.ticketCount}</td>
                    <td style={{ padding: 8 }}>{CONTACT_LABELS[row.contactStatus] ?? row.contactStatus}</td>
                    <td style={{ padding: 8 }}>{row.pickupPointName ?? '—'}</td>
                    <td style={{ padding: 8 }}>{row.paymentStatus}</td>
                    <td style={{ padding: 8 }}>
                      {row.manualFlag && <span title="Thủ công">✏</span>}
                      {row.cashFlag && <span title="Tiền mặt">💵</span>}
                      {row.escalatedAt && <span title="Cần xử lý">⚠</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div data-testid="manifest-panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
            <button
              type="button"
              onClick={refreshManifest}
              disabled={loading}
              data-testid="manifest-refresh-btn"
            >
              {loading ? 'Đang tải…' : 'Làm mới'}
            </button>
            <span data-testid="manifest-last-updated" style={{ color: '#666', fontSize: 14 }}>
              Cập nhật lần cuối:{' '}
              {generatedAt ? new Date(generatedAt).toLocaleString('vi-VN') : '—'}
            </span>
          </div>
          {manifestRows.length === 0 ? (
            <p>Không có hành khách nào.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }} data-testid="staff-manifest-table">
              {/* AC6: NO seat-number column */}
              <thead>
                <tr style={{ background: '#f4f4f4' }}>
                  <th style={{ padding: 8, textAlign: 'left' }}>Mã đặt</th>
                  <th style={{ padding: 8, textAlign: 'left' }}>Hành khách</th>
                  <th style={{ padding: 8, textAlign: 'left' }}>SĐT</th>
                  <th style={{ padding: 8, textAlign: 'left' }}>Vé</th>
                  <th style={{ padding: 8, textAlign: 'left' }}>Điểm đón</th>
                  <th style={{ padding: 8, textAlign: 'left' }}>Liên lạc</th>
                  <th style={{ padding: 8, textAlign: 'left' }}>TT thanh toán</th>
                  <th style={{ padding: 8, textAlign: 'left' }}>Lên xe</th>
                  <th style={{ padding: 8, textAlign: 'left' }}>Cờ</th>
                </tr>
              </thead>
              <tbody>
                {manifestRows.map((row) => (
                  <tr
                    key={row.bookingId}
                    data-testid={`staff-manifest-row-${row.bookingId}`}
                    style={{
                      background: row.escalatedAt ? '#fff3cd' : 'transparent',
                      borderBottom: '1px solid #eee',
                    }}
                  >
                    <td style={{ padding: 8 }}>{row.bookingRef}</td>
                    <td style={{ padding: 8 }}>{row.name}</td>
                    <td style={{ padding: 8 }}>{row.phone}</td>
                    <td style={{ padding: 8 }}>{row.ticketCount}</td>
                    <td style={{ padding: 8 }}>{row.pickupPointName ?? '—'}</td>
                    <td style={{ padding: 8 }}>{CONTACT_LABELS[row.contactStatus] ?? row.contactStatus}</td>
                    <td style={{ padding: 8 }}>{row.paymentStatus}</td>
                    <td style={{ padding: 8 }}>{row.pickedUpAt ? '✓' : '—'}</td>
                    <td style={{ padding: 8 }}>
                      {row.manualFlag && <span title="Thủ công">✏</span>}
                      {row.cashFlag && <span title="Tiền mặt">💵</span>}
                      {row.escalatedAt && <span title="Cần xử lý">⚠</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
