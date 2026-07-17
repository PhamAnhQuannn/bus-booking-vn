'use client';

import * as React from 'react';
import { Autocomplete } from '@base-ui/react/autocomplete';
import { MapPin } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface PlaceComboboxProps {
  id?: string;
  /** Suggestion list (filtered as the user types). */
  items: readonly string[];
  /** Controlled free-text value. */
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
  className?: string;
  'aria-required'?: React.AriaAttributes['aria-required'];
  'aria-invalid'?: React.AriaAttributes['aria-invalid'];
}

/**
 * Token-styled place combobox (free-text + suggestions) on base-ui Autocomplete.
 * `mode="list"`: the input stays free-text, suggestions filter as you type — picking
 * one just fills the input. Replaces the un-styleable native <datalist>.
 */
export function PlaceCombobox({
  id,
  items,
  value,
  onValueChange,
  placeholder,
  required,
  maxLength,
  className,
  ...rest
}: PlaceComboboxProps) {
  return (
    <Autocomplete.Root
      items={items as string[]}
      value={value}
      onValueChange={(v) => onValueChange(v)}
      mode="list"
    >
      <Autocomplete.Input
        id={id}
        required={required}
        maxLength={maxLength}
        placeholder={placeholder}
        autoComplete="off"
        className={cn(
          'min-h-11 w-full min-w-0 rounded-lg border border-input bg-transparent px-3 py-1 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 md:text-sm',
          className
        )}
        {...rest}
      />
      <Autocomplete.Portal>
        <Autocomplete.Positioner className="z-50 outline-none" sideOffset={6}>
          <Autocomplete.Popup className="max-h-64 w-[var(--anchor-width)] min-w-[12rem] overflow-y-auto overscroll-contain rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-e3">
            <Autocomplete.Empty className="px-3 py-2 text-sm text-muted-foreground">
              Không tìm thấy địa điểm — bạn vẫn có thể nhập.
            </Autocomplete.Empty>
            <Autocomplete.List>
              {(item: string) => (
                <Autocomplete.Item
                  key={item}
                  value={item}
                  className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-2.5 text-sm outline-none select-none data-[highlighted]:bg-accent data-[highlighted]:text-foreground"
                >
                  <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  {item}
                </Autocomplete.Item>
              )}
            </Autocomplete.List>
          </Autocomplete.Popup>
        </Autocomplete.Positioner>
      </Autocomplete.Portal>
    </Autocomplete.Root>
  );
}
