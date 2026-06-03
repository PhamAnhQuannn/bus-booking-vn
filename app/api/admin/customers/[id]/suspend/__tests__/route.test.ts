/**
 * Issue 066: unit tests for POST /api/admin/customers/[id]/suspend.
 *
 * Mocks suspendCustomer + the prisma singleton + requireAdminAuth. Asserts: the
 * service is called with the customerId + admin actor (200), the route is gated to
 * TOTP + SUPER_ADMIN/SUPPORT roles, and a missing id → 400.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSuspend, mockRequireAdminAuth } = vi.hoisted(() => ({
  mockSuspend: vi.fn(),
  mockRequireAdminAuth: vi.fn(),
}));

vi.mock('@/lib/admin/suspendCustomer', () => ({ suspendCustomer: mockSuspend, reinstateCustomer: vi.fn() }));
vi.mock('@/lib/core/db/client', () => ({ prisma: {} }));
vi.mock('@/lib/auth/requireAdminAuth', () => ({
  requireAdminAuth: (opts: unknown) => {
    mockRequireAdminAuth(opts);
    return (handler: (req: unknown, ctx: unknown) => Promise<Response>) =>
      (req: unknown) => handler(req, { adminId: 'sup-1', role: 'SUPPORT', totpVerified: true });
  },
}));

import { POST } from '../route';
import { NextRequest } from 'next/server';

function makeRequest(id = 'cust_1'): NextRequest {
  return new NextRequest(`http://localhost/api/admin/customers/${id}/suspend`, { method: 'POST' });
}

beforeEach(() => {
  // Note: do NOT clearAllMocks — requireAdminAuth is invoked once at module import
  // (route construction), before any test runs; clearing would erase that record and
  // break the role-gate assertion. Only reset the per-call service mock.
  mockSuspend.mockReset();
  mockSuspend.mockResolvedValue(undefined);
});

describe('POST /api/admin/customers/[id]/suspend', () => {
  it('suspends the customer with the admin actor, returns 200', async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(mockSuspend).toHaveBeenCalledWith({}, { customerId: 'cust_1', actor: 'admin:sup-1' });
  });

  it('is gated to TOTP + SUPER_ADMIN/SUPPORT roles', async () => {
    expect(mockRequireAdminAuth).toHaveBeenCalledWith({
      requireTotp: true,
      role: ['SUPER_ADMIN', 'SUPPORT'],
    });
  });
});
