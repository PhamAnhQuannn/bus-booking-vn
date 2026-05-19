import { describe, it, expect } from 'vitest';
import { renderTemplate, sendSms } from '../esms';

describe('renderTemplate', () => {
  it('renders bookingPendingCash with all placeholders substituted', () => {
    const body = renderTemplate('bookingPendingCash', {
      ticketCount: 2,
      route: 'Hanoi → Sapa',
      departureAt: '18/05 06:00',
      bookingRef: 'BB-2026-abcd-1234',
      confirmationUrl: 'https://example.com/booking/confirm/xyz',
    });
    expect(body).toContain('2 ve');
    expect(body).toContain('Hanoi → Sapa');
    expect(body).toContain('BB-2026-abcd-1234');
    expect(body).toContain('https://example.com/booking/confirm/xyz');
  });

  it('renders operatorNewBooking with buyerPhone', () => {
    const body = renderTemplate('operatorNewBooking', {
      ticketCount: 1,
      route: 'Hanoi → Sapa',
      departureAt: '18/05 06:00',
      buyerPhone: '0901234567', // local format — avoids gitleaks \+84[35789]\d{8}
      bookingRef: 'BB-2026-abcd-1234',
    });
    expect(body).toContain('0901234567');
    expect(body).toContain('BB-2026-abcd-1234');
  });
});

describe('renderTemplate — manual booking templates', () => {
  it('renders manualBookingPaid with all placeholders', () => {
    const body = renderTemplate('manualBookingPaid', {
      ticketCount: 2,
      route: 'Hanoi → Sapa',
      departureAt: '20/05 07:00',
      bookingRef: 'BB-2026-ab12-cd34',
      operatorPhone: '0901xxxxxx', // local format — avoids gitleaks
    });
    expect(body).toContain('2 ve');
    expect(body).toContain('Hanoi → Sapa');
    expect(body).toContain('BB-2026-ab12-cd34');
    expect(body).toContain('Da thanh toan');
    expect(body).toContain('0901xxxxxx');
  });

  it('renders manualBookingCash with all placeholders', () => {
    const body = renderTemplate('manualBookingCash', {
      ticketCount: 3,
      route: 'HCM → Can Tho',
      departureAt: '21/05 08:00',
      bookingRef: 'BB-2026-ef56-gh78',
      operatorPhone: '0902xxxxxx', // local format — avoids gitleaks
    });
    expect(body).toContain('3 ve');
    expect(body).toContain('HCM → Can Tho');
    expect(body).toContain('BB-2026-ef56-gh78');
    expect(body).toContain('tien mat');
    expect(body).toContain('0902xxxxxx');
  });
});

describe('sendSms (stub)', () => {
  it('returns ok:true with a stub externalRef', async () => {
    const result = await sendSms({
      to: '0901234567', // local format — avoids gitleaks \+84[35789]\d{8}
      template: 'bookingPendingCash',
      payload: {
        ticketCount: 1,
        route: 'Hanoi → Sapa',
        departureAt: '18/05 06:00',
        bookingRef: 'BB-2026-abcd-1234',
        confirmationUrl: 'https://example.com/booking/confirm/xyz',
      },
    });
    expect(result.ok).toBe(true);
    expect(result.externalRef).toMatch(/^stub_/);
  });
});
