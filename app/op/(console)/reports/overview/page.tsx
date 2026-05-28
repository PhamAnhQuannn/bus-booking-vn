/**
 * /op/reports/overview — Operator KPI dashboard (Tổng quan).
 *
 * Headline metrics (revenue, seats, occupancy, paid-rate), booking-status
 * breakdown, and the platform conversion funnel for the selected date range.
 * Reuses getOperatorKpis (which itself reuses getRevenueReport) + getFunnel.
 * In-process lib calls only (no self-fetch — AGENTS.md rule).
 */

import { redirect } from 'next/navigation';
import { getOperatorSession } from '@/lib/op/getOperatorSession';
import { getOperatorKpis } from '@/lib/reports/getOperatorKpis';
import { getFunnel } from '@/lib/analytics/getFunnel';
import { getDefaultDateRange } from '@/lib/op/dateRanges';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkline } from '@/components/ui/sparkline';
import { PageHeader } from '@/components/op/PageHeader';
import { ReportsCharts } from './ReportsCharts';

function formatVnd(v: number): string {
  return v.toLocaleString('vi-VN') + 'đ';
}

const STATUS_LABEL: Record<string, string> = {
  awaiting_payment: 'Chờ thanh toán',
  pending_cash_payment: 'Chờ tiền mặt',
  paid_operator_notified: 'Đã thanh toán',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
  trip_cancelled: 'Chuyến hủy',
  no_show: 'Không lên xe',
  payment_failed_expired: 'Thanh toán lỗi',
};

function DeltaBadge({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const up = pct >= 0;
  return (
    <span
      className={up ? 'text-xs font-medium text-success-foreground' : 'text-xs font-medium text-destructive'}
    >
      {up ? '▲' : '▼'} {Math.abs(pct)}% so với kỳ trước
    </span>
  );
}

function Kpi({
  label,
  value,
  hint,
  delta,
  spark,
}: {
  label: string;
  value: string;
  hint?: string;
  delta?: number | null;
  spark?: number[];
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 py-5">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="font-mono text-2xl font-bold tracking-tight">{value}</span>
        {delta !== undefined && <DeltaBadge pct={delta} />}
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        {spark && spark.length > 1 && <Sparkline data={spark} className="mt-2" />}
      </CardContent>
    </Card>
  );
}

interface SearchParams {
  dateFrom?: string;
  dateTo?: string;
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getOperatorSession();
  if (!session) redirect('/op/login');
  if (session.requiresPasswordChange) redirect('/op/first-login');

  const params = await searchParams;
  const { from, to } = getDefaultDateRange(30);
  const dateFrom = params.dateFrom ?? from;
  const dateTo = params.dateTo ?? to;

  const [kpis, funnel] = await Promise.all([
    getOperatorKpis({ operatorId: session.operatorId, dateFrom, dateTo }),
    getFunnel({ dateFrom, dateTo }),
  ]);

  const funnelTop = funnel[0]?.sessions ?? 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6">
      <PageHeader
        breadcrumb={[{ label: 'Báo cáo' }, { label: 'Tổng quan' }]}
        title="Tổng quan"
        subtitle="Chỉ số hoạt động trong khoảng thời gian đã chọn."
      />

      {/* Date range — plain GET form, no JS required */}
      <form method="get" className="mb-6 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Từ ngày</span>
          <input
            type="date"
            name="dateFrom"
            defaultValue={dateFrom}
            className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Đến ngày</span>
          <input
            type="date"
            name="dateTo"
            defaultValue={dateTo}
            className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </label>
        <button
          type="submit"
          className="h-9 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground shadow-e1 transition-colors hover:bg-primary/90"
        >
          Áp dụng
        </button>
      </form>

      {/* KPI tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Doanh thu" value={formatVnd(kpis.grossRevenueVnd)} hint={`Thực nhận ${formatVnd(kpis.netPayoutVnd)}`} delta={kpis.revenueDeltaPct} spark={kpis.dailyRevenue} />
        <Kpi label="Ghế đã bán" value={String(kpis.seatsSold)} hint={`${kpis.periodTrips} chuyến`} />
        <Kpi label="Tỷ lệ lấp đầy" value={`${kpis.occupancyPct}%`} hint={`${kpis.seatsSold}/${kpis.capacityTotal} ghế`} />
        <Kpi label="Tỷ lệ thanh toán" value={`${kpis.paidRatePct}%`} hint={`${kpis.paidBookings}/${kpis.totalBookings} đơn`} />
      </div>

      {/* Revenue line chart + status donut (Recharts, dynamic-loaded). */}
      <ReportsCharts
        revenueSeries={(function buildSeries() {
          const days: string[] = [];
          const d = new Date(`${dateFrom}T00:00:00Z`);
          const end = new Date(`${dateTo}T00:00:00Z`);
          while (d <= end) {
            days.push(d.toISOString().slice(0, 10));
            d.setUTCDate(d.getUTCDate() + 1);
          }
          return days.map((date, i) => ({ date, revenueVnd: kpis.dailyRevenue[i] ?? 0 }));
        })()}
        statusBreakdown={kpis.statusBreakdown.map((s) => ({
          status: s.status,
          label: STATUS_LABEL[s.status] ?? s.status,
          count: s.count,
        }))}
      />

      <div className="mt-6 grid gap-6">
        {/* Conversion funnel */}
        <Card>
          <CardHeader>
            <CardTitle as="h2" className="text-base">Phễu chuyển đổi (toàn sàn)</CardTitle>
          </CardHeader>
          <CardContent>
            {funnelTop === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có dữ liệu phễu trong kỳ.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {funnel.map((step) => (
                  <li key={step.step} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{step.label}</span>
                      <span className="font-mono text-muted-foreground">
                        {step.sessions} · {step.conversionPct}%
                        {step.dropPct > 0 ? ` (−${step.dropPct}%)` : ''}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                      <div
                        className="h-full rounded-full bg-info-foreground"
                        style={{ width: `${step.conversionPct}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Reference: Badge import removed when status-list ul replaced by donut chart.
