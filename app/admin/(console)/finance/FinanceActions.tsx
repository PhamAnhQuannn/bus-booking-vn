'use client';

/**
 * FinanceActions — client island for the admin Finance tab (Issue 068).
 *
 * One component, multiple `kind`s (the page mounts the right one per section):
 *   - payout-row   → Retry (failed) / Approve (requested) buttons for a payout
 *   - adjustment   → manual operator-balance adjustment form (signed VND + reason)
 *   - refund-out   → refund-out form (bookingId + amount + reason)
 *   - chargeback   → chargeback form (bookingId + amount)
 *   - global-fee   → global platform-fee % form
 *
 * EVERY action goes through the step-up loop (mirrors OperatorActions, Issue 067):
 * POST the action → if 403 STEP_UP_REQUIRED, reveal a TOTP prompt → POST
 * /api/admin/auth/step-up { code } → on 200 the bb_admin_stepup cookie is set →
 * re-POST the original action. CSRF via readCsrfToken on every non-safe call
 * (Issue 002/003). On success router.refresh() so the RSC re-renders.
 *
 * Amounts are entered in VND minor units (VND has no minor unit, so VND == minor).
 * Adjustment amounts are SIGNED — a leading `-` debits the operator.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PayoutStatus } from '@prisma/client';

import { readCsrfToken } from '@/lib/auth/csrfClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

type Props =
  | { kind: 'payout-row'; payoutId: string; payoutStatus: PayoutStatus }
  | { kind: 'adjustment'; operatorId: string | undefined }
  | { kind: 'refund-out' }
  | { kind: 'chargeback' }
  | { kind: 'global-fee'; currentFeePpm: number };

/** A pending request awaiting a step-up retry: the path + the JSON body to re-POST. */
interface PendingReq {
  path: string;
  body: unknown;
}

export function FinanceActions(props: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingReq | null>(null);
  const [totpCode, setTotpCode] = useState('');

  async function rawPost(path: string, body: unknown): Promise<Response> {
    return fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': readCsrfToken(),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  /** Run a finance action; on 403 STEP_UP_REQUIRED stash it and show the TOTP prompt. */
  async function run(path: string, body: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await rawPost(path, body);
      if (res.status === 403) {
        const data = await res.json().catch(() => ({}));
        if (data?.error === 'STEP_UP_REQUIRED') {
          setPending({ path, body });
          return;
        }
      }
      if (!res.ok) {
        setError(await describeError(res));
        return;
      }
      router.refresh();
    } catch {
      setError('Lỗi mạng. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  }

  /** Submit the TOTP code to mint a step-up cookie, then retry the pending request. */
  async function submitStepUp() {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      const stepRes = await fetch('/api/admin/auth/step-up', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': readCsrfToken(),
        },
        body: JSON.stringify({ code: totpCode }),
      });
      if (!stepRes.ok) {
        setError('Mã không hợp lệ hoặc hết hạn. Vui lòng thử lại.');
        return;
      }
      const res = await rawPost(pending.path, pending.body);
      if (!res.ok) {
        setError(await describeError(res));
        return;
      }
      setPending(null);
      setTotpCode('');
      router.refresh();
    } catch {
      setError('Lỗi mạng. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  }

  const errorBlock = error ? (
    <Alert variant="error" data-testid="finance-action-error">
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  ) : null;

  const stepUpBlock = pending ? (
    <div className="space-y-2 rounded-lg border border-border p-3" data-testid="finance-stepup">
      <Label htmlFor={`totp-${props.kind}`}>Nhập mã TOTP để tiếp tục</Label>
      <div className="flex gap-2">
        <Input
          id={`totp-${props.kind}`}
          inputMode="numeric"
          autoComplete="one-time-code"
          value={totpCode}
          onChange={(e) => setTotpCode(e.target.value)}
          className="max-w-32"
          data-testid="finance-stepup-code"
        />
        <Button type="button" onClick={submitStepUp} disabled={busy || totpCode.length === 0}>
          {busy ? 'Đang xác minh…' : 'Xác nhận'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setPending(null);
            setTotpCode('');
          }}
          disabled={busy}
        >
          Hủy
        </Button>
      </div>
    </div>
  ) : null;

  // ── payout-row: Retry (failed) / Approve (requested) ───────────────────────
  if (props.kind === 'payout-row') {
    return (
      <div className="space-y-2">
        {errorBlock}
        {stepUpBlock}
        {!pending ? (
          <div className="flex gap-2">
            {props.payoutStatus === 'failed' ? (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => run(`/api/admin/finance/payouts/${props.payoutId}/retry`, undefined)}
                data-testid={`payout-retry-${props.payoutId}`}
              >
                {busy ? 'Đang xử lý…' : 'Thử lại'}
              </Button>
            ) : null}
            {props.payoutStatus === 'requested' ? (
              <Button
                type="button"
                disabled={busy}
                onClick={() => run(`/api/admin/finance/payouts/${props.payoutId}/approve`, undefined)}
                data-testid={`payout-approve-${props.payoutId}`}
              >
                {busy ? 'Đang xử lý…' : 'Phê duyệt'}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  // ── adjustment ─────────────────────────────────────────────────────────────
  if (props.kind === 'adjustment') {
    return (
      <AdjustmentForm
        operatorId={props.operatorId}
        busy={busy}
        disabled={pending !== null}
        errorBlock={errorBlock}
        stepUpBlock={stepUpBlock}
        onSubmit={(amountMinor, reason) =>
          run('/api/admin/finance/ledger/adjustment', {
            operatorId: props.operatorId,
            amountMinor,
            reason,
          })
        }
      />
    );
  }

  // ── refund-out ─────────────────────────────────────────────────────────────
  if (props.kind === 'refund-out') {
    return (
      <BookingAmountForm
        kind="refund-out"
        withReason
        busy={busy}
        disabled={pending !== null}
        errorBlock={errorBlock}
        stepUpBlock={stepUpBlock}
        onSubmit={(bookingId, amountMinor, reason) =>
          run('/api/admin/finance/refund-out', { bookingId, amountMinor, reason })
        }
      />
    );
  }

  // ── chargeback ─────────────────────────────────────────────────────────────
  if (props.kind === 'chargeback') {
    return (
      <BookingAmountForm
        kind="chargeback"
        withReason={false}
        withLiability
        busy={busy}
        disabled={pending !== null}
        errorBlock={errorBlock}
        stepUpBlock={stepUpBlock}
        onSubmit={(bookingId, amountMinor, _reason, liability) =>
          run('/api/admin/finance/chargeback', { bookingId, amountMinor, liability })
        }
      />
    );
  }

  // ── global-fee ─────────────────────────────────────────────────────────────
  return (
    <GlobalFeeForm
      currentFeePpm={props.currentFeePpm}
      busy={busy}
      disabled={pending !== null}
      errorBlock={errorBlock}
      stepUpBlock={stepUpBlock}
      onSubmit={(ratePpm) => run('/api/admin/finance/fee/global', { ratePpm })}
    />
  );
}

// ── sub-forms ────────────────────────────────────────────────────────────────

interface FormShellProps {
  busy: boolean;
  disabled: boolean;
  errorBlock: React.ReactNode;
  stepUpBlock: React.ReactNode;
}

function AdjustmentForm({
  operatorId,
  busy,
  disabled,
  errorBlock,
  stepUpBlock,
  onSubmit,
}: FormShellProps & {
  operatorId: string | undefined;
  onSubmit: (amountMinor: number, reason: string) => void;
}) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    if (!operatorId) {
      setLocalError('Chọn nhà xe trước.');
      return;
    }
    const amountMinor = Number(amount);
    if (!Number.isInteger(amountMinor) || amountMinor === 0) {
      setLocalError('Nhập số tiền VND nguyên khác 0 (âm để ghi nợ).');
      return;
    }
    if (reason.trim().length === 0) {
      setLocalError('Cần nhập lý do.');
      return;
    }
    onSubmit(amountMinor, reason.trim());
  }

  return (
    <form className="space-y-2" onSubmit={submit} data-testid="adjustment-form">
      {errorBlock}
      {localError ? (
        <Alert variant="error">
          <AlertDescription>{localError}</AlertDescription>
        </Alert>
      ) : null}
      {stepUpBlock}
      {!disabled ? (
        <>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="adj-amount">Số tiền (VND, có dấu)</Label>
              <Input
                id="adj-amount"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="-50000"
                className="max-w-40"
                data-testid="adjustment-amount"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <Label htmlFor="adj-reason">Lý do</Label>
              <Input
                id="adj-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Điều chỉnh cho…"
                data-testid="adjustment-reason"
              />
            </div>
            <Button type="submit" variant="outline" disabled={busy} data-testid="adjustment-submit">
              {busy ? 'Đang xử lý…' : 'Ghi điều chỉnh'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Số dương ghi có cho nhà xe; dấu trừ đầu sẽ ghi nợ.
          </p>
        </>
      ) : null}
    </form>
  );
}

function BookingAmountForm({
  kind,
  withReason,
  withLiability = false,
  busy,
  disabled,
  errorBlock,
  stepUpBlock,
  onSubmit,
}: FormShellProps & {
  kind: string;
  withReason: boolean;
  withLiability?: boolean;
  onSubmit: (
    bookingId: string,
    amountMinor: number,
    reason: string,
    liability: 'operator' | 'platform'
  ) => void;
}) {
  const [bookingId, setBookingId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  // Issue 124: chargeback liability — 'operator' (S15#7 default) or 'platform'
  // (platform-absorb for VNPay card disputes; operator held harmless).
  const [liability, setLiability] = useState<'operator' | 'platform'>('operator');
  const [localError, setLocalError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    if (bookingId.trim().length === 0) {
      setLocalError('Cần nhập mã đặt vé.');
      return;
    }
    const amountMinor = Number(amount);
    if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
      setLocalError('Nhập số tiền VND nguyên dương.');
      return;
    }
    if (withReason && reason.trim().length === 0) {
      setLocalError('Cần nhập lý do.');
      return;
    }
    onSubmit(bookingId.trim(), amountMinor, reason.trim(), liability);
  }

  return (
    <form className="space-y-2" onSubmit={submit} data-testid={`${kind}-form`}>
      {errorBlock}
      {localError ? (
        <Alert variant="error">
          <AlertDescription>{localError}</AlertDescription>
        </Alert>
      ) : null}
      {stepUpBlock}
      {!disabled ? (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${kind}-booking`}>Mã đặt vé</Label>
            <Input
              id={`${kind}-booking`}
              value={bookingId}
              onChange={(e) => setBookingId(e.target.value)}
              className="max-w-64"
              data-testid={`${kind}-booking`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${kind}-amount`}>Số tiền (VND)</Label>
            <Input
              id={`${kind}-amount`}
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="max-w-40"
              data-testid={`${kind}-amount`}
            />
          </div>
          {withLiability ? (
            <div className="flex flex-col gap-1">
              <Label htmlFor={`${kind}-liability`}>Chịu phí</Label>
              <select
                id={`${kind}-liability`}
                value={liability}
                onChange={(e) => setLiability(e.target.value as 'operator' | 'platform')}
                className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                data-testid={`${kind}-liability`}
              >
                <option value="operator">Nhà xe chịu (mặc định)</option>
                <option value="platform">Nền tảng chịu (VNPay)</option>
              </select>
            </div>
          ) : null}
          {withReason ? (
            <div className="flex flex-1 flex-col gap-1">
              <Label htmlFor={`${kind}-reason`}>Lý do</Label>
              <Input
                id={`${kind}-reason`}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                data-testid={`${kind}-reason`}
              />
            </div>
          ) : null}
          <Button type="submit" variant="outline" disabled={busy} data-testid={`${kind}-submit`}>
            {busy ? 'Đang xử lý…' : kind === 'refund-out' ? 'Thực hiện hoàn tiền' : 'Ghi nhận chargeback'}
          </Button>
        </div>
      ) : null}
    </form>
  );
}

function GlobalFeeForm({
  currentFeePpm,
  busy,
  disabled,
  errorBlock,
  stepUpBlock,
  onSubmit,
}: FormShellProps & {
  currentFeePpm: number;
  onSubmit: (ratePpm: number) => void;
}) {
  const [feePct, setFeePct] = useState((currentFeePpm / 10000).toString());
  const [localError, setLocalError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    const pct = Number(feePct);
    if (!Number.isFinite(pct) || pct < 0 || pct > 20) {
      setLocalError('Nhập phần trăm phí từ 0 đến 20.');
      return;
    }
    // %→ppm: pct * 10000 (6% → 60000 ppm). Round to an integer ppm.
    onSubmit(Math.round(pct * 10000));
  }

  return (
    <form className="space-y-2" onSubmit={submit} data-testid="global-fee-form">
      {errorBlock}
      {localError ? (
        <Alert variant="error">
          <AlertDescription>{localError}</AlertDescription>
        </Alert>
      ) : null}
      {stepUpBlock}
      {!disabled ? (
        <div className="flex items-end gap-2">
          <div className="flex items-center gap-1">
            <Input
              id="global-fee-pct"
              inputMode="decimal"
              value={feePct}
              onChange={(e) => setFeePct(e.target.value)}
              className="max-w-24"
              data-testid="global-fee-pct"
            />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
          <Button type="submit" variant="outline" disabled={busy} data-testid="global-fee-submit">
            {busy ? 'Đang xử lý…' : 'Đặt phí toàn cục'}
          </Button>
        </div>
      ) : null}
    </form>
  );
}

async function describeError(res: Response): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  switch (data.error) {
    case 'STEP_UP_REQUIRED':
      return 'Cần xác thực lại.';
    case 'INVALID_RATE':
      return 'Tỷ lệ phí không hợp lệ. Nhập phần trăm từ 0 đến 20.';
    case 'PAYOUT_NOT_FOUND':
      return 'Chi trả không còn tồn tại.';
    case 'BOOKING_NOT_FOUND':
      return 'Không tìm thấy đặt vé.';
    case 'NOT_RETRYABLE':
      return 'Chi trả này không ở trạng thái có thể thử lại (thất bại).';
    case 'NOT_APPROVABLE':
      return 'Chi trả này không ở trạng thái có thể phê duyệt (yêu cầu).';
    case 'NOT_REFUNDABLE':
      return 'Đặt vé này không ở trạng thái có thể hoàn tiền.';
    case 'INVALID_AMOUNT':
      return 'Số tiền không hợp lệ.';
    case 'INVALID':
      return 'Dữ liệu không hợp lệ.';
    default:
      return `Thao tác thất bại (${res.status}).`;
  }
}
