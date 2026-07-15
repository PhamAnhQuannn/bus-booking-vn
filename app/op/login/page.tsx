'use client';

/**
 * /op/login — Operator login page (2-step when email OTP is required).
 *
 * Step 1: POST { scope: 'operator', username, password } to /api/auth/login.
 *   - If operator has no email: direct login (existing flow).
 *   - If operator has email: returns { otpRequired, loginChallenge, maskedEmail }.
 *
 * Step 2 (when OTP required): POST { loginChallenge, code } to /api/auth/login/verify-otp.
 *   - On success: issues session, redirects to dashboard.
 *
 * On requiresPasswordChange → redirects to /op/first-login.
 * Otherwise → redirects to /op/dashboard.
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

type Step = 'password' | 'otp';

export default function OpLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('password');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // OTP step state
  const [loginChallenge, setLoginChallenge] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const username = fd.get('username') as string;
    const password = fd.get('password') as string;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': readCsrfToken(),
        },
        body: JSON.stringify({ scope: 'operator', username, password }),
      });

      if (!res.ok) {
        if (res.status === 429) {
          const json = await res.json().catch(() => ({}));
          const errCode = (json as { error?: string }).error ?? '';
          if (errCode === 'LOCKED_OUT') {
            setError('Tài khoản tạm khóa sau nhiều lần đăng nhập sai. Vui lòng thử lại sau 15 phút.');
          } else if (errCode === 'OTP_LOCKED_OUT') {
            setError('Quá nhiều lần nhập sai mã OTP. Vui lòng thử lại sau 15 phút.');
          } else {
            setError('Quá nhiều yêu cầu. Vui lòng thử lại sau.');
          }
        } else {
          setError('Tên đăng nhập hoặc mật khẩu không đúng.');
        }
        return;
      }

      const json = await res.json();

      if (json.otpRequired) {
        setLoginChallenge(json.loginChallenge);
        setMaskedEmail(json.maskedEmail);
        setStep('otp');
        return;
      }

      if (json.requiresPasswordChange) {
        router.push('/op/first-login');
      } else {
        router.push('/op/dashboard');
      }
    } catch {
      setError('Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  async function handleOtpVerify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const code = fd.get('code') as string;

    try {
      const res = await fetch('/api/auth/login/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': readCsrfToken(),
        },
        body: JSON.stringify({ loginChallenge, code }),
      });

      if (!res.ok) {
        if (res.status === 429) {
          setError('Quá nhiều lần nhập sai mã OTP. Vui lòng thử lại sau 15 phút.');
        } else {
          const json = await res.json().catch(() => ({}));
          const errCode = (json as { error?: string }).error ?? '';
          if (errCode === 'expired' || errCode === 'invalid_challenge') {
            setError('Mã xác thực đã hết hạn. Vui lòng đăng nhập lại.');
            setStep('password');
          } else {
            setError('Mã xác thực không đúng. Vui lòng thử lại.');
          }
        }
        return;
      }

      const json = await res.json();

      if (json.requiresPasswordChange) {
        router.push('/op/first-login');
      } else {
        router.push('/op/dashboard');
      }
    } catch {
      setError('Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthSplitLayout audience="operator" title="Đăng nhập — Quản trị viên">
      <Card className="shadow-e3">
        <CardContent>
          {step === 'password' && (
            <form onSubmit={handleLogin} method="post" className="grid gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="op-login-username">Tên đăng nhập</Label>
                <Input
                  id="op-login-username"
                  type="text"
                  name="username"
                  autoCapitalize="characters"
                  autoComplete="username"
                  required
                  placeholder="VD: PB-0001"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="op-login-password">Mật khẩu</Label>
                <Input id="op-login-password" type="password" name="password" required />
              </div>
              {error && (
                <Alert variant="error">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" disabled={loading} aria-busy={loading} className="w-full">
                {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
              </Button>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={handleOtpVerify} method="post" className="grid gap-4">
              <p className="text-sm text-muted-foreground">
                Mã xác thực đã được gửi đến <strong>{maskedEmail}</strong>. Vui lòng nhập mã 6 chữ số.
              </p>
              <div className="grid gap-1.5">
                <Label htmlFor="op-login-otp">Mã xác thực</Label>
                <Input
                  id="op-login-otp"
                  type="text"
                  name="code"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  required
                  placeholder="000000"
                />
              </div>
              {error && (
                <Alert variant="error">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" disabled={loading} aria-busy={loading} className="w-full">
                {loading ? 'Đang xác thực...' : 'Xác nhận'}
              </Button>
              <button
                type="button"
                className="text-sm text-muted-foreground underline underline-offset-4 hover:text-primary"
                onClick={() => { setStep('password'); setError(''); }}
              >
                ← Quay lại đăng nhập
              </button>
            </form>
          )}

          <p className="mt-4 text-sm">
            <a className="text-primary underline-offset-4 hover:underline" href="/op/forgot-password">
              Quên mật khẩu?
            </a>
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Chưa có tài khoản?{' '}
            <a className="text-primary underline-offset-4 hover:underline" href="/op/register">
              Trở thành đối tác
            </a>
          </p>
        </CardContent>
      </Card>
    </AuthSplitLayout>
  );
}
