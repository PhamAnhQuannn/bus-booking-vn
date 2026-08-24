/**
 * timeline — pure helpers dựng lịch trình ở render-time (KHÔNG sửa KB, client-safe).
 *  - buildOverview: tóm tắt 1 dòng/ngày (chỉ điểm-đến, >4 → 3 đầu + "+k").
 *  - withMeals: chèn meal mức 1 ("Ăn trưa" ranh giới sáng→chiều, "Ăn tối" cuối ngày);
 *    ngày đã có block ăn thật (role an-* / tên chứa "ăn") → KHÔNG chèn (chống trùng).
 */
import type { PlannerDto, DtoItem } from './itineraryDto';
import { areaLabel, stripCitySuffix } from './labels';

export type OverviewDay = { day: number; area: string | null; names: string[]; extra: number };

export function buildOverview(dto: PlannerDto): OverviewDay[] {
  return dto.days.map((d) => {
    const names = d.items.filter((i) => i.role === 'diem-den').map((i) => stripCitySuffix(i.name));
    const many = names.length > 4;
    return { day: d.day, area: areaLabel(d.region_id), names: many ? names.slice(0, 3) : names, extra: many ? names.length - 3 : 0 };
  });
}

export type DayRow = { kind: 'item'; it: DtoItem } | { kind: 'meal'; meal: 'trua' | 'toi' };

export function withMeals(items: DtoItem[]): DayRow[] {
  const hasRealMeal = items.some((i) => i.role === 'an-trua' || i.role === 'an-toi' || /ăn/i.test(i.name));
  if (hasRealMeal || items.length === 0) return items.map((it) => ({ kind: 'item', it }));
  const out: DayRow[] = [];
  let lunched = false;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!lunched && it.buoi === 'chieu' && i > 0 && items[i - 1].buoi === 'sang') {
      out.push({ kind: 'meal', meal: 'trua' });
      lunched = true;
    }
    out.push({ kind: 'item', it });
  }
  out.push({ kind: 'meal', meal: 'toi' }); // Ăn tối cuối ngày (ngày 1 buổi → chỉ có dòng này)
  return out;
}
