// Kiểu dữ liệu cho engine planner deterministic (V1, không LLM).
// Mọi place đi vào lịch trình đều mang provenance (source_ids + ngay_du_lieu) — 0 dòng bịa.

export type Pace = "relaxed" | "moderate" | "packed";

export interface Party {
  adults: number;
  children: number; // trẻ nhỏ
  elders: number; // người lớn tuổi
}

export interface Accessibility {
  wheelchair?: boolean;
  avoidSteep?: boolean; // tránh dốc/địa hình cao (đi cùng người lớn tuổi)
}

export interface TripRequest {
  slug: string; // "da-lat"
  days: number;
  party: Party;
  pace: Pace;
  interests?: string[]; // khớp category/editorial_group (tuỳ chọn)
  accessibility?: Accessibility;
  anchors?: string[]; // DS-018 E1: id điểm-đến khách chọn (mode vibe) — force-include vào lịch
  // Mock active (2026-08-11) — doctrine-safe: KHÔNG bịa giá.
  budget?: "tiet-kiem" | "vua" | "thoai-mai"; // → pace mặc định (không lọc theo giá)
  transport?: "xe-khach" | "tu-lai" | "xe-may"; // ghi lại + note (không đổi routing — không có ma trận theo mode)
  food?: string[]; // sở thích ăn uống → bias gợi ý nhà hàng theo category
}

// Gợi ý điểm-đến theo vibe (mode discovery) — subset PlaceRef, tên từ KB (không LLM bịa).
export interface DestinationSuggestion {
  id: string;
  name: string;
  vibes: string[];
  address: string | null;
  map_url: string | null;
  region_id: string | null;
}

// Tham chiếu 1 địa điểm trong lịch trình — chỉ field cần hiển thị + provenance.
export interface PlaceRef {
  id: string;
  name: string;
  category: string | null;
  category_secondary?: string[]; // loại phụ (category.secondary) — dựng "Giới thiệu nhanh" factual
  lat: number | null;
  lon: number | null;
  address: string | null;
  phone: string | null;
  gio_mo: string | null; // chuỗi giờ mở nếu có
  goi_truoc: boolean; // true = không có giờ xác minh -> "gọi trước"
  map_url: string | null;
  source_ids: string[];
  ngay_du_lieu: string | null;
  region_id?: string | null; // khu vực (để kiểm mạch lạc địa lý từ artifact)
  trai_nghiem?: string | null; // nhãn trải nghiệm ("Ngắm cảnh"…) — chỉ điểm đến
  vibes?: string[]; // slug vibe (VIBE_VOCAB) — khớp interests khách; sinh offline (rule+llm)
  google_place_id?: string | null; // để hiện giờ mở LIVE qua link Google (ToS cấm lưu giờ)
  note?: string | null; // vd giá khách sạn, độ nổi tiếng
  phan_khuc?: string | null; // hạng khách sạn thô (ext.hotel.phan_khuc) — render qua HOTEL_TIER_LABELS
  so_phong?: number | null; // số phòng (ext.hotel.so_phong)
  mo_ta?: string | null; // mô tả ngắn (description.value) — Wikipedia verbatim / template factual
  mo_ta_nguon_url?: string | null; // link nguồn Wikipedia (CC-BY-SA attribution) khi mo_ta trích Wikipedia
  hoat_dong?: { label: string }[]; // "Có gì ở đây" — nhãn hoạt động (điểm đến); source-count riêng
  cach_trung_tam_km?: number | null; // khoảng cách tới trung tâm (đo OSRM), không bịa
  facilities?: Record<string, string | null> | null; // tiện ích (OSM): WC/bãi xe/lối xe lăn/...
  gia_ve?: string | null; // giá vé vào cửa tham khảo (ticketing[0].value), hiếm — hiện nơi có
  trai_nghiem_tra_phi?: { ten: string; don_vi: string }[] | null; // trò trả phí có tên
  gioi_thieu?: string | null; // câu 1 "Giới thiệu nhanh" (intro.fact, build-time, lắp từ field)
  phu_hop_voi?: string | null; // EDITORIAL (002 bien-tap): câu 2 "Phù hợp với khách muốn…" (intro.editorial)
}

export interface SlotItem extends PlaceRef {
  role: "diem-den" | "an-trua" | "an-toi" | "khach-san";
  buoi: "sang" | "trua" | "chieu" | "toi";
  leg_from_prev?: { minutes: number; km: number } | null; // chặng tới mục TRƯỚC trong ngày (null = mục đầu)
}

export interface DayPlan {
  day: number;
  region_id: string | null;
  items: SlotItem[];
}

export interface Itinerary {
  slug: string;
  request: TripRequest;
  days: DayPlan[];
  hotel: PlaceRef | null; // khách sạn chính (km-anchor)
  hotelAlts: PlaceRef[]; // 0-3 lựa chọn khách sạn khác gần đó (primary + alts = 1-4)
  restaurants: PlaceRef[]; // GỢI Ý quán ăn (không slot vào timeline) — thứ tự ảnh hưởng VQS
  notes: string[]; // cảnh báo mức lịch trình (vd nhiều nơi phải gọi trước)
  generated_from: string; // ngay_du_lieu của bộ dữ liệu
}

// --- Raw KB export shapes (tourism-kb/export/<slug>/*.json) ---------------------------------
// Loose: only the fields the planner reads. Source shape is owned by the KB export pipeline; kept
// permissive because the JSON is external + gitignored. `coordinates` is non-optional because the
// planner filters records lacking it before use.
export interface KbOpeningSlot {
  open?: string;
  close?: string;
}
export interface KbDestinationExt {
  trai_nghiem?: string | null;
  vibes?: string[]; // slug vibe rời rạc (VIBE_VOCAB) — CẤM chuỗi ghép "X/Y"
  hoat_dong?: { label: string; nguon: string }[]; // "Có gì ở đây" — sinh offline (hoat_dong_derive), cap 5
  opening_hours?: { regular_schedule?: KbOpeningSlot[]; raw?: string | null };
  map?: { google_maps_url?: string | null };
  facilities?: Record<string, string | null>; // {restroom/parking/wheelchair_access/wifi/info_desk/souvenir}: "có"/"limited"/null (OSM)
  ticketing?: { value?: string | null }[]; // giá vé tham khảo (chuỗi, có thể nhiều nguồn xung đột)
  trai_nghiem_tra_phi?: { ten: string; don_vi: string }[] | null; // trò trả phí có tên (geo-join on-site Overture)
  phu_hop_voi?: { value?: string | null } | null; // EDITORIAL tier (002): "Phù hợp với khách muốn…" (bien-tap)
  intro?: { fact?: string | null; editorial?: string | null; tier?: string } | null; // "Giới thiệu nhanh" V2 (build-time)
  mo_ta?: string | null; // mô tả đã trim (B2, build-time) — ưu tiên hơn description.value
  mo_ta_nguon_url?: string | null; // link Wikipedia (CC-BY-SA) khi mo_ta trích Wikipedia
  environment?: { prominence_m?: number };
  transport?: { distance_from_center_km?: number | null }; // đo được (OSRM) — không phải bịa
}
export interface KbHotelExt {
  phan_khuc?: string;
  so_phong?: number;
}
export interface KbRecord {
  id: string;
  name: string;
  region_id?: string | null;
  source_ids?: string[];
  coordinates: { latitude: number; longitude: number };
  category?: { primary?: string | null; secondary?: string[] };
  address?: { full_address?: string | null };
  contact?: { phone?: string | null };
  description?: { value?: string | null };
  data_quality?: { last_verified_at?: string | null };
  external_ids?: { google_place_id?: string | null };
  ext?: { destination?: KbDestinationExt; hotel?: KbHotelExt };
}
export interface KbMeta {
  generated_at: string;
  tam: { lat: number; lon: number };
  osrm_diem_den?: { ids: string[]; durations: number[][]; distances: number[][] };
}
