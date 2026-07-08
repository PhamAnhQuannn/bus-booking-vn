'use client';

/**
 * /booking layout — client component guard.
 *
 * Checks bookingStore.tripId on mount for the pre-booking flow (customer-info,
 * review). Confirmation (`/booking/confirmation/:token`) and result
 * (`/booking/result/:token`) pages are reachable via SMS/email link or the
 * MoMo return URL with no prior session state — they MUST bypass the tripId
 * guard. The token in the URL is itself the access key.
 */

import { useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useBookingStore } from '@/lib/state';

const TOKEN_LANDING_PREFIXES = ['/booking/confirmation', '/booking/result', '/booking/bank-transfer'];

export default function BookingLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tripId = useBookingStore((s) => s.tripId);

  const isTokenLanding =
    TOKEN_LANDING_PREFIXES.some((p) => pathname?.startsWith(p)) ?? false;
  const hasTripParam = !!searchParams.get('tripId');

  useEffect(() => {
    if (!isTokenLanding && !hasTripParam && !tripId) {
      router.replace('/search');
    }
  }, [isTokenLanding, hasTripParam, tripId, router]);

  if (!isTokenLanding && !hasTripParam && !tripId) return null;

  return <>{children}</>;
}
