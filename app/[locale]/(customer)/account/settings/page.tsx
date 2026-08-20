'use client';

/**
 * /account/settings — Issue 008
 *
 * Sections:
 *   AC4 — Change display name (PATCH /api/account/name)
 *   AC2 — Change password (POST /api/account/password)
 *   AC3 — Change phone: step 1 send OTP (POST /api/account/phone/init),
 *                        step 2 verify  (POST /api/account/phone/confirm)
 *   AC5 — Delete account (DELETE /api/account/delete)
 *
 * Bearer token from the shared client session store (set by login/register).
 * All state-changing calls go through authFetch (Bearer + CSRF + 401 retry).
 * No server-component self-fetch — purely client-side.
 */

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { authFetch, ensureAuthenticated, clearSession, setDisplayName } from '@/lib/auth/clientSession';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { OtpCodeInput } from '@/components/auth/OtpCodeInput';
import { FormError } from '@/components/auth/FormError';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

// ---- helpers ---------------------------------------------------------------

// A5/AX-4: status outcomes must be announced. Reuses the shared FormError live
// region (success = role=status/polite, error = role=alert/assertive) so the line
// also reserves height and the submit button doesn't shift when it appears/clears
// (review #10). One line per form, tone + message driven by the form status.
function FormStatus({
  status,
  okMessage,
  errMessage,
}: {
  status: 'idle' | 'ok' | 'err';
  okMessage?: string;
  errMessage: string;
}) {
  return (
    // key flips with the tone so a status→alert change mounts a FRESH node instead
    // of mutating role/aria-live in place (which isn't reliably announced by every
    // screen reader). Auth pages use a fixed tone, so they need no key.
    <FormError
      key={status === 'err' ? 'err' : 'ok'}
      tone={status === 'err' ? 'error' : 'success'}
      message={status === 'ok' ? okMessage : status === 'err' ? errMessage : ''}
    />
  );
}

// ---- sub-form: change display name -----------------------------------------

function ChangeNameForm() {
  const t = useTranslations('account');
  const [status, setStatus] = useState<'idle' | 'ok' | 'err'>('idle');
  const [errMsg, setErrMsg] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('idle');
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const displayName = fd.get('displayName') as string;
    try {
      const res = await authFetch('/api/account/name', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName }),
      });
      if (res.ok) {
        const okJson = await res.json().catch(() => ({}));
        setDisplayName((okJson as { displayName?: string }).displayName ?? displayName);
        setStatus('ok');
        return;
      }
      const json = await res.json().catch(() => ({}));
      const code = (json as { error?: string }).error ?? '';
      if (code === 'DISPLAY_NAME_TOO_SHORT') setErrMsg(t('name.tooShort'));
      else if (code === 'DISPLAY_NAME_TOO_LONG') setErrMsg(t('name.tooLong'));
      else if (res.status === 401) setErrMsg(t('common.sessionExpired'));
      else setErrMsg(t('common.genericError'));
      setStatus('err');
    } catch {
      setErrMsg(t('common.connError'));
      setStatus('err');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">{t('name.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="displayName">{t('name.newLabel')}</Label>
            <Input id="displayName" type="text" name="displayName" required minLength={4} maxLength={100} autoComplete="name" />
          </div>
          <FormStatus status={status} okMessage={t('name.ok')} errMessage={errMsg} />
          <Button type="submit" disabled={loading} className="self-start">
            {loading ? t('name.saving') : t('name.save')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ---- sub-form: change password ---------------------------------------------

function ChangePasswordForm() {
  const t = useTranslations('account');
  const [status, setStatus] = useState<'idle' | 'ok' | 'err'>('idle');
  const [errMsg, setErrMsg] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('idle');
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const currentPassword = fd.get('currentPassword') as string;
    const newPassword = fd.get('newPassword') as string;
    const confirmPassword = fd.get('confirmPassword') as string;

    if (newPassword !== confirmPassword) {
      setErrMsg(t('password.mismatch'));
      setStatus('err');
      setLoading(false);
      return;
    }

    try {
      const res = await authFetch('/api/account/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (res.ok) {
        setStatus('ok');
        return;
      }
      const json = await res.json().catch(() => ({}));
      const code = (json as { error?: string }).error ?? '';
      if (code === 'CURRENT_PASSWORD_WRONG') setErrMsg(t('password.wrongCurrent'));
      else if (code === 'PASSWORD_REUSED') setErrMsg(t('password.reused'));
      else if (res.status === 401) setErrMsg(t('common.sessionExpired'));
      else setErrMsg(t('common.genericError'));
      setStatus('err');
    } catch {
      setErrMsg(t('common.connError'));
      setStatus('err');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">{t('password.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="currentPassword">{t('password.current')}</Label>
            <Input id="currentPassword" type="password" name="currentPassword" required autoComplete="current-password" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="newPassword">{t('password.new')}</Label>
            <Input id="newPassword" type="password" name="newPassword" required minLength={8} autoComplete="new-password" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirmPassword">{t('password.confirm')}</Label>
            <Input id="confirmPassword" type="password" name="confirmPassword" required minLength={8} autoComplete="new-password" />
          </div>
          <FormStatus status={status} okMessage={t('password.ok')} errMessage={errMsg} />
          <Button type="submit" disabled={loading} className="self-start">
            {loading ? t('password.processing') : t('password.submit')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ---- sub-form: change phone -------------------------------------------------

function ChangePhoneForm() {
  const t = useTranslations('account');
  const [phoneStep, setPhoneStep] = useState<'init' | 'confirm'>('init');
  const [pendingPhone, setPendingPhone] = useState('');
  const [status, setStatus] = useState<'idle' | 'ok' | 'err'>('idle');
  const [errMsg, setErrMsg] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleInit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('idle');
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const newPhone = fd.get('newPhone') as string;
    try {
      const res = await authFetch('/api/account/phone/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPhone }),
      });
      if (res.ok) {
        setPendingPhone(newPhone);
        setPhoneStep('confirm');
        return;
      }
      const json = await res.json().catch(() => ({}));
      const code = (json as { error?: string }).error ?? '';
      if (code === 'LOCKED_OUT') setErrMsg(t('phone.lockedOut'));
      else if (code === 'RATE_LIMITED') setErrMsg(t('phone.rateLimited'));
      else if (res.status === 401) setErrMsg(t('common.sessionExpiredShort'));
      else setErrMsg(t('common.genericError'));
      setStatus('err');
    } catch {
      setErrMsg(t('common.connError'));
      setStatus('err');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('idle');
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const code = fd.get('code') as string;
    try {
      const res = await authFetch('/api/account/phone/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPhone: pendingPhone, code }),
      });
      if (res.ok) {
        setStatus('ok');
        setPhoneStep('init');
        return;
      }
      const json = await res.json().catch(() => ({}));
      const errCode = (json as { error?: string }).error ?? '';
      if (errCode === 'PHONE_TAKEN') setErrMsg(t('phone.phoneTaken'));
      else if (errCode === 'OTP_INVALID') setErrMsg(t('phone.otpInvalid'));
      else if (errCode === 'OTP_EXPIRED') setErrMsg(t('phone.otpExpired'));
      else if (errCode === 'OTP_LOCKED_OUT') setErrMsg(t('phone.otpLockedOut'));
      else if (res.status === 401) setErrMsg(t('common.sessionExpiredShort'));
      else setErrMsg(t('common.genericError'));
      setStatus('err');
    } catch {
      setErrMsg(t('common.connError'));
      setStatus('err');
    } finally {
      setLoading(false);
    }
  }

  if (phoneStep === 'confirm') {
    return (
      <Card>
        <CardHeader>
          <CardTitle as="h2">{t('phone.confirmTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">{t('phone.otpSentTo', { phone: pendingPhone })}</p>
          <form onSubmit={handleConfirm} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone-otp">{t('phone.otpLabel')}</Label>
              <OtpCodeInput id="phone-otp" required />
            </div>
            <FormStatus status={status} okMessage={t('phone.ok')} errMessage={errMsg} />
            <div className="flex gap-2">
              <Button type="submit" disabled={loading}>
                {loading ? t('phone.confirming') : t('phone.confirm')}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={() => {
                  setPhoneStep('init');
                  setStatus('idle');
                }}
              >
                {t('common.cancel')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">{t('phone.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleInit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="newPhone">{t('phone.newLabel')}</Label>
            <Input id="newPhone" type="tel" name="newPhone" required autoComplete="tel" placeholder={t('phone.newPlaceholder')} />
          </div>
          <FormStatus status={status} okMessage={t('phone.ok')} errMessage={errMsg} />
          <Button type="submit" disabled={loading} className="self-start">
            {loading ? t('phone.sendingOtp') : t('phone.sendOtp')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ---- sub-form: delete account -----------------------------------------------

function DeleteAccountForm() {
  const t = useTranslations('account');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<'idle' | 'err'>('idle');
  const [errMsg, setErrMsg] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setStatus('idle');
    setLoading(true);
    // Bound the DELETE with a generous timeout: the dialog is un-dismissable while
    // loading, so a stalled request must not trap the user forever — on abort the
    // catch runs, loading clears, and the guard releases so the dialog is closable +
    // the error shows. 30s (not a tight 10s) so a slow-but-committed deletion isn't
    // falsely reported as a connection error; and DELETE is idempotent, so if an
    // aborted request did commit server-side, a retry returns 200 and completes.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await authFetch('/api/account/delete', {
        method: 'DELETE',
        signal: controller.signal,
      });
      if (res.ok) {
        // Clear token + cached display name — account is gone
        clearSession();
        router.push('/');
        return;
      }
      if (res.status === 401) setErrMsg(t('common.sessionExpiredShort'));
      else setErrMsg(t('common.genericError'));
      setStatus('err');
    } catch {
      setErrMsg(t('common.connError'));
      setStatus('err');
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle as="h2" className="text-destructive">
          {t('delete.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          {t('delete.warning')}
        </p>
        {/* AC-1: the confirm lives in a focus-trapped modal, not an in-place swap
            a fast double-tap could hit. Esc/backdrop/Hủy all cancel. */}
        <Dialog
          open={open}
          onOpenChange={(next) => {
            // Don't let Esc/backdrop/X close the dialog while the DELETE is in
            // flight (review #3): otherwise a failed delete resolves into a closed
            // dialog and the error is never shown, so the user thinks it succeeded.
            if (loading) return;
            setOpen(next);
            if (!next) setStatus('idle');
          }}
        >
          <DialogTrigger
            render={(p) => (
              <Button {...p} type="button" variant="destructive" className="self-start">
                {t('delete.button')}
              </Button>
            )}
          />
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t('delete.dialogTitle')}</DialogTitle>
              <DialogDescription>
                {t('delete.dialogDesc')}
              </DialogDescription>
            </DialogHeader>
            <FormStatus status={status} errMessage={errMsg} />
            <DialogFooter>
              <DialogClose
                render={(p) => (
                  <Button {...p} type="button" variant="outline" disabled={loading}>
                    {t('common.cancel')}
                  </Button>
                )}
              />
              {/* AC-2: solid destructive — the strongest affordance for the
                  highest-risk, irreversible action (not the pale outline weight). */}
              <Button type="button" variant="destructiveSolid" onClick={handleDelete} disabled={loading}>
                {loading ? t('delete.deleting') : t('delete.confirmDelete')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// ---- page ------------------------------------------------------------------

export default function AccountSettingsPage() {
  const t = useTranslations('account');
  const router = useRouter();
  // Access token lives in client memory (lost on reload); a missing token
  // redirects to login with returnTo — mirrors /account/bookings. Without this
  // a logged-out visitor sees forms that all 401 on submit.
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    ensureAuthenticated().then((ok) => {
      if (ok) {
        setAuthed(true);
      } else {
        router.replace('/auth/login?returnTo=/account/settings');
      }
    });
  }, [router]);

  if (!authed) return null;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-10">
      <nav aria-label="breadcrumb" className="text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li><Link href="/" className="underline-offset-4 hover:text-foreground hover:underline">{t('page.breadcrumbHome')}</Link></li>
          <li aria-hidden="true">/</li>
          <li><Link href="/account/bookings" className="underline-offset-4 hover:text-foreground hover:underline">{t('page.breadcrumbBookings')}</Link></li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="font-medium text-foreground">{t('page.breadcrumbSettings')}</li>
        </ol>
      </nav>
      <h1 className="text-2xl font-bold">{t('page.title')}</h1>
      <ChangeNameForm />
      <ChangePasswordForm />
      <ChangePhoneForm />
      <DeleteAccountForm />
    </main>
  );
}
