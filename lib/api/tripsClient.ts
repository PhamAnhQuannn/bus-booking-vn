/**
 * Client-side fetch wrappers for /api/op/trips/** and /api/op/trip-templates/**.
 *
 * All non-GET requests carry X-CSRF-Token via readCsrfToken() so proxy.ts
 * admits them through the CSRF double-submit gate.
 *
 * Used by operator UI pages (app/op/trips/**, app/op/trip-templates/**).
 */

import { readCsrfToken } from '@/lib/auth/csrfClient';
import type { TripDto, TemplateDto } from '@/lib/trips/tripDto';

// ---------------------------------------------------------------------------
// Trips
// ---------------------------------------------------------------------------

export async function listTripsApi(params?: {
  routeId?: string;
  fromDate?: string;
  toDate?: string;
  status?: string;
}): Promise<{ trips: TripDto[] }> {
  const qs = new URLSearchParams();
  if (params?.routeId) qs.set('routeId', params.routeId);
  if (params?.fromDate) qs.set('fromDate', params.fromDate);
  if (params?.toDate) qs.set('toDate', params.toDate);
  if (params?.status) qs.set('status', params.status);
  const url = `/api/op/trips${qs.toString() ? '?' + qs.toString() : ''}`;
  const res = await fetch(url, { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`listTrips failed: ${res.status}`);
  return res.json();
}

export async function createTripApi(body: {
  routeId: string;
  busId: string;
  departureAt: string;
  price: number;
}): Promise<{ trip: TripDto }> {
  const res = await fetch('/api/op/trips', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': readCsrfToken(),
    },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw Object.assign(new Error('createTrip failed'), { status: res.status, data });
  }
  return res.json();
}

export async function getTripApi(id: string): Promise<{ trip: TripDto }> {
  const res = await fetch(`/api/op/trips/${id}`, { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`getTrip failed: ${res.status}`);
  return res.json();
}

export async function patchTripApi(
  id: string,
  body: { price?: number; salesClosed?: boolean }
): Promise<{ trip: TripDto }> {
  const res = await fetch(`/api/op/trips/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': readCsrfToken(),
    },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw Object.assign(new Error('patchTrip failed'), { status: res.status, data });
  }
  return res.json();
}

export async function blockSeatsApi(
  id: string,
  blockedSeats: number
): Promise<{ trip: TripDto }> {
  const res = await fetch(`/api/op/trips/${id}/block-seats`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': readCsrfToken(),
    },
    credentials: 'same-origin',
    body: JSON.stringify({ blockedSeats }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw Object.assign(new Error('blockSeats failed'), { status: res.status, data });
  }
  return res.json();
}

export async function reassignBusApi(
  id: string,
  busId: string
): Promise<{ trip: TripDto }> {
  const res = await fetch(`/api/op/trips/${id}/reassign-bus`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': readCsrfToken(),
    },
    credentials: 'same-origin',
    body: JSON.stringify({ busId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw Object.assign(new Error('reassignBus failed'), { status: res.status, data });
  }
  return res.json();
}

export async function cancelTripApi(
  id: string,
  reason: string
): Promise<{ ok: boolean; cancelledBookings: number; cancelledHolds: number; notificationsEnqueued: number }> {
  const res = await fetch(`/api/op/trips/${id}/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': readCsrfToken(),
    },
    credentials: 'same-origin',
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw Object.assign(new Error('cancelTrip failed'), { status: res.status, data });
  }
  return res.json();
}

export async function salesToggleApi(
  id: string,
  salesClosed: boolean
): Promise<{ trip: TripDto }> {
  const res = await fetch(`/api/op/trips/${id}/sales-toggle`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': readCsrfToken(),
    },
    credentials: 'same-origin',
    body: JSON.stringify({ salesClosed }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw Object.assign(new Error('salesToggle failed'), { status: res.status, data });
  }
  return res.json();
}

export async function pairedReturnApi(
  id: string,
  body: { returnDepartureAt: string; price?: number }
): Promise<{ outboundTrip: TripDto; returnTrip: TripDto }> {
  const res = await fetch(`/api/op/trips/${id}/paired-return`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': readCsrfToken(),
    },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw Object.assign(new Error('pairedReturn failed'), { status: res.status, data });
  }
  return res.json();
}

export async function departTripApi(
  id: string
): Promise<{ ok: boolean; alreadyDeparted: boolean; trip: TripDto }> {
  const res = await fetch(`/api/op/trips/${id}/depart`, {
    method: 'POST',
    headers: { 'X-CSRF-Token': readCsrfToken() },
    credentials: 'same-origin',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw Object.assign(new Error('departTrip failed'), { status: res.status, data });
  }
  return res.json();
}

export async function completeTripApi(
  id: string
): Promise<{ ok: boolean; alreadyCompleted: boolean; trip: TripDto; payoutJobsEnqueued: number }> {
  const res = await fetch(`/api/op/trips/${id}/complete`, {
    method: 'POST',
    headers: { 'X-CSRF-Token': readCsrfToken() },
    credentials: 'same-origin',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw Object.assign(new Error('completeTrip failed'), { status: res.status, data });
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Trip Templates
// ---------------------------------------------------------------------------

export async function listTemplatesApi(): Promise<{ templates: TemplateDto[] }> {
  const res = await fetch('/api/op/trip-templates', { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`listTemplates failed: ${res.status}`);
  return res.json();
}

export async function createTemplateApi(body: {
  routeId: string;
  busId: string;
  price: number;
  departureLocalTime: string;
  daysOfMask: number;
  validFrom: string;
  validUntil: string;
}): Promise<{ template: TemplateDto }> {
  const res = await fetch('/api/op/trip-templates', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': readCsrfToken(),
    },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw Object.assign(new Error('createTemplate failed'), { status: res.status, data });
  }
  return res.json();
}

export async function getTemplateApi(id: string): Promise<{ template: TemplateDto }> {
  const res = await fetch(`/api/op/trip-templates/${id}`, { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`getTemplate failed: ${res.status}`);
  return res.json();
}

export async function patchTemplateApi(
  id: string,
  body: {
    price?: number;
    departureLocalTime?: string;
    daysOfMask?: number;
    validFrom?: string;
    validUntil?: string;
    busId?: string;
    deactivatedAt?: string | null;
  }
): Promise<{ template: TemplateDto }> {
  const res = await fetch(`/api/op/trip-templates/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': readCsrfToken(),
    },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw Object.assign(new Error('patchTemplate failed'), { status: res.status, data });
  }
  return res.json();
}
