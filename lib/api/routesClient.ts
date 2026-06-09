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
 * Used by app/op/(console)/routes/RoutesClient.tsx. Pickup-point client fns
 * removed in issue 104 (route-scoped PickupPoint replaced by OperatorPickupArea).
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
