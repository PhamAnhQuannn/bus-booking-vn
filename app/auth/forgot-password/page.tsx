'use client';

/**
 * /auth/forgot-password — AC1 (Issue 008)
 *
 * Step 1: enter phone → POST /api/auth/forgot-password (always 200, no-enum)
 * Step 2: enter OTP + new password → POST /api/auth/reset-password
 *
 * No CSRF token needed for forgot-password POST (pre-auth exemption in proxy.ts).
 * No CSRF token needed for reset-password POST (pre-auth exemption in proxy.ts).
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Step = 'phone' | 'reset' | 'done';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // ---- Step 1: request OTP ---------------------------------------------------
  async function handleRequestOtp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const rawPhone = fd.get('phone') as string;
    try {
      // pre-auth: no CSRF header required (proxy.ts exempt prefix)
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: rawPhone }),
      });
      // Always move to reset step (no-enumeration: even non-existent phones appear ok)
      setPhone(rawPhone);
      setStep('reset');
    } catch {
      setError('Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  // ---- Step 2: verify OTP + set new password --------------------------------
  async function handleReset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const code = fd.get('code') as string;
    const newPassword = fd.get('newPassword') as string;
    const confirmPassword = fd.get('confirmPassword') as string;
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      setLoading(false);
      return;
    }
    try {
      // pre-auth: no CSRF header required (proxy.ts exempt prefix)
      // Step 2a: verify OTP code → single-use reset_password proof
      const verifyRes = await fetch('/api/auth/forgot-password/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      });
      if (!verifyRes.ok) {
        const json = await verifyRes.json().catch(() => ({}));
        const errCode = (json as { error?: string }).error ?? '';
        if (errCode === 'OTP_INVALID' || errCode === 'OTP_EXPIRED') {
          setError('Mã OTP không hợp lệ hoặc đã hết hạn.');
        } else if (errCode === 'OTP_LOCKED_OUT') {
          setError('Tài khoản tạm khóa sau nhiều lần nhập sai. Vui lòng thử lại sau 15 phút.');
        } else {
          setError('Có lỗi xảy ra. Vui lòng thử lại.');
        }
        return;
      }
      const { otpProof } = (await verifyRes.json()) as { otpProof: string };

      // Step 2b: present the proof + new password to reset-password
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otpProof, newPassword }),
      });
      if (res.status === 204 || res.ok) {
        setStep('done');
        return;
      }
      const json = await res.json().catch(() => ({}));
      const code_err = (json as { error?: string }).error ?? '';
      if (code_err === 'PASSWORD_REUSED') {
        setError('Mật khẩu mới không được trùng mật khẩu cũ.');
      } else if (code_err === 'WEAK_PASSWORD') {
        setError('Mật khẩu mới quá yếu. Vui lòng chọn mật khẩu mạnh hơn.');
      } else if (code_err === 'INVALID_PROOF') {
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

  if (step === 'done') {
    return (
      <main style={{ maxWidth: 400, margin: '80px auto', padding: '0 16px' }}>
        <h1>Đặt lại mật khẩu thành công</h1>
        <p>Mật khẩu của bạn đã được cập nhật.</p>
        <button onClick={() => router.push('/auth/login')} style={{ marginTop: 12 }}>
          Đăng nhập
        </button>
      </main>
    );
  }

  if (step === 'reset') {
    return (
      <main style={{ maxWidth: 400, margin: '80px auto', padding: '0 16px' }}>
        <h1>Đặt lại mật khẩu</h1>
        <p>Nhập mã OTP đã gửi đến số điện thoại của bạn và mật khẩu mới.</p>
        <form onSubmit={handleReset}>
          <label>
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
        <p style={{ marginTop: 12 }}>
          <button
            type="button"
            onClick={() => { setStep('phone'); setError(''); }}
            style={{ background: 'none', border: 'none', color: 'blue', cursor: 'pointer', padding: 0 }}
          >
            Dùng số điện thoại khác
          </button>
        </p>
      </main>
    );
  }

  // step === 'phone'
  return (
    <main style={{ maxWidth: 400, margin: '80px auto', padding: '0 16px' }}>
      <h1>Quên mật khẩu</h1>
      <p>Nhập số điện thoại đã đăng ký. Chúng tôi sẽ gửi mã OTP để đặt lại mật khẩu.</p>
      <form onSubmit={handleRequestOtp}>
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
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ marginTop: 12 }}>
          {loading ? 'Đang gửi...' : 'Gửi mã OTP'}
        </button>
      </form>
      <p style={{ marginTop: 16 }}>
        <a href="/auth/login">Quay lại đăng nhập</a>
      </p>
    </main>
  );
}
