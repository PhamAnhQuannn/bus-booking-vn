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

// specFameRank: hạng nổi tiếng của MỘT tên theo signature khớp CỤ THỂ NHẤT (match DÀI nhất), KHÔNG phải
// signature khớp SỚM nhất. Độ cụ thể đo THEO NHÁNH: forward (signature token nằm TRONG tên record) →
// s.length; reverse (tên record nằm trong cụm signature dài hơn) → nm.length (chính tên record), KHÔNG phải
// cụm dài không liên quan — nếu không, 'hòn thơm' (rank đúng) bị alias dài 'cáp treo hòn thơm' đè xuống. (#702)
export function specFameRank(name: string, fameSpots: string[]): number {
  if (!fameSpots.length) return 0;
  const nm = foldText(name);
  let rank = 0, bestLen = -1;
  for (let i = 0; i < fameSpots.length; i++) {
    const s = fameSpots[i];
    const fwd = s.length >= 5 && boundedIncludes(nm, s);
    const rev = nm.length >= 5 && boundedIncludes(s, nm);
    if (fwd || rev) {
      const matchLen = fwd ? s.length : nm.length;
      if (matchLen > bestLen) { bestLen = matchLen; rank = fameSpots.length - i; }
    }
  }
  return rank;
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
// Ngưỡng "ngày rộng": một cặp điểm trong cùng NGÀY xa nhau > WIDE_DAY_KM = zig-zag không mạch lạc. Dùng
// chung cho sprawl-gate (#693) và locality-guard của packDays (#698, không gộp/dồn điểm cross-region xa).
const WIDE_DAY_KM = 25;
// FIX 2 (#698 RC#3): quy ước dedup KB — hai record CÙNG TÊN mà cách nhau < NEAR_TWIN_KM = cùng một địa danh
// (mirror pass16 fold-name<2km). Dùng để scope note-dedupe drop: chỉ nuốt note khi twin đã-xếp đủ GẦN.
const NEAR_TWIN_KM = 2;
// locality-guard: hai nhóm điểm có "xa nhau" không? true nếu CÓ cặp chéo > WIDE_DAY_KM. O(n·m), n,m ≤ perDay.
function crossFar(a: KbRecord[], b: KbRecord[]): boolean {
  for (const p of a) for (const q of b) if (kmBetween(co(p), co(q)) > WIDE_DAY_KM) return true;
  return false;
}

// ── TRỌNG SỐ THỜI-LƯỢNG ngày ("1 tảng-to + vài sỏi/ngày") ────────────────────
// Engine KHÔNG có mô hình giờ/năng-lượng: "1 slot" = điểm ngắm cảnh 30' HAY công viên 8h như nhau, nên
// một ngày dễ bị nhồi 2 điểm trọn-ngày (vd Nha Trang: VinWonders + Hòn Tằm cùng ngày = bất khả ~13-17h).
// Xấp xỉ thời-lượng bằng LOẠI HÌNH và bắt bất biến: mỗi ngày Σ dayWeight ≤ 1. FULL=1 (đảo/công viên giải
// trí/vườn quốc gia/lối-vào-đặc-trưng — nửa-cả ngày), HALF=0.5 (thác/hang/núi/bãi biển/thung lũng — 2-3h),
// SHORT=0 (chùa/đền/nhà thờ/bảo tàng/ngắm cảnh/chợ/công viên/hồ — nhanh, chồng bao nhiêu cũng được).
// Category từ audit corpus (30 loại). SHORT không giới hạn count (perDay lo), chỉ FULL/HALF tính weight.
const HALF_W = 0.5;
const FULL_CAT = ["dao", "vuon quoc gia", "khu bao ton", "khu du lich giai tri", "khu vui choi"];
const HALF_CAT = ["thac", "hang", "nui", "deo", "duong mon", "bai bien", "thung lung", "ban lang"];
// Loại hình NGẮN mạnh (chùa/đền/bảo tàng/chợ/công viên…): tín hiệu category đủ chắc để tên KHÔNG được lật
// lên FULL (chống false-positive "Chùa … Safari"). Chỉ loại generic/mơ hồ ("Điểm tham quan") mới cho tên quyết.
const SHORT_CAT = ["chua", "thien vien", "den", "mieu", "nha tho", "bao tang", "dinh", "di tich", "ngam canh", "cho", "cong vien", "vuon hoa", "ho", "dap", "cau"];
// Tên full-day (folded, không dấu) mà DATA hay gán nhầm loại chung "Điểm tham quan" (w=0). Tách 2 lớp:
// ACCESS (cáp treo/cable car) = lối vào trải nghiệm → trọn ngày BẤT kể loại (kể cả "Đền/Miếu"); BRAND
// (công viên chủ đề/safari/công viên nước) chỉ lật khi category KHÔNG phải loại NGẮN mạnh (SHORT_CAT) —
// tránh một cái tên tình cờ chứa token lật một điểm thật-sự-ngắn thành FULL.
const FULL_ACCESS_NAME = /(^|[^a-z])(cap treo|cable car)([^a-z]|$)/;
const FULL_BRAND_NAME = /(^|[^a-z])(sun ?world|vinwonders?|vinpearl|safari|cong vien nuoc)([^a-z]|$)/;
// NIT (#698): công viên nước = full-day, NHƯNG token SHORT "cong vien" khớp GIỮA category "cong vien nuoc"
// (bounded — có khoảng trắng theo sau) → nếu để brand-override SAU gate SHORT_CAT thì water-park bị hạ oan
// SHORT. Đánh giá riêng, TRƯỚC gate (theo tên HOẶC category). safari giữ trong gate (chống "Chùa … Safari").
const FULL_WATERPARK_NAME = /(^|[^a-z])cong vien nuoc([^a-z]|$)/;
const _dwCache = new WeakMap<KbRecord, number>(); // memo: dayWeight gọi rất nhiều lần/điểm; record ref bền
export function dayWeight(r: KbRecord): number {
  const c = _dwCache.get(r);
  if (c !== undefined) return c;
  const v = computeDayWeight(r);
  _dwCache.set(r, v);
  return v;
}
function computeDayWeight(r: KbRecord): number {
  if (r.ext?.destination?.loi_vao_dac_trung) return 1; // sig-access (cáp treo/tàu ra đảo) = trọn ngày
  const cat = foldText(r.category?.primary ?? "");
  if (FULL_CAT.some((t) => boundedIncludes(cat, t))) return 1;
  const nm = foldText(r.name);
  if (FULL_ACCESS_NAME.test(nm)) return 1; // cáp treo/cable car = trọn ngày bất kể category
  if (FULL_WATERPARK_NAME.test(nm) || boundedIncludes(cat, "cong vien nuoc")) return 1; // công viên nước = full-day (TRƯỚC gate SHORT_CAT). NIT #698
  if (!SHORT_CAT.some((t) => boundedIncludes(cat, t)) && FULL_BRAND_NAME.test(nm)) return 1; // brand full-day trên category generic
  // đảo bị gán nhầm loại "Bãi biển" (Hòn Tằm) → FULL; nhưng "Hòn Chồng" (Điểm ngắm cảnh) KHÔNG lên (viewpoint bẫy)
  if (/^(hon|dao|cu lao)\b/.test(nm) && boundedIncludes(cat, "bai bien")) return 1;
  if (HALF_CAT.some((t) => boundedIncludes(cat, t))) return HALF_W;
  return 0;
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
// anchorIds = điểm KHÁCH CHỦ ĐỘNG chốt (E1 force-include): dồn-dư KHÔNG được evict/drop chúng (grid không có
// anchor nên bất biến với grid). Điểm anchor không đặt được ngày gọn → vẫn nhét ngày gần nhất (E1 thắng, hiếm).
function packDays(store: Store, orderedRegs: Reg[], restDays: number, perDay: number, tam: LL, anchorIds: Set<string>): { days: KbRecord[][]; dropped: KbRecord[] } {
  const budget = restDays * perDay;
  const days: KbRecord[][] = [];
  const dropped: KbRecord[] = [];
  let cur: KbRecord[] = [];
  let curW = 0;
  let taken = 0; // FIX 4 (#698): đếm điểm THỰC SỰ xếp — điểm bị drop (dồn-dư) trả lại budget để cụm sau vẫn được nhận.
  // Đẩy `cur` thành 1 ngày. Còn slot ngày (days < restDays) → mở ngày mới. Hết slot (dồn dư) → dồn TỪNG điểm dư
  // vào ngày GẦN NHẤT còn chỗ-weight (span gộp nhỏ nhất) — KHÔNG vào "ngày cuối" tuỳ tiện (locality-guard
  // #698/#694: chống long-leg cross-region). Nếu ngày gần nhất vẫn > WIDE_DAY_KM:
  //   • điểm GẦN tâm (home, dist≤WIDE_DAY_KM) → vẫn nhét (không bỏ khu trung tâm vì một outlier chiếm mất ngày);
  //   • điểm XA tâm (outlier thật, master cho ngày riêng nhờ dư budget — ở đây hết) → bỏ + hoàn budget (FIX 4).
  // Điểm-nặng không ngày nào nhận nổi weight cũng bỏ. Điểm bị bỏ → note ngoài công bố.
  const flush = () => {
    if (!cur.length) return;
    if (days.length < restDays) { days.push(cur); cur = []; curW = 0; return; }
    const dayW = (d: KbRecord[]) => d.reduce((s, q) => s + dayWeight(q), 0);
    for (const p of cur) {
      const w = dayWeight(p);
      // best = ngày nhận p tốt nhất tôn trọng Σweight VÀ perDay-count (#699: dồn-dư KHÔNG được vượt nhịp —
      // trước đây chỉ chặn Σweight nên điểm SHORT w=0 nhồi vô hạn vào ngày đã đủ perDay). bestA = chỉ chặn
      // Σweight (KHÔNG chặn count) — DÀNH RIÊNG cho E1 anchor (khách chốt tường minh thắng nhịp; giữ hành vi cũ).
      let best = -1, bestSpan = Infinity;
      let bestA = -1, bestASpan = Infinity;
      for (let i = 0; i < days.length; i++) {
        if (dayW(days[i]) + w > 1 + 1e-9) continue;
        const s = spanKm([...days[i], p].map(co));
        if (s < bestASpan) { bestASpan = s; bestA = i; }
        if (days[i].length >= perDay) continue; // #699: perDay count-cap (E1 dùng bestA, miễn cap)
        if (s < bestSpan) { bestSpan = s; best = i; }
      }
      if (best >= 0 && bestSpan <= WIDE_DAY_KM) { days[best].push(p); continue; } // ngày gọn còn chỗ → nhét
      // E1: user-anchor KHÔNG bị bỏ vì xa. Ngày gần nhất còn-chỗ-weight dù > WIDE_DAY_KM/đã đủ perDay vẫn nhận
      // anchor (HONOR E1, dùng bestA miễn count-cap); ngày-rộng đó được CÔNG BỐ ở tầng disclosure per-day phổ
      // quát dưới buildDayChunks (FIX 1 #698 RC#3). bestA<0 (không ngày nào đủ weight) → bỏ + hoàn budget.
      if (anchorIds.has(p.id)) { if (bestA >= 0) { days[bestA].push(p); } else { dropped.push(p); taken -= 1; } continue; }
      // Không ngày nào GẦN nhận được p. Nếu p GẦN tâm hơn một điểm XA (KHÔNG phải anchor) đã xếp mà thay nó cho p
      // vào được ngày gọn (span≤WIDE_DAY_KM) → HOÁN (giữ điểm gần home, đẩy outlier xa ra + note): tránh outlier
      // chiếm mất ngày của khu trung tâm. Không hoán được → p mới là outlier thật → bỏ p (+note). Cả hai: hoàn budget.
      const dp = kmBetween(co(p), tam);
      let swI = -1, swJ = -1, swSpan = Infinity;
      for (let i = 0; i < days.length; i++)
        for (let j = 0; j < days[i].length; j++) {
          const q = days[i][j];
          if (anchorIds.has(q.id) || kmBetween(co(q), tam) <= dp) continue; // KHÔNG đẩy anchor; chỉ đẩy điểm XA tâm hơn p
          if (dayW(days[i]) - dayWeight(q) + w > 1 + 1e-9) continue;
          const s = spanKm([...days[i].slice(0, j), ...days[i].slice(j + 1), p].map(co));
          if (s <= WIDE_DAY_KM && s < swSpan) { swSpan = s; swI = i; swJ = j; }
        }
      if (swI >= 0) { dropped.push(days[swI].splice(swJ, 1)[0]); taken -= 1; days[swI].push(p); }
      else { dropped.push(p); taken -= 1; }
    }
    cur = []; curW = 0;
  };
  for (const reg of orderedRegs) {
    if (taken >= budget) break;
    // Cap TRƯỚC orderLoop: giữ điểm ưu tiên cao (anchor + score — reg.pts đã sort đầu-cụm), rồi TSP-sắp CHỈ tập
    // giữ lại. (Cũ: orderLoop cả cụm RỒI slice = cắt theo đuôi hình học -> rớt điểm score cao/anchor; sai intent A1.)
    let keep = reg.pts;
    if (taken + keep.length > budget) keep = keep.slice(0, budget - taken); // cap tổng = restDays*perDay
    const pts = orderLoop(store, keep, reg.centroid);
    taken += pts.length;
    // Chia cụm thành BLOCK (region-atomic — không cắt xuyên biên cụm): mỗi block ≤ perDay điểm VÀ Σweight ≤ 1
    // (1 điểm-nặng + vài điểm-nhẹ). Điểm-đến toàn SHORT (w=0, đa số tp đô thị) → chỉ count-break = hệt cũ.
    // Lưu SẴN weight mỗi block (nit d #698) — khỏi reduce lại ở vòng gộp.
    const blocks: { pts: KbRecord[]; w: number }[] = [];
    let b: KbRecord[] = [], bw = 0;
    for (const p of pts) {
      const w = dayWeight(p);
      if (b.length && (b.length >= perDay || bw + w > 1 + 1e-9)) { blocks.push({ pts: b, w: bw }); b = []; bw = 0; }
      b.push(p); bw += w;
    }
    if (b.length) blocks.push({ pts: b, w: bw });
    for (const { pts: block, w: bWeight } of blocks) { // <= perDay + Σweight<=1, cùng khu
      // gộp khu nhỏ kề: đủ chỗ (count + Σweight) VÀ gần (locality-guard #698 — không gộp block cross-region xa)
      if (cur.length && cur.length + block.length <= perDay && curW + bWeight <= 1 + 1e-9 && !crossFar(cur, block)) { cur.push(...block); curW += bWeight; }
      else { flush(); cur = [...block]; curW = bWeight; }
      if (cur.length >= perDay) flush(); // ngày đầy -> khu kế bắt đầu ngày mới
    }
  }
  flush();
  return { days, dropped };
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
function growCompact(regs: Reg[], anchorKeys: Set<string>, fameCurated: boolean): { kept: Reg[]; dropped: Reg[] } {
  if (regs.length <= 1) return { kept: regs, dropped: [] };
  const sorted = [...regs].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  // Ứng viên seed = cụm ở nửa GẦN TÂM (distTam ≤ trung vị) để blob ngoại vi mass-lớn không chiếm seed —
  // NHƯNG cụm có FAME (khớp signatureSpots) luôn được vào pool dù xa, để tỉnh mega sáp nhập seed đúng khu
  // du lịch nổi tiếng cách tỉnh-lỵ >trung-vị (vd tuyen-quang -> Hà Giang). Blob ngoại vi fame=0 vẫn bị loại.
  const medTam = median(sorted.map((r) => r.distTam));
  // fame bypass distTam-filter CHỈ khi fame là CURATED (hand-list signatureSpots) — hand-list fame đáng tin
  // để seed đúng khu du lịch xa tỉnh-lỵ. Với slug AUTO (không hand-list), fame = raw destRank rank thô, KHÔNG
  // được kéo seed ra xa (outlier importance-cao gap-stop lõi trung tâm — vd ha-noi cũ → Ba Vì). Far marquee
  // vẫn force-keep qua anchorKeys, chỉ SEED phải ở gần tâm. (QA finding: seed guard cho 15 auto slug.)
  const seedPool = sorted.filter((r) => r.distTam <= medTam || (r.fame > 0 && fameCurated));
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

  // specFameOf: hạng nổi tiếng theo signature khớp CỤ THỂ NHẤT (chuỗi signature DÀI nhất khớp), KHÔNG phải
  // signature nổi-tiếng-nhất khớp SỚM. fameRankOf trả match ĐẦU (index thấp) → một điểm chỉ mang tên KHU
  // ("Chùa Linh Ứng - Bà Nà" khớp 'bà nà' = tên khu rank cao) bị THỔI hạng lên bằng chính icon đặc trưng
  // của khu ("cầu vàng" khớp 'cầu vàng'). Khi perDay-cap buộc cắt, dùng match cụ-thể-nhất để icon THẬT
  // (cầu vàng, sf9) không bị filler chỉ-trùng-tên-khu (Chùa Linh Ứng, tên riêng khớp 'chùa linh ứng' sf5)
  // đè. Slug ngoài hand-list → fameSpots rỗng → 0 (auto slug xếp theo importance/score bên dưới). (#702)
  const specFameOf = (r: KbRecord): number => specFameRank(r.name, fameSpots);
  // protCmp: xếp `ordered` trong vòng protReg (điểm rớt do perDay/Σ = ưu-tiên-thấp-nhất, tức cuối). Thang:
  // user-anchor > pin(marquee) > hạng fame CỤ-THỂ (specFame — match signature DÀI nhất, KHÔNG để tên-khu thổi
  // filler lên bằng icon) > chất-lượng > importance-rank > id. KHÔNG có tầng sig-access ở ĐÂY: sig-access luôn
  // là pin w=1 nên đã dẫn ngày qua Σweight; thêm tầng chỉ ĐẢO thứ tự marquee trong ward sprawl mega (vd phú-quốc
  // hòn thơm-nam đè grand world-bắc → ngày 37km). Đây là điểm sửa cốt lõi da-nang: cầu vàng(specFame9) không
  // bị Chùa Linh Ứng(chỉ khớp tên-khu 'bà nà' → fameRank thổi 10, nhưng specFame thật 5) đè. (#702)
  const protRank = (r: KbRecord): number =>
    (anchorIds.has(r.id) ? 4000 : 0) + (pinIds.has(r.id) ? 2000 : 0) + specFameOf(r) * 10 + (scoreOf.get(r.id) ?? 0);
  const protCmp = (a: KbRecord, b: KbRecord): number =>
    (protRank(b) - protRank(a)) ||
    ((destRank.get(a.id) ?? Infinity) - (destRank.get(b.id) ?? Infinity)) ||
    (a.id < b.id ? -1 : 1);
  // priScore: ƯU TIÊN GIỮ dùng cho HOÁN chỗ (cơ chế 2) — chọn filler thấp nhất để marquee dư đẩy ra. KHÁC
  // protCmp: CÓ tầng sig-access (+1000) vì marquee sig-access (đảo/cáp treo full-day, vd đảo ti tốp specFame4)
  // XỨNG đáng chiếm chỗ một điểm-cảnh fame-list cao hơn nhưng thường (Vịnh Hạ Long specFame9, Hòn Trống Mái
  // specFame6) trên một ngày rest — trải nghiệm trọn-ngày > một view. Chỉ ảnh hưởng LỰA CHỌN nạn nhân hoán,
  // KHÔNG xếp ngày (nên không đụng thứ tự ward sprawl). (#702)
  const priScore = (r: KbRecord): number => protRank(r) + (hasSigAccess(r) ? 1000 : 0);

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
  const { kept, dropped } = growCompact(regs, anchorKeys, fameSpots.length > 0);
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
  // (WIDE_DAY_KM = 25 hoisted lên module-scope để packDays locality-guard #698 dùng chung.)
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
    ? kept.filter((r) => anchorFar(r) && !sigAccess(r) && !protCand.includes(r))
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
  const packed = restDays > 0 ? packDays(store, restOrdered, restDays, perDay, tam, anchorIds) : { days: [] as KbRecord[][], dropped: [] as KbRecord[] }; // days===1 ngày-đảo: rest=0 ngày
  // protReg mỗi cụm = 1 ngày CHÍNH, cắt theo TRỌNG SỐ THỜI-LƯỢNG (Σ≤1): giữ 1 điểm-nặng đầu cụm (đã sort pin/
  // fame) + pebbles nhẹ; điểm-nặng thứ 2+ cùng cụm (vd vinpearl + Hòn Tằm, Ti Tốp + Sửng Sốt cùng ward) → spill.
  const protDropped: KbRecord[] = [];
  const protChunks: KbRecord[][] = [];
  const spillQueue: KbRecord[] = []; // FIX (#698 R5): điểm-nặng dư Σ-cut — thử SPILL vào NGÀY DƯ trước khi drop.
  for (const r of protReg) {
    // FIX 1 (#698): user-anchor (khách CHỦ ĐỘNG chốt) KHÔNG bị Σ-cut đẩy ra để nhường một MARQUEE fame cao hơn
    // CÙNG cụm — E1 force-include bất biến TRƯỚC marquee. r.pts sort pin-first→fame, nên marquee fame cao lọt
    // TRƯỚC anchor rồi lấp Σ=1 → anchor rớt. Nhấc user-anchor lên đầu (stable, giữ thứ tự fame trong mỗi bậc)
    // để anchor chiếm slot trước; marquee thua slot bị drop thay (KHÔNG reintro Σ>1). Cụm không anchor: giữ y cũ.
    // LƯU Ý (FIX 4 #698): bảo vệ này CHỈ vs marquee — hai user-anchor CÙNG một cụm mà Σweight>1 thì anchor DƯ
    // vẫn bị Σ-cut bỏ (+ công bố qua allDropped), không có ưu tiên giữa các anchor với nhau.
    // #702: xếp theo protCmp (anchor>pin>fame cụ-thể>chất-lượng) TRƯỚC khi lấp — khi perDay/Σ buộc
    // cắt, điểm rớt là điểm ƯU TIÊN THẤP NHẤT (filler SHORT), KHÔNG phải marquee SHORT tình cờ đứng cuối cụm.
    // (Cũ: chỉ đẩy anchor lên đầu rồi lấp theo thứ tự r.pts — fameRankOf thổi hạng filler-trùng-tên-khu khiến
    // cầu vàng/đảo ti tốp bị cắt cho một chùa/hang thường; nay match cụ-thể-nhất giữ đúng icon.)
    const ordered = [...r.pts].sort(protCmp);
    const day: KbRecord[] = []; let w = 0;
    for (const p of ordered) {
      const pw = dayWeight(p);
      // Σweight-cap (điểm-nặng dư) HOẶC perDay-cap (dư SỐ điểm — fix mega-day 27-33 stop): điểm-nặng còn-lại
      // → spillQueue (thử own-day riêng); điểm NHẸ (SHORT w=0) dư count → protDropped (drop+note khi pinned),
      // KHÔNG nhồi spillQueue để mech-1/2 khỏi re-place SHORT (comment L121 "perDay lo SHORT" giờ đúng cả protReg).
      if (day.length && (w + pw > 1 + 1e-9 || day.length >= perDay)) { (pw > 0 ? spillQueue : protDropped).push(p); continue; }
      day.push(p); w += pw;
    }
    if (day.length) protChunks.push(day);
  }
  // FIX (#698 R5): điểm-nặng protReg dư Σ-cut KHÔNG bị drop oan KHI CÒN CHỖ THẬT. Trước đây mỗi cụm protReg chỉ
  // dựng ĐÚNG 1 ngày (Σ≤1); flagship thứ 2 cùng ward (Hòn Tằm/vinpearl, Ti Tốp) rớt + note "chọn thêm ngày" bắn
  // ở CHÍNH max-day — dù còn ngày trống/ngày rest gần còn chỗ. Hai cơ chế bù (chỉ dùng CHỖ CÓ SẴN — KHÔNG giành
  // ngày của rest, tránh đánh đổi flagship rest lấy overflow), cùng tôn trọng Σ≤1 & KHÔNG tạo ngày-rộng:
  //   • Cơ chế 1 (own-day riêng, đúng doctrine): còn slot ngày packDays BỎ TRỐNG (packed.days.length < restDays)
  //     VÀ protChunks.length < cap → mở own-day chunk cùng cụm (Σ≤1, gộp thêm điểm dư gần nếu !crossFar).
  //   • Cơ chế 2 (fallback): nhét dư còn lại vào ngày rest sẵn có còn dư weight (Σ≤1) VÀ trong WIDE_DAY_KM.
  // Twin-dedup theo QUY ƯỚC KB (TÊN-folded trùng + <NEAR_TWIN_KM) — tránh nhân bản KB-dup, KHÔNG nhầm điểm khác
  // tên ở gần (Hòn Tằm ≠ Vịnh Nha Trang, vinpearl ≠ VinWonders) thành "trùng". Còn lại thật thiếu chỗ → drop+note.
  if (spillQueue.length) {
    const cap = days >= 2 ? Math.max(0, days - 1) : (protCand.some(sigAccess) ? 1 : 0);
    const placedTwin = new Map<string, LL[]>();
    const addPlaced = (p: KbRecord) => { const k = foldText(p.name); const a = placedTwin.get(k); if (a) a.push(co(p)); else placedTwin.set(k, [co(p)]); };
    for (const p of [...protChunks, ...packed.days].flat()) addPlaced(p);
    const isTwin = (p: KbRecord) => { const a = placedTwin.get(foldText(p.name)); return !!a && a.some((c) => kmBetween(c, co(p)) < NEAR_TWIN_KM); };
    let spareSlots = restDays - packed.days.length; // ngày rest packDays BỎ TRỐNG → own-day cho flagship dư
    // Cơ chế 1: own-day riêng dùng slot trống. Cap-gate `protChunks.length < cap` giữ lại 1 ngày cho `rest`;
    // nhưng khi rest.length===0 (KHÔNG có cụm rest nào để bảo vệ) ngày dành-riêng đó bị emit TRỐNG trong khi
    // flagship dư bị drop oan → nới cap khi rest rỗng. Vẫn chặn bởi spareSlots (KHÔNG vượt số ngày thật `days`).
    while (spillQueue.length && spareSlots > 0 && (protChunks.length < cap || rest.length === 0)) {
      const idx = spillQueue.findIndex((p) => !isTwin(p));
      if (idx < 0) break;
      const head = spillQueue.splice(idx, 1)[0];
      const chunk: KbRecord[] = [head]; let cw = dayWeight(head); addPlaced(head);
      // FIX (#698 R7): duyệt companion THEO ƯU TIÊN (FORWARD snapshot) — mirror cơ chế 2. Trước đây reverse-iterate
      // (length-1→0) nạp điểm-nặng ƯU TIÊN THẤP (cuối queue) làm companion trước, ăn budget Σ≤1 mà lẽ ra dành cho
      // điểm ưu tiên cao hơn. Xoá item đã đặt khỏi mảng sống theo IDENTITY (indexOf) — head vẫn là findIndex-first.
      for (const q of [...spillQueue]) {
        const pw = dayWeight(q);
        if (cw + pw <= 1 + 1e-9 && chunk.length < perDay && !crossFar(chunk, [q]) && !isTwin(q)) {
          chunk.push(q); cw += pw; addPlaced(q); const j = spillQueue.indexOf(q); if (j >= 0) spillQueue.splice(j, 1);
        }
      }
      protChunks.push(chunk);
      spareSlots -= 1;
    }
    // Cơ chế 2: nhét dư còn lại vào ngày rest gần còn dư weight; twin đã xếp → KHÔNG nhân bản (rơi protDropped,
    // note-dedup <2km nuốt). Không tạo ngày-rộng (span≤WIDE_DAY_KM).
    // Duyệt spillQueue THEO THỨ TỰ ƯU TIÊN (FORWARD): queue được nạp cluster-by-cluster theo protReg fame-giảm,
    // mỗi cụm pts đã sort pin-first→fame nên index 0 = ưu tiên cao nhất. Khi rest-day headroom khan hiếm và
    // nhiều điểm-nặng tranh nhau, FLAGSHIP ưu tiên cao được giành slot TRƯỚC (mirror cơ chế 1). Duyệt trên bản
    // chụp cố định + xoá item đã đặt khỏi mảng sống theo IDENTITY (indexOf) — tránh reverse-iterate làm đảo ưu tiên.
    for (const p of [...spillQueue]) {
      if (isTwin(p)) continue;
      const pw = dayWeight(p);
      let best = -1, bestSpan = Infinity;
      for (let i = 0; i < packed.days.length; i++) {
        if (packed.days[i].length >= perDay) continue; // perDay-cap: KHÔNG nhồi quá nhịp vào ngày rest
        const dw = packed.days[i].reduce((s, q) => s + dayWeight(q), 0);
        if (dw + pw > 1 + 1e-9) continue;
        const s = spanKm([...packed.days[i], p].map(co));
        if (s <= WIDE_DAY_KM && s < bestSpan) { bestSpan = s; best = i; }
      }
      if (best >= 0) { packed.days[best].push(p); addPlaced(p); const j = spillQueue.indexOf(p); if (j >= 0) spillQueue.splice(j, 1); continue; }
      // #702: KHÔNG còn ngày rest CÒN CHỖ (mọi ngày đã đủ perDay hoặc kín Σweight). Nếu p là MARQUEE/sig-access/
      // pin (không phải điểm-nặng generic) → HOÁN vào ngày rest bằng cách đẩy filler ƯU TIÊN THẤP NHẤT ra (giữ
      // count ≤ perDay, Σweight ≤ 1, span ≤ WIDE). Trước đây base "cram" p làm ngày count>perDay (mega-day);
      // perDay-cap chặn cram nên marquee (đảo ti tốp, vinpearl) rớt oan dù ngày rest chỉ toàn filler nhẹ. Chỉ
      // đẩy filler priScore < p (không bao giờ hi sinh điểm ưu tiên ≥ p; không đụng user-anchor). filler bị đẩy
      // → protDropped (công bố nếu là pin; im lặng nếu filler thường). (mirror packDays swap ở L296-306.)
      if (!(pinIds.has(p.id) || hasSigAccess(p))) continue;
      let dI = -1, dJ = -1, dSpan = Infinity, dPri = Infinity;
      for (let i = 0; i < packed.days.length; i++) {
        if (packed.days[i].length > perDay) continue; // KHÔNG hoán vào ngày packDays block-merge đã quá perDay (giữ perDay-cap)
        const dayW = packed.days[i].reduce((s, q) => s + dayWeight(q), 0);
        for (let j = 0; j < packed.days[i].length; j++) {
          const q = packed.days[i][j];
          if (anchorIds.has(q.id) || priScore(q) >= priScore(p)) continue; // đừng đẩy anchor / điểm ưu tiên ≥ p
          if (dayW - dayWeight(q) + pw > 1 + 1e-9) continue;                 // Σweight sau hoán
          const rest = [...packed.days[i].slice(0, j), ...packed.days[i].slice(j + 1)];
          const s = spanKm([...rest, p].map(co));
          if (s > WIDE_DAY_KM) continue;                                     // KHÔNG tạo ngày-rộng
          // Locality: marquee phải THUỘC cùng khu ngày này (≤ ABS_GAP_KM tới MỘT điểm còn lại) — không "airlift"
          // một marquee XA (vd Sun World Bà Nà ~20km) vào ngày phố chỉ vì các điểm phố tình cờ sát nhau (span
          // < WIDE nhưng marquee lạc lõng). Marquee xa không có ngày → drop+note (đúng far-marquee doctrine). (#702)
          if (rest.length && !rest.some((x) => kmBetween(co(x), co(p)) <= ABS_GAP_KM)) continue;
          const qp = priScore(q); // ưu tiên đẩy FILLER thấp nhất (mệnh lệnh: cắt ưu-tiên-thấp-nhất), rồi span gọn
          if (qp < dPri || (qp === dPri && s < dSpan)) { dPri = qp; dSpan = s; dI = i; dJ = j; }
        }
      }
      if (dI >= 0) {
        protDropped.push(packed.days[dI].splice(dJ, 1)[0]);
        packed.days[dI].push(p); addPlaced(p);
        const j = spillQueue.indexOf(p); if (j >= 0) spillQueue.splice(j, 1);
      }
    }
    for (const p of spillQueue) protDropped.push(p); // thật sự thiếu chỗ → công bố qua allDropped bên dưới
  }
  // Note điểm-nặng bị bỏ (cần trọn ngày riêng) VÀ marquee/anchor bị bỏ do locality-guard (#698): điểm biểu-
  // tượng xa mà ngày gần nhất >WIDE_DAY_KM → không nhét được nếu KHÔNG tạo ngày-rộng (mega-tỉnh sáp nhập nhiều
  // điểm xa hơn số ngày) → công bố để khách biết (không âm thầm bỏ), thay vì cram vào ngày zig-zag.
  // FIX 2 (#698 RC#3): note-layer dedupe PROXIMITY-SCOPED — chỉ bỏ khỏi note một điểm bị drop khi một BẢN SAO
  // cùng tên-folded ĐÃ xếp mà CŨNG nằm trong <NEAR_TWIN_KM (mirror quy ước dedup KB: TÊN + <2km). Tên loại-hình
  // chung (chợ/đình/miếu/cầu/thác) lặp ở nhiều phường khác nhau → nếu chỉ khớp tên (cũ) thì một địa danh KHÁC
  // bị nuốt note oan; có twin đủ gần mới là trùng thật (vd VQG Tam Đảo hai bản cùng chỗ). Chỉ dedupe tầng note.
  const placedByName = new Map<string, LL[]>();
  for (const p of [...protChunks, ...packed.days].flat()) {
    const k = foldText(p.name);
    const arr = placedByName.get(k);
    if (arr) arr.push(co(p)); else placedByName.set(k, [co(p)]);
  }
  // FIX (#700): dedupe cũng TRONG chính tập bị bỏ, không chỉ với twin đã-xếp. Khi CẢ HAI bản của một record
  // KB-trùng (vd vinh-long "Nông trại Hải Vân" ×2, <2km) đều bị bỏ (không bản nào lọt placedByName), filter
  // trên chỉ chặn twin đã-XẾP nên cả hai in note ("… , … chưa xếp đủ"). Giữ bản đầu, nuốt bản trùng-tên-<2km sau.
  const droppedTwin = new Map<string, LL[]>();
  const allDropped = [...packed.dropped, ...protDropped]
    .filter((p) => dayWeight(p) > 0 || pinIds.has(p.id))
    .filter((p) => { // giữ note nếu KHÔNG có twin đã-xếp trong <2km (địa danh khác dù trùng tên loại-hình)
      const twins = placedByName.get(foldText(p.name));
      return !twins || !twins.some((c) => kmBetween(c, co(p)) < NEAR_TWIN_KM);
    })
    .filter((p) => { // dedupe trong tập dropped: cùng tên-folded + <NEAR_TWIN_KM = KB-dup, chỉ note MỘT lần
      const k = foldText(p.name);
      const seen = droppedTwin.get(k);
      if (seen && seen.some((c) => kmBetween(c, co(p)) < NEAR_TWIN_KM)) return false;
      if (seen) seen.push(co(p)); else droppedTwin.set(k, [co(p)]);
      return true;
    });
  if (allDropped.length)
    notes.push(`${allDropped.slice(0, 3).map((p) => p.name).join(", ")}${allDropped.length > 3 ? ` +${allDropped.length - 3} điểm` : ""} — cần trọn ngày riêng, chưa xếp đủ; chọn thêm ngày để có trong lịch.`);
  // PR-B (placement): XEN ngày-anchor (protChunk = flagship trọn-ngày) với ngày rest thay vì dồn CUỐI —
  // chống back-load (ngày đầu toàn điểm nhẹ, ngày cuối dồn nặng, vd Nha Trang cũ). Flagship DẪN ĐẦU (năng
  // lượng cao, đặt tông chuyến đi) rồi xen kẽ nhẹ/nặng. Đô thị không có protChunk → A rỗng → giữ nguyên rest.
  const interleaved: KbRecord[][] = [];
  for (let i = 0; i < Math.max(protChunks.length, packed.days.length); i++) {
    if (i < protChunks.length) interleaved.push(protChunks[i]);
    if (i < packed.days.length) interleaved.push(packed.days[i]);
  }
  const chunks = interleaved.filter((c) => c.length > 0);
  // FIX 1 (#698 RC#3): CÔNG BỐ per-day PHỔ QUÁT — sau khi ráp xong MỌI ngày, ngày nào có cặp điểm nội-bộ xa
  // > WIDE_DAY_KM (dù đến từ nhánh đặt-chính days.push, dồn-dư overflow, HAY một Reg ward-less ~40km một ngày —
  // trước đây các nhánh này ship âm thầm không note) → phát ĐÚNG 1 note chặng dài cho ngày đó. Chỉ CÔNG BỐ,
  // KHÔNG đổi điểm nào vào ngày nào (disclosure-only); span = max-pair (bất biến theo thứ tự). Tất định.
  for (const day of chunks) {
    const cs = day.map(co);
    const s = spanKm(cs);
    if (s > WIDE_DAY_KM) {
      // Đặt tên ĐÚNG cặp endpoint tạo nên span (haversine = s), không phải day[0] (chỉ là điểm xếp đầu).
      let ai = 0, bi = 0, mx = -1;
      for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
        const d = kmBetween(cs[i], cs[j]);
        if (d > mx) { mx = d; ai = i; bi = j; }
      }
      notes.push(`${day[ai].name} ↔ ${day[bi].name}: ngày này có chặng di chuyển dài (~${Math.round(s)}km) — hai điểm ở khu xa nhau.`);
    }
  }
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
    let ordered = orderLoop(st, chunk, anchor);
    const m = Math.ceil(ordered.length / 2);
    // PR-B: điểm NẶNG nhất (trọn-ngày) → buổi SÁNG (năng lượng cao, tránh dồn điểm mệt vào chiều). orderLoop
    // là vòng kín (về khách sạn) nên đảo chiều giữ NGUYÊN chi phí tuyến. Chỉ đảo khi điểm nặng nhất rơi nửa
    // sau. Đô thị toàn SHORT (w=0) → điểm nặng nhất = phần tử đầu (reduce lấy max đầu tiên), index 0 < m → no-op.
    // FIX 3 (#698): reverse chỉ áp dụng cho VÒNG KÍN (≤6 điểm brute-force). >6 orderLoop trả ĐƯỜNG HỞ (nearest-
    // neighbor) → reverse đảo lộn tuyến hở; để nguyên. VÀ vì ma trận OSRM có thể BẤT ĐỐI XỨNG (dur[i][j]≠dur[j][i]),
    // reverse KHÔNG chắc giữ nguyên chi phí → chỉ đảo khi tổng chi phí vòng KHÔNG tăng (so 2 chiều, giữ chiều rẻ).
    if (ordered.length > 1 && ordered.length <= 6) {
      const heavy = ordered.reduce((a, r, i) => (dayWeight(r) > a.w ? { w: dayWeight(r), i } : a), { w: dayWeight(ordered[0]), i: 0 });
      if (heavy.i >= m) {
        const loopCost = (arr: KbRecord[]): number => {
          let c = legMin(st, null, anchor, arr[0].id, co(arr[0]));
          for (let i = 0; i < arr.length - 1; i++) c += legMin(st, arr[i].id, co(arr[i]), arr[i + 1].id, co(arr[i + 1]));
          return c + legMin(st, arr[arr.length - 1].id, co(arr[arr.length - 1]), null, anchor);
        };
        const rev = [...ordered].reverse();
        if (loopCost(rev) <= loopCost(ordered) + 1e-9) ordered = rev; // đảo chỉ khi không đắt hơn (tất định)
      }
    }
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
