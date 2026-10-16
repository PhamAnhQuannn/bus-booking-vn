/**
 * #331: unit tests for POST /api/admin/finance/orphan-payments/[id]/link.
 *
 * Finance auth shape, id + body validation, every result → status mapping, audit on a
 * first link only, and the post-commit reconcile sweep (the existing paid path) — whose
 * failure must not fail the already-committed link.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockLink, mockAudit, mockRunJob, mockFindBooking, stepUpComposed, authOptions } = vi.hoisted(
  () => ({
    mockLink: vi.fn(),
    mockAudit: vi.fn(),
    mockRunJob: vi.fn(),
    mockFindBooking: vi.fn(),
    stepUpComposed: { called: false },
    authOptions: { value: undefined as unknown },
  })
);

vi.mock('@/lib/payment/orphanPayment', () => ({ linkOrphanPayment: mockLink }));
vi.mock('@/lib/jobs/runJob', () => ({ runJob: mockRunJob }));
vi.mock('@/lib/jobs/reconcilePayments', () => ({ reconcilePayments: 'reconcile-core' }));
vi.mock('@/lib/audit/adminAuditLog', () => ({ writeAdminAuditLog: mockAudit }));
vi.mock('@/lib/core/db/client', () => ({ prisma: { booking: { findUnique: mockFindBooking } } }));
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

const EVENT_ID = '11111111-2222-4333-8444-555555555555';
const BOOKING_ID = '99999999-2222-4333-8444-555555555555';

function makeRequest(body: unknown, id = EVENT_ID, raw?: string): NextRequest {
  return new NextRequest(`http://localhost/api/admin/finance/orphan-payments/${id}/link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: raw ?? JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockLink.mockResolvedValue({ ok: true, bookingId: BOOKING_ID, replay: false });
  mockRunJob.mockResolvedValue({ status: 'success', rowsAffected: 1 });
  mockFindBooking.mockResolvedValue({ status: 'paid' });
});

describe('POST /api/admin/finance/orphan-payments/[id]/link', () => {
  it('declares finance auth + step-up', () => {
    expect(authOptions.value).toMatchObject({ requireTotp: true, role: ['SUPER_ADMIN', 'FINANCE'] });
    expect(stepUpComposed.called).toBe(true);
  });

  it('links, audits, runs the reconcile sweep, and reports the booking status', async () => {
    const res = await POST(makeRequest({ bookingRef: ' BB-2026-abcd ' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, replay: false, bookingStatus: 'paid' });
    expect(mockLink).toHaveBeenCalledWith({ paymentEventId: EVENT_ID, bookingRef: 'BB-2026-abcd' });
    expect(mockAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'orphan-payment-link', actor: 'admin:fin-1', target: EVENT_ID })
    );
    expect(mockRunJob).toHaveBeenCalledWith('reconcile-payments', 'reconcile-core');
    // Audit committed before the sweep runs.
    expect(mockAudit.mock.invocationCallOrder[0]).toBeLessThan(mockRunJob.mock.invocationCallOrder[0]);
  });

  it('replay: 200, no second audit row, sweep still runs (idempotent)', async () => {
    mockLink.mockResolvedValueOnce({ ok: true, bookingId: BOOKING_ID, replay: true });
    const res = await POST(makeRequest({ bookingRef: 'BB-1' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ replay: true });
    expect(mockAudit).not.toHaveBeenCalled();
    expect(mockRunJob).toHaveBeenCalled();
  });

  it('200 even when the sweep throws — the link is committed, next tick pays', async () => {
    mockRunJob.mockRejectedValueOnce(new Error('db down'));
    mockFindBooking.mockResolvedValueOnce({ status: 'awaiting_payment' });
    const res = await POST(makeRequest({ bookingRef: 'BB-1' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, bookingStatus: 'awaiting_payment' });
  });

  it.each([
    ['not_found', 404, 'PAYMENT_EVENT_NOT_FOUND'],
    ['booking_not_found', 404, 'BOOKING_NOT_FOUND'],
    ['already_linked', 409, 'ALREADY_LINKED'],
    ['booking_not_awaiting_payment', 409, 'BOOKING_NOT_AWAITING_PAYMENT'],
    ['amount_mismatch', 422, 'AMOUNT_MISMATCH'],
    ['not_linkable', 422, 'NOT_LINKABLE'],
  ])('%s → %i %s, no audit, no sweep', async (error, status, code) => {
    mockLink.mockResolvedValueOnce({ ok: false, error });
    const res = await POST(makeRequest({ bookingRef: 'BB-1' }));
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error: code });
    expect(mockAudit).not.toHaveBeenCalled();
    expect(mockRunJob).not.toHaveBeenCalled();
  });

  it('400 INVALID on a non-uuid id', async () => {
    const res = await POST(makeRequest({ bookingRef: 'BB-1' }, 'not-a-uuid'));
    expect(res.status).toBe(400);
    expect(mockLink).not.toHaveBeenCalled();
  });

  it('400 INVALID on un-parseable JSON', async () => {
    const res = await POST(makeRequest(undefined, EVENT_ID, '{nope'));
    expect(res.status).toBe(400);
    expect(mockLink).not.toHaveBeenCalled();
  });

  it('422 INVALID on a missing booking ref', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(422);
    expect(mockLink).not.toHaveBeenCalled();
  });
});
