/**
 * GET /api/payments/vnpay/return — VNPay browser return URL.
 *
 * After payment, VNPay redirects the user's browser here with query params.
 * We extract the booking ref and redirect to the confirmation page.
 */

import { type NextRequest, NextResponse } from 'next/server';

export function GET(req: NextRequest): NextResponse {
  const txnRef = req.nextUrl.searchParams.get('vnp_TxnRef') ?? '';

  return NextResponse.redirect(
    new URL(`/booking/confirmation?ref=${encodeURIComponent(txnRef)}`, req.url),
  );
}
