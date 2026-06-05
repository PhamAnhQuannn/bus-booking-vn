'use client';

/**
 * RoutesBrowser — client-side text filter + card grid over the active-routes list.
 * Each card deep-links into /search prefilled with origin/destination + today's date.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ActiveRoute } from '@/lib/core/db/getActiveRoutes';

function formatPrice(v: number): string {
  return v.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
}

function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h${m}` : `${h}h`;
}

/** Diacritic-insensitive contains check for the search box. */
function normalize(s: string): string {
  // Strip combining diacritical marks (U+0300–U+036F) after NFD decomposition.
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function RoutesBrowser({ routes, today }: { routes: ActiveRoute[]; today: string }) {
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const nq = normalize(q.trim());
    if (!nq) return routes;
    return routes.filter(
      (r) => normalize(`${r.origin} ${r.destination}`).includes(nq)
    );
  }, [q, routes]);

  function href(r: ActiveRoute): string {
    const p = new URLSearchParams({
      origin: r.origin,
      destination: r.destination,
      date: today,
      ticketCount: '1',
    });
    return `/search?${p.toString()}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="route-search" className="text-muted-foreground">
          Tìm tuyến
        </Label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="route-search"
            type="search"
            className="pl-8"
            placeholder="Ví dụ: Hà Nội, Đà Nẵng…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-border bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground">
          Không tìm thấy tuyến phù hợp.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {filtered.map((r) => (
            <li key={`${r.origin}-${r.destination}`}>
              <Link
                href={href(r)}
                className="group flex h-full flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-e1 outline-none transition-all hover:border-primary/30 hover:shadow-e2 focus-visible:ring-3 focus-visible:ring-ring/50 motion-safe:hover:-translate-y-0.5"
              >
                <div className="flex items-center gap-2 font-semibold">
                  <span>{r.origin}</span>
                  <ArrowRight className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>{r.destination}</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span>~{formatDuration(r.minDurationMinutes)}</span>
                  <span>
                    {r.operatorCount} nhà xe
                  </span>
                </div>
                <div className="mt-auto flex items-baseline gap-1 border-t border-border/60 pt-2 text-sm">
                  <span className="text-muted-foreground">Từ</span>
                  <span className="font-mono font-bold text-primary">{formatPrice(r.minPrice)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
