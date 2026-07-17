'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useBookingStore } from '@/lib/state';

interface BookButtonProps {
  tripId: string;
  ticketCount: number;
}

export function BookButton({ tripId, ticketCount }: BookButtonProps) {
  const router = useRouter();
  const setTrip = useBookingStore((s) => s.setTrip);

  function handleClick() {
    setTrip(tripId, ticketCount);
    router.push(`/booking/customer?tripId=${tripId}&ticketCount=${ticketCount}`);
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
