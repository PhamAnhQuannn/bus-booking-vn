'use client';

/**
 * /booking layout — client component guard.
 *
 * Checks bookingStore.tripId on mount for the pre-booking flow (customer-info).
 * Confirmation (`/booking/confirmation/:token`), result (`/booking/result/:token`),
 * bank-transfer (`/booking/bank-transfer`), and review (`/booking/review`) pages
 * are reachable via SMS/email link, the payment redirect, or a restored tab with
 * no prior session state — they MUST bypass the tripId guard. Each of those
 * routes re-verifies its own access key server-side (confirmationToken / bb_hold
 * cookie), so the token/cookie in the URL is itself the access key, not the
 * client store.
 *
 * `/booking/customer` carries `?tripId=` in the URL itself — on a fresh session
 * (shared link, restored tab, cleared storage) we recover by seeding the store
 * from the URL instead of silently bouncing home (audit F6). Only when there is
 * truly no recoverable state do we show an interstitial instead of a silent
 * `router.replace('/')`.
 *
 * The query string is read from window.location in a mount effect, NOT via
 * useSearchParams(): that hook in a client layout opts the whole /booking
 * segment into the CSR bailout, so the server streams a 200 shell before the
 * page's notFound() can set the 404 status (broke the unknown-token e2e).
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useBookingStore } from '@/lib/state';
import { buttonVariants } from '@/components/ui/button';

const TOKEN_LANDING_PREFIXES = [
  '/booking/confirmation',
  '/booking/result',
  '/booking/bank-transfer',
  '/booking/review',
];

export default function BookingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const tripId = useBookingStore((s) => s.tripId);
  const setTrip = useBookingStore((s) => s.setTrip);

  const isTokenLanding =
    TOKEN_LANDING_PREFIXES.some((p) => pathname?.startsWith(p)) ?? false;

  // null = not read yet (pre-mount); { tripId: null } = read, nothing recoverable.
  const [urlParams, setUrlParams] = useState<{ tripId: string | null; ticketCount: number } | null>(null);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- window.location is browser-only; same pattern as SearchForm's hydration gate
    setUrlParams({
      tripId: sp.get('tripId'),
      ticketCount: Math.max(1, Number(sp.get('ticketCount')) || 1),
    });
  }, [pathname]);

  const urlTripId =
    pathname?.startsWith('/booking/customer') && urlParams ? urlParams.tripId : null;

  useEffect(() => {
    if (!isTokenLanding && !tripId && urlTripId && urlParams) {
      setTrip(urlTripId, urlParams.ticketCount);
    }
  }, [isTokenLanding, tripId, urlTripId, urlParams, setTrip]);

  if (isTokenLanding || tripId || urlTripId) return <>{children}</>;

  // Query string not read yet — render nothing rather than flashing the interstitial.
  if (urlParams === null) return null;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-3 px-4 py-20 text-center">
      <p className="text-base font-medium text-foreground">Phiên đặt vé đã hết hạn</p>
      <p className="text-sm text-muted-foreground">Vui lòng chọn lại chuyến xe để tiếp tục.</p>
      <Link href="/" className={buttonVariants({ size: 'default' })}>
        Về trang chủ
      </Link>
    </div>
  );
}
