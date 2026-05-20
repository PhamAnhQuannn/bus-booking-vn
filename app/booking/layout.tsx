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
import { usePathname, useRouter } from 'next/navigation';
import { useBookingStore } from '@/lib/state/bookingStore';

const TOKEN_LANDING_PREFIXES = ['/booking/confirmation', '/booking/result'];

export default function BookingLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const tripId = useBookingStore((s) => s.tripId);

  const isTokenLanding =
    TOKEN_LANDING_PREFIXES.some((p) => pathname?.startsWith(p)) ?? false;

  useEffect(() => {
    if (!isTokenLanding && !tripId) {
      router.replace('/search');
    }
  }, [isTokenLanding, tripId, router]);

  if (!isTokenLanding && !tripId) return null;

  return <>{children}</>;
}
