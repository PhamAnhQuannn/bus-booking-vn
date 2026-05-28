'use client';

/**
 * PayoutsClient — client island for the operator payouts report page.
 *
 * Displays payout rows. For failed payouts, shows a "Thử lại" (Retry) button that
 * POSTs via retryPayoutApi (lib/api/reportsClient.ts) — a client-to-API call, allowed
 * because this is a client component, not an RSC self-fetch.
 *
 * After a successful retry, calls router.refresh() to re-render the RSC page with the
 * updated payout status from DB. CSRF: retryPayoutApi sends X-CSRF-Token (non-GET).
 *
 * Design-system surface: Table list, Badge status, Alert on retry failure, Button retry.
 * No data-testids in this surface (no e2e keys off it).
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { retryPayoutApi } from '@/lib/api/reportsClient';
import type { PayoutReportRow } from '@/lib/payouts/getPayoutReport';
import { Card, CardContent } from '@/components/ui/card';
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

// Status display sourced from lib/op/statusLabels (single source of truth).
import { payoutStatusDisplay as statusDisplay } from '@/lib/op/statusLabels';

export default function PayoutsClient({ initialRows }: Props) {
  const router = useRouter();
  const [retrying, setRetrying] = useState<string | null>(null);
  const [error, setError] = useState<string>('');

  async function handleRetry(payoutId: string) {
    setRetrying(payoutId);
    setError('');
    try {
      await retryPayoutApi(payoutId);
      router.refresh();
    } catch (err) {
      const code = (err as { data?: { error?: string } }).data?.error;
      if (code === 'not_failed') {
        setError('Không thể thử lại: khoản thanh toán không ở trạng thái thất bại.');
      } else if (code === 'not_found') {
        setError('Không tìm thấy khoản thanh toán.');
      } else {
        setError('Đã xảy ra lỗi. Vui lòng thử lại.');
      }
    } finally {
      setRetrying(null);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {initialRows.length === 0 ? (
        <Card>
          <CardContent>
            <p className="py-6 text-center text-sm text-muted-foreground">
              Chưa có khoản thanh toán nào.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tuyến</TableHead>
                <TableHead>Khởi hành</TableHead>
                <TableHead>Doanh thu</TableHead>
                <TableHead>Phí nền tảng</TableHead>
                <TableHead>Thanh toán ròng</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Ngày dự kiến</TableHead>
                <TableHead>Ngày thanh toán</TableHead>
                <TableHead>Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialRows.map((row) => {
                const status = statusDisplay(row.status);
                return (
                  <TableRow key={row.payoutId}>
                    <TableCell>{row.routeName}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(row.departureAt)}</TableCell>
                    <TableCell className="tabular-nums">{formatVnd(row.gross)}</TableCell>
                    <TableCell className="tabular-nums">{formatVnd(row.platformFee)}</TableCell>
                    <TableCell className="tabular-nums">{formatVnd(row.net)}</TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                      {row.failureReason && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({row.failureReason})
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(row.scheduledAt)}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {row.settledAt ? formatDate(row.settledAt) : '—'}
                    </TableCell>
                    <TableCell>
                      {row.status === 'failed' && (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRetry(row.payoutId)}
                          disabled={retrying === row.payoutId}
                          aria-label={`Thử lại thanh toán cho ${row.routeName}`}
                        >
                          {retrying === row.payoutId ? 'Đang xử lý…' : 'Thử lại'}
                        </Button>
                      )}
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
