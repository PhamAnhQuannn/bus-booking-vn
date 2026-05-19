'use client';

/**
 * RevenueClient — client island for the operator revenue report page.
 *
 * Handles date-range filter form. On submit, re-navigates with new searchParams
 * (which triggers a server-side re-render of the RSC page).
 *
 * The CSV download link is a plain <a href="..."> anchor — the browser triggers
 * the download automatically via the API's Content-Disposition: attachment header.
 *
 * Rule (Issue 003 Mistake Log): this is a CLIENT component, so it may fetch
 * the CSV download URL via a normal anchor — not a self-fetch. The table data
 * is already rendered server-side and passed as initialRows.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { RevenueRow } from '@/lib/payouts/buildRevenueCsv';

interface Props {
  initialRows: RevenueRow[];
  dateFrom: string;
  dateTo: string;
  routeId?: string;
}

function formatVnd(amount: number): string {
  return amount.toLocaleString('vi-VN') + ' ₫';
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ xử lý',
  processing: 'Đang xử lý',
  settled: 'Đã thanh toán',
  failed: 'Thất bại',
  '': '—',
};

export default function RevenueClient({ initialRows, dateFrom, dateTo }: Props) {
  const router = useRouter();
  const [from, setFrom] = useState(dateFrom);
  const [to, setTo] = useState(dateTo);

  function handleFilter(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams({ dateFrom: from, dateTo: to });
    router.push(`/op/reports/revenue?${params.toString()}`);
  }

  const csvHref = `/api/op/reports/revenue.csv?dateFrom=${from}&dateTo=${to}`;

  return (
    <div>
      {/* Date filter form */}
      <form onSubmit={handleFilter} style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'flex-end' }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Từ ngày</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            required
            style={{ padding: '6px 10px', border: '1px solid #ccc', borderRadius: 4 }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Đến ngày</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            required
            style={{ padding: '6px 10px', border: '1px solid #ccc', borderRadius: 4 }}
          />
        </div>
        <button
          type="submit"
          style={{
            padding: '6px 16px',
            background: '#1a73e8',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          Lọc
        </button>
        <a
          href={csvHref}
          style={{
            padding: '6px 16px',
            background: '#34a853',
            color: '#fff',
            borderRadius: 4,
            textDecoration: 'none',
            fontSize: 14,
          }}
        >
          Tải CSV
        </a>
      </form>

      {/* Revenue table */}
      {initialRows.length === 0 ? (
        <p style={{ color: '#666' }}>Không có dữ liệu trong khoảng thời gian này.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
                <th style={thStyle}>Mã chuyến</th>
                <th style={thStyle}>Khởi hành</th>
                <th style={thStyle}>Tuyến</th>
                <th style={thStyle}>Số ghế</th>
                <th style={thStyle}>Doanh thu (VND)</th>
                <th style={thStyle}>Phí nền tảng (VND)</th>
                <th style={thStyle}>Thanh toán ròng (VND)</th>
                <th style={thStyle}>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {initialRows.map((row) => (
                <tr key={row.tripId} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={tdStyle}>{row.tripId.slice(0, 8)}…</td>
                  <td style={tdStyle}>{formatDate(row.departureAt)}</td>
                  <td style={tdStyle}>{row.routeName}</td>
                  <td style={tdStyle}>{row.seatsSold}</td>
                  <td style={tdStyle}>{formatVnd(row.grossRevenueVnd)}</td>
                  <td style={tdStyle}>{formatVnd(row.platformFeeVnd)}</td>
                  <td style={tdStyle}>{formatVnd(row.netPayoutVnd)}</td>
                  <td style={tdStyle}>{STATUS_LABELS[row.payoutStatus ?? ''] ?? row.payoutStatus}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 600, background: '#f5f5f5' }}>
                <td style={tdStyle} colSpan={4}>Tổng cộng</td>
                <td style={tdStyle}>{formatVnd(initialRows.reduce((s, r) => s + r.grossRevenueVnd, 0))}</td>
                <td style={tdStyle}>{formatVnd(initialRows.reduce((s, r) => s + r.platformFeeVnd, 0))}</td>
                <td style={tdStyle}>{formatVnd(initialRows.reduce((s, r) => s + r.netPayoutVnd, 0))}</td>
                <td style={tdStyle}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderBottom: '2px solid #ddd',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '8px 12px',
};
