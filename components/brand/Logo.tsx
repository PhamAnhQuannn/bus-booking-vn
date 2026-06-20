import { cn } from '@/lib/utils';

export function Logo({
  variant = 'combo',
  mono = false,
  className,
}: {
  variant?: 'glyph' | 'combo';
  mono?: boolean;
  className?: string;
}) {
  const fill = mono ? 'currentColor' : 'var(--primary)';

  const glyph = (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="size-6 shrink-0"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8 3h8a4 4 0 0 1 4 4v7a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4Zm.5 2h7a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
        fill={fill}
      />
      <circle cx="8" cy="21" r="2" fill={fill} />
      <circle cx="16" cy="21" r="2" fill={fill} />
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
