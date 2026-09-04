// Xuất dữ liệu guide (engine + KB, KHÔNG LLM) cho 9 thành phố → guide-data.json để build docx.
// Chạy:  pnpm tsx trip-planner/scripts/guide-export.ts   (từ gốc repo; cần export local)
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildItinerary } from "../lib/planner/plan";
import { filterVibes } from "../lib/planner/vibes";
import type { SlotItem, TripRequest } from "../lib/planner/types";

const P = (adults: number, children = 0, elders = 0) => ({ adults, children, elders });
interface Scenario { slug: string; ten: string; cauHoi: string; req: TripRequest; }

// 9 tp (Đà Lạt giữ nguyên section gốc trong file). days = 1 phương án/tp.
const SC: Scenario[] = [
  { slug: "nha-trang", ten: "NHA TRANG", cauHoi: "Nha Trang 2 ngày — biển, đảo & VinWonders",
    req: { slug: "nha-trang", days: 2, party: P(2), pace: "moderate", interests: ["bien-dao"] } },
  { slug: "da-nang", ten: "ĐÀ NẴNG", cauHoi: "Đà Nẵng 3 ngày — Bà Nà, biển & bán đảo",
    req: { slug: "da-nang", days: 3, party: P(2, 2), pace: "moderate", interests: ["bien-dao", "ngam-canh"] } },
  { slug: "ha-long", ten: "HẠ LONG", cauHoi: "Hạ Long 2 ngày — vịnh & đảo",
    req: { slug: "ha-long", days: 2, party: P(2), pace: "moderate", interests: ["bien-dao", "ngam-canh"] } },
  { slug: "phu-quoc", ten: "PHÚ QUỐC", cauHoi: "Phú Quốc 3 ngày — nghỉ biển gia đình",
    req: { slug: "phu-quoc", days: 3, party: P(2, 1), pace: "relaxed", interests: ["bien-dao"] } },
  { slug: "sa-pa", ten: "SA PA", cauHoi: "Sa Pa 2 ngày — núi & thiên nhiên",
    req: { slug: "sa-pa", days: 2, party: P(2, 0, 1), pace: "relaxed", interests: ["ngam-canh", "thien-nhien-mao-hiem"], accessibility: { avoidSteep: true } } },
  { slug: "hue", ten: "HUẾ", cauHoi: "Huế 2 ngày — văn hoá lịch sử",
    req: { slug: "hue", days: 2, party: P(2), pace: "moderate", interests: ["lich-su-van-hoa"] } },
  { slug: "ninh-binh", ten: "NINH BÌNH", cauHoi: "Ninh Bình 2 ngày — danh thắng thiên nhiên",
    req: { slug: "ninh-binh", days: 2, party: P(2), pace: "moderate", interests: ["ngam-canh", "thien-nhien-mao-hiem"] } },
  { slug: "ha-noi", ten: "HÀ NỘI", cauHoi: "Hà Nội 3 ngày — phố cổ & di tích",
    req: { slug: "ha-noi", days: 3, party: P(2), pace: "moderate", interests: ["lich-su-van-hoa"] } },
  { slug: "ho-chi-minh", ten: "TP. HỒ CHÍ MINH", cauHoi: "TP.HCM 2 ngày — city break",
    req: { slug: "ho-chi-minh", days: 2, party: P(2), pace: "packed", interests: [] } },
];

const BUOI: Record<string, string> = { sang: "Sáng", trua: "Trưa", chieu: "Chiều", toi: "Tối" };

function tagline(i: SlotItem): string {
  const parts = [i.category, i.trai_nghiem, ...(i.vibes ?? [])].filter(Boolean) as string[];
  const seen = new Set<string>();
  const uniq = parts.filter((p) => { const k = p.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
  return uniq.map((p) => p.toUpperCase()).join(" · ").slice(0, 120);
}

const out = SC.map((s) => {
  const req = { ...s.req, interests: s.req.interests ? filterVibes(s.req.interests) : undefined };
  const it = buildItinerary(req);
  const party = `${it.request.party.adults} người lớn${it.request.party.children ? ` · ${it.request.party.children} trẻ` : ""}${it.request.party.elders ? ` · ${it.request.party.elders} lớn tuổi` : ""}`;

  const days = it.days.map((d) => ({
    day: d.day,
    region: d.region_id ?? null,
    rows: (d.items as SlotItem[]).filter((i) => i.role === "diem-den").map((i) => ({
      buoi: BUOI[i.buoi] ?? i.buoi,
      ten: i.name,
      loai: [i.category, i.trai_nghiem !== i.category ? i.trai_nghiem : null].filter(Boolean).join(" · "),
      ghi_chu: i.leg_from_prev ? `Cách mục trước ~${Math.round(i.leg_from_prev.km * 10) / 10}km` : "",
    })),
  }));

  // Cards = điểm-đến xuất hiện trong lịch (dedup theo tên), lấy field KB thật.
  const seen = new Set<string>();
  const cards: Record<string, unknown>[] = [];
  for (const d of it.days) for (const i of d.items as SlotItem[]) {
    if (i.role !== "diem-den" || seen.has(i.name)) continue;
    seen.add(i.name);
    cards.push({
      ten: i.name.toUpperCase(),
      tagline: tagline(i),
      gioi_thieu: i.gioi_thieu || i.mo_ta || null,
      hoat_dong: (i.hoat_dong ?? []).map((h) => h.label),
      gio_mo: i.goi_truoc ? null : i.gio_mo,
      gia_ve: i.gia_ve || null,
      loi_vao_dac_trung: i.loi_vao_dac_trung || null,
      phu_hop: i.phu_hop_voi || (i.vibes && i.vibes.length ? i.vibes.join(", ") : null),
      nguon: i.source_ids?.length ?? 0,
    });
  }

  return {
    slug: s.slug, ten: s.ten, cauHoi: s.cauHoi,
    meta: `${it.request.days} ngày · nhịp ${it.request.pace} · ${party}`,
    generated_from: it.generated_from,
    days, cards,
    notes: it.notes,
    hotel: it.hotel ? it.hotel.name : null,
  };
});

const dest = resolve(process.cwd(), "trip-planner", "scripts", "guide-data.json");
writeFileSync(dest, JSON.stringify(out, null, 1), "utf-8");
for (const c of out) console.log(`OK ${c.slug}: ${c.days.length} ngày, ${c.cards.length} card`);
console.log(`→ ghi ${dest}`);
