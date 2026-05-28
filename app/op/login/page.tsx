'use client';

/**
 * /op/login — Operator login page.
 * POSTs { scope: 'operator', phone, password } to /api/auth/login.
 * On requiresPasswordChange → redirects to /op/first-login.
 * Otherwise → redirects to /op/dashboard.
 *
 * CSRF: CSRF_EXEMPT_PREFIXES does NOT cover /api/auth/login — must send X-CSRF-Token.
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

export default function OpLoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const phone = fd.get('phone') as string;
    const password = fd.get('password') as string;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': readCsrfToken(),
        },
        body: JSON.stringify({ scope: 'operator', phone, password }),
      });

      if (!res.ok) {
        setError('Số điện thoại hoặc mật khẩu không đúng.');
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
          <form onSubmit={handleLogin} className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="op-login-phone">Số điện thoại</Label>
              <Input
                id="op-login-phone"
                type="tel"
                name="phone"
                required
                placeholder="0901234567"
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
          <p className="mt-4 text-sm">
            <a className="text-primary underline-offset-4 hover:underline" href="/op/forgot-password">
              Quên mật khẩu?
            </a>
          </p>
        </CardContent>
      </Card>
    </AuthSplitLayout>
  );
}
