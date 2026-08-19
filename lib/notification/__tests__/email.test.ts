/**
 * Unit tests for the email channel stub (Issue 058, step C).
 *
 * The real email provider is deferred (project memory: payment-deferral-strategy)
 * — until then sendEmail is a deterministic no-network stub mirroring esms.ts:
 * always ok:true with a stub externalRef, never throws.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Resend-path tests (below) mock the env + the resend SDK. The stub-path tests
// above do not touch either — emailStubbed() reads process.env.EMAIL_PROVIDER
// directly and short-circuits before getEnv()/resend are used.
const emailsSendMock = vi.fn();
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: (...a: unknown[]) => emailsSendMock(...a) };
  },
}));
vi.mock('@/lib/core/config', () => ({
  getEnv: () => ({
    RESEND_API_KEY: 'test_key',
    EMAIL_FROM: 'noreply@test.dev',
    EMAIL_FROM_RECEIPT: 'bienlai@test.dev',
  }),
}));

import { sendEmail, renderEmailSubject, _resetResendClient } from '../email';

describe('sendEmail (stub)', () => {
  it('deterministically succeeds with a stub email externalRef', async () => {
    const res = await sendEmail({
      to: 'buyer@example.com',
      template: 'customerBookingPaid',
      payload: 'rendered body',
    });
    expect(res.ok).toBe(true);
    expect(res.externalRef).toMatch(/^stub_email_/);
  });

  it('accepts a structured payload as well as a string', async () => {
    const res = await sendEmail({
      to: 'op@example.com',
      template: 'operatorNewBooking',
      payload: { ticketCount: 2, route: 'A - B' },
    });
    expect(res.ok).toBe(true);
    expect(res.externalRef).toMatch(/^stub_email_/);
  });

  it('never throws (provider-failure surfaces as ok:false, not an exception)', async () => {
    // The stub path cannot fail; this asserts the call resolves rather than rejects.
    await expect(
      sendEmail({ to: 'x@y.z', template: 'unknown_template', payload: 'b' })
    ).resolves.toMatchObject({ ok: true });
  });

  it('renderEmailSubject maps known templates and falls back generically', () => {
    expect(renderEmailSubject('customerBookingPaid')).toContain('BusBookVN');
    expect(renderEmailSubject('totally_unknown')).toBe('BusBookVN');
  });
});

describe('sendEmail (resend path — idempotency, #335)', () => {
  const prevProvider = process.env.EMAIL_PROVIDER;

  beforeEach(() => {
    vi.clearAllMocks();
    _resetResendClient();
    process.env.EMAIL_PROVIDER = 'resend';
    emailsSendMock.mockResolvedValue({ data: { id: 'resend_123' }, error: null });
  });
  afterEach(() => {
    // Restore by DELETING when it was unset. `process.env.X = undefined` writes
    // the literal string "undefined", and z.enum([...]).default('stub') does not
    // apply to a present-but-invalid value — so a later test in the same worker
    // calling getEnv() would fail env validation. Order-dependent; green by luck.
    if (prevProvider === undefined) delete process.env.EMAIL_PROVIDER;
    else process.env.EMAIL_PROVIDER = prevProvider;
    _resetResendClient();
  });

  it('forwards idempotencyKey to emails.send as the second options arg', async () => {
    const res = await sendEmail({
      to: 'buyer@example.com',
      template: 'customerBookingPaid',
      payload: 'rendered body',
      idempotencyKey: 'log-42',
    });

    expect(res).toEqual({ ok: true, externalRef: 'resend_123' });
    expect(emailsSendMock).toHaveBeenCalledTimes(1);
    const [payload, options] = emailsSendMock.mock.calls[0];
    expect(payload).toMatchObject({ to: 'buyer@example.com', from: 'noreply@test.dev' });
    expect(options).toEqual({ idempotencyKey: 'log-42' });
  });

  it('omits the options arg when no idempotencyKey is provided', async () => {
    await sendEmail({ to: 'x@y.z', template: 'customerBookingPaid', payload: 'b' });

    const [, options] = emailsSendMock.mock.calls[0];
    expect(options).toBeUndefined();
  });

  it('sends the receipt (ticketReady) from the dedicated biên-lai sender', async () => {
    await sendEmail({
      to: 'buyer@example.com',
      template: 'ticketReady',
      payload: JSON.stringify({ bookingRef: 'BB-1', amount: '100.000đ' }),
    });
    const [payload] = emailsSendMock.mock.calls[0];
    expect(payload).toMatchObject({ from: 'bienlai@test.dev' });
  });

  it('sends non-receipt email from the default sender', async () => {
    await sendEmail({ to: 'x@y.z', template: 'customerBookingPaid', payload: 'b' });
    const [payload] = emailsSendMock.mock.calls[0];
    expect(payload).toMatchObject({ from: 'noreply@test.dev' });
  });

  // #393.2: the outcome discriminator (#620) — 'rejected' is safe to re-key, 'unknown'
  // must hold the salt so the retry dedupes instead of sending a second real email.
  // Every case here went untested; only the success (error:null) branch was exercised.
  it('definite 4xx refusal → ok:false, outcome "rejected"', async () => {
    emailsSendMock.mockResolvedValueOnce({
      data: null,
      error: { name: 'validation_error', statusCode: 400, message: 'Invalid `to` field' },
    });
    const res = await sendEmail({ to: 'x@y.z', template: 'opsUnmatchedPayment', payload: 'b' });
    expect(res).toEqual({ ok: false, error: 'Invalid `to` field', outcome: 'rejected' });
  });

  it('ambiguous 5xx → ok:false, outcome "unknown" (hold the key, may have been accepted)', async () => {
    emailsSendMock.mockResolvedValueOnce({
      data: null,
      error: { name: 'internal_server_error', statusCode: 500, message: 'server error' },
    });
    const res = await sendEmail({ to: 'x@y.z', template: 'opsUnmatchedPayment', payload: 'b' });
    expect(res).toEqual({ ok: false, error: 'server error', outcome: 'unknown' });
  });

  it('thrown exception (timeout/socket) → ok:false, outcome "unknown", never rejects', async () => {
    emailsSendMock.mockRejectedValueOnce(new Error('socket hang up'));
    await expect(
      sendEmail({ to: 'x@y.z', template: 'opsUnmatchedPayment', payload: 'b' })
    ).resolves.toEqual({ ok: false, error: 'resend_exception', outcome: 'unknown' });
  });
});
