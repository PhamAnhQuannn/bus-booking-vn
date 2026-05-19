'use client';

/**
 * ManifestRefresh — client island for manifest page (Issue 014 AC7).
 *
 * Handles manual refresh button: calls GET /api/op/manifest/:tripId and
 * updates the "Last updated" timestamp (AC7).
 * AC6: renders manifest table WITHOUT seat-number column.
 */

import { useState } from 'react';
import type { ManifestRow } from '@/lib/manifest/getManifest';

interface Props {
  tripId: string;
  initialGeneratedAt: string;
  initialRows: ManifestRow[];
}

const CONTACT_LABELS: Record<string, string> = {
  pending: 'Chưa gọi',
  reached: 'Đã liên lạc',
  no_answer: 'Không bắt máy',
  callback: 'Gọi lại sau',
};

export default function ManifestRefresh({ tripId, initialGeneratedAt, initialRows }: Props) {
  const [rows, setRows] = useState<ManifestRow[]>(initialRows);
  const [generatedAt, setGeneratedAt] = useState(initialGeneratedAt);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleRefresh() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/op/manifest/${tripId}`, { credentials: 'same-origin' });
      if (!res.ok) {
        setError('Lỗi tải manifest. Vui lòng thử lại.');
        return;
      }
      const json = await res.json();
      setRows(json.rows ?? []);
      setGeneratedAt(json.generatedAt ?? new Date().toISOString());
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading}
          data-testid="manifest-refresh-btn"
        >
          {loading ? 'Đang tải…' : 'Làm mới'}
        </button>
        <span data-testid="manifest-last-updated" style={{ color: '#666', fontSize: 14 }}>
          Cập nhật lần cuối: {new Date(generatedAt).toLocaleString('vi-VN')}
        </span>
      </div>

      {error && (
        <p data-testid="manifest-error" style={{ color: 'red' }}>
          {error}
        </p>
      )}

      {rows.length === 0 ? (
        <p>Không có hành khách nào.</p>
      ) : (
        <table
          style={{ width: '100%', borderCollapse: 'collapse' }}
          data-testid="manifest-table"
        >
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
            {rows.map((row) => (
              <tr
                key={row.bookingId}
                data-testid={`manifest-row-${row.bookingId}`}
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
                <td style={{ padding: 8 }}>
                  {row.pickedUpAt ? '✓' : '—'}
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
    </div>
  );
}
