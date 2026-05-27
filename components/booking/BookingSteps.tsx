import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Booking funnel step indicator. 1 Thông tin → 2 Xác nhận → 3 Thanh toán.
 * `current` is the active 1-based step; earlier steps render done (check).
 */
const STEPS = ['Thông tin', 'Xác nhận', 'Thanh toán'] as const;

export function BookingSteps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="flex items-center gap-2" aria-label={`Bước ${current} trên ${STEPS.length}`}>
      {STEPS.map((label, i) => {
        const step = i + 1;
        const done = step < current;
        const active = step === current;
        return (
          <li key={label} className="flex flex-1 items-center gap-2">
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
              {label}
            </span>
            {step < STEPS.length && (
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
