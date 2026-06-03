/**
 * /admin/charter — charter dispatch queue (Issue 085). React Server Component.
 *
 * Data is fetched IN-PROCESS via getCharterDispatchQueue + getApprovedOperatorsForAssign
 * — NEVER self-fetched (AGENTS.md Issue 002/003). No Date.now() in the render body
 * (AGENTS.md Issue 016) — dates are pre-stored, formatting is pure.
 *
 * ROLE GATE: charter dispatch is an ops action restricted to SUPER_ADMIN + SUPPORT
 * (the dispatch routes enforce the same role set with 403). FINANCE and any other
 * role get a read-only notice instead of the queue — defense-in-depth + UX (the
 * routes are authoritative). Charter dispatch is role-gated only; NO step-up (it is
 * not a money movement).
 *
 * REASSIGN (Issue 086): a request the sweeper routes back here from DECLINED/EXPIRED
 * re-enters this same ADMIN_REVIEW queue and is re-dispatched with the same
 * Assign/Publish/Reject actions — there is no separate reassign route. When a row
 * still carries a prior assignee we surface it as reassign context.
 *
 * NEW-REQUEST SURFACE (AC4): the count of ADMIN_REVIEW requests also appears on the
 * Overview action queue (getActionQueue.pendingCharters) — that count IS the admin
 * "new charter request" notification (there is no admin push-recipient to email).
 */

import { requireAdminPage } from '@/lib/auth/requireAdminPage';
import { prisma } from '@/lib/core/db/client';
import {
  getCharterDispatchQueue,
  getApprovedOperatorsForAssign,
  type CharterDispatchItem,
} from '@/lib/admin/getCharterDispatchQueue';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CharterDispatchActions } from './CharterDispatchActions';

const vnd = new Intl.NumberFormat('vi-VN');

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Read the `name` field out of each `{ placeId?, name }` destination descriptor. */
function destinationNames(destinations: CharterDispatchItem['destinations']): string[] {
  if (!Array.isArray(destinations)) return [];
  return destinations
    .map((d) =>
      d && typeof d === 'object' && 'name' in d && typeof (d as { name: unknown }).name === 'string'
        ? ((d as { name: string }).name)
        : null
    )
    .filter((n): n is string => n !== null);
}

export default async function AdminCharterPage() {
  const ctx = await requireAdminPage();
  const canDispatch = ctx.role === 'SUPER_ADMIN' || ctx.role === 'SUPPORT';

  // Non-dispatch roles get a read-only notice and NO lead data.
  if (!canDispatch) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">Charter dispatch</h1>
        </header>
        <Alert variant="warning">
          <AlertTitle>Insufficient role</AlertTitle>
          <AlertDescription>
            Charter dispatch is restricted to SUPER_ADMIN and SUPPORT. Your role does
            not have access to the dispatch queue.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // In-process fetches (no self-fetch). Run concurrently.
  const [queue, operators] = await Promise.all([
    getCharterDispatchQueue(prisma, { limit: 20 }),
    getApprovedOperatorsForAssign(prisma),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Charter dispatch</h1>
        <p className="text-sm text-muted-foreground">
          Charter requests awaiting dispatch ({queue.items.length}). Oldest first
          (FIFO).
        </p>
      </header>

      {queue.items.length === 0 ? (
        <Alert variant="success">
          <AlertTitle>Queue clear</AlertTitle>
          <AlertDescription>No charter requests are awaiting dispatch.</AlertDescription>
        </Alert>
      ) : (
        <ul className="space-y-4">
          {queue.items.map((c) => {
            const dests = destinationNames(c.destinations);
            return (
              <li key={c.id}>
                <Card data-testid={`charter-row-${c.id}`}>
                  <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div className="min-w-0 space-y-1">
                      <CardTitle as="h2" className="text-lg font-mono">
                        {c.ref}
                      </CardTitle>
                      <dl className="grid gap-0.5 text-sm text-muted-foreground">
                        <div className="flex gap-2">
                          <dt className="font-medium">Contact:</dt>
                          <dd className="truncate">
                            {c.contactName} · <span className="font-mono">{c.contactPhone}</span> ·{' '}
                            {c.contactEmail}
                          </dd>
                        </div>
                        <div className="flex gap-2">
                          <dt className="font-medium">Route:</dt>
                          <dd className="truncate">
                            {c.originName ?? '—'}
                            {dests.length > 0 ? ` → ${dests.join(' → ')}` : ''}
                          </dd>
                        </div>
                        <div className="flex gap-2">
                          <dt className="font-medium">Dates:</dt>
                          <dd>
                            {formatDate(c.startDate)}
                            {c.endDate ? ` → ${formatDate(c.endDate)}` : ''}
                            {c.durationDays ? ` (${c.durationDays}d)` : ''}
                          </dd>
                        </div>
                        <div className="flex gap-2">
                          <dt className="font-medium">Pax / vehicle:</dt>
                          <dd>
                            {c.passengers} · {c.vehicleType}
                          </dd>
                        </div>
                        {c.budgetVnd != null ? (
                          <div className="flex gap-2">
                            <dt className="font-medium">Budget:</dt>
                            <dd>{vnd.format(c.budgetVnd)} ₫</dd>
                          </div>
                        ) : null}
                        {c.notes ? (
                          <div className="flex gap-2">
                            <dt className="font-medium">Notes:</dt>
                            <dd className="truncate">{c.notes}</dd>
                          </div>
                        ) : null}
                        <div className="flex gap-2">
                          <dt className="font-medium">Submitted:</dt>
                          <dd>{formatDate(c.createdAt)}</dd>
                        </div>
                        {c.priorAssigneeName ? (
                          <div className="flex gap-2">
                            <dt className="font-medium">Prior assignee:</dt>
                            <dd>{c.priorAssigneeName} (reassign)</dd>
                          </div>
                        ) : null}
                      </dl>
                    </div>
                    <Badge variant="pending">Awaiting dispatch</Badge>
                  </CardHeader>
                  <CardContent>
                    <CharterDispatchActions charterId={c.id} operators={operators} />
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
