// Registry thành phố khả dụng của planner — single source cho selector (wizard), header (result),
// và allowlist (chat). Slug PHẢI khớp thư mục export `tourism-kb/export/<slug>/` và `dia_diem_config.py`
// phía Python. Thêm thành phố = thêm 1 dòng đây + đảm bảo export/<slug>/ tồn tại.

export interface City {
  slug: string;
  ten: string;
}

// Curated 20 đơn vị city chặt (r80≤60km, n≥20, có OSRM matrix hoặc đô thị đặc; bỏ bản merger trùng +
// tỉnh sáp nhập mega + tỉnh thin). Bản CŨ curate cho flagship (routed + sạch). Thêm tỉnh = thêm 1 dòng
// + đảm bảo export/<slug>/ tồn tại. Xem plan wire 2026-08-09.
export const CITIES: City[] = [
  { slug: "da-lat", ten: "Đà Lạt" },
  { slug: "nha-trang", ten: "Nha Trang" },
  { slug: "da-nang", ten: "Đà Nẵng" },
  { slug: "ha-noi", ten: "Hà Nội" },
  { slug: "ho-chi-minh", ten: "Hồ Chí Minh" },
  { slug: "hue", ten: "Huế" },
  { slug: "hai-phong", ten: "Hải Phòng" },
  { slug: "ninh-binh", ten: "Ninh Bình" },
  { slug: "can-tho", ten: "Cần Thơ" },
  { slug: "bac-ninh", ten: "Bắc Ninh" },
  { slug: "phu-tho", ten: "Phú Thọ" },
  { slug: "thai-nguyen", ten: "Thái Nguyên" },
  { slug: "tuyen-quang", ten: "Tuyên Quang" },
  { slug: "lao-cai", ten: "Lào Cai" },
  { slug: "dong-thap", ten: "Đồng Tháp" },
  { slug: "vinh-long", ten: "Vĩnh Long" },
  // City-unit tách từ tỉnh MEGA (split_city.py) — geography chặt (maxDaySpan≤37km), kế thừa OSRM matrix.
  { slug: "phu-quoc", ten: "Phú Quốc" },
  { slug: "quy-nhon", ten: "Quy Nhơn" },
  { slug: "ha-long", ten: "Hạ Long" },
  { slug: "vung-tau", ten: "Vũng Tàu" },
  { slug: "dong-hoi", ten: "Đồng Hới" },
  { slug: "tuy-hoa", ten: "Tuy Hòa" },
  { slug: "chau-doc", ten: "Châu Đốc" },
  { slug: "dong-ha", ten: "Đông Hà" },
  { slug: "mong-cai", ten: "Móng Cái" },
  { slug: "van-don", ten: "Vân Đồn" },
  { slug: "mui-ca-mau", ten: "Mũi Cà Mau" },
  { slug: "tay-ninh-tp", ten: "Tây Ninh" },
  { slug: "sa-pa", ten: "Sa Pa" }, // tách từ lao-cai (mega sáp nhập) — lọc theo khu hành chính, bỏ TP Lào Cai
  { slug: "ba-be", ten: "Ba Bể" }, // hồ Ba Bể (Bắc Kạn→Thái Nguyên) — lõi tự nhiên chặt (median 6km, max 20km), golden 3 ngày OK
  // Hub city-unit carve từ tỉnh phủ=0 (split_city.py, density-probe 2026-08-24) — đầy đủ OSRM matrix.
  { slug: "dien-bien-phu", ten: "Điện Biên Phủ" }, // di tích chiến dịch (Đồi A1, Him Lam, Mường Phăng) — 18 điểm
  { slug: "dong-van", ten: "Đồng Văn" }, // cao nguyên đá Hà Giang (Nhà của Pao, Dinh Vua Mèo, Lũng Cẩm) — 14 điểm
  { slug: "vinh", ten: "Vinh" }, // Vinh + Nam Đàn (Làng Sen quê Bác, Thành cổ, Bãi Lữ) — 11 điểm
  { slug: "cao-bang-tp", ten: "Cao Bằng" }, // TP Cao Bằng + karst (Mã Phục, Thăng Hen, Núi Thủng) — 14 điểm
  { slug: "thanh-hoa-tp", ten: "Thanh Hóa" }, // TP Thanh Hóa (Hàm Rồng, làng nghề, đền chùa) — 31 điểm
];
// Bỏ tay-ninh(111km)/thanh-hoa(94)/cao-bang(89): smoke lộ 1 ngày span >80km (lịch loạn) — chờ engine
// tune outlier hoặc tách city con. ho-chi-minh/hai-phong/vinh-long giữ (60-70km = tầm day-trip chấp nhận).
// Bỏ ca-mau-tp (3-ngày ra 1 ngày/1 điểm = lịch rỗng) + hung-yen (chỉ 2 ngày/3 điểm): data điểm-đến
// quá thưa — chờ bổ sung điểm rồi thêm lại. Guard isCitySlug -> 404 lịch sự nếu ai gọi trực tiếp.

export const CITY_SLUGS: string[] = CITIES.map((c) => c.slug);
const _TEN = new Map(CITIES.map((c) => [c.slug, c.ten]));

// Tên hiển thị của slug; fallback "Đà Lạt" cho slug lạ (khớp default engine).
export function cityName(slug: string | null | undefined): string {
  return (slug && _TEN.get(slug)) || "Đà Lạt";
}

// Slug hợp lệ (thuộc allowlist) hay không.
export function isCitySlug(slug: string | null | undefined): boolean {
  return !!slug && _TEN.has(slug);
}
