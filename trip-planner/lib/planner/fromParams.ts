// Dựng TripRequest từ query params (dùng chung cho API route, PDF route, page RSC).
// Có default hợp lý để /lich-trinh không tham số vẫn ra 1 lịch trình mẫu.

import type { Pace, TripRequest } from "./types";

const PACES: Pace[] = ["relaxed", "moderate", "packed"];

function int(v: string | null, def: number): number {
  const n = v == null ? NaN : parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : def;
}

export function requestFromParams(sp: URLSearchParams): TripRequest {
  const pace = (sp.get("pace") ?? "") as Pace;
  return {
    slug: sp.get("slug") || "da-lat",
    days: Math.min(Math.max(int(sp.get("days"), 3), 1), 7),
    party: {
      adults: Math.max(int(sp.get("adults"), 2), 1), // >=1 người lớn (không "0 người")
      children: int(sp.get("children"), 0),
      elders: int(sp.get("elders"), 0),
    },
    pace: PACES.includes(pace) ? pace : "moderate",
    interests: (sp.get("interests") || "").split(",").map((s) => s.trim()).filter(Boolean),
    accessibility: {
      wheelchair: sp.get("wheelchair") === "1",
      avoidSteep: sp.get("avoidSteep") === "1",
    },
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
