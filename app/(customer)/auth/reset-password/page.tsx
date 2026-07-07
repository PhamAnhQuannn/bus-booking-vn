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
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AuthSplitLayout } from '@/components/auth/AuthSplitLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordPageInner />
    </Suspense>
  );
}

function ResetPasswordPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillEmail = searchParams.get('email') ?? '';

  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const email = fd.get('email') as string;
    const code = fd.get('code') as string;
    const newPassword = fd.get('newPassword') as string;
    const confirmPassword = fd.get('confirmPassword') as string;

    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
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
          setError('Mã OTP không hợp lệ hoặc đã hết hạn.');
        } else if (vErr === 'OTP_LOCKED_OUT') {
          setError('Tài khoản tạm khóa. Vui lòng thử lại sau 15 phút.');
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
        setDone(true);
        return;
      }

      const json = await res.json().catch(() => ({}));
      const errCode = (json as { error?: string }).error ?? '';
      if (errCode === 'PASSWORD_REUSED') {
        setError('Mật khẩu mới không được trùng mật khẩu cũ.');
      } else if (errCode === 'WEAK_PASSWORD') {
        setError('Mật khẩu mới quá yếu. Vui lòng chọn mật khẩu mạnh hơn.');
      } else if (errCode === 'INVALID_PROOF') {
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

  if (done) {
    return (
      <AuthSplitLayout audience="customer" title="Thành công">
        <Card className="shadow-e3">
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">Mật khẩu của bạn đã được cập nhật.</p>
            <Button size="lg" className="w-full" onClick={() => router.push('/auth/login')}>
              Đăng nhập
            </Button>
          </CardContent>
        </Card>
      </AuthSplitLayout>
    );
  }

  return (
    <AuthSplitLayout audience="customer" title="Đặt lại mật khẩu">
      <Card className="shadow-e3">
        <CardContent className="flex flex-col gap-4">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Địa chỉ email</Label>
              <Input
                id="email"
                type="email"
                name="email"
                required
                defaultValue={prefillEmail}
                placeholder="you@example.com"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="code">Mã OTP (6 chữ số)</Label>
              <Input
                id="code"
                type="text"
                name="code"
                required
                maxLength={6}
                pattern="[0-9]{6}"
                inputMode="numeric"
                autoComplete="one-time-code"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="newPassword">Mật khẩu mới</Label>
              <Input id="newPassword" type="password" name="newPassword" required minLength={8} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirmPassword">Xác nhận mật khẩu mới</Label>
              <Input id="confirmPassword" type="password" name="confirmPassword" required minLength={8} />
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert" aria-live="assertive">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" disabled={loading} aria-busy={loading} className="w-full">
              {loading ? 'Đang xử lý...' : 'Đặt lại mật khẩu'}
            </Button>
          </form>
          <div className="flex flex-col gap-1 text-sm">
            <Link
              href="/auth/forgot-password"
              className="text-primary underline-offset-4 hover:underline"
            >
              Yêu cầu mã OTP mới
            </Link>
            <Link href="/auth/login" className="text-primary underline-offset-4 hover:underline">
              Đăng nhập
            </Link>
          </div>
        </CardContent>
      </Card>
    </AuthSplitLayout>
  );
}
