'use client';

/**
 * BankAccountForm — Settings payout bank-account island (Issue 080 / 078).
 *
 * Shows the current MASKED account (passed from the server read of getPayoutAccount)
 * + its verification status, and POSTs /api/op/payout-account
 * { bankName, accountNumber, accountHolderName } with X-CSRF-Token (double-submit,
 * AGENTS.md Issue 007). On success → router.refresh() so the server re-reads the
 * now-unverified masked account.
 *
 * SECURITY copy (078): editing the account RESETS verification — the operator must
 * re-verify ownership before the payout rail will send. We message this inline.
 *
 * The raw account number is NEVER pre-filled (the server only ever returns the
 * masked last-4); the operator re-enters it to change it.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { readCsrfToken } from '@/lib/auth/csrfClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

export interface MaskedAccount {
  bankName: string;
  accountNumberMasked: string;
  accountHolderName: string;
  verified: boolean;
}

interface Props {
  account: MaskedAccount | null;
}

export default function BankAccountForm({ account }: Props) {
  const router = useRouter();
  const [bankName, setBankName] = useState(account?.bankName ?? '');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolderName, setAccountHolderName] = useState(account?.accountHolderName ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setIsError(false);
    setSubmitting(true);
    try {
      const res = await fetch('/api/op/payout-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': readCsrfToken(),
        },
        credentials: 'same-origin',
        body: JSON.stringify({ bankName, accountNumber, accountHolderName }),
      });
      if (res.ok) {
        setIsError(false);
        setMessage('Đã lưu tài khoản. Cần xác minh lại quyền sở hữu trước khi nhận chi trả.');
        setAccountNumber('');
        router.refresh();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setIsError(true);
      setMessage(
        data.error === 'validation_failed'
          ? 'Thông tin tài khoản không hợp lệ.'
          : `Lưu tài khoản thất bại (${res.status}).`
      );
    } catch {
      setIsError(true);
      setMessage('Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {account ? (
        <div
          className="flex flex-wrap items-center gap-2 text-sm"
          data-testid="bank-account-current"
        >
          <span className="text-muted-foreground">Tài khoản hiện tại:</span>
          <span className="font-medium">{account.bankName}</span>
          <span className="font-mono tabular-nums">{account.accountNumberMasked}</span>
          <span>· {account.accountHolderName}</span>
          {account.verified ? (
            <Badge variant="success" data-testid="bank-account-verified">
              Đã xác minh
            </Badge>
          ) : (
            <Badge variant="pending" data-testid="bank-account-unverified">
              Chưa xác minh
            </Badge>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground" data-testid="bank-account-none">
          Chưa đăng ký tài khoản ngân hàng nhận chi trả.
        </p>
      )}

      <Alert>
        <AlertDescription className="text-xs">
          Lưu ý: chỉnh sửa tài khoản sẽ đặt lại trạng thái xác minh — bạn phải xác minh lại quyền
          sở hữu trước khi nền tảng chuyển tiền.
        </AlertDescription>
      </Alert>

      {message ? (
        <Alert variant={isError ? 'error' : 'success'} data-testid="bank-account-message">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}

      <form onSubmit={handleSubmit} className="grid gap-3 sm:max-w-md" data-testid="bank-account-form">
        <div className="grid gap-1.5">
          <Label htmlFor="bank-name">Ngân hàng</Label>
          <Input
            id="bank-name"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            placeholder="VD: Vietcombank"
            required
            data-testid="bank-name"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="account-number">Số tài khoản</Label>
          <Input
            id="account-number"
            inputMode="numeric"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            placeholder={account ? 'Nhập lại để thay đổi' : 'Số tài khoản'}
            required
            data-testid="account-number"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="account-holder">Chủ tài khoản</Label>
          <Input
            id="account-holder"
            value={accountHolderName}
            onChange={(e) => setAccountHolderName(e.target.value)}
            placeholder="Tên chủ tài khoản"
            required
            data-testid="account-holder"
          />
        </div>
        <div>
          <Button type="submit" disabled={submitting} data-testid="bank-account-submit">
            {submitting ? 'Đang lưu…' : 'Lưu tài khoản'}
          </Button>
        </div>
      </form>
    </div>
  );
}
