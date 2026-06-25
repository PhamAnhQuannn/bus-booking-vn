/**
 * GET /api/bookings/status?ref=BB-XXXX-XXXX-XXXX — payment status polling.
 *
 * Unauthenticated: returns ONLY { status } — no PII, no booking details.
 * The bookingRef is not secret (printed on tickets, in SMS) but the response
 * is deliberately minimal to prevent enumeration attacks from gaining info.
 *
 * Used by the bank-transfer QR page to poll for payment confirmation.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/core/db/client';
import { BOOKING_REF_REGEX } from '@/lib/booking';

export async function GET(req: NextRequest): Promise<Response> {
  const ref = req.nextUrl.searchParams.get('ref') ?? '';

  if (!BOOKING_REF_REGEX.test(ref)) {
    return NextResponse.json({ error: 'invalid_ref' }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({
    where: { bookingRef: ref },
    select: { status: true },
  });

  if (!booking) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json({ status: booking.status });
}
