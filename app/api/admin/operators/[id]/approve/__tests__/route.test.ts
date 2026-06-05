/**
 * Issue 065: unit tests for POST /api/admin/operators/[id]/approve.
 *
 * Mocks transitionOperatorStatus + the auth HOFs (requireAdminAuth + requireStepUp
 * as passthroughs injecting an authed super-admin ctx). The real gates are unit-
 * tested in their own modules (Issues 054/055); here we assert the route COMPOSES
 * requireStepUp (privileged action, AC3), calls the service with to:'APPROVED' and
 * actor:'admin:<id>', and maps service errors to the AC status codes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// stepUpComposed is a plain flag (NOT a vi.fn) so beforeEach's vi.clearAllMocks()
// does NOT reset the import-time composition record we assert below.
const { mockTransition, stepUpComposed } = vi.hoisted(() => ({
  mockTransition: vi.fn(),
  stepUpComposed: { called: false },
}));

vi.mock('@/lib/onboarding/operatorStatus', () => ({
  transitionOperatorStatus: mockTransition,
}));
vi.mock('@/lib/auth/requireAdminAuth', () => ({
  requireAdminAuth: () => (handler: (req: unknown, ctx: unknown) => Promise<Response>) =>
    (req: unknown) => handler(req, { adminId: 'super-1', role: 'SUPER_ADMIN', totpVerified: true }),
}));
vi.mock('@/lib/auth/requireStepUp', () => ({
  // passthrough, but records that the route composed it (privileged action, AC3).
  requireStepUp: (handler: (req: unknown, ctx: unknown) => Promise<Response>) => {
    stepUpComposed.called = true;
    return handler;
  },
}));

import { POST } from '../route';
import { NextRequest } from 'next/server';
import { OperatorStatusError } from '@/lib/onboarding';

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost/api/admin/operators/op_1/approve', {
    method: 'POST',
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTransition.mockResolvedValue({ to: 'APPROVED' });
});

describe('POST /api/admin/operators/[id]/approve', () => {
  it('composes requireStepUp (privileged action)', () => {
    // The module loaded once at import — requireStepUp must have wrapped the handler.
    expect(stepUpComposed.called).toBe(true);
  });

  it('transitions to APPROVED with the admin actor and returns 200', async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(mockTransition).toHaveBeenCalledWith(
      expect.objectContaining({ operatorId: 'op_1', to: 'APPROVED', actor: 'admin:super-1' })
    );
  });

  it('maps illegal_transition to 422', async () => {
    mockTransition.mockRejectedValue(new OperatorStatusError('illegal_transition'));
    const res = await POST(makeRequest());
    expect(res.status).toBe(422);
  });

  it('maps operator_not_found to 404', async () => {
    mockTransition.mockRejectedValue(new OperatorStatusError('operator_not_found'));
    const res = await POST(makeRequest());
    expect(res.status).toBe(404);
  });
});
