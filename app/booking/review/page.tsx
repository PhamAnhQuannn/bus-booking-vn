/**
 * /booking/review — Order review step.
 *
 * Server component: fetches hold details from GET /api/holds/[id] using the
 * bb_hold cookie forwarded from the request. If cookie is missing or invalid,
 * redirects to /search.
 */

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
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

  // Derive the base URL from the incoming request headers so the server-side
  // fetch hits the same origin the page is being served from. A hardcoded
  // localhost:3000 fallback breaks whenever Next dev auto-bumps ports (e.g.
  // when port 3000 is taken by another app and next dev lands on 3001).
  const hdrs = await headers();
  const host = hdrs.get('host') ?? 'localhost:3000';
  const proto = hdrs.get('x-forwarded-proto') ?? 'http';
  const baseUrl = `${proto}://${host}`;
  const res = await fetch(`${baseUrl}/api/holds/${holdId}`, {
    headers: {
      cookie: `bb_hold=${bbHold.value}`,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    redirect('/search');
  }

  const data = await res.json();

  return (
    <main className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Xem lại đơn hàng</h1>
      <ReviewClient
        holdDetails={{
          holdId,
          tripId: data.tripId,
          ticketCount: data.ticketCount,
          expiresAt: data.expiresAt,
          totalVND: data.totalVND,
        }}
      />
    </main>
  );
}
