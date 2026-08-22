'use client';

/**
 * /auth/reset-password — AC1 (Issue 008)
 *
 * Alternative direct URL for password reset (same logic as the reset step in
 * /auth/forgot-password). Accepts `?email=...` query param pre-filled from
 * the forgot-password flow, or the user can enter it manually.
 *
 * No CSRF required — /api/auth/reset-password is pre-auth exempted in proxy.ts.
 */

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { ShieldCheck, Mail } from 'lucide-react';
import { AuthSplitLayout } from '@/components/auth/AuthSplitLayout';
import { AuthSecurityFooter } from '@/components/auth/AuthSecurityFooter';
import { PasswordField } from '@/components/auth/PasswordField';
import { FormError } from '@/components/auth/FormError';
import { authLinkClass, authFieldClass } from '@/components/auth/authLinkClass';
import { OtpCodeInput } from '@/components/auth/OtpCodeInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordPageInner />
    </Suspense>
  );
}

function ResetPasswordPageInner() {
  const t = useTranslations('auth');
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillEmail = searchParams.get('email') ?? '';
  const RESET_EYEBROW = (
    <span className="inline-flex items-center gap-1.5">
      <ShieldCheck className="size-4" aria-hidden="true" />
      {t('reset.eyebrow')}
    </span>
  );

  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [mismatch, setMismatch] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setMismatch(false);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const email = fd.get('email') as string;
    const code = fd.get('code') as string;
    const newPassword = fd.get('newPassword') as string;
    const confirmPassword = fd.get('confirmPassword') as string;

    if (newPassword !== confirmPassword) {
      setError(t('reset.mismatch'));
      setMismatch(true);
      setLoading(false);
      return;
    }

    try {
      const verifyRes = await fetch('/api/auth/forgot-password/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      if (!verifyRes.ok) {
        const vjson = await verifyRes.json().catch(() => ({}));
        const vErr = (vjson as { error?: string }).error ?? '';
        if (vErr === 'OTP_INVALID' || vErr === 'OTP_EXPIRED') {
          setError(t('reset.otpInvalidExpired'));
        } else if (vErr === 'OTP_LOCKED_OUT') {
          setError(t('reset.otpLockedOut'));
        } else {
          setError(t('reset.genericError'));
        }
        return;
      }
      const { otpProof } = (await verifyRes.json()) as { otpProof: string };

      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otpProof, newPassword }),
      });

      if (res.status === 204 || res.ok) {
        setDone(true);
        return;
      }

      const json = await res.json().catch(() => ({}));
      const errCode = (json as { error?: string }).error ?? '';
      if (errCode === 'PASSWORD_REUSED') {
        setError(t('reset.passwordReused'));
      } else if (errCode === 'WEAK_PASSWORD') {
        setError(t('reset.weakPassword'));
      } else if (errCode === 'INVALID_PROOF') {
        setError(t('reset.invalidProof'));
      } else {
        setError(t('reset.genericError'));
      }
    } catch {
      setError(t('common.connError'));
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <AuthSplitLayout audience="customer" title={t('reset.doneTitleShort')}>
        <div className="flex flex-col gap-7">
            <p className="text-sm text-muted-foreground">{t('reset.doneBody')}</p>
            <Button size="lg" className="h-12 w-full text-base" onClick={() => router.push('/auth/login')}>
              {t('reset.login')}
            </Button>
        </div>
      </AuthSplitLayout>
    );
  }

  return (
    <AuthSplitLayout audience="customer" eyebrow={RESET_EYEBROW} title={t('reset.resetTitle')}>
      <div className="flex flex-col gap-7">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
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
                  defaultValue={prefillEmail}
                  placeholder={t('common.emailPlaceholder')}
                  className={cn(authFieldClass, 'pl-10')}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="code">{t('reset.otpLabel')}</Label>
              <OtpCodeInput id="code" required className={authFieldClass} />
            </div>
            <PasswordField
              id="newPassword"
              name="newPassword"
              label={t('reset.newPassword')}
              autoComplete="new-password"
              required
              minLength={8}
              invalid={mismatch}
              revealResetKey={loading}
            />
            <PasswordField
              id="confirmPassword"
              name="confirmPassword"
              label={t('reset.confirmPassword')}
              autoComplete="new-password"
              required
              minLength={8}
              invalid={mismatch}
              describedBy={mismatch ? 'reset-error' : undefined}
              revealResetKey={loading}
            />
            <FormError id="reset-error" message={error} />
            <Button type="submit" size="lg" disabled={loading} aria-busy={loading} className="h-12 w-full text-base">
              {loading ? t('reset.processing') : t('reset.submitReset')}
            </Button>
          </form>
          <div className="flex flex-col gap-1 text-sm">
            <Link href="/auth/forgot-password" className={authLinkClass}>
              {t('reset.requestNewOtp')}
            </Link>
            <Link href="/auth/login" className={authLinkClass}>
              {t('reset.login')}
            </Link>
          </div>
          <AuthSecurityFooter />
      </div>
    </AuthSplitLayout>
  );
}
