// Dựng TripRequest từ query params (dùng chung cho API route, PDF route, page RSC).
// Có default hợp lý để /lich-trinh không tham số vẫn ra 1 lịch trình mẫu.

import type { Pace, TripRequest } from "./types";
import { filterVibes } from "./vibes";

const PACES: Pace[] = ["relaxed", "moderate", "packed"];

function int(v: string | null, def: number): number {
  const n = v == null ? NaN : parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : def;
}

const BUDGETS = ["tiet-kiem", "vua", "thoai-mai"] as const;
const TRANSPORTS = ["xe-khach", "tu-lai", "xe-may"] as const;
const FOODS = ["dia-phuong", "chay", "hai-san", "binh-dan"];
// budget → pace mặc định khi khách CHƯA chọn pace tường minh (đồng bộ slots.BUDGET_PACE).
const BUDGET_PACE: Record<string, Pace> = { "tiet-kiem": "relaxed", vua: "moderate", "thoai-mai": "packed" };

export function requestFromParams(sp: URLSearchParams): TripRequest {
  const pace = (sp.get("pace") ?? "") as Pace;
  const days = Math.min(Math.max(int(sp.get("days"), 3), 1), 7);
  // anchors = id điểm khách chọn; dedupe + cap <= days (bound cost + tránh nhồi far-anchor phá compact).
  const anchors = [...new Set((sp.get("anchors") || "").split(",").map((s) => s.trim()).filter(Boolean))].slice(0, days);
  const budget = BUDGETS.includes((sp.get("budget") ?? "") as (typeof BUDGETS)[number]) ? (sp.get("budget") as TripRequest["budget"]) : undefined;
  const transport = TRANSPORTS.includes((sp.get("transport") ?? "") as (typeof TRANSPORTS)[number]) ? (sp.get("transport") as TripRequest["transport"]) : undefined;
  const food = (sp.get("food") || "").split(",").map((s) => s.trim()).filter((f) => FOODS.includes(f));
  // pace tường minh thắng; else suy từ budget; else moderate.
  const resolvedPace: Pace = PACES.includes(pace) ? pace : budget ? BUDGET_PACE[budget] : "moderate";
  return {
    slug: sp.get("slug") || "da-lat",
    days,
    party: {
      adults: int(sp.get("adults"), 2),
      children: int(sp.get("children"), 0),
      elders: int(sp.get("elders"), 0),
    },
    pace: resolvedPace,
    interests: filterVibes((sp.get("interests") || "").split(",")),
    accessibility: {
      wheelchair: sp.get("wheelchair") === "1",
      avoidSteep: sp.get("avoidSteep") === "1",
    },
    anchors,
    budget,
    transport,
    food: food.length ? food : undefined,
  };
}

// Từ một plain object (Next searchParams đã await) -> URLSearchParams.
export function toURLSearchParams(obj: Record<string, string | string[] | undefined>): URLSearchParams {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    sp.set(k, Array.isArray(v) ? v[0] ?? "" : v);
  }
  return sp;
}
