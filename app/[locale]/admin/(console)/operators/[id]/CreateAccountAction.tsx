'use client';

/**
 * CreateAccountAction — admin client island to provision an operator's login
 * account from their application (2026-06-06, S05).
 *
 * POST /api/admin/operators/[id]/create-account, step-up gated (mirrors
 * OperatorActions' step-up loop). On 201 the generated username + one-time temp
 * password are shown ONCE (the same credentials are emailed to the operator). On
 * 409 ACCOUNT_ALREADY_EXISTS the button reports the account already exists.
 *
 * CSRF: every non-safe /api/* call carries X-CSRF-Token (readCsrfToken). Client
 * components MUST deep-import the client-safe csrf helper, never the @/lib/auth
 * barrel (operator-smoke Mistake Log).
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { readCsrfToken } from '@/lib/auth/csrfClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface Props {
  operatorId: string;
  hasLoginAccount: boolean;
  loginUsername: string | null;
}

interface Credentials {
  username: string;
  tempPassword: string;
}

export function CreateAccountAction({ operatorId, hasLoginAccount, loginUsername }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creds, setCreds] = useState<Credentials | null>(null);

  // Step-up: on 403 STEP_UP_REQUIRED, reveal the TOTP prompt then retry.
  const [needsStepUp, setNeedsStepUp] = useState(false);
  const [totpCode, setTotpCode] = useState('');

  function post(): Promise<Response> {
    return fetch(`/api/admin/operators/${operatorId}/create-account`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': readCsrfToken(),
      },
    });
  }

  async function handleResponse(res: Response): Promise<boolean> {
    if (res.status === 201) {
      setCreds((await res.json()) as Credentials);
      setNeedsStepUp(false);
      setTotpCode('');
      router.refresh();
      return true;
    }
    if (res.status === 403) {
      const data = await res.json().catch(() => ({}));
      if (data?.error === 'STEP_UP_REQUIRED') {
        setNeedsStepUp(true);
        return false;
      }
    }
    setError(await describeError(res));
    return false;
  }

  async function create() {
    setBusy(true);
    setError(null);
    try {
      await handleResponse(await post());
    } catch {
      setError('Lỗi mạng. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  }

  async function submitStepUp() {
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
        setError('Mã không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.');
        return;
      }
      await handleResponse(await post());
    } catch {
      setError('Lỗi mạng. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  }

  if (creds) {
    return (
      <Alert variant="success" data-testid="created-credentials">
        <AlertTitle>Tài khoản đã được tạo</AlertTitle>
        <AlertDescription>
          <p className="mb-2">
            Đã gửi thông tin đăng nhập tới email nhà xe. Mật khẩu tạm thời chỉ hiển thị một lần — hãy
            sao chép nếu cần.
          </p>
          <p className="font-mono text-sm">
            Tên đăng nhập: <span data-testid="cred-username">{creds.username}</span>
          </p>
          <p className="font-mono text-sm">
            Mật khẩu tạm thời: <span data-testid="cred-password">{creds.tempPassword}</span>
          </p>
        </AlertDescription>
      </Alert>
    );
  }

  if (hasLoginAccount) {
    return (
      <div className="space-y-2" data-testid="account-provisioned">
        <p className="text-sm text-muted-foreground">
          Tài khoản đăng nhập đã được tạo cho nhà xe này.
        </p>
        {loginUsername ? (
          <p className="font-mono text-sm">
            Tên đăng nhập: <span data-testid="login-username">{loginUsername}</span>
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Mật khẩu tạm thời đã được gửi qua SMS khi tạo tài khoản.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid={`create-account-${operatorId}`}>
      <p className="text-sm text-muted-foreground">
        Chưa có tài khoản đăng nhập. Tạo tài khoản sẽ sinh tên đăng nhập + mật khẩu tạm thời và gửi thông tin đăng nhập qua email cho nhà xe (đồng thời phê duyệt nhà xe).
      </p>
      {error ? (
        <Alert variant="error" data-testid="create-account-error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {needsStepUp ? (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <Label htmlFor={`totp-create-${operatorId}`}>Nhập mã TOTP để tiếp tục</Label>
          <div className="flex gap-2">
            <Input
              id={`totp-create-${operatorId}`}
              inputMode="numeric"
              autoComplete="one-time-code"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              className="max-w-32"
              data-testid="stepup-code"
            />
            <Button type="button" onClick={submitStepUp} disabled={busy || totpCode.length === 0}>
              {busy ? 'Đang xác minh…' : 'Xác nhận'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setNeedsStepUp(false);
                setTotpCode('');
              }}
              disabled={busy}
            >
              Hủy
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" onClick={create} disabled={busy} data-testid="action-create-account">
          {busy ? 'Đang tạo…' : 'Tạo tài khoản nhà xe'}
        </Button>
      )}
    </div>
  );
}

async function describeError(res: Response): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  switch (data.error) {
    case 'ACCOUNT_ALREADY_EXISTS':
      return 'Tài khoản đăng nhập cho nhà xe này đã tồn tại.';
    case 'OPERATOR_NOT_FOUND':
      return 'Không tìm thấy nhà xe.';
    case 'STEP_UP_REQUIRED':
      return 'Cần xác thực lại.';
    default:
      return `Tạo tài khoản thất bại (${res.status}).`;
  }
}
