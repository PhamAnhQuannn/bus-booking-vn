/**
 * /admin/moderation — admin Moderation tab (Issue 069, Part F). React Server Component.
 *
 * Three sections, all read IN-PROCESS (NEVER self-fetched — AGENTS.md 002/003):
 *   1. Reports queue       — getOpenReports() → each OPEN report with a Resolve button.
 *   2. Disable by id       — a form (trip|route + id + reason) → POST disable.
 *   3. Currently disabled  — getModeratedItems() → disabled trips + routes, each with
 *                            an Enable button.
 *
 * ROLE GATE: SUPER_ADMIN + SUPPORT may act; other roles get a read-only
 * "Insufficient role" notice and NO action islands (the routes enforce the same set).
 *
 * RSC PURITY (Issue 016): no Date.now()/Math.random() in the render body. Dates are
 * rendered from DB columns via toLocaleString only.
 */

import { requireAdminPage } from '@/lib/auth/requireAdminPage';
import { getOpenReports, getModeratedItems } from '@/lib/admin/getModerationQueue';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  ResolveReportButton,
  DisableByIdForm,
  EnableButton,
} from './ModerationActions';

interface PageProps {
  searchParams: Promise<{ cursor?: string }>;
}

export default async function AdminModerationPage({ searchParams }: PageProps) {
  const ctx = await requireAdminPage();
  const canAct = ctx.role === 'SUPER_ADMIN' || ctx.role === 'SUPPORT';

  if (!canAct) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">Moderation</h1>
        </header>
        <Alert variant="warning">
          <AlertTitle>Insufficient role</AlertTitle>
          <AlertDescription>
            The Moderation tab is restricted to SUPER_ADMIN and SUPPORT roles.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const sp = await searchParams;
  const [{ items: reports, nextCursor }, moderated] = await Promise.all([
    getOpenReports({ cursor: sp.cursor }),
    getModeratedItems(),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Moderation</h1>
        <p className="text-sm text-muted-foreground">
          Triage reports and disable (never edit) reported trips or routes.
        </p>
      </header>

      {/* Section 1 — Reports queue */}
      <section className="space-y-3" aria-labelledby="reports-heading">
        <h2 id="reports-heading" className="text-lg font-semibold">
          Open reports
        </h2>
        {reports.length === 0 ? (
          <Alert>
            <AlertTitle>No open reports</AlertTitle>
            <AlertDescription>The report queue is clear.</AlertDescription>
          </Alert>
        ) : (
          <ul className="space-y-3">
            {reports.map((r) => (
              <li key={r.id}>
                <Card data-testid={`report-row-${r.id}`}>
                  <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div className="min-w-0 space-y-1">
                      <CardTitle as="h3" className="text-base">
                        {r.reason}
                      </CardTitle>
                      <p className="font-mono text-sm text-muted-foreground">
                        {r.targetType}:{r.targetId}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.createdAt.toLocaleString()}
                      </p>
                    </div>
                    <ResolveReportButton reportId={r.id} />
                  </CardHeader>
                </Card>
              </li>
            ))}
          </ul>
        )}
        {nextCursor ? (
          <div className="flex justify-center">
            <a
              href={`/admin/moderation?cursor=${encodeURIComponent(nextCursor)}`}
              className="min-h-9 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent/40"
              data-testid="reports-next-page"
            >
              Next page
            </a>
          </div>
        ) : null}
      </section>

      {/* Section 2 — Disable by id */}
      <section className="space-y-3" aria-labelledby="disable-heading">
        <h2 id="disable-heading" className="text-lg font-semibold">
          Disable a trip or route
        </h2>
        <Card>
          <CardContent className="pt-6">
            <DisableByIdForm />
          </CardContent>
        </Card>
      </section>

      {/* Section 3 — Currently disabled */}
      <section className="space-y-3" aria-labelledby="disabled-heading">
        <h2 id="disabled-heading" className="text-lg font-semibold">
          Currently disabled
        </h2>

        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Trips</h3>
          {moderated.trips.length === 0 ? (
            <p className="text-sm text-muted-foreground">No disabled trips.</p>
          ) : (
            <ul className="space-y-2">
              {moderated.trips.map((t) => (
                <li key={t.id}>
                  <Card data-testid={`disabled-trip-${t.id}`}>
                    <CardHeader className="flex flex-row items-center justify-between gap-4">
                      <div className="min-w-0 space-y-1">
                        <CardTitle as="h4" className="text-base">
                          {t.label}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {t.departureAt.toLocaleString()}{' '}
                          <span className="font-mono">({t.id})</span>
                        </p>
                      </div>
                      <Badge variant="danger">Disabled</Badge>
                      <EnableButton kind="trips" id={t.id} />
                    </CardHeader>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Routes</h3>
          {moderated.routes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No disabled routes.</p>
          ) : (
            <ul className="space-y-2">
              {moderated.routes.map((rt) => (
                <li key={rt.id}>
                  <Card data-testid={`disabled-route-${rt.id}`}>
                    <CardHeader className="flex flex-row items-center justify-between gap-4">
                      <div className="min-w-0 space-y-1">
                        <CardTitle as="h4" className="text-base">
                          {rt.origin} → {rt.destination}
                        </CardTitle>
                        <p className="font-mono text-xs text-muted-foreground">{rt.id}</p>
                      </div>
                      <Badge variant="danger">Disabled</Badge>
                      <EnableButton kind="routes" id={rt.id} />
                    </CardHeader>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
