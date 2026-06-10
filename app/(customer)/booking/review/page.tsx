/**
 * /booking/review — Order review step.
 *
 * Server component: verifies bb_hold cookie ownership of `holdId` then calls
 * getHoldDetails in-process — NEVER self-fetches its own API. Mistake Log
 * 2026-05-17 (Issue 002): server components calling own routes break under
 * port-bump and add an HTTP hop for no reason. Call the lib function directly.
 */

import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyCookieValue } from '@/lib/security';
import { getHoldDetails } from '@/lib/booking';
import { ReviewClient } from './ReviewClient';

// Transient checkout step gated by the bb_hold cookie — never indexed.
export const metadata: Metadata = {
  title: 'Xác nhận đơn | BBVN',
  robots: { index: false, follow: false },
};

interface ReviewPageProps {
  searchParams: Promise<{ holdId?: string }>;
}

export default async function ReviewPage({ searchParams }: ReviewPageProps) {
  const { holdId } = await searchParams;

  if (!holdId) {
    redirect('/search');
  }

  const cookieStore = await cookies();
  const bbHold = cookieStore.get('bb_hold');

  if (!bbHold) {
    redirect('/search');
  }

  const verified = verifyCookieValue(bbHold.value);
  if (!verified || verified.holdId !== holdId) {
    redirect('/search');
  }

  const details = await getHoldDetails(holdId);
  if (!details) {
    redirect('/search');
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Xem lại đơn hàng</h1>
      <ReviewClient
        holdDetails={{
          holdId,
          tripId: details.tripId,
          ticketCount: details.ticketCount,
          expiresAt: details.expiresAt,
          unitPriceVND: details.unitPriceVND,
          totalVND: details.totalVND,
          routeOrigin: details.routeOrigin,
          routeDestination: details.routeDestination,
          departureAt: details.departureAt,
          operatorLegalName: details.operatorLegalName,
          pickupKind: details.pickupKind,
          pickupAreaLabel: details.pickupAreaLabel,
          pickupDetail: details.pickupDetail,
        }}
      />
    </main>
  );
}
