/**
 * /op/money — Operator Money page (Issue 080 / S08 / S09). Server component.
 *
 * Sections:
 *   1. Balance — 3 numbers (pending / available / paid-out) from getOperatorBalance.
 *   2. Withdraw — client island → POST /api/op/money/withdraw (053).
 *   3. Next auto-payout — soonest pending Payout (requested/processing).
 *   4. Ledger — the operator's OWN LedgerEntry rows via getLedgerView (068).
 *   5. Statements — payout history via getPayoutReport.
 *
 * All reads are IN-PROCESS (no self-fetch — AGENTS.md 002/003). Render body is a
 * pure function of the DB reads — no Date.now()/random (AGENTS.md Issue 016);
 * date formatting uses the row's own timestamps.
 *
 * Money is BigInt — getOperatorBalance returns bigint; getLedgerView returns
 * amounts as strings. We format with Intl.NumberFormat('vi-VN') and never round-
 * trip a balance through a float.
 */

import { redirect } from 'next/navigation';
import type { LedgerEntryType, PayoutStatus } from '@prisma/client';

import { getOperatorSession } from '@/lib/op';
import { getOperatorBalance } from '@/lib/ledger';
import { getLedgerView } from '@/lib/admin';
import { getPayoutReport } from '@/lib/ledger';
import { MIN_WITHDRAW_THRESHOLD_VND } from '@/lib/ledger';
import { prisma } from '@/lib/core/db/client';

import { PageHeader } from '@/components/op/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import WithdrawButton from './WithdrawButton';

const VND = new Intl.NumberFormat('vi-VN');

/** Format a VND minor-unit value (string or number) for display. BigInt-safe. */
function fmtVndStr(minor: string): string {
  // BigInt → Number for grouping only (display). Balances easily fit in Number's
  // safe-integer range for VND figures; the authoritative value stays a string.
  return VND.format(Number(BigInt(minor))) + 'đ';
}

function fmtVndNum(v: string): string {
  return VND.format(Number(v)) + 'đ';
}

const LEDGER_TYPE_LABEL: Record<LedgerEntryType, string> = {
  booking_credit: 'Doanh thu vé',
  platform_fee: 'Phí nền tảng',
  refund_debit: 'Hoàn tiền (trừ)',
  refund_out: 'Chi hoàn khách',
  payout_debit: 'Chi trả / rút',
  payout_reversal: 'Hoàn chi trả',
  chargeback: 'Bồi hoàn',
  adjustment: 'Điều chỉnh',
  tax_withheld: 'Thuế khấu trừ',
};

const PAYOUT_STATUS_LABEL: Record<PayoutStatus, { label: string; variant: 'success' | 'danger' | 'pending' | 'neutral' }> = {
  requested: { label: 'Đã yêu cầu', variant: 'pending' },
  processing: { label: 'Đang xử lý', variant: 'pending' },
  paid: { label: 'Đã chi', variant: 'success' },
  failed: { label: 'Thất bại', variant: 'danger' },
};

function fmtDate(d: Date | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('vi-VN');
}

export default async function OpMoneyPage() {
  const session = await getOperatorSession();
  if (!session) redirect('/op/login');
  if (session.requiresPasswordChange) redirect('/op/first-login');

  const operatorId = session.operatorId;

  const [balance, ledger, statements, nextPayout] = await Promise.all([
    getOperatorBalance(operatorId),
    getLedgerView({ operatorId, limit: 25 }),
    getPayoutReport({ operatorId }),
    // Next auto-payout: soonest still-pending Payout (requested|processing).
    prisma.payout.findFirst({
      where: { operatorId, status: { in: ['requested', 'processing'] } },
      orderBy: { scheduledAt: 'asc' },
      select: { id: true, net: true, scheduledAt: true, status: true },
    }),
  ]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-6">
      <PageHeader
        title="Tài chính"
        subtitle="Số dư, sổ cái, rút tiền và lịch sử chi trả của nhà xe."
      />

      <div className="flex flex-col gap-6">
        {/* 1. Balance — 3 numbers */}
        <section aria-labelledby="balance-heading" className="grid gap-3 sm:grid-cols-3">
          <h2 id="balance-heading" className="sr-only">
            Số dư
          </h2>
          <Card data-testid="balance-pending">
            <CardHeader>
              <CardTitle as="h3" className="text-sm font-medium text-muted-foreground">
                Đang chờ
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">
                {fmtVndStr(balance.pending.toString())}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Doanh thu chưa đến kỳ thanh toán (chuyến chưa hoàn tất hoặc trong cửa sổ T+1).
              </p>
            </CardContent>
          </Card>
          <Card data-testid="balance-available">
            <CardHeader>
              <CardTitle as="h3" className="text-sm font-medium text-muted-foreground">
                Khả dụng
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums text-primary">
                {fmtVndStr(balance.available.toString())}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Có thể rút ngay bây giờ.</p>
            </CardContent>
          </Card>
          <Card data-testid="balance-paidout">
            <CardHeader>
              <CardTitle as="h3" className="text-sm font-medium text-muted-foreground">
                Đã chi trả
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">
                {fmtVndStr(balance.paidOut.toString())}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Tổng đã chuyển về tài khoản.</p>
            </CardContent>
          </Card>
        </section>

        {/* 2. Withdraw + 3. Next auto-payout */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle as="h2" className="text-lg">
                Rút tiền
              </CardTitle>
            </CardHeader>
            <CardContent>
              <WithdrawButton
                availableMinor={balance.available.toString()}
                minThreshold={MIN_WITHDRAW_THRESHOLD_VND}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2" className="text-lg">
                Chi trả tự động kế tiếp
              </CardTitle>
            </CardHeader>
            <CardContent>
              {nextPayout ? (
                <div className="space-y-1" data-testid="next-payout">
                  <p className="text-xl font-bold tabular-nums">{fmtVndNum(nextPayout.net.toString())}</p>
                  <p className="text-sm text-muted-foreground">
                    Dự kiến {fmtDate(nextPayout.scheduledAt)} ·{' '}
                    <Badge variant={PAYOUT_STATUS_LABEL[nextPayout.status].variant}>
                      {PAYOUT_STATUS_LABEL[nextPayout.status].label}
                    </Badge>
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground" data-testid="next-payout-none">
                  Không có chi trả nào đang chờ.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 4. Ledger */}
        <Card className="overflow-hidden py-0">
          <CardHeader className="px-4 pt-4">
            <CardTitle as="h2" className="text-lg">
              Sổ cái
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {ledger.items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                Chưa có giao dịch nào.
              </p>
            ) : (
              <Table data-testid="ledger-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Thời gian</TableHead>
                    <TableHead>Loại</TableHead>
                    <TableHead className="text-right">Số tiền</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledger.items.map((row) => {
                    const negative = row.amountMinor.startsWith('-');
                    return (
                      <TableRow key={row.id} data-testid={`ledger-row-${row.id}`}>
                        <TableCell className="whitespace-nowrap tabular-nums">
                          {new Date(row.createdAt).toLocaleString('vi-VN')}
                        </TableCell>
                        <TableCell>{LEDGER_TYPE_LABEL[row.type] ?? row.type}</TableCell>
                        <TableCell
                          className={
                            'text-right tabular-nums ' +
                            (negative ? 'text-destructive' : 'text-foreground')
                          }
                        >
                          {fmtVndStr(row.amountMinor)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* 5. Statements — payout history */}
        <Card className="overflow-hidden py-0">
          <CardHeader className="px-4 pt-4">
            <CardTitle as="h2" className="text-lg">
              Lịch sử chi trả
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {statements.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                Chưa có lần chi trả nào.
              </p>
            ) : (
              <Table data-testid="statements-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Lịch</TableHead>
                    <TableHead>Nội dung</TableHead>
                    <TableHead className="text-right">Số tiền</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Hoàn tất</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statements.map((p) => (
                    <TableRow key={p.payoutId} data-testid={`statement-row-${p.payoutId}`}>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {fmtDate(p.scheduledAt)}
                      </TableCell>
                      <TableCell>{p.routeName}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtVndNum(p.net)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={PAYOUT_STATUS_LABEL[p.status].variant}>
                          {PAYOUT_STATUS_LABEL[p.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {fmtDate(p.settledAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
