/**
 * Issue 065: unit tests for POST /api/admin/operators/[id]/reject.
 *
 * Mocks transitionOperatorStatus + requireAdminAuth (passthrough super-admin ctx).
 * Asserts: reason is required (400 on empty/missing body), success calls the
 * service with to:'REJECTED' + reason + actor, and service errors map to AC codes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockTransition } = vi.hoisted(() => ({ mockTransition: vi.fn() }));

vi.mock('@/lib/onboarding/operatorStatus', () => ({
  transitionOperatorStatus: mockTransition,
}));
vi.mock('@/lib/auth/requireAdminAuth', () => ({
  requireAdminAuth: () => (handler: (req: unknown, ctx: unknown) => Promise<Response>) =>
    (req: unknown) => handler(req, { adminId: 'super-1', role: 'SUPER_ADMIN', totpVerified: true }),
}));

import { POST } from '../route';
import { NextRequest } from 'next/server';
import { OperatorStatusError } from '@/lib/onboarding/errors';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/operators/op_1/reject', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTransition.mockResolvedValue({ to: 'REJECTED' });
});

describe('POST /api/admin/operators/[id]/reject', () => {
  it('rejects to REJECTED with the reason + admin actor, returns 200', async () => {
    const res = await POST(makeRequest({ reason: 'missing payout docs' }));
    expect(res.status).toBe(200);
    expect(mockTransition).toHaveBeenCalledWith(
      expect.objectContaining({
        operatorId: 'op_1',
        to: 'REJECTED',
        reason: 'missing payout docs',
        actor: 'admin:super-1',
      })
    );
  });

  it('returns 400 when reason is missing', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    expect(mockTransition).not.toHaveBeenCalled();
  });

  it('returns 400 when reason is empty', async () => {
    const res = await POST(makeRequest({ reason: '' }));
    expect(res.status).toBe(400);
    expect(mockTransition).not.toHaveBeenCalled();
  });

  it('maps illegal_transition to 422', async () => {
    mockTransition.mockRejectedValue(new OperatorStatusError('illegal_transition'));
    const res = await POST(makeRequest({ reason: 'nope' }));
    expect(res.status).toBe(422);
  });

  it('maps operator_not_found to 404', async () => {
    mockTransition.mockRejectedValue(new OperatorStatusError('operator_not_found'));
    const res = await POST(makeRequest({ reason: 'nope' }));
    expect(res.status).toBe(404);
  });
});
