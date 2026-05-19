'use client';

/**
 * OpProfileClient — client component for operator profile editing.
 * PATCHes /api/op/profile with contactPhone / notificationPhone / displayName.
 */

import { useState } from 'react';
import type { OperatorProfile } from '@/lib/op/getOperatorProfile';

function getCsrf(): string {
  const match = document.cookie.match(/(?:^|;\s*)bb_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

interface Props {
  profile: OperatorProfile;
}

export default function OpProfileClient({ profile }: Props) {
  const [displayName, setDisplayName] = useState(profile.displayName ?? '');
  const [contactPhone, setContactPhone] = useState(profile.contactPhone ?? '');
  const [notificationPhone, setNotificationPhone] = useState(profile.notificationPhone ?? '');
  const [message, setMessage] = useState('');
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
          'X-CSRF-Token': getCsrf(),
        },
        body: JSON.stringify({ displayName, contactPhone, notificationPhone }),
      });

      if (res.status === 204) {
        setMessage('Đã lưu hồ sơ.');
        return;
      }

      const json = await res.json();
      if (json.error === 'PHONES_MUST_DIFFER') {
        setMessage('Số điện thoại liên hệ và thông báo phải khác nhau.');
      } else if (json.error === 'INVALID_PHONE') {
        setMessage('Số điện thoại không hợp lệ.');
      } else {
        setMessage('Đã xảy ra lỗi. Vui lòng thử lại.');
      }
    } catch {
      setMessage('Lỗi kết nối.');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await fetch('/api/op/auth/logout', {
      method: 'POST',
      headers: { 'X-CSRF-Token': getCsrf() },
    });
    window.location.href = '/op/login';
  }

  return (
    <div>
      <dl style={{ marginBottom: 24 }}>
        <dt>Số điện thoại đăng nhập</dt>
        <dd>{profile.phone}</dd>
        <dt>Vai trò</dt>
        <dd>{profile.role}</dd>
      </dl>

      <form onSubmit={handleSave}>
        <label style={{ display: 'block', marginBottom: 8 }}>
          Tên hiển thị
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: 4 }}
          />
        </label>
        <label style={{ display: 'block', marginBottom: 8 }}>
          Số điện thoại liên hệ
          <input
            type="tel"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: 4 }}
          />
        </label>
        <label style={{ display: 'block', marginBottom: 8 }}>
          Số điện thoại thông báo
          <input
            type="tel"
            value={notificationPhone}
            onChange={(e) => setNotificationPhone(e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: 4 }}
          />
        </label>
        {message && <p style={{ color: message.startsWith('Đã lưu') ? 'green' : 'red' }}>{message}</p>}
        <button type="submit" disabled={loading}>
          {loading ? 'Đang lưu...' : 'Lưu hồ sơ'}
        </button>
      </form>

      <hr style={{ margin: '24px 0' }} />
      <button onClick={handleLogout} style={{ color: 'red' }}>
        Đăng xuất
      </button>
    </div>
  );
}
