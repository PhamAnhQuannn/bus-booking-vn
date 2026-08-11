// Golden trip: chứng minh engine E2E. Mặc định Đà Lạt; slug qua argv cho city khác.
// Chạy: pnpm tsx trip-planner/scripts/golden-trip.ts [slug]   (từ gốc repo)
// In lịch trình + kiểm: mọi mục có source_ids (0 dòng bịa). Mask SĐT khi in.

import { buildItinerary } from "../lib/planner/plan";
import type { SlotItem, TripRequest } from "../lib/planner/types";

const req: TripRequest = {
  slug: process.argv[2] ?? "da-lat",
  days: 3,
  party: { adults: 2, children: 0, elders: 1 },
  pace: "relaxed",
  interests: ["ngam-canh", "tam-linh"], // slug hợp lệ (VIBE_VOCAB) — để test khớp vibe scoring
  accessibility: { avoidSteep: true },
};

const mask = (s: string | null) => (s ? "<sđt>" : "—");
const it = buildItinerary(req);

console.log(`\n=== GOLDEN TRIP: ${req.days} ngày ${req.slug} · nhịp ${req.pace} · ${req.party.elders} người lớn tuổi ===`);
console.log(`(dữ liệu: ${it.generated_from})\n`);

const BUOI: Record<string, string> = { sang: "Sáng", trua: "Trưa", chieu: "Chiều", toi: "Tối" };
for (const d of it.days) {
  console.log(`── Ngày ${d.day}  [khu vực: ${d.region_id ?? "?"}] ──`);
  for (const i of d.items as SlotItem[]) {
    const gio = i.goi_truoc ? "gọi trước" : i.gio_mo;
    console.log(
      `  ${BUOI[i.buoi].padEnd(6)} ${i.role.padEnd(9)} ${i.name}  ` +
        `[${i.category ?? "?"}] giờ:${gio}  sđt:${mask(i.phone)}  ` +
        `nguồn:${i.source_ids.length}  ngày:${i.ngay_du_lieu ?? "?"}`,
    );
  }
  console.log("");
}
if (it.hotel) {
  console.log(`🏨 Khách sạn: ${it.hotel.name}  ${it.hotel.note ?? ""}  sđt:${mask(it.hotel.phone)}  nguồn:${it.hotel.source_ids.length}`);
}
if (it.restaurants.length) {
  console.log("\n🍜 Gợi ý quán ăn (không trong timeline):");
  it.restaurants.forEach((r) => console.log(`  - ${r.name}  [${r.category ?? "?"}]  giờ:${r.goi_truoc ? "gọi trước" : r.gio_mo}  sđt:${mask(r.phone)}  nguồn:${r.source_ids.length}`));
}
console.log("\nGhi chú:");
it.notes.forEach((n) => console.log("  - " + n));

// ── Kiểm ─────────────────────────────────────────────────────────────────
const allItems = [...it.days.flatMap((d) => d.items), ...(it.hotel ? [it.hotel] : []), ...it.restaurants];
const unsourced = allItems.filter((i) => !i.source_ids || i.source_ids.length === 0);
const noCoord = it.days.flatMap((d) => d.items).filter((i) => i.lat == null);
console.log("\n=== KIỂM ===");
console.log(`  tổng mục: ${allItems.length}  | không nguồn: ${unsourced.length}  | thiếu toạ độ: ${noCoord.length}`);
if (unsourced.length) {
  console.log("  !!! CÓ DÒNG KHÔNG NGUỒN:", unsourced.map((i) => i.name));
  process.exit(1);
}
console.log("  OK — mọi mục truy về nguồn dữ liệu.");

// ── Kiểm MẠCH LẠC ĐỊA LÝ (chống zig-zag) ─────────────────────────────────
import { haversine } from "../lib/planner/store";
const km = (a: SlotItem, b: SlotItem) => haversine(a.lat!, a.lon!, b.lat!, b.lon!) / 1000;
let zz = 0;
console.log("\n=== KIỂM MẠCH LẠC ===");
for (const d of it.days) {
  const dd = (d.items as SlotItem[]).filter((i) => i.role === "diem-den" && i.lat != null);
  // (a) HARD: mọi ngày >=1 điểm đến
  if (dd.length === 0) { console.log(`  !!! Ngày ${d.day} KHÔNG có điểm đến`); zz++; continue; }
  // (b) HARD: không quay lại khu đã rời (region re-entry)
  const seq = dd.map((i) => i.region_id ?? "?");
  const runs = seq.filter((r, i) => i === 0 || r !== seq[i - 1]);       // gộp run liên tiếp
  const distinct = new Set(seq).size;
  if (runs.length !== distinct) { console.log(`  !!! Ngày ${d.day} zig-zag khu: ${seq.join(" → ")}`); zz++; }
  // (c) HARD: leg lệch (bắt zig-zag trong 1 khu). Đo trên leg liên tiếp (route-leg, không diameter
  // 2D) nên không false-fail corridor. Ngưỡng max(3*median, 3)km.
  if (dd.length >= 3) {
    const legs = dd.slice(1).map((_, i) => km(dd[i], dd[i + 1]));
    const med = [...legs].sort((a, b) => a - b)[Math.floor(legs.length / 2)];
    const mx = Math.max(...legs);
    if (mx > Math.max(3 * med, 3)) { console.log(`  !!! Ngày ${d.day} leg dài ${mx.toFixed(1)}km (median ${med.toFixed(1)}km) — zig-zag trong khu`); zz++; }
  }
}
if (zz) { console.log(`  !!! ${zz} lỗi mạch lạc địa lý`); process.exit(1); }
console.log("  OK — mỗi ngày một khu, không quay đầu.");

// ── KIỂM CHỌN (compactness-at-selection) ─────────────────────────────────
// Địa lý PHẢI vào bước CHỌN: >1 ngày có centroid cách xa trọng tâm chuyến = lịch phân tán liên-cụm
// (bug "2 đầu thành phố"). Cho phép ĐÚNG 1 ngày xa (marquee có ngày riêng); >=2 ngày xa = FAIL.
const SELECT_CAP_KM = 12;
console.log("\n=== KIỂM CHỌN (compact) ===");
const dayCentroids = it.days
  .map((d) => (d.items as SlotItem[]).filter((i) => i.role === "diem-den" && i.lat != null))
  .filter((dd) => dd.length > 0)
  .map((dd) => ({ lat: dd.reduce((s, i) => s + i.lat!, 0) / dd.length, lon: dd.reduce((s, i) => s + i.lon!, 0) / dd.length }));
if (dayCentroids.length >= 2) {
  const tc = { lat: dayCentroids.reduce((s, c) => s + c.lat, 0) / dayCentroids.length, lon: dayCentroids.reduce((s, c) => s + c.lon, 0) / dayCentroids.length };
  const far = dayCentroids.filter((c) => haversine(tc.lat, tc.lon, c.lat, c.lon) / 1000 > SELECT_CAP_KM).length;
  if (far > 1) { console.log(`  !!! ${far} ngày cách trọng tâm >${SELECT_CAP_KM}km — lịch phân tán liên-cụm`); process.exit(1); }
  console.log(`  OK — lịch compact (${far} ngày xa/${dayCentroids.length}, cho phép <=1 marquee).`);
} else console.log("  OK — 1 ngày, không xét phân tán.");

// ── KIỂM ANCHOR (E1 force-include) ───────────────────────────────────────
// Điểm khách chọn (mode vibe) PHẢI vào lịch dù engine mặc định bỏ nó — không tạo ngày rỗng, không phá compact.
import { loadStore } from "../lib/planner/store";
console.log("\n=== KIỂM ANCHOR (E1) ===");
const _store = loadStore(req.slug);
const _baseIds = new Set(it.days.flatMap((d) => (d.items as SlotItem[]).filter((i) => i.role === "diem-den").map((i) => i.id)));
// chọn điểm BỊ BỎ gần trọng tâm nhất (tất định) làm anchor -> chứng minh force-include không phá compact.
const _tc = { lat: dayCentroids.reduce((s, c) => s + c.lat, 0) / (dayCentroids.length || 1), lon: dayCentroids.reduce((s, c) => s + c.lon, 0) / (dayCentroids.length || 1) };
const _omitted = _store.destinations
  .filter((d) => d.coordinates?.latitude != null && !_baseIds.has(d.id))
  .map((d) => ({ d, km: haversine(_tc.lat, _tc.lon, d.coordinates.latitude, d.coordinates.longitude) / 1000 }))
  .sort((a, b) => a.km - b.km || (a.d.id < b.d.id ? -1 : 1))[0]?.d;
if (!_omitted) {
  console.log("  (bỏ qua — mọi điểm đã trong lịch mặc định)");
} else {
  const it2 = buildItinerary({ ...req, anchors: [_omitted.id] }, _store);
  const inc = new Set(it2.days.flatMap((d) => (d.items as SlotItem[]).map((i) => i.id)));
  if (!inc.has(_omitted.id)) { console.log(`  !!! anchor ${_omitted.name} (${_omitted.id}) KHÔNG vào lịch`); process.exit(1); }
  if (it2.days.some((d) => (d.items as SlotItem[]).filter((i) => i.role === "diem-den").length === 0)) { console.log("  !!! anchor tạo ngày rỗng"); process.exit(1); }
  const dcs = it2.days
    .map((d) => (d.items as SlotItem[]).filter((i) => i.role === "diem-den" && i.lat != null))
    .filter((dd) => dd.length)
    .map((dd) => ({ lat: dd.reduce((s, i) => s + i.lat!, 0) / dd.length, lon: dd.reduce((s, i) => s + i.lon!, 0) / dd.length }));
  if (dcs.length >= 2) {
    const tc2 = { lat: dcs.reduce((s, c) => s + c.lat, 0) / dcs.length, lon: dcs.reduce((s, c) => s + c.lon, 0) / dcs.length };
    const far2 = dcs.filter((c) => haversine(tc2.lat, tc2.lon, c.lat, c.lon) / 1000 > SELECT_CAP_KM).length;
    if (far2 > 1) { console.log(`  !!! anchor làm ${far2} ngày xa (>1)`); process.exit(1); }
  }
  console.log(`  OK — anchor ${_omitted.name} (${_omitted.id}) force-include; không ngày rỗng; compact giữ.`);
}
