import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/core/db/client', () => ({
  prisma: {
    booking: {
      findUnique: vi.fn(),
    },
  },
}));

import { GET } from '../route';
import { prisma } from '@/lib/core/db/client';

function makeRequest(ref: string): NextRequest {
  return new NextRequest(`https://example.com/api/bookings/status?ref=${encodeURIComponent(ref)}`);
}

describe('GET /api/bookings/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 for invalid booking ref format', async () => {
    const res = await GET(makeRequest('invalid-ref'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_ref');
    expect(prisma.booking.findUnique).not.toHaveBeenCalled();
  });

  it('returns 400 for empty ref', async () => {
    const res = await GET(new NextRequest('https://example.com/api/bookings/status'));
    expect(res.status).toBe(400);
  });

  it('returns 404 when booking not found', async () => {
    vi.mocked(prisma.booking.findUnique).mockResolvedValueOnce(null);

    const res = await GET(makeRequest('BB-2026-abcd-ef01'));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('not_found');
  });

  it('returns 200 with status for valid booking ref', async () => {
    vi.mocked(prisma.booking.findUnique).mockResolvedValueOnce({ status: 'paid' } as never);

    const res = await GET(makeRequest('BB-2026-abcd-ef01'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('paid');
  });

  it('queries with correct where + select', async () => {
    vi.mocked(prisma.booking.findUnique).mockResolvedValueOnce({ status: 'awaiting_payment' } as never);

    await GET(makeRequest('BB-2026-ab12-cd34'));

    expect(prisma.booking.findUnique).toHaveBeenCalledWith({
      where: { bookingRef: 'BB-2026-ab12-cd34' },
      select: { status: true },
    });
  });

  it('rejects uppercase booking refs (BOOKING_REF_REGEX is lowercase)', async () => {
    const res = await GET(makeRequest('BB-2026-ABCD-EF01'));
    expect(res.status).toBe(400);
  });
});
