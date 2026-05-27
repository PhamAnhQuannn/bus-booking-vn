'use client';

/**
 * BookingSummaryRail (PTN-07) — persistent order summary for the checkout flow.
 * Route + departure + pax + price breakdown + total + hold timer + trust line.
 * Desktop: sticky right rail. Mobile: renders inline (stacked above the form).
 */

import { ArrowRight, Clock, ShieldCheck } from 'lucide-react';
import { HoldTimer } from '@/components/HoldTimer';

function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + 'đ';
}

function formatDeparture(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', {
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  });
}

export interface BookingSummary {
  routeOrigin: string;
  routeDestination: string;
  departureAt: string;
  operatorLegalName: string;
  ticketCount: number;
  unitPriceVND: number;
  totalVND: number;
}

export function BookingSummaryRail({ summary }: { summary: BookingSummary }) {
  return (
    <aside
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-e2 md:sticky md:top-20"
      aria-label="Tóm tắt đơn"
    >
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2 font-semibold">
          <span>{summary.routeOrigin}</span>
          <ArrowRight className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span>{summary.routeDestination}</span>
        </div>
        <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock className="size-4" aria-hidden="true" />
          <span className="font-mono">{formatDeparture(summary.departureAt)}</span>
        </span>
        <span className="text-sm text-muted-foreground">{summary.operatorLegalName}</span>
      </div>

      <dl className="flex flex-col gap-2 border-t border-border/60 pt-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">
            Giá vé × {summary.ticketCount}
          </dt>
          <dd className="font-mono">{formatVND(summary.unitPriceVND * summary.ticketCount)}</dd>
        </div>
        <div className="mt-1 flex items-center justify-between border-t border-border pt-3 text-lg font-semibold">
          <dt>Tổng cộng</dt>
          <dd className="font-mono text-primary" aria-live="polite">{formatVND(summary.totalVND)}</dd>
        </div>
      </dl>

      <HoldTimer />

      <p className="inline-flex items-start gap-1.5 border-t border-border/60 pt-3 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success-foreground" aria-hidden="true" />
        Nhà xe gọi xác nhận giờ đón &amp; chỗ ngồi qua SMS sau khi đặt.
      </p>
    </aside>
  );
}
