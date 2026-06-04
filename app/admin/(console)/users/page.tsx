/**
 * /admin/users — admin Users tab (Issue 066). React Server Component.
 *
 * "Users" spans customers + operators. The tab is rendered as two per-kind lists
 * selected by `?kind=customer|operator` (the pagination choice in searchUsers — see
 * its header). Each list is cursor/seek-paginated via `?cursor=`; search via `?q=`.
 *
 * Data is read IN-PROCESS via searchUsers() — NEVER self-fetched (AGENTS.md 002/003).
 *
 * ROLE GATE: SUPER_ADMIN + SUPPORT may view + moderate users (the moderation routes
 * enforce the same role set). Other roles (e.g. FINANCE) get a read-only notice and
 * no user data — defense-in-depth + UX (we don't leak masked PII to non-moderators).
 *
 * RSC PURITY (Issue 016): no Date.now()/Math.random() in the render body.
 */

import Link from 'next/link';

import { requireAdminPage } from '@/lib/auth';
import { searchUsers, type UserKind, type UserStatus } from '@/lib/admin/searchUsers';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface PageProps {
  searchParams: Promise<{ q?: string; kind?: string; cursor?: string }>;
}

const STATUS_BADGE: Record<UserStatus, { variant: 'neutral' | 'pending' | 'success' | 'danger'; label: string }> = {
  active: { variant: 'success', label: 'Active' },
  suspended: { variant: 'danger', label: 'Suspended' },
  deleted: { variant: 'neutral', label: 'Deleted' },
  PENDING_REVIEW: { variant: 'pending', label: 'Pending review' },
  UNDER_REVIEW: { variant: 'pending', label: 'Under review' },
  APPROVED: { variant: 'success', label: 'Approved' },
  REJECTED: { variant: 'neutral', label: 'Rejected' },
  SUSPENDED: { variant: 'danger', label: 'Suspended' },
};

function normalizeKind(raw: string | undefined): UserKind {
  return raw === 'operator' ? 'operator' : 'customer';
}

/** Build a /admin/users URL preserving q + kind, swapping in the given params. */
function usersHref(q: string | undefined, kind: UserKind, cursor?: string): string {
  const sp = new URLSearchParams();
  if (q) sp.set('q', q);
  sp.set('kind', kind);
  if (cursor) sp.set('cursor', cursor);
  const qs = sp.toString();
  return qs ? `/admin/users?${qs}` : '/admin/users';
}

function detailHref(kind: UserKind, id: string): string {
  // Operators link out to the dedicated operator detail (Issue 067, not yet built).
  if (kind === 'operator') return `/admin/operators/${id}`;
  return `/admin/users/customer/${id}`;
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const ctx = await requireAdminPage();
  const canModerate = ctx.role === 'SUPER_ADMIN' || ctx.role === 'SUPPORT';

  if (!canModerate) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">Users</h1>
        </header>
        <Alert variant="warning">
          <AlertTitle>Insufficient role</AlertTitle>
          <AlertDescription>
            The Users tab is restricted to SUPER_ADMIN and SUPPORT roles.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const kind = normalizeKind(sp.kind);
  const { items, nextCursor } = await searchUsers({ q, kind, cursor: sp.cursor });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="text-sm text-muted-foreground">
          Search and moderate customers and operators.
        </p>
      </header>

      {/* Kind tabs */}
      <nav className="flex gap-2" aria-label="User kind">
        <Link
          href={usersHref(q, 'customer')}
          className={`rounded-md border px-3 py-1.5 text-sm font-medium ${kind === 'customer' ? 'border-foreground bg-accent/40' : 'border-border'}`}
          aria-current={kind === 'customer' ? 'page' : undefined}
        >
          Customers
        </Link>
        <Link
          href={usersHref(q, 'operator')}
          className={`rounded-md border px-3 py-1.5 text-sm font-medium ${kind === 'operator' ? 'border-foreground bg-accent/40' : 'border-border'}`}
          aria-current={kind === 'operator' ? 'page' : undefined}
        >
          Operators
        </Link>
      </nav>

      {/* Search box — GET form preserves kind, resets cursor. */}
      <form method="GET" action="/admin/users" className="flex gap-2">
        <input type="hidden" name="kind" value={kind} />
        <input
          type="search"
          name="q"
          defaultValue={q ?? ''}
          placeholder="Name, phone, or email"
          className="min-h-9 flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring"
          data-testid="users-search"
        />
        <button
          type="submit"
          className="min-h-9 rounded-md border border-border px-3 text-sm font-medium hover:bg-accent/40"
        >
          Search
        </button>
      </form>

      {items.length === 0 ? (
        <Alert>
          <AlertTitle>No matches</AlertTitle>
          <AlertDescription>No {kind}s match your search.</AlertDescription>
        </Alert>
      ) : (
        <ul className="space-y-3">
          {items.map((u) => {
            const badge = STATUS_BADGE[u.status];
            return (
              <li key={`${u.kind}-${u.id}`}>
                <Link href={detailHref(u.kind, u.id)} className="block outline-none focus-visible:ring-3 focus-visible:ring-ring rounded-xl">
                  <Card data-testid={`user-row-${u.id}`} className="transition-colors hover:bg-accent/40">
                    <CardHeader className="flex flex-row items-center justify-between gap-4">
                      <div className="min-w-0 space-y-1">
                        <CardTitle as="h2" className="text-base">
                          {u.name}
                        </CardTitle>
                        <p className="font-mono text-sm text-muted-foreground">{u.contactMasked}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant="neutral">{u.kind}</Badge>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </div>
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
            href={usersHref(q, kind, nextCursor)}
            className="min-h-9 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent/40"
            data-testid="users-next-page"
          >
            Next page
          </Link>
        </div>
      ) : null}
    </div>
  );
}
