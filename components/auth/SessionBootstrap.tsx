'use client';

import { useEffect } from 'react';
import { ensureAuthenticated } from '@/lib/auth/clientSession';

/**
 * Restores the in-memory customer session once per full page load (QA-H1).
 *
 * The customer access token lives only in memory (clientSession) and is null after a
 * hard reload / new tab until something triggers a refresh. Without this, a signed-in
 * customer sees the guest "Đăng nhập" header everywhere except the /account/* pages
 * (which already call ensureAuthenticated). Mounting this once in the root layout makes
 * `useIsSignedIn()` resolve to the true state shortly after first paint on every route.
 *
 * ensureAuthenticated() POSTs /api/auth/refresh (bb_rt HttpOnly cookie); for a guest
 * (no cookie) it 401s fast and clears session — harmless. Renders nothing.
 */
export function SessionBootstrap() {
  useEffect(() => {
    void ensureAuthenticated();
  }, []);
  return null;
}
