'use client';

/**
 * Consent gate for Vercel Web Analytics. Renders <Analytics> only when the
 * visitor accepted analytics cookies (`bb_cookie_consent === 'accepted'`, set by
 * components/CookieConsent.tsx). Unset or 'necessary' → nothing loads, matching
 * the PDPD opt-in model. Reads the same localStorage key as the banner and
 * re-renders on change via the banner's `storage` event dispatch.
 */

import { useSyncExternalStore } from 'react';
import { Analytics } from '@vercel/analytics/next';

const CONSENT_KEY = 'bb_cookie_consent';

function subscribe(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange);
  return () => window.removeEventListener('storage', onStoreChange);
}

function getSnapshot() {
  return localStorage.getItem(CONSENT_KEY);
}

function getServerSnapshot(): string | null {
  return null;
}

export function ConsentedAnalytics() {
  const consent = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (consent !== 'accepted') return null;
  return <Analytics />;
}
