/**
 * Unit tests for GET /api/bookings/:id/ticket (Issue 074 async rewrite).
 *
 * verifyAccess, getCustomerBookingDetail, the prisma booking read, and
 * createSignedDownloadUrl are mocked. Asserts: ownership 404, status-gate 409,
 * 202 when no ticketPdfKey yet, 302 redirect to a fresh signed URL when keyed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockVerifyAccess, mockGetDetail, mockFindUnique, mockSignedDownload } = vi.hoisted(
  () => ({
    mockVerifyAccess: vi.fn(),
    mockGetDetail: vi.fn(),
    mockFindUnique: vi.fn(),
    mockSignedDownload: vi.fn(),
  })
);

vi.mock('@/lib/auth/jwt', () => ({ verifyAccess: mockVerifyAccess }));
vi.mock('@/lib/booking/getCustomerBookingDetail', () => ({
  getCustomerBookingDetail: mockGetDetail,
}));
vi.mock('@/lib/storage', () => ({ createSignedDownloadUrl: mockSignedDownload }));
// requireCustomerAuth re-reads the Customer row for the Issue 066 suspension gate,
// AND the route reads booking.ticketPdfKey — mock the prisma singleton for both.
vi.mock('@/lib/core/db/client', () => ({
  prisma: {
    customer: {
      findUnique: vi.fn(async (a: { where: { id: string } }) => ({
        id: a.where.id,
        suspendedAt: null,
      })),
    },
    booking: { findUnique: mockFindUnique },
  },
}));

import { GET } from '../route';
import { NextRequest } from 'next/server';

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost/api/bookings/bk-1/ticket', {
    method: 'GET',
    headers: { authorization: 'Bearer token' },
  });
}

const routeCtx = { params: Promise.resolve({ id: 'bk-1' }) };

function detail(status: string) {
  return {
    id: 'bk-1',
    bookingRef: 'BB-2026-abcd-efgh',
    buyerName: 'Nguyen Van A',
    buyerPhone: '0901234567',
    ticketCount: 2,
    totalVnd: 300000,
    paymentMethod: 'momo',
    status,
    createdAt: '2026-05-02T01:00:00.000Z',
    route: { origin: 'Hanoi', destination: 'Hue' },
    departureAt: '2026-06-10T22:00:00.000Z',
    busLicensePlate: '29B-12345',
    operator: { legalName: 'Test Bus Co', contactPhone: '+8490xxxxxx9' },
  };
}

describe('GET /api/bookings/:id/ticket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAccess.mockResolvedValue({ sub: 'cust-1' });
  });

  it('returns 401 when the Authorization header is missing', async () => {
    const req = new NextRequest('http://localhost/api/bookings/bk-1/ticket', { method: 'GET' });
    const res = await GET(req, routeCtx);
    expect(res.status).toBe(401);
    expect(mockGetDetail).not.toHaveBeenCalled();
  });

  it('scopes the lookup by the verified customerId and route id', async () => {
    mockGetDetail.mockResolvedValue(detail('paid'));
    mockFindUnique.mockResolvedValue({ ticketPdfKey: null });
    await GET(makeRequest(), routeCtx);
    expect(mockGetDetail).toHaveBeenCalledWith('cust-1', 'bk-1');
  });

  it('returns 404 when the booking is not owned or missing', async () => {
    mockGetDetail.mockResolvedValue(null);
    const res = await GET(makeRequest(), routeCtx);
    expect(res.status).toBe(404);
    expect(mockSignedDownload).not.toHaveBeenCalled();
  });

  it.each(['awaiting_payment', 'payment_failed_expired', 'cancelled', 'trip_cancelled'])(
    'returns 409 for non-ticketable status %s',
    async (status) => {
      mockGetDetail.mockResolvedValue(detail(status));
      const res = await GET(makeRequest(), routeCtx);
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ error: 'not_ticketable' });
      expect(mockSignedDownload).not.toHaveBeenCalled();
    }
  );

  it.each(['paid', 'completed', 'no_show'])(
    'returns 202 pending when the PDF is not yet generated for ticketable status %s',
    async (status) => {
      mockGetDetail.mockResolvedValue(detail(status));
      mockFindUnique.mockResolvedValue({ ticketPdfKey: null });
      const res = await GET(makeRequest(), routeCtx);
      expect(res.status).toBe(202);
      expect(await res.json()).toEqual({
        status: 'pending',
        message: 'Ticket is being generated',
      });
      expect(mockSignedDownload).not.toHaveBeenCalled();
    }
  );

  it('302-redirects to a fresh signed URL when the PDF is keyed', async () => {
    mockGetDetail.mockResolvedValue(detail('paid'));
    mockFindUnique.mockResolvedValue({ ticketPdfKey: 'ticket_pdf/BB-2026-abcd-efgh.pdf' });
    mockSignedDownload.mockResolvedValue({
      downloadUrl: 'http://localhost:3001/dev/stub-storage/ticket_pdf/BB-2026-abcd-efgh.pdf?exp=1&sig=ab',
      expiresAt: new Date(Date.now() + 60000),
    });
    const res = await GET(makeRequest(), routeCtx);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('/dev/stub-storage/ticket_pdf/');
    expect(mockSignedDownload).toHaveBeenCalledWith(
      expect.anything(),
      'ticket_pdf/BB-2026-abcd-efgh.pdf',
      { actor: 'customer:cust-1' }
    );
  });

  it('returns 500 when signed-URL minting throws', async () => {
    mockGetDetail.mockResolvedValue(detail('paid'));
    mockFindUnique.mockResolvedValue({ ticketPdfKey: 'ticket_pdf/x.pdf' });
    mockSignedDownload.mockRejectedValue(new Error('boom'));
    const res = await GET(makeRequest(), routeCtx);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'ticket_url_failed' });
  });
});
