// Planner deterministic (V1, không LLM): request + store -> itinerary theo BUỔI.
// MẠCH LẠC ĐỊA LÝ: mỗi ngày = một khu (cụm region kề nhau), route vòng từ khách sạn, bữa ăn nằm
// trên tuyến. Điểm outlier xa (vd Bà Nà ~40km) được ngày RIÊNG hoặc loại — không nhét lẻ (chống zig-zag).
// Nhà hàng/khách sạn theo THỨ TỰ ẢNH HƯỞNG (VQS nội bộ), guard địa lý; KHÔNG in điểm/số (QĐ 2026-08-05).

import type { DayPlan, Itinerary, KbDestinationExt, KbRecord, PlaceRef, SlotItem, TripRequest } from "./types";
import { driveMinutes, haversine, loadStore, toPlaceRef, type Store } from "./store";

const PER_DAY: Record<TripRequest["pace"], number> = { relaxed: 2, moderate: 3, packed: 4 };
const ASSUMED_SPEED_KMH = 25; // đổi km -> phút cho leg không có ma trận OSRM (khách sạn/nhà hàng)
const MARQUEE_CARD_MAX = 2;   // region <=2 điểm + xa => outlier marquee (Bà Nà)
const FAR_FACTOR = 2;         // "xa" = khoảng cách region->tâm > 2x trung vị
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
type Reg = { key: string; pts: KbRecord[]; centroid: LL; distTam: number; card: number; mass: number };
function macroOrder(regs: Reg[], tam: LL): Reg[] {
  if (regs.length <= 1) return regs;
  const rem = [...regs].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const out: Reg[] = [];
  const cur = rem.reduce((best, r) => (kmBetween(tam, r.centroid) < kmBetween(tam, best.centroid) ? r : best), rem[0]);
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

// A1/A2/A4/A5: đưa ĐỊA LÝ vào bước CHỌN. Seed = cụm MASS cao nhất TRONG NHÓM GẦN TÂM (distTam ≤ trung vị);
// tie: gần tâm hơn, rồi key. (Trước: seed = mass cao nhất TOÀN BỘ — nhưng khi cụm theo ward, lõi trung tâm
// vỡ thành nhiều ward nhỏ còn các điểm KHÔNG parse được ward dồn vào MỘT blob region_id/__geo__ ngoại vi
// tổng mass lớn -> blob chiếm seed -> lõi trung tâm cách >8km bị gap-stop loại sạch, vd Hạ Long/Vũng Tàu
// mất cả khu đất liền. Chặn ứng viên seed vào nửa GẦN TÂM: blob ngoại vi mass-lớn hết neo được, nhưng vẫn
// giữ chọn-theo-mass trong vùng lõi nên cụm dày trung tâm vẫn thắng cụm thưa cùng vùng.)
// Neo khoảng cách vào SEED CỐ ĐỊNH (không centroid trôi -> chống chaining single-linkage): duyệt cụm
// theo distToSeed tăng dần, DỪNG ở cụm đầu tiên "nhảy cụm" -> mọi cụm xa hơn đều LOẠI (compactness
// thắng coverage — không kéo vào cho đủ số). Tất định. Trả kept (giữ) + dropped (loại-note).
function growCompact(regs: Reg[], anchorKeys: Set<string>): { kept: Reg[]; dropped: Reg[] } {
  if (regs.length <= 1) return { kept: regs, dropped: [] };
  const sorted = [...regs].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  // Ứng viên seed = cụm ở nửa GẦN TÂM (distTam ≤ trung vị) để blob ngoại vi mass-lớn không chiếm seed.
  const medTam = median(sorted.map((r) => r.distTam));
  const seedPool = sorted.filter((r) => r.distTam <= medTam);
  let seed = seedPool[0];
  for (const r of seedPool) {
    const better =
      r.mass > seed.mass ||
      (r.mass === seed.mass && (r.distTam < seed.distTam || (r.distTam === seed.distTam && r.key < seed.key)));
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
  const scoreOf = new Map<string, number>();
  for (const r of withCoord) scoreOf.set(r.id, scoreDestination(r, req));
  const groups = new Map<string, KbRecord[]>();
  const noRegion: KbRecord[] = [];
  for (const r of withCoord) {
    const key = adminKey(r) ?? (r.region_id || null);
    if (key) { const g = groups.get(key); if (g) g.push(r); else groups.set(key, [r]); }
    else noRegion.push(r);
  }
  clusterByCoord(noRegion).forEach((cl, i) => groups.set(`__geo__${i}`, cl));

  const anchorIds = new Set(req.anchors ?? []); // E1: id điểm khách chọn (force-include)

  const regs: Reg[] = [...groups.entries()].map(([key, pts0]) => {
    // pts sort: anchor lên ĐẦU (sống sót packDays cap trong cụm) -> rồi quality giảm dần (A1 quyết trong cụm)
    const pts = [...pts0].sort((a, b) =>
      (Number(anchorIds.has(b.id)) - Number(anchorIds.has(a.id))) ||
      (scoreOf.get(b.id)! - scoreOf.get(a.id)!) || (a.id < b.id ? -1 : 1));
    const centroid = meanLL(pts.map(co));
    const mass = pts.reduce((s, p) => s + scoreOf.get(p.id)!, 0);
    return { key, pts, centroid, distTam: kmBetween(tam, centroid), card: pts.length, mass };
  });

  // E1 anchor: cụm chứa anchor -> key (scan pts, KHÔNG dựa region_id vì điểm thiếu region đã vào __geo__).
  const anchorKeys = new Set<string>();
  if (anchorIds.size) for (const r of regs) if (r.pts.some((p) => anchorIds.has(p.id))) anchorKeys.add(r.key);
  if (anchorIds.size && !anchorKeys.size) // anchor id không khớp điểm nào (URL lạ) — không force-include được
    console.warn(`[planner] anchors không khớp điểm nào trong store ${req.slug}: ${[...anchorIds].join(",")}`);

  // A1/A2/A4/A5: chọn cụm COMPACT quanh seed TRƯỚC; cụm xa (nhảy cụm) bị LOẠI (compactness thắng coverage).
  // Anchor (nếu có) force-keep — không bị loại.
  const { kept, dropped } = growCompact(regs, anchorKeys);
  for (const r of dropped)
    notes.push(`${r.pts[0].name}${r.card > 1 ? ` +${r.card - 1} điểm` : ""} (cụm cách trung tâm ~${Math.round(r.distTam)}km) — ngoài vùng thuận tiện, chưa đưa vào lịch.`);

  // C1 marquee TRONG cụm compact: cụm nhỏ + lệch core -> ngày RIÊNG. Anchor XA cũng được ngày riêng (tái dùng
  // cơ chế marquee — tránh trộn vào ngày cụm gần rồi phá no-re-entry/long-leg). Anchor GẦN -> nằm rest, packDays lo.
  const med = median(kept.map((r) => r.distTam));
  const isFar = (r: Reg) => med > 0 && r.distTam > FAR_FACTOR * med;
  const protCand = kept.filter((r) => (r.card <= MARQUEE_CARD_MAX && isFar(r)) || (anchorKeys.has(r.key) && isFar(r)));
  let protReg: Reg[] = [];
  if (protCand.length && days >= 3) {
    protReg = [...protCand].sort((a, b) => (a.key < b.key ? -1 : 1)).slice(0, Math.max(0, days - 1)); // để lại >=1 ngày cho phần còn lại
  }

  const rest = kept.filter((r) => !protReg.includes(r));
  const restDays = Math.max(1, days - protReg.length);
  // E1: cụm anchor GẦN xử TRƯỚC trong packDays (không bị budget-break cắt); giữ macroOrder trong mỗi nhóm.
  const restMacro = macroOrder(rest, tam);
  const restOrdered = anchorKeys.size
    ? [...restMacro.filter((r) => anchorKeys.has(r.key)), ...restMacro.filter((r) => !anchorKeys.has(r.key))]
    : restMacro;
  const restChunks = packDays(store, restOrdered, restDays, perDay);
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
  const restaurants: PlaceRef[] = recommendRestaurants(st, centroid, dynamicCapKm(tripSpanKm), clampInt(req.days, 1, 3), req.food).map(toPlaceRef);

  const hotelNote = (h: KbRecord): string | null =>
    [h.ext?.hotel?.phan_khuc, h.ext?.hotel?.so_phong ? `${h.ext?.hotel?.so_phong} phòng` : null]
      .filter(Boolean).join(" · ") || null;

  const hotel: PlaceRef | null = hotelRec
    ? { ...toPlaceRef(hotelRec), note: hotelNote(hotelRec) }
    : null;

  // 1-3 khách sạn: primary (hotelRec) + tối đa 2 lựa chọn gần centroid nhất (loại primary).
  const hotelAlts: PlaceRef[] = st.hotels
    .filter((h) => h !== hotelRec && h.coordinates?.latitude != null && h.coordinates?.longitude != null)
    .map((h) => ({ h, d: haversine(centroid.lat, centroid.lon, co(h).lat, co(h).lon) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 2)
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
