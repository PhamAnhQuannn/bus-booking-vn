'use client';

/**
 * /auth/login — email + password → POST /api/auth/login → redirect
 */

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ShieldCheck, Mail, ArrowRight, Users, Building2 } from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { setAccessToken, setDisplayName, setCustomerEmail, useAuthStatus } from '@/lib/auth/clientSession';
import { readCsrfToken } from '@/lib/auth/csrfClient';
import { safeReturnTo } from '@/lib/auth/safeReturnTo';
import { AuthSplitLayout } from '@/components/auth/AuthSplitLayout';
import { AuthPromoCard } from '@/components/auth/AuthPromoCard';
import { AuthSecurityFooter } from '@/components/auth/AuthSecurityFooter';
import { PasswordField } from '@/components/auth/PasswordField';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { FormError } from '@/components/auth/FormError';
import { authLinkClass, authFieldClass } from '@/components/auth/authLinkClass';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const t = useTranslations('auth');
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get('returnTo'));

  // FD-012 §2A.4: a Google callback failure redirects to /auth/login?error=google.
  const [error, setError] = useState(
    searchParams.get('error') === 'google' ? t('login.googleFailed') : ''
  );
  const [loading, setLoading] = useState(false);

  // #482: a signed-in customer landing here (bookmark, back-button, stale tab) is bounced to
  // returnTo instead of seeing the form again. `useAuthStatus` resolves 'unknown' → 'authed'/
  // 'guest' after the bootstrap refresh; only redirect once it is definitively 'authed'.
  const authStatus = useAuthStatus();
  useEffect(() => {
    if (authStatus === 'authed') router.replace(returnTo);
  }, [authStatus, router, returnTo]);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return; // #483: guard against a double-submit (Enter held / rapid clicks)
    setError('');
    setLoading(true); // #490 hide-on-submit is handled by PasswordField via revealResetKey={loading}
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
          setError(t('login.lockedOut'));
        } else if (res.status === 429 && json.error === 'RATE_LIMITED') {
          setError(t('login.rateLimited'));
        } else {
          setError(t('login.invalidCreds'));
        }
        return;
      }
      setAccessToken(json.accessToken);
      setDisplayName(json.customer?.displayName ?? null);
      setCustomerEmail(json.customer?.email ?? null);
      router.push(returnTo);
    } catch {
      setError(t('common.connError'));
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
          {t('login.eyebrow')}
        </span>
      }
      title={t('login.title')}
    >
      {/* Two-tier spacing: within-zone tight, ~28px between zones. Zones read as
          credentials+CTA · alternate login (divider+Google) · account help · security. */}
      <div className="flex flex-col gap-7">
        <form onSubmit={handleLogin} method="post" className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">{t('common.emailLabel')}</Label>
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
                placeholder={t('common.emailPlaceholder')}
                disabled={loading}
                aria-invalid={!!error}
                aria-describedby={error ? 'login-error' : undefined}
                className={cn(authFieldClass, 'pl-10')}
              />
            </div>
          </div>
          <PasswordField
            id="password"
            name="password"
            label={t('common.password')}
            autoComplete="current-password"
            required
            disabled={loading}
            invalid={!!error}
            describedBy={error ? 'login-error' : undefined}
            revealResetKey={loading}
          />
          <div className="flex items-center justify-end gap-3">
            <Link href="/auth/forgot-password" className={cn(authLinkClass, 'text-sm')}>
              {t('login.forgotPassword')}
            </Link>
          </div>
          {/* -my-2 pulls the CTA up toward the credentials: the reserved (no-shift)
              error line stays, but its empty-state void no longer detaches the button. */}
          <FormError message={error} id="login-error" className="-my-2" />
          <Button
            type="submit"
            size="lg"
            disabled={loading}
            aria-busy={loading}
            className="h-12 w-full text-base"
          >
            {loading ? (
              t('login.submitting')
            ) : (
              <>
                {t('login.submit')}
                <ArrowRight data-icon="inline-end" aria-hidden="true" />
              </>
            )}
          </Button>
        </form>
        <GoogleSignInButton returnTo={returnTo} />
        <div className="flex flex-col gap-3">
          <AuthPromoCard
            icon={Users}
            title={t('login.noAccountTitle')}
            body={t('login.noAccountBody')}
            actionLabel={t('login.registerNow')}
            actionHref="/auth/register"
          />
          {/* Operator door — now a symmetric tinted card matching the register card. */}
          <AuthPromoCard
            icon={Building2}
            title={t('login.operatorTitle')}
            body={t('login.operatorBody')}
            actionLabel={t('login.operatorLogin')}
            actionHref="/op/login"
          />
        </div>
        <AuthSecurityFooter />
      </div>
    </AuthSplitLayout>
  );
}
