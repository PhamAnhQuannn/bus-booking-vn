'use client';

/**
 * /op/forgot-password — Operator password recovery.
 *
 * Step 1: enter phone → POST /api/op/auth/forgot-password (always 202, no-enum)
 * Step 2: enter OTP + new password → POST /api/op/auth/forgot-password/verify
 *         (→ otpProof) then POST /api/op/auth/forgot-password/reset
 * Step 3: success → /op/login
 *
 * CSRF: bb_csrf cookie is set by proxy.ts on the initial GET /op/forgot-password
 * page load. All POSTs include X-CSRF-Token via readCsrfToken().
 * Shell-exempt: lives outside the (console) route group, so no operator sidebar.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { readCsrfToken } from '@/lib/auth/csrfClient';
import { AuthSplitLayout } from '@/components/auth/AuthSplitLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';

type Step = 'phone' | 'reset' | 'done';

export default function OpForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // ---- Step 1: request OTP --------------------------------------------------
  async function handleRequestOtp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const rawPhone = fd.get('phone') as string;
    try {
      await fetch('/api/op/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': readCsrfToken() },
        body: JSON.stringify({ phone: rawPhone }),
      });
      // Always advance (no-enumeration: even non-existent phones appear ok)
      setPhone(rawPhone);
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
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const code = fd.get('code') as string;
    const newPassword = fd.get('newPassword') as string;
    const confirmPassword = fd.get('confirmPassword') as string;
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      setLoading(false);
      return;
    }
    try {
      // Step 2a: verify OTP code → short-lived op_pwd_reset proof
      const verifyRes = await fetch('/api/op/auth/forgot-password/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': readCsrfToken() },
        body: JSON.stringify({ phone, code }),
      });
      if (!verifyRes.ok) {
        const json = await verifyRes.json().catch(() => ({}));
        const errCode = (json as { error?: string }).error ?? '';
        if (errCode === 'INVALID_CODE' || errCode === 'EXPIRED') {
          setError('Mã OTP không hợp lệ hoặc đã hết hạn.');
        } else if (errCode === 'LOCKED_OUT') {
          setError('Tài khoản tạm khóa sau nhiều lần nhập sai. Vui lòng thử lại sau 15 phút.');
        } else {
          setError('Có lỗi xảy ra. Vui lòng thử lại.');
        }
        return;
      }
      const { otpProof } = (await verifyRes.json()) as { otpProof: string };

      // Step 2b: present the proof + new password to reset
      const res = await fetch('/api/op/auth/forgot-password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': readCsrfToken() },
        body: JSON.stringify({ otpProof, newPassword }),
      });
      if (res.status === 204 || res.ok) {
        setStep('done');
        return;
      }
      const json = await res.json().catch(() => ({}));
      const resetErr = (json as { error?: string }).error ?? '';
      if (resetErr === 'WEAK_PASSWORD') {
        setError('Mật khẩu mới quá yếu. Vui lòng chọn mật khẩu mạnh hơn.');
      } else if (resetErr === 'INVALID_PROOF') {
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
      <AuthSplitLayout audience="operator" title="Đặt lại mật khẩu thành công">
        <Card key={step} className="shadow-e3">
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">Mật khẩu của bạn đã được cập nhật.</p>
            <Button size="lg" className="w-full" onClick={() => router.push('/op/login')}>
              Đăng nhập
            </Button>
          </CardContent>
        </Card>
      </AuthSplitLayout>
    );
  }

  if (step === 'reset') {
    return (
      <AuthSplitLayout
        audience="operator"
        title="Đặt lại mật khẩu"
        subtitle="Nhập mã OTP đã gửi đến số điện thoại của bạn và mật khẩu mới."
      >
        <Card key={step} className="shadow-e3">
          <CardContent className="flex flex-col gap-4">
            <form onSubmit={handleReset} className="grid gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="op-fp-code">Mã OTP (6 chữ số)</Label>
                <Input
                  id="op-fp-code"
                  type="text"
                  name="code"
                  required
                  maxLength={6}
                  pattern="[0-9]{6}"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="op-fp-new">Mật khẩu mới</Label>
                <Input id="op-fp-new" type="password" name="newPassword" required minLength={8} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="op-fp-confirm">Xác nhận mật khẩu mới</Label>
                <Input
                  id="op-fp-confirm"
                  type="password"
                  name="confirmPassword"
                  required
                  minLength={8}
                />
              </div>
              {error && (
                <Alert variant="error">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" disabled={loading} aria-busy={loading} className="w-full">
                {loading ? 'Đang xử lý...' : 'Đặt lại mật khẩu'}
              </Button>
            </form>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="self-start px-0"
              onClick={() => {
                setStep('phone');
                setError('');
              }}
            >
              Dùng số điện thoại khác
            </Button>
          </CardContent>
        </Card>
      </AuthSplitLayout>
    );
  }

  // step === 'phone'
  return (
    <AuthSplitLayout
      audience="operator"
      title="Quên mật khẩu — Quản trị viên"
      subtitle="Nhập số điện thoại đăng nhập. Chúng tôi sẽ gửi mã OTP để đặt lại mật khẩu."
    >
      <Card key={step} className="shadow-e3">
        <CardContent className="flex flex-col gap-4">
          <form onSubmit={handleRequestOtp} className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="op-fp-phone">Số điện thoại</Label>
              <Input
                id="op-fp-phone"
                type="tel"
                name="phone"
                required
                placeholder="0901234567"
              />
            </div>
            {error && (
              <Alert variant="error">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" disabled={loading} aria-busy={loading} className="w-full">
              {loading ? 'Đang gửi...' : 'Gửi mã OTP'}
            </Button>
          </form>
          <p className="mt-1 text-sm">
            <a
              className="text-primary underline-offset-4 hover:underline"
              href="/op/login"
            >
              Quay lại đăng nhập
            </a>
          </p>
        </CardContent>
      </Card>
    </AuthSplitLayout>
  );
}
