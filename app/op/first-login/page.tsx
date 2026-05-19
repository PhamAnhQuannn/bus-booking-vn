'use client';

/**
 * /op/first-login — Forced password change page for operators.
 * POSTs { currentPassword, newPassword } to /api/op/auth/password/change.
 * On success → redirects to /op/profile.
 *
 * Only reachable after login when requiresPasswordChange = true.
 * The change route uses requireOperatorAuth({ allowDuringPasswordChange: true }).
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';

function getCsrf(): string {
  const match = document.cookie.match(/(?:^|;\s*)bb_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

export default function OpFirstLoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const currentPassword = fd.get('currentPassword') as string;
    const newPassword = fd.get('newPassword') as string;
    const confirmPassword = fd.get('confirmPassword') as string;

    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/op/auth/password/change', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCsrf(),
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (res.status === 204) {
        router.push('/op/profile');
        return;
      }

      const json = await res.json();
      if (json.error === 'WEAK_PASSWORD') {
        setError('Mật khẩu mới không đủ mạnh (tối thiểu 8 ký tự).');
      } else if (json.error === 'WRONG_CURRENT') {
        setError('Mật khẩu hiện tại không đúng.');
      } else if (json.error === 'SAME_AS_OLD') {
        setError('Mật khẩu mới phải khác mật khẩu cũ.');
      } else {
        setError('Đã xảy ra lỗi. Vui lòng thử lại.');
      }
    } catch {
      setError('Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 400, margin: '80px auto', padding: '0 16px' }}>
      <h1>Đổi mật khẩu lần đầu</h1>
      <p>Bạn cần đặt mật khẩu mới trước khi tiếp tục.</p>
      <form onSubmit={handleSubmit}>
        <label>
          Mật khẩu hiện tại
          <input
            type="password"
            name="currentPassword"
            required
            style={{ display: 'block', width: '100%', marginTop: 4 }}
          />
        </label>
        <label style={{ marginTop: 12, display: 'block' }}>
          Mật khẩu mới
          <input
            type="password"
            name="newPassword"
            required
            minLength={8}
            style={{ display: 'block', width: '100%', marginTop: 4 }}
          />
        </label>
        <label style={{ marginTop: 12, display: 'block' }}>
          Xác nhận mật khẩu mới
          <input
            type="password"
            name="confirmPassword"
            required
            style={{ display: 'block', width: '100%', marginTop: 4 }}
          />
        </label>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ marginTop: 12 }}>
          {loading ? 'Đang lưu...' : 'Đổi mật khẩu'}
        </button>
      </form>
    </main>
  );
}
