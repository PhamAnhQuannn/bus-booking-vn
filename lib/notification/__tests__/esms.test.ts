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

  it('customerBookingPaid is method-neutral (no hardcoded MoMo)', () => {
    const body = renderTemplate('customerBookingPaid', {
      ticketCount: 1,
      route: 'Hanoi → Sapa',
      departureAt: '18/05 06:00',
      bookingRef: 'BB-2026-abcd-1234',
      confirmationUrl: 'https://example.com/c/xyz',
    });
    expect(body).not.toContain('MoMo');
    expect(body).toContain('Thanh toan thanh cong');
    expect(body).toContain('BB-2026-abcd-1234');
  });
});

describe('renderTemplate — Bug B unmatched-payment templates', () => {
  const base = {
    bookingRef: 'BB-2026-abcd-1234',
    route: 'Hanoi → Sapa',
    departureAt: '18/05 06:00',
    supportEmail: 'hotro@lenxevn.com',
    hotline: '1900 xxxx',
  };

  it('customerPaymentReview reassures without claiming non-payment', () => {
    const body = renderTemplate('customerPaymentReview', base);
    expect(body).toContain('BB-2026-abcd-1234');
    expect(body).toContain('24h');
    expect(body).toContain('hotro@lenxevn.com');
    expect(body).not.toMatch(/chua thanh toan|het han/); // never "unpaid/expired"
  });

  it('customerPaymentUnverified points to support, not "you didn\'t pay"', () => {
    const body = renderTemplate('customerPaymentUnverified', base);
    expect(body).toContain('BB-2026-abcd-1234');
    expect(body).toContain('hotro@lenxevn.com');
    expect(body).toContain('1900 xxxx');
    expect(body).not.toContain('chua thanh toan');
  });

  it('opsUnmatchedPayment carries ref + amount + txn for reconciliation', () => {
    const body = renderTemplate('opsUnmatchedPayment', {
      bookingRef: 'BB-2026-abcd-1234',
      amountVnd: 261000,
      providerTxnId: '99887766',
    });
    expect(body).toContain('BB-2026-abcd-1234');
    expect(body).toContain('261000');
    expect(body).toContain('99887766');
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
