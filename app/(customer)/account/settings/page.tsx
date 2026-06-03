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
 * Bearer token from in-memory store (set by login/register).
 * All state-changing calls include X-CSRF-Token (proxy.ts enforcement).
 * No server-component self-fetch — purely client-side.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAccessToken, setAccessToken, setDisplayName } from '@/app/(customer)/auth/register/page';
import { readCsrfToken } from '@/lib/auth/csrfClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// ---- helpers ---------------------------------------------------------------

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getAccessToken() ?? ''}`,
    'X-CSRF-Token': readCsrfToken(),
    ...extra,
  };
}

function OkText({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-success-foreground">{children}</p>;
}
function ErrText({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-destructive">{children}</p>;
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
      const res = await fetch('/api/account/name', {
        method: 'PATCH',
        headers: authHeaders(),
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
            <Input id="displayName" type="text" name="displayName" required minLength={4} maxLength={100} />
          </div>
          {status === 'ok' && <OkText>Đã cập nhật tên hiển thị.</OkText>}
          {status === 'err' && <ErrText>{errMsg}</ErrText>}
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
      const res = await fetch('/api/account/password', {
        method: 'POST',
        headers: authHeaders(),
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
            <Input id="currentPassword" type="password" name="currentPassword" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="newPassword">Mật khẩu mới</Label>
            <Input id="newPassword" type="password" name="newPassword" required minLength={8} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirmPassword">Xác nhận mật khẩu mới</Label>
            <Input id="confirmPassword" type="password" name="confirmPassword" required minLength={8} />
          </div>
          {status === 'ok' && <OkText>Đã đổi mật khẩu. Vui lòng đăng nhập lại.</OkText>}
          {status === 'err' && <ErrText>{errMsg}</ErrText>}
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
      const res = await fetch('/api/account/phone/init', {
        method: 'POST',
        headers: authHeaders(),
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
      const res = await fetch('/api/account/phone/confirm', {
        method: 'POST',
        headers: authHeaders(),
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
              <Input
                id="phone-otp"
                type="text"
                name="code"
                required
                maxLength={6}
                pattern="[0-9]{6}"
                inputMode="numeric"
                autoComplete="one-time-code"
              />
            </div>
            {status === 'ok' && <OkText>Đã đổi số điện thoại thành công.</OkText>}
            {status === 'err' && <ErrText>{errMsg}</ErrText>}
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
            <Input id="newPhone" type="tel" name="newPhone" required placeholder="0901234567" />
          </div>
          {status === 'ok' && <OkText>Đã đổi số điện thoại thành công.</OkText>}
          {status === 'err' && <ErrText>{errMsg}</ErrText>}
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
  const [confirmed, setConfirmed] = useState(false);
  const [status, setStatus] = useState<'idle' | 'err'>('idle');
  const [errMsg, setErrMsg] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setStatus('idle');
    setLoading(true);
    try {
      const res = await fetch('/api/account/delete', {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (res.ok) {
        // Clear token + cached display name — account is gone
        setAccessToken(null);
        setDisplayName(null);
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
        {!confirmed ? (
          <Button variant="destructive" className="self-start" onClick={() => setConfirmed(true)}>
            Xóa tài khoản
          </Button>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold text-destructive">
              Bạn có chắc chắn muốn xóa tài khoản?
            </p>
            {status === 'err' && <ErrText>{errMsg}</ErrText>}
            <div className="flex gap-2">
              <Button variant="destructive" disabled={loading} onClick={handleDelete}>
                {loading ? 'Đang xóa...' : 'Xác nhận xóa'}
              </Button>
              <Button variant="outline" disabled={loading} onClick={() => setConfirmed(false)}>
                Hủy
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---- page ------------------------------------------------------------------

export default function AccountSettingsPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-bold">Cài đặt tài khoản</h1>
      <ChangeNameForm />
      <ChangePasswordForm />
      <ChangePhoneForm />
      <DeleteAccountForm />
    </main>
  );
}
