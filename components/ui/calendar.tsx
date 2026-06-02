'use client';

/**
 * Calendar — token-styled month grid (no native <input type="date">, which can't
 * be colour-/size-styled). Day-keyed entirely on YYYY-MM-DD strings so all range
 * comparisons are timezone-safe (lexical order == chronological). Out-of-range days
 * (outside [min, max]) render greyed + non-clickable.
 *
 * Pairs with date-picker.tsx (base-ui Popover trigger). Design Language v1.0:
 * Mon-first week (VN), lowercase Vietnamese month label (§2), 44px day cells (§10),
 * primary-orange selection, warm-grey disabled days.
 */

import * as React from 'react';
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { vi } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';

const WEEK_OPTS = { weekStartsOn: 1 } as const; // Monday-first (VN convention)
const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

/** Today in Asia/Ho_Chi_Minh as YYYY-MM-DD. */
function todayVN(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
}

export interface CalendarProps {
  /** Selected day (YYYY-MM-DD). */
  selected?: string;
  onSelect: (date: string) => void;
  /** Currently displayed month. */
  month: Date;
  onMonthChange: (month: Date) => void;
  /** Inclusive bounds (YYYY-MM-DD); days outside render greyed + non-clickable. */
  min?: string;
  max?: string;
  /** Today marker (YYYY-MM-DD); defaults to VN today. */
  today?: string;
}

export function Calendar({
  selected,
  onSelect,
  month,
  onMonthChange,
  min,
  max,
  today = todayVN(),
}: CalendarProps) {
  const gridStart = startOfWeek(startOfMonth(month), WEEK_OPTS);
  const gridEnd = endOfWeek(endOfMonth(month), WEEK_OPTS);
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const isDisabled = React.useCallback(
    (iso: string) => (min != null && iso < min) || (max != null && iso > max),
    [min, max]
  );

  // Roving-tabindex focus target. Seed to the selected day (if in this month) else
  // the first of the month — a single day is tabbable; arrows move focus.
  const [focusDate, setFocusDate] = React.useState(() =>
    selected && isSameMonth(parseISO(selected), month)
      ? selected
      : format(startOfMonth(month), 'yyyy-MM-dd')
  );
  const buttonsRef = React.useRef<Map<string, HTMLButtonElement>>(new Map());
  const shouldFocusRef = React.useRef(false);

  // Tabbable day (roving tabindex): the focus target when it's in the visible month,
  // else the first of the month. Derived — no effect needed when the month changes.
  const tabDate = isSameMonth(parseISO(focusDate), month)
    ? focusDate
    : format(startOfMonth(month), 'yyyy-MM-dd');

  // After a keyboard move, focus the new day button.
  React.useEffect(() => {
    if (shouldFocusRef.current) {
      buttonsRef.current.get(focusDate)?.focus();
      shouldFocusRef.current = false;
    }
  }, [focusDate]);

  function go(nextIso: string, crossMonth = false) {
    shouldFocusRef.current = true;
    if (crossMonth || !isSameMonth(parseISO(nextIso), month)) {
      onMonthChange(startOfMonth(parseISO(nextIso)));
    }
    setFocusDate(nextIso);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    const cur = parseISO(focusDate);
    switch (e.key) {
      case 'ArrowLeft': e.preventDefault(); go(format(addDays(cur, -1), 'yyyy-MM-dd')); break;
      case 'ArrowRight': e.preventDefault(); go(format(addDays(cur, 1), 'yyyy-MM-dd')); break;
      case 'ArrowUp': e.preventDefault(); go(format(addDays(cur, -7), 'yyyy-MM-dd')); break;
      case 'ArrowDown': e.preventDefault(); go(format(addDays(cur, 7), 'yyyy-MM-dd')); break;
      case 'Home': e.preventDefault(); go(format(startOfWeek(cur, WEEK_OPTS), 'yyyy-MM-dd')); break;
      case 'End': e.preventDefault(); go(format(endOfWeek(cur, WEEK_OPTS), 'yyyy-MM-dd')); break;
      case 'PageUp': e.preventDefault(); go(format(addMonths(cur, -1), 'yyyy-MM-dd'), true); break;
      case 'PageDown': e.preventDefault(); go(format(addMonths(cur, 1), 'yyyy-MM-dd'), true); break;
      case 'Enter':
      case ' ': e.preventDefault(); if (!isDisabled(focusDate)) onSelect(focusDate); break;
      default: break;
    }
  }

  return (
    <div className="w-fit" role="group" aria-label="Lịch chọn ngày">
      {/* Month navigation */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Tháng trước"
          onClick={() => onMonthChange(addMonths(month, -1))}
          className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
        </button>
        <div aria-live="polite" className="text-sm font-semibold">
          {format(month, 'LLLL yyyy', { locale: vi })}
        </div>
        <button
          type="button"
          aria-label="Tháng sau"
          onClick={() => onMonthChange(addMonths(month, 1))}
          className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <ChevronRight className="size-5" aria-hidden="true" />
        </button>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="flex h-8 items-center justify-center text-xs font-medium text-muted-foreground"
          >
            {w}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7" role="grid" onKeyDown={handleKeyDown}>
        {days.map((day) => {
          const iso = format(day, 'yyyy-MM-dd');
          const disabled = isDisabled(iso);
          const isSelected = iso === selected;
          const isToday = iso === today;
          const outside = !isSameMonth(day, month);
          return (
            <button
              key={iso}
              type="button"
              ref={(el) => {
                if (el) buttonsRef.current.set(iso, el);
                else buttonsRef.current.delete(iso);
              }}
              tabIndex={iso === tabDate ? 0 : -1}
              aria-pressed={isSelected}
              aria-current={isToday ? 'date' : undefined}
              aria-disabled={disabled || undefined}
              aria-label={format(day, "EEEE d 'tháng' M yyyy", { locale: vi })}
              onClick={() => !disabled && onSelect(iso)}
              className={cn(
                'inline-flex size-11 items-center justify-center rounded-md text-sm transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                disabled && 'pointer-events-none bg-muted/30 text-muted-foreground/40',
                !disabled && !isSelected && 'hover:bg-accent',
                outside && !disabled && !isSelected && 'text-muted-foreground/60',
                isToday && !isSelected && 'font-semibold text-primary ring-1 ring-primary/40',
                isSelected && 'bg-primary font-semibold text-primary-foreground'
              )}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
