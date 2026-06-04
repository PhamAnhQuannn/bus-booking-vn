/**
 * Unit tests for POST /api/bookings/initiate (online-only: momo | zalopay | card).
 *
 * Online-only (Issue 039): the cash rail was removed. A `paymentMethod: 'cash'`
 * body is now rejected at the zod-enum layer (400 INVALID).
 *
 * Mocks: initiateOnlineBooking orchestrator, extractHoldCookie, ratelimit.
 *
 * Covers status mapping:
 *   200  ok           — orchestrator success (payUrl)
 *   400  INVALID      — non-JSON body, missing fields, unknown paymentMethod, cash
 *   403  FORBIDDEN    — no cookie OR cookie holdId ≠ body holdId
 *   404  NOT_FOUND    — orchestrator returns hold_not_found
 *   409  CONFLICT     — orchestrator returns hold_expired OR trip_departed
 *   429  TOO_MANY     — rate limiter denies
 *   502  GATEWAY_ERR  — orchestrator returns gateway_error
 *   503  UNAVAILABLE  — orchestrator returns ref_collision
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/booking/initiateOnlineBooking', () => ({
  initiateOnlineBooking: vi.fn(),
}));

vi.mock('@/lib/security/holdCookie', () => ({
  extractHoldCookie: vi.fn(),
  COOKIE_NAME: 'bb_hold',
}));

vi.mock('@/lib/ratelimit', async (importOriginal) => ({
  ...(await importOriginal()),
  ratelimit: {
    limit: vi.fn(),
  },
}));

// Funnel tracking is fire-and-forget; mock so importing the route doesn't pull in
// the real Prisma client (no DATABASE_URL in unit env).
vi.mock('@/lib/analytics/track', () => ({
  track: vi.fn(),
  sessionIdFromRequest: vi.fn(() => null),
}));

// The route imports getCustomerOptional from requireCustomerAuth, which (Issue 066)
// statically imports the prisma singleton for its suspension gate. Mock the client
// so the import doesn't construct the real Pool (no DATABASE_URL in unit env).
vi.mock('@/lib/core/db/client', () => ({ prisma: { customer: { findUnique: vi.fn() } } }));

import { POST } from '../initiate/route';
import { initiateOnlineBooking } from '@/lib/booking';
import { extractHoldCookie } from '@/lib/security';
import { ratelimit } from '@/lib/ratelimit';
import { CONSENT_VERSION } from '@/lib/booking';
import { NextRequest } from 'next/server';

const HOLD_ID = 'ckabcdefghijklmnopqrstuvwx';
// Issue 089: a valid consent block — both true + current version. Threaded into
// the default request body so the consent gate passes for non-consent tests.
const VALID_CONSENTS = { noRefund: true, piiStorage: true, version: CONSENT_VERSION };
const BOOKING_ID = '01975f3b-3f4a-7c2a-8b1c-deadbeefcafe';
const CONFIRMATION_TOKEN = 'A'.repeat(32);
const PAY_URL = 'https://payment.momo.vn/pay/app?orderId=BB-2026-test-0001';

interface RequestOpts {
  body?: unknown;
  cookie?: string;
  ip?: string;
  raw?: string;
  auth?: string;
}

function makeRequest(opts: RequestOpts = {}): NextRequest {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-forwarded-for': opts.ip ?? '10.0.0.1',
    host: 'example.test',
    'x-forwarded-proto': 'https',
  };
  if (opts.cookie) headers.cookie = opts.cookie;
  if (opts.auth) headers.authorization = opts.auth;
  return new NextRequest('https://example.test/api/bookings/initiate', {
    method: 'POST',
    headers,
    body:
      opts.raw ??
      JSON.stringify(
        opts.body ?? { holdId: HOLD_ID, paymentMethod: 'momo', consents: VALID_CONSENTS }
      ),
  });
}

function allowRatelimit() {
  vi.mocked(ratelimit.limit).mockResolvedValueOnce({
    allowed: true,
    remaining: 59,
    retryAfter: 0,
  });
}

function denyRatelimit(retryAfter = 30) {
  vi.mocked(ratelimit.limit).mockResolvedValueOnce({
    allowed: false,
    remaining: 0,
    retryAfter,
  });
}

function matchCookie(holdId = HOLD_ID) {
  vi.mocked(extractHoldCookie).mockReturnValueOnce({
    holdId,
    expiresAtISO: '2026-05-17T13:30:00.000Z',
  });
}

function mockOnlineOk() {
  vi.mocked(initiateOnlineBooking).mockResolvedValueOnce({
    ok: true,
    bookingId: BOOKING_ID,
    confirmationToken: CONFIRMATION_TOKEN,
    payUrl: PAY_URL,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/bookings/initiate — happy path', () => {
  it('returns 200 with bookingId + payUrl on orchestrator success', async () => {
    allowRatelimit();
    matchCookie();
    mockOnlineOk();

    const res = await POST(makeRequest({ cookie: `bb_hold=signedvalue` }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.bookingId).toBe(BOOKING_ID);
    expect(json.payUrl).toBe(PAY_URL);
    expect(res.headers.get('Cache-Control')).toContain('no-store');
  });

  it('passes baseUrl derived from x-forwarded-proto + host to orchestrator', async () => {
    allowRatelimit();
    matchCookie();
    mockOnlineOk();

    await POST(makeRequest({ cookie: `bb_hold=signedvalue` }));

    const call = vi.mocked(initiateOnlineBooking).mock.calls[0]?.[0];
    expect(call?.holdId).toBe(HOLD_ID);
    expect(call?.baseUrl).toBe('https://example.test');
    expect(call?.method).toBe('momo');
  });

  it('threads the accepted consent version to the orchestrator (Issue 089)', async () => {
    allowRatelimit();
    matchCookie();
    mockOnlineOk();

    await POST(makeRequest({ cookie: `bb_hold=signedvalue` }));

    const call = vi.mocked(initiateOnlineBooking).mock.calls[0]?.[0];
    expect(call?.consentVersion).toBe(CONSENT_VERSION);
  });
});

describe('POST /api/bookings/initiate — consent gate (Issue 089)', () => {
  // The consent gate runs AFTER rate-limit + body parse but BEFORE the cookie
  // check, so these tests do not prime extractHoldCookie (priming a mockReturnValueOnce
  // that is never consumed would leak into a later test — vi.clearAllMocks does not
  // drain queued one-time return values).
  it('returns 422 consent_required when noRefund is false', async () => {
    allowRatelimit();

    const res = await POST(
      makeRequest({
        body: {
          holdId: HOLD_ID,
          paymentMethod: 'momo',
          consents: { noRefund: false, piiStorage: true, version: CONSENT_VERSION },
        },
        cookie: `bb_hold=signedvalue`,
      })
    );
    const json = await res.json();

    expect(res.status).toBe(422);
    expect(json.error).toBe('consent_required');
    // No booking is created when consent is missing.
    expect(initiateOnlineBooking).not.toHaveBeenCalled();
  });

  it('returns 422 consent_required when piiStorage is false', async () => {
    allowRatelimit();

    const res = await POST(
      makeRequest({
        body: {
          holdId: HOLD_ID,
          paymentMethod: 'momo',
          consents: { noRefund: true, piiStorage: false, version: CONSENT_VERSION },
        },
        cookie: `bb_hold=signedvalue`,
      })
    );
    const json = await res.json();

    expect(res.status).toBe(422);
    expect(json.error).toBe('consent_required');
    expect(initiateOnlineBooking).not.toHaveBeenCalled();
  });

  it('returns 422 consent_required when the consent version is stale', async () => {
    allowRatelimit();

    const res = await POST(
      makeRequest({
        body: {
          holdId: HOLD_ID,
          paymentMethod: 'momo',
          consents: { noRefund: true, piiStorage: true, version: '1999-01-01' },
        },
        cookie: `bb_hold=signedvalue`,
      })
    );
    const json = await res.json();

    expect(res.status).toBe(422);
    expect(json.error).toBe('consent_required');
    expect(initiateOnlineBooking).not.toHaveBeenCalled();
  });

  it('returns 400 INVALID when the consents block is missing entirely', async () => {
    allowRatelimit();

    const res = await POST(
      makeRequest({
        body: { holdId: HOLD_ID, paymentMethod: 'momo' },
        cookie: `bb_hold=signedvalue`,
      })
    );
    const json = await res.json();

    // Missing block fails zod shape → generic 400, not the value-gate 422.
    expect(res.status).toBe(400);
    expect(json.error).toBe('INVALID');
    expect(initiateOnlineBooking).not.toHaveBeenCalled();
  });
});

describe('POST /api/bookings/initiate — auth', () => {
  it('returns 403 when no cookie present', async () => {
    allowRatelimit();
    vi.mocked(extractHoldCookie).mockReturnValueOnce(null);

    const res = await POST(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe('FORBIDDEN');
    expect(initiateOnlineBooking).not.toHaveBeenCalled();
  });

  it('returns 403 when cookie holdId does not match body holdId', async () => {
    allowRatelimit();
    matchCookie('different-hold-id');

    const res = await POST(makeRequest({ cookie: `bb_hold=signedvalue` }));
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe('FORBIDDEN');
    expect(initiateOnlineBooking).not.toHaveBeenCalled();
  });
});

describe('POST /api/bookings/initiate — input validation', () => {
  it('returns 400 INVALID on non-JSON body', async () => {
    allowRatelimit();

    const res = await POST(makeRequest({ raw: 'not-json{', cookie: `bb_hold=x` }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('INVALID');
    expect(extractHoldCookie).not.toHaveBeenCalled();
  });

  it('returns 400 INVALID when holdId missing', async () => {
    allowRatelimit();

    const res = await POST(makeRequest({ body: { paymentMethod: 'momo' }, cookie: `bb_hold=x` }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('INVALID');
  });

  it('returns 400 INVALID when paymentMethod is an unknown value', async () => {
    allowRatelimit();

    const res = await POST(
      makeRequest({ body: { holdId: HOLD_ID, paymentMethod: 'bitcoin' }, cookie: `bb_hold=x` })
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('INVALID');
  });

  it('rejects the removed cash rail with 400 INVALID (Issue 039)', async () => {
    allowRatelimit();

    const res = await POST(
      makeRequest({ body: { holdId: HOLD_ID, paymentMethod: 'cash' }, cookie: `bb_hold=x` })
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('INVALID');
    // The online orchestrator must never be reached for a cash body.
    expect(initiateOnlineBooking).not.toHaveBeenCalled();
  });

  it('does not echo raw input back in 400 body (enumeration guard)', async () => {
    allowRatelimit();

    const res = await POST(
      makeRequest({
        body: { holdId: 'PROBE_VALUE', paymentMethod: 'NOT_CASH' },
        cookie: `bb_hold=x`,
      })
    );
    const json = await res.json();

    expect(JSON.stringify(json)).not.toContain('PROBE_VALUE');
    expect(JSON.stringify(json)).not.toContain('NOT_CASH');
  });
});

describe('POST /api/bookings/initiate — orchestrator error mapping', () => {
  it('returns 404 NOT_FOUND on hold_not_found', async () => {
    allowRatelimit();
    matchCookie();
    vi.mocked(initiateOnlineBooking).mockResolvedValueOnce({ ok: false, error: 'hold_not_found' });

    const res = await POST(makeRequest({ cookie: `bb_hold=x` }));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe('NOT_FOUND');
  });

  it('returns 409 HOLD_EXPIRED on hold_expired', async () => {
    allowRatelimit();
    matchCookie();
    vi.mocked(initiateOnlineBooking).mockResolvedValueOnce({ ok: false, error: 'hold_expired' });

    const res = await POST(makeRequest({ cookie: `bb_hold=x` }));
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toBe('HOLD_EXPIRED');
  });

  it('returns 409 TRIP_DEPARTED on trip_departed', async () => {
    allowRatelimit();
    matchCookie();
    vi.mocked(initiateOnlineBooking).mockResolvedValueOnce({ ok: false, error: 'trip_departed' });

    const res = await POST(makeRequest({ cookie: `bb_hold=x` }));
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toBe('TRIP_DEPARTED');
  });

  it('returns 409 OPERATOR_NOT_BOOKABLE on operator_not_bookable (Issue 046)', async () => {
    allowRatelimit();
    matchCookie();
    vi.mocked(initiateOnlineBooking).mockResolvedValueOnce({
      ok: false,
      error: 'operator_not_bookable',
    });

    const res = await POST(makeRequest({ cookie: `bb_hold=x` }));
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toBe('OPERATOR_NOT_BOOKABLE');
  });

  it('returns 503 UNAVAILABLE on ref_collision', async () => {
    allowRatelimit();
    matchCookie();
    vi.mocked(initiateOnlineBooking).mockResolvedValueOnce({ ok: false, error: 'ref_collision' });

    const res = await POST(makeRequest({ cookie: `bb_hold=x` }));
    const json = await res.json();

    expect(res.status).toBe(503);
    expect(json.error).toBe('UNAVAILABLE');
  });

  it('returns 502 GATEWAY_ERROR when the gateway fails', async () => {
    allowRatelimit();
    matchCookie();
    vi.mocked(initiateOnlineBooking).mockResolvedValueOnce({
      ok: false,
      error: 'gateway_error',
      gatewayMessage: 'network_timeout',
    });

    const res = await POST(makeRequest({ cookie: `bb_hold=signedvalue` }));
    const json = await res.json();

    expect(res.status).toBe(502);
    expect(json.error).toBe('GATEWAY_ERROR');
  });
});

describe('POST /api/bookings/initiate — rate limit', () => {
  it('returns 429 with Retry-After when ratelimit denies', async () => {
    denyRatelimit(45);

    const res = await POST(makeRequest({ cookie: `bb_hold=x` }));
    const json = await res.json();

    expect(res.status).toBe(429);
    expect(json.error).toBe('TOO_MANY_REQUESTS');
    expect(res.headers.get('Retry-After')).toBe('45');
    expect(extractHoldCookie).not.toHaveBeenCalled();
    expect(initiateOnlineBooking).not.toHaveBeenCalled();
  });
});

describe('POST /api/bookings/initiate — customerId stamping (Issue 031)', () => {
  it('threads the signed-in customerId to the online orchestrator when a Bearer token is present', async () => {
    const { signAccess } = await import('@/lib/auth');
    const token = await signAccess({ sub: 'cust-online', role: 'customer' });

    allowRatelimit();
    matchCookie();
    mockOnlineOk();

    await POST(makeRequest({ cookie: 'bb_hold=signedvalue', auth: `Bearer ${token}` }));

    const call = vi.mocked(initiateOnlineBooking).mock.calls[0]?.[0];
    expect(call?.customerId).toBe('cust-online');
  });

  it('passes customerId=null for a guest booking (no Authorization header)', async () => {
    allowRatelimit();
    matchCookie();
    mockOnlineOk();

    await POST(makeRequest({ cookie: 'bb_hold=signedvalue' }));

    const call = vi.mocked(initiateOnlineBooking).mock.calls[0]?.[0];
    expect(call?.customerId).toBeNull();
  });
});
