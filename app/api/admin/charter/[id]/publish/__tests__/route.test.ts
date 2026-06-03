/**
 * Issue 085: unit tests for POST /api/admin/charter/[id]/publish.
 *
 * Mocks transitionCharterRequest + requireAdminAuth (passthrough SUPER_ADMIN ctx).
 * Asserts: success calls the transition with to:'PUBLISHED' + a claimByAt deadline
 * + admin actor; illegal_transition→422, charter_not_found→404; role gate wired to
 * SUPER_ADMIN|SUPPORT + TOTP, no step-up.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockTransition, mockRequireAdminAuth, authOptions } = vi.hoisted(() => {
  const authOptions: unknown[] = [];
  return {
    mockTransition: vi.fn(),
    authOptions,
    // Capture the options the route passes at import time into a hoisted array —
    // vi.clearAllMocks() (beforeEach) wipes the mock's own call record, so assert
    // against this captured array instead.
    mockRequireAdminAuth: vi.fn((opts?: unknown) => {
      authOptions.push(opts);
      return (handler: (req: unknown, ctx: unknown) => Promise<Response>) => (req: unknown) =>
        handler(req, { adminId: 'super-1', role: 'SUPER_ADMIN', totpVerified: true });
    }),
  };
});

vi.mock('@/lib/db/client', () => ({ prisma: {} }));
vi.mock('@/lib/charter', async () => {
  const actual = await vi.importActual<typeof import('@/lib/charter')>('@/lib/charter');
  return { ...actual, transitionCharterRequest: mockTransition };
});
vi.mock('@/lib/auth/requireAdminAuth', () => ({ requireAdminAuth: mockRequireAdminAuth }));

import { POST } from '../route';
import { NextRequest } from 'next/server';
import { CharterError } from '@/lib/charter';

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost/api/admin/charter/ch_1/publish', { method: 'POST' });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTransition.mockResolvedValue({ ok: true, to: 'PUBLISHED' });
});

describe('POST /api/admin/charter/[id]/publish', () => {
  it('publishes to PUBLISHED with claimByAt + admin actor (200)', async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(mockTransition).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ charterId: 'ch_1', to: 'PUBLISHED', actor: 'admin:super-1' })
    );
    const arg = mockTransition.mock.calls[0][1];
    expect(arg.claimByAt).toBeInstanceOf(Date);
    // claimByAt is ~48h out.
    expect(arg.claimByAt.getTime()).toBeGreaterThan(Date.now() + 47 * 3600 * 1000);
  });

  it('maps illegal_transition to 422', async () => {
    mockTransition.mockRejectedValue(new CharterError('illegal_transition', 'REJECTED -> PUBLISHED'));
    const res = await POST(makeRequest());
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('ILLEGAL_TRANSITION');
  });

  it('maps charter_not_found to 404', async () => {
    mockTransition.mockRejectedValue(new CharterError('charter_not_found'));
    const res = await POST(makeRequest());
    expect(res.status).toBe(404);
  });

  it('role-gates to SUPER_ADMIN|SUPPORT, TOTP, NO step-up', async () => {
    expect(authOptions).toContainEqual({
      requireTotp: true,
      role: ['SUPER_ADMIN', 'SUPPORT'],
    });
  });
});
