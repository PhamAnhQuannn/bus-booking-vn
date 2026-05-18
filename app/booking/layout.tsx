'use client';

/**
 * /booking layout — client component guard.
 *
 * Checks bookingStore.tripId on mount for the pre-booking flow (customer-info,
 * review). Confirmation pages (`/booking/confirmation/:token`) are reachable
 * via SMS/email link with no prior session state — they MUST bypass the
 * tripId guard. The confirmationToken in the URL is itself the access key.
 */

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useBookingStore } from '@/lib/state/bookingStore';

export default function BookingLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const tripId = useBookingStore((s) => s.tripId);

  const isConfirmation = pathname?.startsWith('/booking/confirmation') ?? false;

  useEffect(() => {
    if (!isConfirmation && !tripId) {
      router.replace('/search');
    }
  }, [isConfirmation, tripId, router]);

  if (!isConfirmation && !tripId) return null;

  return <>{children}</>;
}
