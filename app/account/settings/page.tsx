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
import { getAccessToken, setAccessToken, setDisplayName } from '@/app/auth/register/page';
import { readCsrfToken } from '@/lib/auth/csrfClient';

// ---- helpers ---------------------------------------------------------------

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getAccessToken() ?? ''}`,
    'X-CSRF-Token': readCsrfToken(),
    ...extra,
  };
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
    <section style={{ marginBottom: 32 }}>
      <h2>Tên hiển thị</h2>
      <form onSubmit={handleSubmit}>
        <label>
          Tên mới
          <input
            type="text"
            name="displayName"
            required
            minLength={4}
            maxLength={100}
            style={{ display: 'block', width: '100%', marginTop: 4 }}
          />
        </label>
        {status === 'ok' && <p style={{ color: 'green' }}>Đã cập nhật tên hiển thị.</p>}
        {status === 'err' && <p style={{ color: 'red' }}>{errMsg}</p>}
        <button type="submit" disabled={loading} style={{ marginTop: 8 }}>
          {loading ? 'Đang lưu...' : 'Lưu tên'}
        </button>
      </form>
    </section>
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
    <section style={{ marginBottom: 32 }}>
      <h2>Đổi mật khẩu</h2>
      <form onSubmit={handleSubmit}>
        <label>
          Mật khẩu hiện tại
          <input
            type="password"
            name="currentPassword"
            required
            style={{ display: 'block', width: '100%', marginTop: 4 }}
          />
        </label>
        <label style={{ marginTop: 12, display: 'block' }}>
          Mật khẩu mới
          <input
            type="password"
            name="newPassword"
            required
            minLength={8}
            style={{ display: 'block', width: '100%', marginTop: 4 }}
          />
        </label>
        <label style={{ marginTop: 12, display: 'block' }}>
          Xác nhận mật khẩu mới
          <input
            type="password"
            name="confirmPassword"
            required
            minLength={8}
            style={{ display: 'block', width: '100%', marginTop: 4 }}
          />
        </label>
        {status === 'ok' && <p style={{ color: 'green' }}>Đã đổi mật khẩu. Vui lòng đăng nhập lại.</p>}
        {status === 'err' && <p style={{ color: 'red' }}>{errMsg}</p>}
        <button type="submit" disabled={loading} style={{ marginTop: 8 }}>
          {loading ? 'Đang xử lý...' : 'Đổi mật khẩu'}
        </button>
      </form>
    </section>
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
      <section style={{ marginBottom: 32 }}>
        <h2>Xác nhận số điện thoại mới</h2>
        <p>Nhập mã OTP đã gửi đến {pendingPhone}.</p>
        <form onSubmit={handleConfirm}>
          <label>
            Mã OTP (6 chữ số)
            <input
              type="text"
              name="code"
              required
              maxLength={6}
              pattern="[0-9]{6}"
              inputMode="numeric"
              autoComplete="one-time-code"
              style={{ display: 'block', width: '100%', marginTop: 4 }}
            />
          </label>
          {status === 'ok' && <p style={{ color: 'green' }}>Đã đổi số điện thoại thành công.</p>}
          {status === 'err' && <p style={{ color: 'red' }}>{errMsg}</p>}
          <button type="submit" disabled={loading} style={{ marginTop: 8 }}>
            {loading ? 'Đang xác nhận...' : 'Xác nhận'}
          </button>
          <button
            type="button"
            onClick={() => { setPhoneStep('init'); setStatus('idle'); }}
            style={{ marginLeft: 8 }}
          >
            Hủy
          </button>
        </form>
      </section>
    );
  }

  return (
    <section style={{ marginBottom: 32 }}>
      <h2>Đổi số điện thoại</h2>
      <form onSubmit={handleInit}>
        <label>
          Số điện thoại mới
          <input
            type="tel"
            name="newPhone"
            required
            placeholder="0901234567"
            style={{ display: 'block', width: '100%', marginTop: 4 }}
          />
        </label>
        {status === 'ok' && <p style={{ color: 'green' }}>Đã đổi số điện thoại thành công.</p>}
        {status === 'err' && <p style={{ color: 'red' }}>{errMsg}</p>}
        <button type="submit" disabled={loading} style={{ marginTop: 8 }}>
          {loading ? 'Đang gửi OTP...' : 'Gửi mã OTP'}
        </button>
      </form>
    </section>
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
    <section style={{ marginBottom: 32, borderTop: '1px solid #ccc', paddingTop: 24 }}>
      <h2 style={{ color: '#c00' }}>Xóa tài khoản</h2>
      <p>Thao tác này không thể hoàn tác. Tất cả dữ liệu cá nhân sẽ bị xóa.</p>
      {!confirmed ? (
        <button
          onClick={() => setConfirmed(true)}
          style={{ background: '#c00', color: '#fff', border: 'none', padding: '8px 16px', cursor: 'pointer' }}
        >
          Xóa tài khoản
        </button>
      ) : (
        <div>
          <p style={{ color: '#c00', fontWeight: 'bold' }}>Bạn có chắc chắn muốn xóa tài khoản?</p>
          {status === 'err' && <p style={{ color: 'red' }}>{errMsg}</p>}
          <button
            onClick={handleDelete}
            disabled={loading}
            style={{ background: '#c00', color: '#fff', border: 'none', padding: '8px 16px', cursor: 'pointer', marginRight: 8 }}
          >
            {loading ? 'Đang xóa...' : 'Xác nhận xóa'}
          </button>
          <button onClick={() => setConfirmed(false)} disabled={loading}>
            Hủy
          </button>
        </div>
      )}
    </section>
  );
}

// ---- page ------------------------------------------------------------------

export default function AccountSettingsPage() {
  return (
    <main style={{ maxWidth: 480, margin: '60px auto', padding: '0 16px' }}>
      <h1>Cài đặt tài khoản</h1>
      <ChangeNameForm />
      <ChangePasswordForm />
      <ChangePhoneForm />
      <DeleteAccountForm />
    </main>
  );
}
