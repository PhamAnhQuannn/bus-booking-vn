import Link from 'next/link';

import type { PublicOperator } from '@/lib/home';
import { searchHref } from '@/lib/search';

/**
 * OperatorShowcase — "Nhà xe đối tác uy tín" row.
 *
 * Shows exactly the operators that exist. Nothing is padded and nothing is invented.
 *
 * 2026-07-30: this used to pad the row to the mockup's five cards with fabricated
 * partner brands, and to render a star rating and a "N+ tuyến" total on every card.
 * All three were placeholders. The ratings in particular were a hash of the operator's
 * DB id, so a genuine partner was shown a fabricated score under a heading that calls
 * them "uy tín" (reputable). There is no Review model in the schema to replace them
 * with, so the elements are gone rather than emptied.
 */

interface ShowcaseCard {
  key: string;
  display: string;
  initials: string;
  href: string | null;
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

/**
 * Column cap. The grid used to be a fixed 5 columns because padding guaranteed five
 * cards; without padding a lone real operator would render as one narrow card stranded
 * in a five-column track. Cap the track count at the number of cards we actually have.
 */
const COLUMN_CLASS: Record<number, string> = {
  1: 'grid-cols-1 sm:grid-cols-2',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
};

export function OperatorShowcase({ operators }: { operators: PublicOperator[] }) {
  const cards = operators.map(toCard);

  if (cards.length === 0) return null;

  const columns =
    COLUMN_CLASS[cards.length] ?? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5';

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-8 lg:py-10">
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Nhà xe đối tác uy tín</h2>
      </div>

      <div className={`grid gap-4 ${columns}`}>
        {cards.map((card) => (
          <OperatorCard key={card.key} card={card} />
        ))}
      </div>
    </section>
  );
}
