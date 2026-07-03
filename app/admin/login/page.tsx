'use client';

/**
 * /admin/login — Admin sign-in (Issue 056). Auth-boundary entry point; the only
 * /admin path in the middleware exact-match free-list.
 *
 * Two steps: (1) email + password → POST /api/admin/auth/login (mints a
 * totpVerified=false session); (2) TOTP code → POST /api/admin/auth/totp/verify
 * (flips the session to totpVerified=true), then navigate to /admin. Both POSTs
 * echo the bb_csrf double-submit token. Minimal by design — Wave 3 polishes the UI.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { readCsrfToken } from '@/lib/auth/csrfClient';

type Step = 'credentials' | 'totp';

export default function AdminLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function post(url: string, body: Record<string, string>): Promise<Response> {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': readCsrfToken() },
      body: JSON.stringify(body),
    });
  }

  async function submitCredentials(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await post('/api/admin/auth/login', { email, password });
      if (res.status === 429) {
        setError('Quá nhiều lần thử. Vui lòng thử lại sau.');
        return;
      }
      if (!res.ok) {
        setError('Email hoặc mật khẩu không đúng.');
        return;
      }
      setStep('totp');
    } finally {
      setBusy(false);
    }
  }

  async function submitTotp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await post('/api/admin/auth/totp/verify', { code });
      if (res.status === 409) {
        setError('Tài khoản chưa thiết lập TOTP. Liên hệ quản trị viên.');
        return;
      }
      if (res.status === 429) {
        const json = await res.json();
        setError(json.error === 'LOCKED_OUT'
          ? 'Tài khoản bị khóa tạm thời. Vui lòng thử lại sau 15 phút.'
          : 'Quá nhiều lần thử. Vui lòng thử lại sau.');
        return;
      }
      if (!res.ok) {
        setError('Mã xác thực không đúng.');
        return;
      }
      router.replace('/admin');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-16 max-w-sm">
      <h1 className="text-xl font-semibold">Đăng nhập quản trị</h1>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {step === 'credentials' ? (
        <form onSubmit={submitCredentials} method="post" className="mt-6 space-y-4">
          <div>
            <label htmlFor="admin-email" className="mb-1 block text-sm font-medium">Email</label>
            <input
              id="admin-email"
              name="email"
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded border px-3 py-2"
              autoComplete="username"
            />
          </div>
          <div>
            <label htmlFor="admin-password" className="mb-1 block text-sm font-medium">Mật khẩu</label>
            <input
              id="admin-password"
              name="password"
              type="password"
              required
              placeholder="Mật khẩu"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded border px-3 py-2"
              autoComplete="current-password"
            />
          </div>
          <button type="submit" disabled={busy} className="w-full rounded bg-primary px-3 py-2 text-white">
            Tiếp tục
          </button>
        </form>
      ) : (
        <form onSubmit={submitTotp} method="post" className="mt-6 space-y-4">
          <div>
            <label htmlFor="admin-totp-code" className="mb-1 block text-sm font-medium">Mã TOTP (6 số)</label>
            <input
              id="admin-totp-code"
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
          <button type="submit" disabled={busy} className="w-full rounded bg-primary px-3 py-2 text-white">
            Xác thực
          </button>
        </form>
      )}
    </div>
  );
}
