'use client';

/**
 * RevenueClient — client island for the operator revenue report page.
 *
 * Handles date-range filter form. On submit, re-navigates with new searchParams
 * (which triggers a server-side re-render of the RSC page).
 *
 * The CSV download link is a plain <a href="..."> anchor (styled as a Button via
 * buttonVariants) — the browser triggers the download automatically via the API's
 * Content-Disposition: attachment header. This is a CLIENT component, so the anchor
 * is not a self-fetch; the table data is rendered server-side and passed as initialRows.
 *
 * Design-system surface: Card filter band (Label/Input + Button), Table + <tfoot>
 * totals, Badge payout status. No data-testids in this surface (no e2e keys off it).
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { RevenueRow } from '@/lib/ledger';
import { Card, CardContent } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

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

// Status display sourced from lib/op/statusLabels (single source of truth).
import { payoutStatusDisplay as payoutDisplay } from '@/lib/op/statusLabels';

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

  const totalGross = initialRows.reduce((s, r) => s + r.grossRevenueVnd, 0);
  const totalFee = initialRows.reduce((s, r) => s + r.platformFeeVnd, 0);
  const totalNet = initialRows.reduce((s, r) => s + r.netPayoutVnd, 0);

  return (
    <div className="space-y-4">
      {/* Date filter band */}
      <Card>
        <CardContent>
          <form onSubmit={handleFilter} className="flex flex-wrap items-end gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="revenue-date-from">Từ ngày</Label>
              <DatePicker
                id="revenue-date-from"
                value={from}
                onValueChange={setFrom}
                className="w-44"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="revenue-date-to">Đến ngày</Label>
              <DatePicker
                id="revenue-date-to"
                value={to}
                onValueChange={setTo}
                className="w-44"
              />
            </div>
            <Button type="submit">Lọc</Button>
            <a href={csvHref} className={buttonVariants({ variant: 'outline' })}>
              Tải CSV
            </a>
          </form>
        </CardContent>
      </Card>

      {/* Revenue table */}
      {initialRows.length === 0 ? (
        <Card>
          <CardContent>
            <p className="py-6 text-center text-sm text-muted-foreground">
              Không có dữ liệu trong khoảng thời gian này.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã chuyến</TableHead>
                <TableHead>Khởi hành</TableHead>
                <TableHead>Tuyến</TableHead>
                <TableHead>Số ghế</TableHead>
                <TableHead>Doanh thu (VND)</TableHead>
                <TableHead>Phí nền tảng (VND)</TableHead>
                <TableHead>Thanh toán ròng (VND)</TableHead>
                <TableHead>Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialRows.map((row) => {
                const status = payoutDisplay(row.payoutStatus);
                return (
                  <TableRow key={row.tripId}>
                    <TableCell className="font-mono text-xs">{row.tripId.slice(0, 8)}…</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(row.departureAt)}</TableCell>
                    <TableCell>{row.routeName}</TableCell>
                    <TableCell className="tabular-nums">{row.seatsSold}</TableCell>
                    <TableCell className="tabular-nums">{formatVnd(row.grossRevenueVnd)}</TableCell>
                    <TableCell className="tabular-nums">{formatVnd(row.platformFeeVnd)}</TableCell>
                    <TableCell className="tabular-nums">{formatVnd(row.netPayoutVnd)}</TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4}>Tổng cộng</TableCell>
                <TableCell className="tabular-nums">{formatVnd(totalGross)}</TableCell>
                <TableCell className="tabular-nums">{formatVnd(totalFee)}</TableCell>
                <TableCell className="tabular-nums">{formatVnd(totalNet)}</TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </Card>
      )}
    </div>
  );
}
