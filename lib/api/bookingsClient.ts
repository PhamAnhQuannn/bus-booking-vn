/**
 * Client-side fetch wrappers for /api/op/bookings/**.
 *
 * GET list is a safe method — sends NO CSRF token (proxy.ts admits GET freely).
 * All non-GET booking-detail mutations carry X-CSRF-Token via readCsrfToken()
 * so proxy.ts admits them through the CSRF double-submit gate.
 *
 * Used by the operator dashboard (app/op/(console)/dashboard/**).
 */

import { readCsrfToken } from '@/lib/auth/csrfClient';
import type { BookingQueueRow } from '@/lib/booking/toBookingQueueRow';

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

// --- Booking-detail mutations (Issue 014) ---------------------------------
// These back the (not-yet-built) /op/dashboard/[id] detail surface. Endpoints
// exist today; wire them when the detail page lands. All POST → X-CSRF-Token.

async function postBooking<T>(path: string, body?: unknown, errLabel = 'request'): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': readCsrfToken(),
    },
    credentials: 'same-origin',
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw Object.assign(new Error(`${errLabel} failed`), { status: res.status, data });
  }
  return res.json();
}

export function recordCallOutcomeApi(
  id: string,
  body: { outcome: 'reached' | 'no_answer' | 'callback'; pickupPointId?: string; pickupNote?: string }
): Promise<{ booking: unknown }> {
  return postBooking(`/api/op/bookings/${id}/call-outcome`, body, 'recordCallOutcome');
}

export function recordEscalationApi(id: string, note: string): Promise<{ booking: unknown }> {
  return postBooking(`/api/op/bookings/${id}/escalation`, { note }, 'recordEscalation');
}

export function markPickedUpApi(id: string): Promise<{ booking: unknown; alreadyPickedUp: boolean }> {
  return postBooking(`/api/op/bookings/${id}/picked-up`, {}, 'markPickedUp');
}

export function recordCashCollectedApi(id: string): Promise<{ booking: unknown; collectedVnd: number }> {
  return postBooking(`/api/op/bookings/${id}/cash-collected`, {}, 'recordCashCollected');
}
