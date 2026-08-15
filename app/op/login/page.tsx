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
import { useRouter } from 'next/navigation';
import { ArrowRight, KeyRound, ShieldCheck, UserRound, Building2 } from 'lucide-react';
import { readCsrfToken } from '@/lib/auth/csrfClient';
import { AuthSplitLayout } from '@/components/auth/AuthSplitLayout';
import { AuthPromoCard } from '@/components/auth/AuthPromoCard';
import { AuthSecurityFooter } from '@/components/auth/AuthSecurityFooter';
import { PasswordField } from '@/components/auth/PasswordField';
import { FormError } from '@/components/auth/FormError';
import { authLinkClass, authFieldClass } from '@/components/auth/authLinkClass';
import { OtpCodeInput } from '@/components/auth/OtpCodeInput';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type Step = 'password' | 'otp';

export default function OpLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('password');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // OTP step state
  const [loginChallenge, setLoginChallenge] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return; // guard double-submit
    setError('');
    setLoading(true); // #490 hide-on-submit handled by PasswordField revealResetKey={loading}
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
                    className={cn(authFieldClass, 'pl-10')}
                  />
                </div>
                <p className="text-[13px] text-muted-foreground">Mã được cấp bởi hệ thống BBVN.</p>
              </div>

              <PasswordField
                id="op-login-password"
                name="password"
                label="Mật khẩu"
                placeholder="Nhập mật khẩu của bạn"
                autoComplete="current-password"
                required
                disabled={loading}
                invalid={!!error}
                describedBy={error ? 'op-login-error' : undefined}
                revealResetKey={loading}
              />

              <div className="flex justify-end">
                <a className={cn(authLinkClass, 'text-sm')} href="/op/forgot-password">
                  Quên mật khẩu?
                </a>
              </div>

              <FormError id="op-login-error" message={error} />

              <Button
                type="submit"
                size="lg"
                disabled={loading}
                aria-busy={loading}
                className="h-12 w-full text-base"
              >
                {loading ? (
                  'Đang đăng nhập...'
                ) : (
                  <>
                    Đăng nhập
                    <ArrowRight data-icon="inline-end" aria-hidden="true" />
                  </>
                )}
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
                    className={cn(authFieldClass, 'pl-10 tracking-[0.5em]')}
                  />
                </div>
              </div>
              <FormError id="op-login-error" message={error} />
              <Button type="submit" size="lg" disabled={loading} aria-busy={loading} className="h-12 w-full text-base">
                {loading ? 'Đang xác thực...' : 'Xác nhận'}
              </Button>
              <button
                type="button"
                className={cn(authLinkClass, 'text-sm')}
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

        {/* Partner onboarding — the shared door card (was hand-rolled; now matches customer login). */}
        <AuthPromoCard
          icon={Building2}
          title="Chưa là đối tác BBVN?"
          body="Đăng ký hợp tác để quản lý và phát triển doanh nghiệp cùng BBVN."
          actionLabel="Trở thành đối tác"
          actionHref="/op/register"
        />

        <AuthSecurityFooter />
      </div>
    </AuthSplitLayout>
  );
}
