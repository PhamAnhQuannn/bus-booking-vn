// Nhãn hiển thị cho card/map: category enum → tiếng Việt, phân loại badge, tên khu.
// Client-safe (chỉ kiểu). Doctrine: KHÔNG số giá; "Miễn phí" chỉ cho điểm công vào cửa tự do.
// Dữ liệu category của ta LẪN: điểm đến = tiếng Việt ("Bảo tàng"), nhà hàng = enum EN ("vietnamese_restaurant").

export interface LabelItem {
  category: string | null;
  name: string;
  role: string; // "diem-den" | "an-trua" | "an-toi"
  gio_mo: string | null;
  goi_truoc: boolean;
  trai_nghiem?: string | null; // nhãn trải nghiệm (điểm đến)
}

import { CITIES } from "./cities";

// enum EN → nhãn VN (bổ sung từ dữ liệu thật của ta).
export const CATEGORY_LABELS: Record<string, string> = {
  restaurant: "Nhà hàng",
  vietnamese_restaurant: "Nhà hàng Việt",
  american_restaurant: "Nhà hàng Âu - Mỹ",
  pizza_restaurant: "Nhà hàng pizza",
  seafood_restaurant: "Nhà hàng hải sản",
  indian_restaurant: "Nhà hàng Ấn",
  fast_food_restaurant: "Đồ ăn nhanh",
  eat_and_drink: "Quán ăn - uống",
  cafe: "Quán cà phê",
  coffee_shop: "Quán cà phê",
  bar: "Bar / Lounge",
  diner: "Quán ăn",
  museum: "Bảo tàng",
  bridge: "Cầu / Điểm ngắm cảnh",
  park: "Công viên",
  beach: "Bãi biển",
  church: "Nhà thờ",
  pagoda: "Chùa",
  landmark: "Điểm tham quan",
  hotel: "Khách sạn",
  market: "Chợ",
};

// EN enum = có "_" hoặc chỉ chữ thường ascii; VN/human giữ nguyên.
function looksEnum(raw: string): boolean {
  return /_/.test(raw) || (raw === raw.toLowerCase() && /^[a-z ]+$/.test(raw));
}

export function categoryLabel(raw: string | null | undefined): string {
  if (!raw) return "Địa điểm";
  if (CATEGORY_LABELS[raw]) return CATEGORY_LABELS[raw];
  if (looksEnum(raw)) {
    if (typeof console !== "undefined") console.warn(`[i18n] thiếu nhãn category: ${raw}`);
    const s = raw.replace(/_/g, " ");
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  return raw; // đã là tiếng Việt/human
}

// Bỏ dấu để so khớp từ khoá.
function fold(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");
}

// Điểm công vào cửa tự do (không vé) — theo category HOẶC tên.
const FREE_TOKENS = ["bridge", "park", "beach", "church", "pagoda",
  "cau ", "cong vien", "quang truong", "bien", "nha tho", "chua", "ho ", "vuon hoa"];
// Bảo tàng/khu vui chơi/thác... = có vé → KHÔNG gán miễn phí.
const TICKETED_TOKENS = ["museum", "bao tang", "khu vui choi", "thac", "vuon quoc gia", "cap treo"];

function hay(it: LabelItem): string { return fold(`${it.category ?? ""} ${it.name}`); }

export function isFreeSite(it: LabelItem): boolean {
  const h = hay(it);
  if (TICKETED_TOKENS.some((t) => h.includes(t))) return false;
  return FREE_TOKENS.some((t) => h.includes(t));
}

const MEAL_ROLES = new Set(["an-trua", "an-toi"]);

// Nhãn hiển thị gọn cho category điểm đến có dấu "/" thô (bỏ slash: "Dinh thự / Di tích" → "Di tích").
const DEST_CATEGORY_DISPLAY: Record<string, string> = {
  "Dinh thự / Di tích": "Di tích",
  "Chùa / Thiền viện": "Chùa",
  "Công viên / Vườn hoa": "Công viên",
  "Vườn quốc gia / Khu bảo tồn": "Vườn quốc gia",
  "Đền / Miếu": "Đền, miếu",
  "Núi / Đèo / Đường mòn": "Núi, đèo",
  "Hồ / Đập": "Hồ",
  "Khu du lịch giải trí (vui chơi trả phí)": "Khu vui chơi giải trí",
  "Chợ / Mua sắm": "Chợ",
  "Nông trại / Vườn": "Nông trại",
};

// Category hiển thị: điểm đến ưu tiên nhãn TRẢI NGHIỆM (từ KB); else map slash-clean; else sửa gán sai + categoryLabel.
export function displayCategory(it: LabelItem): string {
  if (it.role === "diem-den" && it.trai_nghiem) return it.trai_nghiem;
  if (it.category && DEST_CATEGORY_DISPLAY[it.category]) return DEST_CATEGORY_DISPLAY[it.category];
  const h = hay(it);
  if (h.includes("cau ") && (h.includes("rong") || h.includes("song han") || h.includes("bridge"))) return "Cầu / Điểm ngắm cảnh";
  if (h.includes("cong vien")) return "Công viên";
  if (h.includes("quang truong")) return "Quảng trường";
  return categoryLabel(it.category);
}

export type BadgeTone = "ok" | "muted";
export interface ItemBadge { label: string; tone: BadgeTone; hours?: string | null; }

// 1 badge/mục. Điểm đến có giờ → xác minh. Bữa ăn thiếu giờ → gọi trước. Điểm công → miễn phí. Còn lại → chưa xác minh.
export function itemBadge(it: LabelItem): ItemBadge {
  if (!it.goi_truoc && it.gio_mo) return { label: "Đã xác minh", tone: "ok", hours: it.gio_mo };
  if (MEAL_ROLES.has(it.role)) return { label: "Nên gọi trước", tone: "muted" };
  if (isFreeSite(it)) return { label: "Miễn phí", tone: "muted" };
  return { label: "Chưa xác minh", tone: "muted" };
}

// Tên khu từ region_id slug. Map các khu đã biết của 3 thành phố; fallback prettify (không bịa dấu).
const AREA_NAMES: Record<string, string> = {
  "trung-tam": "trung tâm",
  "trung-tam-ho-xuan-huong": "trung tâm hồ Xuân Hương",
  "tay-trung-tam": "Tây trung tâm",
  "bac-da-thien": "Bắc Đa Thiện",
  "lang-biang-lac-duong": "Langbiang - Lạc Dương",
  "dong": "phía Đông",
  "tay": "phía Tây",
  "bac": "phía Bắc",
  "nam": "phía Nam",
  "ven-bien": "ven biển",
  "son-tra": "Sơn Trà",
  "ngu-hanh-son": "Ngũ Hành Sơn",
  "hai-chau": "Hải Châu",
};
export function areaLabel(regionId: string | null | undefined): string | null {
  if (!regionId) return null;
  if (AREA_NAMES[regionId]) return AREA_NAMES[regionId];
  return null; // B1.1: slug lạ KHÔNG ra UI (tránh chữ không dấu) — card fallback về "{n} điểm"
}

// B1.2 — hạng khách sạn từ phan_khuc thô ("cao cap (quy uoc gia, KHONG phai sao)") → nhãn có dấu.
const HOTEL_TIER_LABELS: Record<string, string> = {
  "cao cap": "Hạng cao cấp",
  "trung binh": "Hạng trung",
  "trung cap": "Hạng trung",
  "binh dan": "Hạng bình dân",
  "tiet kiem": "Hạng tiết kiệm",
  "sang trong": "Hạng sang trọng",
};
export function hotelTierLabel(phanKhuc: string | null | undefined): string | null {
  if (!phanKhuc) return null;
  const key = phanKhuc.toLowerCase().split("(")[0].trim(); // bỏ phần "(quy uoc gia...)"
  for (const k in HOTEL_TIER_LABELS) if (key.startsWith(k)) return HOTEL_TIER_LABELS[k];
  return null; // không map được → ẩn (không đẩy chữ không dấu ra UI)
}

// B5.1 — nhãn tiện ích ĐẦY ĐỦ (cấm viết tắt tự chế); key lạ → ẩn.
export const FACILITY_LABELS: Record<string, string> = {
  restroom: "🚻 Nhà vệ sinh", parking: "🅿️ Bãi đỗ xe", wheelchair_access: "♿ Lối xe lăn",
  wifi: "📶 Wifi", info_desk: "ℹ️ Quầy thông tin", souvenir: "🎁 Quà lưu niệm",
};

// B5.2 — bỏ đuôi " – {city}" / " - {city}" ở TÊN hiển thị (chỉ khi đuôi là 1 thành phố đã biết).
const CITY_TEN = new Set(CITIES.map((c) => fold(c.ten)));
export function stripCitySuffix(name: string): string {
  const m = name.match(/^(.*\S)\s*[–-]\s*([^–-]+?)\s*$/u);
  if (m && CITY_TEN.has(fold(m[2]))) return m[1];
  return name;
}

// Số ĐÊM từ số ngày, kẹp >= 0: itinerary 0 ngày (thành phố không có điểm) từng render "-1 đêm". (#529)
export function nights(tripDays: number): number {
  return Math.max(0, tripDays - 1);
}

// Nhãn + emoji cho vibe slug (VIBE_VOCAB 8 giá trị) — hiển thị chip "🧗 Thiên nhiên · Mạo hiểm".
const VIBE_META: Record<string, { emoji: string; label: string }> = {
  "bien-dao": { emoji: "🏖️", label: "Biển đảo" },
  "lang-man": { emoji: "💕", label: "Lãng mạn" },
  "lich-su-van-hoa": { emoji: "🏛️", label: "Lịch sử · Văn hoá" },
  "mua-sam": { emoji: "🛍️", label: "Mua sắm" },
  "ngam-canh": { emoji: "🌄", label: "Ngắm cảnh" },
  "nong-nghiep-sinh-thai": { emoji: "🌿", label: "Sinh thái" },
  "tam-linh": { emoji: "🙏", label: "Tâm linh" },
  "thien-nhien-mao-hiem": { emoji: "🧗", label: "Thiên nhiên · Mạo hiểm" },
};

// slug → {emoji,label}; fallback prettify slug lạ (không crash, không bịa nhãn).
export function vibeChip(slug: string): { emoji: string; label: string } {
  return VIBE_META[slug] ?? { emoji: "", label: slug.replace(/-/g, " ") };
}

// "Giới thiệu nhanh" — đoạn văn FACTUAL (Stage 1: ngữ pháp prose, 0 doctrine). Dựng từ field ĐÃ CÓ:
// loại hình (category.primary + secondary) + hoạt động (hoat_dong THẬT). Dẫn xuất, KHÔNG bịa; KHÔNG câu
// audience ("phù hợp với khách…" = Rule 3 CẤM); KHÔNG paraphrase mô tả nguồn.
// Form T3 (2 câu, đọc như đoạn văn): "Đây là {loại}. Tại đây, du khách có thể {hoạt động}."
//   Vd Datanla: "Đây là thác nước kết hợp khu vui chơi. Tại đây, du khách có thể ngắm thác nước,
//   chụp ảnh cảnh quan và đi bộ khu vực quanh thác."
// Sửa 4 lỗi "chữ/label" (agent linguistics): bỏ dấu "—", thay copula "có X,Y,Z" → chủ ngữ "Đây là" +
// modal "du khách có thể", lowercase nhãn Title-Case khi chèn giữa câu, giữ "/" trong loại (nghĩa OR —
// "Chùa / Thiền viện": nguồn chưa chắc loại nào, KHÔNG đổi thành "và" = overclaim). LƯU Ý: category.secondary
// fill ~0.4% + hoat_dong = hàm của loại → đoạn này GIỐNG NHAU per-loại (khác biệt per-place cần Stage 2:
// LLM live-compose + duyệt 002-editorial-tier). Đây chỉ là bản vá ngữ pháp tạm.
export function gioiThieuNhanh(
  category: string | null | undefined,
  secondary?: string[],
  hoatDong?: { label: string }[],
): string | null {
  const primary = (category ?? "").trim();
  if (!primary) return null;
  // lowercase đầu mỗi vế quanh "/" (giữ "/" = OR), để chèn giữa câu không lộ Title-Case của field
  const lcType = (s: string): string =>
    s.split("/").map((p) => p.trim()).filter(Boolean)
      .map((t) => t.charAt(0).toLowerCase() + t.slice(1)).join("/");
  const sec = (secondary ?? [])
    .map((s) => (s ?? "").trim())
    .filter((s) => s && fold(s) !== fold(primary))
    .slice(0, 1);
  const loai = sec.length ? `${lcType(primary)} kết hợp ${lcType(sec[0])}` : lcType(primary);
  const s1 = `Đây là ${loai}.`;
  // top 3 hoạt động: bó "/" sát (nghĩa cặp gần-nghĩa), lowercase đầu để liền câu ("Ngắm cảnh" → "ngắm cảnh")
  const acts = (hoatDong ?? [])
    .map((h) => (h?.label ?? "").replace(/\s*\/\s*/g, "/").trim())
    .filter(Boolean)
    .slice(0, 3)
    .map((a) => a.charAt(0).toLowerCase() + a.slice(1));
  if (!acts.length) return s1;
  const actJoin = acts.length > 1 ? `${acts.slice(0, -1).join(", ")} và ${acts[acts.length - 1]}` : acts[0];
  return `${s1} Tại đây, du khách có thể ${actJoin}.`;
}

// Nhóm "Có gì ở đây" thành Tham quan (miễn phí) vs Trải nghiệm trả phí.
// SPEC: chỉ NHÓM lại nhãn affordance suy-theo-loại sẵn có theo TỪ trong nhãn — không claim per-place mới.
// Hướng an toàn: chỉ vào traPhi khi nhãn tự nói "trả phí/dịch vụ/tour/vé/vượt thác"; còn lại → thamQuan
// (xếp nhầm 1 trò trả phí sang Tham quan chỉ là thiếu, KHÔNG bao giờ khẳng định sai "trả phí").
// Khớp trên chuỗi ĐÃ fold (bỏ dấu, lowercase) để bền với NFC/NFD của dữ liệu KB; "ve" (vé) cần \b để
// không dính "ven" (ven hồ). fold() dùng lại helper phía trên.
const PAID_MARKER = /(tra phi|dich vu|tour|vuot thac|\bve\b)/;
export function splitHoatDong(hoat_dong: { label: string }[]): { thamQuan: string[]; traPhi: string[] } {
  const thamQuan: string[] = [], traPhi: string[] = [];
  for (const h of hoat_dong) (PAID_MARKER.test(fold(h.label)) ? traPhi : thamQuan).push(h.label);
  return { thamQuan, traPhi };
}
