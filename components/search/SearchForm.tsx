'use client';

/**
 * SearchForm — client component for trip search.
 *
 * Mobile-first, 390px viewport. All interactive elements meet
 * WCAG 2.5.5 min 44px tap target (min-h-11 = 44px in Tailwind).
 *
 * Reads/writes searchStore (Zustand + localStorage) so back-nav restores state.
 * On submit navigates to /search?origin=...&destination=...&date=...&ticketCount=...
 */

import { type FormEvent, useId } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PlaceCombobox } from '@/components/ui/combobox';
import { useSearchStore } from '@/lib/stores/searchStore';

export function SearchForm({ places = [] }: { places?: string[] }) {
  const router = useRouter();
  const formId = useId();

  const { origin, destination, date, ticketCount, setOrigin, setDestination, setDate, setTicketCount } =
    useSearchStore();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const params = new URLSearchParams({
      origin: origin.trim(),
      destination: destination.trim(),
      date,
      ticketCount,
    });
    router.push(`/search?${params.toString()}`);
  }

  return (
    <form
      id={formId}
      onSubmit={handleSubmit}
      aria-label="Trip search"
      className="flex w-full flex-col gap-4"
    >
      {/* Origin */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${formId}-origin`} className="text-sm font-medium">
          Điểm xuất phát
        </label>
        <PlaceCombobox
          id={`${formId}-origin`}
          items={places}
          value={origin}
          onValueChange={setOrigin}
          placeholder="Ví dụ: Hà Nội"
          required
          maxLength={50}
          aria-required="true"
        />
      </div>

      {/* Destination */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${formId}-destination`} className="text-sm font-medium">
          Điểm đến
        </label>
        <PlaceCombobox
          id={`${formId}-destination`}
          items={places}
          value={destination}
          onValueChange={setDestination}
          placeholder="Ví dụ: TP.HCM"
          required
          maxLength={50}
          aria-required="true"
        />
      </div>

      {/* Date + ticket count on one row — date wider, count compact */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 flex flex-col gap-1.5">
          <label htmlFor={`${formId}-date`} className="text-sm font-medium">
            Ngày đi
          </label>
          <Input
            id={`${formId}-date`}
            name="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="min-h-11"
            aria-required="true"
          />
        </div>

        <div className="col-span-1 flex flex-col gap-1.5">
          <label htmlFor={`${formId}-ticketCount`} className="text-sm font-medium">
            Số vé
          </label>
          <Input
            id={`${formId}-ticketCount`}
            name="ticketCount"
            type="number"
            min={1}
            max={10}
            value={ticketCount}
            onChange={(e) => setTicketCount(e.target.value)}
            required
            className="min-h-11"
            aria-required="true"
          />
        </div>
      </div>

      {/* Submit */}
      <Button
        type="submit"
        size="lg"
        className="mt-1 min-h-11 w-full text-base font-semibold"
        disabled={!origin.trim() || !destination.trim() || !date}
      >
        Tìm chuyến xe
      </Button>
    </form>
  );
}
