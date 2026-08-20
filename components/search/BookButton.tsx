'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useRouter } from '@/i18n/navigation';
import { useBookingStore } from '@/lib/state';

interface BookButtonProps {
  tripId: string;
  ticketCount: number;
  /** Chosen boarding point (name + "HH:MM"), when booking from a per-point card. */
  boardingPoint?: string | null;
  boardingTime?: string | null;
  /** CTA text (pre-localized by the caller). Defaults to the "Book" label. */
  label?: string;
}

export function BookButton({ tripId, ticketCount, boardingPoint, boardingTime, label }: BookButtonProps) {
  const router = useRouter();
  const t = useTranslations('search');
  const setTrip = useBookingStore((s) => s.setTrip);
  const resolvedLabel = label ?? t('book.bookTicket');

  function handleClick() {
    // Store survives client navigation; URL params survive a full reload on
    // /booking/customer (the store has no persist middleware). next-intl router
    // keeps the active locale prefix on the push.
    setTrip(tripId, ticketCount, boardingPoint ?? null, boardingTime ?? null);
    const p = new URLSearchParams({ tripId, ticketCount: String(ticketCount) });
    if (boardingPoint) p.set('boardingPoint', boardingPoint);
    if (boardingTime) p.set('boardingTime', boardingTime);
    router.push(`/booking/customer?${p.toString()}`);
  }

  return (
    <Button
      type="button"
      onClick={handleClick}
      className="min-h-11 bg-primary-strong px-6 text-base hover:bg-primary-strong/90"
      aria-label={t('book.aria', { label: resolvedLabel })}
    >
      {resolvedLabel}
    </Button>
  );
}
