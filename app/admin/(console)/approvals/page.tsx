/**
 * /admin/approvals — operator Approvals queue (Issue 065). React Server Component.
 *
 * Data is fetched IN-PROCESS via getApprovalQueue() — NEVER self-fetched
 * (AGENTS.md Issue 002/003).
 *
 * ROLE GATE: approvals are a SUPER_ADMIN action in this slice. SUPER_ADMIN sees the
 * queue WITH the action controls; any other role sees a read-only notice instead of
 * the queue (the action routes themselves enforce SUPER_ADMIN with 403, so this is
 * defense-in-depth + UX — we don't leak applicant PII to non-approver roles). If a
 * dedicated approver role is introduced later, widen the check here and on the routes.
 *
 * KYB docs (Issue 077): getApprovalQueue populates each row's `docs` from the
 * operator's KybDocument rows (no signed URLs). The KybDocLinks island renders a
 * "View" affordance per doc that mints a fresh signed GET URL on demand (audited).
 */

import { requireAdminPage } from '@/lib/auth/requireAdminPage';
import { getApprovalQueue, type ApprovalQueueOperator } from '@/lib/admin/getApprovalQueue';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ApprovalActions } from './ApprovalActions';
import { KybDocLinks } from './KybDocLinks';

const STATUS_BADGE: Record<ApprovalQueueOperator['status'], { variant: 'pending' | 'neutral'; label: string }> = {
  PENDING_REVIEW: { variant: 'neutral', label: 'Pending review' },
  UNDER_REVIEW: { variant: 'pending', label: 'Under review' },
  // Approved/Rejected/Suspended never appear in the queue, but the map stays total.
  APPROVED: { variant: 'neutral', label: 'Approved' },
  REJECTED: { variant: 'neutral', label: 'Rejected' },
  SUSPENDED: { variant: 'neutral', label: 'Suspended' },
};

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function AdminApprovalsPage() {
  const ctx = await requireAdminPage();
  const isApprover = ctx.role === 'SUPER_ADMIN';

  // Non-approver roles get a read-only notice and NO applicant data.
  if (!isApprover) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">Approvals</h1>
        </header>
        <Alert variant="warning">
          <AlertTitle>Insufficient role</AlertTitle>
          <AlertDescription>
            Operator approvals are restricted to SUPER_ADMIN. Your role has read-only
            access elsewhere; the approval queue is not available to you.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const queue = await getApprovalQueue();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Approvals</h1>
        <p className="text-sm text-muted-foreground">
          Operators awaiting review ({queue.length}). Oldest applications first.
        </p>
      </header>

      {queue.length === 0 ? (
        <Alert variant="success">
          <AlertTitle>Queue clear</AlertTitle>
          <AlertDescription>No operators are awaiting review.</AlertDescription>
        </Alert>
      ) : (
        <ul className="space-y-4">
          {queue.map((op) => {
            const badge = STATUS_BADGE[op.status];
            return (
              <li key={op.id}>
                <Card data-testid={`approval-row-${op.id}`}>
                  <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div className="min-w-0 space-y-1">
                      <CardTitle as="h2" className="text-lg">
                        {op.legalName}
                      </CardTitle>
                      <dl className="grid gap-0.5 text-sm text-muted-foreground">
                        <div className="flex gap-2">
                          <dt className="font-medium">Email:</dt>
                          <dd className="truncate">{op.contactEmail}</dd>
                        </div>
                        <div className="flex gap-2">
                          <dt className="font-medium">Phone:</dt>
                          <dd className="font-mono">{op.contactPhone}</dd>
                        </div>
                        <div className="flex gap-2">
                          <dt className="font-medium">Applied:</dt>
                          <dd>{formatDate(op.createdAt)}</dd>
                        </div>
                        {op.rejectionReason ? (
                          <div className="flex gap-2">
                            <dt className="font-medium">Prior rejection:</dt>
                            <dd>{op.rejectionReason}</dd>
                          </div>
                        ) : null}
                      </dl>
                    </div>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* KYB docs (077): View link mints a fresh signed GET on demand. */}
                    <KybDocLinks
                      operatorId={op.id}
                      docs={op.docs.map((doc) => ({
                        id: doc.id,
                        type: doc.type,
                        status: doc.status,
                        uploadedAt: doc.uploadedAt.toISOString(),
                      }))}
                    />

                    {/* Payout account (078): masked number + name-match signal vs legalName. */}
                    <div data-testid={`payout-account-${op.id}`} className="rounded-md border p-3 text-sm">
                      <p className="mb-1 font-medium">Payout account</p>
                      {op.payoutAccount ? (
                        <dl className="grid gap-0.5 text-muted-foreground">
                          <div className="flex gap-2">
                            <dt className="font-medium">Bank:</dt>
                            <dd>{op.payoutAccount.bankName}</dd>
                          </div>
                          <div className="flex gap-2">
                            <dt className="font-medium">Number:</dt>
                            <dd className="font-mono">{op.payoutAccount.accountNumberMasked}</dd>
                          </div>
                          <div className="flex gap-2">
                            <dt className="font-medium">Holder:</dt>
                            <dd>{op.payoutAccount.accountHolderName}</dd>
                          </div>
                          <div className="flex items-center gap-2">
                            <dt className="font-medium">Name match:</dt>
                            <dd>
                              {Math.round(op.payoutAccount.nameMatchScore * 100)}%
                              {op.payoutAccount.suggestVerified ? (
                                <Badge variant="success" className="ml-2">
                                  Match — suggest verify
                                </Badge>
                              ) : (
                                <Badge variant="neutral" className="ml-2">
                                  Low match — review
                                </Badge>
                              )}
                            </dd>
                          </div>
                          <div className="flex items-center gap-2">
                            <dt className="font-medium">Verified:</dt>
                            <dd>
                              {op.payoutAccount.verifiedAt ? (
                                <Badge variant="success">
                                  {formatDate(op.payoutAccount.verifiedAt)}
                                  {op.payoutAccount.verifyMethod
                                    ? ` (${op.payoutAccount.verifyMethod})`
                                    : ''}
                                </Badge>
                              ) : (
                                <Badge variant="pending">Not verified</Badge>
                              )}
                            </dd>
                          </div>
                        </dl>
                      ) : (
                        <p className="text-muted-foreground">No payout account registered.</p>
                      )}
                    </div>

                    <ApprovalActions operatorId={op.id} status={op.status} />
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
