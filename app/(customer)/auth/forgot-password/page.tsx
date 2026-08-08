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
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthSplitLayout } from '@/components/auth/AuthSplitLayout';
import { FormError } from '@/components/auth/FormError';
import { authLinkClass, authFieldClass } from '@/components/auth/authLinkClass';
import { OtpCodeInput } from '@/components/auth/OtpCodeInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Step = 'email' | 'reset' | 'done';

export default function ForgotPasswordPage() {
  const router = useRouter();
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
        setError(`Vui lòng thử lại sau ${secs} giây.`);
        return;
      }
      setEmail(rawEmail);
      setStep('reset');
    } catch {
      setError('Lỗi kết nối. Vui lòng thử lại.');
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
      setError('Mật khẩu xác nhận không khớp.');
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
          setError('Mã OTP không hợp lệ hoặc đã hết hạn.');
        } else if (errCode === 'OTP_LOCKED_OUT') {
          setError('Tài khoản tạm khóa sau nhiều lần nhập sai. Vui lòng thử lại sau 15 phút.');
        } else {
          setError('Có lỗi xảy ra. Vui lòng thử lại.');
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
        setError('Mật khẩu mới không được trùng mật khẩu cũ.');
      } else if (code_err === 'WEAK_PASSWORD') {
        setError('Mật khẩu mới quá yếu. Vui lòng chọn mật khẩu mạnh hơn.');
      } else if (code_err === 'INVALID_PROOF') {
        setError('Phiên xác thực đã hết hạn. Vui lòng yêu cầu mã OTP mới.');
      } else {
        setError('Có lỗi xảy ra. Vui lòng thử lại.');
      }
    } catch {
      setError('Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  if (step === 'done') {
    return (
      <AuthSplitLayout audience="customer" title="Đặt lại mật khẩu thành công">
        <div className="flex flex-col gap-6">
            <p className="text-sm text-muted-foreground">Mật khẩu của bạn đã được cập nhật.</p>
            <Button size="lg" className="h-12 w-full text-base" onClick={() => router.push('/auth/login')}>
              Đăng nhập
            </Button>
        </div>
      </AuthSplitLayout>
    );
  }

  if (step === 'reset') {
    return (
      <AuthSplitLayout
        audience="customer"
        title="Đặt lại mật khẩu"
        subtitle="Nhập mã OTP đã gửi đến email của bạn và mật khẩu mới."
      >
        <div className="flex flex-col gap-6">
            <form onSubmit={handleReset} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="code">Mã OTP (6 chữ số)</Label>
                <OtpCodeInput id="code" required autoFocus className={authFieldClass} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="newPassword">Mật khẩu mới</Label>
                <Input
                  id="newPassword"
                  type="password"
                  name="newPassword"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  aria-invalid={mismatch || undefined}
                  className={authFieldClass}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="confirmPassword">Xác nhận mật khẩu mới</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  name="confirmPassword"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  aria-invalid={mismatch || undefined}
                  aria-describedby={mismatch ? 'forgot-reset-error' : undefined}
                  className={authFieldClass}
                />
              </div>
              <FormError id="forgot-reset-error" message={error} />
              <Button type="submit" size="lg" disabled={loading} aria-busy={loading} className="h-12 w-full text-base">
                {loading ? 'Đang xử lý...' : 'Đặt lại mật khẩu'}
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
              Dùng email khác
            </Button>
        </div>
      </AuthSplitLayout>
    );
  }

  // step === 'email'
  return (
    <AuthSplitLayout
      audience="customer"
      title="Quên mật khẩu"
      subtitle="Nhập email đã đăng ký. Chúng tôi sẽ gửi mã OTP để đặt lại mật khẩu."
    >
      <div className="flex flex-col gap-6">
          <form onSubmit={handleRequestOtp} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Địa chỉ email</Label>
              <Input id="email" type="email" name="email" required autoComplete="email" placeholder="you@example.com" className={authFieldClass} />
            </div>
            <FormError message={error} />
            <Button type="submit" size="lg" disabled={loading} aria-busy={loading} className="h-12 w-full text-base">
              {loading ? 'Đang gửi...' : 'Gửi mã OTP'}
            </Button>
          </form>
          <Link href="/auth/login" className={`${authLinkClass} text-sm`}>
            Quay lại đăng nhập
          </Link>
      </div>
    </AuthSplitLayout>
  );
}
