'use client';

/**
 * /auth/register — 3-step registration:
 *   1. Enter phone → POST /api/auth/otp/send
 *   2. Enter OTP code → POST /api/auth/otp/verify → get otpProof
 *   3. Enter password + displayName → POST /api/auth/register → redirect home
 *
 * Access token held in module-level variable (simple in-memory store).
 * CSRF token read from bb_csrf cookie set by proxy.ts.
 */

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type Step = 'phone' | 'otp' | 'details';

function getCsrf(): string {
  const match = document.cookie.match(/(?:^|;\s*)bb_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

// Module-level access token store (cleared on logout)
let _accessToken: string | null = null;
export function getAccessToken(): string | null { return _accessToken; }
export function setAccessToken(t: string | null): void { _accessToken = t; }

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo') ?? '/';

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otpProof, setOtpProof] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Step 1: send OTP
  async function handleSendOtp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrf() },
        body: JSON.stringify({ phone }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.error === 'rate_limited') {
          setError(`Quá nhiều yêu cầu. Thử lại sau ${json.retryAfter}s.`);
        } else {
          setError('Không thể gửi mã OTP. Vui lòng thử lại.');
        }
        return;
      }
      setStep('otp');
    } catch {
      setError('Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  // Step 2: verify OTP
  async function handleVerifyOtp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const code = fd.get('code') as string;
    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrf() },
        body: JSON.stringify({ phone, code }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error === 'expired' ? 'Mã OTP đã hết hạn.' : 'Mã OTP không đúng.');
        return;
      }
      setOtpProof(json.otpProof);
      setStep('details');
    } catch {
      setError('Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  // Step 3: register
  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const password = fd.get('password') as string;
    const displayName = (fd.get('displayName') as string) || undefined;
    // Use the otpProof JWT captured at step-2 verify (consumed once; register validates the proof)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrf() },
        body: JSON.stringify({ phone, otpProof, password, displayName }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error === 'invalid_credentials' ? 'Số điện thoại đã được đăng ký.' : 'Đăng ký thất bại.');
        return;
      }
      setAccessToken(json.accessToken);
      router.push(returnTo);
    } catch {
      setError('Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 400, margin: '80px auto', padding: '0 16px' }}>
      <h1>Đăng ký</h1>

      {step === 'phone' && (
        <form onSubmit={handleSendOtp}>
          <label>
            Số điện thoại
            <input
              type="tel"
              name="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
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
      )}

      {step === 'otp' && (
        <form onSubmit={handleVerifyOtp}>
          <p>Nhập mã 6 chữ số đã gửi đến {phone}</p>
          <label>
            Mã OTP
            <input
              type="text"
              name="code"
              maxLength={6}
              required
              inputMode="numeric"
              pattern="[0-9]{6}"
              style={{ display: 'block', width: '100%', marginTop: 4 }}
            />
          </label>
          {error && <p style={{ color: 'red' }}>{error}</p>}
          <button type="submit" disabled={loading} style={{ marginTop: 12 }}>
            {loading ? 'Đang xác minh...' : 'Xác minh'}
          </button>
        </form>
      )}

      {step === 'details' && (
        <form onSubmit={handleRegister}>
          <p>Tạo mật khẩu</p>
          <label>
            Mật khẩu
            <input
              type="password"
              name="password"
              required
              minLength={8}
              style={{ display: 'block', width: '100%', marginTop: 4 }}
            />
          </label>
          <label style={{ marginTop: 12, display: 'block' }}>
            Tên hiển thị (tuỳ chọn)
            <input
              type="text"
              name="displayName"
              style={{ display: 'block', width: '100%', marginTop: 4 }}
            />
          </label>
          {error && <p style={{ color: 'red' }}>{error}</p>}
          <button type="submit" disabled={loading} style={{ marginTop: 12 }}>
            {loading ? 'Đang đăng ký...' : 'Đăng ký'}
          </button>
        </form>
      )}

      <p style={{ marginTop: 16 }}>
        Đã có tài khoản? <a href="/auth/login">Đăng nhập</a>
      </p>
    </main>
  );
}
