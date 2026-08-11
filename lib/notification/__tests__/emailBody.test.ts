/**
 * Unit tests for the branded email-body renderer.
 *
 * Guard against the "raw JSON email" regression: `ticketReady` stores a JSON
 * blob in NotificationLog.payload (generateTicketPdfs.ts), and before this
 * renderer sendEmail dumped that blob straight into the email body. The first
 * test feeds the EXACT payload shape the job enqueues and asserts the customer
 * sees buttons + absolute links — never the JSON braces.
 */

import { describe, it, expect } from 'vitest';
import { renderEmailBody } from '../emailBody';

describe('renderEmailBody', () => {
  it('ticketReady: renders receipt rows + single "Xem biên nhận" button → /verify, not raw JSON', () => {
    // Same shape generateTicketPdfs.ts now enqueues (relative verify/qr URLs, cron has no host).
    const payload = JSON.stringify({
      bookingRef: 'BB-2026-t315-4316',
      buyerName: 'Nguyễn Văn A',
      route: 'Hà Nội → Hải Phòng',
      departureAt: '26/07/2026 08:00',
      ticketCount: '2',
      vehicle: '29B-123.45',
      operator: 'Nhà xe Demo',
      paymentMethod: 'Chuyển khoản',
      paidAt: '10:00 26/07/2026',
      amount: '20.000đ',
      verifyUrl: '/verify/demo-token',
      qrUrl: '/verify/demo-token/qr',
      ticketUrl: '/api/bookings/019f962c-e92b-7153-b6f9-4d4e183fa2c3/ticket',
    });

    const { html, text } = renderEmailBody('ticketReady', payload, 'BBVN — Biên nhận & vé điện tử của bạn đã sẵn sàng');

    // No raw JSON leaked into the body.
    expect(html).not.toContain('{"bookingRef"');
    expect(text).not.toContain('{"bookingRef"');
    // Every field surfaces as a labeled row (label + value).
    for (const [label, value] of [
      ['Mã đặt chỗ', 'BB-2026-t315-4316'],
      ['Hành khách', 'Nguyễn Văn A'],
      ['Tuyến', 'Hà Nội → Hải Phòng'],
      ['Khởi hành', '26/07/2026 08:00'],
      ['Số vé', '2'],
      ['Xe', '29B-123.45'],
      ['Nhà xe', 'Nhà xe Demo'],
      ['Phương thức', 'Chuyển khoản'],
      ['Tổng tiền', '20.000đ'],
    ]) {
      expect(html).toContain(label);
      expect(html).toContain(value);
    }
    // Single customer-facing button → the PUBLIC receipt page (verify), absolute URL.
    expect(html).toContain('<a href="https://lenxevn.com/verify/demo-token"');
    expect((html.match(/Xem biên nhận/g) ?? []).length).toBe(1);
    // The auth-gated ticket-PDF button must NOT appear (401 for guests).
    expect(html).not.toContain('Xem vé');
    // The QR image (hosted PNG) is embedded.
    expect(html).toContain('https://lenxevn.com/verify/demo-token/qr');
    // Real logo (remote) in the header, not the emoji.
    expect(html).toContain('/brand/logo-horizontal-white.png');
    expect(html).not.toContain('🚌');
  });

  it('respects NEXT_PUBLIC_BASE_URL override for absolute links', () => {
    const prev = process.env.NEXT_PUBLIC_BASE_URL;
    process.env.NEXT_PUBLIC_BASE_URL = 'https://staging.lenxevn.com/';
    try {
      const { html } = renderEmailBody(
        'ticketReady',
        JSON.stringify({ bookingRef: 'BB-1', verifyUrl: '/verify/tok' }),
        'BBVN — Biên nhận',
      );
      expect(html).toContain('https://staging.lenxevn.com/verify/tok'); // trailing slash stripped
      expect(html).not.toContain('lenxevn.com//verify');
      expect(html).toContain('https://staging.lenxevn.com/brand/logo-horizontal-white.png');
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_BASE_URL;
      else process.env.NEXT_PUBLIC_BASE_URL = prev;
    }
  });

  it('customerBookingPaid: wraps the SMS line in HTML and lifts the URL into a button', () => {
    const smsLine =
      'BusBookVN: Thanh toan thanh cong. 1 ve, chuyen Ha Noi - Hai Phong 26/07 08:00. ' +
      'Ma: BB-2026-t315-4316. Xac nhan: https://lenxevn.com/booking/confirmation/tok123';

    const { html, text } = renderEmailBody('customerBookingPaid', smsLine, 'BusBookVN — Xac nhan thanh toan');

    // Plain-text fallback is the original SMS line unchanged.
    expect(text).toBe(smsLine);
    // HTML has the confirmation URL as a button, exactly once (not duplicated in the body).
    expect(html).toContain('<a href="https://lenxevn.com/booking/confirmation/tok123"');
    expect(html.match(/tok123/g)?.length).toBe(1);
    // Branding present.
    expect(html).toContain('/brand/logo-horizontal-white.png');
    expect(html).toContain('hotro@lenxevn.com');
  });

  it('never throws on malformed structured payload — degrades to raw text', () => {
    const bad = '{not valid json';
    expect(() => renderEmailBody('ticketReady', bad, 'BBVN — Vé')).not.toThrow();
    const { html } = renderEmailBody('ticketReady', bad, 'BBVN — Vé');
    expect(html).toContain('/brand/logo-horizontal-white.png'); // still shell-wrapped
  });

  it('escapes HTML in payload text (no injection into the shell)', () => {
    const { html } = renderEmailBody('customerBookingPaid', 'evil <script>x</script>', 'BBVN — X');
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
