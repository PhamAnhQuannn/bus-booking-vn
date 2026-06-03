/**
 * Unit tests for POST /api/admin/system/admins/[id]/revoke (Issue 070).
 *
 * Mocks revokeAdmin, prisma, and the auth HOFs (requireAdminAuth + requireStepUp
 * as passthroughs). Asserts: the route composes a SUPER_ADMIN gate + a fresh
 * step-up; the [id] segment is threaded as targetAdminId with the admin actor and
 * returns 200; no_self_revoke → 422; admin_not_found → 404. The gates themselves
 * are unit-tested in their own modules.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockRevoke, stepUpComposed, authOptions } = vi.hoisted(() => ({
  mockRevoke: vi.fn(),
  stepUpComposed: { called: false },
  authOptions: { value: undefined as unknown },
}));

vi.mock('@/lib/admin/revokeAdmin', () => ({ revokeAdmin: mockRevoke }));
vi.mock('@/lib/core/db/client', () => ({ prisma: {} }));
vi.mock('@/lib/auth/requireAdminAuth', () => ({
  requireAdminAuth: (opts: unknown) => {
    authOptions.value = opts;
    return (handler: (req: unknown, ctx: unknown) => Promise<Response>) =>
      (req: unknown) => handler(req, { adminId: 'super-1', role: 'SUPER_ADMIN', totpVerified: true });
  },
}));
vi.mock('@/lib/auth/requireStepUp', () => ({
  requireStepUp: (handler: (req: unknown, ctx: unknown) => Promise<Response>) => {
    stepUpComposed.called = true;
    return handler;
  },
}));

import { POST } from '../route';
import { NextRequest } from 'next/server';
import { AdminServiceError } from '@/lib/admin/errors';

function makeRequest(targetId: string): NextRequest {
  return new NextRequest(`http://localhost/api/admin/system/admins/${targetId}/revoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRevoke.mockResolvedValue({ ok: true });
});

describe('POST /api/admin/system/admins/[id]/revoke', () => {
  it('composes a SUPER_ADMIN gate + a fresh step-up', () => {
    expect(authOptions.value).toMatchObject({ requireTotp: true, role: 'SUPER_ADMIN' });
    expect(stepUpComposed.called).toBe(true);
  });

  it('threads the [id] segment as targetAdminId with the admin actor and returns 200', async () => {
    const res = await POST(makeRequest('target-7'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockRevoke).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorAdminId: 'super-1',
        targetAdminId: 'target-7',
        actor: 'admin:super-1',
      })
    );
  });

  it('maps no_self_revoke to 422', async () => {
    mockRevoke.mockRejectedValue(new AdminServiceError('no_self_revoke'));
    const res = await POST(makeRequest('super-1'));
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: 'NO_SELF_REVOKE' });
  });

  it('maps admin_not_found to 404', async () => {
    mockRevoke.mockRejectedValue(new AdminServiceError('admin_not_found'));
    const res = await POST(makeRequest('ghost'));
    expect(res.status).toBe(404);
  });
});
