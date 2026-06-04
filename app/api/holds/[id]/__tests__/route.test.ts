/**
 * Unit tests for GET /api/holds/[id]
 * Mocks: prisma, extractHoldCookie
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/core/db/client', () => ({
  prisma: {
    hold: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/security/holdCookie', () => ({
  extractHoldCookie: vi.fn(),
  COOKIE_NAME: 'bb_hold',
  COOKIE_MAX_AGE: 720,
}));

import { GET } from '../route';
import { prisma } from '@/lib/core/db/client';
import { extractHoldCookie } from '@/lib/security';
import { NextRequest } from 'next/server';

const HOLD_ID = 'hold-uuid-1234';
const TRIP_ID = 'trip-cuid-5678';
const EXPIRES_AT = new Date('2026-05-17T13:10:00.000Z');

const MOCK_TRIP_REL = {
  departureAt: new Date('2026-05-18T01:00:00.000Z'),
  route: { origin: 'Hà Nội', destination: 'TP.HCM' },
  bus: { operator: { legalName: 'Nhà xe Test' } },
};

const MOCK_HOLD = {
  id: HOLD_ID,
  tripId: TRIP_ID,
  ticketCount: 2,
  expiresAt: EXPIRES_AT,
  status: 'active',
  trip: {
    price: 150000,
    ...MOCK_TRIP_REL,
  },
};

function makeRequest(holdId: string, cookieHeader?: string): NextRequest {
  return new NextRequest(`http://localhost/api/holds/${holdId}`, {
    method: 'GET',
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
}

function makeCtx(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.HOLD_SECRET = 'a'.repeat(64);
});

describe('GET /api/holds/[id]', () => {
  it('returns 200 with hold details when cookie matches', async () => {
    vi.mocked(extractHoldCookie).mockReturnValueOnce({
      holdId: HOLD_ID,
      expiresAtISO: EXPIRES_AT.toISOString(),
    });
    vi.mocked(prisma.hold.findUnique).mockResolvedValueOnce(MOCK_HOLD as never);

    const req = makeRequest(HOLD_ID, `bb_hold=fake`);
    const res = await GET(req, makeCtx(HOLD_ID));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.tripId).toBe(TRIP_ID);
    expect(json.ticketCount).toBe(2);
    expect(json.expiresAt).toBe(EXPIRES_AT.toISOString());
    expect(json.totalVND).toBe(300000); // 150000 * 2
  });

  it('returns 401 when no cookie is present', async () => {
    vi.mocked(extractHoldCookie).mockReturnValueOnce(null);

    const req = makeRequest(HOLD_ID);
    const res = await GET(req, makeCtx(HOLD_ID));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe('UNAUTHORIZED');
  });

  it('returns 401 when cookie holdId does not match path id', async () => {
    vi.mocked(extractHoldCookie).mockReturnValueOnce({
      holdId: 'different-hold-id',
      expiresAtISO: EXPIRES_AT.toISOString(),
    });

    const req = makeRequest(HOLD_ID, `bb_hold=fakecookie`);
    const res = await GET(req, makeCtx(HOLD_ID));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe('UNAUTHORIZED');
  });

  it('returns 404 when hold not found in DB', async () => {
    vi.mocked(extractHoldCookie).mockReturnValueOnce({
      holdId: HOLD_ID,
      expiresAtISO: EXPIRES_AT.toISOString(),
    });
    vi.mocked(prisma.hold.findUnique).mockResolvedValueOnce(null);

    const req = makeRequest(HOLD_ID, `bb_hold=fake`);
    const res = await GET(req, makeCtx(HOLD_ID));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe('NOT_FOUND');
  });

  it('totalVND is server-computed (price * ticketCount)', async () => {
    vi.mocked(extractHoldCookie).mockReturnValueOnce({
      holdId: HOLD_ID,
      expiresAtISO: EXPIRES_AT.toISOString(),
    });
    vi.mocked(prisma.hold.findUnique).mockResolvedValueOnce({
      ...MOCK_HOLD,
      ticketCount: 3,
      trip: { price: 200000, ...MOCK_TRIP_REL },
    } as never);

    const req = makeRequest(HOLD_ID, `bb_hold=fake`);
    const res = await GET(req, makeCtx(HOLD_ID));
    const json = await res.json();

    expect(json.totalVND).toBe(600000); // 200000 * 3
  });

  it('sets Cache-Control: no-store', async () => {
    vi.mocked(extractHoldCookie).mockReturnValueOnce({
      holdId: HOLD_ID,
      expiresAtISO: EXPIRES_AT.toISOString(),
    });
    vi.mocked(prisma.hold.findUnique).mockResolvedValueOnce(MOCK_HOLD as never);

    const req = makeRequest(HOLD_ID, `bb_hold=fake`);
    const res = await GET(req, makeCtx(HOLD_ID));

    expect(res.headers.get('Cache-Control')).toContain('no-store');
  });
});
