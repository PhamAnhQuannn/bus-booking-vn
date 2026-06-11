/**
 * /admin — Admin Overview (Issue 064). React Server Component.
 *
 * All data is fetched IN-PROCESS via lib functions (getAdminMetrics / getActionQueue
 * / getFailureAlerts) — NEVER self-fetched (AGENTS.md Issue 002/003).
 *
 * RSC PURITY (AGENTS.md Issue 016): the render body must be a pure function of its
 * inputs. The default date range is computed in the MODULE-SCOPE getDefaultRange()
 * helper below (which calls the impure getDefaultDateRange internally) — never
 * Date.now()/Math.random() inline in the render body. react-hooks/purity stays green.
 *
 * ROLE MATRIX (gated on ctx.role from requireAdminPage):
 *   Section            SUPER_ADMIN  FINANCE  SUPPORT
 *   ----------------   -----------  -------  -------
 *   Operational cards   yes          yes      yes      (customers, operators, bookings)
 *   Finance cards       yes          yes      no       (GMV, platform revenue)
 *   Action: approvals   yes          yes      yes
 *   Action: disputes    yes          yes      no       (finance-sensitive)
 *   Action: failedPayout yes         yes      no       (finance-sensitive)
 *   Failure alerts      yes          yes      yes      (operational health)
 *   Infra health        yes          yes      yes
 * Rationale: SUPPORT triages operators/customers/notifications but does not see
 * money figures (GMV/revenue) or money-flow failures (disputes/payouts). The target
 * tabs (065–070) enforce the same role split; this is the Overview's mirror of it.
 */

import Link from 'next/link';

import { requireAdminPage } from '@/lib/auth';
import { getAdminMetrics } from '@/lib/analytics';
import { getActionQueue } from '@/lib/admin';
import { getFailureAlerts } from '@/lib/admin';
import { getDefaultDateRange } from '@/lib/op';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

/**
 * Module-scope default-range helper (Issue 016: keep the impure Date read OUT of
 * the RSC render body). Last 30 days, VN-tz date strings (YYYY-MM-DD).
 */
function getDefaultRange(): { dateFrom: string; dateTo: string } {
  const { from, to } = getDefaultDateRange(30);
  return { dateFrom: from, dateTo: to };
}

const vnd = new Intl.NumberFormat('vi-VN');
function formatVnd(amount: number): string {
  return `${vnd.format(amount)} ₫`; // e.g. "12.500.000 ₫"
}

/** Mask a notification recipient (phone/email) for the failure list — PII glance only. */
function maskRecipient(recipient: string): string {
  if (recipient.length <= 4) return '••••';
  return `${recipient.slice(0, 2)}••••${recipient.slice(-2)}`;
}

interface MetricCardProps {
  label: string;
  value: string;
  hint?: string;
}

function MetricCard({ label, value, hint }: MetricCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle as="h3" className="text-2xl">
          {value}
        </CardTitle>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardHeader>
    </Card>
  );
}

export default async function AdminOverviewPage() {
  const ctx = await requireAdminPage();
  const { dateFrom, dateTo } = getDefaultRange();

  // Finance-sensitive figures are visible to SUPER_ADMIN + FINANCE only.
  const canSeeFinance = ctx.role === 'SUPER_ADMIN' || ctx.role === 'FINANCE';

  // In-process fetches (no self-fetch). Run concurrently.
  const [metrics, actionQueue, failures] = await Promise.all([
    getAdminMetrics({ dateFrom, dateTo }),
    getActionQueue(),
    getFailureAlerts(5),
  ]);

  const sentryUrl = process.env.SENTRY_DASHBOARD_URL;
  const datadogUrl = process.env.DATADOG_DASHBOARD_URL;
  const hasMonitoring = sentryUrl || datadogUrl;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Tổng quan</h1>
        <p className="text-sm text-muted-foreground">
          Chỉ số nền tảng 30 ngày qua ({dateFrom} → {dateTo}).
        </p>
      </header>

      {/* Metrics cards */}
      <section aria-labelledby="metrics-heading" className="space-y-3">
        <h2 id="metrics-heading" className="text-sm font-medium text-muted-foreground">
          Chỉ số chính
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard label="Khách hàng" value={vnd.format(metrics.customers)} />
          <MetricCard
            label="Nhà xe"
            value={vnd.format(metrics.operators.total)}
            hint={`${vnd.format(metrics.operators.approved)} đã duyệt`}
          />
          <MetricCard label="Đặt vé (đã thanh toán)" value={vnd.format(metrics.bookings)} />
          {canSeeFinance ? (
            <>
              <MetricCard label="GMV" value={formatVnd(metrics.gmvVnd)} />
              <MetricCard
                label="Doanh thu nền tảng"
                value={formatVnd(metrics.revenueVnd)}
              />
            </>
          ) : null}
        </div>
      </section>

      {/* Action queue */}
      <section aria-labelledby="queue-heading" className="space-y-3">
        <h2 id="queue-heading" className="text-sm font-medium text-muted-foreground">
          Hàng đợi xử lý
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/admin/approvals" className="outline-none focus-visible:ring-3 focus-visible:ring-ring rounded-xl">
            <Card className="transition-colors hover:bg-accent/40">
              <CardHeader>
                <CardDescription>Chờ phê duyệt</CardDescription>
                <CardTitle as="h3" className="text-2xl">
                  {actionQueue.pendingApprovals}
                  {actionQueue.pendingApprovals > 0 ? (
                    <Badge variant="pending" className="ml-2 align-middle">
                      xem xét
                    </Badge>
                  ) : null}
                </CardTitle>
              </CardHeader>
            </Card>
          </Link>

          {/* Charter dispatch queue (085): visible to all roles — SUPER_ADMIN +
              SUPPORT dispatch; not finance-sensitive. This count IS the admin
              "new charter request" notification surface (AC4). */}
          <Link href="/admin/charter" className="outline-none focus-visible:ring-3 focus-visible:ring-ring rounded-xl">
            <Card className="transition-colors hover:bg-accent/40">
              <CardHeader>
                <CardDescription>Điều phối thuê xe</CardDescription>
                <CardTitle as="h3" className="text-2xl">
                  {actionQueue.pendingCharters}
                  {actionQueue.pendingCharters > 0 ? (
                    <Badge variant="pending" className="ml-2 align-middle">
                      điều phối
                    </Badge>
                  ) : null}
                </CardTitle>
              </CardHeader>
            </Card>
          </Link>

          {canSeeFinance ? (
            <>
              <Link href="/admin/finance" className="outline-none focus-visible:ring-3 focus-visible:ring-ring rounded-xl">
                <Card className="transition-colors hover:bg-accent/40">
                  <CardHeader>
                    <CardDescription>Tranh chấp mở</CardDescription>
                    <CardTitle as="h3" className="text-2xl">
                      {actionQueue.openDisputes}
                      {actionQueue.openDisputes > 0 ? (
                        <Badge variant="danger" className="ml-2 align-middle">
                          hoàn tiền
                        </Badge>
                      ) : null}
                    </CardTitle>
                  </CardHeader>
                </Card>
              </Link>

              <Link href="/admin/finance" className="outline-none focus-visible:ring-3 focus-visible:ring-ring rounded-xl">
                <Card className="transition-colors hover:bg-accent/40">
                  <CardHeader>
                    <CardDescription>Chi trả thất bại</CardDescription>
                    <CardTitle as="h3" className="text-2xl">
                      {actionQueue.failedPayouts}
                      {actionQueue.failedPayouts > 0 ? (
                        <Badge variant="danger" className="ml-2 align-middle">
                          thất bại
                        </Badge>
                      ) : null}
                    </CardTitle>
                  </CardHeader>
                </Card>
              </Link>
            </>
          ) : null}
        </div>
      </section>

      {/* Failure alerts */}
      <section aria-labelledby="failures-heading" className="space-y-3">
        <h2 id="failures-heading" className="text-sm font-medium text-muted-foreground">
          Cảnh báo lỗi
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <MetricCard
            label="Thông báo thất bại"
            value={vnd.format(failures.failedNotifications)}
            hint="SMS / email không gửi được"
          />
          <MetricCard
            label="Chi trả thất bại"
            value={vnd.format(failures.failedPayouts)}
            hint="giải ngân bị lỗi"
          />
        </div>

        {failures.recent.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle as="h3" className="text-sm">
                Thông báo thất bại gần đây
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border text-sm">
                {failures.recent.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-4 py-2">
                    <span className="min-w-0">
                      <span className="font-medium">{f.template}</span>{' '}
                      <span className="text-muted-foreground">{maskRecipient(f.recipient)}</span>
                      {f.lastError ? (
                        <span className="block truncate text-xs text-destructive">{f.lastError}</span>
                      ) : null}
                    </span>
                    <time
                      dateTime={f.createdAt.toISOString()}
                      className="shrink-0 text-xs text-muted-foreground"
                    >
                      {f.createdAt.toISOString().slice(0, 16).replace('T', ' ')}
                    </time>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : (
          <Alert variant="success">
            <AlertTitle>Không có lỗi gửi gần đây</AlertTitle>
            <AlertDescription>Tất cả thông báo và chi trả đều ổn.</AlertDescription>
          </Alert>
        )}
      </section>

      {hasMonitoring && (
        <section aria-labelledby="infra-heading" className="space-y-3">
          <h2 id="infra-heading" className="text-sm font-medium text-muted-foreground">
            Tình trạng hạ tầng
          </h2>
          <Card>
            <CardHeader>
              <CardDescription>
                Chỉ số hạ tầng nằm trên hệ thống giám sát ngoài. Các liên kết dưới đây
                mở Sentry / Datadog trong tab mới.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              {sentryUrl && (
                <a
                  href={sentryUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-9 items-center rounded-md border border-border px-3 text-sm font-medium outline-none transition-colors hover:bg-accent/40 focus-visible:ring-3 focus-visible:ring-ring"
                >
                  Mở Sentry
                </a>
              )}
              {datadogUrl && (
                <a
                  href={datadogUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-9 items-center rounded-md border border-border px-3 text-sm font-medium outline-none transition-colors hover:bg-accent/40 focus-visible:ring-3 focus-visible:ring-ring"
                >
                  Mở Datadog
                </a>
              )}
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
