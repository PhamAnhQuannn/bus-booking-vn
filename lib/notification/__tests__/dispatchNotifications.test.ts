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

// prisma.$queryRaw → the atomic lease-claim (UPDATE … RETURNING). prisma.notificationLog
// .update → updateMock. There is NO booking model exposed here — proving the dispatcher
// performs no Booking writes (AC5 decoupling).
vi.mock('@/lib/core/db/client', () => ({
  prisma: {
    $queryRaw: (...a: unknown[]) => queryRawMock(...a),
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
  dispatchOne,
  backoffMs,
  MAX_ATTEMPTS,
} from '../dispatchNotifications';

const NOW = new Date('2026-06-02T12:00:00.000Z');

function row(over: Partial<{ id: string; channel: 'sms' | 'email'; template: string; recipient: string; payload: string; attemptCount: number; keySalt: number }> = {}) {
  return {
    id: 'log-1',
    channel: 'sms' as const,
    template: 'customerBookingPaid',
    recipient: '+8490xxxxxx1',
    payload: 'rendered body',
    attemptCount: 0,
    keySalt: 0,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: the claim ($queryRaw UPDATE … RETURNING) returns whatever queryRawMock yields.
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
      // row.id forwarded as the eSMS RequestId (idempotency key).
      requestId: 'log-1',
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
      // "<row id>:<keySalt>" as the Resend Idempotency-Key (#368): a cron re-run of
      // the SAME attempt cannot double-send, and the salt (not attemptCount) is what
      // moves the key on a real rejection.
      idempotencyKey: 'log-e:0',
    });
    expect(sendSmsBodyMock).not.toHaveBeenCalled();
  });

  it('#368: the idempotency key is salted by keySalt, NOT attemptCount', async () => {
    // The key must move only when the previous attempt was definitively rejected
    // (keySalt++), not on every attempt. A row that has retried (attemptCount=3) but
    // whose failures were all `unknown` (keySalt still 2, say) reuses the keySalt-2
    // key so Resend can dedupe — the attempt number is irrelevant to the key.
    queryRawMock.mockResolvedValueOnce([
      row({ id: 'log-e', channel: 'email', recipient: 'a@b.c', attemptCount: 3, keySalt: 2 }),
    ]);
    sendEmailMock.mockResolvedValueOnce({ ok: true, externalRef: 'stub_email_x' });

    await dispatchNotifications({} as never, { now: NOW });

    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: 'log-e:2' }),
    );
  });
});

describe('dispatchNotifications — #368 idempotency-key salt', () => {
  it("'unknown' outcome increments attemptCount but LEAVES keySalt unchanged (retry reuses key → vendor dedupes)", async () => {
    queryRawMock.mockResolvedValueOnce([
      row({ id: 'log-e', channel: 'email', recipient: 'a@b.c', attemptCount: 1, keySalt: 0 }),
    ]);
    // no answer from the vendor (timeout/socket) — may have been accepted.
    sendEmailMock.mockResolvedValueOnce({ ok: false, error: 'resend_exception', outcome: 'unknown' });

    await dispatchNotifications({} as never, { now: NOW });

    const call = updateMock.mock.calls[0][0];
    expect(call.data.status).toBe('failed');
    expect(call.data.attemptCount).toBe(2); // still advances (gating/backoff)
    expect(call.data.keySalt).toBe(0); // UNCHANGED → next attempt rebuilds 'log-e:0'
  });

  it("'rejected' outcome increments keySalt so the retry gets a FRESH key", async () => {
    queryRawMock.mockResolvedValueOnce([
      row({ id: 'log-e', channel: 'email', recipient: 'a@b.c', attemptCount: 1, keySalt: 0 }),
    ]);
    // vendor answered and refused — email was NOT sent.
    sendEmailMock.mockResolvedValueOnce({ ok: false, error: 'invalid_to', outcome: 'rejected' });

    await dispatchNotifications({} as never, { now: NOW });

    const call = updateMock.mock.calls[0][0];
    expect(call.data.attemptCount).toBe(2);
    expect(call.data.keySalt).toBe(1); // FRESH key next attempt → 'log-e:1'
  });

  it('a caught throw is treated as unknown — keySalt held', async () => {
    queryRawMock.mockResolvedValueOnce([
      row({ id: 'log-e', channel: 'email', recipient: 'a@b.c', attemptCount: 0, keySalt: 3 }),
    ]);
    sendEmailMock.mockRejectedValueOnce(new Error('socket hang up'));

    await dispatchNotifications({} as never, { now: NOW });

    const call = updateMock.mock.calls[0][0];
    expect(call.data.attemptCount).toBe(1);
    expect(call.data.keySalt).toBe(3); // a throw = unseen answer → do NOT advance
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

describe('dispatchOne — inline single-row delivery', () => {
  it('atomically claims + sends a due row and marks it sent (returns true)', async () => {
    // claimRowById → the row (leased); send OK → status='sent'.
    queryRawMock.mockResolvedValueOnce([row({ id: 'log-x', channel: 'email', recipient: 'a@b.c' })]);
    sendEmailMock.mockResolvedValueOnce({ ok: true, externalRef: 'r' });

    const ok = await dispatchOne('log-x', NOW);

    expect(ok).toBe(true);
    // claim query bound to THIS id.
    const sqlArg = queryRawMock.mock.calls[0][0] as { values?: unknown[] };
    expect(sqlArg.values).toContain('log-x');
    expect(sendEmailMock).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: 'log-x:0' }));
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'log-x' }, data: expect.objectContaining({ status: 'sent' }) }),
    );
  });

  it('no-op when a concurrent cron already claimed the row (claim returns nothing) — no send, no double-write', async () => {
    queryRawMock.mockResolvedValueOnce([]); // lease already held by the cron tick

    const ok = await dispatchOne('log-x', NOW);

    expect(ok).toBe(false);
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(sendSmsBodyMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('failed inline send → returns false, row left failed for the cron to retry', async () => {
    queryRawMock.mockResolvedValueOnce([row({ id: 'log-x', channel: 'email', recipient: 'a@b.c' })]);
    sendEmailMock.mockResolvedValueOnce({ ok: false, error: 'boom', outcome: 'unknown' });

    const ok = await dispatchOne('log-x', NOW);

    expect(ok).toBe(false);
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'failed' }) }),
    );
  });
});
