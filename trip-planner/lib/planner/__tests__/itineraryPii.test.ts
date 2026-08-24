// PII contract:
//  - Server Itinerary (#522/#532): điểm-đến phone STRIP tại model (slot()); khách sạn + nhà hàng
//    GIỮ phone ở tầng server (nguồn sự thật, dùng nội bộ).
//  - DTO client (planner-pii-hotel-phone, PDPL): toPlannerDto BỎ phone cho MỌI loại (hotel +
//    hotelAlts + restaurant) — không rò số chủ hộ cá thể ra browser. SPEC CONFLICT với #532 → PDPL thắng.
import { describe, it, expect } from 'vitest';
import { buildItinerary } from '../plan';
import { toPlannerDto } from '../itineraryDto';
import type { Store } from '../store';
import type { KbRecord, TripRequest } from '../types';

function rec(id: string, lat: number, lon: number, phone: string): KbRecord {
  return {
    id,
    name: `Nơi ${id}`,
    region_id: 'r1',
    source_ids: ['src-1'],
    coordinates: { latitude: lat, longitude: lon },
    contact: { phone },
  };
}

const store: Store = {
  slug: 'da-lat',
  generatedAt: '2026-01-01',
  tam: { lat: 11.94, lon: 108.44 },
  destinations: [rec('d1', 11.94, 108.44, '+8490xxxxxx1'), rec('d2', 11.95, 108.45, '+8490xxxxxx2')],
  restaurants: [rec('rest1', 11.94, 108.44, '+8490xxxxxx3')],
  hotels: [rec('hotel1', 11.94, 108.44, '+8490xxxxxx4')],
  matrix: null,
  matrixIndex: new Map(),
};

const req: TripRequest = {
  slug: 'da-lat',
  days: 1,
  party: { adults: 2, children: 0, elders: 0 },
  pace: 'moderate',
};

describe('buildItinerary — PII phone contract', () => {
  const itinerary = buildItinerary(req, store);
  const items = itinerary.days.flatMap((d) => d.items);

  it('dựng được điểm-đến vào timeline', () => {
    expect(items.length).toBeGreaterThan(0);
  });

  it('điểm-đến: phone = null (PII strip)', () => {
    for (const i of items) expect(i.phone).toBeNull();
  });

  it('khách sạn: phone GIỮ (business contact)', () => {
    expect(itinerary.hotel?.phone).toBe('+8490xxxxxx4');
  });

  it('nhà hàng: phone GIỮ (business contact)', () => {
    expect(itinerary.restaurants.length).toBeGreaterThan(0);
    expect(itinerary.restaurants[0]?.phone).toBe('+8490xxxxxx3');
  });
});

describe('toPlannerDto — DTO client KHÔNG rò phone (PDPL)', () => {
  const dto = toPlannerDto(buildItinerary(req, store));

  it('khách sạn: DTO không có field phone', () => {
    expect(dto.hotel).not.toBeNull();
    expect(Object.hasOwn(dto.hotel!, 'phone')).toBe(false);
  });

  it('khách sạn thay thế (hotelAlts): DTO không có field phone', () => {
    for (const h of dto.hotelAlts) expect(Object.hasOwn(h, 'phone')).toBe(false);
  });

  it('nhà hàng: DTO không có field phone', () => {
    expect(dto.restaurants.length).toBeGreaterThan(0);
    for (const r of dto.restaurants) expect(Object.hasOwn(r, 'phone')).toBe(false);
  });

  it('không còn chuỗi số điện thoại placeholder trong DTO serialize', () => {
    expect(JSON.stringify(dto)).not.toContain('+8490xxxxxx');
  });
});
