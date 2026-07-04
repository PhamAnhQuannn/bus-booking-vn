'use client';

/**
 * /auth/login — email + password → POST /api/auth/login → redirect
 */

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { setAccessToken, setDisplayName, setCustomerEmail } from '@/lib/auth/clientSession';
import { readCsrfToken } from '@/lib/auth/csrfClient';
import { safeReturnTo } from '@/lib/auth/safeReturnTo';
import { AuthSplitLayout } from '@/components/auth/AuthSplitLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get('returnTo'));

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const email = fd.get('email') as string;
    const password = fd.get('password') as string;
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': readCsrfToken() },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError('Email hoặc mật khẩu không đúng.');
        return;
      }
      setAccessToken(json.accessToken);
      setDisplayName(json.customer?.displayName ?? null);
      setCustomerEmail(json.customer?.email ?? null);
      router.push(returnTo);
    } catch {
      setError('Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthSplitLayout audience="customer" title="Đăng nhập">
      <Card className="shadow-e3">
        <CardContent className="flex flex-col gap-4">
          <form onSubmit={handleLogin} method="post" className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Địa chỉ email</Label>
              <Input id="email" type="email" name="email" required placeholder="you@example.com" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Mật khẩu</Label>
              <Input id="password" type="password" name="password" required />
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert" aria-live="assertive">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" disabled={loading} aria-busy={loading} className="w-full">
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </Button>
          </form>
          <div className="flex flex-col gap-1 text-sm">
            <Link
              href="/auth/forgot-password"
              className="text-primary underline-offset-4 hover:underline"
            >
              Quên mật khẩu?
            </Link>
            <p className="text-muted-foreground">
              Chưa có tài khoản?{' '}
              <Link
                href="/auth/register"
                className="text-primary underline-offset-4 hover:underline"
              >
                Đăng ký
              </Link>
            </p>
          </div>
          <div className="mt-1 border-t border-border pt-4 text-sm text-muted-foreground">
            Bạn là nhà xe?{' '}
            <Link
              href="/op/login"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Đăng nhập nhà xe
            </Link>
          </div>
        </CardContent>
      </Card>
    </AuthSplitLayout>
  );
}
