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

import { type FormEvent, useEffect, useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PlaceCombobox } from '@/components/ui/combobox';
import { DatePicker } from '@/components/ui/date-picker';
import { useSearchStore } from '@/lib/stores/searchStore';

export function SearchForm({
  places = [],
  orientation = 'vertical',
}: {
  places?: string[];
  orientation?: 'vertical' | 'horizontal';
}) {
  const router = useRouter();
  const formId = useId();
  const horizontal = orientation === 'horizontal';

  const { origin, destination, date, ticketCount, setOrigin, setDestination, setDate, setTicketCount } =
    useSearchStore();

  // Earliest selectable day = today in Asia/Ho_Chi_Minh (en-CA → YYYY-MM-DD).
  // Drives the DatePicker `min` (greys past days) + the submit guard. Computed once
  // (initializer) so the render body stays pure — no `new Date()` per render.
  const [todayVN] = useState(() =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())
  );

  // Hydration gate: the store rehydrates persisted search state from localStorage
  // (a client-only value the server can't know). Render every store-bound, SSR-visible
  // value from empty defaults until mounted, so the first client render is byte-identical
  // to the server render — then fill from the store on the next render. Prevents the
  // submit-button `disabled` / input-value hydration mismatch.
  const [hydrated, setHydrated] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setHydrated(true), []);
  const o = hydrated ? origin : '';
  const d = hydrated ? destination : '';
  const dt = hydrated ? date : '';
  const tc = hydrated ? ticketCount : '1';

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
      className={
        horizontal
          ? 'flex w-full flex-col gap-3 md:flex-row md:items-end'
          : 'flex w-full flex-col gap-4'
      }
    >
      {/* Origin */}
      <div className={horizontal ? 'flex flex-col gap-1.5 md:flex-1' : 'flex flex-col gap-1.5'}>
        <label htmlFor={`${formId}-origin`} className="text-sm font-medium">
          Điểm xuất phát
        </label>
        <PlaceCombobox
          id={`${formId}-origin`}
          items={places}
          value={o}
          onValueChange={setOrigin}
          placeholder="Ví dụ: Hà Nội"
          required
          maxLength={50}
          aria-required="true"
        />
      </div>

      {/* Destination */}
      <div className={horizontal ? 'flex flex-col gap-1.5 md:flex-1' : 'flex flex-col gap-1.5'}>
        <label htmlFor={`${formId}-destination`} className="text-sm font-medium">
          Điểm đến
        </label>
        <PlaceCombobox
          id={`${formId}-destination`}
          items={places}
          value={d}
          onValueChange={setDestination}
          placeholder="Ví dụ: TP.HCM"
          required
          maxLength={50}
          aria-required="true"
        />
      </div>

      {/* Date + ticket count on one row — date wider, count compact */}
      <div className={horizontal ? 'grid grid-cols-3 gap-3 md:w-56 md:shrink-0' : 'grid grid-cols-3 gap-3'}>
        <div className="col-span-2 flex flex-col gap-1.5">
          <label htmlFor={`${formId}-date`} className="text-sm font-medium">
            Ngày đi
          </label>
          <DatePicker
            id={`${formId}-date`}
            value={dt}
            min={todayVN}
            onValueChange={setDate}
            placeholder="Chọn ngày đi"
            aria-label="Ngày đi"
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
            value={tc}
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
        suppressHydrationWarning
        className={
          horizontal
            ? 'min-h-11 w-full text-base font-semibold md:mt-0 md:w-auto md:shrink-0 md:px-8'
            : 'mt-1 min-h-11 w-full text-base font-semibold'
        }
        disabled={!o.trim() || !d.trim() || !dt || dt < todayVN}
      >
        Tìm chuyến xe
      </Button>
    </form>
  );
}
