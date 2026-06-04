'use client';

/**
 * WithdrawButton — Money-page client island (Issue 080 / 053).
 *
 * POSTs /api/op/money/withdraw { amountMinor } with X-CSRF-Token (double-submit,
 * AGENTS.md Issue 007) AND an Idempotency-Key header (UUID minted per open dialog
 * attempt) so a double-submit doesn't withdraw twice. On success → router.refresh()
 * so the server Money page re-reads the now-drained balance + new payout row.
 *
 * Surfaces the 053 failure reasons as friendly Vietnamese copy:
 *   below_min                    → amount below the min threshold.
 *   insufficient_available       → not enough available balance.
 *   invalid_amount               → non-positive / non-integer.
 *   payout_account_unverified    → no/unverified bank account → link to Settings.
 *
 * VND has no minor unit, so amountMinor == the VND figure the operator types.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { readCsrfToken } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Props {
  /** Available balance (VND) as a string — server-derived, BigInt-safe. */
  availableMinor: string;
  /** Minimum withdrawal threshold (VND). */
  minThreshold: number;
}

const REASON_COPY: Record<string, string> = {
  below_min: 'Số tiền thấp hơn mức rút tối thiểu.',
  insufficient_available: 'Số dư khả dụng không đủ.',
  invalid_amount: 'Số tiền không hợp lệ.',
  payout_account_unverified: 'Bạn cần đăng ký và xác minh tài khoản ngân hàng trước khi rút tiền.',
  validation_failed: 'Số tiền không hợp lệ.',
};

function fmt(v: number): string {
  return new Intl.NumberFormat('vi-VN').format(v) + 'đ';
}

export default function WithdrawButton({ availableMinor, minThreshold }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsAccount, setNeedsAccount] = useState(false);
  const [success, setSuccess] = useState(false);

  const available = (() => {
    try {
      return BigInt(availableMinor);
    } catch {
      return BigInt(0);
    }
  })();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNeedsAccount(false);
    setSuccess(false);

    const amountMinor = Number(amount);
    if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
      setError(REASON_COPY.invalid_amount);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/op/money/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': readCsrfToken(),
          'Idempotency-Key': crypto.randomUUID(),
        },
        credentials: 'same-origin',
        body: JSON.stringify({ amountMinor }),
      });
      if (res.ok) {
        setSuccess(true);
        setAmount('');
        setOpen(false);
        router.refresh();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      const reason = data.error ?? 'validation_failed';
      if (reason === 'payout_account_unverified') setNeedsAccount(true);
      setError(REASON_COPY[reason] ?? `Rút tiền thất bại (${res.status}).`);
    } catch {
      setError('Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <div className="space-y-2">
        {success ? (
          <Alert variant="success" data-testid="withdraw-success">
            <AlertDescription>Đã gửi yêu cầu rút tiền.</AlertDescription>
          </Alert>
        ) : null}
        <Button
          type="button"
          onClick={() => {
            setOpen(true);
            setSuccess(false);
          }}
          disabled={available < BigInt(minThreshold)}
          data-testid="withdraw-open"
        >
          Rút tiền
        </Button>
        <p className="text-xs text-muted-foreground">
          Số dư khả dụng: <span className="tabular-nums">{fmt(Number(available))}</span> · Tối thiểu{' '}
          <span className="tabular-nums">{fmt(minThreshold)}</span>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3" data-testid="withdraw-form">
      <div className="grid gap-1.5">
        <Label htmlFor="withdraw-amount">Số tiền rút (đ)</Label>
        <Input
          id="withdraw-amount"
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
          placeholder={String(minThreshold)}
          data-testid="withdraw-amount"
        />
        <p className="text-xs text-muted-foreground">
          Khả dụng <span className="tabular-nums">{fmt(Number(available))}</span> · Tối thiểu{' '}
          <span className="tabular-nums">{fmt(minThreshold)}</span>
        </p>
      </div>

      {error ? (
        <Alert variant="error" data-testid="withdraw-error">
          <AlertDescription>
            {error}
            {needsAccount ? (
              <>
                {' '}
                <Link href="/op/settings" className="font-medium text-primary hover:underline">
                  Đến cài đặt tài khoản ngân hàng
                </Link>
              </>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={submitting} data-testid="withdraw-submit">
          {submitting ? 'Đang gửi…' : 'Xác nhận rút'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          disabled={submitting}
        >
          Huỷ
        </Button>
      </div>
    </form>
  );
}
