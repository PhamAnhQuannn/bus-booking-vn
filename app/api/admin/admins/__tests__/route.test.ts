/**
 * Unit tests for POST /api/admin/admins (Issue 057) — invite-admin route.
 *
 * Mocks inviteAdmin, prisma, and the auth HOFs (requireAdminAuth + requireStepUp
 * as passthroughs injecting an authed super-admin ctx). Asserts: 201 with
 * { adminUserId, tempPassword } on success; 409 on email_in_use; 400 on bad body.
 * Auth/step-up enforcement itself is covered by the HOF unit tests (Issues
 * 054/055); here we assert the route composes them and maps service errors.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockInviteAdmin } = vi.hoisted(() => ({ mockInviteAdmin: vi.fn() }));

vi.mock('@/lib/admin/inviteAdmin', () => ({ inviteAdmin: mockInviteAdmin }));
vi.mock('@/lib/core/db/client', () => ({ prisma: {} }));

// requireAdminAuth + requireStepUp passthroughs: invoke the handler with a fixed
// authed super-admin ctx (the real gates are unit-tested in their own modules).
vi.mock('@/lib/auth/requireAdminAuth', () => ({
  requireAdminAuth: () => (handler: (req: unknown, ctx: unknown) => Promise<Response>) =>
    (req: unknown) => handler(req, { adminId: 'super-1', role: 'SUPER_ADMIN', totpVerified: true }),
}));
vi.mock('@/lib/auth/requireStepUp', () => ({
  requireStepUp: (handler: (req: unknown, ctx: unknown) => Promise<Response>) => handler,
}));

import { POST } from '../route';
import { NextRequest } from 'next/server';
import { AdminServiceError } from '@/lib/admin/errors';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/admins', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockInviteAdmin.mockResolvedValue({ adminUserId: 'invitee-1', tempPassword: 'TempPass123x' });
});

describe('POST /api/admin/admins', () => {
  it('returns 201 with { adminUserId, tempPassword } on success', async () => {
    const res = await POST(makeRequest({ email: 'finance@example.com', role: 'FINANCE' }));
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json).toEqual({ adminUserId: 'invitee-1', tempPassword: 'TempPass123x' });
    // actor threaded as admin:<id>; inviter is the authed super-admin.
    expect(mockInviteAdmin).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        inviterAdminId: 'super-1',
        email: 'finance@example.com',
        role: 'FINANCE',
        actor: 'admin:super-1',
      })
    );
  });

  it('maps email_in_use to 409', async () => {
    mockInviteAdmin.mockRejectedValue(new AdminServiceError('email_in_use'));
    const res = await POST(makeRequest({ email: 'dup@example.com', role: 'SUPPORT' }));
    expect(res.status).toBe(409);
  });

  it('maps forbidden to 403', async () => {
    mockInviteAdmin.mockRejectedValue(new AdminServiceError('forbidden'));
    const res = await POST(makeRequest({ email: 'x@example.com', role: 'SUPPORT' }));
    expect(res.status).toBe(403);
  });

  it('returns 400 on an invalid role', async () => {
    const res = await POST(makeRequest({ email: 'x@example.com', role: 'ROOT' }));
    expect(res.status).toBe(400);
    expect(mockInviteAdmin).not.toHaveBeenCalled();
  });

  it('returns 400 on a malformed email', async () => {
    const res = await POST(makeRequest({ email: 'not-an-email', role: 'FINANCE' }));
    expect(res.status).toBe(400);
  });
});
