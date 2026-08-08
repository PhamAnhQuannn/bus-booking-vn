import { cn } from '@/lib/utils';

/**
 * Always-mounted form status line (A2 / AU-3). Reserves its own vertical space
 * (`min-h-5`) so showing or clearing a message never shifts the submit button
 * below it, and carries a live region so screen-readers announce the message
 * when it appears.
 *
 * tone="error"   → role="alert"  + aria-live="assertive" (interrupts).
 * tone="success" → role="status" + aria-live="polite".
 * An empty/absent message renders as an empty line that still reserves height
 * (`min-h-5`). It is deliberately NOT hidden with `visibility:hidden` — that would
 * pull the live region out of the accessibility tree while empty, and a region
 * that flips from out-of-tree to visible-with-content in one render is not
 * reliably announced by every screen reader (review #4). Staying mounted and empty
 * keeps the announcement dependable.
 */
export function FormError({
  message,
  tone = 'error',
  id,
  className,
}: {
  message?: string | null;
  tone?: 'error' | 'success';
  id?: string;
  className?: string;
}) {
  return (
    <p
      id={id}
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      className={cn(
        'min-h-5 text-sm',
        tone === 'error' ? 'text-destructive' : 'text-success-foreground',
        className,
      )}
    >
      {message}
    </p>
  );
}
