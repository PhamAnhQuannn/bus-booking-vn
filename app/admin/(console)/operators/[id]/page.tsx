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
import { getOperatorDetail } from '@/lib/admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { OperatorActions } from './OperatorActions';
import { CreateAccountAction } from './CreateAccountAction';

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
  PENDING_REVIEW: { variant: 'pending', label: 'Chờ duyệt' },
  UNDER_REVIEW: { variant: 'pending', label: 'Đang xem xét' },
  APPROVED: { variant: 'success', label: 'Đã duyệt' },
  REJECTED: { variant: 'neutral', label: 'Từ chối' },
  SUSPENDED: { variant: 'danger', label: 'Tạm ngưng' },
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
          <AlertTitle>Không đủ quyền</AlertTitle>
          <AlertDescription>Chi tiết nhà xe chỉ dành cho vai trò SUPER_ADMIN và FINANCE.</AlertDescription>
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
          ← Quay lại nhà xe
        </Link>
      </div>

      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{detail.legalName}</h1>
          <p className="text-sm text-muted-foreground">Nhà xe</p>
        </div>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </header>

      {detail.rejectionReason ? (
        <Alert variant="warning">
          <AlertTitle>Lý do từ chối</AlertTitle>
          <AlertDescription>{detail.rejectionReason}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle as="h2" className="text-lg">
            Hồ sơ
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-medium text-muted-foreground">Tên thương hiệu</dt>
              <dd>{detail.brandName ?? '—'}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Người liên hệ</dt>
              <dd>{detail.contactName ?? '—'}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Email liên hệ</dt>
              <dd>{detail.contactEmail}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Điện thoại liên hệ</dt>
              <dd className="font-mono">{detail.contactPhone}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Địa chỉ</dt>
              <dd>{detail.address ?? '—'}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Tuyến</dt>
              <dd>{detail.routesSummary ?? '—'}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Ngày tham gia</dt>
              <dd>{formatDate(detail.createdAt)}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Phí nền tảng hiện tại</dt>
              <dd data-testid="current-fee">{formatPct(detail.currentFeePpm)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2" className="text-lg">
            Hoạt động
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-medium text-muted-foreground">Đội xe</dt>
              <dd>{detail.fleetCount}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Chuyến (tổng)</dt>
              <dd>{detail.tripCount}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Chuyến sắp tới</dt>
              <dd>{detail.upcomingTripCount}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">GMV (đã thanh toán)</dt>
              <dd data-testid="operator-gmv">{formatVnd(detail.gmvVnd)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2" className="text-lg">
            Số dư
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="font-medium text-muted-foreground">Chờ xử lý</dt>
              <dd data-testid="balance-pending">{formatVnd(detail.balance.pending)}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Khả dụng</dt>
              <dd data-testid="balance-available">{formatVnd(detail.balance.available)}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Đã chi trả</dt>
              <dd data-testid="balance-paidout">{formatVnd(detail.balance.paidOut)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2" className="text-lg">
            Tài khoản nhà xe
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CreateAccountAction operatorId={detail.id} hasLoginAccount={detail.hasLoginAccount} loginUsername={detail.loginUsername} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2" className="text-lg">
            Thao tác
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
            Lịch sử chi trả
          </CardTitle>
        </CardHeader>
        <CardContent>
          {detail.payoutHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có chi trả.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-1 font-medium">Số tiền</th>
                  <th className="py-1 font-medium">Trạng thái</th>
                  <th className="py-1 font-medium">Lên lịch</th>
                  <th className="py-1 font-medium">Đã thanh toán</th>
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
