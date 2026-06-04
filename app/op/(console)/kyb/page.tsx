/**
 * /op/kyb — operator KYB document submission (Issue 077). Server component.
 *
 * Lists the 3 required doc types, the operator's already-submitted docs, and a
 * "Submit for review" affordance. Data is read IN-PROCESS (never self-fetch —
 * AGENTS.md 002/003): operatorId + status from the session/Operator row, the
 * doc list via listOperatorKybDocs.
 *
 * The `(console)` layout already gates auth + password-change; this page reads the
 * session only to scope the doc list to the operator and to surface their current
 * approval status (which gates whether "Submit for review" is meaningful).
 */

import { redirect } from 'next/navigation';
import { getOperatorSession } from '@/lib/op/getOperatorSession';
import { listOperatorKybDocs } from '@/lib/onboarding';
import { prisma } from '@/lib/core/db/client';
import { PageHeader } from '@/components/op/PageHeader';
import KybUpload from './KybUpload';

export default async function OpKybPage() {
  const session = await getOperatorSession();
  if (!session) {
    redirect('/op/login');
  }

  const [operator, docs] = await Promise.all([
    prisma.operator.findUnique({
      where: { id: session.operatorId },
      select: { status: true },
    }),
    listOperatorKybDocs(prisma, session.operatorId),
  ]);

  // PENDING_REVIEW is the only state from which "Submit for review" is legal.
  const canSubmit = operator?.status === 'PENDING_REVIEW';

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 md:px-6">
      <PageHeader
        title="Hồ sơ doanh nghiệp (KYB)"
        subtitle="Tải lên giấy tờ pháp lý rồi gửi hồ sơ để quản trị viên xét duyệt."
      />
      <KybUpload
        initialDocs={docs.map((d) => ({
          id: d.id,
          type: d.type,
          status: d.status,
          uploadedAt: d.uploadedAt.toISOString(),
        }))}
        status={operator?.status ?? 'PENDING_REVIEW'}
        canSubmit={canSubmit}
      />
    </div>
  );
}
