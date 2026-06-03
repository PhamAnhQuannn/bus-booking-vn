/**
 * /op/status — operator application status page (Issue 079). Server component.
 *
 * Pending / under-review / rejected / suspended operators CAN log in and reach
 * the console, so this page lives inside the `(console)` group (auth + password
 * gate already applied by the layout). It reads the Operator row IN-PROCESS
 * (never self-fetch — AGENTS.md 002/003): status, rejectionReason, applicationRef,
 * legalName.
 *
 * Per OperatorStatus it renders a clear label, a next-steps copy block, and (for
 * REJECTED) the rejection reason + a Resubmit button (client island → POST
 * /api/op/resubmit → router.refresh()).
 *
 * Purity (AGENTS.md Issue 016): the render body is a pure function of the DB read
 * — no Date.now()/random in the component body.
 */

import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { OperatorStatus } from '@prisma/client';
import { getOperatorSession } from '@/lib/op/getOperatorSession';
import { prisma } from '@/lib/core/db/client';
import { PageHeader } from '@/components/op/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import ResubmitButton from './ResubmitButton';

type BadgeVariant = 'neutral' | 'success' | 'danger' | 'pending';

interface StatusMeta {
  label: string;
  badge: BadgeVariant;
  /** Next-steps copy lines for this state. */
  copy: string[];
  /** Optional in-console link rendered under the copy (label + href). */
  link?: { label: string; href: string };
}

/** Per-state presentation. Pure data — no runtime dependencies. */
const STATUS_META: Record<OperatorStatus, StatusMeta> = {
  PENDING_REVIEW: {
    label: 'Chờ nộp hồ sơ',
    badge: 'pending',
    copy: [
      'Đã nhận đăng ký của bạn.',
      'Tải lên giấy tờ KYB rồi gửi hồ sơ để được xét duyệt.',
    ],
    link: { label: 'Đến trang hồ sơ KYB', href: '/op/kyb' },
  },
  UNDER_REVIEW: {
    label: 'Đang xem xét',
    badge: 'pending',
    copy: [
      'Hồ sơ của bạn đang được xem xét.',
      'Chúng tôi sẽ gửi email cho bạn trong vòng 2 ngày làm việc.',
    ],
  },
  APPROVED: {
    label: 'Đã duyệt',
    badge: 'success',
    copy: [
      'Đã duyệt — tài khoản của bạn đã hoạt động.',
      'Thiết lập chuyến đi và bắt đầu bán vé.',
    ],
    link: { label: 'Tạo chuyến đi', href: '/op/trips' },
  },
  REJECTED: {
    label: 'Cần bổ sung',
    badge: 'danger',
    copy: [
      'Đơn đăng ký cần bổ sung trước khi được duyệt.',
      'Xem lý do bên dưới, cập nhật hồ sơ rồi gửi lại.',
    ],
  },
  SUSPENDED: {
    label: 'Tạm ngưng',
    badge: 'danger',
    copy: [
      'Tài khoản đã bị tạm ngưng — các chuyến đi của bạn đang bị ẩn.',
      'Vui lòng liên hệ bộ phận hỗ trợ để được khôi phục.',
    ],
  },
};

export default async function OpStatusPage() {
  const session = await getOperatorSession();
  if (!session) {
    redirect('/op/login');
  }

  const operator = await prisma.operator.findUnique({
    where: { id: session.operatorId },
    select: {
      status: true,
      rejectionReason: true,
      applicationRef: true,
      legalName: true,
    },
  });

  if (!operator) {
    redirect('/op/login');
  }

  const meta = STATUS_META[operator.status];

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 md:px-6">
      <PageHeader
        title="Trạng thái đăng ký"
        subtitle={operator.legalName}
        badge={<Badge variant={meta.badge}>{meta.label}</Badge>}
      />

      <Card>
        <CardHeader>
          <CardTitle as="h2" className="text-lg">
            Bước tiếp theo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5 text-sm text-foreground">
            {meta.copy.map((line, idx) => (
              <p key={idx}>{line}</p>
            ))}
          </div>

          {meta.link ? (
            <Link
              href={meta.link.href}
              className="inline-flex text-sm font-medium text-primary hover:underline"
              data-testid="status-next-link"
            >
              {meta.link.label}
            </Link>
          ) : null}

          {operator.status === 'REJECTED' ? (
            <div className="space-y-3" data-testid="status-rejected">
              <Alert variant="error">
                <AlertTitle>Lý do</AlertTitle>
                <AlertDescription data-testid="status-rejection-reason">
                  {operator.rejectionReason ?? 'Không có lý do cụ thể.'}
                </AlertDescription>
              </Alert>
              <ResubmitButton />
            </div>
          ) : null}

          {operator.status === 'SUSPENDED' && operator.rejectionReason ? (
            <Alert variant="error">
              <AlertTitle>Lý do</AlertTitle>
              <AlertDescription>{operator.rejectionReason}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      {operator.applicationRef ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Mã đơn đăng ký:{' '}
          <span className="font-mono" data-testid="status-application-ref">
            {operator.applicationRef}
          </span>
        </p>
      ) : null}
    </div>
  );
}
