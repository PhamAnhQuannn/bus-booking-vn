'use client';

/**
 * Search filter system (PTN-03) — URL-driven, OTA-style results layout.
 *
 * Exports:
 *  - <SearchFilterRail>   persistent sticky left rail (desktop ≥md)
 *  - <SearchFilterSheet>  "Bộ lọc (N)" button → Dialog bottom-sheet (mobile <md)
 *  - <SearchToolbar>      sort select + result count + removable active-filter chips
 *
 * All state lives in the URL searchParams; facets come from the unfiltered base
 * set so every option stays visible after a filter narrows the list.
 */

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import type { TripFacets } from '@/lib/search/applyTripFilters';
import { SORT_OPTIONS, type BusType, type TimeWindow } from '@/lib/core/validation/search';

const SORT_LABEL: Record<(typeof SORT_OPTIONS)[number], string> = {
  departure_asc: 'Giờ đi sớm nhất',
  price_asc: 'Giá thấp → cao',
  price_desc: 'Giá cao → thấp',
  duration_asc: 'Đi nhanh nhất',
};
const BUS_TYPE_LABEL: Record<BusType, string> = {
  coach: 'Ghế ngồi',
  sleeper: 'Giường nằm',
  limousine: 'Limousine',
};
const WINDOW_LABEL: Record<TimeWindow, string> = {
  morning: 'Sáng (5–11h)',
  afternoon: 'Chiều (11–17h)',
  evening: 'Tối (17–22h)',
  night: 'Đêm (22–5h)',
};
const DURATION_PRESETS = [240, 360, 480, 600];
const FILTER_KEYS = ['operatorId', 'busType', 'priceMin', 'priceMax', 'window', 'maxDurationMinutes', 'sort'];

function vnd(n: number) {
  return n.toLocaleString('vi-VN') + 'đ';
}

/** Shared URL-filter state + actions. Each consumer reads the same searchParams. */
function useFilterState() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const sort = params.get('sort') ?? 'departure_asc';
  const operatorId = params.get('operatorId') ?? '';
  const busTypes = (params.get('busType')?.split(',').filter(Boolean) ?? []) as BusType[];
  const window = (params.get('window') ?? '') as TimeWindow | '';
  const maxDuration = params.get('maxDurationMinutes') ?? '';
  const priceMin = params.get('priceMin') ?? '';
  const priceMax = params.get('priceMax') ?? '';

  function commit(updates: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === '') next.delete(k);
      else next.set(k, v);
    }
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }
  function toggleBusType(t: BusType) {
    const set = new Set(busTypes);
    if (set.has(t)) set.delete(t);
    else set.add(t);
    commit({ busType: [...set].join(',') || null });
  }
  function reset() {
    const next = new URLSearchParams(params.toString());
    for (const k of FILTER_KEYS) next.delete(k);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }
  const activeCount =
    (operatorId ? 1 : 0) + busTypes.length + (window ? 1 : 0) + (maxDuration ? 1 : 0) + (priceMin ? 1 : 0) + (priceMax ? 1 : 0);

  return { sort, operatorId, busTypes, window, maxDuration, priceMin, priceMax, commit, toggleBusType, reset, activeCount };
}

type FilterState = ReturnType<typeof useFilterState>;

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button type="button" variant={active ? 'default' : 'outline'} size="sm" aria-pressed={active} onClick={onClick}>
      {children}
    </Button>
  );
}

/** The filter inputs — rendered inside both the desktop rail and the mobile sheet. */
function FilterControls({ facets, s }: { facets: TripFacets; s: FilterState }) {
  const [priceMin, setPriceMin] = useState(s.priceMin);
  const [priceMax, setPriceMax] = useState(s.priceMax);
  const durationPresets = facets.durationRange ? DURATION_PRESETS.filter((d) => d <= facets.durationRange!.max + 60) : [];

  return (
    <div className="flex flex-col gap-5">
      {facets.operators.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="operator-select" className="text-muted-foreground">Nhà xe</Label>
          <Select value={s.operatorId} onValueChange={(v: string | null) => s.commit({ operatorId: v || null })}>
            <SelectTrigger id="operator-select" className="w-full">
              <SelectValue placeholder="Tất cả nhà xe">
                {(v: string) => (v ? (facets.operators.find((o) => o.id === v)?.legalName ?? 'Nhà xe') : 'Tất cả nhà xe')}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Tất cả nhà xe</SelectItem>
              {facets.operators.map((op) => (
                <SelectItem key={op.id} value={op.id}>{op.legalName} ({op.count})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {facets.busTypes.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-muted-foreground">Loại xe</span>
          <div className="flex flex-wrap gap-2">
            {facets.busTypes.map((bt) => (
              <Chip key={bt.value} active={s.busTypes.includes(bt.value)} onClick={() => s.toggleBusType(bt.value)}>
                {BUS_TYPE_LABEL[bt.value]} ({bt.count})
              </Chip>
            ))}
          </div>
        </div>
      )}

      {facets.windows.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-muted-foreground">Giờ khởi hành</span>
          <div className="flex flex-wrap gap-2">
            {facets.windows.map((w) => (
              <Chip key={w.value} active={s.window === w.value} onClick={() => s.commit({ window: s.window === w.value ? null : w.value })}>
                {WINDOW_LABEL[w.value]} ({w.count})
              </Chip>
            ))}
          </div>
        </div>
      )}

      {durationPresets.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-muted-foreground">Thời gian đi tối đa</span>
          <div className="flex flex-wrap gap-2">
            {durationPresets.map((d) => (
              <Chip key={d} active={s.maxDuration === String(d)} onClick={() => s.commit({ maxDurationMinutes: s.maxDuration === String(d) ? null : String(d) })}>
                ≤ {d / 60}h
              </Chip>
            ))}
          </div>
        </div>
      )}

      {facets.priceRange && (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-muted-foreground">Giá vé (đ)</span>
          <div className="flex items-center gap-2">
            <Input type="number" inputMode="numeric" min={0} className="w-full" placeholder={String(facets.priceRange.min)}
              aria-label="Giá tối thiểu" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} onBlur={() => s.commit({ priceMin: priceMin || null })} />
            <span className="text-muted-foreground">—</span>
            <Input type="number" inputMode="numeric" min={0} className="w-full" placeholder={String(facets.priceRange.max)}
              aria-label="Giá tối đa" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} onBlur={() => s.commit({ priceMax: priceMax || null })} />
          </div>
        </div>
      )}

      {s.activeCount > 0 && (
        <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => { setPriceMin(''); setPriceMax(''); s.reset(); }}>
          <X className="size-4" /> Xóa bộ lọc
        </Button>
      )}
    </div>
  );
}

/** Desktop sticky left rail. */
export function SearchFilterRail({ facets }: { facets: TripFacets }) {
  const s = useFilterState();
  return (
    <aside className="hidden md:block" aria-label="Bộ lọc chuyến xe">
      <div className="sticky top-20 rounded-xl border border-border bg-card p-4 shadow-e1">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <SlidersHorizontal className="size-4 text-primary" aria-hidden="true" /> Bộ lọc
        </h2>
        <FilterControls facets={facets} s={s} />
      </div>
    </aside>
  );
}

/** Mobile filter button → Dialog sheet. */
export function SearchFilterSheet({ facets }: { facets: TripFacets }) {
  const s = useFilterState();
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={(p) => (
            <Button {...p} type="button" variant="outline" size="sm">
              <SlidersHorizontal className="size-4" /> Bộ lọc{s.activeCount > 0 ? ` (${s.activeCount})` : ''}
            </Button>
          )}
        />
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogTitle>Bộ lọc chuyến xe</DialogTitle>
          <FilterControls facets={facets} s={s} />
          <Button type="button" className="w-full" onClick={() => setOpen(false)}>Xem kết quả</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Sort select + removable active-filter chips (results column header). */
export function SearchToolbar({ facets }: { facets: TripFacets }) {
  const s = useFilterState();

  const chips: { key: string; label: string; remove: () => void }[] = [];
  if (s.operatorId) chips.push({ key: 'op', label: facets.operators.find((o) => o.id === s.operatorId)?.legalName ?? 'Nhà xe', remove: () => s.commit({ operatorId: null }) });
  for (const bt of s.busTypes) chips.push({ key: `bt-${bt}`, label: BUS_TYPE_LABEL[bt], remove: () => s.toggleBusType(bt) });
  if (s.window) chips.push({ key: 'win', label: WINDOW_LABEL[s.window].replace(/\s*\(.*\)/, ''), remove: () => s.commit({ window: null }) });
  if (s.maxDuration) chips.push({ key: 'dur', label: `≤ ${Number(s.maxDuration) / 60}h`, remove: () => s.commit({ maxDurationMinutes: null }) });
  if (s.priceMin) chips.push({ key: 'pmin', label: `≥ ${vnd(Number(s.priceMin))}`, remove: () => s.commit({ priceMin: null }) });
  if (s.priceMax) chips.push({ key: 'pmax', label: `≤ ${vnd(Number(s.priceMax))}`, remove: () => s.commit({ priceMax: null }) });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="sort-select" className="text-muted-foreground">Sắp xếp</Label>
          <Select value={s.sort} onValueChange={(v: string | null) => s.commit({ sort: v && v !== 'departure_asc' ? v : null })}>
            <SelectTrigger id="sort-select" className="w-44">
              <SelectValue>{(v: string) => SORT_LABEL[v as keyof typeof SORT_LABEL] ?? SORT_LABEL.departure_asc}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (<SelectItem key={o} value={o}>{SORT_LABEL[o]}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <SearchFilterSheet facets={facets} />
      </div>

      {chips.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Bộ lọc đang áp dụng">
          {chips.map((c) => (
            <li key={c.key}>
              <button
                type="button"
                onClick={c.remove}
                className="inline-flex min-h-8 items-center gap-1 rounded-full border border-border bg-muted/60 px-3 text-xs font-medium transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                aria-label={`Bỏ lọc: ${c.label}`}
              >
                {c.label}
                <X className="size-3" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
