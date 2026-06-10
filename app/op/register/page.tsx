'use client';

/**
 * /op/register — public operator APPLICATION form (Issue 076; reworked 2026-06-06).
 *
 * Public, pre-account page. POSTs the application profile (brandName, legalName,
 * contactName, contactPhone, contactEmail, address, routesSummary) to
 * /api/op/register with the X-CSRF-Token header (the bb_csrf cookie is issued by
 * proxy.ts on this GET; readCsrfToken reads it). On success → redirect to
 * /op/register/confirmation?ref=<applicationRef>.
 *
 * 2026-06-06: NO password field. This only files an application — a platform admin
 * reviews it and provisions the login account (username + temp password, emailed).
 *
 * Shell-exempt: lives directly under app/op/ (NOT the (console) route group), so
 * it renders WITHOUT the operator sidebar — mirrors /op/login. It is also listed
 * in proxy.ts OP_AUTH_FREE_PATHS so the operator session guard lets it through.
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

export default function OpRegisterPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      brandName: fd.get('brandName') as string,
      legalName: fd.get('legalName') as string,
      contactName: fd.get('contactName') as string,
      contactPhone: fd.get('contactPhone') as string,
      contactEmail: fd.get('contactEmail') as string,
      address: fd.get('address') as string,
      routesSummary: fd.get('routesSummary') as string,
    };

    try {
      const res = await fetch('/api/op/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': readCsrfToken(),
        },
        body: JSON.stringify(payload),
      });

      if (res.status === 201) {
        const json = await res.json();
        router.push(`/op/register/confirmation?ref=${encodeURIComponent(json.applicationRef)}`);
        return;
      }

      if (res.status === 429) {
        setError('Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.');
      } else if (res.status === 400) {
        setError('Thông tin chưa hợp lệ. Vui lòng kiểm tra lại các trường, đặc biệt là email và số điện thoại.');
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
      title="Trở thành đối tác"
      subtitle="Gửi hồ sơ đăng ký nhà xe. Sau khi xét duyệt, chúng tôi sẽ tạo tài khoản và gửi thông tin đăng nhập qua email của bạn."
    >
      <Card className="shadow-e3">
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="op-reg-brand">Tên thương hiệu</Label>
              <Input
                id="op-reg-brand"
                type="text"
                name="brandName"
                required
                placeholder="VD: Phương Trang"
              />
            </div>
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
              <Label htmlFor="op-reg-contact">Người liên hệ</Label>
              <Input
                id="op-reg-contact"
                type="text"
                name="contactName"
                required
                placeholder="Họ và tên người liên hệ"
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
              <Label htmlFor="op-reg-address">Địa chỉ</Label>
              <Input
                id="op-reg-address"
                type="text"
                name="address"
                required
                placeholder="Số nhà, đường, quận/huyện, tỉnh/thành"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="op-reg-routes">Tuyến khai thác</Label>
              <Input
                id="op-reg-routes"
                type="text"
                name="routesSummary"
                required
                placeholder="VD: Hà Nội – Sài Gòn, Đà Nẵng – Huế"
              />
            </div>
            {error && (
              <Alert variant="error">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" disabled={loading} aria-busy={loading} className="w-full">
              {loading ? 'Đang gửi...' : 'Gửi hồ sơ'}
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
