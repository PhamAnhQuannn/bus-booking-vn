import { cn } from '@/lib/utils';

/**
 * BBVN brand mark — "route mark" (Concept A, docs/design/logo-brief.md):
 * an origin dot with an orange path → arrowhead, echoing the `Origin → Destination`
 * pattern used across the app.
 *
 * - `variant="glyph"` → just the route mark (favicon / app icon / tight spaces).
 * - `variant="combo"` → glyph + "BBVN" wordmark (header default).
 * - `mono` → render entirely in `currentColor` (PDF / print / single-color contexts);
 *   otherwise the path is brand-orange and the wordmark is foreground ink.
 */
export function Logo({
  variant = 'combo',
  mono = false,
  className,
}: {
  variant?: 'glyph' | 'combo';
  mono?: boolean;
  className?: string;
}) {
  const stroke = mono ? 'currentColor' : 'var(--primary)';

  const glyph = (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="size-6 shrink-0"
    >
      {/* origin dot */}
      <circle cx="4" cy="12" r="2.5" fill={stroke} />
      {/* route path */}
      <path d="M7 12 H14.5" stroke={stroke} strokeWidth="2.25" strokeLinecap="round" />
      {/* arrowhead → destination */}
      <path
        d="M14 8 L19 12 L14 16"
        stroke={stroke}
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );

  if (variant === 'glyph') {
    return (
      <span className={cn('inline-flex', className)} aria-label="BBVN">
        {glyph}
      </span>
    );
  }

  return (
    <span className={cn('inline-flex items-center gap-2', className)} aria-label="BBVN">
      {glyph}
      <span
        className={cn(
          'font-display text-lg font-bold tracking-tight',
          mono ? '' : 'text-foreground'
        )}
      >
        BBVN
      </span>
    </span>
  );
}
