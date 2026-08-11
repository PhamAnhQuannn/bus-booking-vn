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
  budget?: Budget; // ngân sách (→ pace default; KHÔNG lọc theo giá — không có data giá)
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
      n.nhom = g;
      // Preset party nếu khách chưa nhập số người; bias interests/accessibility (dùng field engine sẵn có).
      if (persons(n) === 0) {
        if (g === "cap-doi") { n.adults = 2; }
        else if (g === "gia-dinh") { n.adults = 2; n.children = 2; }
        else if (g === "ban-be") { n.adults = 4; }
        else { n.adults = 1; } // công tác
      }
      if (g === "cap-doi" && !(n.interests ?? []).includes("lang-man")) n.interests = [...(n.interests ?? []), "lang-man"];
      if (g === "gia-dinh") n.avoidSteep = n.avoidSteep ?? true; // đi cùng trẻ nhỏ → ưu tiên ít dốc
      break;
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
  if (s.transport) q.set("transport", s.transport);
  if (s.food?.length) q.set("food", s.food.join(","));
  return q.toString();
}
