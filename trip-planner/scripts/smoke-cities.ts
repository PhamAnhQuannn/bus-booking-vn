// Smoke-test mọi city trong CITIES: dựng lịch 3-ngày, báo OK/FAIL + độ dày. Chạy TRƯỚC go-live.
// Dev (đĩa): pnpm tsx trip-planner/scripts/smoke-cities.ts
// Prod-data (R2): STORAGE_STUB=false STORAGE_BUCKET=... STORAGE_ENDPOINT=... STORAGE_REGION=auto \
//                 STORAGE_ACCESS_KEY=... STORAGE_SECRET_KEY=... pnpm tsx trip-planner/scripts/smoke-cities.ts

import { buildItinerary, getStore, CITIES, type TripRequest } from "../lib/planner";

const DAYS = 3;
const PER_DAY = 2; // relaxed
const FLOOR = DAYS * PER_DAY;

function reqFor(slug: string): TripRequest {
  return { slug, days: DAYS, party: { adults: 2, children: 0, elders: 0 }, pace: "relaxed", interests: [], accessibility: {} };
}

async function main(): Promise<void> {
  let fail = 0, thin = 0;
  console.log(`Smoke ${CITIES.length} city (lịch ${DAYS} ngày, sàn ${FLOOR} điểm)\n`);
  for (const c of CITIES) {
    try {
      const it = buildItinerary(reqFor(c.slug), await getStore(c.slug));
      const dest = it.days.flatMap((d) => d.items).length;
      const res = it.restaurants.length;
      const flags: string[] = [];
      if (dest < FLOOR) { flags.push(`THƯA ${dest}/${FLOOR} điểm`); thin++; }
      if (res === 0) flags.push("0 quán ăn");
      console.log(`  OK   ${c.slug.padEnd(14)} ${it.days.length}n · ${dest} điểm · ${res} quán${flags.length ? "  ⚠ " + flags.join(", ") : ""}`);
    } catch (e) {
      fail++;
      console.log(`  FAIL ${c.slug.padEnd(14)} ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  console.log(`\n${CITIES.length - fail}/${CITIES.length} OK · ${fail} FAIL · ${thin} lịch thưa`);
  if (fail) process.exit(1);
}

main().catch((e) => { console.error("Smoke lỗi:", e); process.exit(1); });
