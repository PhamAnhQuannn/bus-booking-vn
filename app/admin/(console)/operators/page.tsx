/**
 * /admin/operators — admin Operators tab (Issue 067). React Server Component.
 *
 * Lists every operator (cursor/seek paginated via `?cursor=`) with an optional
 * status filter (`?status=`). Rows link to the per-operator detail
 * /admin/operators/<id>.
 *
 * Data is read IN-PROCESS via listAllOperators() — NEVER self-fetched (002/003).
 *
 * ROLE GATE: SUPER_ADMIN + FINANCE may view + act on operators (the suspend /
 * reinstate / fee-override routes enforce the same role sets). Other roles get a
 * read-only notice and no operator data.
 *
 * RSC PURITY (Issue 016): no Date.now()/Math.random() in the render body.
 */

import Link from 'next/link';
import type { OperatorStatus } from '@prisma/client';

import { requireAdminPage } from '@/lib/auth/requireAdminPage';
import { listAllOperators } from '@/lib/admin/listAllOperators';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface PageProps {
  searchParams: Promise<{ status?: string; cursor?: string }>;
}

const STATUSES: OperatorStatus[] = [
  'PENDING_REVIEW',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'SUSPENDED',
];

const STATUS_BADGE: Record<OperatorStatus, { variant: 'neutral' | 'pending' | 'success' | 'danger'; label: string }> = {
  PENDING_REVIEW: { variant: 'pending', label: 'Pending review' },
  UNDER_REVIEW: { variant: 'pending', label: 'Under review' },
  APPROVED: { variant: 'success', label: 'Approved' },
  REJECTED: { variant: 'neutral', label: 'Rejected' },
  SUSPENDED: { variant: 'danger', label: 'Suspended' },
};

function normalizeStatus(raw: string | undefined): OperatorStatus | undefined {
  return STATUSES.includes(raw as OperatorStatus) ? (raw as OperatorStatus) : undefined;
}

/** Build a /admin/operators URL preserving status, swapping in the cursor. */
function operatorsHref(status: OperatorStatus | undefined, cursor?: string): string {
  const sp = new URLSearchParams();
  if (status) sp.set('status', status);
  if (cursor) sp.set('cursor', cursor);
  const qs = sp.toString();
  return qs ? `/admin/operators?${qs}` : '/admin/operators';
}

export default async function AdminOperatorsPage({ searchParams }: PageProps) {
  const ctx = await requireAdminPage();
  const canView = ctx.role === 'SUPER_ADMIN' || ctx.role === 'FINANCE';

  if (!canView) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">Operators</h1>
        </header>
        <Alert variant="warning">
          <AlertTitle>Insufficient role</AlertTitle>
          <AlertDescription>
            The Operators tab is restricted to SUPER_ADMIN and FINANCE roles.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const sp = await searchParams;
  const status = normalizeStatus(sp.status);
  const { items, nextCursor } = await listAllOperators({ status, cursor: sp.cursor });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Operators</h1>
        <p className="text-sm text-muted-foreground">
          Review operator accounts, balances, and platform-fee overrides.
        </p>
      </header>

      {/* Status filter — links reset the cursor. */}
      <nav className="flex flex-wrap gap-2" aria-label="Operator status filter">
        <Link
          href={operatorsHref(undefined)}
          className={`rounded-md border px-3 py-1.5 text-sm font-medium ${!status ? 'border-foreground bg-accent/40' : 'border-border'}`}
          aria-current={!status ? 'page' : undefined}
        >
          All
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={operatorsHref(s)}
            className={`rounded-md border px-3 py-1.5 text-sm font-medium ${status === s ? 'border-foreground bg-accent/40' : 'border-border'}`}
            aria-current={status === s ? 'page' : undefined}
          >
            {STATUS_BADGE[s].label}
          </Link>
        ))}
      </nav>

      {items.length === 0 ? (
        <Alert>
          <AlertTitle>No operators</AlertTitle>
          <AlertDescription>No operators match this filter.</AlertDescription>
        </Alert>
      ) : (
        <ul className="space-y-3">
          {items.map((op) => {
            const badge = STATUS_BADGE[op.status];
            return (
              <li key={op.id}>
                <Link
                  href={`/admin/operators/${op.id}`}
                  className="block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring"
                >
                  <Card data-testid={`operator-row-${op.id}`} className="transition-colors hover:bg-accent/40">
                    <CardHeader className="flex flex-row items-center justify-between gap-4">
                      <div className="min-w-0 space-y-1">
                        <CardTitle as="h2" className="text-base">
                          {op.legalName}
                        </CardTitle>
                        <p className="font-mono text-sm text-muted-foreground">{op.contactMasked}</p>
                      </div>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </CardHeader>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {nextCursor ? (
        <div className="flex justify-center">
          <Link
            href={operatorsHref(status, nextCursor)}
            className="min-h-9 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent/40"
            data-testid="operators-next-page"
          >
            Next page
          </Link>
        </div>
      ) : null}
    </div>
  );
}
