'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useBookingStore } from '@/lib/state';

interface BookButtonProps {
  tripId: string;
  ticketCount: number;
  /** Chosen boarding point (name + "HH:MM"), when booking from a per-point card. */
  boardingPoint?: string | null;
  boardingTime?: string | null;
}

export function BookButton({ tripId, ticketCount, boardingPoint, boardingTime }: BookButtonProps) {
  const router = useRouter();
  const setTrip = useBookingStore((s) => s.setTrip);

  function handleClick() {
    // Store survives client navigation; URL params survive a full reload on
    // /booking/customer (the store has no persist middleware).
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
      className="min-h-11 bg-primary-strong hover:bg-primary-strong/90"
      aria-label="Đặt vé chuyến này"
    >
      Đặt vé
    </Button>
  );
}
