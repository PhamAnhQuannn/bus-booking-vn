/**
 * /admin/users/[kind]/[id] — admin User detail (Issue 066). React Server Component.
 *
 * Only the `customer` kind renders a detail here (profile + activity summary +
 * Suspend/Reinstate actions). The Users list links operator rows out to
 * /admin/operators/<id> (Issue 067), so an operator kind here redirects there — we
 * don't duplicate the operator detail.
 *
 * Data is read IN-PROCESS via getCustomerDetail() — NEVER self-fetched (002/003).
 * ROLE GATE: SUPER_ADMIN + SUPPORT (mirrors the list + the moderation routes).
 */

import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';

import { requireAdminPage } from '@/lib/auth';
import { getCustomerDetail } from '@/lib/admin/getUserDetail';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { UserActions } from './UserActions';

interface PageProps {
  params: Promise<{ kind: string; id: string }>;
}

function formatDate(d: Date | null): string {
  return d ? d.toISOString().slice(0, 16).replace('T', ' ') : '—';
}

export default async function AdminUserDetailPage({ params }: PageProps) {
  const ctx = await requireAdminPage();
  const canModerate = ctx.role === 'SUPER_ADMIN' || ctx.role === 'SUPPORT';

  const { kind, id } = await params;

  // Operators have their own detail (Issue 067) — link out, don't duplicate here.
  if (kind === 'operator') {
    redirect(`/admin/operators/${id}`);
  }
  if (kind !== 'customer') {
    notFound();
  }

  if (!canModerate) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Alert variant="warning">
          <AlertTitle>Insufficient role</AlertTitle>
          <AlertDescription>User detail is restricted to SUPER_ADMIN and SUPPORT.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const detail = await getCustomerDetail(id);
  if (!detail) {
    notFound();
  }

  const isSuspended = detail.status === 'suspended';
  const isDeleted = detail.status === 'deleted';

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/admin/users?kind=customer" className="text-sm text-muted-foreground hover:underline">
          ← Back to users
        </Link>
      </div>

      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{detail.name}</h1>
          <p className="text-sm text-muted-foreground">Customer</p>
        </div>
        <Badge variant={isSuspended ? 'danger' : isDeleted ? 'neutral' : 'success'}>
          {detail.status}
        </Badge>
      </header>

      <Card>
        <CardHeader>
          <CardTitle as="h2" className="text-lg">
            Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-medium text-muted-foreground">Phone</dt>
              <dd className="font-mono">{detail.phoneMasked ?? '—'}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Email</dt>
              <dd>{detail.email ?? '—'}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Joined</dt>
              <dd>{formatDate(detail.createdAt)}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Last login</dt>
              <dd>{formatDate(detail.lastLoginAt)}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Bookings</dt>
              <dd>{detail.bookingCount}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {isDeleted ? (
        <Alert variant="warning">
          <AlertTitle>Account deleted</AlertTitle>
          <AlertDescription>
            This account has been deleted/anonymized. Suspension actions are unavailable.
          </AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle as="h2" className="text-lg">
              Moderation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <UserActions customerId={detail.id} suspended={isSuspended} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
