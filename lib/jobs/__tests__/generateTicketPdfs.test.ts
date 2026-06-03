/**
 * Unit tests for generateTicketPdfs (Issue 074).
 *
 * Mocks prisma (claim raw query + updateMany), renderTicketPdf, putObject,
 * createNotificationLog, mintTicketToken. Asserts: claims paid-without-key rows,
 * renders + uploads each, stamps the key, enqueues a 'ticketReady' email; skips
 * the email when buyerEmail is null; counts only rows whose guarded stamp won.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

interface ClaimRow {
  id: string;
  bookingRef: string;
  confirmationToken: string;
  buyerEmail: string | null;
}

const {
  mockQueryRaw,
  mockTransaction,
  mockUpdateMany,
  mockFindUnique,
  mockRenderPdf,
  mockPutObject,
  mockCreateNotificationLog,
  mockMintToken,
} = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockTransaction: vi.fn(),
  mockUpdateMany: vi.fn(),
  mockFindUnique: vi.fn(),
  mockRenderPdf: vi.fn(),
  mockPutObject: vi.fn(),
  mockCreateNotificationLog: vi.fn(),
  mockMintToken: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    $transaction: mockTransaction,
    booking: { updateMany: mockUpdateMany, findUnique: mockFindUnique },
  },
}));
// Prisma.sql / Prisma.join are template helpers — stub to no-op tagged values.
vi.mock('@prisma/client', () => ({
  Prisma: {
    sql: (strings: TemplateStringsArray, ...vals: unknown[]) => ({ strings, vals }),
    join: (vals: unknown[]) => ({ join: vals }),
  },
}));
vi.mock('@/lib/booking/ticketPdf', () => ({ renderTicketPdf: mockRenderPdf }));
vi.mock('@/lib/storage', () => ({ putObject: mockPutObject }));
vi.mock('@/lib/db/notificationLogRepo', () => ({
  createNotificationLog: mockCreateNotificationLog,
}));
vi.mock('@/lib/ticketing/ticketToken', () => ({ mintTicketToken: mockMintToken }));
// getCustomerBookingDetail exposes customerBookingDetailSelect (a const object).
vi.mock('@/lib/booking/getCustomerBookingDetail', () => ({
  customerBookingDetailSelect: {},
}));

import { generateTicketPdfs } from '../generateTicketPdfs';

function bookingRow(id: string) {
  return {
    id,
    bookingRef: `BB-2026-${id}`,
    buyerName: 'Nguyen Van A',
    buyerPhone: '0901234567',
    ticketCount: 1,
    totalVnd: 150000,
    paymentMethod: 'cash',
    status: 'paid',
    createdAt: new Date('2026-05-02T01:00:00.000Z'),
    trip: {
      departureAt: new Date('2026-06-10T22:00:00.000Z'),
      route: { origin: 'Hanoi', destination: 'Hue' },
      bus: {
        licensePlate: '29B-12345',
        operator: { legalName: 'Phuong Trang', contactPhone: '+84909999999' },
      },
    },
  };
}

function setClaim(rows: ClaimRow[]) {
  mockTransaction.mockImplementation(async (fn: (tx: { $queryRaw: typeof mockQueryRaw }) => unknown) => {
    mockQueryRaw.mockResolvedValueOnce(rows);
    return fn({ $queryRaw: mockQueryRaw });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRenderPdf.mockResolvedValue(Buffer.from('%PDF-1.4'));
  mockPutObject.mockResolvedValue(undefined);
  mockMintToken.mockResolvedValue('signed.lookup.token');
  mockUpdateMany.mockResolvedValue({ count: 1 });
  mockCreateNotificationLog.mockResolvedValue({});
});

describe('generateTicketPdfs', () => {
  it('claims paid-without-key rows, renders, uploads, stamps the key, enqueues email', async () => {
    setClaim([
      { id: 'b1', bookingRef: 'BB-2026-b1', confirmationToken: 'ct1', buyerEmail: 'a@x.com' },
    ]);
    mockFindUnique.mockResolvedValue(bookingRow('b1'));

    const now = new Date('2026-06-02T00:00:00.000Z');
    const result = await generateTicketPdfs({} as never, { now });

    expect(result).toEqual({ rowsAffected: 1, status: 'success' });

    // Rendered with the confirmation token; uploaded to the bookingRef-keyed path.
    expect(mockRenderPdf).toHaveBeenCalledWith(expect.objectContaining({ id: 'b1' }), 'ct1');
    expect(mockPutObject).toHaveBeenCalledWith(
      expect.anything(),
      'ticket_pdf/BB-2026-b1.pdf',
      'application/pdf',
      expect.any(Buffer)
    );

    // Guarded key stamp (WHERE ticketPdfKey null) with the key + timestamp.
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: 'b1', ticketPdfKey: null },
      data: { ticketPdfKey: 'ticket_pdf/BB-2026-b1.pdf', ticketPdfGeneratedAt: now },
    });

    // Email enqueued (channel email, ticketReady, pending) with verify + ticket links.
    expect(mockCreateNotificationLog).toHaveBeenCalledTimes(1);
    const enq = mockCreateNotificationLog.mock.calls[0][0];
    expect(enq).toMatchObject({
      bookingId: 'b1',
      channel: 'email',
      template: 'ticketReady',
      recipient: 'a@x.com',
      status: 'pending',
    });
    const payload = JSON.parse(enq.payload);
    expect(payload).toEqual({
      bookingRef: 'BB-2026-b1',
      verifyUrl: '/verify/signed.lookup.token',
      ticketUrl: '/api/bookings/b1/ticket',
    });
  });

  it('skips the email enqueue when buyerEmail is null (still renders + uploads)', async () => {
    setClaim([
      { id: 'b2', bookingRef: 'BB-2026-b2', confirmationToken: 'ct2', buyerEmail: null },
    ]);
    mockFindUnique.mockResolvedValue(bookingRow('b2'));

    const result = await generateTicketPdfs({} as never, { now: new Date() });

    expect(result.rowsAffected).toBe(1);
    expect(mockPutObject).toHaveBeenCalledTimes(1);
    expect(mockUpdateMany).toHaveBeenCalledTimes(1);
    expect(mockCreateNotificationLog).not.toHaveBeenCalled();
  });

  it('does not count or enqueue when the guarded stamp loses the race (count 0)', async () => {
    setClaim([
      { id: 'b3', bookingRef: 'BB-2026-b3', confirmationToken: 'ct3', buyerEmail: 'c@x.com' },
    ]);
    mockFindUnique.mockResolvedValue(bookingRow('b3'));
    mockUpdateMany.mockResolvedValue({ count: 0 }); // already keyed by a racing tick

    const result = await generateTicketPdfs({} as never, { now: new Date() });

    expect(result.rowsAffected).toBe(0);
    expect(mockCreateNotificationLog).not.toHaveBeenCalled();
  });

  it('returns 0 with no rows to claim (a re-run over already-keyed bookings)', async () => {
    setClaim([]);
    const result = await generateTicketPdfs({} as never, { now: new Date() });
    expect(result).toEqual({ rowsAffected: 0, status: 'success' });
    expect(mockRenderPdf).not.toHaveBeenCalled();
    expect(mockPutObject).not.toHaveBeenCalled();
  });
});
