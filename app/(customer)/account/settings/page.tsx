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
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
    <FormError
      tone={status === 'err' ? 'error' : 'success'}
      message={status === 'ok' ? okMessage : status === 'err' ? errMessage : ''}
    />
  );
}

// ---- sub-form: change display name -----------------------------------------

function ChangeNameForm() {
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
      if (code === 'DISPLAY_NAME_TOO_SHORT') setErrMsg('Tên hiển thị quá ngắn (tối thiểu 4 ký tự).');
      else if (code === 'DISPLAY_NAME_TOO_LONG') setErrMsg('Tên hiển thị quá dài (tối đa 100 ký tự).');
      else if (res.status === 401) setErrMsg('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
      else setErrMsg('Có lỗi xảy ra. Vui lòng thử lại.');
      setStatus('err');
    } catch {
      setErrMsg('Lỗi kết nối.');
      setStatus('err');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Tên hiển thị</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="displayName">Tên mới</Label>
            <Input id="displayName" type="text" name="displayName" required minLength={4} maxLength={100} autoComplete="name" />
          </div>
          <FormStatus status={status} okMessage="Đã cập nhật tên hiển thị." errMessage={errMsg} />
          <Button type="submit" disabled={loading} className="self-start">
            {loading ? 'Đang lưu...' : 'Lưu tên'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ---- sub-form: change password ---------------------------------------------

function ChangePasswordForm() {
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
      setErrMsg('Mật khẩu xác nhận không khớp.');
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
      if (code === 'CURRENT_PASSWORD_WRONG') setErrMsg('Mật khẩu hiện tại không đúng.');
      else if (code === 'PASSWORD_REUSED') setErrMsg('Mật khẩu mới không được trùng mật khẩu cũ.');
      else if (res.status === 401) setErrMsg('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
      else setErrMsg('Có lỗi xảy ra. Vui lòng thử lại.');
      setStatus('err');
    } catch {
      setErrMsg('Lỗi kết nối.');
      setStatus('err');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Đổi mật khẩu</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="currentPassword">Mật khẩu hiện tại</Label>
            <Input id="currentPassword" type="password" name="currentPassword" required autoComplete="current-password" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="newPassword">Mật khẩu mới</Label>
            <Input id="newPassword" type="password" name="newPassword" required minLength={8} autoComplete="new-password" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirmPassword">Xác nhận mật khẩu mới</Label>
            <Input id="confirmPassword" type="password" name="confirmPassword" required minLength={8} autoComplete="new-password" />
          </div>
          <FormStatus status={status} okMessage="Đã đổi mật khẩu. Vui lòng đăng nhập lại." errMessage={errMsg} />
          <Button type="submit" disabled={loading} className="self-start">
            {loading ? 'Đang xử lý...' : 'Đổi mật khẩu'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ---- sub-form: change phone -------------------------------------------------

function ChangePhoneForm() {
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
      if (code === 'LOCKED_OUT') setErrMsg('Số điện thoại tạm khóa. Vui lòng thử lại sau.');
      else if (code === 'RATE_LIMITED') setErrMsg('Gửi OTP quá nhiều. Vui lòng thử lại sau.');
      else if (res.status === 401) setErrMsg('Phiên đăng nhập hết hạn.');
      else setErrMsg('Có lỗi xảy ra. Vui lòng thử lại.');
      setStatus('err');
    } catch {
      setErrMsg('Lỗi kết nối.');
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
      if (errCode === 'PHONE_TAKEN') setErrMsg('Số điện thoại đã được đăng ký bởi tài khoản khác.');
      else if (errCode === 'OTP_INVALID') setErrMsg('Mã OTP không đúng.');
      else if (errCode === 'OTP_EXPIRED') setErrMsg('Mã OTP đã hết hạn.');
      else if (errCode === 'OTP_LOCKED_OUT') setErrMsg('Tài khoản tạm khóa sau nhiều lần nhập sai.');
      else if (res.status === 401) setErrMsg('Phiên đăng nhập hết hạn.');
      else setErrMsg('Có lỗi xảy ra. Vui lòng thử lại.');
      setStatus('err');
    } catch {
      setErrMsg('Lỗi kết nối.');
      setStatus('err');
    } finally {
      setLoading(false);
    }
  }

  if (phoneStep === 'confirm') {
    return (
      <Card>
        <CardHeader>
          <CardTitle as="h2">Xác nhận số điện thoại mới</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">Nhập mã OTP đã gửi đến {pendingPhone}.</p>
          <form onSubmit={handleConfirm} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone-otp">Mã OTP (6 chữ số)</Label>
              <OtpCodeInput id="phone-otp" required />
            </div>
            <FormStatus status={status} okMessage="Đã đổi số điện thoại thành công." errMessage={errMsg} />
            <div className="flex gap-2">
              <Button type="submit" disabled={loading}>
                {loading ? 'Đang xác nhận...' : 'Xác nhận'}
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
                Hủy
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
        <CardTitle as="h2">Đổi số điện thoại</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleInit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="newPhone">Số điện thoại mới</Label>
            <Input id="newPhone" type="tel" name="newPhone" required autoComplete="tel" placeholder="0901234567" />
          </div>
          <FormStatus status={status} okMessage="Đã đổi số điện thoại thành công." errMessage={errMsg} />
          <Button type="submit" disabled={loading} className="self-start">
            {loading ? 'Đang gửi OTP...' : 'Gửi mã OTP'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ---- sub-form: delete account -----------------------------------------------

function DeleteAccountForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<'idle' | 'err'>('idle');
  const [errMsg, setErrMsg] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setStatus('idle');
    setLoading(true);
    try {
      const res = await authFetch('/api/account/delete', {
        method: 'DELETE',
      });
      if (res.ok) {
        // Clear token + cached display name — account is gone
        clearSession();
        router.push('/');
        return;
      }
      if (res.status === 401) setErrMsg('Phiên đăng nhập hết hạn.');
      else setErrMsg('Có lỗi xảy ra. Vui lòng thử lại.');
      setStatus('err');
    } catch {
      setErrMsg('Lỗi kết nối.');
      setStatus('err');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle as="h2" className="text-destructive">
          Xóa tài khoản
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Thao tác này không thể hoàn tác. Tất cả dữ liệu cá nhân sẽ bị xóa.
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
                Xóa tài khoản
              </Button>
            )}
          />
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Xóa tài khoản?</DialogTitle>
              <DialogDescription>
                Thao tác này không thể hoàn tác. Tất cả dữ liệu cá nhân của bạn sẽ bị xóa vĩnh viễn.
              </DialogDescription>
            </DialogHeader>
            <FormStatus status={status} errMessage={errMsg} />
            <DialogFooter>
              <DialogClose
                render={(p) => (
                  <Button {...p} type="button" variant="outline" disabled={loading}>
                    Hủy
                  </Button>
                )}
              />
              {/* AC-2: solid destructive — the strongest affordance for the
                  highest-risk, irreversible action (not the pale outline weight). */}
              <Button type="button" variant="destructiveSolid" onClick={handleDelete} disabled={loading}>
                {loading ? 'Đang xóa...' : 'Xác nhận xóa'}
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
          <li><Link href="/" className="underline-offset-4 hover:text-foreground hover:underline">Trang chủ</Link></li>
          <li aria-hidden="true">/</li>
          <li><Link href="/account/bookings" className="underline-offset-4 hover:text-foreground hover:underline">Lịch sử đặt vé</Link></li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="font-medium text-foreground">Cài đặt</li>
        </ol>
      </nav>
      <h1 className="text-2xl font-bold">Cài đặt tài khoản</h1>
      <ChangeNameForm />
      <ChangePasswordForm />
      <ChangePhoneForm />
      <DeleteAccountForm />
    </main>
  );
}
