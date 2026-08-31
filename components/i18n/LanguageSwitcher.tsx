'use client';

import * as React from 'react';
import { useLocale } from 'next-intl';
import { Menu } from '@base-ui/react/menu';
import { Languages, ChevronDownIcon, CheckIcon, Loader2 } from 'lucide-react';
import { usePathname, useRouter } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { cn } from '@/lib/utils';

const LOCALES: { value: Locale; code: string; native: string }[] = [
  { value: 'vi', code: 'VI', native: 'Tiếng Việt' },
  { value: 'en', code: 'EN', native: 'English' },
];

/**
 * Header language switcher (Fable design). Base UI Menu + RadioGroup, mirroring
 * CustomerAccountMenu for visual + keyboard consistency.
 *
 * - Trigger: `Languages` glyph (NOT a flag — flags map to countries, not languages;
 *   NOT `Globe` — that reads as region), current-locale code (VI/EN), chevron. A whisper
 *   plate (`bg-background/60`, no border at rest) gives the dark label its own legible surface
 *   over the dark hero corner where a bare-ghost trigger failed AA; border + `bg-card` on
 *   hover/open. NO orange text (fails contrast on the glass). Orange only in focus ring + checkmark.
 * - Switching preserves the current pathname + query and rewrites the locale prefix
 *   (as-needed): vi = unprefixed, en = /en/…. Chevron becomes a spinner while pending.
 * - z-popover goes on Menu.Positioner, never Menu.Popup (DD-1 clip bug).
 */
export function LanguageSwitcher({ onNavigate }: { onNavigate?: () => void }) {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = React.useTransition();

  const current = LOCALES.find((l) => l.value === locale) ?? LOCALES[0];

  function switchTo(next: string) {
    if (next === locale) return;
    onNavigate?.();
    startTransition(() => {
      // usePathname() from next-intl returns the locale-STRIPPED path, so passing it
      // back with a new `locale` re-adds the correct prefix and keeps the same page.
      router.replace(pathname, { locale: next as Locale });
    });
  }

  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={`${locale === 'vi' ? 'Ngôn ngữ' : 'Language'}: ${current.native}`}
        disabled={pending}
        className={cn(
          // Ghost: no fill/border at rest so the frosted bar shows through; a
          // subtle border + card fill appears only on hover/open.
          'inline-flex h-[50px] items-center gap-2 rounded-2xl border border-transparent bg-background/60 px-3 text-[18px] font-semibold text-foreground outline-none transition-colors hover:border-border hover:bg-card focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:border-border aria-expanded:bg-card disabled:opacity-50'
        )}
      >
        <Languages aria-hidden="true" className="size-5 text-muted-foreground" />
        <span>{current.code}</span>
        {pending ? (
          <Loader2 aria-hidden="true" className="size-4 animate-spin text-muted-foreground motion-reduce:animate-none" />
        ) : (
          <ChevronDownIcon aria-hidden="true" className="size-4 text-muted-foreground" />
        )}
      </Menu.Trigger>
      <Menu.Portal>
        {/* z-popover on the Positioner, NOT the Popup (DD-1). */}
        <Menu.Positioner sideOffset={6} align="end" className="z-popover outline-none">
          <Menu.Popup
            className={cn(
              'min-w-44 rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-e3 outline-none',
              'transition-[transform,opacity] duration-200 ease-out data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none'
            )}
          >
            <Menu.RadioGroup value={locale} onValueChange={switchTo}>
              {LOCALES.map((l) => (
                <Menu.RadioItem
                  key={l.value}
                  value={l.value}
                  lang={l.value}
                  closeOnClick
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors data-[highlighted]:bg-muted',
                    l.value === locale && 'font-medium'
                  )}
                >
                  {l.native}
                  <Menu.RadioItemIndicator className="ml-auto">
                    <CheckIcon aria-hidden="true" className="size-4 text-primary-strong" />
                  </Menu.RadioItemIndicator>
                </Menu.RadioItem>
              ))}
            </Menu.RadioGroup>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
