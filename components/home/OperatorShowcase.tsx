import Link from 'next/link';
import { Star } from 'lucide-react';

import type { PublicOperator } from '@/lib/home';
import { searchHref } from '@/lib/search';
import {
  PLACEHOLDER_OPERATORS,
  placeholderRating,
  placeholderRouteCount,
} from './homePlaceholders';

/**
 * OperatorShowcase — "Nhà xe đối tác uy tín" row. Rebuilt 2026-07-21 to the mockup's
 * compact horizontal card (docs/design/mockup-home.png S5): initials chip left, then
 * name / rating / route-count stacked to its right.
 *
 * The mockup shows five partner cards. At launch we have 1-2 real operators, so the row
 * is padded with PLACEHOLDER_OPERATORS to keep the designed layout. Both the padding and
 * the per-card rating/route-count are invented — see homePlaceholders.ts.
 */

interface ShowcaseCard {
  key: string;
  display: string;
  initials: string;
  href: string | null;
  /** Real operators keep their DB summary line; padded ones fall back to a province. */
  subline: string | null;
}

function toInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter((w) => w.toLowerCase() !== 'nhà' && w.toLowerCase() !== 'xe');
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.replace(/^Nhà xe\s*/i, '').slice(0, 2).toUpperCase();
}

function toCard(op: PublicOperator): ShowcaseCard {
  const display = op.brandName ?? op.legalName;
  return {
    key: op.id,
    display,
    initials: toInitials(display),
    href: op.topRoute
      ? searchHref(op.topRoute.origin, op.topRoute.destination, { operatorId: op.id })
      : null,
    subline: op.provinceName,
  };
}

function OperatorCard({ card }: { card: ShowcaseCard }) {
  const content = (
    <>
      <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary-strong">
        {card.initials}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold leading-tight">{card.display}</p>
        {/* PLACEHOLDER rating + route count — no Review model, no per-operator
            route total surfaced. See homePlaceholders.ts. */}
        <span className="mt-1 flex items-center gap-1 text-sm">
          <Star className="size-3.5 shrink-0 fill-primary text-primary" aria-hidden="true" />
          <span className="font-medium">{placeholderRating(card.key)}</span>
        </span>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {placeholderRouteCount(card.key)}+ tuyến
        </p>
      </div>
    </>
  );

  const cls =
    'flex items-center gap-3 rounded-xl bg-card p-4 shadow-e1 transition-all hover:shadow-e2 motion-safe:hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none';

  if (card.href) {
    return (
      <Link href={card.href} className={cls}>
        {content}
      </Link>
    );
  }
  return <div className={cls.replace(' hover:shadow-e2 motion-safe:hover:-translate-y-0.5', '')}>{content}</div>;
}

export function OperatorShowcase({ operators }: { operators: PublicOperator[] }) {
  const real = operators.map(toCard);
  // Pad to the mockup's 5 columns. Padding entries are clearly fictional brands —
  // never real competitor names (see homePlaceholders.ts).
  const padded: ShowcaseCard[] = PLACEHOLDER_OPERATORS.slice(0, Math.max(0, 5 - real.length)).map(
    (p) => ({
      key: p.id,
      display: p.name,
      initials: toInitials(p.name),
      href: null,
      subline: p.province,
    }),
  );
  const cards = [...real, ...padded].slice(0, 5);

  if (cards.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-8 lg:py-10">
      <div className="mb-6 flex items-end justify-between gap-4">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Nhà xe đối tác uy tín</h2>
        <Link
          href="/"
          className="text-sm font-medium text-primary-strong outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Xem tất cả
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {cards.map((card) => (
          <OperatorCard key={card.key} card={card} />
        ))}
      </div>
    </section>
  );
}
