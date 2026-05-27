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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

function toVnDateString(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Default range (last 30 days) in VN tz. Module-scope helper keeps the RSC body pure. */
function getDefaultDateRange(): { from: string; to: string } {
  const now = Date.now();
  return {
    to: toVnDateString(new Date(now)),
    from: toVnDateString(new Date(now - 30 * 24 * 3600 * 1000)),
  };
}

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

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 py-5">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="font-mono text-2xl font-bold tracking-tight">{value}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
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
  const { from, to } = getDefaultDateRange();
  const dateFrom = params.dateFrom ?? from;
  const dateTo = params.dateTo ?? to;

  const [kpis, funnel] = await Promise.all([
    getOperatorKpis({ operatorId: session.operatorId, dateFrom, dateTo }),
    getFunnel({ dateFrom, dateTo }),
  ]);

  const funnelTop = funnel[0]?.sessions ?? 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Tổng quan</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Chỉ số hoạt động trong khoảng thời gian đã chọn.
      </p>

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
        <Kpi label="Doanh thu" value={formatVnd(kpis.grossRevenueVnd)} hint={`Thực nhận ${formatVnd(kpis.netPayoutVnd)}`} />
        <Kpi label="Ghế đã bán" value={String(kpis.seatsSold)} hint={`${kpis.periodTrips} chuyến`} />
        <Kpi label="Tỷ lệ lấp đầy" value={`${kpis.occupancyPct}%`} hint={`${kpis.seatsSold}/${kpis.capacityTotal} ghế`} />
        <Kpi label="Tỷ lệ thanh toán" value={`${kpis.paidRatePct}%`} hint={`${kpis.paidBookings}/${kpis.totalBookings} đơn`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Booking status breakdown */}
        <Card>
          <CardHeader>
            <CardTitle as="h2" className="text-base">Đơn theo trạng thái</CardTitle>
          </CardHeader>
          <CardContent>
            {kpis.statusBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có đơn nào trong kỳ.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {kpis.statusBreakdown.map((s) => (
                  <li key={s.status} className="flex items-center justify-between text-sm">
                    <span>{STATUS_LABEL[s.status] ?? s.status}</span>
                    <Badge variant="neutral">{s.count}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

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
                        className="h-full rounded-full bg-primary"
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
