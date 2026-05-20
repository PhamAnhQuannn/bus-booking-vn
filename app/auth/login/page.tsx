'use client';

/**
 * /auth/login — phone + password → POST /api/auth/login → redirect
 * CSRF token read from bb_csrf cookie (set by proxy.ts on first GET).
 */

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { setAccessToken, setDisplayName } from '@/app/auth/register/page';

function getCsrf(): string {
  const match = document.cookie.match(/(?:^|;\s*)bb_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo') ?? '/';

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const phone = fd.get('phone') as string;
    const password = fd.get('password') as string;
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrf() },
        body: JSON.stringify({ phone, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError('Số điện thoại hoặc mật khẩu không đúng.');
        return;
      }
      setAccessToken(json.accessToken);
      setDisplayName(json.customer?.displayName ?? null);
      router.push(returnTo);
    } catch {
      setError('Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 400, margin: '80px auto', padding: '0 16px' }}>
      <h1>Đăng nhập</h1>
      <form onSubmit={handleLogin}>
        <label>
          Số điện thoại
          <input
            type="tel"
            name="phone"
            required
            placeholder="0901234567"
            style={{ display: 'block', width: '100%', marginTop: 4 }}
          />
        </label>
        <label style={{ marginTop: 12, display: 'block' }}>
          Mật khẩu
          <input
            type="password"
            name="password"
            required
            style={{ display: 'block', width: '100%', marginTop: 4 }}
          />
        </label>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ marginTop: 12 }}>
          {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>
      </form>
      <p style={{ marginTop: 16 }}>
        <a href="/auth/forgot-password">Quên mật khẩu?</a>
      </p>
      <p>
        Chưa có tài khoản? <a href="/auth/register">Đăng ký</a>
      </p>
    </main>
  );
}
