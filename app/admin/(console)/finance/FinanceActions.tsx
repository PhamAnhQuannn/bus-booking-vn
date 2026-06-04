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

import { readCsrfToken } from '@/lib/auth';
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
      setError('Network error. Please retry.');
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
        setError('Invalid or expired code. Please try again.');
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
      setError('Network error. Please retry.');
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
      <Label htmlFor={`totp-${props.kind}`}>Enter your TOTP code to continue</Label>
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
          {busy ? 'Verifying…' : 'Confirm'}
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
          Cancel
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
                {busy ? 'Working…' : 'Retry'}
              </Button>
            ) : null}
            {props.payoutStatus === 'requested' ? (
              <Button
                type="button"
                disabled={busy}
                onClick={() => run(`/api/admin/finance/payouts/${props.payoutId}/approve`, undefined)}
                data-testid={`payout-approve-${props.payoutId}`}
              >
                {busy ? 'Working…' : 'Approve'}
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
        busy={busy}
        disabled={pending !== null}
        errorBlock={errorBlock}
        stepUpBlock={stepUpBlock}
        onSubmit={(bookingId, amountMinor) =>
          run('/api/admin/finance/chargeback', { bookingId, amountMinor })
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
      setLocalError('Select an operator first.');
      return;
    }
    const amountMinor = Number(amount);
    if (!Number.isInteger(amountMinor) || amountMinor === 0) {
      setLocalError('Enter a non-zero whole VND amount (negative to debit).');
      return;
    }
    if (reason.trim().length === 0) {
      setLocalError('A reason is required.');
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
              <Label htmlFor="adj-amount">Amount (VND, signed)</Label>
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
              <Label htmlFor="adj-reason">Reason</Label>
              <Input
                id="adj-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Correction for…"
                data-testid="adjustment-reason"
              />
            </div>
            <Button type="submit" variant="outline" disabled={busy} data-testid="adjustment-submit">
              {busy ? 'Working…' : 'Post adjustment'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Positive credits the operator; a leading minus debits them.
          </p>
        </>
      ) : null}
    </form>
  );
}

function BookingAmountForm({
  kind,
  withReason,
  busy,
  disabled,
  errorBlock,
  stepUpBlock,
  onSubmit,
}: FormShellProps & {
  kind: string;
  withReason: boolean;
  onSubmit: (bookingId: string, amountMinor: number, reason: string) => void;
}) {
  const [bookingId, setBookingId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    if (bookingId.trim().length === 0) {
      setLocalError('Booking ID is required.');
      return;
    }
    const amountMinor = Number(amount);
    if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
      setLocalError('Enter a positive whole VND amount.');
      return;
    }
    if (withReason && reason.trim().length === 0) {
      setLocalError('A reason is required.');
      return;
    }
    onSubmit(bookingId.trim(), amountMinor, reason.trim());
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
            <Label htmlFor={`${kind}-booking`}>Booking ID</Label>
            <Input
              id={`${kind}-booking`}
              value={bookingId}
              onChange={(e) => setBookingId(e.target.value)}
              className="max-w-64"
              data-testid={`${kind}-booking`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${kind}-amount`}>Amount (VND)</Label>
            <Input
              id={`${kind}-amount`}
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="max-w-40"
              data-testid={`${kind}-amount`}
            />
          </div>
          {withReason ? (
            <div className="flex flex-1 flex-col gap-1">
              <Label htmlFor={`${kind}-reason`}>Reason</Label>
              <Input
                id={`${kind}-reason`}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                data-testid={`${kind}-reason`}
              />
            </div>
          ) : null}
          <Button type="submit" variant="outline" disabled={busy} data-testid={`${kind}-submit`}>
            {busy ? 'Working…' : kind === 'refund-out' ? 'Issue refund' : 'Record chargeback'}
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
      setLocalError('Enter a fee percentage between 0 and 20.');
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
            {busy ? 'Working…' : 'Set global fee'}
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
      return 'Re-authentication required.';
    case 'INVALID_RATE':
      return 'Invalid fee rate. Enter a percentage between 0 and 20.';
    case 'PAYOUT_NOT_FOUND':
      return 'Payout no longer exists.';
    case 'BOOKING_NOT_FOUND':
      return 'Booking not found.';
    case 'NOT_RETRYABLE':
      return 'This payout is not in a retryable (failed) state.';
    case 'NOT_APPROVABLE':
      return 'This payout is not in an approvable (requested) state.';
    case 'NOT_REFUNDABLE':
      return 'This booking is not in a refundable state.';
    case 'INVALID_AMOUNT':
      return 'Invalid amount.';
    case 'INVALID':
      return 'Invalid input.';
    default:
      return `Action failed (${res.status}).`;
  }
}
