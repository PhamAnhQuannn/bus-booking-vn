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
}

// Tham chiếu 1 địa điểm trong lịch trình — chỉ field cần hiển thị + provenance.
export interface PlaceRef {
  id: string;
  name: string;
  category: string | null;
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
  google_place_id?: string | null; // để hiện giờ mở LIVE qua link Google (ToS cấm lưu giờ)
  note?: string | null; // vd giá khách sạn, độ nổi tiếng
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
  hotel: PlaceRef | null;
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
  opening_hours?: { regular_schedule?: KbOpeningSlot[]; raw?: string | null };
  map?: { google_maps_url?: string | null };
  facilities?: { wheelchair_access?: boolean };
  environment?: { prominence_m?: number };
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
