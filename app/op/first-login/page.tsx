'use client';

/**
 * /op/first-login — Forced password change page for operators.
 * POSTs { currentPassword, newPassword } to /api/op/auth/password/change.
 * On success → redirects to /op/dashboard.
 *
 * Only reachable after login when requiresPasswordChange = true.
 * The change route uses requireOperatorAuth({ allowDuringPasswordChange: true }).
 * Shell-exempt: lives outside the (console) route group, so no operator sidebar.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { readCsrfToken } from '@/lib/auth/csrfClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function OpFirstLoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const currentPassword = fd.get('currentPassword') as string;
    const newPassword = fd.get('newPassword') as string;
    const confirmPassword = fd.get('confirmPassword') as string;

    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/op/auth/password/change', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': readCsrfToken(),
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (res.status === 204) {
        router.push('/op/dashboard');
        router.refresh();
        return;
      }

      const json = await res.json();
      if (json.error === 'WEAK_PASSWORD') {
        setError('Mật khẩu mới không đủ mạnh (tối thiểu 8 ký tự).');
      } else if (json.error === 'WRONG_CURRENT') {
        setError('Mật khẩu hiện tại không đúng.');
      } else if (json.error === 'SAME_AS_OLD') {
        setError('Mật khẩu mới phải khác mật khẩu cũ.');
      } else {
        setError('Đã xảy ra lỗi. Vui lòng thử lại.');
      }
    } catch {
      setError('Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center px-4 py-12">
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">Đổi mật khẩu lần đầu</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Bạn cần đặt mật khẩu mới trước khi tiếp tục.
      </p>
      <Card>
        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="op-current-password">Mật khẩu hiện tại</Label>
              <Input id="op-current-password" type="password" name="currentPassword" required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="op-new-password">Mật khẩu mới</Label>
              <Input
                id="op-new-password"
                type="password"
                name="newPassword"
                required
                minLength={8}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="op-confirm-password">Xác nhận mật khẩu mới</Label>
              <Input id="op-confirm-password" type="password" name="confirmPassword" required />
            </div>
            {error && (
              <Alert variant="error">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" disabled={loading}>
              {loading ? 'Đang lưu...' : 'Đổi mật khẩu'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
