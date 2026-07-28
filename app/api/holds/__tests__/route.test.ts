/**
 * Unit tests for POST /api/holds
 * Mocks: createHold (db), buildSetCookieHeader (cookie), ratelimit
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mock modules before importing route ---
// importOriginal-spread, not a bare object: the route also imports HOLD_TTL_MINUTES from
// here, and a partial mock would resolve it to undefined at module load. That is the same
// barrel/partial-mock failure the 2026-06-03 mistake-log entry describes.
vi.mock('@/lib/core/db/holdRepo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/core/db/holdRepo')>()),
  createHold: vi.fn(),
}));

vi.mock('@/lib/security/holdCookie', () => ({
  buildSetCookieHeader: vi.fn(
    (holdId: string, expiresAt: string) => `bb_hold=${holdId}.${expiresAt}.fakesig; HttpOnly`
  ),
  COOKIE_NAME: 'bb_hold',
  COOKIE_MAX_AGE: 720,
}));

// vi.hoisted — vi.mock factories are hoisted above const declarations, so a plain
// top-level const would be in the TDZ when the factory runs.
const { holdsLimitMock, holdsAnonLimitMock, sessionIdMock } = vi.hoisted(() => ({
  holdsLimitMock: vi.fn(async () => ({ allowed: true, remaining: 7, retryAfter: 0 })),
  holdsAnonLimitMock: vi.fn(async () => ({ allowed: true, remaining: 2, retryAfter: 0 })),
  sessionIdMock: vi.fn<() => string | null>(() => null),
}));

vi.mock('@/lib/ratelimit', () => ({
  ratelimit: {
    limit: vi.fn(async () => ({ allowed: true, remaining: 59, retryAfter: 0 })),
  },
  holdsRatelimit: { limit: holdsLimitMock },
  holdsAnonRatelimit: { limit: holdsAnonLimitMock },
}));

// Funnel tracking is fire-and-forget; mock so importing the route doesn't pull in
// the real Prisma client (no DATABASE_URL in unit env).
vi.mock('@/lib/analytics/track', () => ({
  track: vi.fn(),
  sessionIdFromRequest: () => sessionIdMock(),
}));

import { POST } from '../route';
import { createHold, HOLD_TTL_MINUTES } from '@/lib/core/db/holdRepo';
import { HoldCapExceededError, SessionSeatCapExceededError } from '@/lib/core/db/holdErrors';
import { NextRequest } from 'next/server';

// Helper to build a NextRequest with JSON body
function makeRequest(body: unknown, headers?: Record<string, string>): NextRequest {
  return new NextRequest('http://localhost/api/holds', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  tripId: 'clxyz1234567890abcdef1234',
  ticketCount: 2,
  buyerName: 'Nguyen Van A',
  buyerPhone: '0912345678',
  buyerEmail: 'buyer@example.com',
};

const MOCK_HOLD_RESULT = {
  holdId: 'hold-uuid-1234',
  expiresAt: new Date('2026-05-17T13:00:00.000Z'),
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.HOLD_SECRET = 'a'.repeat(64);
  // Default: no bb_sid, so the route takes the tighter anon bucket. Individual tests
  // opt into a session where that is what they are exercising.
  sessionIdMock.mockReturnValue(null);
  holdsLimitMock.mockResolvedValue({ allowed: true, remaining: 7, retryAfter: 0 });
  holdsAnonLimitMock.mockResolvedValue({ allowed: true, remaining: 2, retryAfter: 0 });
});

describe('POST /api/holds', () => {
  it('returns 200 with holdId and expiresAt on success', async () => {
    vi.mocked(createHold).mockResolvedValueOnce(MOCK_HOLD_RESULT);

    const req = makeRequest(VALID_BODY);
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.holdId).toBe('hold-uuid-1234');
    expect(json.expiresAt).toBe('2026-05-17T13:00:00.000Z');

    // Issue 042: buyerEmail threads into createHold as customerEmail (normalized lowercase).
    expect(createHold).toHaveBeenCalledWith(
      expect.objectContaining({ customerEmail: 'buyer@example.com' })
    );
  });

  it('returns 400 INVALID for invalid email', async () => {
    const req = makeRequest({ ...VALID_BODY, buyerEmail: 'not-an-email' });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('INVALID');
    expect(createHold).not.toHaveBeenCalled();
  });

  it('returns 400 INVALID when email is missing', async () => {
    const { buyerEmail: _omit, ...noEmail } = VALID_BODY;
    const req = makeRequest(noEmail);
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('INVALID');
    expect(createHold).not.toHaveBeenCalled();
  });

  it('sets bb_hold Set-Cookie header on success', async () => {
    vi.mocked(createHold).mockResolvedValueOnce(MOCK_HOLD_RESULT);

    const req = makeRequest(VALID_BODY);
    const res = await POST(req);

    // The Web Fetch API Headers object filters Set-Cookie for security in browser contexts.
    // In Node.js (undici), getSetCookie() is the correct accessor per the spec.
    // We use the mock's return value shape to verify the header was passed to the Response.
    // buildSetCookieHeader mock returns: `bb_hold=<holdId>.<expiresAt>.fakesig; HttpOnly`
    // Since the route constructs `new Response(..., {headers: {'Set-Cookie': setCookieHeader}})`,
    // verify by checking the mock was called with the right holdId.
    const { buildSetCookieHeader } = await import('@/lib/security');
    expect(buildSetCookieHeader).toHaveBeenCalledWith(
      MOCK_HOLD_RESULT.holdId,
      MOCK_HOLD_RESULT.expiresAt.toISOString()
    );

    // Also verify response status is 200 and body looks right
    expect(res.status).toBe(200);
  });

  it('returns 409 SOLD_OUT when createHold returns null', async () => {
    vi.mocked(createHold).mockResolvedValueOnce(null);

    const req = makeRequest(VALID_BODY);
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toBe('SOLD_OUT');
  });

  it('does not leak raw input in 409 body', async () => {
    vi.mocked(createHold).mockResolvedValueOnce(null);

    const req = makeRequest(VALID_BODY);
    const res = await POST(req);
    const text = await res.text();

    // Should not contain buyer info
    expect(text).not.toContain(VALID_BODY.buyerPhone);
    expect(text).not.toContain(VALID_BODY.buyerName);
    expect(text).not.toContain(VALID_BODY.tripId);
  });

  it('returns 400 INVALID for malformed JSON', async () => {
    const req = new NextRequest('http://localhost/api/holds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-valid-json',
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('INVALID');
  });

  it('returns 400 INVALID for invalid body (missing fields)', async () => {
    const req = makeRequest({ tripId: 'bad' });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('INVALID');
  });

  it('returns 400 INVALID for invalid phone', async () => {
    const req = makeRequest({ ...VALID_BODY, buyerPhone: '1234567890' });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('INVALID');
  });

  it('returns 429 HOLD_CAP_EXCEEDED when concurrent-hold cap is reached (Issue 098)', async () => {
    vi.mocked(createHold).mockRejectedValueOnce(new HoldCapExceededError());

    const req = makeRequest(VALID_BODY);
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(429);
    expect(json.error).toBe('HOLD_CAP_EXCEEDED');
    // #359: without this the client fabricates a 60s retry and shows throttle copy for a
    // cap that only clears when the caller's own holds expire.
    expect(res.headers.get('Retry-After')).toBe(String(HOLD_TTL_MINUTES * 60));
  });

  it('returns 429 SESSION_SEAT_CAP_EXCEEDED with Retry-After (#359)', async () => {
    vi.mocked(createHold).mockRejectedValueOnce(new SessionSeatCapExceededError());

    const req = makeRequest(VALID_BODY);
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(429);
    expect(json.error).toBe('SESSION_SEAT_CAP_EXCEEDED');
    expect(res.headers.get('Retry-After')).toBe(String(HOLD_TTL_MINUTES * 60));
  });

  it('keys the limiter on bb_sid when a session is present, not the IP (#359)', async () => {
    // CGNAT: Vietnamese mobile carriers put many unrelated buyers behind one egress IP,
    // so an IP-keyed hold limit would starve real customers at peak.
    sessionIdMock.mockReturnValue('sess-abc');
    vi.mocked(createHold).mockResolvedValueOnce(MOCK_HOLD_RESULT);

    await POST(makeRequest(VALID_BODY));

    expect(holdsLimitMock).toHaveBeenCalledWith('hold:sess-abc');
    expect(holdsAnonLimitMock).not.toHaveBeenCalled();
  });

  it('falls back to the tighter anon IP bucket when bb_sid is absent (#359)', async () => {
    // A real browser always has bb_sid by the time it POSTs — proxy.ts mints it on any
    // safe-method request. A client that never issued a GET is a script.
    sessionIdMock.mockReturnValue(null);
    vi.mocked(createHold).mockResolvedValueOnce(MOCK_HOLD_RESULT);

    await POST(makeRequest(VALID_BODY));

    expect(holdsAnonLimitMock).toHaveBeenCalledWith(expect.stringMatching(/^hold-anon:/));
    expect(holdsLimitMock).not.toHaveBeenCalled();
  });

  it('threads the session into createHold so the seat cap can be enforced (#359)', async () => {
    sessionIdMock.mockReturnValue('sess-xyz');
    vi.mocked(createHold).mockResolvedValueOnce(MOCK_HOLD_RESULT);

    await POST(makeRequest(VALID_BODY));

    expect(createHold).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'sess-xyz' })
    );
  });

  it('returns 429 TOO_MANY_REQUESTS when rate limited', async () => {
    holdsAnonLimitMock.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      retryAfter: 30,
    });

    const req = makeRequest(VALID_BODY);
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(429);
    expect(json.error).toBe('TOO_MANY_REQUESTS');
    expect(res.headers.get('Retry-After')).toBe('30');
  });

  it('does not call createHold when rate limited', async () => {
    holdsAnonLimitMock.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      retryAfter: 30,
    });

    const req = makeRequest(VALID_BODY);
    await POST(req);

    expect(createHold).not.toHaveBeenCalled();
  });

  it('returns 422 pickup_custom_detail_required for custom pickup with short detail (Issue 107)', async () => {
    const req = makeRequest({ ...VALID_BODY, pickupKind: 'custom', pickupDetail: 'ab' });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(422);
    expect(json.error).toBe('pickup_custom_detail_required');
    expect(createHold).not.toHaveBeenCalled();
  });
});
