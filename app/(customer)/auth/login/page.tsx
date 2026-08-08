'use client';

/**
 * /auth/login — email + password → POST /api/auth/login → redirect
 */

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { setAccessToken, setDisplayName, setCustomerEmail } from '@/lib/auth/clientSession';
import { readCsrfToken } from '@/lib/auth/csrfClient';
import { safeReturnTo } from '@/lib/auth/safeReturnTo';
import { AuthSplitLayout } from '@/components/auth/AuthSplitLayout';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { FormError } from '@/components/auth/FormError';
import { authLinkClass, authFieldClass } from '@/components/auth/authLinkClass';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
    <AuthSplitLayout audience="customer" eyebrow="Chào mừng trở lại" title="Đăng nhập">
      {/* Two-tier spacing: within-zone tight, ~28px between zones. Zones read as
          credentials+CTA · alternate login (divider+Google) · account help · operator. */}
      <div className="flex flex-col gap-7">
        <form onSubmit={handleLogin} method="post" className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Địa chỉ email</Label>
            <Input id="email" type="email" name="email" required autoComplete="email" placeholder="you@example.com" className={authFieldClass} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Mật khẩu</Label>
            <Input id="password" type="password" name="password" required autoComplete="current-password" className={authFieldClass} />
          </div>
          {/* -my-2 pulls the CTA up toward the credentials: the reserved (no-shift)
              error line stays, but its empty-state void no longer detaches the button. */}
          <FormError message={error} className="-my-2" />
          <Button type="submit" size="lg" disabled={loading} aria-busy={loading} className="h-12 w-full text-base">
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </Button>
        </form>
        <GoogleSignInButton returnTo={returnTo} />
        <div className="flex flex-col gap-2 text-base">
          <Link href="/auth/forgot-password" className={authLinkClass}>
            Quên mật khẩu?
          </Link>
          <p className="text-muted-foreground">
            Chưa có tài khoản?{' '}
            <Link href="/auth/register" className={authLinkClass}>
              Đăng ký
            </Link>
          </p>
        </div>
        {/* Operator door — a rule (section break) + one tinted 44px link, not a boxed
            card: clearly a separate portal, but visually secondary (no double border). */}
        <div className="flex items-center justify-between gap-3 border-t border-border pt-5">
          <span className="text-sm text-muted-foreground">Bạn là nhà xe?</span>
          <Link
            href="/op/login"
            className="inline-flex h-11 items-center rounded-lg border border-primary/40 bg-primary/5 px-4 text-sm font-medium text-foreground outline-none transition-colors hover:bg-primary/10 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Đăng nhập nhà xe →
          </Link>
        </div>
      </div>
    </AuthSplitLayout>
  );
}
