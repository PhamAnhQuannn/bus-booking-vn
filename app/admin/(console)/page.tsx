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
import { getAdminMetrics } from '@/lib/analytics/getAdminMetrics';
import { getActionQueue } from '@/lib/admin/getActionQueue';
import { getFailureAlerts } from '@/lib/admin/getFailureAlerts';
import { getDefaultDateRange } from '@/lib/op/dateRanges';
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

  const sentryUrl = process.env.SENTRY_DASHBOARD_URL ?? '#';
  const datadogUrl = process.env.DATADOG_DASHBOARD_URL ?? '#';

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Overview</h1>
        <p className="text-sm text-muted-foreground">
          Platform metrics for the last 30 days ({dateFrom} → {dateTo}).
        </p>
      </header>

      {/* Metrics cards */}
      <section aria-labelledby="metrics-heading" className="space-y-3">
        <h2 id="metrics-heading" className="text-sm font-medium text-muted-foreground">
          Key metrics
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard label="Customers" value={vnd.format(metrics.customers)} />
          <MetricCard
            label="Operators"
            value={vnd.format(metrics.operators.total)}
            hint={`${vnd.format(metrics.operators.approved)} approved`}
          />
          <MetricCard label="Bookings (paid)" value={vnd.format(metrics.bookings)} />
          {canSeeFinance ? (
            <>
              <MetricCard label="GMV" value={formatVnd(metrics.gmvVnd)} />
              <MetricCard
                label="Platform revenue"
                value={formatVnd(metrics.revenueVnd)}
              />
            </>
          ) : null}
        </div>
      </section>

      {/* Action queue */}
      <section aria-labelledby="queue-heading" className="space-y-3">
        <h2 id="queue-heading" className="text-sm font-medium text-muted-foreground">
          Action queue
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/admin/approvals" className="outline-none focus-visible:ring-3 focus-visible:ring-ring rounded-xl">
            <Card className="transition-colors hover:bg-accent/40">
              <CardHeader>
                <CardDescription>Pending approvals</CardDescription>
                <CardTitle as="h3" className="text-2xl">
                  {actionQueue.pendingApprovals}
                  {actionQueue.pendingApprovals > 0 ? (
                    <Badge variant="pending" className="ml-2 align-middle">
                      review
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
                <CardDescription>Charter dispatch</CardDescription>
                <CardTitle as="h3" className="text-2xl">
                  {actionQueue.pendingCharters}
                  {actionQueue.pendingCharters > 0 ? (
                    <Badge variant="pending" className="ml-2 align-middle">
                      dispatch
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
                    <CardDescription>Open disputes</CardDescription>
                    <CardTitle as="h3" className="text-2xl">
                      {actionQueue.openDisputes}
                      {actionQueue.openDisputes > 0 ? (
                        <Badge variant="danger" className="ml-2 align-middle">
                          chargeback
                        </Badge>
                      ) : null}
                    </CardTitle>
                  </CardHeader>
                </Card>
              </Link>

              <Link href="/admin/finance" className="outline-none focus-visible:ring-3 focus-visible:ring-ring rounded-xl">
                <Card className="transition-colors hover:bg-accent/40">
                  <CardHeader>
                    <CardDescription>Failed payouts</CardDescription>
                    <CardTitle as="h3" className="text-2xl">
                      {actionQueue.failedPayouts}
                      {actionQueue.failedPayouts > 0 ? (
                        <Badge variant="danger" className="ml-2 align-middle">
                          failed
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
          Failure alerts
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <MetricCard
            label="Failed notifications"
            value={vnd.format(failures.failedNotifications)}
            hint="SMS / email that never delivered"
          />
          <MetricCard
            label="Failed payouts"
            value={vnd.format(failures.failedPayouts)}
            hint="disbursements that errored"
          />
        </div>

        {failures.recent.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle as="h3" className="text-sm">
                Recent failed notifications
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
            <AlertTitle>No recent delivery failures</AlertTitle>
            <AlertDescription>All notifications and payouts are clear.</AlertDescription>
          </Alert>
        )}
      </section>

      {/* Infra health — link-out only (AC4: do NOT rebuild the dashboard). */}
      <section aria-labelledby="infra-heading" className="space-y-3">
        <h2 id="infra-heading" className="text-sm font-medium text-muted-foreground">
          Infrastructure health
        </h2>
        <Card>
          <CardHeader>
            <CardDescription>
              Infra metrics live in the external observability stack. These open
              Sentry / Datadog in a new tab; configure the URLs via
              SENTRY_DASHBOARD_URL / DATADOG_DASHBOARD_URL.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <a
              href={sentryUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-9 items-center rounded-md border border-border px-3 text-sm font-medium outline-none transition-colors hover:bg-accent/40 focus-visible:ring-3 focus-visible:ring-ring aria-disabled:pointer-events-none aria-disabled:opacity-50"
              aria-disabled={sentryUrl === '#'}
            >
              Open Sentry
            </a>
            <a
              href={datadogUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-9 items-center rounded-md border border-border px-3 text-sm font-medium outline-none transition-colors hover:bg-accent/40 focus-visible:ring-3 focus-visible:ring-ring aria-disabled:pointer-events-none aria-disabled:opacity-50"
              aria-disabled={datadogUrl === '#'}
            >
              Open Datadog
            </a>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
