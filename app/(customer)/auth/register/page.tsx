'use client';

/**
 * /auth/register — 3-step registration:
 *   1. Enter email → POST /api/auth/otp/send
 *   2. Enter OTP code → POST /api/auth/otp/verify → get otpProof
 *   3. Enter password + displayName → POST /api/auth/register → redirect home
 */

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { readCsrfToken } from '@/lib/auth/csrfClient';
import { setAccessToken, setDisplayName, setCustomerEmail } from '@/lib/auth/clientSession';
import { safeReturnTo } from '@/lib/auth/safeReturnTo';
import { AuthSplitLayout } from '@/components/auth/AuthSplitLayout';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { FormError } from '@/components/auth/FormError';
import { authLinkClass, authFieldClass } from '@/components/auth/authLinkClass';
import { OtpCodeInput } from '@/components/auth/OtpCodeInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type Step = 'email' | 'otp' | 'details';

const STEP_INDEX: Record<Step, number> = { email: 0, otp: 1, details: 2 };
const STEP_SUBTITLE: Record<Step, string> = {
  email: 'Bước 1/3 · Địa chỉ email',
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

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otpProof, setOtpProof] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  async function sendOtp(target: string): Promise<boolean> {
    const res = await fetch('/api/auth/otp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': readCsrfToken() },
      body: JSON.stringify({ email: target }),
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

  async function handleSendOtp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (await sendOtp(email)) {
        setStep('otp');
        setResendIn(30);
      }
    } catch {
      setError('Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (resendIn > 0 || loading) return;
    setError('');
    setLoading(true);
    try {
      if (await sendOtp(email)) setResendIn(30);
    } catch {
      setError('Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const code = fd.get('code') as string;
    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': readCsrfToken() },
        body: JSON.stringify({ email, code }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.error === 'attempt_cap') {
          setResendIn(0);
          setError('Bạn đã nhập sai quá nhiều lần. Vui lòng bấm "Gửi lại mã" để nhận mã mới.');
        } else {
          setError(json.error === 'expired' ? 'Mã OTP đã hết hạn.' : 'Mã OTP không đúng.');
        }
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

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const password = fd.get('password') as string;
    const displayName = (fd.get('displayName') as string) || undefined;
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': readCsrfToken() },
        body: JSON.stringify({ email, otpProof, password, displayName }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error === 'EMAIL_TAKEN' ? 'Email đã được đăng ký.' : 'Đăng ký thất bại.');
        return;
      }
      setAccessToken(json.accessToken);
      setDisplayName(json.customer?.displayName ?? displayName ?? null);
      setCustomerEmail(json.customer?.email ?? email);
      router.push(returnTo);
    } catch {
      setError('Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthSplitLayout audience="customer" title="Đăng ký" subtitle={STEP_SUBTITLE[step]}>
      <div className="flex flex-col gap-7">
          <StepDots current={STEP_INDEX[step]} />
          {/* AX-7: announce step advances to screen-readers (StepDots is aria-hidden). */}
          <p className="sr-only" aria-live="polite">
            {STEP_SUBTITLE[step]}
          </p>

          {step === 'email' && (
            <form onSubmit={handleSendOtp} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Địa chỉ email</Label>
                <Input
                  id="email"
                  type="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className={authFieldClass}
                />
              </div>
              <FormError message={error} />
              <Button type="submit" size="lg" disabled={loading} aria-busy={loading} className="h-12 w-full text-base">
                {loading ? 'Đang gửi...' : 'Gửi mã OTP'}
              </Button>
              <GoogleSignInButton returnTo={returnTo} />
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
              <p className="text-sm break-words text-muted-foreground">
                Nhập mã 6 chữ số đã gửi đến {email}
              </p>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="code">Mã OTP</Label>
                <OtpCodeInput id="code" required autoFocus className={authFieldClass} />
              </div>
              <FormError message={error} />
              <Button type="submit" size="lg" disabled={loading} aria-busy={loading} className="h-12 w-full text-base">
                {loading ? 'Đang xác minh...' : 'Xác minh'}
              </Button>
              <Button
                type="button"
                variant="link"
                size="sm"
                // AU-5: 44px tap floor. AU-7: fixed min-width + tabular-nums so the
                // countdown label doesn't jitter the button width each second.
                className="min-h-11 w-fit min-w-40 justify-center self-center tabular-nums text-primary-strong"
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
                <Input
                  id="password"
                  type="password"
                  name="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  autoFocus
                  className={authFieldClass}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="displayName">Tên hiển thị (tuỳ chọn)</Label>
                <Input id="displayName" type="text" name="displayName" autoComplete="name" className={authFieldClass} />
              </div>
              <FormError message={error} />
              <Button type="submit" size="lg" disabled={loading} aria-busy={loading} className="h-12 w-full text-base">
                {loading ? 'Đang đăng ký...' : 'Đăng ký'}
              </Button>
            </form>
          )}

          <p className="text-sm text-muted-foreground">
            Đã có tài khoản?{' '}
            <Link href="/auth/login" className={authLinkClass}>
              Đăng nhập
            </Link>
          </p>
      </div>
    </AuthSplitLayout>
  );
}
