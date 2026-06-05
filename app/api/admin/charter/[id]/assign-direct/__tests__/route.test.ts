/**
 * Issue 085: unit tests for POST /api/admin/charter/[id]/assign-direct.
 *
 * Mocks transitionCharterRequest + requireAdminAuth (passthrough SUPPORT ctx) +
 * the prisma operator lookup. Asserts: operatorId required (400); operator must be
 * APPROVED (422 NOT_APPROVED otherwise); success calls the transition with
 * to:'ASSIGNED_DIRECT' + assigneeOperatorId + an acceptByAt deadline + admin actor;
 * illegal_transition→422, charter_not_found→404; and that the role gate is wired to
 * SUPER_ADMIN|SUPPORT.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockTransition, mockFindUnique, mockRequireAdminAuth, authOptions } = vi.hoisted(() => {
  const authOptions: unknown[] = [];
  return {
    mockTransition: vi.fn(),
    mockFindUnique: vi.fn(),
    authOptions,
    // Capture the options the route passes at import time (clearAllMocks wipes the
    // mock's own call record — assert against this captured array instead).
    mockRequireAdminAuth: vi.fn((opts?: unknown) => {
      authOptions.push(opts);
      return (handler: (req: unknown, ctx: unknown) => Promise<Response>) => (req: unknown) =>
        handler(req, { adminId: 'sup-1', role: 'SUPPORT', totpVerified: true });
    }),
  };
});

vi.mock('@/lib/core/db/client', () => ({ prisma: { operator: { findUnique: mockFindUnique } } }));
vi.mock('@/lib/charter', async () => {
  const actual = await vi.importActual<typeof import('@/lib/charter')>('@/lib/charter');
  return { ...actual, transitionCharterRequest: mockTransition };
});
vi.mock('@/lib/auth/requireAdminAuth', () => ({ requireAdminAuth: mockRequireAdminAuth }));

import { POST } from '../route';
import { NextRequest } from 'next/server';
import { CharterError } from '@/lib/charter';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/charter/ch_1/assign-direct', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTransition.mockResolvedValue({ ok: true, to: 'ASSIGNED_DIRECT' });
  mockFindUnique.mockResolvedValue({ status: 'APPROVED' });
});

describe('POST /api/admin/charter/[id]/assign-direct', () => {
  it('assigns to ASSIGNED_DIRECT with assignee + acceptByAt + admin actor (200)', async () => {
    const res = await POST(makeRequest({ operatorId: 'op_7' }));
    expect(res.status).toBe(200);
    expect(mockTransition).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        charterId: 'ch_1',
        to: 'ASSIGNED_DIRECT',
        assigneeOperatorId: 'op_7',
        actor: 'admin:sup-1',
      })
    );
    const arg = mockTransition.mock.calls[0][1];
    expect(arg.acceptByAt).toBeInstanceOf(Date);
    // acceptByAt is ~24h out.
    expect(arg.acceptByAt.getTime()).toBeGreaterThan(Date.now() + 23 * 3600 * 1000);
  });

  it('returns 400 when operatorId is missing', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    expect(mockTransition).not.toHaveBeenCalled();
  });

  it('returns 422 NOT_APPROVED when the operator is not APPROVED', async () => {
    mockFindUnique.mockResolvedValue({ status: 'SUSPENDED' });
    const res = await POST(makeRequest({ operatorId: 'op_7' }));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('NOT_APPROVED');
    expect(mockTransition).not.toHaveBeenCalled();
  });

  it('returns 422 NOT_APPROVED when the operator does not exist', async () => {
    mockFindUnique.mockResolvedValue(null);
    const res = await POST(makeRequest({ operatorId: 'ghost' }));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('NOT_APPROVED');
    expect(mockTransition).not.toHaveBeenCalled();
  });

  it('maps illegal_transition to 422', async () => {
    mockTransition.mockRejectedValue(new CharterError('illegal_transition', 'PUBLISHED -> ASSIGNED_DIRECT'));
    const res = await POST(makeRequest({ operatorId: 'op_7' }));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('ILLEGAL_TRANSITION');
  });

  it('maps charter_not_found to 404', async () => {
    mockTransition.mockRejectedValue(new CharterError('charter_not_found'));
    const res = await POST(makeRequest({ operatorId: 'op_7' }));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('CHARTER_NOT_FOUND');
  });

  it('role-gates to SUPER_ADMIN|SUPPORT, TOTP, NO step-up', async () => {
    expect(authOptions).toContainEqual({
      requireTotp: true,
      role: ['SUPER_ADMIN', 'SUPPORT'],
    });
  });
});
