/**
 * Unit tests for POST /api/bookings/initiate (cash + MoMo paths).
 *
 * Mocks: initiateCashBooking, initiateMomoBooking orchestrators,
 *        extractHoldCookie, ratelimit.
 *
 * Covers status mapping:
 *   200  ok           — orchestrator success (cash or momo)
 *   400  INVALID      — non-JSON body, missing fields, unknown paymentMethod
 *   403  FORBIDDEN    — no cookie OR cookie holdId ≠ body holdId
 *   404  NOT_FOUND    — orchestrator returns hold_not_found
 *   409  CONFLICT     — orchestrator returns hold_expired OR trip_departed
 *   429  TOO_MANY     — rate limiter denies
 *   502  GATEWAY_ERR  — momo orchestrator returns gateway_error
 *   503  UNAVAILABLE  — orchestrator returns ref_collision
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/booking/initiateBooking', () => ({
  initiateCashBooking: vi.fn(),
}));

vi.mock('@/lib/booking/initiateOnlineBooking', () => ({
  initiateOnlineBooking: vi.fn(),
}));

vi.mock('@/lib/security/holdCookie', () => ({
  extractHoldCookie: vi.fn(),
  COOKIE_NAME: 'bb_hold',
}));

vi.mock('@/lib/ratelimit', () => ({
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

import { POST } from '../initiate/route';
import { initiateCashBooking } from '@/lib/booking/initiateBooking';
import { initiateOnlineBooking } from '@/lib/booking/initiateOnlineBooking';
import { extractHoldCookie } from '@/lib/security/holdCookie';
import { ratelimit } from '@/lib/ratelimit';
import { NextRequest } from 'next/server';

const HOLD_ID = 'ckabcdefghijklmnopqrstuvwx';
const BOOKING_ID = '01975f3b-3f4a-7c2a-8b1c-deadbeefcafe';
const CONFIRMATION_TOKEN = 'A'.repeat(32);

interface RequestOpts {
  body?: unknown;
  cookie?: string;
  ip?: string;
  raw?: string;
}

function makeRequest(opts: RequestOpts = {}): NextRequest {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-forwarded-for': opts.ip ?? '10.0.0.1',
    host: 'example.test',
    'x-forwarded-proto': 'https',
  };
  if (opts.cookie) headers.cookie = opts.cookie;
  return new NextRequest('https://example.test/api/bookings/initiate', {
    method: 'POST',
    headers,
    body: opts.raw ?? JSON.stringify(opts.body ?? { holdId: HOLD_ID, paymentMethod: 'cash' }),
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/bookings/initiate — happy path', () => {
  it('returns 200 with bookingId + confirmationToken on orchestrator success', async () => {
    allowRatelimit();
    matchCookie();
    vi.mocked(initiateCashBooking).mockResolvedValueOnce({
      ok: true,
      bookingId: BOOKING_ID,
      confirmationToken: CONFIRMATION_TOKEN,
    });

    const res = await POST(makeRequest({ cookie: `bb_hold=signedvalue` }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.bookingId).toBe(BOOKING_ID);
    expect(json.confirmationToken).toBe(CONFIRMATION_TOKEN);
    expect(res.headers.get('Cache-Control')).toContain('no-store');
  });

  it('passes baseUrl derived from x-forwarded-proto + host to orchestrator', async () => {
    allowRatelimit();
    matchCookie();
    vi.mocked(initiateCashBooking).mockResolvedValueOnce({
      ok: true,
      bookingId: BOOKING_ID,
      confirmationToken: CONFIRMATION_TOKEN,
    });

    await POST(makeRequest({ cookie: `bb_hold=signedvalue` }));

    const call = vi.mocked(initiateCashBooking).mock.calls[0]?.[0];
    expect(call?.holdId).toBe(HOLD_ID);
    expect(call?.baseUrl).toBe('https://example.test');
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
    expect(initiateCashBooking).not.toHaveBeenCalled();
  });

  it('returns 403 when cookie holdId does not match body holdId', async () => {
    allowRatelimit();
    matchCookie('different-hold-id');

    const res = await POST(makeRequest({ cookie: `bb_hold=signedvalue` }));
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe('FORBIDDEN');
    expect(initiateCashBooking).not.toHaveBeenCalled();
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

    const res = await POST(makeRequest({ body: { paymentMethod: 'cash' }, cookie: `bb_hold=x` }));
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
    vi.mocked(initiateCashBooking).mockResolvedValueOnce({ ok: false, error: 'hold_not_found' });

    const res = await POST(makeRequest({ cookie: `bb_hold=x` }));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe('NOT_FOUND');
  });

  it('returns 409 HOLD_EXPIRED on hold_expired', async () => {
    allowRatelimit();
    matchCookie();
    vi.mocked(initiateCashBooking).mockResolvedValueOnce({ ok: false, error: 'hold_expired' });

    const res = await POST(makeRequest({ cookie: `bb_hold=x` }));
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toBe('HOLD_EXPIRED');
  });

  it('returns 409 TRIP_DEPARTED on trip_departed', async () => {
    allowRatelimit();
    matchCookie();
    vi.mocked(initiateCashBooking).mockResolvedValueOnce({ ok: false, error: 'trip_departed' });

    const res = await POST(makeRequest({ cookie: `bb_hold=x` }));
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toBe('TRIP_DEPARTED');
  });

  it('returns 503 UNAVAILABLE on ref_collision', async () => {
    allowRatelimit();
    matchCookie();
    vi.mocked(initiateCashBooking).mockResolvedValueOnce({ ok: false, error: 'ref_collision' });

    const res = await POST(makeRequest({ cookie: `bb_hold=x` }));
    const json = await res.json();

    expect(res.status).toBe(503);
    expect(json.error).toBe('UNAVAILABLE');
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
    expect(initiateCashBooking).not.toHaveBeenCalled();
  });
});

describe('POST /api/bookings/initiate — MoMo path', () => {
  it('returns 200 with bookingId + payUrl on successful MoMo initiation', async () => {
    allowRatelimit();
    matchCookie();
    vi.mocked(initiateOnlineBooking).mockResolvedValueOnce({
      ok: true,
      bookingId: BOOKING_ID,
      confirmationToken: CONFIRMATION_TOKEN,
      payUrl: 'https://payment.momo.vn/pay/app?orderId=BB-2026-test-0001',
    });

    const res = await POST(
      makeRequest({
        body: { holdId: HOLD_ID, paymentMethod: 'momo' },
        cookie: `bb_hold=signedvalue`,
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.bookingId).toBe(BOOKING_ID);
    expect(json.payUrl).toBe('https://payment.momo.vn/pay/app?orderId=BB-2026-test-0001');
    expect(res.headers.get('Cache-Control')).toContain('no-store');
    expect(initiateCashBooking).not.toHaveBeenCalled();
  });

  it('returns 502 GATEWAY_ERROR when MoMo gateway fails', async () => {
    allowRatelimit();
    matchCookie();
    vi.mocked(initiateOnlineBooking).mockResolvedValueOnce({
      ok: false,
      error: 'gateway_error',
      gatewayMessage: 'network_timeout',
    });

    const res = await POST(
      makeRequest({
        body: { holdId: HOLD_ID, paymentMethod: 'momo' },
        cookie: `bb_hold=signedvalue`,
      })
    );
    const json = await res.json();

    expect(res.status).toBe(502);
    expect(json.error).toBe('GATEWAY_ERROR');
  });

  it('returns 409 HOLD_EXPIRED for momo path when hold is expired', async () => {
    allowRatelimit();
    matchCookie();
    vi.mocked(initiateOnlineBooking).mockResolvedValueOnce({
      ok: false,
      error: 'hold_expired',
    });

    const res = await POST(
      makeRequest({
        body: { holdId: HOLD_ID, paymentMethod: 'momo' },
        cookie: `bb_hold=signedvalue`,
      })
    );
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toBe('HOLD_EXPIRED');
  });
});
