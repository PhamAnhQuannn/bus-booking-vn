'use client';

import { type FormEvent, useEffect, useId, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, ArrowLeftRight, ArrowRight, Minus, Plus, Loader2 } from 'lucide-react';
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

  const [todayVN, setTodayVN] = useState(() =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())
  );

  useEffect(() => {
    function refreshToday() {
      setTodayVN(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date()));
    }
    document.addEventListener('visibilitychange', refreshToday);
    window.addEventListener('focus', refreshToday);
    return () => {
      document.removeEventListener('visibilitychange', refreshToday);
      window.removeEventListener('focus', refreshToday);
    };
  }, []);

  const [hydrated, setHydrated] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setHydrated(true), []);
  const o = hydrated ? origin : '';
  const d = hydrated ? destination : '';
  const dt = hydrated ? date : '';
  const tc = hydrated ? ticketCount : 1;
  const tcNum = Number.isInteger(tc) ? Math.min(10, Math.max(1, tc)) : 1;

  const [error, setError] = useState<string | null>(null);
  const [swapped, setSwapped] = useState(false);
  const [isPending, startTransition] = useTransition();
  const sameCity = Boolean(o.trim()) && Boolean(d.trim()) && o.trim().toLowerCase() === d.trim().toLowerCase();
  const originInvalid = Boolean(error) && (!o.trim() || sameCity);
  const destInvalid = Boolean(error) && (!d.trim() || sameCity);
  const dateInvalid = Boolean(error) && (!dt || dt < todayVN);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!o.trim() || !d.trim()) {
      setError('Vui lòng nhập điểm đi và điểm đến.');
      return;
    }
    if (sameCity) {
      setError('Điểm đi và điểm đến không được trùng nhau.');
      return;
    }
    if (!dt || dt < todayVN) {
      setError('Vui lòng chọn ngày đi hợp lệ.');
      return;
    }
    setError(null);
    const params = new URLSearchParams({
      origin: o.trim(),
      destination: d.trim(),
      date: dt,
      ticketCount: String(tcNum),
    });
    startTransition(() => {
      router.push(`/?${params.toString()}`);
    });
  }

  function handleSwap() {
    const prevOrigin = origin;
    setOrigin(destination);
    setDestination(prevOrigin);
    setSwapped((s) => !s);
  }

  const submitButton = (
    <Button
      type="submit"
      size="lg"
      className={
        horizontal
          ? 'min-h-11 w-full bg-primary-strong text-base font-semibold hover:bg-primary-strong/90 md:mt-0 md:w-auto md:shrink-0 md:px-8'
          : 'col-span-2 mt-1 min-h-[46px] w-full bg-primary-strong text-base font-semibold hover:bg-primary-strong/90 md:col-span-1 md:mt-0 md:min-h-[58px] md:w-auto md:px-10'
      }
      disabled={isPending}
    >
      {isPending ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Đang tìm…
        </>
      ) : (
        <>
          Tìm chuyến xe
          <ArrowRight className="size-4" aria-hidden="true" data-icon="inline-end" />
        </>
      )}
    </Button>
  );

  return (
    <div className="flex w-full flex-col gap-2">
      <form
        id={formId}
        onSubmit={handleSubmit}
        aria-label="Tìm chuyến xe"
        noValidate
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
          <div className="relative flex flex-col gap-2 sm:flex-row sm:gap-2">
            <div
              className={`relative overflow-hidden rounded-lg border border-input focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 ${horizontal ? 'flex-1' : 'flex-1 sm:flex-[44] md:min-h-[58px]'}`}
            >
              <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <PlaceCombobox
                id={`${formId}-origin`}
                items={places}
                value={o}
                onValueChange={setOrigin}
                placeholder="Nhập điểm xuất phát"
                className={`border-0 rounded-none pl-9 focus-visible:ring-0 focus-visible:outline-none ${horizontal ? '' : 'md:h-[56px]'}`}
                required
                maxLength={50}
                aria-required="true"
                aria-invalid={originInvalid || undefined}
              />
            </div>
            <div
              className={`relative overflow-hidden rounded-lg border border-input focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 ${horizontal ? 'flex-1' : 'flex-1 sm:flex-[56] md:min-h-[58px]'}`}
            >
              <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <PlaceCombobox
                id={`${formId}-destination`}
                items={places}
                value={d}
                onValueChange={setDestination}
                placeholder="Nhập điểm đến"
                className={`border-0 rounded-none pl-9 focus-visible:ring-0 focus-visible:outline-none ${horizontal ? '' : 'md:h-[56px]'}`}
                required
                maxLength={50}
                aria-required="true"
                aria-invalid={destInvalid || undefined}
              />
            </div>
            <button
              type="button"
              onClick={handleSwap}
              aria-label="Đổi chiều điểm đi và điểm đến"
              className={`absolute top-1/2 z-10 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-primary shadow-e2 transition-all duration-300 hover:scale-105 hover:bg-primary/5 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none ${horizontal ? 'left-1/2' : 'left-1/2 sm:left-[44%]'} ${swapped ? 'rotate-180' : ''}`}
            >
              <ArrowLeftRight className="size-4 rotate-90 sm:rotate-0" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Date + ticket count */}
        <div
          className={
            horizontal
              ? 'grid grid-cols-[3fr_2fr] gap-3 md:w-64 md:shrink-0'
              : 'grid grid-cols-[3fr_2fr] gap-3 md:grid-cols-[3fr_2fr_auto] md:items-end'
          }
        >
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
              className={horizontal ? undefined : 'md:min-h-[58px]'}
              aria-required="true"
              aria-invalid={dateInvalid || undefined}
              iconPosition="leading"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className={horizontal ? 'sr-only' : 'text-sm font-medium'}>Số vé</span>
            <div
              className={`flex min-h-[46px] items-center justify-between rounded-lg border border-input px-1 ${horizontal ? '' : 'md:min-h-[58px]'}`}
            >
              <button
                type="button"
                onClick={() => setTicketCount(Math.max(1, tcNum - 1))}
                disabled={tcNum <= 1}
                aria-label="Giảm số vé"
                className="flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
              >
                <Minus className="size-4" aria-hidden="true" />
              </button>
              <span
                role="status"
                aria-live="polite"
                aria-atomic="true"
                className="min-w-6 select-none text-center text-base font-semibold tabular-nums"
                aria-label={`${tcNum} vé`}
              >
                {tcNum}
              </span>
              <button
                type="button"
                onClick={() => setTicketCount(Math.min(10, tcNum + 1))}
                disabled={tcNum >= 10}
                aria-label="Tăng số vé"
                className="flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
              >
                <Plus className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {!horizontal && submitButton}
        </div>

        {horizontal && submitButton}
      </form>

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
