/**
 * Smoke test for renderTicketPdf (Issue 074 — QR embedded).
 *
 * Asserts the renderer produces a non-empty PDF Buffer (valid %PDF header) for a
 * sample booking with the boarding QR embedded. react-pdf render in node is slow
 * but works; one smoke test guards against the <Svg>/<Rect> QR wiring throwing.
 * NODE_ENV=test → ticketToken.ts falls back to its test secret, so no env setup.
 */

import { describe, it, expect } from 'vitest';
import { renderTicketPdf } from '../ticketPdf';
import type { CustomerBookingDetail } from '../getCustomerBookingDetail';
import { ticketQrMatrix } from '@/lib/ticketing';

const sampleBooking: CustomerBookingDetail = {
  id: 'bk-1',
  bookingRef: 'BB-2026-abcd-efgh',
  buyerName: 'Nguyen Van A',
  buyerPhone: '0901234567',
  ticketCount: 2,
  totalVnd: 300000,
  paymentMethod: 'momo',
  status: 'paid',
  createdAt: '2026-05-02T01:00:00.000Z',
  route: { origin: 'Hanoi', destination: 'Hue' },
  departureAt: '2026-06-10T22:00:00.000Z',
  busLicensePlate: '29B-12345',
  operator: { legalName: 'Phuong Trang', contactPhone: '+84909999999' },
};

describe('renderTicketPdf', () => {
  it('renders a non-empty PDF Buffer with the QR for a sample booking', async () => {
    const pdf = await renderTicketPdf(sampleBooking, 'confirm-token-xyz');
    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.length).toBeGreaterThan(0);
    // Valid PDF header.
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  }, 30_000);

  it('the QR matrix for the booking token is a non-trivial square', () => {
    // The component builds from this same matrix (one <Rect> per dark module).
    const matrix = ticketQrMatrix('any-token-for-shape-check');
    expect(matrix.length).toBeGreaterThanOrEqual(21); // QR v1 = 21x21 minimum
    expect(matrix.every((row) => row.length === matrix.length)).toBe(true);
    expect(matrix.some((row) => row.some(Boolean))).toBe(true);
  });
});
