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
      buyerPhone: '+84901234567',
      bookingRef: 'BB-2026-abcd-1234',
    });
    expect(body).toContain('+84901234567');
    expect(body).toContain('BB-2026-abcd-1234');
  });
});

describe('sendSms (stub)', () => {
  it('returns ok:true with a stub externalRef', async () => {
    const result = await sendSms({
      to: '+84901234567',
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
