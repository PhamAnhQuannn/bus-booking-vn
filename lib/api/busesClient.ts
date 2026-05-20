/**
 * Client-side fetch wrappers for /api/op/buses/** (Issue 011 fleet management).
 *
 * GET is a safe method — no CSRF token. All non-GET requests carry
 * X-CSRF-Token via readCsrfToken() so proxy.ts admits them through the
 * CSRF double-submit gate. credentials:'same-origin' on every call.
 *
 * On failure: throw Object.assign(new Error(label), { status, data }) so the
 * caller can map data.error → a localized message (and read violatingTrips /
 * tripIds / conflictingTrips off data when present).
 *
 * Used by app/op/(console)/buses/BusesClient.tsx.
 */

import { readCsrfToken } from '@/lib/auth/csrfClient';
import type { OperatorBusListItem } from '@/lib/buses/listOperatorBuses';

type BusType = 'coach' | 'sleeper' | 'limousine';

export interface MaintenanceWindow {
  id: string;
  startAt: string;
  endAt: string;
  reason: string | null;
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

export async function listBusesApi(activeOnly = true): Promise<{ buses: OperatorBusListItem[] }> {
  const qs = activeOnly ? '?activeOnly=1' : '';
  const res = await fetch(`/api/op/buses${qs}`, { credentials: 'same-origin' });
  return unwrap(res, 'listBuses');
}

export async function getBusApi(
  id: string
): Promise<{ bus: OperatorBusListItem & { maintenances: MaintenanceWindow[] } }> {
  const res = await fetch(`/api/op/buses/${id}`, { credentials: 'same-origin' });
  return unwrap(res, 'getBus');
}

export async function createBusApi(body: {
  licensePlate: string;
  capacity: number;
  busType: BusType;
}): Promise<{ bus: OperatorBusListItem }> {
  const res = await fetch('/api/op/buses', {
    method: 'POST',
    headers: jsonHeaders(),
    credentials: 'same-origin',
    body: JSON.stringify(body),
  });
  return unwrap(res, 'createBus');
}

export async function patchCapacityApi(
  id: string,
  capacity: number
): Promise<{ bus: OperatorBusListItem }> {
  const res = await fetch(`/api/op/buses/${id}`, {
    method: 'PATCH',
    headers: jsonHeaders(),
    credentials: 'same-origin',
    body: JSON.stringify({ capacity }),
  });
  return unwrap(res, 'patchCapacity');
}

export async function deactivateBusApi(id: string): Promise<{ ok: boolean }> {
  const res = await fetch(`/api/op/buses/${id}/deactivate`, {
    method: 'POST',
    headers: csrfHeaders(),
    credentials: 'same-origin',
  });
  return unwrap(res, 'deactivateBus');
}

export async function addMaintenanceApi(
  id: string,
  body: { startAt: string; endAt: string; reason?: string }
): Promise<{ maintenance: MaintenanceWindow; conflictingTrips?: { tripId: string }[] }> {
  const res = await fetch(`/api/op/buses/${id}/maintenance`, {
    method: 'POST',
    headers: jsonHeaders(),
    credentials: 'same-origin',
    body: JSON.stringify(body),
  });
  return unwrap(res, 'addMaintenance');
}

export async function deleteMaintenanceApi(id: string, mid: string): Promise<{ ok: boolean }> {
  const res = await fetch(`/api/op/buses/${id}/maintenance/${mid}`, {
    method: 'DELETE',
    headers: csrfHeaders(),
    credentials: 'same-origin',
  });
  return unwrap(res, 'deleteMaintenance');
}
