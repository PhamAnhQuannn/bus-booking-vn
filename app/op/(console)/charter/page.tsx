/**
 * /op/charter — operator Charter tab (Issue 083). Server component.
 *
 * Shows directly-assigned charter leads + accepted contracts for the authenticated
 * operator. Charter is an APPROVED-only capability (Issue 046): a non-APPROVED
 * operator sees an "available after approval" notice instead of the lists.
 *
 * In-process reads only (AGENTS.md 002/003 — never self-fetch the API). Purity
 * (AGENTS.md Issue 016): the render body is a pure function of its DB reads — no
 * Date.now()/random in the component body. The acceptByAt deadline is rendered as
 * the stored timestamp (formatted), not compared against a render-time clock.
 *
 * Two sections:
 *   - "Yêu cầu được giao"  → getAssignedCharters: request summary, NO customer
 *     contact (reveal-on-accept), + Accept/Decline actions + acceptByAt deadline.
 *   - "Hợp đồng đã nhận"   → getAcceptedCharters: full details WITH customer
 *     contact (off-platform fulfillment).
 */

import { redirect } from 'next/navigation';

import { getOperatorSession } from '@/lib/op/getOperatorSession';
import { prisma } from '@/lib/db/client';
import { isOperatorApproved } from '@/lib/charter/assertOperatorApproved';
import {
  getAssignedCharters,
  getAcceptedCharters,
  type AssignedCharter,
  type AcceptedCharter,
} from '@/lib/charter/getOperatorCharters';
import { PageHeader } from '@/components/op/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CharterAssignmentActions } from './CharterAssignmentActions';

const DATE_FMT = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'Asia/Ho_Chi_Minh',
});

const DATETIME_FMT = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Ho_Chi_Minh',
});

function formatDate(d: Date | null): string {
  return d ? DATE_FMT.format(d) : '—';
}

function formatDateTime(d: Date | null): string {
  return d ? DATETIME_FMT.format(d) : '—';
}

function formatVnd(v: number | null): string {
  return v === null ? 'Thỏa thuận' : `${v.toLocaleString('vi-VN')}₫`;
}

/** Shared request-summary rows (route, dates, passengers, vehicle, budget, notes). */
function RequestSummary({ charter }: { charter: AssignedCharter }) {
  return (
    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
      <SummaryRow label="Điểm đi" value={charter.originName ?? '—'} />
      <SummaryRow
        label="Điểm đến"
        value={charter.destinations.length ? charter.destinations.join(', ') : '—'}
      />
      <SummaryRow label="Ngày đi" value={formatDate(charter.startDate)} />
      <SummaryRow label="Ngày về" value={formatDate(charter.endDate)} />
      <SummaryRow label="Số khách" value={String(charter.passengers)} />
      <SummaryRow label="Loại xe" value={charter.vehicleType} />
      <SummaryRow label="Ngân sách" value={formatVnd(charter.budgetVnd)} />
      {charter.durationDays !== null ? (
        <SummaryRow label="Số ngày" value={String(charter.durationDays)} />
      ) : null}
      {charter.notes ? <SummaryRow label="Ghi chú" value={charter.notes} wide /> : null}
    </dl>
  );
}

function SummaryRow({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}

export default async function OpCharterPage() {
  const session = await getOperatorSession();
  if (!session) {
    redirect('/op/login');
  }
  if (session.requiresPasswordChange) {
    redirect('/op/first-login');
  }

  const approved = await isOperatorApproved(prisma, session.operatorId);

  if (!approved) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-8 md:px-6">
        <PageHeader
          title="Thuê xe"
          subtitle="Yêu cầu thuê xe được giao cho nhà xe của bạn."
        />
        <Alert variant="info" data-testid="charter-not-approved">
          <AlertTitle>Chưa khả dụng</AlertTitle>
          <AlertDescription>
            Tính năng thuê xe khả dụng sau khi được duyệt.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const [assigned, accepted] = await Promise.all([
    getAssignedCharters(prisma, session.operatorId),
    getAcceptedCharters(prisma, session.operatorId),
  ]);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 md:px-6">
      <PageHeader
        title="Thuê xe"
        subtitle="Yêu cầu thuê xe được giao cho nhà xe của bạn. Nhận để xem thông tin liên hệ khách hàng."
      />

      {/* ── Section 1: directly-assigned, not-yet-actioned (NO customer contact) ── */}
      <section className="mb-10" aria-labelledby="charter-assigned-heading">
        <div className="mb-4 flex items-center gap-2">
          <h2 id="charter-assigned-heading" className="text-lg font-semibold">
            Yêu cầu được giao
          </h2>
          <Badge variant="pending">{assigned.length}</Badge>
        </div>

        {assigned.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="charter-assigned-empty">
            Hiện chưa có yêu cầu nào được giao.
          </p>
        ) : (
          <div className="space-y-4">
            {assigned.map((charter) => (
              <Card key={charter.id} data-testid={`charter-assigned-${charter.id}`}>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle as="h3" className="font-mono text-base">
                      {charter.ref}
                    </CardTitle>
                    <span className="text-xs text-muted-foreground">
                      Hạn nhận: {formatDateTime(charter.acceptByAt)}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <RequestSummary charter={charter} />
                  <CharterAssignmentActions charterId={charter.id} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ── Section 2: accepted contracts (WITH customer contact) ── */}
      <section aria-labelledby="charter-accepted-heading">
        <div className="mb-4 flex items-center gap-2">
          <h2 id="charter-accepted-heading" className="text-lg font-semibold">
            Hợp đồng đã nhận
          </h2>
          <Badge variant="success">{accepted.length}</Badge>
        </div>

        {accepted.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="charter-accepted-empty">
            Chưa có hợp đồng nào được nhận.
          </p>
        ) : (
          <div className="space-y-4">
            {accepted.map((charter: AcceptedCharter) => (
              <Card key={charter.id} data-testid={`charter-accepted-${charter.id}`}>
                <CardHeader>
                  <CardTitle as="h3" className="font-mono text-base">
                    {charter.ref}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <RequestSummary charter={charter} />
                  <div
                    className="rounded-lg border border-border bg-muted/30 p-3"
                    data-testid={`charter-contact-${charter.id}`}
                  >
                    <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                      Thông tin liên hệ khách hàng
                    </p>
                    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                      <SummaryRow label="Tên" value={charter.contactName} />
                      <SummaryRow label="Điện thoại" value={charter.contactPhone} />
                      <SummaryRow label="Email" value={charter.contactEmail} wide />
                    </dl>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
