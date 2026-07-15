import Link from 'next/link';
import { MapPin, ArrowRight } from 'lucide-react';

import type { PublicOperator } from '@/lib/home';
import { searchHref } from '@/lib/search';

function initials(op: PublicOperator): string {
  const name = op.brandName ?? op.legalName;
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function OperatorCard({ op }: { op: PublicOperator }) {
  const display = op.brandName ?? op.legalName;
  const content = (
    <>
      <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-base font-bold text-primary">
        {initials(op)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold leading-tight">{display}</p>
        {op.brandName && op.legalName !== op.brandName && (
          <p className="truncate text-xs text-muted-foreground">{op.legalName}</p>
        )}
        {op.provinceName && (
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="size-3.5" aria-hidden="true" />
            {op.provinceName}
          </div>
        )}
        {op.routesSummary && (
          <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-foreground/80">
            {op.routesSummary}
          </p>
        )}
      </div>
      {op.topRoute && (
        <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      )}
    </>
  );

  if (op.topRoute) {
    return (
      <Link
        href={searchHref(op.topRoute.origin, op.topRoute.destination, { operatorId: op.id })}
        className="flex items-start gap-4 rounded-xl border border-border bg-card p-5 shadow-e1 transition-all hover:shadow-e2 hover:border-primary/30 motion-safe:hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="flex items-start gap-4 rounded-xl border border-border bg-card p-5 shadow-e1">
      {content}
    </div>
  );
}

function OperatorSpotlight({ op }: { op: PublicOperator }) {
  const display = op.brandName ?? op.legalName;
  const inner = (
    <div className="flex items-center gap-5 rounded-xl border border-border bg-card p-6 shadow-e1 transition-all hover:border-primary/30 hover:shadow-e2 motion-safe:hover:-translate-y-0.5">
      <span className="inline-flex size-16 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xl font-bold text-primary sm:size-20 sm:text-2xl">
        {initials(op)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xl font-bold leading-tight sm:text-2xl">{display}</p>
        {op.brandName && op.legalName !== op.brandName && (
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{op.legalName}</p>
        )}
        {op.provinceName && (
          <div className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="size-4" aria-hidden="true" />
            {op.provinceName}
          </div>
        )}
        {op.routesSummary && (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-foreground/80">
            {op.routesSummary}
          </p>
        )}
      </div>
      {op.topRoute && (
        <ArrowRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      )}
    </div>
  );

  if (op.topRoute) {
    return (
      <Link href={searchHref(op.topRoute.origin, op.topRoute.destination, { operatorId: op.id })}>
        {inner}
      </Link>
    );
  }
  return inner;
}

export function OperatorShowcase({ operators }: { operators: PublicOperator[] }) {
  if (operators.length === 0) return null;

  if (operators.length <= 2) {
    return (
      <section className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-10 md:py-12">
        <div className="flex flex-col gap-4">
          {operators.map((op) => (
            <OperatorSpotlight key={op.id} op={op} />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-10 md:py-12">
      <div className="mb-6 text-center sm:mb-8">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Nhà xe đối tác</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Các nhà xe uy tín đã tham gia nền tảng BBVN
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {operators.map((op) => (
          <OperatorCard key={op.id} op={op} />
        ))}
      </div>
    </section>
  );
}
