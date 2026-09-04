// Regression tests for the trip-planner correctness fixes (#528 / #529).
import { describe, it, expect } from 'vitest';
import { nights } from '../labels';
import { requestFromParams, toURLSearchParams } from '../fromParams';
import { buildItinerary } from '../plan';
import type { Store } from '../store';
import type { KbRecord, TripRequest } from '../types';

describe('nights() — clamp >= 0 (#529)', () => {
  it('0 days → 0 nights (was "-1 đêm")', () => expect(nights(0)).toBe(0));
  it('3 days → 2 nights', () => expect(nights(3)).toBe(2));
  it('1 day → 0 nights', () => expect(nights(1)).toBe(0));
});

describe('toURLSearchParams — repeated array params preserved (#528)', () => {
  it('joins string[] as CSV instead of dropping all but v[0]', () => {
    const sp = toURLSearchParams({ interests: ['a', 'b'], slug: 'da-lat' });
    expect(sp.get('interests')).toBe('a,b');
    expect(sp.get('slug')).toBe('da-lat');
  });
});

describe('requestFromParams — adults floor (#528)', () => {
  it('?adults=0 → default 2 (no zero-person trip)', () => {
    expect(requestFromParams(new URLSearchParams('adults=0')).party.adults).toBe(2);
  });
  it('?adults=3 → 3 (valid value kept)', () => {
    expect(requestFromParams(new URLSearchParams('adults=3')).party.adults).toBe(3);
  });
  it('children/elders still accept 0', () => {
    const r = requestFromParams(new URLSearchParams('children=0&elders=0'));
    expect(r.party.children).toBe(0);
    expect(r.party.elders).toBe(0);
  });
});

describe('buildItinerary — NaN OSRM matrix does not throw (#529)', () => {
  function rec(id: string, lat: number, lon: number): KbRecord {
    return { id, name: `Nơi ${id}`, region_id: 'r1', source_ids: ['s'], coordinates: { latitude: lat, longitude: lon } };
  }
  // Ragged matrix (island city) — off-diagonal durations are NaN.
  const store: Store = {
    slug: 'phu-quoc',
    generatedAt: '2026-01-01',
    tam: { lat: 10.22, lon: 103.96 },
    destinations: [rec('d1', 10.22, 103.96), rec('d2', 10.29, 103.99)],
    restaurants: [],
    hotels: [rec('h1', 10.22, 103.96)],
    matrix: { ids: ['d1', 'd2'], durations: [[0, NaN], [NaN, 0]], distances: [[0, 0], [0, 0]] },
    matrixIndex: new Map([['d1', 0], ['d2', 1]]),
  };
  const req: TripRequest = { slug: 'phu-quoc', days: 1, party: { adults: 2, children: 0, elders: 0 }, pace: 'moderate' };

  it('returns an itinerary with finite leg costs (haversine fallback)', () => {
    const it = buildItinerary(req, store);
    const items = it.days.flatMap((d) => d.items);
    expect(items.length).toBeGreaterThan(0);
    for (const i of items) {
      if (i.leg_from_prev) expect(Number.isFinite(i.leg_from_prev.minutes)).toBe(true);
    }
  });
});

// Cụm theo KHU HÀNH CHÍNH (ward từ full_address), KHÔNG theo region_id (hướng la bàn). Tỉnh sáp nhập
// mega (Lào Cai): Sa Pa ↔ TP Lào Cai ~19km cùng octant "tay-bac" → trước đây chung 1 ngày. Giờ tách.
describe('buildItinerary — cụm theo khu hành chính, không trộn thị xã xa', () => {
  const mk = (id: string, lat: number, lon: number, ward: string): KbRecord => ({
    id, name: `Nơi ${id}`, region_id: 'tay-bac', source_ids: ['s1', 's2', 's3', 's4', 's5'],
    coordinates: { latitude: lat, longitude: lon },
    address: { full_address: `đường X, ${ward}, tỉnh Lào Cai` },
    description: { value: 'mô tả' },
  });
  // 4 điểm Sa Pa (cụm mass cao) + 2 điểm TP Lào Cai ~19km — cùng region_id "tay-bac".
  const store: Store = {
    slug: 'lao-cai', generatedAt: '2026-01-01', tam: { lat: 22.42, lon: 103.92 },
    destinations: [
      mk('SP1', 22.36, 103.86, 'Phường Sa Pa'), mk('SP2', 22.35, 103.85, 'Phường Sa Pa'),
      mk('SP3', 22.34, 103.84, 'Phường Sa Pa'), mk('TV1', 22.33, 103.87, 'Xã Tả Van'),
      mk('LC1', 22.49, 103.97, 'Phường Lào Cai'), mk('LC2', 22.50, 103.98, 'Phường Lào Cai'),
    ],
    restaurants: [], hotels: [mk('H1', 22.35, 103.85, 'Phường Sa Pa')],
    matrix: null, matrixIndex: new Map(),
  };
  const req: TripRequest = { slug: 'lao-cai', days: 3, party: { adults: 2, children: 0, elders: 0 }, pace: 'moderate' };

  it('không xếp điểm Sa Pa và điểm TP Lào Cai (cách ~19km) chung một ngày', () => {
    const it = buildItinerary(req, store);
    for (const d of it.days) {
      const wards = new Set(d.items.map((i) => (i.address ?? '').includes('Phường Lào Cai') ? 'LC' : 'SP'));
      expect(wards.has('LC') && wards.has('SP')).toBe(false); // không trộn 2 thị xã trong 1 ngày
    }
  });

  it('cụm TP Lào Cai xa bị loại khỏi lịch (compactness thắng), có note', () => {
    const it = buildItinerary(req, store);
    const ids = it.days.flatMap((d) => d.items.map((i) => i.id));
    expect(ids).not.toContain('LC1');
    expect(ids).not.toContain('LC2');
    expect(it.notes.some((n) => n.includes('ngoài vùng thuận tiện'))).toBe(true);
  });
});

// FAME-aware seed: tỉnh sáp nhập mega (tuyen-quang bao Hà Giang) — cụm tỉnh-lỵ nhiều POI (mass cao) KHÔNG
// được seed nếu cụm khác chứa điểm nổi tiếng (signatureSpots trong areas.json). Seed = cụm có FAME.
describe('buildItinerary — seed theo độ nổi tiếng, không theo data-mass', () => {
  const rich = (id: string, lat: number, lon: number, ward: string): KbRecord => ({
    id, name: `Trụ sở ${id}`, region_id: 'r', source_ids: ['s1', 's2', 's3', 's4', 's5', 's6'],
    coordinates: { latitude: lat, longitude: lon },
    address: { full_address: `đường X, ${ward}, tỉnh Tuyên Quang` },
    description: { value: 'có mô tả' }, // mass cao (desc + >=5 nguồn)
  });
  const famous = (id: string, lat: number, lon: number, name: string): KbRecord => ({
    id, name, region_id: 'r', source_ids: ['s1'],
    coordinates: { latitude: lat, longitude: lon },
    address: { full_address: `đường Y, Xã Đồng Văn, tỉnh Tuyên Quang` }, // ít nguồn -> mass THẤP
  });
  // Cụm tỉnh-lỵ (Phường Minh Xuân) 4 điểm mass cao + KHÔNG nổi tiếng; cụm Đồng Văn 2 điểm mass thấp nhưng
  // chứa Đèo Mã Pí Lèng / Phố cổ Đồng Văn (signatureSpots). ~150km cách nhau (Hà Giang loop vs TP TQ).
  const store: Store = {
    slug: 'tuyen-quang', generatedAt: '2026-01-01', tam: { lat: 22.3, lon: 105.1 },
    destinations: [
      rich('TQ1', 21.82, 105.21, 'Phường Minh Xuân'), rich('TQ2', 21.83, 105.22, 'Phường Minh Xuân'),
      rich('TQ3', 21.81, 105.20, 'Phường Minh Xuân'), rich('TQ4', 21.82, 105.23, 'Phường Minh Xuân'),
      famous('HG1', 23.27, 105.36, 'Đèo Mã Pí Lèng'), famous('HG2', 23.28, 105.34, 'Phố cổ Đồng Văn'),
    ],
    restaurants: [], hotels: [rich('H', 23.27, 105.36, 'Xã Đồng Văn')],
    matrix: null, matrixIndex: new Map(),
  };
  const req: TripRequest = { slug: 'tuyen-quang', days: 3, party: { adults: 2, children: 0, elders: 0 }, pace: 'moderate' };

  it('seed cụm Hà Giang (có điểm nổi tiếng) dù tỉnh-lỵ nhiều điểm/mass cao hơn', () => {
    const it = buildItinerary(req, store);
    const names = it.days.flatMap((d) => d.items.map((i) => i.name));
    expect(names).toContain('Đèo Mã Pí Lèng');
    expect(names.some((n) => n.startsWith('Trụ sở'))).toBe(false); // tỉnh-lỵ bị loại (xa + không fame)
  });
});

// Regression (#649 review BLOCKER): khi cụm theo ward, lõi TRUNG TÂM vỡ thành nhiều ward nhỏ, còn các
// điểm KHÔNG parse được ward (không có full_address) dồn vào MỘT blob region_id ngoại vi có tổng mass
// lớn. Seed cũ = mass cao nhất -> blob ngoại vi chiếm seed -> lõi trung tâm cách >8km bị gap-stop loại
// sạch (Hạ Long 19→9, Vũng Tàu 19→4 điểm). Seed theo TÂM chuyến sửa việc này. Test này FAIL với seed cũ.
describe('buildItinerary — blob ngoại vi mass-lớn KHÔNG được chiếm seed, giữ lõi trung tâm (#649)', () => {
  // Lõi đất liền: 5 điểm/3 ward, sát tâm (~≤3km). Có full_address -> cụm theo ward.
  const core = (id: string, lat: number, lon: number, ward: string): KbRecord => ({
    id, name: `Lõi ${id}`, region_id: 'trung-tam', source_ids: ['s1', 's2', 's3', 's4', 's5'],
    coordinates: { latitude: lat, longitude: lon },
    address: { full_address: `số 1, ${ward}, tỉnh Quảng Ninh` },
    description: { value: 'điểm trung tâm' },
  });
  // Blob ngoài khơi: 4 điểm ~18km đông, KHÔNG full_address -> rơi về region_id 'ngoai-khoi' = 1 cụm mass lớn.
  const off = (id: string, lat: number, lon: number): KbRecord => ({
    id, name: `Khơi ${id}`, region_id: 'ngoai-khoi', source_ids: ['s1', 's2', 's3', 's4', 's5'],
    coordinates: { latitude: lat, longitude: lon },
    description: { value: 'điểm ngoài khơi' },
  });
  const store: Store = {
    slug: 'ha-long', generatedAt: '2026-01-01', tam: { lat: 20.95, lon: 107.07 },
    destinations: [
      core('BC1', 20.955, 107.060, 'Phường Bãi Cháy'), core('BC2', 20.953, 107.065, 'Phường Bãi Cháy'),
      core('HG1', 20.948, 107.080, 'Phường Hồng Gai'), core('HG2', 20.950, 107.085, 'Phường Hồng Gai'),
      core('HT1', 20.945, 107.075, 'Phường Hà Tu'),
      off('OFF1', 20.952, 107.240), off('OFF2', 20.949, 107.244),
      off('OFF3', 20.955, 107.238), off('OFF4', 20.947, 107.242),
    ],
    restaurants: [], hotels: [core('H1', 20.950, 107.070, 'Phường Bãi Cháy')],
    matrix: null, matrixIndex: new Map(),
  };
  const req: TripRequest = { slug: 'ha-long', days: 3, party: { adults: 2, children: 0, elders: 0 }, pace: 'moderate' };

  it('giữ lõi trung tâm (5 điểm đất liền), KHÔNG để blob ngoài khơi thắng seed', () => {
    const it = buildItinerary(req, store);
    const ids = it.days.flatMap((d) => d.items.map((i) => i.id));
    for (const id of ['BC1', 'BC2', 'HG1', 'HG2', 'HT1']) expect(ids).toContain(id);
  });

  it('blob ngoài khơi xa bị loại (compactness thắng), có note', () => {
    const it = buildItinerary(req, store);
    const ids = it.days.flatMap((d) => d.items.map((i) => i.id));
    for (const id of ['OFF1', 'OFF2', 'OFF3', 'OFF4']) expect(ids).not.toContain(id);
    expect(it.notes.some((n) => n.includes('ngoài vùng thuận tiện'))).toBe(true);
  });
});

// MARQUEE surfacing (P0): điểm biểu tượng khớp signatureSpots của slug LUÔN có mặt trong lịch —
// pin đầu cụm (sống sót packDays cap) + cụm marquee force-keep qua gap-stop (không bị "ngoài vùng
// thuận tiện"). "Đi Nha Trang phải có VinWonders", "đi Đà Nẵng phải có Bà Nà".
describe('buildItinerary — marquee (signatureSpots) luôn xuất hiện trong lịch (P0)', () => {
  // Nha Trang: cụm trung tâm 1 ward, 4 điểm generic score cao + VinWonders score THẤP (id cuối). Không
  // pin → cap budget 3 loại VinWonders. Có pin → VinWonders lên đầu, sống sót.
  const generic = (id: string, lat: number, lon: number): KbRecord => ({
    id, name: `Bảo tàng ${id}`, region_id: 'r', source_ids: ['s1', 's2', 's3', 's4', 's5'],
    coordinates: { latitude: lat, longitude: lon },
    address: { full_address: `số 1, Phường Nha Trang, tỉnh Khánh Hòa` },
    description: { value: 'có mô tả' }, // score cao (desc + >=5 nguồn)
  });
  const vinwonders: KbRecord = {
    id: 'NT-Z', name: 'VinWonders Nha Trang', region_id: 'r', source_ids: ['s1'], // score thấp (1 nguồn, no desc)
    coordinates: { latitude: 12.221, longitude: 109.247 },
    address: { full_address: `Phường Nha Trang, tỉnh Khánh Hòa` },
    category: { primary: 'Khu du lịch giải trí (vui chơi trả phí)' },
  };
  const ntStore: Store = {
    slug: 'nha-trang', generatedAt: '2026-01-01', tam: { lat: 12.24, lon: 109.19 },
    destinations: [
      generic('B1', 12.245, 109.190), generic('B2', 12.246, 109.191),
      generic('B3', 12.244, 109.192), generic('B4', 12.243, 109.189), vinwonders,
    ],
    restaurants: [], hotels: [generic('H1', 12.245, 109.190)],
    matrix: null, matrixIndex: new Map(),
  };

  it('VinWonders (marquee, score thấp) sống sót cap trong cụm — lịch 1 ngày', () => {
    const req: TripRequest = { slug: 'nha-trang', days: 1, party: { adults: 2, children: 0, elders: 0 }, pace: 'moderate' };
    const it = buildItinerary(req, ntStore);
    const names = it.days.flatMap((d) => d.items.map((i) => i.name));
    expect(names).toContain('VinWonders Nha Trang');
  });

  // Đà Nẵng: cụm trung tâm 3 điểm marquee (seed, mass cao) + cụm Bà Nà 1 điểm marquee ~40km (non-seed).
  // Không force-keep → Bà Nà bị gap-stop loại ("ngoài vùng thuận tiện"). Có → Bà Nà giữ.
  const dn = (id: string, name: string, lat: number, lon: number, ward: string): KbRecord => ({
    id, name, region_id: 'r', source_ids: ['s1', 's2', 's3', 's4', 's5'],
    coordinates: { latitude: lat, longitude: lon },
    address: { full_address: `số 1, ${ward}, thành phố Đà Nẵng` },
    description: { value: 'có mô tả' },
  });
  const dnStore: Store = {
    slug: 'da-nang', generatedAt: '2026-01-01', tam: { lat: 16.05, lon: 108.22 },
    destinations: [
      dn('NHS', 'Ngũ Hành Sơn', 16.00, 108.26, 'Phường Ngũ Hành Sơn'),
      dn('MK', 'Biển Mỹ Khê', 16.06, 108.24, 'Phường Mỹ An'),
      dn('LU', 'Chùa Linh Ứng', 16.10, 108.28, 'Phường Thọ Quang'),
      dn('BANA', 'Khu du lịch Bà Nà Hills', 15.995, 107.99, 'Xã Hòa Ninh'), // ~40km tây
    ],
    restaurants: [], hotels: [dn('H1', 'KS', 16.05, 108.22, 'Phường Hải Châu')],
    matrix: null, matrixIndex: new Map(),
  };

  it('Bà Nà (marquee ~40km, non-seed) KHÔNG bị loại — giữ trong lịch', () => {
    const req: TripRequest = { slug: 'da-nang', days: 3, party: { adults: 2, children: 0, elders: 0 }, pace: 'moderate' };
    const it = buildItinerary(req, dnStore);
    const names = it.days.flatMap((d) => d.items.map((i) => i.name));
    expect(names).toContain('Khu du lịch Bà Nà Hills');
    expect(it.notes.some((n) => n.includes('ngoài vùng thuận tiện'))).toBe(false);
  });
});

// IMPORTANCE ORDER (Phase 2): KB ship diem-den.json theo thứ tự importance (build-time
// diem_quan_trong.sap_xep) → runtime coi array index = rank, cộng bonus có trần vào scoreOf và dùng
// destRank làm tiebreak (thay id lexical). Đây là cơ chế cho 17 tp KHÔNG có signatureSpots hand-list.
describe('buildItinerary — thứ tự importance (destRank) quyết định sống sót cap, thay tiebreak id lexical', () => {
  // slug KHÔNG có signatureSpots → không marquee pin. 4 điểm cùng ward, cùng tín hiệu chất-lượng
  // (desc + >=5 nguồn) → scoreDestination BẰNG nhau; khác CHỈ ở thứ tự record (importance rank). Cap
  // 1-ngày moderate = 3 → 1 điểm bị cắt. id đặt NGƯỢC importance: quan trọng nhất (index 0) id 'ZZZ'
  // (lexical CUỐI), kém nhất (index 3) id 'AAA' (lexical ĐẦU). Tiebreak id cũ → 'AAA' sống / 'ZZZ' chết
  // (SAI). destRank + bonus → 'ZZZ' sống / 'AAA' chết (ĐÚNG). Test này FAIL với code trước Phase 2.
  const q = (id: string, lat: number, lon: number): KbRecord => ({
    id, name: `Điểm ${id}`, region_id: 'r', source_ids: ['s1', 's2', 's3', 's4', 's5'],
    coordinates: { latitude: lat, longitude: lon },
    address: { full_address: `số 1, Phường Hoàn Kiếm, thành phố Hà Nội` },
    description: { value: 'có mô tả' },
  });
  const store: Store = {
    slug: 'ha-noi', generatedAt: '2026-01-01', tam: { lat: 21.03, lon: 105.85 },
    destinations: [ // thứ tự = importance (index 0 = quan trọng nhất)
      q('ZZZ', 21.030, 105.850), q('MMM', 21.031, 105.851),
      q('GGG', 21.029, 105.852), q('AAA', 21.028, 105.849),
    ],
    restaurants: [], hotels: [q('H1', 21.030, 105.850)],
    matrix: null, matrixIndex: new Map(),
  };
  it('điểm importance cao nhất (index 0) sống sót cap; kém nhất (id lexical đầu) bị cắt', () => {
    const req: TripRequest = { slug: 'ha-noi', days: 1, party: { adults: 2, children: 0, elders: 0 }, pace: 'moderate' };
    const it = buildItinerary(req, store);
    const names = it.days.flatMap((d) => d.items.map((i) => i.name));
    expect(names).toContain('Điểm ZZZ');     // quan trọng nhất (index 0) — sống
    expect(names).not.toContain('Điểm AAA'); // kém nhất (index 3) — bị cắt dù id lexical đầu
  });
});

// Phase 3: slug KHÔNG có signatureSpots hand-list (17/35 tp: Hà Nội, HCM…) → auto-marquee top-K theo
// importance (destRank). Trước Phase 3 các tp này có marqueeIds rỗng → điểm xa quan trọng bị gap-stop
// loại. Giờ top-K importance được force-include như hand-list.
describe('buildItinerary — Phase 3 auto-marquee top-K importance (slug không hand-list)', () => {
  const near = (id: string, lat: number, lon: number): KbRecord => ({
    id, name: `Gần ${id}`, region_id: 'r', source_ids: ['s1', 's2', 's3', 's4', 's5'],
    coordinates: { latitude: lat, longitude: lon },
    address: { full_address: `số 1, Phường Trung Tâm, thành phố Hà Nội` }, description: { value: 'x' },
  });
  const far = (id: string, name: string, lat: number, lon: number, ward: string): KbRecord => ({
    id, name, region_id: 'r', source_ids: ['s1', 's2', 's3', 's4', 's5'],
    coordinates: { latitude: lat, longitude: lon },
    address: { full_address: `số 1, ${ward}, thành phố Hà Nội` }, description: { value: 'x' },
  });
  const store: Store = {
    slug: 'ha-noi', generatedAt: '2026-01-01', tam: { lat: 21.03, lon: 105.85 },
    destinations: [ // thứ tự = importance; TOP (index 0) trong top-K, LOW (cuối) ngoài top-K
      far('TOP', 'Điểm xa quan trọng', 21.30, 105.85, 'Phường Xa Bắc'),   // index 0, ~30km
      near('N1', 21.030, 105.850), near('N2', 21.031, 105.851), near('N3', 21.029, 105.852),
      far('LOW', 'Điểm xa phụ', 20.76, 105.85, 'Phường Xa Nam'),           // index 4 (ngoài top-4), ~30km
    ],
    restaurants: [], hotels: [near('H1', 21.030, 105.850)],
    matrix: null, matrixIndex: new Map(),
  };
  it('điểm xa top-importance được auto-marquee giữ; điểm xa importance thấp bị gap-stop loại', () => {
    const req: TripRequest = { slug: 'ha-noi', days: 2, party: { adults: 2, children: 0, elders: 0 }, pace: 'moderate' };
    const it = buildItinerary(req, store);
    const names = it.days.flatMap((d) => d.items.map((i) => i.name));
    expect(names).toContain('Điểm xa quan trọng'); // index 0 → auto-marquee → own-day (2+ ngày)
    expect(names).not.toContain('Điểm xa phụ');     // ngoài top-K → gap-stop loại
  });
});

// NGÀY ĐẢO: điểm marquee XA mà LỐI VÀO là trải nghiệm chữ ký (cáp treo/tàu ra đảo, ext.destination.
// loi_vao_dac_trung) được slot NGAY CẢ lịch 1 ngày (ngày xoay quanh nó; khu trung tâm lùi note). Trước
// đây far-marquee 1 ngày chỉ có note. Marquee xa KHÔNG sig-access vẫn note-only (không đổi).
describe('buildItinerary — ngày đảo: lối vào đặc trưng (cáp treo) slot được lịch 1 ngày', () => {
  const near = (id: string, lat: number, lon: number, ward: string): KbRecord => ({
    id, name: `Gần ${id}`, region_id: 'r', source_ids: ['s1', 's2', 's3', 's4', 's5'],
    coordinates: { latitude: lat, longitude: lon },
    address: { full_address: `số 1, ${ward}, thành phố Hà Nội` }, description: { value: 'x' },
  });
  const island = (sig: boolean): KbRecord => ({
    id: 'ISL', name: 'Khu đảo cáp treo', region_id: 'r', source_ids: ['s1', 's2', 's3', 's4', 's5'],
    coordinates: { latitude: 21.40, longitude: 105.85 }, // ~40km bắc → far
    address: { full_address: `số 1, Phường Đảo Xa, thành phố Hà Nội` }, description: { value: 'x' },
    ext: { destination: sig ? { loi_vao_dac_trung: 'có cáp treo vượt biển ra đảo' } : {} },
  });
  const mkStore = (sig: boolean): Store => ({
    slug: 'ha-noi', generatedAt: '2026-01-01', tam: { lat: 21.03, lon: 105.85 },
    destinations: [island(sig), near('N1', 21.030, 105.850, 'Phường A'), near('N2', 21.033, 105.853, 'Phường B')],
    restaurants: [], hotels: [near('H1', 21.030, 105.850, 'Phường A')],
    matrix: null, matrixIndex: new Map(),
  });
  const req: TripRequest = { slug: 'ha-noi', days: 1, party: { adults: 2, children: 0, elders: 0 }, pace: 'moderate' };

  it('days=1 + cáp treo → ngày đảo: điểm đảo CÓ trong lịch, khu trung tâm lùi note', () => {
    const it = buildItinerary(req, mkStore(true));
    const names = it.days.flatMap((d) => d.items.map((i) => i.name));
    expect(names).toContain('Khu đảo cáp treo');            // ngày đảo — điểm hot có
    expect(names.some((n) => n.startsWith('Gần'))).toBe(false); // khu trung tâm lùi (restDays=0)
  });
  it('days=1 KHÔNG cáp treo → KHÔNG ngày-đảo: khu trung tâm vẫn giữ (không bị drop)', () => {
    const it = buildItinerary(req, mkStore(false));
    const names = it.days.flatMap((d) => d.items.map((i) => i.name));
    // Không sig-access → protReg rỗng, restDays=1 → khu trung tâm KHÔNG bị lùi (đối lập với ngày-đảo).
    expect(names.some((n) => n.startsWith('Gần'))).toBe(true);
  });
});

// FAME = HẠNG signatureSpot biểu tượng nhất trong cụm, KHÔNG phải SỐ ĐẾM điểm khớp. "Đi Nha Trang":
// cụm VinWonders (spot[0], khớp ÍT) phải seed TRƯỚC cụm nhiều điểm khớp spot MUỘN (Tháp Bà/Hòn Chồng/
// Chợ Đầm). Seed quyết cụm-lõi compact → cụm KHÔNG-nổi-tiếng ở gần seed mới được giữ qua gap-stop.
// 3 cụm: A=VinWonders (spot[0], fame=hạng 10) · C=điểm generic sát A ~0.7km (khác ward, fame 0, KHÔNG
// marquee) · B=3 điểm khớp spot muộn ~21km (fame=hạng 8, count 3). Rank: seed=A(10>8) → C sát seed giữ.
// Count cũ: seed=B(count 3>1) → C cách seed ~21km, không marquee → gap-stop LOẠI. Assert 'Điểm C' có mặt
// ⇒ chỉ đúng khi seed theo HẠNG. Revert về count → seed=B → test FAIL.
describe('buildItinerary — seed theo HẠNG signatureSpot biểu tượng, không theo SỐ ĐẾM điểm khớp', () => {
  const mk = (id: string, name: string, lat: number, lon: number, ward: string, sources = 1): KbRecord => ({
    id, name, region_id: 'r', source_ids: Array.from({ length: sources }, (_, i) => `s${i}`),
    coordinates: { latitude: lat, longitude: lon },
    address: { full_address: `số 1, ${ward}, tỉnh Khánh Hòa` },
  });
  const store: Store = {
    slug: 'nha-trang', generatedAt: '2026-01-01', tam: { lat: 12.30, lon: 109.21 },
    destinations: [
      mk('A', 'VinWonders Nha Trang', 12.22, 109.245, 'Phường Vĩnh Nguyên'),        // spot[0] → fame hạng 10
      mk('C', 'Điểm C ven biển', 12.226, 109.243, 'Phường Phước Long', 5),          // sát A, khác ward, fame 0
      mk('B1', 'Tháp Bà Ponagar', 12.400, 109.190, 'Phường Vĩnh Phước'),            // spot[2] → hạng 8
      mk('B2', 'Hòn Chồng', 12.408, 109.192, 'Phường Vĩnh Phước'),                  // spot[5] → hạng 5
      mk('B3', 'Chợ Đầm', 12.395, 109.185, 'Phường Vĩnh Phước'),                     // spot[6] → hạng 4  (count cụm B = 3)
    ],
    restaurants: [], hotels: [mk('H', 'KS', 12.22, 109.245, 'Phường Vĩnh Nguyên', 5)],
    matrix: null, matrixIndex: new Map(),
  };

  it('cụm VinWonders (spot[0]) seed trước cụm nhiều điểm khớp spot muộn → điểm generic sát VinWonders được giữ', () => {
    const req: TripRequest = { slug: 'nha-trang', days: 3, party: { adults: 2, children: 0, elders: 0 }, pace: 'moderate' };
    const it = buildItinerary(req, store);
    const names = it.days.flatMap((d) => d.items.map((i) => i.name));
    expect(names).toContain('Điểm C ven biển'); // FAIL nếu seed=B (count) vì C cách seed ~21km bị gap-stop
  });
});

// M4: regFameOf — cụm sig-access (lối vào đặc trưng) ngoài top-K importance vẫn phải THẮNG protReg
// trước cụm auto-marquee importance CAO hơn nhưng KHÔNG sig-access. Trước fix: term ÂM (AUTO_MARQUEE_K -
// destRank ngoài top-K) rớt fame=0 (Math.max không kéo lên) → cụm PLAIN (trong top-K, fame>0) thắng sort
// theo fame desc, chiếm mất slot protReg (cap=1 với days=2) — cụm SIG (full-day tier, sigAccess bypass
// isFar) bị đẩy xuống rest, KHÔNG được ngày riêng. Sau fix: per-điểm credit sàn 0 + cụm chứa sig-access
// sàn fame=AUTO_MARQUEE_K → SIG(4) > PLAIN(3) → SIG thắng, có ngày riêng (protReg chunk = đúng pts của nó).
describe('buildItinerary — sig-access ngoài top-K vẫn thắng protReg trước marquee importance cao hơn (M4)', () => {
  const near = (id: string, lat: number, lon: number): KbRecord => ({
    id, name: `Gần ${id}`, region_id: 'r', source_ids: ['s1', 's2', 's3', 's4', 's5'],
    coordinates: { latitude: lat, longitude: lon },
    address: { full_address: `số 1, Phường Trung Tâm, thành phố Hà Nội` }, description: { value: 'x' },
  });
  const plain: KbRecord = { // index 1 → trong top-4 auto-marquee, KHÔNG sig-access, ~31km (far)
    id: 'PLAIN', name: 'Điểm PLAIN', region_id: 'r', source_ids: ['s1', 's2', 's3', 's4', 's5'],
    coordinates: { latitude: 21.03, longitude: 105.55 },
    address: { full_address: `số 1, Phường Xa Tây, thành phố Hà Nội` }, description: { value: 'x' },
  };
  const sig: KbRecord = { // index 5 → NGOÀI top-4 (destRank 5 > AUTO_MARQUEE_K 4), sig-access, ~5km
    id: 'SIG', name: 'Điểm SIG', region_id: 'r', source_ids: ['s1', 's2', 's3', 's4', 's5'],
    coordinates: { latitude: 21.075, longitude: 105.85 },
    address: { full_address: `số 1, Phường Sig Gần, thành phố Hà Nội` }, description: { value: 'x' },
    ext: { destination: { loi_vao_dac_trung: 'có cáp treo vượt biển ra đảo' } },
  };
  const store: Store = {
    slug: 'ha-noi', generatedAt: '2026-01-01', tam: { lat: 21.03, lon: 105.85 },
    destinations: [ // thứ tự = importance rank
      near('A', 21.031, 105.851), plain, near('B', 21.029, 105.852), near('C', 21.032, 105.849),
      near('D', 21.030, 105.853), sig,
    ],
    restaurants: [], hotels: [near('H1', 21.030, 105.850)],
    matrix: null, matrixIndex: new Map(),
  };
  it('cụm SIG (fame sàn AUTO_MARQUEE_K) được protReg riêng ngày, không bị PLAIN (fame thấp hơn) đè', () => {
    const req: TripRequest = { slug: 'ha-noi', days: 2, party: { adults: 2, children: 0, elders: 0 }, pace: 'moderate' };
    const it = buildItinerary(req, store);
    const sigDay = it.days.find((d) => d.items.some((i) => i.name === 'Điểm SIG'));
    expect(sigDay).toBeDefined();
    expect(sigDay!.items.map((i) => i.name)).toEqual(['Điểm SIG']); // protReg chunk = ĐÚNG pts của cụm SIG, không trộn PLAIN
  });
});
