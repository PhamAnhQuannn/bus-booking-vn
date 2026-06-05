/**
 * Client-side fetch wrappers for /api/op/bookings/**.
 *
 * GET list is a safe method — sends NO CSRF token (proxy.ts admits GET freely).
 *
 * Online-only (Issue 039): the cash-collect / call-outcome / picked-up /
 * escalation / manual-booking mutation wrappers were removed along with their
 * routes. Only the booking-queue LIST read remains.
 *
 * Used by the operator dashboard (app/op/(console)/dashboard/**).
 */

import type { BookingQueueRow } from '@/lib/booking';

export interface ListBookingsParams {
  busId?: string;
  serviceDate?: string;
  routeId?: string;
  contactStatus?: string;
  cursor?: string;
}

export interface ListBookingsResult {
  rows: BookingQueueRow[];
  nextCursor: string | null;
}

export async function listBookingsApi(
  params: ListBookingsParams = {}
): Promise<ListBookingsResult> {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v))
  );
  const url = `/api/op/bookings${qs.toString() ? '?' + qs.toString() : ''}`;
  const res = await fetch(url, { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`listBookings failed: ${res.status}`);
  return res.json();
}
