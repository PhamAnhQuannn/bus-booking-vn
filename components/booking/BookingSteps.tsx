import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Booking funnel step indicator. 1 Thông tin → 2 Xác nhận & Thanh toán → 3 Hoàn tất.
 * Steps 1+2 (info + review/pay) were merged onto one page — the merged checkout
 * renders `current={2}`. `current` is the active 1-based step; earlier steps
 * render done (check). Labels resolve from booking.steps.* (localized VI/EN).
 */
const STEP_KEYS = ['steps.step1', 'steps.step2', 'steps.step3'] as const;

export function BookingSteps({ current }: { current: 1 | 2 | 3 }) {
  const t = useTranslations('booking');
  return (
    <ol className="flex items-center gap-2" aria-label={t('steps.aria', { current, total: STEP_KEYS.length })}>
      {STEP_KEYS.map((labelKey, i) => {
        const step = i + 1;
        const done = step < current;
        const active = step === current;
        return (
          <li key={labelKey} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                done && 'bg-primary text-primary-foreground',
                active && 'bg-primary text-primary-foreground ring-2 ring-primary/30',
                !done && !active && 'bg-muted text-muted-foreground'
              )}
              aria-current={active ? 'step' : undefined}
            >
              {done ? <Check className="size-3.5" aria-hidden="true" /> : step}
            </span>
            <span
              className={cn(
                'hidden text-sm font-medium sm:inline',
                active || done ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              {t(labelKey)}
            </span>
            {step < STEP_KEYS.length && (
              <span
                className={cn('h-px flex-1', done ? 'bg-primary' : 'bg-border')}
                aria-hidden="true"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
