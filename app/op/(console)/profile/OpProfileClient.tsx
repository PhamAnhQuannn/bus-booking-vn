'use client';

/**
 * OpProfileClient — client component for operator profile editing.
 * PATCHes /api/op/profile with contactPhone / notificationPhone / displayName.
 */

import { useState } from 'react';
import type { OperatorProfile } from '@/lib/op/getOperatorProfile';
import { readCsrfToken } from '@/lib/auth/csrfClient';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Props {
  profile: OperatorProfile;
}

export default function OpProfileClient({ profile }: Props) {
  const [displayName, setDisplayName] = useState(profile.displayName ?? '');
  const [contactPhone, setContactPhone] = useState(profile.contactPhone ?? '');
  const [notificationPhone, setNotificationPhone] = useState(profile.notificationPhone ?? '');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage('');
    setLoading(true);
    try {
      const res = await fetch('/api/op/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': readCsrfToken(),
        },
        body: JSON.stringify({ displayName, contactPhone, notificationPhone }),
      });

      if (res.status === 204) {
        setIsError(false);
        setMessage('Đã lưu hồ sơ.');
        return;
      }

      const json = await res.json();
      setIsError(true);
      if (json.error === 'PHONES_MUST_DIFFER') {
        setMessage('Số điện thoại liên hệ và thông báo phải khác nhau.');
      } else if (json.error === 'INVALID_PHONE') {
        setMessage('Số điện thoại không hợp lệ.');
      } else {
        setMessage('Đã xảy ra lỗi. Vui lòng thử lại.');
      }
    } catch {
      setIsError(true);
      setMessage('Lỗi kết nối.');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await fetch('/api/op/auth/logout', {
      method: 'POST',
      headers: { 'X-CSRF-Token': readCsrfToken() },
    });
    window.location.href = '/op/login';
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle as="h2">Thông tin tài khoản</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Số điện thoại đăng nhập</dt>
            <dd className="font-mono">{profile.phone}</dd>
            <dt className="text-muted-foreground">Vai trò</dt>
            <dd>{profile.role}</dd>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Chỉnh sửa hồ sơ</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="grid max-w-md gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="profile-display-name">Tên hiển thị</Label>
              <Input
                id="profile-display-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="profile-contact-phone">Số điện thoại liên hệ</Label>
              <Input
                id="profile-contact-phone"
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="profile-notification-phone">Số điện thoại thông báo</Label>
              <Input
                id="profile-notification-phone"
                type="tel"
                value={notificationPhone}
                onChange={(e) => setNotificationPhone(e.target.value)}
              />
            </div>
            {message && (
              <Alert variant={isError ? 'error' : 'success'}>
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            )}
            <div>
              <Button type="submit" disabled={loading}>
                {loading ? 'Đang lưu...' : 'Lưu hồ sơ'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div>
        <Button type="button" variant="destructive" onClick={handleLogout}>
          Đăng xuất
        </Button>
      </div>
    </div>
  );
}
