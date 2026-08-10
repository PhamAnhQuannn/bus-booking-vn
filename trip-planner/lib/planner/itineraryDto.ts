// DTO client-safe cho trợ lý du lịch: serialize Itinerary (server) -> shape gọn cho card + map.
// CHỈ import kiểu (type-only) -> KHÔNG kéo graph server (parseIntent/GEMINI key) vào bundle client (bẫy 092b).
// Doctrine: KHÔNG ★/điểm, KHÔNG giá. Order số = tín hiệu ảnh hưởng (VQS). Thiếu giờ -> goi_truoc.

import type { Itinerary, SlotItem } from "./types";

export interface DtoLeg {
  minutes: number;
  km: number;
}

export interface DtoItem {
  order: number; // 1..n trong ngày = số pin trên map
  name: string;
  category: string | null;
  role: SlotItem["role"]; // diem-den | an-trua | an-toi
  buoi: SlotItem["buoi"]; // sang | trua | chieu | toi (KHÔNG clock-time)
  lat: number | null;
  lon: number | null;
  gio_mo: string | null;
  goi_truoc: boolean; // true = chưa có giờ xác minh
  map_url: string | null;
  region_id: string | null;
  trai_nghiem: string | null; // nhãn trải nghiệm (điểm đến); null cho nhà hàng/khách sạn
  google_place_id: string | null; // link giờ mở LIVE trên Google (khi có + thiếu giờ lưu)
  leg_from_prev: DtoLeg | null;
  nguon: number; // số nguồn (source_ids.length) — provenance, KHÔNG phải điểm
}

export interface DtoDay {
  day: number;
  region_id: string | null;
  items: DtoItem[];
}

export interface DtoHotel {
  name: string;
  note: string | null;
  address: string | null;
  phone: string | null;
  map_url: string | null;
  lat: number | null;
  lon: number | null;
  nguon: number;
}

export interface DtoRestaurant {
  name: string;
  category: string | null;
  address: string | null;
  phone: string | null; // giữ (business contact, "gọi trước") — đồng nhất với hotel
  map_url: string | null;
  region_id: string | null;
  gio_mo: string | null;
  goi_truoc: boolean;
  nguon: number;
}

export interface PlannerDto {
  slug: string;
  tripDays: number;
  party: { adults: number; children: number; elders: number };
  pace: string;
  days: DtoDay[];
  hotel: DtoHotel | null;
  restaurants: DtoRestaurant[]; // GỢI Ý (không trong timeline)
  notes: string[];
  generated_from: string;
}

function toItem(it: SlotItem, idx: number): DtoItem {
  return {
    order: idx + 1,
    name: it.name,
    category: it.category,
    role: it.role,
    buoi: it.buoi,
    lat: it.lat,
    lon: it.lon,
    gio_mo: it.gio_mo,
    goi_truoc: it.goi_truoc,
    map_url: it.map_url,
    region_id: it.region_id ?? null,
    trai_nghiem: it.trai_nghiem ?? null,
    google_place_id: it.google_place_id ?? null,
    leg_from_prev: it.leg_from_prev ?? null,
    nguon: it.source_ids?.length ?? 0,
  };
}

export function toPlannerDto(it: Itinerary): PlannerDto {
  return {
    slug: it.slug,
    tripDays: it.request.days,
    party: it.request.party,
    pace: it.request.pace,
    days: it.days.map((d) => ({
      day: d.day,
      region_id: d.region_id,
      items: d.items.map(toItem),
    })),
    hotel: it.hotel
      ? {
          name: it.hotel.name,
          note: it.hotel.note ?? null,
          address: it.hotel.address,
          phone: it.hotel.phone,
          map_url: it.hotel.map_url,
          lat: it.hotel.lat,
          lon: it.hotel.lon,
          nguon: it.hotel.source_ids?.length ?? 0,
        }
      : null,
    restaurants: it.restaurants.map((r) => ({
      name: r.name,
      category: r.category,
      address: r.address,
      phone: r.phone,
      map_url: r.map_url,
      region_id: r.region_id ?? null,
      gio_mo: r.gio_mo,
      goi_truoc: r.goi_truoc,
      nguon: r.source_ids?.length ?? 0,
    })),
    notes: it.notes,
    generated_from: it.generated_from,
  };
}
