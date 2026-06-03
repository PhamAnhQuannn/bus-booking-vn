/**
 * Issue 066: unit tests for POST /api/admin/customers/[id]/reinstate.
 *
 * Mocks reinstateCustomer + the prisma singleton + requireAdminAuth. Asserts: the
 * service is called with the customerId + admin actor (200) and the route is gated
 * to TOTP + SUPER_ADMIN/SUPPORT.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockReinstate, mockRequireAdminAuth } = vi.hoisted(() => ({
  mockReinstate: vi.fn(),
  mockRequireAdminAuth: vi.fn(),
}));

vi.mock('@/lib/admin/suspendCustomer', () => ({ reinstateCustomer: mockReinstate, suspendCustomer: vi.fn() }));
vi.mock('@/lib/core/db/client', () => ({ prisma: {} }));
vi.mock('@/lib/auth/requireAdminAuth', () => ({
  requireAdminAuth: (opts: unknown) => {
    mockRequireAdminAuth(opts);
    return (handler: (req: unknown, ctx: unknown) => Promise<Response>) =>
      (req: unknown) => handler(req, { adminId: 'sa-1', role: 'SUPER_ADMIN', totpVerified: true });
  },
}));

import { POST } from '../route';
import { NextRequest } from 'next/server';

function makeRequest(id = 'cust_2'): NextRequest {
  return new NextRequest(`http://localhost/api/admin/customers/${id}/reinstate`, { method: 'POST' });
}

beforeEach(() => {
  // Note: do NOT clearAllMocks — requireAdminAuth is invoked once at module import
  // (route construction), before any test runs; clearing would erase that record and
  // break the role-gate assertion. Only reset the per-call service mock.
  mockReinstate.mockReset();
  mockReinstate.mockResolvedValue(undefined);
});

describe('POST /api/admin/customers/[id]/reinstate', () => {
  it('reinstates the customer with the admin actor, returns 200', async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(mockReinstate).toHaveBeenCalledWith({}, { customerId: 'cust_2', actor: 'admin:sa-1' });
  });

  it('is gated to TOTP + SUPER_ADMIN/SUPPORT roles', async () => {
    expect(mockRequireAdminAuth).toHaveBeenCalledWith({
      requireTotp: true,
      role: ['SUPER_ADMIN', 'SUPPORT'],
    });
  });
});
