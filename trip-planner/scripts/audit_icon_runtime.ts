/* eslint-disable @typescript-eslint/no-explicit-any -- dev audit tooling, raw JSON shapes */
// Eval harness — icon-runtime: buildItinerary mỗi tp → signatureSpots có SURFACE trong lịch không.
// Phân biệt 3 trạng thái mỗi icon: SURFACE (lên lịch) · IN-DATA (có record, không lên lịch) · ABSENT (thiếu record).
// Chạy TỪ gốc repo:  pnpm tsx trip-planner/scripts/audit_icon_runtime.ts [slug ...]
import * as fs from "node:fs";
import * as path from "node:path";
import { buildItinerary } from "../lib/planner/plan";

const AR = JSON.parse(fs.readFileSync("trip-planner/lib/planner/areas.json", "utf-8"));
const sigmap: Record<string, string[]> = {};
for (const [, v] of Object.entries<any>(AR))
  if (v && typeof v === "object" && !Array.isArray(v))
    for (const [slug, val] of Object.entries<any>(v))
      if (val?.signatureSpots) sigmap[slug] = val.signatureSpots;
for (const a of AR.areas || []) if (a.slug && a.signatureSpots) sigmap[a.slug] = a.signatureSpots;

const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[đĐ]/g, "d").toLowerCase().replace(/\s+/g, " ").trim();
// icon khớp record nếu tên record chứa icon HOẶC icon chứa tên record (2 chiều — tránh "Cát Cát"⊄"bản cát cát")
const match = (icon: string, name: string) => {
  const a = fold(icon), b = fold(name);
  return b.includes(a) || a.includes(b);
};

const DEFAULT: [string, number, string[]][] = [
  ["ha-noi", 3, ["lich-su-van-hoa"]], ["hue", 2, ["lich-su-van-hoa"]],
  ["ninh-binh", 3, ["ngam-canh", "thien-nhien-mao-hiem"]], ["phu-quoc", 3, ["bien-dao"]],
  ["da-lat", 3, ["ngam-canh"]], ["da-nang", 3, ["bien-dao", "ngam-canh"]],
  ["ha-long", 2, ["bien-dao", "ngam-canh"]], ["vung-tau", 2, ["bien-dao"]],
  ["nha-trang", 2, ["bien-dao"]], ["sa-pa", 2, ["ngam-canh", "thien-nhien-mao-hiem"]],
];

function loadNames(slug: string): string[] {
  const p = path.join("tourism-kb", "export", slug, "diem-den.json");
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, "utf-8")).map((r: any) => r.name || "");
}

// arg = slug (dùng cấu hình DEFAULT nếu có; else days=3, interests=[]). Cho phép test slug bất kỳ (mọi 61 unit).
const args = process.argv.slice(2);
const cases: [string, number, string[]][] = args.length
  ? args.map((s) => DEFAULT.find((c) => c[0] === s) ?? ([s, 3, []] as [string, number, string[]]))
  : DEFAULT;

for (const [slug, days, interests] of cases) {
  const sigs = sigmap[slug] || [];
  if (!sigs.length) { console.log(`\n== ${slug} — (no signatureSpots) ==`); continue; }
  const it = buildItinerary({ slug, days, party: { adults: 2 }, pace: "moderate", interests } as any);
  const inPlan: string[] = [];
  for (const d of it.days) for (const i of (d.items as any[])) if (i.role === "diem-den") inPlan.push(i.name);
  const allNames = loadNames(slug);
  const surface: string[] = [], inData: string[] = [], absent: string[] = [];
  for (const s of sigs) {
    if (inPlan.some((nm) => match(s, nm))) surface.push(s);
    else if (allNames.some((nm) => match(s, nm))) inData.push(s);
    else absent.push(s);
  }
  console.log(`\n== ${slug} (${days}d) — surface ${surface.length}/${sigs.length} · in-data ${inData.length} · ABSENT ${absent.length} ==`);
  console.log("  SURFACE:", surface.join(", ") || "(none)");
  if (inData.length) console.log("  in-data (buried):", inData.join(", "));
  if (absent.length) console.log("  ABSENT (missing record):", absent.join(", "));
}
