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

// Category hiển thị: điểm đến ưu tiên nhãn TRẢI NGHIỆM (từ KB); else sửa gán sai landmark + categoryLabel.
export function displayCategory(it: LabelItem): string {
  if (it.role === "diem-den" && it.trai_nghiem) return it.trai_nghiem;
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
  return regionId.replace(/-/g, " "); // fallback: bỏ gạch nối (không tự thêm dấu)
}
