/**
 * Issue 085: unit tests for POST /api/admin/charter/[id]/reject.
 *
 * Mocks transitionCharterRequest + requireAdminAuth (passthrough SUPPORT ctx).
 * Asserts: reason required (400 on empty/missing); success calls the transition
 * with to:'REJECTED' + rejectionReason + admin actor; illegal_transition→422,
 * charter_not_found→404; role gate wired to SUPER_ADMIN|SUPPORT + TOTP, no step-up.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockTransition, mockRequireAdminAuth, authOptions } = vi.hoisted(() => {
  const authOptions: unknown[] = [];
  return {
    mockTransition: vi.fn(),
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

vi.mock('@/lib/core/db/client', () => ({ prisma: {} }));
vi.mock('@/lib/charter', async () => {
  const actual = await vi.importActual<typeof import('@/lib/charter')>('@/lib/charter');
  return { ...actual, transitionCharterRequest: mockTransition };
});
vi.mock('@/lib/auth/requireAdminAuth', () => ({ requireAdminAuth: mockRequireAdminAuth }));

import { POST } from '../route';
import { NextRequest } from 'next/server';
import { CharterError } from '@/lib/charter';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/charter/ch_1/reject', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTransition.mockResolvedValue({ ok: true, to: 'REJECTED' });
});

describe('POST /api/admin/charter/[id]/reject', () => {
  it('rejects to REJECTED with the reason + admin actor (200)', async () => {
    const res = await POST(makeRequest({ reason: 'no operator covers this route' }));
    expect(res.status).toBe(200);
    expect(mockTransition).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        charterId: 'ch_1',
        to: 'REJECTED',
        rejectionReason: 'no operator covers this route',
        actor: 'admin:sup-1',
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
    mockTransition.mockRejectedValue(new CharterError('illegal_transition', 'ACCEPTED -> REJECTED'));
    const res = await POST(makeRequest({ reason: 'nope' }));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('ILLEGAL_TRANSITION');
  });

  it('maps charter_not_found to 404', async () => {
    mockTransition.mockRejectedValue(new CharterError('charter_not_found'));
    const res = await POST(makeRequest({ reason: 'nope' }));
    expect(res.status).toBe(404);
  });

  it('role-gates to SUPER_ADMIN|SUPPORT, TOTP, NO step-up', async () => {
    expect(authOptions).toContainEqual({
      requireTotp: true,
      role: ['SUPER_ADMIN', 'SUPPORT'],
    });
  });
});
