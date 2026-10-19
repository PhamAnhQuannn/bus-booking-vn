// packDays Wave-2 (#694 locality of block-merge, #703.1 flagship-aware flush swap, #703.2 budget-cut pins disclosed).
// Synthetic stores (CI-safe) model the live-KB failure shapes; a final block re-checks live units when the gitignored
// KB export is present locally (skipped in CI).
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, it, expect } from 'vitest';
import { buildItinerary } from '../plan';
import { haversine, type Store } from '../store';
import type { Itinerary, KbRecord, TripRequest } from '../types';

const TAM = { lat: 18.67, lon: 105.69 };
const dLat = (km: number) => km / 111;
const dLon = (km: number) => km / 105.2; // cos(18.67°)·111
// Thứ tự mảng destinations = importance (index 0 = #1 tỉnh). Slug không hand-list → auto-marquee top-4.
const P = (id: string, name: string, nKm: number, eKm: number, ward: string): KbRecord => ({
  id, name, region_id: 'r', source_ids: ['s1', 's2', 's3', 's4', 's5'],
  coordinates: { latitude: TAM.lat + dLat(nKm), longitude: TAM.lon + dLon(eKm) },
  address: { full_address: `số 1, ${ward}, tỉnh Nghệ An` }, description: { value: 'x' },
});
const mkStore = (destinations: KbRecord[]): Store => ({
  slug: 'zz-auto-nohandlist', generatedAt: '2026-01-01', tam: TAM,
  destinations, restaurants: [], hotels: [P('H', 'KS', 0, 0, 'Phường Lõi')],
  matrix: null, matrixIndex: new Map(),
});
const req = (days: number, pace: TripRequest['pace']): TripRequest =>
  ({ slug: 'zz-auto-nohandlist', days, party: { adults: 2, children: 0, elders: 0 }, pace });

const spanOf = (items: { lat?: number | null; lon?: number | null }[]): number => {
  const pts = items.filter((i) => i.lat != null && i.lon != null) as { lat: number; lon: number }[];
  let m = 0;
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++)
    m = Math.max(m, haversine(pts[i].lat, pts[i].lon, pts[j].lat, pts[j].lon) / 1000);
  return m;
};
const daySpans = (it: Itinerary): number[] => it.days.map((d) => spanOf(d.items.filter((i) => i.role === 'diem-den')));
const placed = (it: Itinerary): string[] => it.days.flatMap((d) => d.items.filter((i) => i.role === 'diem-den').map((i) => i.name));

// #694: crossFar (cặp >25km) một mình vẫn cho gộp hai khu cách tâm ~20km vào CÙNG ngày (zig-zag "sáng khu A, chiều
// khu B") trong khi ngày rest kế bên BỎ TRỐNG. Guard tâm-khoảng-cách (MERGE_GAP_KM) tách thành 2 ngày gọn.
describe('packDays — block merge từ chối khi tâm hai khu xa (#694)', () => {
  const store = mkStore([
    P('A1', 'Điểm lõi Một', 0, 0, 'Phường Lõi'),
    P('B1', 'Điểm khu Đông', 0, 20, 'Phường Đông'), // ~20km: cặp <25km (crossFar cho gộp) nhưng tâm xa
    P('A2', 'Điểm lõi Hai', 0.5, 0, 'Phường Lõi'),
  ]);
  it('2 ngày moderate: khu Đông ở ngày RIÊNG — mọi ngày span ≤ 15km, không ngày rest bỏ trống', () => {
    const it = buildItinerary(req(2, 'moderate'), store);
    expect(placed(it)).toEqual(expect.arrayContaining(['Điểm lõi Một', 'Điểm lõi Hai', 'Điểm khu Đông']));
    expect(it.days.length).toBe(2);
    for (const s of daySpans(it)) expect(s).toBeLessThanOrEqual(15);
    const together = it.days.some((d) => {
      const nm = d.items.map((i) => i.name);
      return nm.includes('Điểm lõi Một') && nm.includes('Điểm khu Đông');
    });
    expect(together).toBe(false);
  });
});

// #703.1 (vinh 2d moderate shape): #1 tỉnh (Bãi Lữ ~21km, KHÔNG isFar) ở ngày riêng; lõi trung tâm đầy ngày còn lại;
// cụm pin hạng 2 (Truông Bồn ~20km hướng khác, cách #1 ~29km) dồn-dư. Swap "home beats outlier" cũ đẩy #1 ra cho
// điểm hạng 2 (chỉ vì gần tâm hơn 1km). Nay #1 giữ chỗ; điểm hạng 2 bị bỏ + CÔNG BỐ.
describe('packDays flush swap — flagship #1 tỉnh không bị đẩy ra (#703.1)', () => {
  const store = mkStore([
    P('F', 'Khu du lịch biển Số Một', 21, 0, 'Xã Biển'),      // #1 (index 0)
    P('S1', 'Khu di tích Hạng Hai', 0, -20, 'Xã Tây'),        // #2 (pin), cách F ~29km
    P('C1', 'Di tích lõi Một', 0, 0, 'Phường Lõi'),
    P('C2', 'Di tích lõi Hai', 0.5, 0.5, 'Phường Lõi'),
    P('C3', 'Di tích lõi Ba', -0.5, 0.3, 'Phường Lõi'),
    P('S2', 'Làng nghề Tây', 0.3, -20, 'Xã Tây'),
  ]);
  it('vinh-shape 2d moderate: #1 có trong lịch; pin hạng 2 bị bỏ được nêu trong note', () => {
    const it = buildItinerary(req(2, 'moderate'), store);
    const names = placed(it);
    expect(names).toContain('Khu du lịch biển Số Một');
    expect(names).toEqual(expect.arrayContaining(['Di tích lõi Một', 'Di tích lõi Hai', 'Di tích lõi Ba'])); // lõi giữ
    expect(names).not.toContain('Khu di tích Hạng Hai');
    expect(it.notes.some((n) => n.includes('Khu di tích Hạng Hai'))).toBe(true); // không âm thầm
    for (const s of daySpans(it)) expect(s).toBeLessThanOrEqual(25);
  });
  // Đối chứng (intent test (b) #702 giữ nguyên): pin top-K PHỤ ở xa vẫn nhường lõi trung tâm.
  it('pin PHỤ xa (không phải #1) vẫn nhường lõi trung tâm', () => {
    const it = buildItinerary(req(2, 'moderate'), mkStore([
      P('X0', 'Điểm xa Một', 30, 0, 'Phường Xa'), P('X1', 'Điểm xa Hai', 30.1, 0, 'Phường Xa'),
      P('X2', 'Điểm xa Ba', 30, 0.1, 'Phường Xa'), P('X3', 'Điểm xa Bốn', 30.1, 0.1, 'Phường Xa'),
      P('K1', 'Điểm lõi Một', 0, 0, 'Phường Lõi'), P('K2', 'Điểm lõi Hai', 0.1, 0.1, 'Phường Lõi'),
    ]));
    const names = placed(it);
    expect(names).toContain('Điểm xa Một'); // #1 giữ
    expect(names).toEqual(expect.arrayContaining(['Điểm lõi Một', 'Điểm lõi Hai'])); // lõi sống
    expect(names.filter((n) => n.startsWith('Điểm xa')).length).toBe(3); // một pin PHỤ xa nhường chỗ cho lõi
  });
});

// #703.2: pin bị budget cắt (cả cụm sau khi hết budget — dong-hoi 3d relaxed Hang Sơn Đoòng; hoặc đuôi slice —
// son-la 2d relaxed) biến mất KHÔNG note. Nay vào `dropped` → allDropped công bố.
describe('packDays budget — pin bị cắt được công bố (#703.2)', () => {
  it('dong-hoi-shape: cụm pin sau khi hết budget → note nêu tên (trước: im lặng)', () => {
    const store = mkStore([
      P('A0', 'Động Một', 0, 8, 'Xã Động'),       // #1
      P('B1', 'Hang Hạng Hai', 10, 8, 'Xã Hang'), // #2, cụm riêng xử SAU (fame thấp hơn) → hết budget
      P('A2', 'Động Ba', 0.2, 8, 'Xã Động'),
      P('A3', 'Động Bốn', 0, 8.2, 'Xã Động'),
      P('A4', 'Điểm Động Năm', 0.2, 8.2, 'Xã Động'),
    ]);
    const it = buildItinerary(req(2, 'relaxed'), store); // budget = 2×2 = 4, cụm A đủ 4 điểm
    expect(placed(it)).not.toContain('Hang Hạng Hai');
    expect(it.notes.some((n) => n.includes('Hang Hạng Hai'))).toBe(true);
  });
  it('son-la-shape: pin ở đuôi slice của cụm → note nêu tên (trước: im lặng)', () => {
    const store = mkStore([
      P('A0', 'Đài Một', 0, 0, 'Phường Lõi'),       // #1
      P('B1', 'Đền Hạng Hai', 3, 0, 'Phường Bắc'),  // #2 (pin)
      P('B2', 'Đền Hạng Ba', 3.1, 0, 'Phường Bắc'), // #3 (pin)
      P('B3', 'Đền Hạng Tư', 3, 0.1, 'Phường Bắc'), // #4 (pin)
      P('A4', 'Điểm lõi phụ', 0.1, 0, 'Phường Lõi'),
    ]);
    const it = buildItinerary(req(2, 'relaxed'), store); // budget 4: A(2) + B(3) → slice 1 pin của B
    const names = placed(it);
    const missing = ['Đền Hạng Hai', 'Đền Hạng Ba', 'Đền Hạng Tư'].filter((n) => !names.includes(n));
    expect(missing.length).toBeGreaterThan(0);
    for (const n of missing) expect(it.notes.some((x) => x.includes(n))).toBe(true);
  });
});

// Live KB (gitignored tourism-kb/export, local only — CI skips): coherence on representative units from #694.
const KB = path.resolve(process.cwd(), 'tourism-kb', 'export');
const hasKb = (slug: string) => fs.existsSync(path.join(KB, slug, 'diem-den.json'));
describe.skipIf(!hasKb('bac-ninh') || !hasKb('vung-tau'))('packDays coherence — live KB (#694)', () => {
  const live = (slug: string, days: number, pace: TripRequest['pace']) =>
    buildItinerary({ slug, days, party: { adults: 2, children: 0, elders: 0 }, pace });
  it.each([[5, 'moderate'], [7, 'moderate']] as const)('bac-ninh %id %s: mọi ngày span ≤ 15km', (days, pace) => {
    for (const s of daySpans(live('bac-ninh', days, pace))) expect(s).toBeLessThanOrEqual(15);
  });
  it.each([['relaxed'], ['moderate'], ['packed']] as const)('vung-tau 3d %s: ngày >25km (nếu có) được công bố chặng dài', (pace) => {
    const it = live('vung-tau', 3, pace);
    const wide = daySpans(it).filter((s) => s > 25).length;
    expect(it.notes.filter((n) => n.includes('chặng di chuyển dài')).length).toBeGreaterThanOrEqual(wide);
    expect(daySpans(it).filter((s) => s > 15).length).toBeLessThanOrEqual(1); // chỉ ngày far-marquee hồ tràm
  });
});
