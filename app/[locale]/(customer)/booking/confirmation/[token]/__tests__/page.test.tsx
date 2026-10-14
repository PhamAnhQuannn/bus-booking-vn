/**
 * Unit tests for /booking/confirmation/[token] (RSC) — #843 status-aware header.
 *
 * Only paid/completed shows the success state + receipt QR; awaiting_payment shows a
 * pending state linking back to payment; dead bookings show an inactive state with a
 * "contact us with your booking ref" line. Support + policy links render in all states.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers({ host: 'lenxevn.com', 'x-forwarded-proto': 'https' })),
}));

vi.mock('@/lib/booking', () => ({
  getBookingByConfirmationToken: vi.fn(),
}));

vi.mock('@/lib/ticketing', () => ({
  mintTicketToken: vi.fn(async () => 'receipt-token'),
  ticketQrDataUrl: vi.fn(() => 'data:image/svg+xml;base64,QR'),
}));

vi.mock('@/components/booking/BookingSummaryRail', () => ({
  BookingSummaryRail: () => null,
}));

import ConfirmationPage from '../page';
import { getBookingByConfirmationToken } from '@/lib/booking';
import { mintTicketToken } from '@/lib/ticketing';
import { SUPPORT_EMAIL, REFUND_POLICY_PATH, COMPLAINTS_PATH } from '@/lib/core/supportLinks';

const REF = 'BB-2026-abcd-ef12';

function booking(status: string, paymentMethod = 'bank_transfer') {
  return {
    id: 'bk-1',
    bookingRef: REF,
    buyerName: 'Nguyen Van A',
    buyerPhone: '+8490xxxxxx1',
    buyerEmail: 'a@example.com',
    ticketCount: 2,
    totalVnd: 300000,
    paymentMethod,
    status,
    createdAt: new Date('2026-06-01T01:00:00Z'),
    boardingPoint: null,
    boardingTime: null,
    trip: {
      id: 'trip-1',
      departureAt: new Date('2026-06-10T22:00:00Z'),
      price: 150000,
      route: { origin: 'Hà Nội', destination: 'Huế' },
      bus: { licensePlate: '29B-12345', operator: { legalName: 'Nhà xe Demo', contactPhone: '+8490xxxxxx2' } },
    },
  };
}

async function renderPage(status: string, paymentMethod?: string) {
  vi.mocked(getBookingByConfirmationToken).mockResolvedValue(booking(status, paymentMethod) as never);
  const ui = await ConfirmationPage({ params: Promise.resolve({ token: 'tok-abc' }) });
  return render(ui);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ConfirmationPage — status-aware state (#843)', () => {
  it.each(['paid', 'completed'])('%s → success title + receipt QR', async (status) => {
    const { container } = await renderPage(status);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Đặt vé thành công');
    expect(container.querySelector('header')?.getAttribute('data-state')).toBe('success');
    expect(screen.getByAltText('QR biên nhận')).toBeDefined();
    expect(mintTicketToken).toHaveBeenCalled();
  });

  it('awaiting_payment (bank transfer) → pending title, no QR, link back to VietQR payment', async () => {
    const { container } = await renderPage('awaiting_payment');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Đặt vé đang chờ thanh toán');
    expect(screen.queryByText('Đặt vé thành công')).toBeNull();
    expect(container.querySelector('header')?.getAttribute('data-state')).toBe('pending');
    expect(screen.queryByAltText('QR biên nhận')).toBeNull();
    expect(mintTicketToken).not.toHaveBeenCalled();
    const cta = screen.getByRole('link', { name: 'Tiếp tục thanh toán' });
    expect(cta.getAttribute('href')).toBe(`/booking/bank-transfer?bookingRef=${REF}&amount=300000`);
  });

  it('awaiting_payment (gateway) → link back to the result page', async () => {
    await renderPage('awaiting_payment', 'vnpay');
    const cta = screen.getByRole('link', { name: 'Tiếp tục thanh toán' });
    expect(cta.getAttribute('href')).toBe('/booking/result/tok-abc');
  });

  it.each(['payment_failed_expired', 'cancelled', 'trip_cancelled', 'refunded', 'no_show'])(
    '%s → inactive title, no QR, contact-with-ref line',
    async (status) => {
      const { container } = await renderPage(status);
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Đặt vé không còn hiệu lực');
      expect(container.querySelector('header')?.getAttribute('data-state')).toBe('inactive');
      expect(screen.queryByAltText('QR biên nhận')).toBeNull();
      expect(screen.queryByRole('link', { name: 'Tiếp tục thanh toán' })).toBeNull();
      expect(
        screen.getByText(`Cần hỗ trợ? Liên hệ ${SUPPORT_EMAIL} kèm mã đặt vé ${REF}.`),
      ).toBeDefined();
    },
  );

  it.each(['paid', 'awaiting_payment', 'payment_failed_expired'])(
    '%s → support email + refund policy + complaints links',
    async (status) => {
      await renderPage(status);
      const nav = screen.getByTestId('support-links');
      const hrefs = Array.from(nav.querySelectorAll('a')).map((a) => a.getAttribute('href'));
      expect(hrefs).toEqual([`mailto:${SUPPORT_EMAIL}`, REFUND_POLICY_PATH, COMPLAINTS_PATH]);
    },
  );
});
