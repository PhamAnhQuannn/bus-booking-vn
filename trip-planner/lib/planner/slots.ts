// Máy trạng thái slot TẤT ĐỊNH (client-safe) — chip điền slot KHÔNG cần Gemini.
// Gemini chỉ dùng cho free-text (trích slot 1 lần); mọi chip + build đi qua đây → $0.
// Chỉ import kiểu (type-only) — KHÔNG kéo graph server (GEMINI key) vào bundle client.

import { CITIES } from "./cities";
import type { ParsedIntent } from "./parseIntent";
import type { Pace } from "./types";

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
}

export interface Ask {
  slot: "dia_diem" | "thoi_luong" | "so_nguoi" | "so_thich";
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
    return { slot: "so_nguoi", prompt: "Đi mấy người?", options: ["2 người", "Gia đình 4 người", "Nhóm bạn 6 người"], allowCustom: true };
  return null;
}

// Gợi ý sở thích (tuỳ chọn) — hỏi 1 lần sau khi đủ bắt buộc, khách bỏ qua được.
export function optionalAsk(s: Slots): Ask | null {
  if (s.interests === undefined)
    return {
      slot: "so_thich",
      prompt: "Bạn thích trải nghiệm gì? (có thể bỏ qua)",
      options: ["Ngắm cảnh", "Tâm linh", "Lịch sử - văn hoá", "Vui chơi", "Ẩm thực", "Bỏ qua"],
      allowCustom: false,
    };
  return null;
}

const INTEREST_LABEL: Record<string, string> = {
  "Ngắm cảnh": "ngắm cảnh",
  "Tâm linh": "tâm linh",
  "Lịch sử - văn hoá": "lịch sử",
  "Vui chơi": "vui chơi",
  "Ẩm thực": "ăn uống",
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
  return q.toString();
}
