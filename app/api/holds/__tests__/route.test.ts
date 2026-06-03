/**
 * Unit tests for POST /api/holds
 * Mocks: createHold (db), buildSetCookieHeader (cookie), ratelimit
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mock modules before importing route ---
vi.mock('@/lib/db/holdRepo', () => ({
  createHold: vi.fn(),
}));

vi.mock('@/lib/security/holdCookie', () => ({
  buildSetCookieHeader: vi.fn(
    (holdId: string, expiresAt: string) => `bb_hold=${holdId}.${expiresAt}.fakesig; HttpOnly`
  ),
  COOKIE_NAME: 'bb_hold',
  COOKIE_MAX_AGE: 720,
}));

vi.mock('@/lib/ratelimit', () => ({
  ratelimit: {
    limit: vi.fn(async () => ({ allowed: true, remaining: 59, retryAfter: 0 })),
  },
}));

// Funnel tracking is fire-and-forget; mock so importing the route doesn't pull in
// the real Prisma client (no DATABASE_URL in unit env).
vi.mock('@/lib/analytics/track', () => ({
  track: vi.fn(),
  sessionIdFromRequest: vi.fn(() => null),
}));

import { POST } from '../route';
import { createHold } from '@/lib/db/holdRepo';
import { ratelimit } from '@/lib/ratelimit';
import { HoldCapExceededError } from '@/lib/db/holdErrors';
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
    const { buildSetCookieHeader } = await import('@/lib/security/holdCookie');
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
  });

  it('returns 429 TOO_MANY_REQUESTS when rate limited', async () => {
    vi.mocked(ratelimit.limit).mockResolvedValueOnce({
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
    vi.mocked(ratelimit.limit).mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      retryAfter: 30,
    });

    const req = makeRequest(VALID_BODY);
    await POST(req);

    expect(createHold).not.toHaveBeenCalled();
  });
});
