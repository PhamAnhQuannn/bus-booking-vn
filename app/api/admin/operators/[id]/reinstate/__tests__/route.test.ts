/**
 * Issue 067: unit tests for POST /api/admin/operators/[id]/reinstate.
 *
 * Mirrors the suspend/approve route tests: privileged (composes requireStepUp),
 * transitions SUSPENDED → APPROVED with the admin actor, maps service errors.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

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
  requireStepUp: (handler: (req: unknown, ctx: unknown) => Promise<Response>) => {
    stepUpComposed.called = true;
    return handler;
  },
}));

import { POST } from '../route';
import { NextRequest } from 'next/server';
import { OperatorStatusError } from '@/lib/onboarding/errors';

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost/api/admin/operators/op_1/reinstate', { method: 'POST' });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTransition.mockResolvedValue({ to: 'APPROVED' });
});

describe('POST /api/admin/operators/[id]/reinstate', () => {
  it('composes requireStepUp (privileged action)', () => {
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
