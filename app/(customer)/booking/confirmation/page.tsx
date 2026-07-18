/**
 * /booking/confirmation?ref=<bookingRef> — VNPay success return destination.
 *
 * The VNPay return route (app/api/payments/vnpay/return/route.ts) redirects the
 * browser here after a successful (responseCode=00, signature-valid) payment.
 * The IPN webhook is the authoritative state transition; this page just resolves
 * the booking ref to its confirmation token and forwards to the canonical result
 * page (which polls/shows the paid state).
 *
 * Distinct from /booking/confirmation/[token] (the token-addressed variant).
 */

import type { Metadata } from 'next';
import { redirect, notFound } from 'next/navigation';
import { getBookingByRef } from '@/lib/booking';

export const metadata: Metadata = {
  title: 'Xác nhận thanh toán | BBVN',
  robots: { index: false, follow: false },
};

interface ConfirmationPageProps {
  searchParams: Promise<{ ref?: string }>;
}

export default async function VnpayConfirmationPage({ searchParams }: ConfirmationPageProps) {
  const { ref } = await searchParams;
  if (!ref) notFound();

  const booking = await getBookingByRef(ref);
  if (!booking) notFound();

  redirect(`/booking/result/${booking.confirmationToken}`);
}
