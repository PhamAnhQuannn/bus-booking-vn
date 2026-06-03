/**
 * Unit tests for GET /api/bookings/:id/ticket
 * verifyAccess, getCustomerBookingDetail, and renderTicketPdf are mocked.
 * Ownership 404, status-gate 409, and PDF headers are asserted.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockVerifyAccess, mockGetDetail, mockRenderPdf } = vi.hoisted(() => ({
  mockVerifyAccess: vi.fn(),
  mockGetDetail: vi.fn(),
  mockRenderPdf: vi.fn(),
}));

vi.mock('@/lib/auth/jwt', () => ({ verifyAccess: mockVerifyAccess }));
vi.mock('@/lib/booking/getCustomerBookingDetail', () => ({
  getCustomerBookingDetail: mockGetDetail,
}));
vi.mock('@/lib/booking/ticketPdf', () => ({ renderTicketPdf: mockRenderPdf }));
// requireCustomerAuth now re-reads the Customer row for the Issue 066 suspension
// gate — mock the prisma singleton so importing the route doesn't construct the
// real client (no DATABASE_URL in unit env). Default: a non-suspended customer.
vi.mock('@/lib/db/client', () => ({
  prisma: { customer: { findUnique: vi.fn(async (a: { where: { id: string } }) => ({ id: a.where.id, suspendedAt: null })) } },
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
    paymentMethod: 'cash',
    status,
    createdAt: '2026-05-02T01:00:00.000Z',
    route: { origin: 'Hanoi', destination: 'Hue' },
    departureAt: '2026-06-10T22:00:00.000Z',
    busLicensePlate: '29B-12345',
    operator: { legalName: 'Phuong Trang', contactPhone: '+84909999999' },
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
    mockGetDetail.mockResolvedValue(detail('paid_operator_notified'));
    mockRenderPdf.mockResolvedValue(Buffer.from('%PDF-1.4'));
    await GET(makeRequest(), routeCtx);
    expect(mockGetDetail).toHaveBeenCalledWith('cust-1', 'bk-1');
  });

  it('returns 404 when the booking is not owned or missing', async () => {
    mockGetDetail.mockResolvedValue(null);
    const res = await GET(makeRequest(), routeCtx);
    expect(res.status).toBe(404);
    expect(mockRenderPdf).not.toHaveBeenCalled();
  });

  it.each(['awaiting_payment', 'payment_failed_expired', 'cancelled', 'trip_cancelled'])(
    'returns 409 for non-ticketable status %s',
    async (status) => {
      mockGetDetail.mockResolvedValue(detail(status));
      const res = await GET(makeRequest(), routeCtx);
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ error: 'not_ticketable' });
      expect(mockRenderPdf).not.toHaveBeenCalled();
    }
  );

  it.each(['pending_cash_payment', 'paid_operator_notified', 'completed', 'no_show'])(
    'streams a PDF with ref-named attachment for ticketable status %s',
    async (status) => {
      mockGetDetail.mockResolvedValue(detail(status));
      mockRenderPdf.mockResolvedValue(Buffer.from('%PDF-1.4'));
      const res = await GET(makeRequest(), routeCtx);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('application/pdf');
      expect(res.headers.get('content-disposition')).toBe(
        'attachment; filename="ticket-BB-2026-abcd-efgh.pdf"'
      );
      expect(mockRenderPdf).toHaveBeenCalledOnce();
    }
  );

  it('returns 500 when PDF rendering throws (no booking PII leaked to the body)', async () => {
    mockGetDetail.mockResolvedValue(detail('paid_operator_notified'));
    mockRenderPdf.mockRejectedValue(new Error('boom'));
    const res = await GET(makeRequest(), routeCtx);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'ticket_render_failed' });
  });
});
