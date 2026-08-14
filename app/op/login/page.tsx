'use client';

/**
 * /op/login — Operator login page (2-step when email OTP is required).
 *
 * Step 1: POST { scope: 'operator', username, password } to /api/auth/login.
 *   - If operator has no email: direct login (existing flow).
 *   - If operator has email: returns { otpRequired, loginChallenge, maskedEmail }.
 *
 * Step 2 (when OTP required): POST { loginChallenge, code } to /api/auth/login/verify-otp.
 *   - On success: issues session, redirects to dashboard.
 *
 * On requiresPasswordChange → redirects to /op/first-login.
 * Otherwise → redirects to /op/dashboard.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Eye, EyeOff, KeyRound, Lock, ShieldCheck, UserRound, Users } from 'lucide-react';
import { readCsrfToken } from '@/lib/auth/csrfClient';
import { AuthSplitLayout } from '@/components/auth/AuthSplitLayout';
import { OtpCodeInput } from '@/components/auth/OtpCodeInput';
import { Card } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

type Step = 'password' | 'otp';

export default function OpLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('password');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // OTP step state
  const [loginChallenge, setLoginChallenge] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return; // guard double-submit
    setError('');
    setShowPassword(false);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const username = fd.get('username') as string;
    const password = fd.get('password') as string;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': readCsrfToken(),
        },
        body: JSON.stringify({ scope: 'operator', username, password }),
      });

      if (!res.ok) {
        if (res.status === 429) {
          const json = await res.json().catch(() => ({}));
          const errCode = (json as { error?: string }).error ?? '';
          if (errCode === 'LOCKED_OUT') {
            setError('Tài khoản tạm khóa sau nhiều lần đăng nhập sai. Vui lòng thử lại sau 15 phút.');
          } else if (errCode === 'OTP_LOCKED_OUT') {
            setError('Quá nhiều lần nhập sai mã OTP. Vui lòng thử lại sau 15 phút.');
          } else {
            setError('Quá nhiều yêu cầu. Vui lòng thử lại sau.');
          }
        } else if (res.status >= 500) {
          // #454: a server error must NOT read as "wrong credentials" — the user retries in vain.
          setError('Hệ thống đang gặp sự cố. Vui lòng thử lại sau.');
        } else {
          // 400/401 → uniform credential message (no operator-existence enumeration).
          setError('Tên đăng nhập hoặc mật khẩu không đúng.');
        }
        return;
      }

      const json = await res.json();

      if (json.otpRequired) {
        setLoginChallenge(json.loginChallenge);
        setMaskedEmail(json.maskedEmail);
        setStep('otp');
        return;
      }

      if (json.requiresPasswordChange) {
        router.push('/op/first-login');
      } else {
        router.push('/op/dashboard');
      }
    } catch {
      setError('Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  async function handleOtpVerify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return; // guard double-submit
    setError('');
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const code = fd.get('code') as string;

    try {
      const res = await fetch('/api/auth/login/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': readCsrfToken(),
        },
        body: JSON.stringify({ loginChallenge, code }),
      });

      if (!res.ok) {
        if (res.status === 429) {
          setError('Quá nhiều lần nhập sai mã OTP. Vui lòng thử lại sau 15 phút.');
        } else if (res.status >= 500) {
          setError('Hệ thống đang gặp sự cố. Vui lòng thử lại sau.');
        } else if (res.status === 401) {
          // #454: the operator was disabled/removed BETWEEN password and OTP — the route
          // re-validates and returns 401. Don't show "wrong code"; send them back to re-login.
          setError('Tài khoản không khả dụng. Vui lòng đăng nhập lại.');
          setStep('password');
        } else {
          const json = await res.json().catch(() => ({}));
          const errCode = (json as { error?: string }).error ?? '';
          if (errCode === 'expired' || errCode === 'invalid_challenge') {
            setError('Mã xác thực đã hết hạn. Vui lòng đăng nhập lại.');
            setStep('password');
          } else {
            setError('Mã xác thực không đúng. Vui lòng thử lại.');
          }
        }
        return;
      }

      const json = await res.json();

      if (json.requiresPasswordChange) {
        router.push('/op/first-login');
      } else {
        router.push('/op/dashboard');
      }
    } catch {
      setError('Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthSplitLayout
      audience="operator"
      title="Đăng nhập quản trị"
      subtitle={
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden="true" />
          Dành cho quản trị viên và nhân viên nhà xe
        </span>
      }
    >
      <div className="flex flex-col gap-4">
        <Card className="gap-5 rounded-2xl p-8 shadow-e3">
          {step === 'password' && (
            <form onSubmit={handleLogin} method="post" className="grid gap-5">
              <div className="grid gap-1.5">
                <Label htmlFor="op-login-username">Mã quản trị / Tên đăng nhập</Label>
                <div className="relative">
                  <UserRound
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    id="op-login-username"
                    type="text"
                    name="username"
                    autoCapitalize="characters"
                    autoComplete="username"
                    required
                    disabled={loading}
                    aria-invalid={!!error}
                    aria-describedby={error ? 'op-login-error' : undefined}
                    placeholder="Ví dụ: PB-0001"
                    className="h-11 pl-10"
                  />
                </div>
                <p className="text-[13px] text-muted-foreground">Mã được cấp bởi hệ thống BBVN.</p>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="op-login-password">Mật khẩu</Label>
                <div className="relative">
                  <Lock
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    id="op-login-password"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    autoComplete="current-password"
                    required
                    disabled={loading}
                    aria-invalid={!!error}
                    aria-describedby={error ? 'op-login-error' : undefined}
                    placeholder="Nhập mật khẩu của bạn"
                    className="h-11 pl-10 pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    aria-pressed={showPassword}
                    // 44px tap target (WCAG 2.5.5) — was an icon-sized hit area; matches the
                    // customer login toggle (#456 a11y / #486 parity).
                    className="absolute right-0 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" aria-hidden="true" />
                    ) : (
                      <Eye className="size-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <a
                  className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                  href="/op/forgot-password"
                >
                  Quên mật khẩu?
                </a>
              </div>

              {error && (
                <Alert variant="error" id="op-login-error">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" size="lg" disabled={loading} aria-busy={loading} className="w-full">
                {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
                {!loading && <ArrowRight className="size-4" aria-hidden="true" />}
              </Button>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={handleOtpVerify} method="post" className="grid gap-5">
              <p className="text-sm text-muted-foreground">
                Mã xác thực đã được gửi đến <strong>{maskedEmail}</strong>. Vui lòng nhập mã 6 chữ số.
              </p>
              <div className="grid gap-1.5">
                <Label htmlFor="op-login-otp">Mã xác thực</Label>
                <div className="relative">
                  <KeyRound
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  {/* #453: reuse OtpCodeInput — strips non-digits + caps at 6 AFTER paste, so a
                      pasted "123 456" / "123-456" lands as "123456" instead of truncating to 6 raw
                      chars. (The old raw maxLength={6} dropped a digit on formatted pastes.) */}
                  <OtpCodeInput
                    id="op-login-otp"
                    autoFocus
                    required
                    placeholder="000000"
                    aria-invalid={!!error}
                    aria-describedby={error ? 'op-login-error' : undefined}
                    className="h-11 pl-10 tracking-[0.5em]"
                  />
                </div>
              </div>
              {error && (
                <Alert variant="error" id="op-login-error">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" size="lg" disabled={loading} aria-busy={loading} className="w-full">
                {loading ? 'Đang xác thực...' : 'Xác nhận'}
              </Button>
              <button
                type="button"
                className="text-sm text-muted-foreground underline underline-offset-4 hover:text-primary"
                onClick={() => {
                  setStep('password');
                  setError('');
                }}
              >
                ← Quay lại đăng nhập
              </button>
            </form>
          )}
        </Card>

        {/* Partner onboarding — a distinct card so business signup reads as a separate
            intent from operator authentication (not crowded inside the login card). */}
        <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/[0.06] p-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Users className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Chưa là đối tác BBVN?</p>
            <p className="text-[13px] text-muted-foreground">
              Đăng ký hợp tác để quản lý và phát triển doanh nghiệp cùng BBVN.
            </p>
          </div>
          <Link
            href="/op/register"
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'shrink-0 border-primary/40 text-primary hover:bg-primary/10 hover:text-primary'
            )}
          >
            Trở thành đối tác
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>

        {/* Security reassurance footnote — low emphasis. */}
        <p className="flex items-start gap-2 text-[13px] text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-medium text-foreground/80">Bảo mật thông tin.</span> Dữ liệu của bạn
            được mã hóa và bảo vệ.
          </span>
        </p>
      </div>
    </AuthSplitLayout>
  );
}
