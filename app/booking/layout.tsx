'use client';

/**
 * /booking layout — client component guard.
 *
 * Checks bookingStore.tripId on mount. If absent (direct URL access),
 * redirects to /search so the user picks a trip first.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useBookingStore } from '@/lib/state/bookingStore';

export default function BookingLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const tripId = useBookingStore((s) => s.tripId);

  useEffect(() => {
    if (!tripId) {
      router.replace('/search');
    }
  }, [tripId, router]);

  // Render children; redirect is handled asynchronously by useEffect.
  // While redirecting, render nothing to avoid flash.
  if (!tripId) return null;

  return <>{children}</>;
}
