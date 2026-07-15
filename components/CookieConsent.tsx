'use client';

/**
 * PDPD (Decree 13/2023) cookie consent banner. Shown only when no preference
 * is stored yet. Preference is read by analytics-loading code via
 * `localStorage.getItem('bb_cookie_consent') === 'accepted'` — this component
 * only writes the preference and dismisses itself.
 */

import { useCallback, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

const CONSENT_KEY = 'bb_cookie_consent';

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

  const choose = useCallback((value: 'accepted' | 'rejected') => {
    localStorage.setItem(CONSENT_KEY, value);
    window.dispatchEvent(new StorageEvent('storage', { key: CONSENT_KEY }));
  }, []);

  if (consent !== null) return null;

  return (
    <div
      role="region"
      aria-label="Thông báo về cookie"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 px-4 py-4 shadow-e2 backdrop-blur supports-backdrop-filter:bg-background/80"
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <p className="text-sm text-muted-foreground">
          Chúng tôi sử dụng cookie để phân tích và cải thiện trải nghiệm sử dụng. Bằng cách nhấn &quot;Chấp
          nhận&quot;, bạn đồng ý với việc sử dụng cookie phân tích. Xem thêm tại{' '}
          <Link href="/privacy" className="font-medium text-primary underline underline-offset-4 hover:text-primary/90">
            Chính sách bảo mật
          </Link>
          .
        </p>
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
          <Button variant="outline" onClick={() => choose('rejected')} className="w-full sm:w-auto">
            Từ chối
          </Button>
          <Button onClick={() => choose('accepted')} className="w-full sm:w-auto">
            Chấp nhận
          </Button>
        </div>
      </div>
    </div>
  );
}
