/**
 * Unit tests — HIBP Pwned Passwords k-anonymity client (#497).
 * fetch is stubbed; the network is never touched.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';

const { mockBreaker, mockWarn } = vi.hoisted(() => ({
  mockBreaker: {
    breakerState: vi.fn(),
    recordUpstreamFailure: vi.fn(),
    recordUpstreamSuccess: vi.fn(),
  },
  mockWarn: vi.fn(),
}));

vi.mock('@/lib/ratelimit', () => ({ createBreaker: () => mockBreaker }));
vi.mock('@/lib/logger', () => ({ logger: { warn: mockWarn, info: vi.fn(), error: vi.fn() } }));

import { isPasswordBreached, isHibpEnabled } from '../breachedPassword';

const PASSWORD = 'Password1';
const SHA1 = crypto.createHash('sha1').update(PASSWORD).digest('hex').toUpperCase();
const PREFIX = SHA1.slice(0, 5);
const SUFFIX = SHA1.slice(5);
const OTHER = 'A'.repeat(35);

const fetchMock = vi.fn();

function textResponse(body: string, status = 200): Response {
  return new Response(body, { status });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('HIBP_ENABLED', 'true');
  mockBreaker.breakerState.mockResolvedValue({ open: false, retryAfter: 0 });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('isPasswordBreached', () => {
  it('sends ONLY the 5-char SHA-1 prefix with Add-Padding, and reports a match', async () => {
    fetchMock.mockResolvedValue(textResponse(`${OTHER}:3\r\n${SUFFIX}:42\r\n`));
    await expect(isPasswordBreached(PASSWORD)).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.pwnedpasswords.com/range/${PREFIX}`);
    expect(url).not.toContain(SUFFIX);
    expect((init.headers as Record<string, string>)['Add-Padding']).toBe('true');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(mockBreaker.recordUpstreamSuccess).toHaveBeenCalled();
  });

  it('returns false when the suffix is not in the bucket', async () => {
    fetchMock.mockResolvedValue(textResponse(`${OTHER}:3\r\n${'B'.repeat(35)}:1\r\n`));
    await expect(isPasswordBreached(PASSWORD)).resolves.toBe(false);
  });

  it('ignores padding lines (count 0) even when the suffix matches', async () => {
    fetchMock.mockResolvedValue(textResponse(`${OTHER}:3\r\n${SUFFIX}:0\r\n`));
    await expect(isPasswordBreached(PASSWORD)).resolves.toBe(false);
  });

  it('fails open on timeout and records a breaker failure', async () => {
    fetchMock.mockRejectedValue(new DOMException('The operation timed out.', 'TimeoutError'));
    await expect(isPasswordBreached(PASSWORD)).resolves.toBe(false);
    expect(mockBreaker.recordUpstreamFailure).toHaveBeenCalled();
    expect(mockWarn).toHaveBeenCalledWith({ errName: 'TimeoutError' }, expect.stringContaining('fail-open'));
  });

  it('fails open on 5xx and records a breaker failure', async () => {
    fetchMock.mockResolvedValue(textResponse('oops', 503));
    await expect(isPasswordBreached(PASSWORD)).resolves.toBe(false);
    expect(mockBreaker.recordUpstreamFailure).toHaveBeenCalled();
  });

  it('fails open on a network error', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    await expect(isPasswordBreached(PASSWORD)).resolves.toBe(false);
  });

  it('fails open WITHOUT calling HIBP when the breaker is open', async () => {
    mockBreaker.breakerState.mockResolvedValue({ open: true, retryAfter: 30 });
    await expect(isPasswordBreached(PASSWORD)).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never logs the password, its digest, or the prefix', async () => {
    fetchMock.mockResolvedValue(textResponse('oops', 500));
    await isPasswordBreached(PASSWORD);
    const logged = JSON.stringify(mockWarn.mock.calls);
    expect(logged).not.toContain(PASSWORD);
    expect(logged).not.toContain(PREFIX);
    expect(logged).not.toContain(SUFFIX);
  });

  it('is a no-op (no network) when disabled', async () => {
    vi.stubEnv('HIBP_ENABLED', 'false');
    await expect(isPasswordBreached(PASSWORD)).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('isHibpEnabled', () => {
  it('defaults OFF outside production when unset', () => {
    vi.stubEnv('HIBP_ENABLED', '');
    vi.stubEnv('NODE_ENV', 'test');
    expect(isHibpEnabled()).toBe(false);
  });

  it('defaults ON in production when unset', () => {
    vi.stubEnv('HIBP_ENABLED', '');
    vi.stubEnv('NODE_ENV', 'production');
    expect(isHibpEnabled()).toBe(true);
  });

  it('explicit "false" wins in production', () => {
    vi.stubEnv('HIBP_ENABLED', 'false');
    vi.stubEnv('NODE_ENV', 'production');
    expect(isHibpEnabled()).toBe(false);
  });
});
