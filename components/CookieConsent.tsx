'use client';

/**
 * PDPD (Decree 13/2023) cookie consent banner. Shown only when no preference
 * is stored yet. Two choices: "Đồng ý" (accept analytics) writes 'accepted';
 * "Chỉ thông tin cần thiết" (essential only) writes 'necessary'.
 *
 * The choice is stored twice: in localStorage (`bb_cookie_consent`, read
 * client-side by ConsentedAnalytics to gate Vercel Analytics) AND in a
 * `bb_consent` cookie so the server (proxy.ts) can read it — it mints the
 * `bb_sid` funnel session cookie only when consent === 'accepted', which in
 * turn gates the server-side FunnelEvent tracking. Analytics load iff the
 * stored value === 'accepted'; unset or 'necessary' means essential-only.
 */

import { useCallback, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

const CONSENT_KEY = 'bb_cookie_consent';
const CONSENT_COOKIE = 'bb_consent';
const CONSENT_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function subscribe(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange);
  return () => window.removeEventListener('storage', onStoreChange);
}

function getSnapshot() {
  return localStorage.getItem(CONSENT_KEY);
}

function getServerSnapshot() {
  return 'pending';
}

export function CookieConsent() {
  const consent = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const choose = useCallback((value: 'accepted' | 'necessary') => {
    localStorage.setItem(CONSENT_KEY, value);
    // Mirror to a cookie so the server (proxy.ts) can gate bb_sid/funnel on it.
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${CONSENT_COOKIE}=${value}; Max-Age=${CONSENT_MAX_AGE}; Path=/; SameSite=Lax${secure}`;
    window.dispatchEvent(new StorageEvent('storage', { key: CONSENT_KEY }));
  }, []);

  if (consent !== null) return null;

  return (
    <div
      role="region"
      aria-label="Thông báo về cookie"
      className="fixed inset-x-0 bottom-0 z-banner border-t border-border bg-background/95 px-4 py-4 shadow-e2 backdrop-blur supports-backdrop-filter:bg-background/80"
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <p className="text-sm text-muted-foreground">
          Chúng tôi dùng cookie thiết yếu để đăng nhập, giữ chỗ và bảo mật. Nhấn &quot;Đồng ý&quot; để bật
          thêm cookie phân tích giúp cải thiện trải nghiệm; chọn &quot;Chỉ thông tin cần thiết&quot; để dùng
          riêng cookie thiết yếu, không phân tích. Xem thêm tại{' '}
          <Link href="/privacy" className="font-medium text-primary underline underline-offset-4 hover:text-primary/90">
            Chính sách bảo mật
          </Link>
          .
        </p>
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
          <Button variant="outline" onClick={() => choose('necessary')} className="w-full sm:w-auto">
            Chỉ thông tin cần thiết
          </Button>
          <Button onClick={() => choose('accepted')} className="w-full sm:w-auto">
            Đồng ý
          </Button>
        </div>
      </div>
    </div>
  );
}
