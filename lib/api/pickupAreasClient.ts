/**
 * Client-side fetch wrappers for /api/op/pickup-areas/** (Issue 105).
 *
 * GET is safe (no CSRF). Non-GET carry X-CSRF-Token via readCsrfToken().
 * Used by app/op/(console)/pickup-areas/PickupAreasClient.tsx.
 */

import { readCsrfToken } from '@/lib/auth/csrfClient';

export interface PickupAreaItem {
  id: string;
  provinceCode: string;
  districtCode: string;
  districtName: string;
  wardCode: string;
  wardName: string;
  name: string;
  addressLine: string | null;
  label: string;
  isActive: boolean;
  displayOrder: number;
}

function jsonHeaders(): HeadersInit {
  return { 'Content-Type': 'application/json', 'X-CSRF-Token': readCsrfToken() };
}

async function unwrap<T>(res: Response, label: string): Promise<T> {
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw Object.assign(new Error(`${label} failed`), { status: res.status, data });
  }
  return res.json();
}

export async function listPickupAreasApi(): Promise<{ areas: PickupAreaItem[] }> {
  const res = await fetch('/api/op/pickup-areas', { credentials: 'same-origin' });
  return unwrap(res, 'listPickupAreas');
}

export async function createPickupAreaApi(body: {
  provinceCode: string;
  districtCode: string;
  wardCode: string;
  name: string;
  addressLine?: string;
}): Promise<{ area: PickupAreaItem }> {
  const res = await fetch('/api/op/pickup-areas', {
    method: 'POST',
    headers: jsonHeaders(),
    credentials: 'same-origin',
    body: JSON.stringify(body),
  });
  return unwrap(res, 'createPickupArea');
}

export async function updatePickupAreaApi(
  id: string,
  body: { name: string; addressLine?: string }
): Promise<{ area: PickupAreaItem }> {
  const res = await fetch(`/api/op/pickup-areas/${id}`, {
    method: 'PATCH',
    headers: jsonHeaders(),
    credentials: 'same-origin',
    body: JSON.stringify(body),
  });
  return unwrap(res, 'updatePickupArea');
}

export async function deactivatePickupAreaApi(id: string): Promise<{ area: PickupAreaItem }> {
  const res = await fetch(`/api/op/pickup-areas/${id}/deactivate`, {
    method: 'POST',
    headers: { 'X-CSRF-Token': readCsrfToken() },
    credentials: 'same-origin',
  });
  return unwrap(res, 'deactivatePickupArea');
}
