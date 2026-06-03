/**
 * Client-side fetch wrappers for /api/op/reports/**.
 *
 * Revenue is a GET-only report (rendered server-side; CSV downloaded via a plain
 * <a href> anchor) — no client wrapper needed for it here. Payout retry is the only
 * mutation, so it carries X-CSRF-Token via readCsrfToken() to pass proxy.ts's CSRF
 * double-submit gate. The payouts list GET sends no token (safe method).
 *
 * Used by operator UI (app/op/(console)/reports/payouts/**).
 */

import { readCsrfToken } from '@/lib/auth/csrfClient';
import type { PayoutReportRow } from '@/lib/ledger/getPayoutReport';

export async function listPayoutsApi(): Promise<{ rows: PayoutReportRow[] }> {
  const res = await fetch('/api/op/reports/payouts', { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`listPayouts failed: ${res.status}`);
  return res.json();
}

export async function retryPayoutApi(payoutId: string): Promise<{ ok: boolean }> {
  const res = await fetch(`/api/op/reports/payouts/${payoutId}/retry`, {
    method: 'POST',
    headers: { 'X-CSRF-Token': readCsrfToken() },
    credentials: 'same-origin',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw Object.assign(new Error('retryPayout failed'), { status: res.status, data });
  }
  return res.json();
}
