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

import Link from 'next/link';
import { requireAdminPage } from '@/lib/auth';
import { getApprovalQueue, type ApprovalQueueOperator } from '@/lib/admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ApprovalActions } from './ApprovalActions';
import { KybDocLinks } from './KybDocLinks';

const STATUS_BADGE: Record<ApprovalQueueOperator['status'], { variant: 'pending' | 'neutral'; label: string }> = {
  PENDING_REVIEW: { variant: 'neutral', label: 'Chờ duyệt' },
  UNDER_REVIEW: { variant: 'pending', label: 'Đang xem xét' },
  // Approved/Rejected/Suspended never appear in the queue, but the map stays total.
  APPROVED: { variant: 'neutral', label: 'Đã duyệt' },
  REJECTED: { variant: 'neutral', label: 'Từ chối' },
  SUSPENDED: { variant: 'neutral', label: 'Tạm ngưng' },
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
          <h1 className="text-2xl font-semibold">Phê duyệt</h1>
        </header>
        <Alert variant="warning">
          <AlertTitle>Không đủ quyền</AlertTitle>
          <AlertDescription>
            Phê duyệt nhà xe chỉ dành cho SUPER_ADMIN. Vai trò của bạn chỉ có quyền
            xem ở các mục khác; hàng đợi phê duyệt không khả dụng.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const queue = await getApprovalQueue();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Phê duyệt</h1>
        <p className="text-sm text-muted-foreground">
          Nhà xe chờ xem xét ({queue.length}). Đơn cũ nhất trước.
        </p>
      </header>

      {queue.length === 0 ? (
        <Alert variant="success">
          <AlertTitle>Hàng đợi trống</AlertTitle>
          <AlertDescription>Không có nhà xe nào chờ xem xét.</AlertDescription>
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
                        <Link href={`/admin/operators/${op.id}`} className="hover:underline">
                          {op.legalName}
                        </Link>
                      </CardTitle>
                      <dl className="grid gap-0.5 text-sm text-muted-foreground">
                        <div className="flex gap-2">
                          <dt className="font-medium">Email:</dt>
                          <dd className="truncate">{op.contactEmail}</dd>
                        </div>
                        <div className="flex gap-2">
                          <dt className="font-medium">Điện thoại:</dt>
                          <dd className="font-mono">{op.contactPhone}</dd>
                        </div>
                        <div className="flex gap-2">
                          <dt className="font-medium">Ngày nộp:</dt>
                          <dd>{formatDate(op.createdAt)}</dd>
                        </div>
                        {op.rejectionReason ? (
                          <div className="flex gap-2">
                            <dt className="font-medium">Lý do từ chối trước:</dt>
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
                      <p className="mb-1 font-medium">Tài khoản thanh toán</p>
                      {op.payoutAccount ? (
                        <dl className="grid gap-0.5 text-muted-foreground">
                          <div className="flex gap-2">
                            <dt className="font-medium">Ngân hàng:</dt>
                            <dd>{op.payoutAccount.bankName}</dd>
                          </div>
                          <div className="flex gap-2">
                            <dt className="font-medium">Số TK:</dt>
                            <dd className="font-mono">{op.payoutAccount.accountNumberMasked}</dd>
                          </div>
                          <div className="flex gap-2">
                            <dt className="font-medium">Chủ TK:</dt>
                            <dd>{op.payoutAccount.accountHolderName}</dd>
                          </div>
                          <div className="flex items-center gap-2">
                            <dt className="font-medium">Khớp tên:</dt>
                            <dd>
                              {Math.round(op.payoutAccount.nameMatchScore * 100)}%
                              {op.payoutAccount.suggestVerified ? (
                                <Badge variant="success" className="ml-2">
                                  Khớp — đề xuất xác minh
                                </Badge>
                              ) : (
                                <Badge variant="neutral" className="ml-2">
                                  Khớp thấp — cần xem xét
                                </Badge>
                              )}
                            </dd>
                          </div>
                          <div className="flex items-center gap-2">
                            <dt className="font-medium">Đã xác minh:</dt>
                            <dd>
                              {op.payoutAccount.verifiedAt ? (
                                <Badge variant="success">
                                  {formatDate(op.payoutAccount.verifiedAt)}
                                  {op.payoutAccount.verifyMethod
                                    ? ` (${op.payoutAccount.verifyMethod})`
                                    : ''}
                                </Badge>
                              ) : (
                                <Badge variant="pending">Chưa xác minh</Badge>
                              )}
                            </dd>
                          </div>
                        </dl>
                      ) : (
                        <p className="text-muted-foreground">Chưa đăng ký tài khoản thanh toán.</p>
                      )}
                    </div>

                    <ApprovalActions operatorId={op.id} status={op.status} hasPayout={!!op.payoutAccount} />
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
