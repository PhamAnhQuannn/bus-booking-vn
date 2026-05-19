'use client';

/**
 * PayoutsClient — client island for the operator payouts report page.
 *
 * Displays payout rows. For failed payouts, shows a "Thử lại" (Retry) button
 * that POSTs to /api/op/reports/payouts/[id]/retry (client-to-API call — allowed
 * because this is a client component, not an RSC self-fetch).
 *
 * After a successful retry, calls router.refresh() to re-render the RSC page
 * with the updated payout status from DB.
 *
 * CSRF: the POST includes X-CSRF-Token header via readCsrfToken() (Issue 007 Mistake Log).
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { readCsrfToken } from '@/lib/auth/csrfClient';
import type { PayoutReportRow } from '@/lib/payouts/getPayoutReport';

interface Props {
  initialRows: PayoutReportRow[];
}

function formatVnd(amount: number): string {
  return amount.toLocaleString('vi-VN') + ' ₫';
}

function formatDate(date: Date | string): string {
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
};

const STATUS_COLORS: Record<string, string> = {
  pending: '#f9a825',
  processing: '#1a73e8',
  settled: '#34a853',
  failed: '#d93025',
};

export default function PayoutsClient({ initialRows }: Props) {
  const router = useRouter();
  const [retrying, setRetrying] = useState<string | null>(null);
  const [error, setError] = useState<string>('');

  async function handleRetry(payoutId: string) {
    setRetrying(payoutId);
    setError('');
    try {
      const csrfToken = readCsrfToken();
      const res = await fetch(`/api/op/reports/payouts/${payoutId}/retry`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'X-CSRF-Token': csrfToken ?? '',
        },
      });

      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        if (data.error === 'not_failed') {
          setError('Không thể thử lại: khoản thanh toán không ở trạng thái thất bại.');
        } else if (data.error === 'not_found') {
          setError('Không tìm thấy khoản thanh toán.');
        } else {
          setError('Đã xảy ra lỗi. Vui lòng thử lại.');
        }
      }
    } catch {
      setError('Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setRetrying(null);
    }
  }

  return (
    <div>
      {error && (
        <div
          role="alert"
          style={{
            background: '#fce8e6',
            color: '#c5221f',
            padding: '10px 14px',
            borderRadius: 4,
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      {initialRows.length === 0 ? (
        <p style={{ color: '#666' }}>Chưa có khoản thanh toán nào.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
                <th style={thStyle}>Tuyến</th>
                <th style={thStyle}>Khởi hành</th>
                <th style={thStyle}>Doanh thu</th>
                <th style={thStyle}>Phí nền tảng</th>
                <th style={thStyle}>Thanh toán ròng</th>
                <th style={thStyle}>Trạng thái</th>
                <th style={thStyle}>Ngày dự kiến</th>
                <th style={thStyle}>Ngày thanh toán</th>
                <th style={thStyle}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {initialRows.map((row) => (
                <tr key={row.payoutId} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={tdStyle}>{row.routeName}</td>
                  <td style={tdStyle}>{formatDate(row.departureAt)}</td>
                  <td style={tdStyle}>{formatVnd(row.gross)}</td>
                  <td style={tdStyle}>{formatVnd(row.platformFee)}</td>
                  <td style={tdStyle}>{formatVnd(row.net)}</td>
                  <td style={tdStyle}>
                    <span
                      style={{
                        color: STATUS_COLORS[row.status] ?? '#333',
                        fontWeight: 500,
                      }}
                    >
                      {STATUS_LABELS[row.status] ?? row.status}
                    </span>
                    {row.failureReason && (
                      <span style={{ color: '#999', fontSize: 12, marginLeft: 6 }}>
                        ({row.failureReason})
                      </span>
                    )}
                  </td>
                  <td style={tdStyle}>{formatDate(row.scheduledAt)}</td>
                  <td style={tdStyle}>{row.settledAt ? formatDate(row.settledAt) : '—'}</td>
                  <td style={tdStyle}>
                    {row.status === 'failed' && (
                      <button
                        onClick={() => handleRetry(row.payoutId)}
                        disabled={retrying === row.payoutId}
                        style={{
                          padding: '4px 10px',
                          background: '#d93025',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 4,
                          cursor: retrying === row.payoutId ? 'not-allowed' : 'pointer',
                          opacity: retrying === row.payoutId ? 0.7 : 1,
                          fontSize: 13,
                        }}
                        aria-label={`Thử lại thanh toán cho ${row.routeName}`}
                      >
                        {retrying === row.payoutId ? 'Đang xử lý…' : 'Thử lại'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
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
