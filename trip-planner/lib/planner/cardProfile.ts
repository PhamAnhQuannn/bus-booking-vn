// Card profile — CHỈ THỊ RENDER theo loại điểm (không phải claim). Suy từ category.primary + heuristic tên.
// Cùng hạng doctrine với hoat_dong/trai_nghiem: KHÔNG source_id, không khẳng định gì về nơi cụ thể —
// chỉ quyết định SECTION nào của thẻ được phép hiện cho loại đó (tránh "trò trả phí" trên điểm ngắm cảnh,
// tránh bullet "tham quan di tích" generic trên 1 cây cầu). Section vẫn ẩn khi field rỗng.

export type Cluster =
  | 'waterfall_lake' | 'adventure' | 'viewpoint' | 'cave' | 'heritage'
  | 'religious' | 'market' | 'beach' | 'park' | 'landmark' | 'general';

// Thứ tự trong mảng = thứ tự render. 'mo_ta'|'hoat_dong'|'vibes'|'cach_trung_tam' render được ngay;
// 'paid_activity'|'environment' là slot forward-compat (no-op tới khi field có trên DtoItem).
export type SectionKey = 'mo_ta' | 'hoat_dong' | 'paid_activity' | 'environment' | 'vibes' | 'cach_trung_tam';

// 19 category.primary (đo trên toàn corpus) → cụm.
const CARD_PROFILE: Record<string, Cluster> = {
  'Thác nước': 'waterfall_lake',
  'Hồ / Đập': 'waterfall_lake',
  'Khu vui chơi': 'adventure',
  'Khu du lịch giải trí (vui chơi trả phí)': 'adventure',
  'Điểm ngắm cảnh': 'viewpoint',
  'Núi / Đèo / Đường mòn': 'viewpoint',
  'Vườn quốc gia / Khu bảo tồn': 'viewpoint',
  'Hang động': 'cave',
  'Bảo tàng': 'heritage',
  'Dinh thự / Di tích': 'heritage', // landmark tách qua heuristic tên (cầu/quảng trường…)
  'Chùa / Thiền viện': 'religious',
  'Nhà thờ': 'religious',
  'Đền / Miếu': 'religious',
  'Chợ / Mua sắm': 'market',
  'Bãi biển': 'beach',
  'Đảo': 'beach',
  'Công viên / Vườn hoa': 'park',
  'Nông trại / Vườn': 'general',
  'Điểm tham quan': 'general', // catch-all lớn nhất
};

const SECTIONS: Record<Cluster, SectionKey[]> = {
  waterfall_lake: ['mo_ta', 'hoat_dong', 'environment', 'vibes', 'cach_trung_tam'],
  adventure: ['mo_ta', 'hoat_dong', 'paid_activity', 'vibes', 'cach_trung_tam'],
  viewpoint: ['mo_ta', 'hoat_dong', 'environment', 'vibes', 'cach_trung_tam'],
  cave: ['mo_ta', 'hoat_dong', 'vibes', 'cach_trung_tam'],
  heritage: ['mo_ta', 'hoat_dong', 'vibes', 'cach_trung_tam'],
  religious: ['mo_ta', 'hoat_dong', 'vibes', 'cach_trung_tam'],
  market: ['mo_ta', 'hoat_dong', 'vibes', 'cach_trung_tam'],
  beach: ['mo_ta', 'hoat_dong', 'environment', 'vibes', 'cach_trung_tam'],
  park: ['mo_ta', 'hoat_dong', 'vibes', 'cach_trung_tam'],
  // landmark (cầu/quảng trường hiện đại): BỎ hoat_dong — bullet "tham quan di tích" generic sai cho cây cầu.
  landmark: ['mo_ta', 'vibes', 'cach_trung_tam'],
  general: ['mo_ta', 'hoat_dong', 'vibes', 'cach_trung_tam'],
};

// "Dinh thự / Di tích" gộp cả di tích cổ lẫn công trình đô thị hiện đại (Cầu Rồng, Cầu Sông Hàn, quảng
// trường). category không tách được → dùng heuristic tên để route sang landmark.
const LANDMARK_NAME = /(^|\s)(cầu|quảng trường|phố đi bộ)\s/i;

export function cardProfile(category: string | null, name: string): { cluster: Cluster; sections: SectionKey[] } {
  let cluster: Cluster = (category && CARD_PROFILE[category]) || 'general';
  if (cluster === 'heritage' && LANDMARK_NAME.test(` ${name} `)) cluster = 'landmark';
  return { cluster, sections: SECTIONS[cluster] };
}
