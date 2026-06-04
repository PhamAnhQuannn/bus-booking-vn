/**
 * /admin/operators/[id] — admin Operator detail (Issue 067). React Server Component.
 *
 * Renders the operator profile + fleet/trips/volume + derived balance
 * (pending/available/paidOut) + current platform-fee % + payout history, and mounts
 * the <OperatorActions> client island (Suspend/Reinstate + Fee-override, step-up).
 *
 * Data is read IN-PROCESS via getOperatorDetail() — NEVER self-fetched (002/003).
 * ROLE GATE: SUPER_ADMIN + FINANCE (mirrors the list + the action routes).
 * RSC PURITY (Issue 016): no Date.now() in the render body — all time-derived state
 * comes from getOperatorDetail() (which owns the `now` boundary).
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { PayoutStatus } from '@prisma/client';

import { requireAdminPage } from '@/lib/auth';
import { getOperatorDetail } from '@/lib/admin/getOperatorDetail';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { OperatorActions } from './OperatorActions';

interface PageProps {
  params: Promise<{ id: string }>;
}

const vnd = new Intl.NumberFormat('vi-VN');
function formatVnd(amount: bigint | number): string {
  return `${vnd.format(amount)} ₫`;
}

function formatDate(d: Date | null): string {
  return d ? d.toISOString().slice(0, 16).replace('T', ' ') : '—';
}

function formatPct(ppm: number): string {
  // ppm/10000 = % (60000 ppm → 6%).
  return `${ppm / 10000}%`;
}

const STATUS_BADGE: Record<string, { variant: 'neutral' | 'pending' | 'success' | 'danger'; label: string }> = {
  PENDING_REVIEW: { variant: 'pending', label: 'Pending review' },
  UNDER_REVIEW: { variant: 'pending', label: 'Under review' },
  APPROVED: { variant: 'success', label: 'Approved' },
  REJECTED: { variant: 'neutral', label: 'Rejected' },
  SUSPENDED: { variant: 'danger', label: 'Suspended' },
};

const PAYOUT_STATUS_VARIANT: Record<PayoutStatus, 'neutral' | 'pending' | 'success' | 'danger'> = {
  requested: 'pending',
  processing: 'pending',
  paid: 'success',
  failed: 'danger',
};

export default async function AdminOperatorDetailPage({ params }: PageProps) {
  const ctx = await requireAdminPage();
  const canView = ctx.role === 'SUPER_ADMIN' || ctx.role === 'FINANCE';

  if (!canView) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Alert variant="warning">
          <AlertTitle>Insufficient role</AlertTitle>
          <AlertDescription>Operator detail is restricted to SUPER_ADMIN and FINANCE.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const { id } = await params;
  const detail = await getOperatorDetail(id);
  if (!detail) {
    notFound();
  }

  const badge = STATUS_BADGE[detail.status] ?? { variant: 'neutral' as const, label: detail.status };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/admin/operators" className="text-sm text-muted-foreground hover:underline">
          ← Back to operators
        </Link>
      </div>

      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{detail.legalName}</h1>
          <p className="text-sm text-muted-foreground">Operator</p>
        </div>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </header>

      {detail.rejectionReason ? (
        <Alert variant="warning">
          <AlertTitle>Rejection reason</AlertTitle>
          <AlertDescription>{detail.rejectionReason}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle as="h2" className="text-lg">
            Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-medium text-muted-foreground">Contact email</dt>
              <dd>{detail.contactEmail}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Contact phone</dt>
              <dd className="font-mono">{detail.contactPhoneMasked}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Joined</dt>
              <dd>{formatDate(detail.createdAt)}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Current platform fee</dt>
              <dd data-testid="current-fee">{formatPct(detail.currentFeePpm)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2" className="text-lg">
            Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-medium text-muted-foreground">Fleet (buses)</dt>
              <dd>{detail.fleetCount}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Trips (total)</dt>
              <dd>{detail.tripCount}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Upcoming trips</dt>
              <dd>{detail.upcomingTripCount}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">GMV (paid)</dt>
              <dd data-testid="operator-gmv">{formatVnd(detail.gmvVnd)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2" className="text-lg">
            Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="font-medium text-muted-foreground">Pending</dt>
              <dd data-testid="balance-pending">{formatVnd(detail.balance.pending)}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Available</dt>
              <dd data-testid="balance-available">{formatVnd(detail.balance.available)}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Paid out</dt>
              <dd data-testid="balance-paidout">{formatVnd(detail.balance.paidOut)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2" className="text-lg">
            Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <OperatorActions
            operatorId={detail.id}
            status={detail.status}
            currentFeePpm={detail.currentFeePpm}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2" className="text-lg">
            Payout history
          </CardTitle>
        </CardHeader>
        <CardContent>
          {detail.payoutHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payouts yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-1 font-medium">Net</th>
                  <th className="py-1 font-medium">Status</th>
                  <th className="py-1 font-medium">Scheduled</th>
                  <th className="py-1 font-medium">Settled</th>
                </tr>
              </thead>
              <tbody>
                {detail.payoutHistory.map((p) => (
                  <tr key={p.id} className="border-b border-border/50" data-testid={`payout-row-${p.id}`}>
                    <td className="py-1">{formatVnd(p.net)}</td>
                    <td className="py-1">
                      <Badge variant={PAYOUT_STATUS_VARIANT[p.status]}>{p.status}</Badge>
                    </td>
                    <td className="py-1">{formatDate(p.scheduledAt)}</td>
                    <td className="py-1">{formatDate(p.settledAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
