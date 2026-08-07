import { cn } from '@/lib/utils';

/**
 * Always-mounted form status line (A2 / AU-3). Reserves its own vertical space
 * (`min-h-5`) so showing or clearing a message never shifts the submit button
 * below it, and carries a live region so screen-readers announce the message
 * when it appears.
 *
 * tone="error"   → role="alert"  + aria-live="assertive" (interrupts).
 * tone="success" → role="status" + aria-live="polite".
 * An empty/absent message renders an invisible spacer of the same height.
 */
export function FormError({
  message,
  tone = 'error',
  className,
}: {
  message?: string | null;
  tone?: 'error' | 'success';
  className?: string;
}) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      className={cn(
        'min-h-5 text-sm',
        tone === 'error' ? 'text-destructive' : 'text-success-foreground',
        !message && 'invisible',
        className,
      )}
    >
      {message}
    </p>
  );
}
