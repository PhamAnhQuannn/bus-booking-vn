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

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

type Step = 'phone' | 'otp' | 'details';

function getCsrf(): string {
  const match = document.cookie.match(/(?:^|;\s*)bb_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

// Module-level access token store (cleared on logout)
let _accessToken: string | null = null;
export function getAccessToken(): string | null { return _accessToken; }
export function setAccessToken(t: string | null): void { _accessToken = t; }

// Module-level display-name store — pre-fills the checkout buyer-name field (AC4).
// In-memory like the access token; lost on hard reload (same as the session).
let _displayName: string | null = null;
export function getDisplayName(): string | null { return _displayName; }
export function setDisplayName(n: string | null): void { _displayName = n; }

export default function RegisterPage() {
  // useSearchParams() requires a Suspense boundary for static prerender (Next 16).
  return (
    <Suspense fallback={null}>
      <RegisterPageInner />
    </Suspense>
  );
}

function RegisterPageInner() {
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
      setDisplayName(displayName ?? null);
      router.push(returnTo);
    } catch {
      setError('Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-12">
      <Card>
        <CardHeader>
          <h1 className="text-2xl font-bold">Đăng ký</h1>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {step === 'phone' && (
            <form onSubmit={handleSendOtp} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="phone">Số điện thoại</Label>
                <Input
                  id="phone"
                  type="tel"
                  name="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  placeholder="0901234567"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" size="lg" disabled={loading} className="w-full">
                {loading ? 'Đang gửi...' : 'Gửi mã OTP'}
              </Button>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                Nhập mã 6 chữ số đã gửi đến {phone}
              </p>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="code">Mã OTP</Label>
                <Input
                  id="code"
                  type="text"
                  name="code"
                  maxLength={6}
                  required
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  autoComplete="one-time-code"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" size="lg" disabled={loading} className="w-full">
                {loading ? 'Đang xác minh...' : 'Xác minh'}
              </Button>
            </form>
          )}

          {step === 'details' && (
            <form onSubmit={handleRegister} className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">Tạo mật khẩu</p>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">Mật khẩu</Label>
                <Input id="password" type="password" name="password" required minLength={8} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="displayName">Tên hiển thị (tuỳ chọn)</Label>
                <Input id="displayName" type="text" name="displayName" />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" size="lg" disabled={loading} className="w-full">
                {loading ? 'Đang đăng ký...' : 'Đăng ký'}
              </Button>
            </form>
          )}

          <p className="text-sm text-muted-foreground">
            Đã có tài khoản?{' '}
            <Link
              href="/auth/login"
              className="text-primary underline-offset-4 hover:underline"
            >
              Đăng nhập
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
