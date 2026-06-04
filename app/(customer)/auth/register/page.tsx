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

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { safeReturnTo } from '@/lib/auth';
import { AuthSplitLayout } from '@/components/auth/AuthSplitLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

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

// Module-level account-phone store — pre-fills the checkout buyer-phone field
// from the signed-in customer's registered phone (Issue 030). In-memory like
// the access token; lost on hard reload (same as the session + displayName).
let _customerPhone: string | null = null;
export function getCustomerPhone(): string | null { return _customerPhone; }
export function setCustomerPhone(p: string | null): void { _customerPhone = p; }

const STEP_INDEX: Record<Step, number> = { phone: 0, otp: 1, details: 2 };
const STEP_SUBTITLE: Record<Step, string> = {
  phone: 'Bước 1/3 · Số điện thoại',
  otp: 'Bước 2/3 · Xác minh OTP',
  details: 'Bước 3/3 · Tạo mật khẩu',
};

function StepDots({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn(
            'h-1.5 flex-1 rounded-full transition-colors',
            i < current ? 'bg-primary/40' : i === current ? 'bg-primary' : 'bg-border'
          )}
        />
      ))}
    </div>
  );
}

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
  const returnTo = safeReturnTo(searchParams.get('returnTo'));

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otpProof, setOtpProof] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  // Tick the resend cooldown down once per second.
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  // POST /api/auth/otp/send for `phone`. Returns true on success.
  async function sendOtp(target: string): Promise<boolean> {
    const res = await fetch('/api/auth/otp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrf() },
      body: JSON.stringify({ phone: target }),
    });
    const json = await res.json();
    if (!res.ok) {
      if (json.error === 'rate_limited') {
        setResendIn(json.retryAfter ?? 30);
        setError(`Quá nhiều yêu cầu. Thử lại sau ${json.retryAfter ?? 30}s.`);
      } else {
        setError('Không thể gửi mã OTP. Vui lòng thử lại.');
      }
      return false;
    }
    return true;
  }

  // Step 1: send OTP
  async function handleSendOtp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (await sendOtp(phone)) {
        setStep('otp');
        setResendIn(30);
      }
    } catch {
      setError('Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  // Step 2: resend OTP (cooldown-gated)
  async function handleResend() {
    if (resendIn > 0 || loading) return;
    setError('');
    setLoading(true);
    try {
      if (await sendOtp(phone)) setResendIn(30);
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
      setDisplayName(json.customer?.displayName ?? displayName ?? null);
      setCustomerPhone(json.customer?.phone ?? phone);
      router.push(returnTo);
    } catch {
      setError('Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthSplitLayout audience="customer" title="Đăng ký" subtitle={STEP_SUBTITLE[step]}>
      <Card className="shadow-e3">
        <CardContent className="flex flex-col gap-4">
          <StepDots current={STEP_INDEX[step]} />

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
              {error && (
                <p className="text-sm text-destructive" role="alert" aria-live="assertive">
                  {error}
                </p>
              )}
              <Button type="submit" size="lg" disabled={loading} aria-busy={loading} className="w-full">
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
              {error && (
                <p className="text-sm text-destructive" role="alert" aria-live="assertive">
                  {error}
                </p>
              )}
              <Button type="submit" size="lg" disabled={loading} aria-busy={loading} className="w-full">
                {loading ? 'Đang xác minh...' : 'Xác minh'}
              </Button>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="self-center"
                disabled={loading || resendIn > 0}
                onClick={handleResend}
              >
                {resendIn > 0 ? `Gửi lại mã sau ${resendIn}s` : 'Gửi lại mã'}
              </Button>
            </form>
          )}

          {step === 'details' && (
            <form onSubmit={handleRegister} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">Mật khẩu</Label>
                <Input id="password" type="password" name="password" required minLength={8} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="displayName">Tên hiển thị (tuỳ chọn)</Label>
                <Input id="displayName" type="text" name="displayName" />
              </div>
              {error && (
                <p className="text-sm text-destructive" role="alert" aria-live="assertive">
                  {error}
                </p>
              )}
              <Button type="submit" size="lg" disabled={loading} aria-busy={loading} className="w-full">
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
    </AuthSplitLayout>
  );
}
