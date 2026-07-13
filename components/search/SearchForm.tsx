'use client';

import { type FormEvent, useEffect, useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, ArrowLeftRight, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PlaceCombobox } from '@/components/ui/combobox';
import { DatePicker } from '@/components/ui/date-picker';
import { useSearchStore } from '@/lib/stores';

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

  const [todayVN] = useState(() =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())
  );

  const [hydrated, setHydrated] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setHydrated(true), []);
  const o = hydrated ? origin : '';
  const d = hydrated ? destination : '';
  const dt = hydrated ? date : '';
  const tc = hydrated ? ticketCount : '1';
  const tcNum = Number(tc) || 1;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!o.trim() || !d.trim() || !dt || dt < todayVN) {
      return;
    }
    const params = new URLSearchParams({
      origin: o.trim(),
      destination: d.trim(),
      date: dt,
      ticketCount: tc,
    });
    router.push(`/?${params.toString()}`);
  }

  function handleSwap() {
    const prevOrigin = origin;
    setOrigin(destination);
    setDestination(prevOrigin);
  }

  return (
    <form
      id={formId}
      onSubmit={handleSubmit}
      aria-label="Trip search"
      className={
        horizontal
          ? 'flex w-full flex-col gap-3 md:flex-row md:items-end'
          : 'flex w-full flex-col gap-3'
      }
    >
      {/* Origin + Destination grouped */}
      <div className={horizontal ? 'flex flex-col gap-1.5 md:flex-1' : 'flex flex-col gap-1.5'}>
        <label htmlFor={`${formId}-origin`} className={horizontal ? 'sr-only' : 'text-sm font-medium'}>
          Điểm xuất phát
        </label>
        <label htmlFor={`${formId}-destination`} className="sr-only">
          Điểm đến
        </label>
        <div className="relative flex flex-col overflow-hidden rounded-lg border border-input divide-y divide-input focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 sm:flex-row sm:divide-x sm:divide-y-0">
          <div className="relative flex-1">
            <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <PlaceCombobox
              id={`${formId}-origin`}
              items={places}
              value={o}
              onValueChange={setOrigin}
              placeholder="Điểm xuất phát"
              className="border-0 rounded-none pl-9 focus-visible:ring-0 focus-visible:outline-none"
              required
              maxLength={50}
              aria-required="true"
            />
          </div>
          <div className="relative flex-1">
            <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <PlaceCombobox
              id={`${formId}-destination`}
              items={places}
              value={d}
              onValueChange={setDestination}
              placeholder="Điểm đến"
              className="border-0 rounded-none pl-9 focus-visible:ring-0 focus-visible:outline-none"
              required
              maxLength={50}
              aria-required="true"
            />
          </div>
          <button
            type="button"
            onClick={handleSwap}
            aria-label="Đổi chiều điểm đi và điểm đến"
            className="absolute right-2 top-1/2 z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-primary shadow-e2 transition-transform hover:scale-105 hover:bg-primary/5 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:left-1/2 sm:right-auto sm:-translate-x-1/2"
          >
            <ArrowLeftRight className="size-4 rotate-90 sm:rotate-0" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Date + ticket count */}
      <div className={horizontal ? 'grid grid-cols-2 gap-3 md:w-64 md:shrink-0' : 'grid grid-cols-2 gap-3'}>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${formId}-date`} className={horizontal ? 'sr-only' : 'text-sm font-medium'}>
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

        <div className="flex flex-col gap-1.5">
          <span className={horizontal ? 'sr-only' : 'text-sm font-medium'}>Số vé</span>
          <div className="flex min-h-11 items-center justify-between rounded-lg border border-input px-1">
            <button
              type="button"
              onClick={() => setTicketCount(String(Math.max(1, tcNum - 1)))}
              disabled={tcNum <= 1}
              aria-label="Giảm số vé"
              className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
            >
              <Minus className="size-4" aria-hidden="true" />
            </button>
            <span className="min-w-6 select-none text-center text-base font-semibold tabular-nums" aria-label={`${tc} vé`}>
              {tc}
            </span>
            <button
              type="button"
              onClick={() => setTicketCount(String(Math.min(10, tcNum + 1)))}
              disabled={tcNum >= 10}
              aria-label="Tăng số vé"
              className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
            >
              <Plus className="size-4" aria-hidden="true" />
            </button>
          </div>
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
