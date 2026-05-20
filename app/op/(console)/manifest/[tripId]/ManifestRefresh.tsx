'use client';

/**
 * ManifestRefresh — client island for manifest page (Issue 014 AC7).
 *
 * Handles manual refresh button: calls GET /api/op/manifest/:tripId and
 * updates the "Last updated" timestamp (AC7).
 * AC6: renders manifest table WITHOUT seat-number column.
 *
 * Design-system surface: Table list, Badge contact/payment status, Alert on
 * load failure, Button refresh. Every data-testid is preserved.
 */

import { useState } from 'react';
import type { ManifestRow } from '@/lib/manifest/getManifest';
import type { BookingStatus } from '@prisma/client';
import { bookingStatusDisplay } from '@/lib/op/statusLabels';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

interface Props {
  tripId: string;
  initialGeneratedAt: string;
  initialRows: ManifestRow[];
}

const CONTACT_DISPLAY: Record<
  ManifestRow['contactStatus'],
  { label: string; variant: 'neutral' | 'success' | 'danger' | 'pending' }
> = {
  pending: { label: 'Chưa gọi', variant: 'pending' },
  reached: { label: 'Đã liên lạc', variant: 'success' },
  no_answer: { label: 'Không bắt máy', variant: 'danger' },
  callback: { label: 'Gọi lại sau', variant: 'neutral' },
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={handleRefresh}
          disabled={loading}
          data-testid="manifest-refresh-btn"
        >
          {loading ? 'Đang tải…' : 'Làm mới'}
        </Button>
        <span data-testid="manifest-last-updated" className="text-sm text-muted-foreground">
          Cập nhật lần cuối: {new Date(generatedAt).toLocaleString('vi-VN')}
        </span>
      </div>

      {error && (
        <Alert variant="error" data-testid="manifest-error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {rows.length === 0 ? (
        <Card>
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            Không có hành khách nào.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
          {/* AC6: NO seat-number column */}
          <Table data-testid="manifest-table">
            <TableHeader>
              <TableRow>
                <TableHead>Mã đặt</TableHead>
                <TableHead>Hành khách</TableHead>
                <TableHead>SĐT</TableHead>
                <TableHead>Vé</TableHead>
                <TableHead>Điểm đón</TableHead>
                <TableHead>Liên lạc</TableHead>
                <TableHead>TT thanh toán</TableHead>
                <TableHead>Lên xe</TableHead>
                <TableHead>Cờ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const contact = CONTACT_DISPLAY[row.contactStatus] ?? {
                  label: row.contactStatus,
                  variant: 'neutral' as const,
                };
                const payment = bookingStatusDisplay(row.paymentStatus as BookingStatus);
                return (
                  <TableRow
                    key={row.bookingId}
                    data-testid={`manifest-row-${row.bookingId}`}
                    className={row.escalatedAt ? 'bg-warning/10' : undefined}
                  >
                    <TableCell className="font-mono text-xs">{row.bookingRef}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell className="tabular-nums">{row.phone}</TableCell>
                    <TableCell className="tabular-nums">{row.ticketCount}</TableCell>
                    <TableCell>{row.pickupPointName ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={contact.variant}>{contact.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={payment.variant}>{payment.label}</Badge>
                    </TableCell>
                    <TableCell className="text-center">{row.pickedUpAt ? '✓' : '—'}</TableCell>
                    <TableCell>
                      <span className="flex gap-1">
                        {row.manualFlag && <span aria-label="Thủ công" title="Thủ công">✏</span>}
                        {row.cashFlag && <span aria-label="Tiền mặt" title="Tiền mặt">💵</span>}
                        {row.escalatedAt && (
                          <span aria-label="Cần xử lý" title="Cần xử lý">⚠</span>
                        )}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
