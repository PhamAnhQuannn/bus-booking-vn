/**
 * Unit tests for the notification dispatcher core (Issue 058, step D + F).
 *
 * Mocks the Prisma client (claim $transaction → raw query; per-row update) and
 * the two channel adapters. Asserts:
 *   - due rows claimed via the claim query, success → status='sent'
 *   - failure → status='failed' + attemptCount++ + lastError + backoff nextAttemptAt
 *   - thrown adapter is caught (no crash) → row failed, never the booking (AC5)
 *   - MAX_ATTEMPTS / scheduledFor / nextAttemptAt gating lives in the claim SQL;
 *     we assert the claim predicate is parameterized with NOW/MAX_ATTEMPTS so
 *     exhausted + not-yet-due rows are excluded by the query.
 *   - email channel routes to sendEmail; sms channel routes to sendSmsBody.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Issue 061: the failure path now alerts via captureException. Mock it so the
// test stays a pure unit (no env validation / real logger emit) — additive,
// the row-update assertions are unchanged.
vi.mock('@/lib/observability', () => ({
  captureException: vi.fn(),
}));

const updateMock = vi.fn();
const queryRawMock = vi.fn();
const txTransactionMock = vi.fn();

// prisma.$transaction(cb) → invoke cb with a tx exposing $queryRaw (the claim).
// prisma.notificationLog.update → updateMock. There is NO booking model exposed
// here — proving the dispatcher performs no Booking writes (AC5 decoupling).
vi.mock('@/lib/core/db/client', () => ({
  prisma: {
    $transaction: (cb: (tx: unknown) => unknown) =>
      txTransactionMock(cb),
    notificationLog: { update: (args: unknown) => updateMock(args) },
  },
}));

const sendSmsBodyMock = vi.fn();
const sendEmailMock = vi.fn();

vi.mock('@/lib/notification/esms', () => ({
  sendSmsBody: (args: unknown) => sendSmsBodyMock(args),
}));
vi.mock('@/lib/notification/email', () => ({
  sendEmail: (args: unknown) => sendEmailMock(args),
}));

import {
  dispatchNotifications,
  backoffMs,
  MAX_ATTEMPTS,
} from '../dispatchNotifications';

const NOW = new Date('2026-06-02T12:00:00.000Z');

function row(over: Partial<{ id: string; channel: 'sms' | 'email'; template: string; recipient: string; payload: string; attemptCount: number }> = {}) {
  return {
    id: 'log-1',
    channel: 'sms' as const,
    template: 'customerBookingPaid',
    recipient: '+8490xxxxxx1',
    payload: 'rendered body',
    attemptCount: 0,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: claim returns whatever queryRawMock yields; the tx callback is run
  // with a fake tx exposing $queryRaw.
  txTransactionMock.mockImplementation(async (cb: (tx: unknown) => unknown) =>
    cb({ $queryRaw: (...a: unknown[]) => queryRawMock(...a) })
  );
  updateMock.mockResolvedValue({});
});

describe('dispatchNotifications — success path', () => {
  it('claims due rows and marks a successful SMS row sent', async () => {
    queryRawMock.mockResolvedValueOnce([row()]);
    sendSmsBodyMock.mockResolvedValueOnce({ ok: true, externalRef: 'stub_abc' });

    const res = await dispatchNotifications({} as never, { now: NOW });

    expect(res).toEqual({ rowsAffected: 1, status: 'success' });
    expect(sendSmsBodyMock).toHaveBeenCalledWith({
      to: '+8490xxxxxx1',
      template: 'customerBookingPaid',
      body: 'rendered body',
    });
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: 'log-1' },
      data: {
        status: 'sent',
        sentAt: NOW,
        externalRef: 'stub_abc',
        attemptCount: 1,
        lastError: null,
        nextAttemptAt: null,
      },
    });
  });

  it('routes email-channel rows to sendEmail', async () => {
    queryRawMock.mockResolvedValueOnce([row({ id: 'log-e', channel: 'email', recipient: 'a@b.c' })]);
    sendEmailMock.mockResolvedValueOnce({ ok: true, externalRef: 'stub_email_x' });

    const res = await dispatchNotifications({} as never, { now: NOW });

    expect(res.rowsAffected).toBe(1);
    expect(sendEmailMock).toHaveBeenCalledWith({
      to: 'a@b.c',
      template: 'customerBookingPaid',
      payload: 'rendered body',
    });
    expect(sendSmsBodyMock).not.toHaveBeenCalled();
  });
});

describe('dispatchNotifications — failure path (retry + backoff)', () => {
  it('marks a failed row status=failed, increments attemptCount, sets backoff nextAttemptAt + lastError', async () => {
    queryRawMock.mockResolvedValueOnce([row({ attemptCount: 1 })]);
    sendSmsBodyMock.mockResolvedValueOnce({ ok: false, error: 'provider down' });

    const res = await dispatchNotifications({} as never, { now: NOW });

    expect(res.rowsAffected).toBe(0); // nothing delivered
    const call = updateMock.mock.calls[0][0];
    expect(call.where).toEqual({ id: 'log-1' });
    expect(call.data.status).toBe('failed');
    expect(call.data.attemptCount).toBe(2); // 1 → 2
    expect(call.data.lastError).toBe('provider down');
    // backoff for attemptCount=2 → 4 minutes
    expect(call.data.nextAttemptAt).toEqual(backoffMs(2, NOW));
    expect(call.data.nextAttemptAt.getTime()).toBe(NOW.getTime() + 4 * 60_000);
  });

  it('AC5 decoupling: a thrown adapter is caught — row goes failed, NO booking write', async () => {
    queryRawMock.mockResolvedValueOnce([row()]);
    sendSmsBodyMock.mockRejectedValueOnce(new Error('socket hang up'));

    const res = await dispatchNotifications({} as never, { now: NOW });

    expect(res.rowsAffected).toBe(0);
    const call = updateMock.mock.calls[0][0];
    expect(call.data.status).toBe('failed');
    expect(call.data.attemptCount).toBe(1);
    expect(call.data.lastError).toBe('socket hang up');
    // Only ONE update, and it targets the NotificationLog row — the mocked prisma
    // exposes no booking model at all, so any booking write would have thrown.
    expect(updateMock).toHaveBeenCalledTimes(1);
  });

  it('backoff is capped (attemptCount high → 30 min, not 2^N)', () => {
    // 2^10 minutes would be 1024; cap is 30.
    expect(backoffMs(10, NOW).getTime()).toBe(NOW.getTime() + 30 * 60_000);
  });
});

describe('dispatchNotifications — claim predicate gating', () => {
  it('claim query is parameterized with MAX_ATTEMPTS and the now instant (exhausted/not-due rows excluded by SQL)', async () => {
    queryRawMock.mockResolvedValueOnce([]); // nothing due

    const res = await dispatchNotifications({} as never, { now: NOW });

    expect(res).toEqual({ rowsAffected: 0, status: 'success' });
    expect(queryRawMock).toHaveBeenCalledTimes(1);
    // The Prisma.sql template carries `values` — assert MAX_ATTEMPTS and NOW are
    // bound parameters so the DB-side WHERE excludes exhausted + not-yet-due rows.
    const sqlArg = queryRawMock.mock.calls[0][0] as { values?: unknown[] };
    expect(sqlArg.values).toContain(MAX_ATTEMPTS);
    expect(sqlArg.values).toContain(NOW);
  });

  it('processes a batch — multiple due rows each get an update', async () => {
    queryRawMock.mockResolvedValueOnce([
      row({ id: 'a' }),
      row({ id: 'b', channel: 'email', recipient: 'e@x.y' }),
    ]);
    sendSmsBodyMock.mockResolvedValueOnce({ ok: true, externalRef: 'r1' });
    sendEmailMock.mockResolvedValueOnce({ ok: true, externalRef: 'r2' });

    const res = await dispatchNotifications({} as never, { now: NOW });

    expect(res.rowsAffected).toBe(2);
    expect(updateMock).toHaveBeenCalledTimes(2);
  });
});
