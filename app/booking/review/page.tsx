/**
 * /booking/review — Order review step.
 *
 * Server component: verifies bb_hold cookie ownership of `holdId` then calls
 * getHoldDetails in-process — NEVER self-fetches its own API. Mistake Log
 * 2026-05-17 (Issue 002): server components calling own routes break under
 * port-bump and add an HTTP hop for no reason. Call the lib function directly.
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyCookieValue } from '@/lib/security/holdCookie';
import { getHoldDetails } from '@/lib/booking/getHoldDetails';
import { ReviewClient } from './ReviewClient';

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
    <main className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Xem lại đơn hàng</h1>
      <ReviewClient
        holdDetails={{
          holdId,
          tripId: details.tripId,
          ticketCount: details.ticketCount,
          expiresAt: details.expiresAt,
          totalVND: details.totalVND,
        }}
      />
    </main>
  );
}
