'use client';

/**
 * DashboardClient — operator booking queue client island (Issue 014 AC2).
 *
 * Renders booking queue with filter controls. Reads CSRF cookie for mutations.
 */

import { useState } from 'react';
import type { BookingQueueRow } from '@/lib/booking/toBookingQueueRow';

interface Props {
  initialRows: BookingQueueRow[];
  initialNextCursor: string | null;
  operatorId: string;
}

const CONTACT_STATUS_LABELS: Record<string, string> = {
  pending: 'Chưa gọi',
  reached: 'Đã liên lạc',
  no_answer: 'Không bắt máy',
  callback: 'Gọi lại sau',
};

export default function DashboardClient({ initialRows, initialNextCursor, operatorId }: Props) {
  const [rows, setRows] = useState<BookingQueueRow[]>(initialRows);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [busId, setBusId] = useState('');
  const [serviceDate, setServiceDate] = useState('');
  const [routeId, setRouteId] = useState('');
  const [contactStatus, setContactStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function fetchBookings(params: Record<string, string>, append = false) {
    setLoading(true);
    try {
      const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v)));
      const res = await fetch(`/api/op/bookings?${qs.toString()}`, { credentials: 'same-origin' });
      if (!res.ok) {
        setMessage('Lỗi tải dữ liệu.');
        return;
      }
      const json = await res.json();
      if (append) {
        setRows((prev) => [...prev, ...(json.rows ?? [])]);
      } else {
        setRows(json.rows ?? []);
      }
      setNextCursor(json.nextCursor ?? null);
    } finally {
      setLoading(false);
    }
  }

  function handleFilter(e: React.FormEvent) {
    e.preventDefault();
    fetchBookings({ busId, serviceDate, routeId, contactStatus });
  }

  function handleLoadMore() {
    if (!nextCursor) return;
    fetchBookings({ busId, serviceDate, routeId, contactStatus, cursor: nextCursor }, true);
  }

  return (
    <div>
      {message && (
        <div
          data-testid="dashboard-message"
          style={{ padding: 12, marginBottom: 16, background: '#fff3cd', borderRadius: 4 }}
        >
          {message}
        </div>
      )}

      <form onSubmit={handleFilter} style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          placeholder="ID xe buýt"
          value={busId}
          onChange={(e) => setBusId(e.target.value)}
          data-testid="filter-bus-id"
          style={{ padding: 6, borderRadius: 4, border: '1px solid #ccc' }}
        />
        <input
          type="date"
          placeholder="Ngày đi"
          value={serviceDate}
          onChange={(e) => setServiceDate(e.target.value)}
          data-testid="filter-service-date"
          style={{ padding: 6, borderRadius: 4, border: '1px solid #ccc' }}
        />
        <input
          placeholder="ID tuyến"
          value={routeId}
          onChange={(e) => setRouteId(e.target.value)}
          data-testid="filter-route-id"
          style={{ padding: 6, borderRadius: 4, border: '1px solid #ccc' }}
        />
        <select
          value={contactStatus}
          onChange={(e) => setContactStatus(e.target.value)}
          data-testid="filter-contact-status"
          style={{ padding: 6, borderRadius: 4, border: '1px solid #ccc' }}
        >
          <option value="">Tất cả trạng thái liên lạc</option>
          <option value="pending">Chưa gọi</option>
          <option value="reached">Đã liên lạc</option>
          <option value="no_answer">Không bắt máy</option>
          <option value="callback">Gọi lại sau</option>
        </select>
        <button type="submit" disabled={loading} data-testid="filter-submit">
          Lọc
        </button>
      </form>

      {rows.length === 0 ? (
        <p>Không có đặt vé nào.</p>
      ) : (
        <table
          style={{ width: '100%', borderCollapse: 'collapse' }}
          data-testid="booking-queue-table"
        >
          <thead>
            <tr style={{ background: '#f4f4f4' }}>
              <th style={{ padding: 8, textAlign: 'left' }}>Mã đặt</th>
              <th style={{ padding: 8, textAlign: 'left' }}>Hành khách</th>
              <th style={{ padding: 8, textAlign: 'left' }}>SĐT</th>
              <th style={{ padding: 8, textAlign: 'left' }}>Vé</th>
              <th style={{ padding: 8, textAlign: 'left' }}>Liên lạc</th>
              <th style={{ padding: 8, textAlign: 'left' }}>Điểm đón</th>
              <th style={{ padding: 8, textAlign: 'left' }}>TT thanh toán</th>
              <th style={{ padding: 8, textAlign: 'left' }}>Khởi hành</th>
              <th style={{ padding: 8, textAlign: 'left' }}>Cờ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                data-testid={`booking-row-${row.id}`}
                style={{
                  background: row.escalatedAt ? '#fff3cd' : 'transparent',
                  borderBottom: '1px solid #eee',
                }}
              >
                <td style={{ padding: 8 }}>
                  <a href={`/op/dashboard/${row.id}`} data-testid={`booking-detail-${row.id}`}>
                    {row.bookingRef}
                  </a>
                </td>
                <td style={{ padding: 8 }}>{row.buyerName}</td>
                <td style={{ padding: 8 }}>{row.buyerPhone}</td>
                <td style={{ padding: 8 }}>{row.ticketCount}</td>
                <td style={{ padding: 8 }}>{CONTACT_STATUS_LABELS[row.contactStatus] ?? row.contactStatus}</td>
                <td style={{ padding: 8 }}>{row.pickupPointName ?? '—'}</td>
                <td style={{ padding: 8 }}>{row.paymentStatus}</td>
                <td style={{ padding: 8 }}>
                  {new Date(row.departureAt).toLocaleString('vi-VN')}
                </td>
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

      {nextCursor && (
        <button
          type="button"
          onClick={handleLoadMore}
          disabled={loading}
          data-testid="load-more-btn"
          style={{ marginTop: 16 }}
        >
          Tải thêm
        </button>
      )}
    </div>
  );
}
