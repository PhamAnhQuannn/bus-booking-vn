import { describe, it, expect } from 'vitest';
import { buildOverview, withMeals } from '../timeline';
import type { PlannerDto, DtoItem } from '../itineraryDto';

const dest = (name: string, buoi: DtoItem['buoi'], order: number): DtoItem =>
  ({ role: 'diem-den', buoi, order, name, lat: 0, lon: 0, category: 'x', leg_from_prev: null } as unknown as DtoItem);

describe('buildOverview — tóm tắt 1 dòng/ngày', () => {
  const dto = {
    days: [
      { day: 1, region_id: 0, items: [dest('Hồ Xuân Hương – Đà Lạt', 'sang', 1), dest('Nhà thờ Con Gà', 'chieu', 2)] },
      { day: 2, region_id: 0, items: [dest('A', 'sang', 1), dest('B', 'sang', 2), dest('C', 'chieu', 3), dest('D', 'chieu', 4), dest('E', 'chieu', 5)] },
    ],
  } as unknown as PlannerDto;

  it('mỗi ngày 1 dòng, strip city suffix', () => {
    const ov = buildOverview(dto);
    expect(ov).toHaveLength(2);
    expect(ov[0].names).toEqual(['Hồ Xuân Hương', 'Nhà thờ Con Gà']);
    expect(ov[0].extra).toBe(0);
  });

  it('>4 điểm → 3 đầu + extra', () => {
    const ov = buildOverview(dto);
    expect(ov[1].names).toEqual(['A', 'B', 'C']);
    expect(ov[1].extra).toBe(2);
  });
});

describe('withMeals — chèn meal mức 1', () => {
  it('sáng+chiều → 1 Ăn trưa tại ranh giới + 1 Ăn tối cuối', () => {
    const rows = withMeals([dest('A', 'sang', 1), dest('B', 'sang', 2), dest('C', 'chieu', 3)]);
    const meals = rows.filter((r) => r.kind === 'meal');
    expect(meals.map((m) => (m as { meal: string }).meal)).toEqual(['trua', 'toi']);
    // Ăn trưa nằm ngay trước item chiều đầu tiên (index 2 trong output: A, B, trua, C, toi)
    expect(rows[2]).toEqual({ kind: 'meal', meal: 'trua' });
    expect(rows[rows.length - 1]).toEqual({ kind: 'meal', meal: 'toi' });
  });

  it('ngày 1 buổi (chỉ sáng) → chỉ Ăn tối', () => {
    const rows = withMeals([dest('A', 'sang', 1), dest('B', 'sang', 2)]);
    const meals = rows.filter((r) => r.kind === 'meal').map((m) => (m as { meal: string }).meal);
    expect(meals).toEqual(['toi']);
  });

  it('đã có block ăn thật → KHÔNG chèn', () => {
    const withReal = [dest('A', 'sang', 1), { role: 'an-trua', buoi: 'trua', order: 2, name: 'Ăn trưa quán X', lat: 0, lon: 0 } as unknown as DtoItem, dest('C', 'chieu', 3)];
    const rows = withMeals(withReal);
    expect(rows.filter((r) => r.kind === 'meal')).toHaveLength(0);
    expect(rows).toHaveLength(3);
  });

  it('tên chứa "ăn" (kể cả điểm-đến) → coi như đã có meal, không chèn', () => {
    const rows = withMeals([dest('Làng ăn vặt', 'sang', 1), dest('C', 'chieu', 2)]);
    expect(rows.filter((r) => r.kind === 'meal')).toHaveLength(0);
  });
});
