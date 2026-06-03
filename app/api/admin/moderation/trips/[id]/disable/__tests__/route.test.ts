/**
 * Issue 069 (Part E): unit tests for POST /api/admin/moderation/trips/[id]/disable.
 *
 * Mocks the service + the auth HOF (passthrough injecting an authed SUPPORT ctx).
 * Asserts:
 *   - requireAdminAuth is configured with role ['SUPER_ADMIN','SUPPORT'] + requireTotp.
 *   - NO requireStepUp is composed (moderation is lower-priv per AC) — the module
 *     does not even import @/lib/auth/requireStepUp.
 *   - setTripModeration is called with disabled:true + actor 'admin:<id>'.
 *   - Prisma P2025 maps to 404.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSetTrip, captured } = vi.hoisted(() => ({
  mockSetTrip: vi.fn(),
  captured: { authOptions: undefined as unknown },
}));

vi.mock('@/lib/admin/moderation', () => ({
  setTripModeration: mockSetTrip,
  setRouteModeration: vi.fn(),
  resolveReport: vi.fn(),
}));
vi.mock('@/lib/auth/requireAdminAuth', () => ({
  requireAdminAuth: (options: unknown) => {
    captured.authOptions = options;
    return (handler: (req: unknown, ctx: unknown) => Promise<Response>) =>
      (req: unknown) => handler(req, { adminId: 'sup-1', role: 'SUPPORT', totpVerified: true });
  },
}));
vi.mock('@/lib/db/client', () => ({ prisma: {} }));

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { POST } from '../route';
import { NextRequest } from 'next/server';

// Structural proof: neither the route module nor its _shared chain references
// requireStepUp — moderation is lower-priv per AC (NO step-up).
const routeSrc = readFileSync(join(__dirname, '..', 'route.ts'), 'utf8');
const sharedSrc = readFileSync(
  join(__dirname, '..', '..', '..', '..', '_shared.ts'),
  'utf8'
);
// __tests__ → disable(..) → [id](../..) → trips(../../..) → moderation(../../../..)

function makeRequest(body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/moderation/trips/trip_1/disable', {
    method: 'POST',
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSetTrip.mockResolvedValue(undefined);
});

describe('POST /api/admin/moderation/trips/[id]/disable', () => {
  it('gates on role [SUPER_ADMIN, SUPPORT] with requireTotp', () => {
    expect(captured.authOptions).toEqual({
      requireTotp: true,
      role: ['SUPER_ADMIN', 'SUPPORT'],
    });
  });

  it('does NOT compose requireStepUp (no import / no call in route or _shared)', () => {
    // Mentions in prose comments are fine; assert there is no IMPORT and no CALL.
    const importRe = /import[^;]*requireStepUp/;
    const callRe = /requireStepUp\s*\(/;
    expect(routeSrc).not.toMatch(importRe);
    expect(routeSrc).not.toMatch(callRe);
    expect(sharedSrc).not.toMatch(importRe);
    expect(sharedSrc).not.toMatch(callRe);
  });

  it('disables the trip with actor admin:<id> and returns 200 { ok:true }', async () => {
    const res = await POST(makeRequest({ reason: 'spam' }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(mockSetTrip).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tripId: 'trip_1', disabled: true, actor: 'admin:sup-1', reason: 'spam' })
    );
  });

  it('tolerates an empty body (no reason)', async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(mockSetTrip).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tripId: 'trip_1', disabled: true, actor: 'admin:sup-1' })
    );
  });

  it('maps Prisma P2025 (record not found) to 404', async () => {
    mockSetTrip.mockRejectedValue(Object.assign(new Error('not found'), { code: 'P2025' }));
    const res = await POST(makeRequest());
    expect(res.status).toBe(404);
  });
});
