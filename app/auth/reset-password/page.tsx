'use client';

/**
 * /auth/reset-password — AC1 (Issue 008)
 *
 * Alternative direct URL for password reset (same logic as the reset step in
 * /auth/forgot-password). Accepts `?phone=...` query param pre-filled from
 * the forgot-password flow, or the user can enter it manually.
 *
 * No CSRF required — /api/auth/reset-password is pre-auth exempted in proxy.ts.
 */

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillPhone = searchParams.get('phone') ?? '';

  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const phone = fd.get('phone') as string;
    const code = fd.get('code') as string;
    const newPassword = fd.get('newPassword') as string;
    const confirmPassword = fd.get('confirmPassword') as string;

    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      setLoading(false);
      return;
    }

    try {
      // Step 1: verify OTP code → single-use reset_password proof
      const verifyRes = await fetch('/api/auth/forgot-password/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      });
      if (!verifyRes.ok) {
        const vjson = await verifyRes.json().catch(() => ({}));
        const vErr = (vjson as { error?: string }).error ?? '';
        if (vErr === 'OTP_INVALID' || vErr === 'OTP_EXPIRED') {
          setError('Mã OTP không hợp lệ hoặc đã hết hạn.');
        } else if (vErr === 'OTP_LOCKED_OUT') {
          setError('Tài khoản tạm khóa. Vui lòng thử lại sau 15 phút.');
        } else {
          setError('Có lỗi xảy ra. Vui lòng thử lại.');
        }
        return;
      }
      const { otpProof } = (await verifyRes.json()) as { otpProof: string };

      // Step 2: present proof + new password
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otpProof, newPassword }),
      });

      if (res.status === 204 || res.ok) {
        setDone(true);
        return;
      }

      const json = await res.json().catch(() => ({}));
      const errCode = (json as { error?: string }).error ?? '';
      if (errCode === 'PASSWORD_REUSED') {
        setError('Mật khẩu mới không được trùng mật khẩu cũ.');
      } else if (errCode === 'WEAK_PASSWORD') {
        setError('Mật khẩu mới quá yếu. Vui lòng chọn mật khẩu mạnh hơn.');
      } else if (errCode === 'INVALID_PROOF') {
        setError('Phiên xác thực đã hết hạn. Vui lòng yêu cầu mã OTP mới.');
      } else {
        setError('Có lỗi xảy ra. Vui lòng thử lại.');
      }
    } catch {
      setError('Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <main style={{ maxWidth: 400, margin: '80px auto', padding: '0 16px' }}>
        <h1>Thành công</h1>
        <p>Mật khẩu của bạn đã được cập nhật.</p>
        <button onClick={() => router.push('/auth/login')} style={{ marginTop: 12 }}>
          Đăng nhập
        </button>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 400, margin: '80px auto', padding: '0 16px' }}>
      <h1>Đặt lại mật khẩu</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Số điện thoại
          <input
            type="tel"
            name="phone"
            required
            defaultValue={prefillPhone}
            placeholder="0901234567"
            style={{ display: 'block', width: '100%', marginTop: 4 }}
          />
        </label>
        <label style={{ marginTop: 12, display: 'block' }}>
          Mã OTP (6 chữ số)
          <input
            type="text"
            name="code"
            required
            maxLength={6}
            pattern="[0-9]{6}"
            inputMode="numeric"
            autoComplete="one-time-code"
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
            minLength={8}
            style={{ display: 'block', width: '100%', marginTop: 4 }}
          />
        </label>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ marginTop: 12 }}>
          {loading ? 'Đang xử lý...' : 'Đặt lại mật khẩu'}
        </button>
      </form>
      <p style={{ marginTop: 16 }}>
        <a href="/auth/forgot-password">Yêu cầu mã OTP mới</a>
        {' · '}
        <a href="/auth/login">Đăng nhập</a>
      </p>
    </main>
  );
}
