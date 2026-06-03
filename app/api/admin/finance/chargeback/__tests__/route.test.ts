/**
 * Issue 068: unit tests for POST /api/admin/finance/chargeback.
 *
 * Asserts the finance auth shape, that recordChargeback is called with the body +
 * a minted `admin-chargeback:` sourceEventId when omitted (and an explicit one when
 * provided), an admin-chargeback audit row, 200 mapping, and 422 on a bad body +
 * 404 on booking_not_found.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockChargeback, mockAudit, stepUpComposed, authOptions } = vi.hoisted(() => ({
  mockChargeback: vi.fn(),
  mockAudit: vi.fn(),
  stepUpComposed: { called: false },
  authOptions: { value: undefined as unknown },
}));

vi.mock('@/lib/ledger/chargeback', () => ({
  recordChargeback: mockChargeback,
  ChargebackError: class ChargebackError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  },
}));
vi.mock('@/lib/audit/adminAuditLog', () => ({ writeAdminAuditLog: mockAudit }));
vi.mock('@/lib/db/client', () => ({ prisma: {} }));
vi.mock('@/lib/auth/requireAdminAuth', () => ({
  requireAdminAuth: (opts: unknown) => {
    authOptions.value = opts;
    return (handler: (req: unknown, ctx: unknown) => Promise<Response>) =>
      (req: unknown) => handler(req, { adminId: 'fin-1', role: 'FINANCE', totpVerified: true });
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
import { ChargebackError } from '@/lib/ledger/chargeback';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/finance/chargeback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockChargeback.mockResolvedValue({ recorded: true, alreadyDone: false, backstopped: 0 });
});

describe('POST /api/admin/finance/chargeback', () => {
  it('declares finance auth + step-up', () => {
    expect(authOptions.value).toMatchObject({ requireTotp: true, role: ['SUPER_ADMIN', 'FINANCE'] });
    expect(stepUpComposed.called).toBe(true);
  });

  it('mints an admin-chargeback sourceEventId when omitted and audits', async () => {
    const res = await POST(makeRequest({ bookingId: 'bk_1', amountMinor: 50000 }));
    expect(res.status).toBe(200);
    const call = mockChargeback.mock.calls[0][0];
    expect(call).toMatchObject({ bookingId: 'bk_1', amountMinor: 50000 });
    expect(call.sourceEventId).toMatch(/^admin-chargeback:/);
    expect(mockAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'admin-chargeback', actor: 'admin:fin-1', target: 'bk_1' })
    );
  });

  it('honours an explicit sourceEventId', async () => {
    await POST(makeRequest({ bookingId: 'bk_1', amountMinor: 50000, sourceEventId: 'dispute_123' }));
    expect(mockChargeback.mock.calls[0][0].sourceEventId).toBe('dispute_123');
  });

  it('returns 422 on a bad body (missing amount)', async () => {
    const res = await POST(makeRequest({ bookingId: 'bk_1' }));
    expect(res.status).toBe(422);
    expect(mockChargeback).not.toHaveBeenCalled();
  });

  it('returns 404 on booking_not_found', async () => {
    mockChargeback.mockRejectedValue(new ChargebackError('booking_not_found'));
    const res = await POST(makeRequest({ bookingId: 'bk_x', amountMinor: 1000 }));
    expect(res.status).toBe(404);
  });
});
