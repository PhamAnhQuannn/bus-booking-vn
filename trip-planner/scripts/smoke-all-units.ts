/* eslint-disable @typescript-eslint/no-explicit-any -- dev audit tooling, raw JSON shapes */
// Cross-city regression: buildItinerary cho MỌI export unit (61+), không chỉ 35 slug live trong cities.ts.
// Bắt regression ở các unit "dark" (đúng class bug Vũng Tàu). Chạy sau MỌI đổi plan.ts/store.ts/
// split_city.py/export_planner.py/dia_diem_config.py.  Chạy từ gốc:  pnpm tsx trip-planner/scripts/smoke-all-units.ts
import { buildItinerary } from "../lib/planner/plan";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = "tourism-kb/export";
const slugs = fs
  .readdirSync(ROOT)
  .filter((s) => fs.existsSync(path.join(ROOT, s, "diem-den.json")))
  .sort();

let ok = 0, thin = 0, fail = 0;
const fails: string[] = [];
for (const slug of slugs) {
  try {
    const it = buildItinerary({ slug, days: 3, party: { adults: 2 }, pace: "relaxed" } as any);
    const pts = it.days.reduce((s, d) => s + (d.items as any[]).filter((i) => i.role === "diem-den").length, 0);
    if (pts === 0) { fail++; fails.push(`${slug}: EMPTY`); }
    else if (pts < 3) { thin++; console.log(`  thin: ${slug} (${pts} điểm)`); ok++; }
    else ok++;
  } catch (e: any) {
    fail++; fails.push(`${slug}: ${e?.message?.slice(0, 70)}`);
  }
}
console.log(`\n${slugs.length} units: ok=${ok} (thin=${thin}) FAIL=${fail}`);
for (const f of fails) console.log("  FAIL " + f);
process.exit(fail ? 1 : 0);
