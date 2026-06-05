/**
 * Unit tests for the Sentry abstraction (Issue 061, AC4).
 *
 * Proves:
 *   - captureException PII-scrubs the context (phone / accessToken / otpProof /
 *     nested codeHash / recipient → '[REDACTED]') before it reaches the sink.
 *   - SENTRY_DSN unset → fallback sink (logger.error with sentry:'fallback').
 *   - non-throwing on weird input (circular object, non-Error throw).
 *   - captureMessage scrubs an inline `phone=...` token in the message.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const errorMock = vi.fn();
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: (...a: unknown[]) => errorMock(...a) },
}));

// Default: SENTRY_DSN unset → fallback sink.
const getEnvMock = vi.fn(() => ({ SENTRY_DSN: undefined as string | undefined }));
vi.mock('@/lib/config/env', () => ({
  getEnv: () => getEnvMock(),
}));

import { captureException, captureMessage, scrubPii } from '../sentry';

beforeEach(() => {
  vi.clearAllMocks();
  getEnvMock.mockReturnValue({ SENTRY_DSN: undefined });
});

describe('scrubPii', () => {
  it('masks sensitive keys at any depth, case-insensitively', () => {
    const out = scrubPii({
      phone: '+84901234567',
      accessToken: 'jwt.abc',
      otpProof: 'proof.jwt',
      nested: { codeHash: 'a'.repeat(64), keep: 'ok' },
      list: [{ recipient: '+84900000000' }, 'plain'],
      AccessToken: 'mixedcase',
    }) as Record<string, unknown>;

    expect(out.phone).toBe('[REDACTED]');
    expect(out.accessToken).toBe('[REDACTED]');
    expect(out.otpProof).toBe('[REDACTED]');
    expect((out.nested as Record<string, unknown>).codeHash).toBe('[REDACTED]');
    expect((out.nested as Record<string, unknown>).keep).toBe('ok');
    expect((out.list as unknown[])[0]).toEqual({ recipient: '[REDACTED]' });
    expect((out.list as unknown[])[1]).toBe('plain');
    expect(out.AccessToken).toBe('[REDACTED]'); // case-insensitive
  });

  it('is cycle-safe', () => {
    const a: Record<string, unknown> = { keep: 1 };
    a.self = a;
    const out = scrubPii(a) as Record<string, unknown>;
    expect(out.keep).toBe(1);
    expect(out.self).toBe('[Circular]');
  });
});

describe('captureException', () => {
  it('scrubs PII context and uses the fallback sink when SENTRY_DSN is unset', () => {
    captureException(new Error('boom'), {
      phone: '+84901234567',
      accessToken: 'jwt.abc',
      otpProof: 'proof.jwt',
      bookingRef: 'BB-2026-abcd-efgh',
    });

    expect(errorMock).toHaveBeenCalledTimes(1);
    const [payload, message] = errorMock.mock.calls[0];
    expect(message).toBe('boom');
    expect(payload.sentry).toBe('fallback');
    expect(payload.phone).toBe('[REDACTED]');
    expect(payload.accessToken).toBe('[REDACTED]');
    expect(payload.otpProof).toBe('[REDACTED]');
    // non-PII reconciliation field passes through
    expect(payload.bookingRef).toBe('BB-2026-abcd-efgh');
    // the error itself is normalized, never raw
    expect(payload.err).toEqual({ name: 'Error', message: 'boom' });
  });

  it('forwards (still scrubbed) when SENTRY_DSN is set', () => {
    getEnvMock.mockReturnValue({ SENTRY_DSN: 'https://k@o.ingest.sentry.io/1' });
    captureException(new Error('boom'), { phone: '+84901234567' });
    const [payload] = errorMock.mock.calls[0];
    expect(payload.sentry).toBe('forward');
    expect(payload.phone).toBe('[REDACTED]');
  });

  it('does not throw on a non-Error throw value', () => {
    expect(() => captureException('a raw string', { otp: '123456' })).not.toThrow();
    const [payload, message] = errorMock.mock.calls[0];
    expect(message).toBe('a raw string');
    expect(payload.otp).toBe('[REDACTED]');
  });

  it('does not throw on a circular context object', () => {
    const ctx: Record<string, unknown> = { a: 1 };
    ctx.self = ctx;
    expect(() => captureException(new Error('x'), ctx)).not.toThrow();
  });

  it('does not throw when env validation throws (behaves as fallback)', () => {
    getEnvMock.mockImplementation(() => {
      throw new Error('env not validated');
    });
    expect(() => captureException(new Error('x'))).not.toThrow();
    const [payload] = errorMock.mock.calls[0];
    expect(payload.sentry).toBe('fallback');
  });
});

describe('captureMessage', () => {
  it('scrubs an inline phone token in the message and uses the fallback sink', () => {
    captureMessage('login failed for phone=+84901234567', { area: 'auth' });
    const [payload, message] = errorMock.mock.calls[0];
    expect(message).toBe('login failed for phone=[REDACTED]');
    expect(payload.sentry).toBe('fallback');
    expect(payload.area).toBe('auth');
  });
});
