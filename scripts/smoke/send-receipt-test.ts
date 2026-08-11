/**
 * One-off smoke: send a REAL receipt (ticketReady) email via Resend so we can inspect
 * the design in an inbox + confirm the dedicated `bienlai@` sender. NOT part of CI.
 *
 * Requires a Resend setup: EMAIL_PROVIDER=resend, RESEND_API_KEY, and the sending
 * domain verified in Resend (so `bienlai@lenxevn.com` is an allowed From). The rest of
 * the env (HOLD/ticket secrets etc.) must be present too — source .env.local.
 *
 * NEXT_PUBLIC_BASE_URL is what the email's links/QR image resolve against; force it to
 * the PROD origin for this test so the "Xem biên nhận"/QR point at lenxevn.com (a
 * localhost value would make the QR <img> and buttons unreachable from a real inbox).
 *
 * NOTE: the QR image loads + scans to a real receipt ONLY when the minted token is
 * valid on the target origin AND a matching booking exists there. This demo token is
 * fabricated, so the QR image renders only if this env's ticket secret matches prod,
 * and scanning it resolves to a 404 (no such booking). The point of THIS test is the
 * email delivery + layout + sender, not a fully-resolving QR.
 *
 * Run:
 *   set -a && . ./.env.local && set +a && \
 *   EMAIL_PROVIDER=resend RESEND_API_KEY=re_… EMAIL_FROM_RECEIPT=bienlai@lenxevn.com \
 *   NEXT_PUBLIC_BASE_URL=https://lenxevn.com \
 *   pnpm tsx scripts/smoke/send-receipt-test.ts you@example.com
 */

import { mintTicketToken } from '@/lib/ticketing';
import { sendEmail } from '@/lib/notification/email';

async function main() {
  const to = process.argv[2] ?? 'phamanhquan4068@gmail.com';

  const bookingRef = 'BB-2026-demo-rcpt';
  const confirmationToken = 'demo-confirmation-token-000000000000';
  const token = await mintTicketToken({ bookingRef, confirmationToken });

  const payload = {
    bookingRef,
    buyerName: 'Nguyễn Thị Bích Ngọc',
    route: 'Sài Gòn → Thanh Hóa',
    departureAt: '05:00 12/08/2026',
    boardingPoint: 'Ngã tư Miếu Ông Cù · 05:00',
    ticketCount: '2',
    vehicle: '36B-12345',
    operator: 'Toàn Khuyên – Minh Tuyến',
    amount: '1.700.000đ',
    paymentMethod: 'Chuyển khoản',
    paidAt: '10:00 10/08/2026',
    verifyUrl: `/verify/${token}`,
    qrUrl: `/verify/${token}/qr`,
    ticketUrl: '/api/bookings/demo/ticket',
  };

  const res = await sendEmail({
    to,
    template: 'ticketReady',
    payload: JSON.stringify(payload),
    // Unique per run — a fixed key collides in Resend (24h) when the body changes.
    idempotencyKey: `receipt-test-${bookingRef}-${Date.now()}`,
  });

  console.log('send result:', res);
  if (!res.ok) process.exit(1);
  console.log(`Sent to ${to}. Verify URL: /verify/${token}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
