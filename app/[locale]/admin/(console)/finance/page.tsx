/**
 * /admin/finance — admin Finance tab (Issue 068). React Server Component.
 *
 * The most sensitive console tab: SUPER_ADMIN + FINANCE only (others get a notice).
 * Every mutating action is step-up gated + audited via the /api/admin/finance/*
 * routes; this page only READS (in-process, NEVER self-fetch — Issue 002/003) and
 * mounts the <FinanceActions> client island that drives the step-up POSTs.
 *
 * Sections:
 *   - Payout queue       (getPayoutQueue, default status=requested|failed via two
 *                          reads; each row → Retry/Approve buttons)
 *   - Ledger view        (operator picker via ?operatorId= → getLedgerView table +
 *                          balance summary + manual-adjustment form)
 *   - Refund-out form    (bookingId + amount + reason)
 *   - Chargeback form    (bookingId + amount)
 *   - FeeConfig editor   (current global rate via getEffectiveFeeRate(null, now) +
 *                          a global-rate form; per-operator override → Operators tab)
 *
 * RSC PURITY (Issue 016): no Date.now() in the render body — `now` comes from a
 * module-scope helper invoked at the request boundary.
 */

import Link from 'next/link';
import type { PayoutStatus } from '@prisma/client';

import { requireAdminPage } from '@/lib/auth';
import { getPayoutQueue, type PayoutQueueRow } from '@/lib/admin';
import { getLedgerView } from '@/lib/admin';
import { getEffectiveFeeRate } from '@/lib/ledger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FinanceActions } from './FinanceActions';

interface PageProps {
  searchParams: Promise<{ operatorId?: string }>;
}

/** Request-boundary `now` — module scope so the render body stays pure (Issue 016). */
function requestNow(): Date {
  return new Date();
}

const vnd = new Intl.NumberFormat('vi-VN');
function formatVnd(amount: bigint | number | string): string {
  const n = typeof amount === 'string' ? BigInt(amount) : amount;
  return `${vnd.format(n)} ₫`;
}

function formatDate(d: Date | null): string {
  return d ? d.toISOString().slice(0, 16).replace('T', ' ') : '—';
}

function formatPct(ppm: number): string {
  return `${ppm / 10000}%`;
}

const PAYOUT_STATUS_VARIANT: Record<PayoutStatus, 'neutral' | 'pending' | 'success' | 'danger'> = {
  requested: 'pending',
  processing: 'pending',
  paid: 'success',
  failed: 'danger',
};

export default async function AdminFinancePage({ searchParams }: PageProps) {
  const ctx = await requireAdminPage();
  const canView = ctx.role === 'SUPER_ADMIN' || ctx.role === 'FINANCE';

  if (!canView) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">Tài chính</h1>
        </header>
        <Alert variant="warning">
          <AlertTitle>Không đủ quyền</AlertTitle>
          <AlertDescription>
            Tab Tài chính chỉ dành cho vai trò SUPER_ADMIN và FINANCE.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const now = requestNow();
  const sp = await searchParams;
  const operatorId = sp.operatorId?.trim() || undefined;

  // Payout queue: the two actionable statuses (requested + failed).
  const [requestedQueue, failedQueue, globalFeePpm, ledger] = await Promise.all([
    getPayoutQueue({ status: 'requested' }),
    getPayoutQueue({ status: 'failed' }),
    getEffectiveFeeRate(null, now),
    operatorId ? getLedgerView({ operatorId }) : Promise.resolve(null),
  ]);

  const queueRows: PayoutQueueRow[] = [...requestedQueue.items, ...failedQueue.items];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Tài chính</h1>
        <p className="text-sm text-muted-foreground">
          Hàng đợi chi trả, sổ cái nhà xe, hoàn tiền, chargeback, và phí nền tảng. Mọi
          thao tác đều cần xác thực lại (step-up).
        </p>
      </header>

      {/* ── Payout queue ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle as="h2" className="text-lg">
            Hàng đợi chi trả
          </CardTitle>
        </CardHeader>
        <CardContent>
          {queueRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Không có chi trả yêu cầu hoặc thất bại.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-1 font-medium">Nhà xe</th>
                  <th className="py-1 font-medium">Số tiền</th>
                  <th className="py-1 font-medium">Trạng thái</th>
                  <th className="py-1 font-medium">Lên lịch</th>
                  <th className="py-1 font-medium">Lỗi</th>
                  <th className="py-1 font-medium">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {queueRows.map((p) => (
                  <tr key={p.id} className="border-b border-border/50" data-testid={`payout-queue-row-${p.id}`}>
                    <td className="py-1 font-mono text-xs">{p.operatorId}</td>
                    <td className="py-1">{formatVnd(p.net)}</td>
                    <td className="py-1">
                      <Badge variant={PAYOUT_STATUS_VARIANT[p.status]}>{p.status}</Badge>
                    </td>
                    <td className="py-1">{formatDate(p.scheduledAt)}</td>
                    <td className="py-1 text-muted-foreground">{p.failureReason ?? '—'}</td>
                    <td className="py-1">
                      <FinanceActions
                        kind="payout-row"
                        payoutId={p.id}
                        payoutStatus={p.status}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* ── Ledger view (operator picker) ─────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle as="h2" className="text-lg">
            Sổ cái nhà xe
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form method="get" className="flex items-end gap-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="operatorId" className="text-sm font-medium text-muted-foreground">
                Mã nhà xe
              </label>
              <input
                id="operatorId"
                name="operatorId"
                defaultValue={operatorId ?? ''}
                placeholder="op_…"
                className="min-h-9 rounded-md border border-border px-3 py-1.5 text-sm"
                data-testid="ledger-operator-picker"
              />
            </div>
            <button
              type="submit"
              className="min-h-9 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent/40"
            >
              Xem sổ cái
            </button>
          </form>

          {ledger ? (
            <>
              <dl className="grid gap-2 text-sm sm:grid-cols-3">
                <div>
                  <dt className="font-medium text-muted-foreground">Chờ xử lý</dt>
                  <dd data-testid="ledger-balance-pending">{formatVnd(ledger.balance.pending)}</dd>
                </div>
                <div>
                  <dt className="font-medium text-muted-foreground">Khả dụng</dt>
                  <dd data-testid="ledger-balance-available">{formatVnd(ledger.balance.available)}</dd>
                </div>
                <div>
                  <dt className="font-medium text-muted-foreground">Đã chi trả</dt>
                  <dd data-testid="ledger-balance-paidout">{formatVnd(ledger.balance.paidOut)}</dd>
                </div>
              </dl>

              {ledger.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Không có bút toán nào cho nhà xe này.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="py-1 font-medium">Loại</th>
                      <th className="py-1 font-medium">Số tiền</th>
                      <th className="py-1 font-medium">Nguồn</th>
                      <th className="py-1 font-medium">Tạo lúc</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.items.map((e) => (
                      <tr key={e.id} className="border-b border-border/50" data-testid={`ledger-row-${e.id}`}>
                        <td className="py-1">{e.type}</td>
                        <td className="py-1 font-mono">{formatVnd(e.amountMinor)}</td>
                        <td className="py-1 font-mono text-xs text-muted-foreground">{e.sourceEventId}</td>
                        <td className="py-1">{formatDate(e.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <div className="border-t border-border pt-4">
                <h3 className="mb-2 text-sm font-semibold">Điều chỉnh thủ công</h3>
                <FinanceActions kind="adjustment" operatorId={operatorId} />
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nhập mã nhà xe để xem sổ cái và thực hiện điều chỉnh thủ công.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Refund-out ────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle as="h2" className="text-lg">
            Hoàn tiền
          </CardTitle>
        </CardHeader>
        <CardContent>
          <FinanceActions kind="refund-out" />
        </CardContent>
      </Card>

      {/* ── Chargeback ────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle as="h2" className="text-lg">
            Chargeback
          </CardTitle>
        </CardHeader>
        <CardContent>
          <FinanceActions kind="chargeback" />
        </CardContent>
      </Card>

      {/* ── FeeConfig editor (global) ─────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle as="h2" className="text-lg">
            Phí nền tảng (toàn cục)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Mặc định toàn cục hiện tại: <span data-testid="global-fee">{formatPct(globalFeePpm)}</span>. Ghi đè theo nhà xe được thiết lập tại tab{' '}
            <Link href="/admin/operators" className="underline">
              Nhà xe
            </Link>
            .
          </p>
          <FinanceActions kind="global-fee" currentFeePpm={globalFeePpm} />
        </CardContent>
      </Card>
    </div>
  );
}
