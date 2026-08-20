import { getTranslations } from 'next-intl/server';

import { Link } from '@/i18n/navigation';
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
  /**
   * Second line. `routesSummary` is the operator's own free-text route list from
   * their application ("Hà Nội – Sài Gòn"); `provinceName` is the fallback. Both
   * come from getPublicOperators() and are real. docs/design/mockup-home-spec.md:222
   * specifies this slot as REDUCE→routesSummary — the invented "N+ tuyến" that used
   * to sit here was meant to be replaced by this, not simply dropped.
   */
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
    subline: op.routesSummary ?? op.provinceName,
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
        {card.subline && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{card.subline}</p>
        )}
      </div>
    </>
  );

  const cls =
    'flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-e1 transition-all hover:shadow-e2 motion-safe:hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none';

  if (card.href) {
    return (
      <Link href={card.href} className={cls}>
        {content}
      </Link>
    );
  }
  return <div className={cls.replace(' hover:shadow-e2 motion-safe:hover:-translate-y-0.5', '')}>{content}</div>;
}

export async function OperatorShowcase({ operators }: { operators: PublicOperator[] }) {
  const cards = operators.map(toCard);

  if (cards.length === 0) return null;

  const t = await getTranslations('home');

  /**
   * Bound the CARD, not the track count.
   *
   * The first attempt capped columns with a lookup keyed on card count and got the
   * n=1 case — the live case — wrong: `sm:grid-cols-2` caps at two, so a single
   * operator rendered as a ~616px card holding ~210px of ink beside a ~616px hole,
   * under a comment claiming the track was capped at the card count.
   *
   * `auto-fill` with a max track width is the honest version: tracks size
   * themselves, one card occupies one card's worth of space, and there is no
   * per-count table that can drift out of agreement with its own description as
   * the operator list grows.
   */
  return (
    <section className="page-container py-3 lg:py-4">
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {/* Plural "uy tín" over a single card overclaims a roster of one. */}
          {cards.length === 1 ? t('operators.titleSingle') : t('operators.titlePlural')}
        </h2>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-4">
        {cards.map((card) => (
          <OperatorCard key={card.key} card={card} />
        ))}
      </div>
    </section>
  );
}
