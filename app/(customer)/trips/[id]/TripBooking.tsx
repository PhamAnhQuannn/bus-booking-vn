'use client';

/**
 * TripBooking — ticket-count stepper + BookButton for the trip detail page.
 * The stepper is capped at min(availableSeats, 10) (search ticketCount max).
 */

import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BookButton } from '@/components/search/BookButton';

export function TripBooking({
  tripId,
  availableSeats,
}: {
  tripId: string;
  availableSeats: number;
}) {
  const max = Math.min(availableSeats, 10);
  const [count, setCount] = useState(1);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div
        className="flex items-center gap-1 rounded-lg border border-border p-1"
        role="group"
        aria-label="Số vé"
      >
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-11"
          aria-label="Giảm số vé"
          disabled={count <= 1}
          onClick={() => setCount((c) => Math.max(1, c - 1))}
        >
          <Minus className="size-4" />
        </Button>
        <span className="min-w-8 text-center font-mono text-sm font-semibold" aria-live="polite">
          {count}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-11"
          aria-label="Tăng số vé"
          disabled={count >= max}
          onClick={() => setCount((c) => Math.min(max, c + 1))}
        >
          <Plus className="size-4" />
        </Button>
      </div>
      <BookButton tripId={tripId} ticketCount={count} />
    </div>
  );
}
