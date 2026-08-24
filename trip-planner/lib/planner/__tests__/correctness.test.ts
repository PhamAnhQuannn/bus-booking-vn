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
