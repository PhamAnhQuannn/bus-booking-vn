'use client';

/**
 * /admin/enroll-totp — admin TOTP self-enrollment (P1).
 *
 * Lives OUTSIDE the (console) route group (like /admin/login) so it renders
 * without the console chrome, and it is listed in the proxy.ts Layer 1.5
 * ADMIN_AUTH_FREE_PATHS exact-match Set so a password-only session
 * (totpVerified=false) can reach it WITHOUT the TOTP forced-redirect. The
 * underlying /api/admin/auth/totp/{enroll,confirm} routes still enforce
 * requireAdminAuth({requireTotp:false}) — an unauthenticated visitor is bounced
 * to /admin/login on the first 401.
 *
 * Flow: on mount POST /enroll → show secret (manual entry) + otpauth URI; then a
 * 6-digit code → POST /confirm → on success navigate to /admin (the confirm route
 * re-issues the session with totpVerified=true). Both POSTs echo the bb_csrf
 * double-submit token via readCsrfToken (client-safe deep import — CLAUDE.md rule).
 *
 * QR: no inline QR image — the CSP blocks external hosts and there is no bundled
 * QR encoder, so we present the secret for manual entry plus a copyable otpauth://
 * URI. Any authenticator app accepts either. (Task decision: skip QR rather than
 * add a network-dependent lib.)
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { readCsrfToken } from '@/lib/auth/csrfClient';

type Phase = 'loading' | 'enrolled' | 'already' | 'error';

export default function AdminEnrollTotpPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('loading');
  const [secret, setSecret] = useState('');
  const [otpauthUri, setOtpauthUri] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  function post(url: string, body?: Record<string, string>): Promise<Response> {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': readCsrfToken() },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await post('/api/admin/auth/totp/enroll');
        if (!active) return;
        if (res.status === 401) {
          router.replace('/admin/login');
          return;
        }
        if (res.status === 409) {
          setPhase('already');
          return;
        }
        if (!res.ok) {
          setPhase('error');
          return;
        }
        const json = (await res.json()) as { secret: string; otpauthUri: string };
        setSecret(json.secret);
        setOtpauthUri(json.otpauthUri);
        setPhase('enrolled');
      } catch {
        if (active) setPhase('error');
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await post('/api/admin/auth/totp/confirm', { code });
      if (res.status === 401) {
        router.replace('/admin/login');
        return;
      }
      if (!res.ok) {
        setError('Mã xác thực không đúng. Vui lòng thử lại.');
        return;
      }
      router.replace('/admin');
    } finally {
      setBusy(false);
    }
  }

  async function copyUri() {
    try {
      await navigator.clipboard.writeText(otpauthUri);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — user can select the text manually
    }
  }

  return (
    <div className="mx-auto mt-16 max-w-md px-4">
      <h1 className="text-xl font-semibold">Thiết lập xác thực hai lớp (TOTP)</h1>

      {phase === 'loading' && (
        <p className="mt-6 text-sm text-muted-foreground">Đang chuẩn bị…</p>
      )}

      {phase === 'error' && (
        <p className="mt-6 text-sm text-red-600">
          Không thể bắt đầu thiết lập. Vui lòng tải lại trang hoặc liên hệ quản trị viên.
        </p>
      )}

      {phase === 'already' && (
        <div className="mt-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            Tài khoản đã thiết lập TOTP.
          </p>
          <button
            type="button"
            onClick={() => router.replace('/admin')}
            className="rounded bg-primary px-3 py-2 text-sm text-white"
          >
            Về bảng điều khiển
          </button>
        </div>
      )}

      {phase === 'enrolled' && (
        <div className="mt-6 space-y-6">
          <div className="space-y-2">
            <p className="text-sm">
              Mở ứng dụng xác thực (Google Authenticator, Authy, 1Password…) và thêm
              tài khoản bằng khóa bí mật hoặc chuỗi otpauth bên dưới.
            </p>
          </div>

          <div>
            <span className="mb-1 block text-sm font-medium">Khóa bí mật (nhập thủ công)</span>
            <code className="block w-full rounded border bg-muted px-3 py-2 font-mono text-sm break-all">
              {secret}
            </code>
          </div>

          <div>
            <span className="mb-1 block text-sm font-medium">Chuỗi otpauth</span>
            <code className="block w-full rounded border bg-muted px-3 py-2 font-mono text-xs break-all">
              {otpauthUri}
            </code>
            <button
              type="button"
              onClick={copyUri}
              className="mt-2 rounded border px-3 py-1.5 text-sm outline-none transition-colors hover:bg-muted"
            >
              {copied ? 'Đã sao chép' : 'Sao chép chuỗi otpauth'}
            </button>
          </div>

          <form onSubmit={submitCode} method="post" className="space-y-4 border-t pt-6">
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div>
              <label htmlFor="totp-code" className="mb-1 block text-sm font-medium">
                Nhập mã 6 số từ ứng dụng để xác nhận
              </label>
              <input
                id="totp-code"
                name="code"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                required
                placeholder="Mã TOTP (6 số)"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full rounded border px-3 py-2 tracking-widest"
                autoComplete="one-time-code"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded bg-primary px-3 py-2 text-white disabled:opacity-50"
            >
              {busy ? 'Đang xác nhận…' : 'Xác nhận và hoàn tất'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
