import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Tinted info card for the auth pages — icon · bold title · muted sub · right-aligned
 * outline pill link. Two symmetric instances live on the login page (customer register
 * door + operator door). Tone tint follows the same primary/5 recipe as
 * components/op/ApprovalBanner. Presentational only — no client hooks.
 */
export function AuthPromoCard({
  icon: Icon,
  title,
  body,
  actionLabel,
  actionHref,
  className,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  actionLabel: string;
  actionHref: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4',
        className
      )}
    >
      <span
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-strong"
      >
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{body}</p>
      </div>
      <Link
        href={actionHref}
        className="inline-flex h-11 shrink-0 items-center rounded-lg border border-primary/40 bg-card px-4 text-sm font-medium text-primary-strong outline-none transition-colors hover:bg-primary/5 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {actionLabel}
      </Link>
    </div>
  );
}
