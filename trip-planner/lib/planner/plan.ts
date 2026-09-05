// Planner deterministic (V1, không LLM): request + store -> itinerary theo BUỔI.
// MẠCH LẠC ĐỊA LÝ: mỗi ngày = một khu (cụm region kề nhau), route vòng từ khách sạn, bữa ăn nằm
// trên tuyến. Điểm outlier xa (vd Bà Nà ~40km) được ngày RIÊNG hoặc loại — không nhét lẻ (chống zig-zag).
// Nhà hàng/khách sạn theo THỨ TỰ ẢNH HƯỞNG (VQS nội bộ), guard địa lý; KHÔNG in điểm/số (QĐ 2026-08-05).

import type { DayPlan, Itinerary, KbDestinationExt, KbRecord, PlaceRef, SlotItem, TripRequest } from "./types";
import { driveMinutes, haversine, loadStore, toPlaceRef, type Store } from "./store";
import AREAS from "./areas.json";

const PER_DAY: Record<TripRequest["pace"], number> = { relaxed: 2, moderate: 3, packed: 4 };
const ASSUMED_SPEED_KMH = 25; // đổi km -> phút cho leg không có ma trận OSRM (khách sạn/nhà hàng)
const MARQUEE_CARD_MAX = 2;   // region <=2 điểm + xa => outlier marquee (Bà Nà)
const FAR_FACTOR = 2;         // "xa" = khoảng cách region->tâm > 2x trung vị
const IMPORTANCE_W = 1.0;     // trần bonus importance cộng vào scoreDestination (thang ~0–6). KB ship
                              // record theo THỨ TỰ importance (diem_quan_trong.sap_xep) -> array index =
                              // rank; top nhận +IMPORTANCE_W, cuối +0. Bonus chảy vào cap-survival + seed.
const AUTO_MARQUEE_K = 4;     // Phase 3: slug KHÔNG có signatureSpots hand-list -> auto-marquee top-K
                              // theo importance (force-include như hand-list). Phủ 17/35 tp trước không có.
// Compactness-at-selection (chọn theo cụm, quality trong cụm): dừng gộp cụm khi bước "nhảy cụm".
const GAP_FACTOR = 2;         // bước thêm cụm > 2x trung vị các bước trước = nhảy cụm
const ABS_GAP_KM = 8;         // sàn tuyệt đối: hop nội-thành nhỏ, cross-cụm lớn (tránh dừng nhầm ở n bước ít)
const MIN_JOINS_FOR_GAP = 2;  // cần >=2 bước trước khi cho phép gap-stop tương đối (median ổn định)

type LL = { lat: number; lon: number };
const co = (r: KbRecord): LL => ({ lat: r.coordinates.latitude, lon: r.coordinates.longitude });
const kmBetween = (a: LL, b: LL): number => haversine(a.lat, a.lon, b.lat, b.lon) / 1000;

// Khu HÀNH CHÍNH thật (phường/xã/thị trấn) trích từ địa chỉ — khoá gom cụm ngày. Trước đây gom theo
// region_id (một HƯỚNG LA BÀN tính từ tâm tỉnh, KHÔNG phải ranh giới hành chính) nên với tỉnh sáp nhập
// mega, hai thị xã cách nhau ~20km rơi chung một octant -> chung một ngày (vd Sa Pa + TP Lào Cai). Ward
// bảo đảm mỗi cụm chặt về địa lý; growCompact lo việc gộp/loại cụm kề theo khoảng cách. Địa chỉ lồng
// "Xã A, Phường B" -> lấy token ĐẦU (cụ thể nhất) = "Xã A" (đồng nhất record chỉ ghi "Xã A"). city KHÔNG
// dùng (rác sáp nhập: điểm Lào Cai ghi city="Yên Bái"). Không parse được -> null (rơi về region_id).
const WARD_RE = /^(Phường|Xã|Thị trấn)\s+\S/;
function adminKey(r: KbRecord): string | null {
  const full = r.address?.full_address;
  if (!full) return null;
  for (const seg of full.split(",")) {
    const s = seg.trim();
    if (WARD_RE.test(s)) return s.toLowerCase();
  }
  return null;
}
const dynamicCapKm = (spanKm: number): number => Math.min(Math.max(spanKm * 0.6, 5), 10);
const clampInt = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);

// FAME-aware seed (AREA_REGISTRY): với tỉnh sáp nhập mega, seed cụm theo mass (số điểm nhiều dữ liệu)
// chọn NHẦM tỉnh-lỵ thay vì thị xã du lịch (tỉnh-lỵ lắm POI hành chính). Chấm FAME = cụm có điểm khớp
// tên điểm-nổi-tiếng (signatureSpots của slug trong areas.json) → growCompact seed FAME trước, mass sau.
// Slug ngoài registry → fameSpots rỗng → fame=0 mọi cụm → hành vi cũ (mass) giữ nguyên.
const foldText = (s: string): string =>
  (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[đĐ]/g, "d").toLowerCase();
const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Word-boundary substring check (mirror slots.ts city-match): fame token ngắn (5 ký tự) dễ khớp GIỮA
// một từ khác không liên quan — vd fame "hoa lu" (Hoa Lư) khớp nhầm giữa "Khách sạn Hoa Luxury" (chuỗi
// con "hoa lu" nằm lọt trong "Hoa Luxury", không phải ranh giới từ). Biên = đầu/cuối chuỗi hoặc ký tự
// không phải chữ/số (folded text chỉ còn a-z0-9 + khoảng trắng).
function boundedIncludes(haystack: string, needle: string): boolean {
  if (!needle) return false;
  return new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(needle)}(?:$|[^a-z0-9])`).test(haystack);
}

function fameSpotsForSlug(slug: string): string[] {
  const out: string[] = [];
  const prov = (AREAS.provinces as Record<string, { signatureSpots?: string[] }>)[slug];
  if (prov?.signatureSpots) out.push(...prov.signatureSpots);
  for (const a of AREAS.areas as Array<{ slug?: string; signatureSpots?: string[] }>)
    if (a.slug === slug && a.signatureSpots) out.push(...a.signatureSpots);
  return out.map(foldText);
}
// TRỌNG SỐ nổi tiếng của cụm = độ ưu tiên CAO NHẤT trong các điểm khớp signatureSpots. signatureSpots
// xếp theo độ nổi tiếng GIẢM DẦN (spot[0] = biểu tượng nhất của khu) → khớp sớm = trọng số cao (len-i).
// 0 nếu không khớp. (fold + substring 2 chiều, guard >=5 ký tự tránh nhiễu.) Dùng để seed ngày theo
// độ nổi tiếng: "đi Nha Trang" → cụm VinWonders (spot[0]) seed trước cụm Tháp Bà (spot sau).
export function regFame(pts: KbRecord[], fameSpots: string[]): number {
  if (!fameSpots.length) return 0;
  let best = 0;
  for (const p of pts) {
    const nm = foldText(p.name);
    for (let i = 0; i < fameSpots.length; i++) {
      const s = fameSpots[i];
      if ((s.length >= 5 && boundedIncludes(nm, s)) || (nm.length >= 5 && boundedIncludes(s, nm))) { best = Math.max(best, fameSpots.length - i); break; }
    }
  }
  return best;
}

function meanLL(pts: LL[]): LL {
  const n = pts.length || 1;
  return { lat: pts.reduce((s, p) => s + p.lat, 0) / n, lon: pts.reduce((s, p) => s + p.lon, 0) / n };
}
function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function spanKm(pts: LL[]): number {
  let mx = 0;
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) mx = Math.max(mx, kmBetween(pts[i], pts[j]));
  return mx;
}
// ── chấm điểm (thuần chất lượng, không địa lý) ──────────────────────────────
function scoreDestination(rec: KbRecord, req: TripRequest): number {
  const d: KbDestinationExt = rec.ext?.destination ?? {};
  let s = 0;
  if (rec.description?.value) s += 2;
  if (d.opening_hours?.regular_schedule?.length) s += 1;
  if ((rec.source_ids?.length ?? 0) >= 5) s += 1;
  if (req.accessibility?.wheelchair && d.facilities?.wheelchair_access) s += 3;
  const prom = d.environment?.prominence_m;
  if ((req.party.elders > 0 || req.accessibility?.avoidSteep) && typeof prom === "number" && Math.abs(prom) > 100) s -= 2;
  if (req.interests?.length && d.vibes?.length) {
    // khớp interests (slug vibe đã validate) với vibes[] KB bằng EXACT-SET — không substring
    // (tránh compound false-positive; vibes là mảng slug rời rạc). +2 soft bonus, không filter.
    const vibes = d.vibes;
    if (req.interests.some((i) => vibes.includes(i))) s += 2;
  }
  return s;
}

// Mode vibe-discovery: top-N điểm-đến hợp vibe (tên LẤY TỪ KB — KHÔNG LLM bịa). Rank chất lượng thuần
// (scoreDestination với req rỗng = desc/hours/sources; không interest/accessibility), tie theo id -> tất định.
const QUALITY_REQ: TripRequest = { slug: "", days: 1, party: { adults: 1, children: 0, elders: 0 }, pace: "moderate" };
export function pickByVibe(store: Store, vibe: string, n = 5): PlaceRef[] {
  return store.destinations
    .filter((r) => (r.ext?.destination?.vibes ?? []).includes(vibe))
    .map((r) => ({ r, s: scoreDestination(r, QUALITY_REQ) }))
    .sort((a, b) => b.s - a.s || (a.r.id < b.r.id ? -1 : 1))
    .slice(0, n)
    .map((x) => toPlaceRef(x.r));
}

// ── chi phí đi lại (PHÚT đồng nhất): điểm-điểm dùng ma trận OSRM; else haversine->phút ──
function legMin(store: Store, aId: string | null, a: LL, bId: string | null, b: LL): number {
  // A ragged OSRM matrix (island cities e.g. Phú Quốc/Hạ Long) can hold NaN durations; treat those
  // as "not in matrix" and fall back to haversine so no leg cost is ever NaN. (#529)
  if (aId && bId) { const dm = driveMinutes(store, aId, bId); if (dm != null && Number.isFinite(dm)) return dm; }
  return (kmBetween(a, b) / ASSUMED_SPEED_KMH) * 60;
}

// hoán vị theo THỨ TỰ TỪ ĐIỂN (arr tăng dần) -> tất định.
function* permutations(arr: number[]): Generator<number[]> {
  if (arr.length <= 1) { yield arr.slice(); return; }
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const p of permutations(rest)) yield [arr[i], ...p];
  }
}

// Sắp thứ tự trong ngày = VÒNG từ anchor (khách sạn): tối thiểu tổng phút anchor->..->anchor.
// k<=4 -> brute-force ĐÚNG (<=24 hoán vị). k>6 (không xảy ra với PER_DAY) -> nearest-neighbor.
function orderLoop(store: Store, recs: KbRecord[], anchor: LL): KbRecord[] {
  if (recs.length <= 1) return recs;
  const lls = recs.map(co);
  const ids = recs.map((r) => r.id);
  const idx = recs.map((_, i) => i);
  if (recs.length > 6) {
    const rem = [...idx]; const path: number[] = []; let cur: LL = anchor; let curId: string | null = null;
    while (rem.length) {
      let bi = 0, bd = Infinity;
      rem.forEach((ri, p) => { const d = legMin(store, curId, cur, ids[ri], lls[ri]); if (d < bd) { bd = d; bi = p; } });
      const ri = rem.splice(bi, 1)[0]; path.push(ri); cur = lls[ri]; curId = ids[ri];
    }
    return path.map((i) => recs[i]);
  }
  // Default to input order so an all-NaN cost matrix returns a valid ordering instead of throwing
  // on a null `best!` (was a 500 on island cities). legMin no longer yields NaN, but keep the
  // finite guard + non-null seed as defense-in-depth. (#529)
  let best: number[] = idx, bestCost = Infinity;
  for (const perm of permutations(idx)) { // lex order -> lex-nhỏ-nhất thắng tie (strict <)
    let c = legMin(store, null, anchor, ids[perm[0]], lls[perm[0]]);
    for (let i = 0; i < perm.length - 1; i++) c += legMin(store, ids[perm[i]], lls[perm[i]], ids[perm[i + 1]], lls[perm[i + 1]]);
    c += legMin(store, ids[perm[perm.length - 1]], lls[perm[perm.length - 1]], null, anchor);
    if (Number.isFinite(c) && c < bestCost - 1e-9) { bestCost = c; best = perm; }
  }
  return best.map((i) => recs[i]);
}

// macro-NN: xếp thứ tự các REGION theo centroid, quét 1 chiều từ tâm (tất định, tie theo key).
type Reg = { key: string; pts: KbRecord[]; centroid: LL; distTam: number; card: number; mass: number; fame: number };
function macroOrder(regs: Reg[], tam: LL): Reg[] {
  if (regs.length <= 1) return regs;
  const rem = [...regs].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const out: Reg[] = [];
  // Bắt chuỗi NN từ cụm FAME cao nhất (biểu tượng nhất) → flagship luôn vào ngày đầu, packDays không cắt;
  // route vẫn compact (NN từ đó). Tiebreak = gần tâm. Fame=0 hết → về nearest-tâm cũ. (re-apply sau merge #681 drop)
  const cur = rem.reduce((best, r) =>
    (r.fame > best.fame ||
      (r.fame === best.fame && kmBetween(tam, r.centroid) < kmBetween(tam, best.centroid))) ? r : best, rem[0]);
  out.push(cur); rem.splice(rem.indexOf(cur), 1);
  while (rem.length) {
    const last = out[out.length - 1];
    let best = rem[0], bd = kmBetween(last.centroid, rem[0].centroid);
    for (const r of rem) { const d = kmBetween(last.centroid, r.centroid); if (d < bd) { bd = d; best = r; } }
    out.push(best); rem.splice(rem.indexOf(best), 1);
  }
  return out;
}

// Partition-first: gán TRỌN region vào từng ngày theo thứ tự macro (KHÔNG cắt index cơ học trên
// chuỗi đã flatten — cắt index để ranh giới ngày rơi giữa 2 khu xa = bug "sáng nam, chiều bắc").
// Ranh giới ngày luôn rơi trên BIÊN region; chỉ gộp khu nhỏ MACRO-KỀ vào chung 1 ngày khi còn chỗ.
function packDays(store: Store, orderedRegs: Reg[], restDays: number, perDay: number): KbRecord[][] {
  const budget = restDays * perDay;
  const days: KbRecord[][] = [];
  let cur: KbRecord[] = [];
  let taken = 0;
  for (const reg of orderedRegs) {
    if (taken >= budget) break;
    // Cap TRƯỚC orderLoop: giữ điểm ưu tiên cao (anchor + score — reg.pts đã sort đầu-cụm), rồi TSP-sắp CHỈ tập
    // giữ lại. (Cũ: orderLoop cả cụm RỒI slice = cắt theo đuôi hình học -> rớt điểm score cao/anchor; sai intent A1.)
    let keep = reg.pts;
    if (taken + keep.length > budget) keep = keep.slice(0, budget - taken); // cap tổng = restDays*perDay
    const pts = orderLoop(store, keep, reg.centroid);
    taken += pts.length;
    for (let o = 0; o < pts.length; o += perDay) {
      const block = pts.slice(o, o + perDay); // <= perDay, cùng khu
      if (cur.length && cur.length + block.length <= perDay) cur.push(...block); // gộp khu nhỏ kề
      else { if (cur.length) days.push(cur); cur = [...block]; }
      if (cur.length >= perDay) { days.push(cur); cur = []; } // ngày đầy -> khu kế bắt đầu ngày mới
    }
  }
  if (cur.length) days.push(cur);
  while (days.length > restDays) days[days.length - 2].push(...days.pop()!); // dồn dư (khu kề đuôi) vào ngày cuối
  return days;
}

// A6 fallback: điểm thiếu region_id -> cụm bằng single-linkage theo km (ngưỡng ABS_GAP_KM). Tất định (sort id).
function clusterByCoord(pts: KbRecord[]): KbRecord[][] {
  if (!pts.length) return [];
  const rem = [...pts].sort((a, b) => (a.id < b.id ? -1 : 1));
  const used = new Set<string>();
  const clusters: KbRecord[][] = [];
  for (const p of rem) {
    if (used.has(p.id)) continue;
    const cl = [p]; used.add(p.id);
    let added = true;
    while (added) {
      added = false;
      for (const q of rem) {
        if (used.has(q.id)) continue;
        if (cl.some((m) => kmBetween(co(m), co(q)) <= ABS_GAP_KM)) { cl.push(q); used.add(q.id); added = true; }
      }
    }
    clusters.push(cl);
  }
  return clusters;
}

// A1/A2/A4/A5: đưa ĐỊA LÝ vào bước CHỌN. Ứng viên seed = cụm ở nửa GẦN TÂM (distTam ≤ trung vị) để blob
// ngoại vi mass-lớn không chiếm seed (khi cụm theo ward, lõi trung tâm vỡ thành nhiều ward nhỏ còn điểm
// KHÔNG parse được ward dồn vào MỘT blob region_id/__geo__ ngoại vi mass lớn -> blob chiếm seed -> lõi
// >8km bị gap-stop loại sạch, vd Hạ Long/Vũng Tàu mất khu đất liền). TRONG pool đó, seed = FAME cao nhất
// (khớp signatureSpots) TRƯỚC, rồi mass, rồi gần tâm, rồi key — để tỉnh sáp nhập mega không seed nhầm
// tỉnh-lỵ nhiều POI hành chính thay vì thị xã du lịch. Slug ngoài registry: fame=0 mọi cụm -> lùi về mass.
// Neo khoảng cách vào SEED CỐ ĐỊNH (không centroid trôi -> chống chaining single-linkage): duyệt cụm
// theo distToSeed tăng dần, DỪNG ở cụm đầu tiên "nhảy cụm" -> mọi cụm xa hơn đều LOẠI (compactness
// thắng coverage — không kéo vào cho đủ số). Tất định. Trả kept (giữ) + dropped (loại-note).
function growCompact(regs: Reg[], anchorKeys: Set<string>): { kept: Reg[]; dropped: Reg[] } {
  if (regs.length <= 1) return { kept: regs, dropped: [] };
  const sorted = [...regs].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  // Ứng viên seed = cụm ở nửa GẦN TÂM (distTam ≤ trung vị) để blob ngoại vi mass-lớn không chiếm seed —
  // NHƯNG cụm có FAME (khớp signatureSpots) luôn được vào pool dù xa, để tỉnh mega sáp nhập seed đúng khu
  // du lịch nổi tiếng cách tỉnh-lỵ >trung-vị (vd tuyen-quang -> Hà Giang). Blob ngoại vi fame=0 vẫn bị loại.
  const medTam = median(sorted.map((r) => r.distTam));
  const seedPool = sorted.filter((r) => r.distTam <= medTam || r.fame > 0);
  let seed = seedPool[0];
  for (const r of seedPool) {
    const better =
      r.fame > seed.fame ||
      (r.fame === seed.fame && r.mass > seed.mass) ||
      (r.fame === seed.fame && r.mass === seed.mass &&
        (r.distTam < seed.distTam || (r.distTam === seed.distTam && r.key < seed.key)));
    if (better) seed = r;
  }
  const others = sorted
    .filter((r) => r !== seed)
    .map((r) => ({ r, d: kmBetween(seed.centroid, r.centroid) }))
    .sort((a, b) => a.d - b.d || (a.r.key < b.r.key ? -1 : 1));
  const kept: Reg[] = [seed];
  const dropped: Reg[] = [];
  const dists: number[] = [];
  let stopped = false;
  for (const { r, d } of others) {
    if (anchorKeys.has(r.key)) { kept.push(r); continue; } // E1: anchor force-keep, KHÔNG push dists (tránh anchor xa phồng median kéo cụm xa khác vào)
    if (stopped) { dropped.push(r); continue; }
    const relCap = dists.length >= MIN_JOINS_FOR_GAP ? GAP_FACTOR * median(dists) : 0;
    if (d > Math.max(ABS_GAP_KM, relCap)) { stopped = true; dropped.push(r); continue; } // nhảy cụm
    kept.push(r); dists.push(d);
  }
  return { kept, dropped };
}

// Dựng các CHUNK-ngày mạch lạc địa lý (mỗi ngày 1 khu; outlier có ngày riêng/loại).
function buildDayChunks(store: Store, req: TripRequest, days: number, perDay: number): { chunks: KbRecord[][]; notes: string[] } {
  const notes: string[] = [];
  const withCoord = store.destinations.filter((r) => r.coordinates?.latitude != null && r.coordinates?.longitude != null);
  if (!withCoord.length) return { chunks: [], notes };
  const tam: LL = { lat: store.tam.lat, lon: store.tam.lon };

  // A0/A6: chấm TOÀN BỘ (không slice-by-score sớm), cụm theo KHU HÀNH CHÍNH (ward); thiếu địa chỉ ->
  // fallback region_id; thiếu cả hai -> cụm toạ độ. (Cũ: cụm theo region_id = hướng la bàn -> trộn thị xã.)
  // destRank: KB ship diem-den.json theo THỨ TỰ importance (build-time diem_quan_trong.sap_xep)
  // -> array index của store.destinations = rank (0 = quan trọng nhất). Bonus có trần cộng vào
  // scoreDestination (giữ nó thuần chất-lượng): importance chảy vào cap-survival + growCompact seed.
  const destRank = new Map<string, number>();
  store.destinations.forEach((r, i) => destRank.set(r.id, i));
  const nDest = store.destinations.length;
  const impBonus = (id: string): number =>
    nDest <= 1 ? 0 : IMPORTANCE_W * (1 - (destRank.get(id) ?? nDest - 1) / (nDest - 1));
  const scoreOf = new Map<string, number>();
  for (const r of withCoord) scoreOf.set(r.id, scoreDestination(r, req) + impBonus(r.id));
  const fameSpots = fameSpotsForSlug(req.slug); // signature-spots của slug (rỗng nếu ngoài registry)
  const groups = new Map<string, KbRecord[]>();
  const noRegion: KbRecord[] = [];
  for (const r of withCoord) {
    const key = adminKey(r) ?? (r.region_id || null);
    if (key) { const g = groups.get(key); if (g) g.push(r); else groups.set(key, [r]); }
    else noRegion.push(r);
  }
  clusterByCoord(noRegion).forEach((cl, i) => groups.set(`__geo__${i}`, cl));

  const anchorIds = new Set(req.anchors ?? []); // E1: id điểm khách chọn (force-include)
  // Marquee (điểm biểu tượng khớp signatureSpots của slug) = force-include NHƯ anchor: pin đầu cụm
  // (sống sót packDays cap) + cụm được force-keep qua gap-stop + own-day nếu xa. Slug không có
  // signatureSpots → marqueeIds rỗng → pinIds = anchorIds (hành vi cũ). "Đi khu nổi tiếng LUÔN có marquee."
  const marqueeIds = new Set<string>();
  if (fameSpots.length)
    for (const r of withCoord) {
      const nm = foldText(r.name);
      if (fameSpots.some((s) => (s.length >= 5 && boundedIncludes(nm, s)) || (nm.length >= 5 && boundedIncludes(s, nm)))) marqueeIds.add(r.id);
    }
  else
    // Phase 3: slug KHÔNG có signatureSpots hand-list (17/35 tp) → auto-marquee top-K theo importance
    // (destRank; KB ship theo thứ tự importance). Cho 17 tp này lớp force-include mà trước KHÔNG hề có.
    for (const r of [...withCoord]
      .sort((a, b) => (destRank.get(a.id) ?? Infinity) - (destRank.get(b.id) ?? Infinity))
      .slice(0, AUTO_MARQUEE_K))
      marqueeIds.add(r.id);
  // Lối vào đặc trưng (cáp treo vượt biển / tàu ra đảo): chuyến đi LÀ trải nghiệm khách săn → force-include
  // như marquee (bất kể hand-list). Cho phép "ngày đảo" ở dưới + hiện nhãn trên card.
  const hasSigAccess = (r: KbRecord) => !!r.ext?.destination?.loi_vao_dac_trung;
  for (const r of withCoord) if (hasSigAccess(r)) marqueeIds.add(r.id);
  const pinIds = marqueeIds.size ? new Set<string>([...anchorIds, ...marqueeIds]) : anchorIds; // anchor ∪ marquee
  // fame cụm: hand-list → hạng signatureSpot; auto (không hand-list) → theo importance rank của điểm marquee.
  const regFameOf = (pts: KbRecord[]): number => {
    if (fameSpots.length) return regFame(pts, fameSpots);
    let best = 0;
    // M4: per-điểm credit sàn 0 — điểm marquee (vd sig-access, luôn vào marqueeIds bất kể rank) có
    // destRank NGOÀI top-K cho term ÂM; Math.max(best, term ÂM) không được để KÉO fame xuống dưới 0.
    for (const p of pts) if (marqueeIds.has(p.id)) best = Math.max(best, AUTO_MARQUEE_K - (destRank.get(p.id) ?? AUTO_MARQUEE_K), 0);
    // Cụm chứa điểm sig-access = full-day tier (đủ điều kiện protCand qua sigAccess ngay cả rank thấp) —
    // sàn fame = AUTO_MARQUEE_K để KHÔNG bị cụm auto-marquee importance thường (rank cao hơn nhưng KHÔNG
    // sig-access) đè trong sort protReg, giành mất ngày riêng của nó.
    if (pts.some(hasSigAccess)) best = Math.max(best, AUTO_MARQUEE_K);
    return best;
  };

  // fameRankOf: hạng nổi tiếng 1 điểm = signatureSpot index thấp nhất khớp (spot[0]=biểu tượng nhất →
  // hạng cao nhất). Tiebreak GIỮA pin: nhiều marquee CÙNG cụm → icon nổi tiếng nhất lên TRƯỚC (Tượng Chúa
  // spot0 thắng Bãi Sau spot1). 0 nếu không khớp / slug không hand-list → không đổi. (re-apply sau merge #681 drop)
  const fameRankOf = (r: KbRecord): number => {
    if (!fameSpots.length) return 0;
    const nm = foldText(r.name);
    for (let i = 0; i < fameSpots.length; i++) {
      const s = fameSpots[i];
      // >= 5: độ dài tên gấp (folded) tối thiểu để khớp substring — tránh khớp giả do chuỗi ngắn (vd "hồ", "núi")
      if ((s.length >= 5 && boundedIncludes(nm, s)) || (nm.length >= 5 && boundedIncludes(s, nm))) return fameSpots.length - i;
    }
    return 0;
  };

  const regs: Reg[] = [...groups.entries()].map(([key, pts0]) => {
    // pts sort: anchor/marquee ĐẦU (sống sót packDays cap) -> độ-nổi-tiếng -> quality giảm dần (A1 trong cụm)
    const pts = [...pts0].sort((a, b) =>
      (Number(pinIds.has(b.id)) - Number(pinIds.has(a.id))) ||
      (fameRankOf(b) - fameRankOf(a)) ||
      (scoreOf.get(b.id)! - scoreOf.get(a.id)!) ||
      ((destRank.get(a.id) ?? Infinity) - (destRank.get(b.id) ?? Infinity)) || // importance-rank, thay tiebreak id lexical
      (a.id < b.id ? -1 : 1));
    const centroid = meanLL(pts.map(co));
    const mass = pts.reduce((s, p) => s + scoreOf.get(p.id)!, 0);
    return { key, pts, centroid, distTam: kmBetween(tam, centroid), card: pts.length, mass, fame: regFameOf(pts) };
  });

  // E1 anchor + marquee: cụm chứa anchor/marquee -> key (scan pts, KHÔNG dựa region_id vì điểm thiếu
  // region đã vào __geo__). Cụm marquee → force-keep qua gap-stop + đủ điều kiện own-day (isFar).
  const anchorKeys = new Set<string>();
  if (pinIds.size) for (const r of regs) if (r.pts.some((p) => pinIds.has(p.id))) anchorKeys.add(r.key);
  if (anchorIds.size && !anchorKeys.size) // anchor id không khớp điểm nào (URL lạ) — không force-include được
    console.warn(`[planner] anchors không khớp điểm nào trong store ${req.slug}: ${[...anchorIds].join(",")}`);

  // A1/A2/A4/A5: chọn cụm COMPACT quanh seed TRƯỚC; cụm xa (nhảy cụm) bị LOẠI (compactness thắng coverage).
  // Anchor (nếu có) force-keep — không bị loại.
  const { kept, dropped } = growCompact(regs, anchorKeys);
  for (const r of dropped)
    notes.push(`${r.pts[0].name}${r.card > 1 ? ` +${r.card - 1} điểm` : ""} (cụm cách trung tâm ~${Math.round(r.distTam)}km) — ngoài vùng thuận tiện, chưa đưa vào lịch.`);

  // C1 marquee/anchor TRONG cụm compact: cụm lệch core -> ngày RIÊNG (tránh trộn vào ngày cụm gần rồi
  // phá no-re-entry/long-leg). Marquee/anchor XA (signatureSpots — vd VinWonders Hòn Tre, Bà Nà) được
  // ngày riêng từ 2+ NGÀY (đảo/núi cần trọn ngày); outlier generic nhỏ giữ ngưỡng 3+ ngày. days=1: đảo
  // không nhét được -> note gợi ý 2+ ngày (đã chốt: giữ trung thực drive-time hơn checklist).
  const med = median(kept.map((r) => r.distTam));
  const isFar = (r: Reg) => med > 0 && r.distTam > FAR_FACTOR * med;
  const anchorFar = (r: Reg) => anchorKeys.has(r.key) && isFar(r);
  // Cụm marquee XA mà LỐI VÀO là trải nghiệm chữ ký (cáp treo/đảo) → NGÀY RIÊNG ngay cả days===1
  // ("ngày đảo" — chuyến đi là điểm nhấn; khu trung tâm lùi sang note). Marquee xa thường vẫn cần 2+ ngày.
  // Sig-access marquee (cáp treo/đảo) đáng NGÀY RIÊNG bất kể xa gần: điểm full-day + lối vào là trải nghiệm.
  // KHÔNG cần isFar (VinWonders ~7km vẫn là ngày trọn). anchorFar (marquee xa thường) vẫn cần 2+ ngày.
  const sigAccess = (r: Reg) => anchorKeys.has(r.key) && r.pts.some(hasSigAccess);
  // cụm chứa điểm khách CHỦ ĐỘNG chốt (user anchor, KHÔNG phải auto-marquee) — force-include tường minh.
  const isUserAnchor = (r: Reg) => r.pts.some((p) => anchorIds.has(p.id));
  // nearFameMax = fame flagship cụm GẦN nhất (precompute, không phụ thuộc thứ tự lặp) — dùng cho gate dưới.
  const nearFameMax = Math.max(0, ...kept.filter((r) => !isFar(r)).map((r) => r.fame));
  // FIX A (day-aware, sprawl-scoped gate): cấp NGÀY RIÊNG cho auto-marquee XA gần như luôn đúng — cụm far
  // GỌN, dù fame thấp (Đồi Chè Đà Lạt fame7, Tân Trào, Mai Châu, Sân Chim Vàm Hồ), vẫn là một ngày mạch lạc,
  // KHÔNG cắt cụm gần một cách hữu ích (near quá lớn thì cắt gì cũng cắt). CHỈ CHẶN cụm far mà bản thân nó
  // TRẢI RỘNG > WIDE_DAY_KM — đó là "cụm" do nhiều điểm xa nhập lại (vd Vũng Tàu 19 điểm gộp hồ tràm span
  // ~43km) → ngày đó là zig-zag thật, cấp ngày = hại. Và chỉ ở days===2: từ days>=3 có dư ngày, giữ nguyên
  // hành vi master (far-marquee giữ ngày riêng). Ngoại lệ khỏi gate: user anchor (khách chốt tường minh) +
  // sig-access (đảo/cáp treo, full-day logistics) — như cũ. r.fame < nearFameMax: chỉ chặn khi có flagship
  // gần XỨNG ĐÁNG hơn để nhường ngày cho (cụm far sprawl mà fame > mọi cụm gần thì vẫn là điểm nhấn, giữ).
  const WIDE_DAY_KM = 25;
  const farSprawlSteals = (r: Reg) =>
    !isUserAnchor(r) && r.fame < nearFameMax && spanKm(r.pts.map(co)) > WIDE_DAY_KM;
  const protCand = kept.filter((r) =>
    sigAccess(r) ? days >= 1
      : anchorFar(r) ? days >= 2 && (days >= 3 || !farSprawlSteals(r))
        : r.card <= MARQUEE_CARD_MAX && isFar(r) && days >= 3);
  let protReg: Reg[] = [];
  if (protCand.length) {
    // days>=2: để lại >=1 ngày cho phần còn lại. days===1: chỉ ngày-đảo sig-access mới lấy trọn 1 ngày.
    const cap = days >= 2 ? Math.max(0, days - 1) : (protCand.some(sigAccess) ? 1 : 0);
    protReg = [...protCand].sort((a, b) => (b.fame - a.fame) || (a.key < b.key ? -1 : 1)).slice(0, cap);
  }
  if (days === 1)
    // G5: sigAccess KHÔNG yêu cầu isFar (cụm gần vẫn qualify) — chỉ anchorFar mới thật sự "ở khu xa
    // trung tâm". Cụm sig-access GẦN bị gộp chung wording "xa" trước đây là sai (VinWonders ~7km).
    for (const r of kept.filter((r) => anchorFar(r) || sigAccess(r)))
      notes.push(protReg.includes(r) // ngày-đảo: đã nhét (lối vào là trải nghiệm) → không gợi "chọn 2+ để CÓ"
        ? `${r.pts[0].name}: ngày này xoay quanh điểm này (lối vào là trải nghiệm). Chọn 2+ ngày để thêm khu trung tâm.`
        : anchorFar(r)
        ? `${r.pts[0].name} ở khu xa trung tâm — nên dành trọn 1 ngày; chọn lịch 2+ ngày để có trong lịch trình.`
        : `${r.pts[0].name} có lối vào đặc trưng — nên dành trọn 1 ngày; chọn lịch 2+ ngày để có trong lịch trình.`);

  // FIX B (RC#2): cụm far bị sprawl-gate LOẠI ở days===2 KHÔNG được rơi vào `rest` — restOrdered ưu tiên
  // anchorKeys nên packDays sẽ gộp nó theo point-count → long-leg zig-zag với flagship gần. Loại khỏi rest
  // + nêu note (mirror far-note days===1). Chỉ days>=2: days===1 đã note ở nhánh dưới. days>=3 không gate nên rỗng.
  const gatedFar = days >= 2
    ? kept.filter((r) => anchorFar(r) && !sigAccess(r) && !isUserAnchor(r) && !protCand.includes(r))
    : [];
  for (const r of gatedFar)
    notes.push(`${r.pts[0].name} ở khu xa trung tâm — nên dành trọn 1 ngày; chọn lịch 3+ ngày để có trong lịch trình.`);

  const rest = kept.filter((r) => !protReg.includes(r) && !gatedFar.includes(r));
  const restDays = Math.max(0, days - protReg.length);
  // M3: restDays===0 (protReg chiếm hết ngày, vd ngày-đảo 1 ngày) → MỌI cụm "rest" bị âm thầm loại
  // (restChunks=[]), không note. Disclosure để khách biết những gì bị bỏ ngoài lịch.
  if (restDays === 0 && rest.length)
    notes.push(`${rest.slice(0, 3).map((r) => r.pts[0].name).join(", ")}${rest.length > 3 ? ` +${rest.length - 3} cụm khác` : ""} — ngày đã dành trọn cho lối vào đặc trưng, chưa đưa vào lịch.`);
  // E1: cụm anchor GẦN xử TRƯỚC trong packDays (không bị budget-break cắt); giữ macroOrder trong mỗi nhóm.
  const restMacro = macroOrder(rest, tam);
  const restOrdered = anchorKeys.size
    ? [...restMacro.filter((r) => anchorKeys.has(r.key)), ...restMacro.filter((r) => !anchorKeys.has(r.key))]
    : restMacro;
  const restChunks = restDays > 0 ? packDays(store, restOrdered, restDays, perDay) : []; // days===1 ngày-đảo: rest=0 ngày
  const chunks = [...restChunks, ...protReg.map((r) => r.pts)].filter((c) => c.length > 0);
  const keptCount = kept.reduce((s, r) => s + r.card, 0);
  if (keptCount < restDays * perDay)
    notes.push("Ít điểm đến hơn nhịp yêu cầu — một số ngày ngắn hơn (thêm dữ liệu điểm đến để dày hơn).");
  return { chunks, notes };
}

// Sở thích ăn uống → keyword khớp category KB (doctrine-safe: chỉ SẮP XẾP lại, không bịa, không loại hết).
const FOOD_KW: Record<string, string[]> = {
  "dia-phuong": ["địa phương", "đặc sản", "truyền thống", "local", "việt"],
  chay: ["chay", "vegetarian", "vegan"],
  "hai-san": ["hải sản", "hai san", "seafood", "ốc", "cua", "tôm"],
  "binh-dan": ["bình dân", "vỉa hè", "đường phố", "quán", "ăn vặt", "street"],
};
function foodMatches(r: KbRecord, prefs: string[]): boolean {
  const cats = [r.category?.primary, ...(r.category?.secondary ?? [])].filter(Boolean).join(" ").toLowerCase();
  return prefs.some((p) => (FOOD_KW[p] ?? []).some((k) => cats.includes(k)));
}

// GỢI Ý quán ăn (không slot vào timeline): giữ THỨ TỰ ẢNH HƯỞNG của mảng KB (đã xếp bởi anh_huong.py),
// ưu tiên quán trong bán kính capKm quanh centroid; nếu thiếu, bù quán gần nhất ngoài bán kính cho đủ n.
// foodPrefs (nếu có) = SẮP quán khớp khẩu vị lên đầu (stable-partition) — bias, KHÔNG lọc bỏ (không rỗng hoá).
function recommendRestaurants(store: Store, centroid: LL, capKm: number, n: number, foodPrefs?: string[]): KbRecord[] {
  const withCoord = store.restaurants.filter((r) => r.coordinates?.latitude != null && r.coordinates?.longitude != null);
  const withD = withCoord.map((r) => ({ r, d: kmBetween(centroid, co(r)) }));
  const inZone = withD.filter((x) => x.d <= capKm).map((x) => x.r); // giữ nguyên thứ tự KB (ảnh hưởng)
  const outZone = withD.filter((x) => x.d > capKm).sort((a, b) => a.d - b.d).map((x) => x.r); // bù gần nhất
  let ordered = inZone.length >= n ? inZone : [...inZone, ...outZone];
  if (foodPrefs?.length) ordered = [...ordered.filter((r) => foodMatches(r, foodPrefs)), ...ordered.filter((r) => !foodMatches(r, foodPrefs))];
  return ordered.slice(0, n);
}

// Khách sạn: đầu tiên theo ảnh hưởng trong bán kính quanh CENTROID chuyến đi; else gần nhất.
function pickHotel(store: Store, centroid: LL, tripSpanKm: number): KbRecord | null {
  const cap = dynamicCapKm(tripSpanKm);
  let fb: KbRecord | null = null, fbD = Infinity;
  for (const h of store.hotels) {
    if (h.coordinates?.latitude == null) continue;
    const d = haversine(centroid.lat, centroid.lon, h.coordinates.latitude, h.coordinates.longitude) / 1000;
    if (d <= cap) return h;
    if (d < fbD) { fbD = d; fb = h; }
  }
  return fb;
}

export function buildItinerary(req: TripRequest, store?: Store): Itinerary {
  const st = store ?? loadStore(req.slug);
  const perDay = PER_DAY[req.pace];
  const { chunks: dayChunks, notes: planNotes } = buildDayChunks(st, req, req.days, perDay);

  const selected = dayChunks.flat();
  const centroid: LL = selected.length ? meanLL(selected.map(co)) : { lat: st.tam.lat, lon: st.tam.lon };
  const tripSpanKm = spanKm(selected.map(co));
  const hotelRec = pickHotel(st, centroid, tripSpanKm);
  const anchor: LL = hotelRec?.coordinates?.latitude != null ? co(hotelRec) : centroid;

  // Timeline CHỈ điểm-đến (buổi sáng/chiều); nhà hàng KHÔNG slot vào ngày — thành list gợi ý riêng.
  const days: DayPlan[] = dayChunks.map((chunk, di) => {
    const ordered = orderLoop(st, chunk, anchor);
    const m = Math.ceil(ordered.length / 2);
    const items: SlotItem[] = [];
    ordered.slice(0, m).forEach((r) => items.push(slot(toPlaceRef(r), "diem-den", "sang")));
    ordered.slice(m).forEach((r) => items.push(slot(toPlaceRef(r), "diem-den", "chieu")));
    attachLegs(st, items);
    return { day: di + 1, region_id: ordered[0]?.region_id ?? null, items };
  });

  // GỢI Ý quán ăn: top-N theo ảnh hưởng trong vùng chuyến đi (bias theo khẩu vị nếu có).
  // B4.1: nâng trần gợi ý quán 3 → tối đa 8 (theo số ngày); KB ít hơn → hiện đúng số có.
  const restaurants: PlaceRef[] = recommendRestaurants(st, centroid, dynamicCapKm(tripSpanKm), clampInt(req.days * 2, 4, 8), req.food).map(toPlaceRef);

  const hotelNote = (h: KbRecord): string | null =>
    [h.ext?.hotel?.phan_khuc, h.ext?.hotel?.so_phong ? `${h.ext?.hotel?.so_phong} phòng` : null]
      .filter(Boolean).join(" · ") || null;

  const hotel: PlaceRef | null = hotelRec
    ? { ...toPlaceRef(hotelRec), note: hotelNote(hotelRec) }
    : null;

  // 1-4 khách sạn: primary (hotelRec) + tối đa 3 lựa chọn gần centroid nhất (loại primary).
  const hotelAlts: PlaceRef[] = st.hotels
    .filter((h) => h !== hotelRec && h.coordinates?.latitude != null && h.coordinates?.longitude != null)
    .map((h) => ({ h, d: haversine(centroid.lat, centroid.lon, co(h).lat, co(h).lon) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 3)
    .map(({ h }) => ({ ...toPlaceRef(h), note: hotelNote(h) }));

  const goiTruoc = days.flatMap((d) => d.items).filter((i) => i.goi_truoc).length;
  const notes: string[] = [...planNotes];
  if (goiTruoc) notes.push(`${goiTruoc} địa điểm chưa có giờ mở xác minh — nên GỌI TRƯỚC khi đến.`);
  if (req.party.elders > 0) notes.push("Có người lớn tuổi: đã ưu tiên điểm ít dốc + có lối tiếp cận khi dữ liệu cho phép.");
  // Phương tiện: chỉ GHI LẠI (không có ma trận thời gian riêng theo phương tiện → không đổi thứ tự/route).
  if (req.transport) {
    const TR: Record<string, string> = { "xe-khach": "xe khách", "tu-lai": "tự lái", "xe-may": "xe máy" };
    notes.push(`Phương tiện: ${TR[req.transport] ?? req.transport}. Thời gian di chuyển ước tính theo đường bộ.`);
  }
  notes.push("Mọi địa điểm truy về nguồn trong bộ dữ liệu; SĐT chưa gọi xác minh (marketplace — thông tin, không đặt hộ).");

  return { slug: req.slug, request: req, days, hotel, hotelAlts, restaurants, notes, generated_from: st.generatedAt };
}

// PII (#522/#532): điểm-đến phone = riêng tư → STRIP tại model. Contract: điểm đến ẩn số; khách sạn/
// nhà hàng GIỮ số business ("gọi trước"). slot() chỉ dựng timeline item điểm-đến, nên enforce ở đây phủ
// CẢ hai đường đọc — DTO (/api/planner/itinerary bỏ phone khỏi DtoItem) lẫn RSC (/lich-trinh đọc thẳng
// SlotItem.phone) — không rò theo đường vòng.
function slot(p: PlaceRef, role: SlotItem["role"], buoi: SlotItem["buoi"]): SlotItem {
  return { ...p, phone: null, role, buoi };
}

// Gắn chặng di chuyển tới mục TRƯỚC trong ngày (phút theo matrix nếu có, km haversine để hiển thị).
// Mục đầu ngày = null. Không đổi thứ tự -> tất định; chỉ đọc toạ độ đã có.
function attachLegs(store: Store, items: SlotItem[]): void {
  for (let i = 0; i < items.length; i++) {
    const b = items[i];
    if (i === 0) { b.leg_from_prev = null; continue; }
    const a = items[i - 1];
    if (a.lat == null || a.lon == null || b.lat == null || b.lon == null) { b.leg_from_prev = null; continue; }
    const al: LL = { lat: a.lat, lon: a.lon }, bl: LL = { lat: b.lat, lon: b.lon };
    b.leg_from_prev = {
      minutes: Math.round(legMin(store, a.id, al, b.id, bl)),
      km: Math.round(kmBetween(al, bl) * 10) / 10,
    };
  }
}
