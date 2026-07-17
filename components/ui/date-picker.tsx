'use client';

/**
 * DatePicker — token-styled date field: a button trigger (looks like Input) that
 * opens a Calendar popover (base-ui Popover, same Portal→Positioner→Popup pattern
 * as combobox.tsx). Replaces native <input type="date"> so past/out-of-range days
 * can be greyed + non-clickable and the calendar sized up.
 *
 * Value is a YYYY-MM-DD string. Controlled via `value`/`onValueChange`, or
 * uncontrolled via `defaultValue`. Pass `name` to also emit a hidden input so the
 * value submits inside a plain/GET <form> (e.g. the reports/overview RSC form).
 */

import * as React from 'react';
import { Popover } from '@base-ui/react/popover';
import { format, parseISO, startOfMonth } from 'date-fns';
import { CalendarDays } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Calendar } from './calendar';

/** Today in Asia/Ho_Chi_Minh as YYYY-MM-DD. */
function todayVN(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
}

/** YYYY-MM-DD → dd/MM/yyyy for the trigger label. */
function displayDate(iso: string): string {
  return format(parseISO(iso), 'dd/MM/yyyy');
}

export interface DatePickerProps {
  /** Controlled value (YYYY-MM-DD). */
  value?: string;
  /** Uncontrolled seed (YYYY-MM-DD). */
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Emit a hidden input under this name so the value submits in a plain form. */
  name?: string;
  /** Inclusive bounds (YYYY-MM-DD); days outside render greyed + non-clickable. */
  min?: string;
  max?: string;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
  'data-testid'?: string;
  'aria-label'?: string;
  'aria-required'?: React.AriaAttributes['aria-required'];
  'aria-invalid'?: React.AriaAttributes['aria-invalid'];
  iconPosition?: 'leading' | 'trailing';
}

export function DatePicker({
  value,
  defaultValue,
  onValueChange,
  name,
  min,
  max,
  placeholder = 'Chọn ngày',
  id,
  disabled,
  className,
  iconPosition = 'trailing',
  ...rest
}: DatePickerProps) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = React.useState(defaultValue ?? '');
  const current = isControlled ? value : internal;

  const [open, setOpen] = React.useState(false);
  const [month, setMonth] = React.useState<Date>(() => {
    const seed = current || (min && min > todayVN() ? min : todayVN());
    return startOfMonth(parseISO(seed));
  });

  function handleSelect(date: string) {
    if (!isControlled) setInternal(date);
    onValueChange?.(date);
    setOpen(false);
  }

  // Show the selected value's month each time the calendar opens (event-driven,
  // not an effect) so it follows external value changes without cascading renders.
  function handleOpenChange(next: boolean) {
    if (next && current) setMonth(startOfMonth(parseISO(current)));
    setOpen(next);
  }

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger
        type="button"
        id={id}
        disabled={disabled}
        aria-required={rest['aria-required']}
        aria-invalid={rest['aria-invalid']}
        aria-label={rest['aria-label']}
        data-testid={rest['data-testid']}
        className={cn(
          'inline-flex min-h-11 w-full items-center gap-2 rounded-lg border border-input bg-transparent px-3 py-1 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 md:text-sm',
          iconPosition === 'trailing' && 'justify-between',
          !current && 'text-muted-foreground',
          className
        )}
      >
        {iconPosition === 'leading' && (
          <CalendarDays className="size-4 shrink-0 text-primary" aria-hidden="true" />
        )}
        <span className={iconPosition === 'leading' ? 'flex-1 text-left' : ''}>{current ? displayDate(current) : placeholder}</span>
        {iconPosition === 'trailing' && (
          <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
      </Popover.Trigger>

      {name != null && <input type="hidden" name={name} value={current ?? ''} />}

      <Popover.Portal>
        <Popover.Positioner sideOffset={6} className="z-50 outline-none">
          <Popover.Popup className="origin-[var(--transform-origin)] rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-e4 transition-[transform,scale,opacity] duration-200 ease-out data-[ending-style]:scale-[0.96] data-[ending-style]:opacity-0 data-[ending-style]:duration-150 data-[starting-style]:scale-[0.96] data-[starting-style]:opacity-0">
            <Calendar
              selected={current || undefined}
              onSelect={handleSelect}
              month={month}
              onMonthChange={setMonth}
              min={min}
              max={max}
            />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
