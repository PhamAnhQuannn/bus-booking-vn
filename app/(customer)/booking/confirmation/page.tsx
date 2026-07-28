/**
 * /booking/confirmation?ref=<bookingRef> — ref-addressed success destination.
 *
 * Reached today from the dev stub-pay flow (app/dev/stub-pay/actions.ts), which
 * stands in for a PSP's browser return leg. The VNPay return route that used to
 * redirect here was deleted along with the rest of the unreachable PSP webhook
 * surface. A payment webhook, not this page, is the authoritative state
 * transition; this page just resolves the booking ref to its confirmation token
 * and forwards to the canonical result page (which polls/shows the paid state).
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
