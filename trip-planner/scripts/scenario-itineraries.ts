/* eslint-disable @typescript-eslint/no-explicit-any -- dev audit tooling, raw JSON shapes */
// Sinh FILE TESTING: chạy engine (buildItinerary, KHÔNG UI, KHÔNG LLM) cho 10 thành phố du lịch nổi
// tiếng, mỗi tp một "câu hỏi lịch trình" scenario khác nhau → ghi trip-planner/scenario-itineraries.md.
// Chạy:  pnpm tsx trip-planner/scripts/scenario-itineraries.ts   (từ gốc repo; cần export local)
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildItinerary } from "../lib/planner/plan";
import { filterVibes } from "../lib/planner/vibes";
import type { Itinerary, SlotItem, TripRequest } from "../lib/planner/types";

interface Scenario {
  slug: string;
  cauHoi: string; // câu hỏi tiếng Việt (tài liệu — engine nhận TripRequest trực tiếp, không qua LLM)
  req: TripRequest;
}

const P = (adults: number, children = 0, elders = 0) => ({ adults, children, elders });

const SCENARIOS: Scenario[] = [
  { slug: "nha-trang", cauHoi: "Đi Nha Trang 1 ngày, muốn có VinWonders (cáp treo ra đảo)",
    req: { slug: "nha-trang", days: 1, party: P(2), pace: "moderate", interests: ["bien-dao"] } },
  { slug: "da-nang", cauHoi: "Đà Nẵng 3 ngày, gia đình 2 con nhỏ, thích Bà Nà + biển",
    req: { slug: "da-nang", days: 3, party: P(2, 2), pace: "moderate", interests: ["bien-dao", "ngam-canh"] } },
  { slug: "da-lat", cauHoi: "Đà Lạt 2 ngày cặp đôi, ngắm cảnh sống ảo",
    req: { slug: "da-lat", days: 2, party: P(2), pace: "relaxed", interests: ["ngam-canh", "song-ao-chup-hinh"] } },
  { slug: "sa-pa", cauHoi: "Sa Pa 2 ngày, thích núi + thiên nhiên, đi cùng người lớn tuổi",
    req: { slug: "sa-pa", days: 2, party: P(2, 0, 1), pace: "relaxed", interests: ["ngam-canh", "thien-nhien-mao-hiem"], accessibility: { avoidSteep: true } } },
  { slug: "ha-long", cauHoi: "Hạ Long 2 ngày, vịnh + đảo",
    req: { slug: "ha-long", days: 2, party: P(2), pace: "moderate", interests: ["bien-dao", "ngam-canh"] } },
  { slug: "phu-quoc", cauHoi: "Phú Quốc 3 ngày nghỉ biển gia đình",
    req: { slug: "phu-quoc", days: 3, party: P(2, 1), pace: "relaxed", interests: ["bien-dao"] } },
  { slug: "hue", cauHoi: "Huế 2 ngày, văn hoá lịch sử",
    req: { slug: "hue", days: 2, party: P(2), pace: "moderate", interests: ["lich-su-van-hoa"] } },
  { slug: "ninh-binh", cauHoi: "Ninh Bình 1 ngày, danh thắng thiên nhiên",
    req: { slug: "ninh-binh", days: 1, party: P(2), pace: "packed", interests: ["ngam-canh", "thien-nhien-mao-hiem"] } },
  { slug: "ha-noi", cauHoi: "Hà Nội 3 ngày, phố cổ + di tích (tp không có hand-list → auto-marquee)",
    req: { slug: "ha-noi", days: 3, party: P(2), pace: "moderate", interests: ["lich-su-van-hoa"] } },
  { slug: "ho-chi-minh", cauHoi: "TP.HCM 2 ngày city break (tp nhiều điểm nhất)",
    req: { slug: "ho-chi-minh", days: 2, party: P(2), pace: "packed", interests: [] } },
];

const BUOI: Record<string, string> = { sang: "Sáng", trua: "Trưa", chieu: "Chiều", toi: "Tối" };
const ROLE: Record<string, string> = { "diem-den": "điểm đến", "an-trua": "ăn trưa", "an-toi": "ăn tối", "khach-san": "khách sạn" };
const km1 = (n: number) => (Math.round(n * 10) / 10).toString().replace(".", ",");

function render(s: Scenario, it: Itinerary, idx: number): { md: string; unsourced: number } {
  const L: string[] = [];
  const party = `${it.request.party.adults} người lớn${it.request.party.children ? ` · ${it.request.party.children} trẻ` : ""}${it.request.party.elders ? ` · ${it.request.party.elders} lớn tuổi` : ""}`;
  L.push(`## ${idx}. ${s.slug} — "${s.cauHoi}"`);
  L.push("");
  L.push(`> **Yêu cầu:** ${it.request.days} ngày · nhịp ${it.request.pace} · ${party}` +
    `${it.request.interests?.length ? ` · sở thích: ${it.request.interests.join(", ")}` : ""}` +
    `${it.request.accessibility?.avoidSteep ? " · tránh dốc" : ""}`);
  L.push(`> _(dữ liệu: ${it.generated_from})_`);
  L.push("");

  let unsourced = 0;
  for (const d of it.days) {
    L.push(`### Ngày ${d.day}${d.region_id ? `  ·  khu: ${d.region_id}` : ""}`);
    for (const i of d.items as SlotItem[]) {
      const parts = [`**${BUOI[i.buoi] ?? i.buoi}**`, ROLE[i.role] ?? i.role, `**${i.name}**`];
      if (i.category) parts.push(`[${i.category}]`);
      if (i.loi_vao_dac_trung) parts.push(`🚡 ${i.loi_vao_dac_trung}`);
      if (i.leg_from_prev) parts.push(`⏱ ${i.leg_from_prev.minutes}′/${km1(i.leg_from_prev.km)}km`);
      const n = i.source_ids?.length ?? 0;
      parts.push(`📄 ${n} nguồn`);
      if (!n) unsourced++;
      L.push(`- ${parts.join(" · ")}`);
    }
    L.push("");
  }
  if (it.hotel) L.push(`🏨 **Khách sạn:** ${it.hotel.name}${it.hotel.note ? ` (${it.hotel.note})` : ""}`);
  if (it.restaurants.length) L.push(`🍜 **Gợi ý quán:** ${it.restaurants.slice(0, 5).map((r) => r.name).join(" · ")}`);
  if (it.notes.length) {
    L.push("");
    L.push("**Ghi chú engine:**");
    const drop = it.notes.filter((n) => n.includes("ngoài vùng thuận tiện"));
    const other = it.notes.filter((n) => !n.includes("ngoài vùng thuận tiện"));
    for (const n of drop.slice(0, 4)) L.push(`- ${n}`);
    if (drop.length > 4) L.push(`- _…+${drop.length - 4} cụm khác ngoài vùng thuận tiện (rút gọn)_`);
    for (const n of other) L.push(`- ${n}`);
  }
  const total = it.days.reduce((a, d) => a + d.items.length, 0);
  L.push("");
  L.push(`✅ **Kiểm:** ${total} mục · ${unsourced} mục không nguồn${unsourced ? " ⚠️" : ""}`);
  L.push("");
  L.push("---");
  L.push("");
  return { md: L.join("\n"), unsourced };
}

const out: string[] = [];
out.push("# Scenario lịch trình — 10 thành phố (engine test, không UI/LLM)");
out.push("");
out.push(`_Sinh ${new Date().toISOString().slice(0, 10)} bằng \`buildItinerary\` (deterministic, không LLM). ` +
  `Mỗi thành phố một câu hỏi/scenario khác nhau. **Data:** export local hiện có — importance-reorder + ` +
  `\`loi_vao_dac_trung\` (cáp treo) mới áp cho nha-trang; 9 tp còn lại chạy trên data hiện tại (rebuild export để ` +
  `showcase đầy đủ)._`);
out.push("");
out.push("## ⚠️ Phát hiện chính (test lộ ra)");
out.push("");
out.push("- **Nha-trang 1 ngày ✅**: fix cáp treo hoạt động — ngày biển/đảo có VinWonders (🚡 nhãn cáp treo).");
out.push("- **Ha-noi 3 ngày ❌ REGRESSION**: lịch toàn chùa ngoại thành (Chùa Thầy ~20km tây), **bỏ phố cổ/" +
  "Hoàn Kiếm**. Nguyên nhân: Phase 3 auto-marquee ghim top-K theo `destRank`=thứ tự-mảng, mà ha-noi export " +
  "CHƯA reorder importance → 4 record đầu mảng là chùa ngoại thành → seed sai. **Auto-marquee cần export đã " +
  "reorder (kèm popularity); trên data thô nó GHIM tuỳ tiện → hại tp lớn không hand-list.** Cần gate auto-marquee.");
out.push("- 9 tp chưa reorder → importance/auto-marquee ở mức nền hoặc hại (ha-noi/hcm). Rebuild export trước khi deploy plan.ts.");
out.push("");

let totalUnsourced = 0;
for (let i = 0; i < SCENARIOS.length; i++) {
  const s = SCENARIOS[i];
  const req = { ...s.req, interests: s.req.interests ? filterVibes(s.req.interests) : undefined };
  try {
    const it = buildItinerary(req);
    const { md, unsourced } = render(s, it, i + 1);
    totalUnsourced += unsourced;
    out.push(md);
    console.log(`OK  ${s.slug}: ${it.days.length} ngày, ${it.days.reduce((a, d) => a + d.items.length, 0)} mục`);
  } catch (e) {
    out.push(`## ${i + 1}. ${s.slug} — "${s.cauHoi}"\n\n⚠️ LỖI: ${(e as Error).message}\n\n---\n`);
    console.log(`ERR ${s.slug}: ${(e as Error).message}`);
  }
}

const dest = resolve(process.cwd(), "trip-planner", "scenario-itineraries.md");
writeFileSync(dest, out.join("\n"), "utf-8");
console.log(`\n→ ghi ${dest}  (${totalUnsourced} mục không nguồn tổng)`);
