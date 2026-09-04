// Máy trạng thái slot TẤT ĐỊNH (client-safe) — chip điền slot KHÔNG cần Gemini.
// Gemini chỉ dùng cho free-text (trích slot 1 lần); mọi chip + build đi qua đây → $0.
// Chỉ import kiểu (type-only) — KHÔNG kéo graph server (GEMINI key) vào bundle client.

import { CITIES } from "./cities";
import type { ParsedIntent } from "./parseIntent";
import type { Pace } from "./types";

// Nhóm/ngân sách/phương tiện/ăn uống — mock active (2026-08-11). Doctrine-safe: KHÔNG bịa giá;
// nhom→preset field sẵn có; budget→pace default; food→bias nhà hàng; transport→ghi + note.
export type Nhom = "cap-doi" | "gia-dinh" | "ban-be" | "cong-tac";
export type Budget = "tiet-kiem" | "vua" | "thoai-mai";
export type Transport = "xe-khach" | "tu-lai" | "xe-may";

export interface Slots {
  dia_diem?: string; // slug thành phố (thuộc CITIES)
  days?: number;
  adults?: number;
  children?: number;
  elders?: number;
  pace?: Pace;
  interests?: string[];
  wheelchair?: boolean;
  avoidSteep?: boolean;
  anchor?: string[]; // id điểm-đến khách chọn từ gợi ý vibe (mode discovery → anchor vào lịch)
  nhom?: Nhom; // loại nhóm (preset party + bias interests/pace)
  budget?: Budget; // ngân sách HẠNG (→ pace default; KHÔNG lọc theo giá — không có data giá)
  budgetPerPerson?: number; // ngân sách SỐ (VND/người) — CHỈ hiển thị; engine KHÔNG lọc theo giá
  transport?: Transport; // phương tiện (ghi lại + note; engine không đổi routing)
  food?: string[]; // sở thích ăn uống ('dia-phuong'|'chay'|'hai-san'|'binh-dan') → bias nhà hàng
}

export interface Ask {
  slot: "dia_diem" | "thoi_luong" | "so_nguoi" | "so_thich" | "nhom" | "ngan_sach" | "phuong_tien" | "an_uong";
  prompt: string;
  options: string[]; // nhãn chip (client-gen, tất định)
  allowCustom: boolean;
}

const persons = (s: Slots): number => (s.adults ?? 0) + (s.children ?? 0) + (s.elders ?? 0);

// Đủ để dựng lịch: thành phố + số ngày + ≥1 người.
export function complete(s: Slots): boolean {
  return !!s.dia_diem && !!s.days && persons(s) > 0;
}

// Slot BẮT BUỘC còn thiếu kế tiếp + chip chuẩn. null nếu đã đủ.
export function nextAsk(s: Slots): Ask | null {
  if (!s.dia_diem)
    return { slot: "dia_diem", prompt: "Bạn muốn đi thành phố nào?", options: CITIES.map((c) => c.ten), allowCustom: false };
  if (!s.days)
    return { slot: "thoi_luong", prompt: "Chuyến đi mấy ngày?", options: ["3 ngày 2 đêm", "5 ngày", "7 ngày"], allowCustom: true };
  if (persons(s) === 0)
    // Bước "Nhóm" (mock active) — chip nhóm PRESET số người (applyChip); vẫn cho gõ số tự do.
    return { slot: "nhom", prompt: "Bạn đi theo nhóm nào?", options: ["Cặp đôi", "Gia đình", "Bạn bè", "Công tác"], allowCustom: true };
  return null;
}

// Gợi ý sở thích (tuỳ chọn) — hỏi 1 lần sau khi đủ bắt buộc, khách bỏ qua được.
export function optionalAsk(s: Slots): Ask | null {
  if (s.interests === undefined)
    return {
      slot: "so_thich",
      prompt: "Bạn thích trải nghiệm gì? (có thể bỏ qua)",
      options: ["Ngắm cảnh", "Tâm linh", "Lịch sử - văn hoá", "Lãng mạn", "Sống ảo", "Thư giãn", "Bỏ qua"],
      allowCustom: false,
    };
  return null;
}

// Câu hỏi/picker cho các slot mới (dùng cho group-card + filter chips ở mock active).
export function groupAsk(): Ask {
  return { slot: "nhom", prompt: "Bạn đi theo nhóm nào?", options: ["Cặp đôi", "Gia đình", "Bạn bè", "Công tác"], allowCustom: false };
}
export function budgetAsk(): Ask {
  return { slot: "ngan_sach", prompt: "Ngân sách của bạn?", options: ["Tiết kiệm", "Vừa phải", "Thoải mái"], allowCustom: false };
}
export function transportAsk(): Ask {
  return { slot: "phuong_tien", prompt: "Phương tiện di chuyển?", options: ["Xe khách", "Tự lái", "Xe máy"], allowCustom: false };
}
export function foodAsk(): Ask {
  return { slot: "an_uong", prompt: "Bạn thích ăn uống kiểu nào?", options: ["Món địa phương", "Chay", "Hải sản", "Bình dân"], allowCustom: false };
}

const NHOM_LABEL: Record<string, Nhom> = { "Cặp đôi": "cap-doi", "Gia đình": "gia-dinh", "Bạn bè": "ban-be", "Công tác": "cong-tac" };
const BUDGET_LABEL: Record<string, Budget> = { "Tiết kiệm": "tiet-kiem", "Vừa phải": "vua", "Thoải mái": "thoai-mai" };
const TRANSPORT_LABEL: Record<string, Transport> = { "Xe khách": "xe-khach", "Tự lái": "tu-lai", "Xe máy": "xe-may" };
const FOOD_LABEL: Record<string, string> = { "Món địa phương": "dia-phuong", Chay: "chay", "Hải sản": "hai-san", "Bình dân": "binh-dan" };
// budget → pace mặc định (khi khách chưa chọn pace): tiết kiệm ít điểm/ngày, thoải mái nhiều hơn.
export const BUDGET_PACE: Record<Budget, Pace> = { "tiet-kiem": "relaxed", vua: "moderate", "thoai-mai": "packed" };

// Nhãn chip hiển thị → mã vibe (VIBE_VOCAB trong ./vibes). Giữ đồng bộ với optionalAsk.options.
const INTEREST_LABEL: Record<string, string> = {
  "Ngắm cảnh": "ngam-canh",
  "Tâm linh": "tam-linh",
  "Lịch sử - văn hoá": "lich-su-van-hoa",
  "Lãng mạn": "lang-man",
  "Sống ảo": "song-ao-chup-hinh",
  "Thư giãn": "thu-gian-yen-tinh",
};

// Preset party + accessibility theo loại nhóm (dùng chung: chip 'nhom' LẪN bóc free-text).
// KHÔNG tự thêm sở thích hiển thị (bỏ auto 'lang-man' cũ) — suy diễn chỉ NGẦM cho engine (avoidSteep),
// không hiện như chip sở thích người dùng đã nói.
export function withGroup(s: Slots, g: Nhom): Slots {
  const n: Slots = { ...s, nhom: g };
  if (persons(n) === 0) {
    if (g === "cap-doi") n.adults = 2;
    else if (g === "gia-dinh") { n.adults = 2; n.children = 2; }
    else if (g === "ban-be") n.adults = 4;
    else n.adults = 1; // công tác
  }
  if (g === "gia-dinh") n.avoidSteep = n.avoidSteep ?? true; // trẻ nhỏ → ưu tiên ít dốc (ngầm)
  return n;
}

// Số slot BẮT BUỘC còn thiếu (điểm đến / số ngày / ≥1 người) — cho copy phễu "còn N câu hỏi".
export function missingRequired(s: Slots): number {
  return (s.dia_diem ? 0 : 1) + (s.days ? 0 : 1) + (persons(s) > 0 ? 0 : 1);
}

const NHOM_KEYWORDS: [RegExp, Nhom][] = [
  [/c[aặ]p đôi|người yêu|2 đứa|hai đứa|honeymoon|tr[aă]ng m[aậ]t/i, "cap-doi"],
  [/gia đình|bố mẹ|ba mẹ|vợ con|con nhỏ|con cái|cả nhà|đưa con/i, "gia-dinh"],
  [/b[aạ]n bè|nhóm bạn|đám bạn|hội bạn|với bạn/i, "ban-be"],
  [/công tác|đồng nghiệp|công ty|team building|đi team/i, "cong-tac"],
];

// Từ khóa sở thích → mã vibe (ca-phe/am-thuc là mã DISPLAY-only ngoài VIBE_VOCAB — engine bỏ qua).
// Khớp trên text CÓ DẤU (VN keyboard mặc định có dấu) → ít false-positive.
const INTEREST_KEYWORDS: [RegExp, string][] = [
  [/cà phê|cafe|café|quán xá|coffee/i, "ca-phe"],
  [/ẩm thực|ăn uống|đồ ăn|đồ nướng|hải sản|đặc sản|ăn ngon|ăn vặt/i, "am-thuc"],
  [/chụp ảnh|sống ảo|check.?in|check in/i, "song-ao-chup-hinh"],
  [/biển|đảo/i, "bien-dao"],
  [/núi|trekking|leo núi|phượt|mạo hiểm|thác|hang động/i, "thien-nhien-mao-hiem"],
  [/văn hoá|văn hóa|lịch sử|di tích|bảo tàng/i, "lich-su-van-hoa"],
  [/chùa|tâm linh|đền thờ|nhà thờ|thiền/i, "tam-linh"],
  [/nghỉ dưỡng|thư giãn|yên tĩnh|relax|resort|chill/i, "thu-gian-yen-tinh"],
  [/mua sắm|shopping|chợ đêm/i, "mua-sam"],
  [/cảnh đẹp|ngắm cảnh|hoàng hôn|thiên nhiên|view/i, "ngam-canh"],
  [/lãng mạn|hẹn hò|honeymoon/i, "lang-man"],
];

const foldVi = (s: string): string => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");
const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Tên thành phố ngắn (≤4 ký tự sau fold, VD "hue"/"vinh") dễ khớp nhầm vào từ khác chứa nó
// ("hoa huệ", "vinh danh") — chỉ nhận khi câu có tín hiệu ý định du lịch rõ ràng.
const TRAVEL_INTENT_RE = /(đi|tới|đến|về|thăm|ghé|tại|du lịch|ở\s|khám phá)/;

// Sở thích từ free-text: scan keyword → mã; cụm trong "thích …" chưa khớp → LITERAL (không drop im lặng).
function extractInterests(text: string): string[] {
  const t = text.toLowerCase();
  const codes = new Set<string>();
  for (const [re, code] of INTEREST_KEYWORDS) if (re.test(t)) codes.add(code);
  const m = t.match(/(?:thích|ưa thích|muốn|quan tâm|sở thích|mê|đam mê)\s+(.+)/i);
  if (m) {
    const clause = m[1].split(/[.!?\n]/)[0];
    for (const raw of clause.split(/\s*(?:,|;|&|\bvà\b|\bcùng\b|\bvới\b)\s*/)) {
      const ph = raw.trim().replace(/^(đi|các|những|thêm)\s+/, "");
      if (!ph || ph.length > 24 || /\d/.test(ph)) continue;
      if (INTEREST_KEYWORDS.some(([re]) => re.test(ph))) continue; // đã có mã
      if (CITIES.some((c) => ph.includes(c.ten.toLowerCase()))) continue; // là tên thành phố
      codes.add(ph); // LITERAL (chữ user, có dấu) — SlotSummaryCard hiển thị viết-hoa + warn
    }
  }
  return [...codes];
}

// Bóc TẤT ĐỊNH từ free-text (client) — bù Gemini (budget-số/nhóm không có trong schema) + mount shell SỚM
// (dia_diem/days) + đảm bảo interest không rơi. Gọi optimistic lúc gửi VÀ sau Gemini (applyExtracted, idempotent).
export function extractFromText(text: string): Partial<Slots> {
  const out: Partial<Slots> = {};
  const t = text.toLowerCase();
  const ft = foldVi(text);
  for (const [re, g] of NHOM_KEYWORDS) { if (re.test(t)) { out.nhom = g; break; } }
  // điểm đến: match tên CITIES (không dấu) có biên (tránh khớp giữa từ khác, VD "hoa huệ" → "huệ"),
  // ưu tiên tên DÀI nhất (tránh khớp nhầm 1 phần); tên ngắn (≤4) cần thêm tín hiệu ý định du lịch.
  const city = [...CITIES]
    .sort((a, b) => b.ten.length - a.ten.length)
    .find((c) => {
      const folded = foldVi(c.ten);
      const bounded = new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(folded)}(?:$|[^a-z0-9])`).test(ft);
      if (!bounded) return false;
      if (folded.length <= 4 && !TRAVEL_INTENT_RE.test(t)) return false;
      return true;
    });
  if (city) out.dia_diem = city.slug;
  // số ngày: "N ngày" (1..7)
  const dm = t.match(/(\d+)\s*ng[àa]y/);
  if (dm) { const d = parseInt(dm[1], 10); if (d >= 1 && d <= 7) out.days = d; }
  // số người: "N người/khách/đứa/thành viên" (không phải "N ngày"); "khách" loại trừ "khách sạn".
  const pm = t.match(/(\d+)\s*(người|khách(?!\s*sạn)|đứa|thành viên)\b/);
  if (pm) out.adults = Math.max(parseInt(pm[1], 10), 1);
  // ngân sách số: "<số> triệu/tr/củ/k/nghìn/ngàn/đồng" → VND/người. \b là ASCII-only nên đơn vị ngắn
  // (tr/k) khớp nhầm từ có dấu ("2 trẻ", "3 trái", "500 ký") → dùng biên Unicode-aware (?!\p{L}).
  const bm = t.match(/(\d+(?:[.,]\d+)?)\s*(triệu|tr|củ|k|nghìn|ngàn|đồng|vnđ|vnd)(?!\p{L})/iu);
  if (bm) {
    const num = parseFloat(bm[1].replace(",", "."));
    const unit = bm[2].toLowerCase();
    let vnd = num;
    if (/^(triệu|tr|củ)$/.test(unit)) vnd = num * 1_000_000;
    else if (/^(k|nghìn|ngàn)$/.test(unit)) vnd = num * 1_000;
    if (vnd >= 100_000) out.budgetPerPerson = Math.round(vnd);
  }
  const interests = extractInterests(text);
  if (interests.length) out.interests = interests;
  return out;
}

// Áp Partial bóc tất định vào Slots: nhóm → preset party (withGroup); còn lại gán/union.
export function applyExtracted(s: Slots, det: Partial<Slots>): Slots {
  let n: Slots = { ...s };
  if (det.dia_diem) n.dia_diem = det.dia_diem;
  if (det.days != null) n.days = det.days;
  if (det.adults != null) { n.adults = det.adults; n.children = n.children ?? 0; n.elders = n.elders ?? 0; }
  if (det.budgetPerPerson != null) n.budgetPerPerson = det.budgetPerPerson;
  if (det.interests?.length) n.interests = [...new Set([...(n.interests ?? []), ...det.interests])]; // union dedup
  if (det.nhom) n = persons(n) === 0 ? withGroup(n, det.nhom) : { ...n, nhom: det.nhom };
  return n;
}

// Chip/custom → cập nhật Slots TẤT ĐỊNH (không Gemini).
export function applyChip(s: Slots, slot: Ask["slot"], label: string): Slots {
  const n: Slots = { ...s };
  const t = label.trim();
  switch (slot) {
    case "dia_diem": {
      const city = CITIES.find((c) => c.ten === t) ?? CITIES.find((c) => c.slug === t.toLowerCase());
      if (city) n.dia_diem = city.slug;
      break;
    }
    case "thoi_luong": {
      const m = t.match(/(\d+)\s*ng[àa]y/i) ?? t.match(/(\d+)/);
      if (m) n.days = Math.min(Math.max(parseInt(m[1], 10), 1), 7);
      break;
    }
    case "so_nguoi": {
      const m = t.match(/(\d+)/);
      n.adults = m ? Math.max(parseInt(m[1], 10), 1) : 2;
      n.children = n.children ?? 0;
      n.elders = n.elders ?? 0;
      break;
    }
    case "so_thich": {
      if (t.toLowerCase().includes("bỏ qua")) {
        n.interests = n.interests ?? [];
        break;
      }
      const v = INTEREST_LABEL[t] ?? t.toLowerCase();
      n.interests = [...(n.interests ?? []), v];
      break;
    }
    case "nhom": {
      const g = NHOM_LABEL[t];
      if (!g) {
        // custom (allowCustom): gõ số người tự do → set party trực tiếp (giữ hành vi so_nguoi cũ).
        const m = t.match(/(\d+)/);
        if (m) { n.adults = Math.max(parseInt(m[1], 10), 1); n.children = n.children ?? 0; n.elders = n.elders ?? 0; }
        break;
      }
      return withGroup(n, g); // preset party + accessibility ngầm (KHÔNG tự thêm sở thích hiển thị)
    }
    case "ngan_sach": {
      const b = BUDGET_LABEL[t];
      if (b) n.budget = b;
      break;
    }
    case "phuong_tien": {
      const tr = TRANSPORT_LABEL[t];
      if (tr) n.transport = tr;
      break;
    }
    case "an_uong": {
      const f = FOOD_LABEL[t] ?? t.toLowerCase();
      n.food = [...new Set([...(n.food ?? []), f])];
      break;
    }
  }
  return n;
}

// Trộn intent Gemini trích được (free-text) vào Slots — chỉ ghi đè field có giá trị.
export function mergeIntent(s: Slots, p: Partial<ParsedIntent>): Slots {
  const n: Slots = { ...s };
  if (p.dia_diem) n.dia_diem = p.dia_diem;
  if (typeof p.days === "number" && p.days > 0) n.days = p.days;
  if (typeof p.adults === "number") n.adults = p.adults;
  if (typeof p.children === "number") n.children = p.children;
  if (typeof p.elders === "number") n.elders = p.elders;
  if (p.pace) n.pace = p.pace;
  if (Array.isArray(p.interests) && p.interests.length) n.interests = p.interests;
  if (typeof p.wheelchair === "boolean") n.wheelchair = p.wheelchair;
  if (typeof p.avoidSteep === "boolean") n.avoidSteep = p.avoidSteep;
  return n;
}

// Slots → query string cho /api/planner/itinerary (engine, $0). Default hợp lý.
export function slotsToParams(s: Slots): string {
  const q = new URLSearchParams();
  if (s.dia_diem) q.set("slug", s.dia_diem);
  if (s.days) q.set("days", String(s.days));
  q.set("adults", String(s.adults ?? 2));
  q.set("children", String(s.children ?? 0));
  q.set("elders", String(s.elders ?? 0));
  if (s.pace) q.set("pace", s.pace);
  if (s.wheelchair) q.set("wheelchair", "1");
  if (s.avoidSteep) q.set("avoidSteep", "1");
  if (s.interests?.length) q.set("interests", s.interests.join(","));
  if (s.anchor?.length) q.set("anchors", s.anchor.join(","));
  if (s.budget) q.set("budget", s.budget);
  if (s.budgetPerPerson) q.set("budgetPerPerson", String(s.budgetPerPerson)); // engine bỏ qua — chỉ round-trip/hiển thị
  if (s.transport) q.set("transport", s.transport);
  if (s.food?.length) q.set("food", s.food.join(","));
  return q.toString();
}
