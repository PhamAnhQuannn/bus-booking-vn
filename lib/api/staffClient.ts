/**
 * Client-side fetch wrappers for /api/op/staff/** (Issue 017).
 *
 * Non-GET requests carry X-CSRF-Token via readCsrfToken() so proxy.ts
 * admits them through the CSRF double-submit gate.
 */

import { readCsrfToken } from '@/lib/auth/csrfClient';
import type { StaffDto } from '@/lib/staff/toStaffDto';

export async function listStaffApi(): Promise<{ staff: StaffDto[] }> {
  const res = await fetch('/api/op/staff', { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`listStaff failed: ${res.status}`);
  return res.json();
}

export async function assignServiceApi(
  staffId: string,
  tripId: string
): Promise<{ staff: StaffDto }> {
  const res = await fetch(`/api/op/staff/${staffId}/assign-service`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': readCsrfToken(),
    },
    credentials: 'same-origin',
    body: JSON.stringify({ tripId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw Object.assign(new Error('assignService failed'), { status: res.status, data });
  }
  return res.json();
}
