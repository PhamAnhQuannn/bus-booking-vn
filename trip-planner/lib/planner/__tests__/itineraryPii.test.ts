// PII contract (#522/#532): điểm-đến phone bị STRIP tại model (slot()), khách sạn + nhà hàng phone
// GIỮ (business contact). Test tại buildItinerary — phủ cả hai đường đọc (DTO route + RSC /lich-trinh)
// vì cả hai dựng itinerary từ hàm này.
import { describe, it, expect } from 'vitest';
import { buildItinerary } from '../plan';
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
