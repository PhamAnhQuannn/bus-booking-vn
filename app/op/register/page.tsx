'use client';

/**
 * /op/register — Self-serve operator registration (Issue 076).
 *
 * Public, pre-account page. POSTs { legalName, contactEmail, contactPhone,
 * password } to /api/op/register with the X-CSRF-Token header (the bb_csrf
 * cookie is issued by proxy.ts on this GET; readCsrfToken reads it). On success
 * → redirect to /op/register/confirmation?ref=<applicationRef>.
 *
 * Shell-exempt: lives directly under app/op/ (NOT the (console) route group), so
 * it renders WITHOUT the operator sidebar — mirrors /op/login. It is also listed
 * in proxy.ts OP_AUTH_FREE_PATHS so the operator session guard lets it through.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { readCsrfToken } from '@/lib/auth';
import { AuthSplitLayout } from '@/components/auth/AuthSplitLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function OpRegisterPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const legalName = fd.get('legalName') as string;
    const contactEmail = fd.get('contactEmail') as string;
    const contactPhone = fd.get('contactPhone') as string;
    const password = fd.get('password') as string;

    try {
      const res = await fetch('/api/op/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': readCsrfToken(),
        },
        body: JSON.stringify({ legalName, contactEmail, contactPhone, password }),
      });

      if (res.status === 201) {
        const json = await res.json();
        router.push(`/op/register/confirmation?ref=${encodeURIComponent(json.applicationRef)}`);
        return;
      }

      if (res.status === 409) {
        setError('Số điện thoại này đã được đăng ký. Vui lòng đăng nhập hoặc dùng số khác.');
      } else if (res.status === 429) {
        setError('Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.');
      } else if (res.status === 400) {
        setError('Thông tin chưa hợp lệ. Kiểm tra email, số điện thoại và mật khẩu (tối thiểu 8 ký tự).');
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
    <AuthSplitLayout
      audience="operator"
      title="Đăng ký nhà xe"
      subtitle="Tạo tài khoản nhà xe đối tác. Hồ sơ của bạn sẽ được xem xét trước khi vận hành."
    >
      <Card className="shadow-e3">
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="op-reg-name">Tên doanh nghiệp</Label>
              <Input
                id="op-reg-name"
                type="text"
                name="legalName"
                required
                placeholder="Công ty TNHH Vận tải ..."
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="op-reg-email">Email liên hệ</Label>
              <Input
                id="op-reg-email"
                type="email"
                name="contactEmail"
                required
                placeholder="lienhe@nhaxe.vn"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="op-reg-phone">Số điện thoại</Label>
              <Input
                id="op-reg-phone"
                type="tel"
                name="contactPhone"
                required
                placeholder="0901234567"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="op-reg-password">Mật khẩu</Label>
              <Input
                id="op-reg-password"
                type="password"
                name="password"
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
              {loading ? 'Đang gửi...' : 'Đăng ký'}
            </Button>
          </form>
          <p className="mt-4 text-sm">
            <a className="text-primary underline-offset-4 hover:underline" href="/op/login">
              Đã có tài khoản? Đăng nhập
            </a>
          </p>
        </CardContent>
      </Card>
    </AuthSplitLayout>
  );
}
