/* eslint-disable @typescript-eslint/no-explicit-any -- dev audit tooling, raw JSON shapes */
// Per-city regression: buildItinerary qua days 1/2/3 × pace relaxed/moderate/packed → assert không throw,
// lịch non-empty, và flagship (signatureSpots[0], hoặc auto-marquee rank-0) CÓ mặt khi days>=2.
// Chạy từ gốc:  pnpm tsx trip-planner/scripts/verify_city.ts <slug> [<slug> ...]
import { buildItinerary } from "../lib/planner/plan";
import * as fs from "node:fs";

const AR = JSON.parse(fs.readFileSync("trip-planner/lib/planner/areas.json", "utf-8"));
const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[đĐ]/g, "d").toLowerCase().replace(/\s+/g, " ").trim();

function flagship(slug: string): string | null {
  const sig = AR.provinces?.[slug]?.signatureSpots || AR.areas?.find((a: any) => a.slug === slug)?.signatureSpots;
  return sig?.length ? fold(sig[0]) : null; // null = auto-marquee city (không kiểm flagship cứng)
}

const PACES = ["relaxed", "moderate", "packed"] as const;
let fail = 0;
for (const slug of process.argv.slice(2)) {
  const fs0 = flagship(slug);
  let combos = 0, flagHits = 0, flagChecks = 0;
  const problems: string[] = [];
  for (const days of [1, 2, 3])
    for (const pace of PACES) {
      combos++;
      try {
        const it = buildItinerary({ slug, days, party: { adults: 2 }, pace } as any);
        const names = it.days.flatMap((d) => (d.items as any[]).filter((i) => i.role === "diem-den").map((i) => fold(i.name)));
        if (names.length === 0) problems.push(`${days}d/${pace}: EMPTY`);
        if (fs0 && days >= 2) {
          flagChecks++;
          if (names.some((n) => (fs0.length >= 5 && n.includes(fs0)) || (n.length >= 5 && fs0.includes(n)))) flagHits++;
          else problems.push(`${days}d/${pace}: flagship "${fs0}" MISSING`);
        }
      } catch (e: any) {
        problems.push(`${days}d/${pace}: THROW ${e?.message?.slice(0, 50)}`);
      }
    }
  const ok = problems.length === 0;
  if (!ok) fail++;
  console.log(`${slug}: ${combos}/9 combos${fs0 ? ` · flagship ${flagHits}/${flagChecks}` : " (auto-marquee)"} ${ok ? "OK" : "FAIL"}`);
  for (const p of problems) console.log("   - " + p);
}
process.exit(fail ? 1 : 0);
