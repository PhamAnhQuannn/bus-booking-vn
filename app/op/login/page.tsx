'use client';

/**
 * /op/login — Operator login page.
 * POSTs { scope: 'operator', phone, password } to /api/auth/login.
 * On requiresPasswordChange → redirects to /op/first-login.
 * Otherwise → redirects to /op/profile.
 *
 * CSRF: CSRF_EXEMPT_PREFIXES does NOT cover /api/auth/login — must send X-CSRF-Token.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';

function getCsrf(): string {
  const match = document.cookie.match(/(?:^|;\s*)bb_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

export default function OpLoginPage() {
  const router = useRouter();
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
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCsrf(),
        },
        body: JSON.stringify({ scope: 'operator', phone, password }),
      });

      if (!res.ok) {
        setError('Số điện thoại hoặc mật khẩu không đúng.');
        return;
      }

      const json = await res.json();

      if (json.requiresPasswordChange) {
        router.push('/op/first-login');
      } else {
        router.push('/op/profile');
      }
    } catch {
      setError('Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 400, margin: '80px auto', padding: '0 16px' }}>
      <h1>Đăng nhập — Quản trị viên</h1>
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
        <a href="/op/forgot-password">Quên mật khẩu?</a>
      </p>
    </main>
  );
}
