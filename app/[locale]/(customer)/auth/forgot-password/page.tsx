'use client';

/**
 * /auth/forgot-password — AC1 (Issue 008)
 *
 * Step 1: enter email → POST /api/auth/forgot-password (always 200, no-enum)
 * Step 2: enter OTP + new password → POST /api/auth/reset-password
 *
 * No CSRF token needed for forgot-password POST (pre-auth exemption in proxy.ts).
 * No CSRF token needed for reset-password POST (pre-auth exemption in proxy.ts).
 */

import { useState } from 'react';
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

type Step = 'email' | 'reset' | 'done';

export default function ForgotPasswordPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const RESET_EYEBROW = (
    <span className="inline-flex items-center gap-1.5">
      <ShieldCheck className="size-4" aria-hidden="true" />
      {t('reset.eyebrow')}
    </span>
  );
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [mismatch, setMismatch] = useState(false);
  const [loading, setLoading] = useState(false);

  // ---- Step 1: request OTP ---------------------------------------------------
  async function handleRequestOtp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const rawEmail = fd.get('email') as string;
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: rawEmail }),
      });
      const json = (await res.json().catch(() => ({}))) as { retryAfter?: number };
      if (json.retryAfter != null) {
        const secs = Math.ceil(json.retryAfter);
        setError(t('reset.retryAfter', { seconds: secs }));
        return;
      }
      setEmail(rawEmail);
      setStep('reset');
    } catch {
      setError(t('common.connError'));
    } finally {
      setLoading(false);
    }
  }

  // ---- Step 2: verify OTP + set new password --------------------------------
  async function handleReset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setMismatch(false);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
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
        const json = await verifyRes.json().catch(() => ({}));
        const errCode = (json as { error?: string }).error ?? '';
        if (errCode === 'OTP_INVALID' || errCode === 'OTP_EXPIRED') {
          setError(t('reset.otpInvalidExpired'));
        } else if (errCode === 'OTP_LOCKED_OUT') {
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
        setStep('done');
        return;
      }
      const json = await res.json().catch(() => ({}));
      const code_err = (json as { error?: string }).error ?? '';
      if (code_err === 'PASSWORD_REUSED') {
        setError(t('reset.passwordReused'));
      } else if (code_err === 'WEAK_PASSWORD') {
        setError(t('reset.weakPassword'));
      } else if (code_err === 'INVALID_PROOF') {
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

  if (step === 'done') {
    return (
      <AuthSplitLayout audience="customer" title={t('reset.doneTitle')}>
        <div className="flex flex-col gap-7">
            <p className="text-sm text-muted-foreground">{t('reset.doneBody')}</p>
            <Button size="lg" className="h-12 w-full text-base" onClick={() => router.push('/auth/login')}>
              {t('reset.login')}
            </Button>
        </div>
      </AuthSplitLayout>
    );
  }

  if (step === 'reset') {
    return (
      <AuthSplitLayout
        audience="customer"
        eyebrow={RESET_EYEBROW}
        title={t('reset.resetTitle')}
        subtitle={t('reset.resetSubtitle')}
      >
        <div className="flex flex-col gap-7">
            <form onSubmit={handleReset} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="code">{t('reset.otpLabel')}</Label>
                <OtpCodeInput id="code" required autoFocus className={authFieldClass} />
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
                describedBy={mismatch ? 'forgot-reset-error' : undefined}
                revealResetKey={loading}
              />
              <FormError id="forgot-reset-error" message={error} />
              <Button type="submit" size="lg" disabled={loading} aria-busy={loading} className="h-12 w-full text-base">
                {loading ? t('reset.processing') : t('reset.submitReset')}
              </Button>
            </form>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="min-h-11 w-fit justify-start self-start px-0 text-primary-strong"
              onClick={() => {
                setStep('email');
                setError('');
                setMismatch(false);
              }}
            >
              {t('reset.useAnotherEmail')}
            </Button>
            <AuthSecurityFooter />
        </div>
      </AuthSplitLayout>
    );
  }

  // step === 'email'
  return (
    <AuthSplitLayout
      audience="customer"
      eyebrow={RESET_EYEBROW}
      title={t('reset.forgotTitle')}
      subtitle={t('reset.forgotSubtitle')}
    >
      <div className="flex flex-col gap-7">
          <form onSubmit={handleRequestOtp} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">{t('common.emailLabel')}</Label>
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input id="email" type="email" name="email" required autoComplete="email" placeholder={t('common.emailPlaceholder')} className={cn(authFieldClass, 'pl-10')} />
              </div>
            </div>
            <FormError message={error} />
            <Button type="submit" size="lg" disabled={loading} aria-busy={loading} className="h-12 w-full text-base">
              {loading ? t('reset.sending') : t('reset.sendOtp')}
            </Button>
          </form>
          <Link href="/auth/login" className={`${authLinkClass} text-sm`}>
            {t('reset.backToLogin')}
          </Link>
          <AuthSecurityFooter />
      </div>
    </AuthSplitLayout>
  );
}
