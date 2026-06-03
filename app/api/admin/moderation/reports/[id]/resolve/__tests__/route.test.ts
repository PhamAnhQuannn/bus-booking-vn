/**
 * Issue 069 (Part E): unit tests for POST /api/admin/moderation/reports/[id]/resolve.
 *
 * Mocks the service + the auth HOF (passthrough injecting an authed SUPER_ADMIN ctx).
 * Asserts the role set ['SUPER_ADMIN','SUPPORT'] + requireTotp, NO requireStepUp in
 * the chain, resolveReport called with actor 'admin:<id>', and P2025 → 404.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const { mockResolve, captured } = vi.hoisted(() => ({
  mockResolve: vi.fn(),
  captured: { authOptions: undefined as unknown },
}));

vi.mock('@/lib/admin/moderation', () => ({
  setTripModeration: vi.fn(),
  setRouteModeration: vi.fn(),
  resolveReport: mockResolve,
}));
vi.mock('@/lib/auth/requireAdminAuth', () => ({
  requireAdminAuth: (options: unknown) => {
    captured.authOptions = options;
    return (handler: (req: unknown, ctx: unknown) => Promise<Response>) =>
      (req: unknown) => handler(req, { adminId: 'sa-1', role: 'SUPER_ADMIN', totpVerified: true });
  },
}));
vi.mock('@/lib/db/client', () => ({ prisma: {} }));

import { POST } from '../route';
import { NextRequest } from 'next/server';

const routeSrc = readFileSync(join(__dirname, '..', 'route.ts'), 'utf8');

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost/api/admin/moderation/reports/rep_1/resolve', {
    method: 'POST',
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockResolve.mockResolvedValue(undefined);
});

describe('POST /api/admin/moderation/reports/[id]/resolve', () => {
  it('gates on role [SUPER_ADMIN, SUPPORT] with requireTotp', () => {
    expect(captured.authOptions).toEqual({
      requireTotp: true,
      role: ['SUPER_ADMIN', 'SUPPORT'],
    });
  });

  it('does NOT compose requireStepUp', () => {
    expect(routeSrc).not.toMatch(/requireStepUp/);
  });

  it('resolves the report with actor admin:<id> and returns 200 { ok:true }', async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(mockResolve).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ reportId: 'rep_1', actor: 'admin:sa-1' })
    );
  });

  it('maps Prisma P2025 to 404', async () => {
    mockResolve.mockRejectedValue(Object.assign(new Error('not found'), { code: 'P2025' }));
    const res = await POST(makeRequest());
    expect(res.status).toBe(404);
  });
});
