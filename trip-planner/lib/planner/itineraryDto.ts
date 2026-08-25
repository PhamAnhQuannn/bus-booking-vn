// DTO client-safe cho trợ lý du lịch: serialize Itinerary (server) -> shape gọn cho card + map.
// CHỈ import kiểu (type-only) -> KHÔNG kéo graph server (parseIntent/GEMINI key) vào bundle client (bẫy 092b).
// Doctrine: KHÔNG ★/điểm, KHÔNG giá. Order số = tín hiệu ảnh hưởng (VQS). Thiếu giờ -> goi_truoc.
// mo_ta/hoat_dong/vibes/cach_trung_tam_km: field CÓ NGUỒN (Wikipedia/factual, OSRM đo) — hợp doctrine.

import type { Itinerary, PlaceRef, SlotItem } from "./types";

export interface DtoLeg {
  minutes: number;
  km: number;
}

export interface DtoItem {
  order: number; // 1..n trong ngày = số pin trên map
  name: string;
  category: string | null;
  category_secondary: string[]; // loại phụ — dựng "Giới thiệu nhanh" factual (derived, không bịa)
  role: SlotItem["role"]; // diem-den | an-trua | an-toi
  buoi: SlotItem["buoi"]; // sang | trua | chieu | toi (KHÔNG clock-time)
  lat: number | null;
  lon: number | null;
  gio_mo: string | null;
  gio_mo_chi_tiet?: { d: number[]; open: string; close: string }[] | null; // lịch theo ngày khi giờ khác nhau
  goi_truoc: boolean; // true = chưa có giờ xác minh
  map_url: string | null;
  region_id: string | null;
  trai_nghiem: string | null; // nhãn trải nghiệm (điểm đến); null cho nhà hàng/khách sạn
  google_place_id: string | null; // link giờ mở LIVE trên Google (khi có + thiếu giờ lưu)
  leg_from_prev: DtoLeg | null;
  nguon: number; // số nguồn (source_ids.length) — provenance, KHÔNG phải điểm
  mo_ta: string | null; // mô tả ngắn (sourced)
  mo_ta_nguon_url: string | null; // link Wikipedia (CC-BY-SA) khi mo_ta trích Wikipedia
  hoat_dong: { label: string }[]; // "Có gì ở đây" (sourced, cap hiển thị ở UI)
  vibes: string[]; // chip trải nghiệm (slug)
  cach_trung_tam_km: number | null; // đo OSRM
  facilities: Record<string, string | null> | null; // tiện ích (OSM sourced)
  gia_ve: string | null; // giá vé vào cửa tham khảo (hiếm)
  paid_activities: { ten: string }[]; // trò trả phí có tên (on-site geo-join) — hiếm, hiện nơi có
  gioi_thieu: string | null; // câu 1 "Giới thiệu nhanh" (intro.fact, baked build-time)
  phu_hop_voi: string | null; // câu 2 EDITORIAL (002) — hiện dưới nhãn "Gợi ý biên tập", null khi off/omit
}

export interface DtoDay {
  day: number;
  region_id: string | null;
  items: DtoItem[];
}

// SPEC CONFLICT: #532 cố ý GIỮ phone (business contact) vs issue planner-pii-hotel-phone
// (PDPL: số chủ hộ cá thể = PII, cùng lý do tourism-kb/export bị gitignore) → BỎ phone. PDPL thắng.
export interface DtoHotel {
  name: string;
  note: string | null;
  phan_khuc: string | null; // hạng thô — render qua HOTEL_TIER_LABELS (B1.2)
  so_phong: number | null;
  address: string | null;
  map_url: string | null;
  lat: number | null;
  lon: number | null;
  nguon: number;
}

export interface DtoRestaurant {
  name: string;
  category: string | null;
  address: string | null;
  // phone BỎ — xem SPEC CONFLICT trên DtoHotel (planner-pii-hotel-phone, PDPL)
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
  hotelAlts: DtoHotel[]; // 0-3 lựa chọn khách sạn khác (primary + alts = 1-4)
  restaurants: DtoRestaurant[]; // GỢI Ý (không trong timeline)
  notes: string[];
  generated_from: string;
}

function toItem(it: SlotItem, idx: number): DtoItem {
  return {
    order: idx + 1,
    name: it.name,
    category: it.category,
    category_secondary: it.category_secondary ?? [],
    role: it.role,
    buoi: it.buoi,
    lat: it.lat,
    lon: it.lon,
    gio_mo: it.gio_mo,
    gio_mo_chi_tiet: it.gio_mo_chi_tiet ?? null,
    goi_truoc: it.goi_truoc,
    map_url: it.map_url,
    region_id: it.region_id ?? null,
    trai_nghiem: it.trai_nghiem ?? null,
    google_place_id: it.google_place_id ?? null,
    leg_from_prev: it.leg_from_prev ?? null,
    nguon: it.source_ids?.length ?? 0,
    mo_ta: it.mo_ta ?? null,
    mo_ta_nguon_url: it.mo_ta_nguon_url ?? null,
    hoat_dong: it.hoat_dong ?? [],
    vibes: it.vibes ?? [],
    cach_trung_tam_km: it.cach_trung_tam_km ?? null,
    facilities: it.facilities ?? null,
    gia_ve: it.gia_ve ?? null,
    paid_activities: (it.trai_nghiem_tra_phi ?? []).map((a) => ({ ten: a.ten })),
    gioi_thieu: it.gioi_thieu ?? null,
    phu_hop_voi: it.phu_hop_voi ?? null,
  };
}

function toHotel(h: PlaceRef): DtoHotel {
  return {
    name: h.name,
    note: h.note ?? null,
    phan_khuc: h.phan_khuc ?? null,
    so_phong: h.so_phong ?? null,
    address: h.address,
    map_url: h.map_url,
    lat: h.lat,
    lon: h.lon,
    nguon: h.source_ids?.length ?? 0,
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
    hotel: it.hotel ? toHotel(it.hotel) : null,
    hotelAlts: it.hotelAlts.map(toHotel),
    restaurants: it.restaurants.map((r) => ({
      name: r.name,
      category: r.category,
      address: r.address,
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
