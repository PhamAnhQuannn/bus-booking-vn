/**
 * Client-side fetch wrappers for /api/op/routes/** (Issue 012 route management).
 *
 * GET is a safe method — no CSRF token. All non-GET requests carry
 * X-CSRF-Token via readCsrfToken() so proxy.ts admits them through the
 * CSRF double-submit gate. credentials:'same-origin' on every call.
 *
 * On failure: throw Object.assign(new Error(label), { status, data }) so the
 * caller can map data.error → a localized message.
 *
 * Used by app/op/(console)/routes/RoutesClient.tsx + PickupPointsPanel.tsx.
 */

import { readCsrfToken } from '@/lib/auth/csrfClient';

export interface RouteItem {
  id: string;
  operatorId: string;
  origin: string;
  destination: string;
  durationMinutes: number;
  deactivatedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface PickupPoint {
  id: string;
  name: string;
  address: string;
  displayOrder: number;
  deactivatedAt: string | null;
}

function jsonHeaders(): HeadersInit {
  return { 'Content-Type': 'application/json', 'X-CSRF-Token': readCsrfToken() };
}

function csrfHeaders(): HeadersInit {
  return { 'X-CSRF-Token': readCsrfToken() };
}

async function unwrap<T>(res: Response, label: string): Promise<T> {
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw Object.assign(new Error(`${label} failed`), { status: res.status, data });
  }
  return res.json();
}

export async function listRoutesApi(): Promise<{ routes: RouteItem[] }> {
  const res = await fetch('/api/op/routes', { credentials: 'same-origin' });
  return unwrap(res, 'listRoutes');
}

export async function createRouteApi(body: {
  origin: string;
  destination: string;
  durationMinutes: number;
}): Promise<{ route: RouteItem }> {
  const res = await fetch('/api/op/routes', {
    method: 'POST',
    headers: jsonHeaders(),
    credentials: 'same-origin',
    body: JSON.stringify(body),
  });
  return unwrap(res, 'createRoute');
}

export async function patchRouteApi(
  id: string,
  body: { origin?: string; destination?: string; durationMinutes?: number }
): Promise<{ route: RouteItem }> {
  const res = await fetch(`/api/op/routes/${id}`, {
    method: 'PATCH',
    headers: jsonHeaders(),
    credentials: 'same-origin',
    body: JSON.stringify(body),
  });
  return unwrap(res, 'patchRoute');
}

export async function deactivateRouteApi(id: string): Promise<{ route: RouteItem }> {
  const res = await fetch(`/api/op/routes/${id}/deactivate`, {
    method: 'POST',
    headers: csrfHeaders(),
    credentials: 'same-origin',
  });
  return unwrap(res, 'deactivateRoute');
}

export async function listPickupPointsApi(
  routeId: string
): Promise<{ pickupPoints: PickupPoint[] }> {
  const res = await fetch(`/api/op/routes/${routeId}/pickup-points`, {
    credentials: 'same-origin',
  });
  return unwrap(res, 'listPickupPoints');
}

export async function createPickupPointApi(
  routeId: string,
  body: { name: string; address: string }
): Promise<{ pickupPoint: PickupPoint }> {
  const res = await fetch(`/api/op/routes/${routeId}/pickup-points`, {
    method: 'POST',
    headers: jsonHeaders(),
    credentials: 'same-origin',
    body: JSON.stringify(body),
  });
  return unwrap(res, 'createPickupPoint');
}

export async function reorderPickupPointsApi(
  routeId: string,
  orderedIds: string[]
): Promise<{ pickupPoints: PickupPoint[] }> {
  const res = await fetch(`/api/op/routes/${routeId}/pickup-points`, {
    method: 'PATCH',
    headers: jsonHeaders(),
    credentials: 'same-origin',
    body: JSON.stringify({ orderedIds }),
  });
  return unwrap(res, 'reorderPickupPoints');
}

export async function deactivatePickupPointApi(
  routeId: string,
  ppId: string
): Promise<{ pickupPoint: PickupPoint }> {
  const res = await fetch(`/api/op/routes/${routeId}/pickup-points/${ppId}/deactivate`, {
    method: 'POST',
    headers: csrfHeaders(),
    credentials: 'same-origin',
  });
  return unwrap(res, 'deactivatePickupPoint');
}
