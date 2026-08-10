'use client';

/**
 * /auth/login — email + password → POST /api/auth/login → redirect
 */

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck, Mail, Lock, Eye, EyeOff, ArrowRight, Users, Building2 } from 'lucide-react';
import { setAccessToken, setDisplayName, setCustomerEmail } from '@/lib/auth/clientSession';
import { readCsrfToken } from '@/lib/auth/csrfClient';
import { safeReturnTo } from '@/lib/auth/safeReturnTo';
import { AuthSplitLayout } from '@/components/auth/AuthSplitLayout';
import { AuthPromoCard } from '@/components/auth/AuthPromoCard';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { FormError } from '@/components/auth/FormError';
import { authLinkClass, authFieldClass } from '@/components/auth/authLinkClass';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get('returnTo'));

  // FD-012 §2A.4: a Google callback failure redirects to /auth/login?error=google.
  const [error, setError] = useState(
    searchParams.get('error') === 'google' ? 'Đăng nhập Google thất bại. Thử lại.' : ''
  );
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const email = fd.get('email') as string;
    const password = fd.get('password') as string;
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': readCsrfToken() },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        // Surface throttle/lockout distinctly so a locked-out user knows to wait (QA F2);
        // everything else stays the uniform credential message (no account enumeration).
        if (res.status === 429 && json.error === 'LOCKED_OUT') {
          setError('Tài khoản tạm khóa sau nhiều lần đăng nhập sai. Vui lòng thử lại sau 15 phút.');
        } else if (res.status === 429 && json.error === 'RATE_LIMITED') {
          setError('Quá nhiều yêu cầu. Vui lòng thử lại sau ít phút.');
        } else {
          setError('Email hoặc mật khẩu không đúng.');
        }
        return;
      }
      setAccessToken(json.accessToken);
      setDisplayName(json.customer?.displayName ?? null);
      setCustomerEmail(json.customer?.email ?? null);
      router.push(returnTo);
    } catch {
      setError('Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthSplitLayout
      audience="customer"
      eyebrow={
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="size-4" aria-hidden="true" />
          Chào mừng trở lại!
        </span>
      }
      title="Đăng nhập"
    >
      {/* Two-tier spacing: within-zone tight, ~28px between zones. Zones read as
          credentials+CTA · alternate login (divider+Google) · account help · security. */}
      <div className="flex flex-col gap-7">
        <form onSubmit={handleLogin} method="post" className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Địa chỉ email</Label>
            <div className="relative">
              <Mail
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="email"
                type="email"
                name="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                className={cn(authFieldClass, 'pl-10')}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Mật khẩu</Label>
            <div className="relative">
              <Lock
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                required
                autoComplete="current-password"
                placeholder="Nhập mật khẩu"
                className={cn(authFieldClass, 'pl-10 pr-11')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                aria-pressed={showPassword}
                className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {showPassword ? (
                  <EyeOff className="size-4" aria-hidden="true" />
                ) : (
                  <Eye className="size-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            {/* Cosmetic-only this PR: /api/auth/login hardcodes a 30-day refresh cookie
                and has no `remember` field, so this does not yet change session lifetime.
                Follow-up issue tracks wiring real session-duration. */}
            <Label className="flex items-center gap-2 font-normal text-muted-foreground">
              <Checkbox name="remember" />
              Ghi nhớ đăng nhập
            </Label>
            <Link href="/auth/forgot-password" className={cn(authLinkClass, 'text-sm')}>
              Quên mật khẩu?
            </Link>
          </div>
          {/* -my-2 pulls the CTA up toward the credentials: the reserved (no-shift)
              error line stays, but its empty-state void no longer detaches the button. */}
          <FormError message={error} className="-my-2" />
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
        <GoogleSignInButton returnTo={returnTo} />
        <div className="flex flex-col gap-3">
          <AuthPromoCard
            icon={Users}
            title="Chưa có tài khoản?"
            body="Đăng ký để đặt vé nhanh chóng và nhận nhiều ưu đãi hấp dẫn."
            actionLabel="Đăng ký ngay"
            actionHref="/auth/register"
          />
          {/* Operator door — now a symmetric tinted card matching the register card. */}
          <AuthPromoCard
            icon={Building2}
            title="Bạn là nhà xe?"
            body="Đăng nhập để quản lý lịch chạy, đơn hàng và doanh thu."
            actionLabel="Đăng nhập nhà xe"
            actionHref="/op/login"
          />
        </div>
        <div className="flex items-start gap-2.5 text-sm text-muted-foreground">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold text-foreground">Bảo mật thông tin tuyệt đối</p>
            <p>Dữ liệu của bạn được mã hóa và bảo vệ theo tiêu chuẩn cao nhất.</p>
          </div>
        </div>
      </div>
    </AuthSplitLayout>
  );
}
