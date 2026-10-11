import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

/**
 * #836: a matched transfer that cannot be applied (booking already expired/paid, or
 * underpaid) must be tagged on its PaymentEvent, alerted to Sentry + the ops inbox,
 * and alerted exactly once per providerTxnId.
 */

vi.mock('server-only', () => ({}));

const h = vi.hoisted(() => {
  const tx = {
    paymentEvent: { updateMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    refundObligation: { create: vi.fn() },
  };
  return {
    tx,
    findUnique: vi.fn(),
    transaction: vi.fn(),
    applyPaid: vi.fn(),
    createNotificationLog: vi.fn(),
    captureMessage: vi.fn(),
    captureException: vi.fn(),
  };
});

vi.mock('@/lib/core/db/client', () => ({
  prisma: { booking: { findUnique: h.findUnique }, $transaction: h.transaction },
}));
vi.mock('@/lib/core/db/notificationLogRepo', () => ({ createNotificationLog: h.createNotificationLog }));
vi.mock('@/lib/observability', () => ({ captureMessage: h.captureMessage, captureException: h.captureException }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/analytics', () => ({ track: vi.fn(), sessionIdForBooking: () => Promise.resolve('s1') }));
vi.mock('@/lib/notification', () => ({
  renderTemplate: (t: string, p: Record<string, unknown>) => `${t}:${JSON.stringify(p)}`,
  dispatchOne: () => Promise.resolve(),
  OPS_ALERT_EMAIL: 'ops@example.com',
}));
vi.mock('@/lib/core/booking', () => ({ legalPredecessors: () => ['awaiting_payment'] }));
vi.mock('../applyPaidTransition', () => ({
  applyPaidStatusTransition: h.applyPaid,
  appendBookingPaidLedger: vi.fn(),
}));

import { processPaymentWebhook } from '../processWebhook';

function booking(status: string) {
  return { id: 'b1', bookingRef: 'BB-1', status, totalVnd: 100000, ticketCount: 1 };
}

function run(amount = 100000) {
  const gateway = {
    verifyWebhook: () => ({
      ok: true,
      event: { orderRef: 'BB-1', providerTxnId: 'tx-1', amount, currency: 'VND', status: 'paid' },
    }),
  };
  return processPaymentWebhook({
    rawBody: '{}',
    gateway: gateway as never,
    adapter: 'bank_transfer',
    proto: 'https',
    host: 'example.com',
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  h.transaction.mockImplementation(async (fn: (tx: typeof h.tx) => unknown) => fn(h.tx));
  h.tx.paymentEvent.updateMany.mockResolvedValue({ count: 0 });
  h.applyPaid.mockResolvedValue({ updated: 0, refundTriggered: false });
});

describe('unfulfilled payment alert (#836)', () => {
  it('late transfer on an expired booking: tags event, Sentry, ops email', async () => {
    h.findUnique.mockResolvedValue(booking('payment_failed_expired'));
    const res = await run();

    expect(res.status).toBe(200);
    expect(h.tx.paymentEvent.update).toHaveBeenCalledWith({
      where: { adapter_providerTxnId: { adapter: 'bank_transfer', providerTxnId: 'tx-1' } },
      data: { unmatchedReason: 'late_booking_terminal' },
    });
    expect(h.captureMessage).toHaveBeenCalledWith(
      'payment.webhook.unfulfilled_payment',
      expect.objectContaining({ providerTxnId: 'tx-1', reason: 'late_booking_terminal' })
    );
    expect(h.createNotificationLog).toHaveBeenCalledWith(
      expect.objectContaining({ template: 'opsLatePayment', recipient: 'ops@example.com', bookingId: 'b1' })
    );
  });

  it('duplicate transfer on a paid booking uses the duplicate reason', async () => {
    h.findUnique.mockResolvedValue(booking('paid'));
    await run();
    expect(h.tx.paymentEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { unmatchedReason: 'duplicate_booking_paid' } })
    );
  });

  it('underpaid transfer is tagged and alerted; booking not transitioned', async () => {
    h.findUnique.mockResolvedValue(booking('awaiting_payment'));
    await run(50000);
    expect(h.applyPaid).not.toHaveBeenCalled();
    expect(h.tx.paymentEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { unmatchedReason: 'underpaid' } })
    );
    expect(h.createNotificationLog).toHaveBeenCalledWith(expect.objectContaining({ template: 'opsLatePayment' }));
  });

  it('webhook retry (P2002 on the event insert) sends NO second alert', async () => {
    h.findUnique.mockResolvedValue(booking('payment_failed_expired'));
    h.tx.paymentEvent.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' })
    );
    const res = await run();
    expect(res.status).toBe(200);
    expect(h.captureMessage).not.toHaveBeenCalled();
    expect(h.createNotificationLog).not.toHaveBeenCalled();
  });

  it('a normal paid transition raises no unfulfilled alert', async () => {
    h.findUnique.mockResolvedValue({
      ...booking('awaiting_payment'),
      confirmationToken: 't',
      buyerPhone: '+8490xxxxxx1',
      buyerEmail: null,
      trip: {
        departureAt: new Date(),
        route: { origin: 'A', destination: 'B' },
        bus: { operator: { id: 'o1', contactPhone: '+8490xxxxxx2', notificationPhone: null, contactEmail: null } },
      },
    });
    h.applyPaid.mockResolvedValue({ updated: 1, refundTriggered: false });
    h.createNotificationLog.mockResolvedValue({ id: 'n' });
    await run();
    expect(h.captureMessage).not.toHaveBeenCalledWith('payment.webhook.unfulfilled_payment', expect.anything());
    expect(h.tx.paymentEvent.update).not.toHaveBeenCalled();
  });

  it('a P2002 on the ops notice (2nd unapplied transfer, same booking) is swallowed', async () => {
    h.findUnique.mockResolvedValue(booking('payment_failed_expired'));
    h.createNotificationLog.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' })
    );
    const res = await run();
    expect(res.status).toBe(200);
    expect(h.captureMessage).toHaveBeenCalled();
    expect(h.captureException).not.toHaveBeenCalled();
  });
});
