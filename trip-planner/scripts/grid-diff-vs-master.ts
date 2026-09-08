/* eslint-disable @typescript-eslint/no-explicit-any -- dev gate tooling, raw JSON + dynamic base import */
// Full-grid diff-vs-base gate for planner selection quality (#697).
// Runs buildItinerary for EVERY export unit × days[2..7] × pace[relaxed|moderate|packed] on BOTH
// the working tree ("head") and a base checkout (git merge-base HEAD master by default), then diffs
// per-(slug,days,pace) metrics and reports REGRESSIONS. Existing smoke/verify/audit scripts run ONE
// config/slug + name-presence only; this catches the class #693 shipped blind (198 changed cases /
// 62 new wide-days / 38 sig-losses).
//
// Run from repo root:
//   pnpm tsx trip-planner/scripts/grid-diff-vs-master.ts [--base <ref>] [--slug a,b,c]
//                                                        [--rebuild-base] [--keep-worktree]
//
// Gate = 0 UN-ALLOWLISTED regressions. Intended trade-offs go in trip-planner/scripts/grid-diff.allow.jsonl
// ({slug,days,pace,kind,detail?,reason,pr}); the script prints a paste-ready allow line for each NEW one.
// `detail` scopes an allow to ONE named regression (dropped marquee / wide-day endpoints); omit it to match any.
// Positive counters (WIDE-FIXED / OVERCAP-FIXED / SIG-GAIN) measure a PR's benefit, not just its cost.
//
// Base materialization: `git worktree add --detach <tmp> <base>` OUTSIDE the repo (scratchpad) so tsc/
// lint/vitest repo-globs + Turbopack :3001 never see it; node_modules is junction-linked to the repo's
// (base store.ts imports @aws-sdk/client-s3). Base RESULTS are cached by SHA → later runs skip the
// worktree entirely. Both sides read the SAME on-disk KB (cwd=repo) so the diff isolates ENGINE change.

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { haversine } from "../lib/planner/store";
import { buildItinerary as buildHead } from "../lib/planner/plan";
import type { Itinerary, TripRequest } from "../lib/planner/types";

// ── config ──────────────────────────────────────────────────────────────────
const EXPORT_ROOT = "tourism-kb/export";
const AREAS_PATH = "trip-planner/lib/planner/areas.json";
const ALLOW_PATH = "trip-planner/scripts/grid-diff.allow.jsonl";
const DAYS = [2, 3, 4, 5, 6, 7];
const PACES = ["relaxed", "moderate", "packed"] as const;
const PER_DAY: Record<string, number> = { relaxed: 2, moderate: 3, packed: 4 }; // mirror plan.ts:10
const AUTO_MARQUEE_K = 4; // mirror plan.ts:17 (top-K destRank force-included when no hand-list)
const WIDE_DAY_KM = 25; // mirror plan.ts:125
type BuildFn = (req: any) => Itinerary;

// ── args ──────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const argVal = (flag: string): string | undefined => {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
};
const REBUILD_BASE = argv.includes("--rebuild-base");
const KEEP_WT = argv.includes("--keep-worktree");
const slugFilter = argVal("--slug")?.split(",").map((s) => s.trim()).filter(Boolean);

// ── helpers ──────────────────────────────────────────────────────────────────
const git = (...a: string[]) => execFileSync("git", a, { encoding: "utf-8" }).trim();
const fold = (s: string) =>
  (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[đĐ]/g, "d").toLowerCase().replace(/\s+/g, " ").trim();
// bidirectional bounded substring (mirror audit_icon_runtime match, guard ≥5 chars to cut noise)
const nameMatch = (a: string, b: string) => {
  const x = fold(a), y = fold(b);
  if (!x || !y) return false;
  return (x.length >= 5 && y.includes(x)) || (y.length >= 5 && x.includes(y));
};
// widest diem-den pair of the day → span km + the two endpoint NAMES (so wide days key by identity,
// not by day-index — a reorder must not create/mask a NEW-WIDE; see diffConfig).
const widestPair = (pts: { name: string; lat: number | null; lon: number | null }[]): { km: number; a: string; b: string } => {
  const p = pts.filter((q) => q.lat != null && q.lon != null) as { name: string; lat: number; lon: number }[];
  let km = 0, a = "", b = "";
  for (let i = 0; i < p.length; i++)
    for (let j = i + 1; j < p.length; j++) {
      const d = haversine(p[i].lat, p[i].lon, p[j].lat, p[j].lon) / 1000;
      if (d > km) { km = d; a = p[i].name; b = p[j].name; }
    }
  return { km, a, b };
};

// units = every export dir with a diem-den.json (mirror smoke-all-units:9-13). NOT cities.ts's 35-slug
// allowlist — #697's "full grid" is the whole export set (that's what caught #693's dark-unit regressions).
function allUnits(): string[] {
  return fs
    .readdirSync(EXPORT_ROOT)
    .filter((s) => fs.existsSync(path.join(EXPORT_ROOT, s, "diem-den.json")))
    .sort();
}

// Marquee name pool per slug = hand-list signatureSpots ∪ top-AUTO_MARQUEE_K destRank ∪ sig-access.
// audit_icon_runtime's sigmap is hand-list-ONLY → blind for vinh/dong-hoi/son-la/hcm (the cited slugs);
// the engine force-includes auto-marquee + sig-access too, so SIG-LOSS must track all three.
const AREAS: any = JSON.parse(fs.readFileSync(AREAS_PATH, "utf-8"));
function handList(slug: string): string[] {
  const out: string[] = [];
  const prov = AREAS.provinces?.[slug];
  if (prov?.signatureSpots) out.push(...prov.signatureSpots);
  for (const a of AREAS.areas || []) if (a.slug === slug && a.signatureSpots) out.push(...a.signatureSpots);
  return out;
}
function marqueeNames(slug: string): string[] {
  const recs: any[] = JSON.parse(fs.readFileSync(path.join(EXPORT_ROOT, slug, "diem-den.json"), "utf-8"));
  const hl = handList(slug);
  const pool = new Set<string>();
  // hand-list matches (real record names, so presence-check is apples-to-apples)
  for (const r of recs) if (hl.some((s) => nameMatch(s, r.name || ""))) pool.add(r.name);
  // auto-marquee only when no hand-list. Engine (plan.ts:472-475) takes top-K over `withCoord`, so filter
  // to coordinate-bearing records BEFORE the top-K slice or the pool over-counts (17 auto-marquee slugs).
  if (!hl.length)
    for (const r of recs.filter((r) => r.coordinates?.latitude != null).slice(0, AUTO_MARQUEE_K)) pool.add(r.name);
  for (const r of recs) if (r.ext?.destination?.loi_vao_dac_trung) pool.add(r.name); // sig-access
  return [...pool];
}

// ── per-config metrics ────────────────────────────────────────────────────────
type WideDay = { key: string; span: number }; // key = folded, sorted max-pair endpoint names
type ConfigMetric =
  | { ok: false; err: string }
  | {
      ok: true;
      dayCount: number;
      wideDays: WideDay[]; // days with span > WIDE_DAY_KM, keyed by endpoints (NOT day-index)
      counts: number[]; // diem-den count per day-index
      marqueeSurfaced: string[]; // marquee pool names present as diem-den (folded)
      noteBlob: string; // folded joined notes (for SILENT-VANISH mention check)
    };

function metricsOf(build: BuildFn, slug: string, days: number, pace: string, pool: string[]): ConfigMetric {
  let it: Itinerary;
  try {
    it = build({ slug, days, party: { adults: 2, children: 0, elders: 0 }, pace } as TripRequest);
  } catch (e: any) {
    return { ok: false, err: String(e?.message || e).slice(0, 80) };
  }
  const wideDays: WideDay[] = [];
  const counts: number[] = [];
  const surfaced = new Set<string>();
  const poolFolded = pool.map(fold);
  for (const d of it.days) {
    const dd = d.items.filter((i) => i.role === "diem-den");
    counts.push(dd.length);
    const w = widestPair(dd.map((i) => ({ name: i.name, lat: i.lat, lon: i.lon })));
    if (w.km > WIDE_DAY_KM) wideDays.push({ key: [fold(w.a), fold(w.b)].sort().join(" ↔ "), span: w.km });
    for (const i of dd) {
      const nf = fold(i.name);
      for (let k = 0; k < pool.length; k++)
        if (poolFolded[k] === nf || nameMatch(pool[k], i.name)) surfaced.add(poolFolded[k]);
    }
  }
  return { ok: true, dayCount: it.days.length, wideDays, counts, marqueeSurfaced: [...surfaced], noteBlob: fold(it.notes.join(" ‖ ")) };
}

// ── diff one config → regression + fix records ─────────────────────────────────
type Kind = "NEW-WIDE" | "SIG-LOSS" | "NEW-OVERCAP" | "SILENT-VANISH" | "NEW-THROW";
// lateral (SIG-LOSS only): this config's TOTAL surfaced-marquee count did not drop (head ≥ base) —
// a compensating SIG-GAIN offset it, i.e. the budget just picked a DIFFERENT flagship, not fewer.
// Net-loss (lateral=false) = head surfaces strictly fewer marquees → the one that needs human eyes.
type Reg = { slug: string; days: number; pace: string; kind: Kind; detail: string; lateral?: boolean };
type Fix = { kind: "WIDE-FIXED" | "OVERCAP-FIXED" | "SIG-GAIN"; slug: string; days: number; pace: string };

function diffConfig(slug: string, days: number, pace: string, base: ConfigMetric, head: ConfigMetric): { regs: Reg[]; fixes: Fix[] } {
  const regs: Reg[] = [];
  const fixes: Fix[] = [];
  const cap = PER_DAY[pace];
  if (!head.ok) {
    if (base.ok) regs.push({ slug, days, pace, kind: "NEW-THROW", detail: head.err });
    return { regs, fixes };
  }
  if (!base.ok) return { regs, fixes }; // base broken, head fixed → not a regression

  // NEW-WIDE / WIDE-FIXED — SET-wise by max-pair endpoint-name key (multiset), NOT by day-index:
  // days emit in itinerary order, so a reorder must not mask a new wide day nor invent churn.
  const baseWide = new Map<string, number>();
  for (const w of base.wideDays) baseWide.set(w.key, (baseWide.get(w.key) ?? 0) + 1);
  for (const w of head.wideDays) {
    const n = baseWide.get(w.key) ?? 0;
    if (n > 0) baseWide.set(w.key, n - 1); // matches a base wide day of the same endpoints → not new
    else regs.push({ slug, days, pace, kind: "NEW-WIDE", detail: `${w.key} ${w.span.toFixed(1)}km` });
  }
  for (const n of baseWide.values()) for (let k = 0; k < n; k++) fixes.push({ kind: "WIDE-FIXED", slug, days, pace }); // base wide day gone in head

  // NEW-OVERCAP / OVERCAP-FIXED — COUNT-wise: compare how many days exceed the pace cap, not per index.
  const baseOver = base.counts.filter((c) => c != null && c > cap).length;
  const headOver = head.counts.filter((c) => c != null && c > cap).length;
  for (let k = 0; k < headOver - baseOver; k++)
    regs.push({ slug, days, pace, kind: "NEW-OVERCAP", detail: `overcap days ${baseOver}→${headOver} (cap ${cap})` });
  for (let k = 0; k < baseOver - headOver; k++) fixes.push({ kind: "OVERCAP-FIXED", slug, days, pace });
  const bSet = new Set(base.marqueeSurfaced), hSet = new Set(head.marqueeSurfaced);
  const lateral = hSet.size >= bSet.size; // config surfaces ≥ as many marquees → the loss is a swap, not a net drop
  for (const m of bSet)
    if (!hSet.has(m)) {
      const silent = !head.noteBlob.includes(m); // pin gone AND unnamed in any note = #703-2 detector
      regs.push({ slug, days, pace, kind: silent ? "SILENT-VANISH" : "SIG-LOSS", detail: m, lateral });
    }
  for (const m of hSet) if (!bSet.has(m)) fixes.push({ kind: "SIG-GAIN", slug, days, pace });
  return { regs, fixes };
}

// ── allowlist ──────────────────────────────────────────────────────────────
type Allow = { slug: string; days: number; pace: string; kind: string; detail?: string; reason?: string; pr?: string };
function loadAllow(): Allow[] {
  if (!fs.existsSync(ALLOW_PATH)) return [];
  const out: Allow[] = [];
  const lines = fs.readFileSync(ALLOW_PATH, "utf-8").split("\n");
  for (let n = 0; n < lines.length; n++) {
    const l = lines[n].trim();
    if (!l || l.startsWith("//")) continue;
    try {
      out.push(JSON.parse(l) as Allow);
    } catch (e: any) {
      console.error(`✗ ${ALLOW_PATH}:${n + 1}: malformed allow line — ${String(e?.message || e)}\n    ${l}`);
      process.exit(2); // fail closed on a broken allowlist, but say which line
    }
  }
  return out;
}
// config key (slug|days|pace|kind); `detail` is matched separately so an allow entry can scope to ONE regression.
const allowKey = (r: { slug: string; days: number; pace: string; kind: string }) => `${r.slug}|${r.days}|${r.pace}|${r.kind}`;
// an allow line suppresses a reg when config matches AND (allow omits detail → any) OR (details are equal).
const isAllowed = (allow: Allow[], r: Reg) =>
  allow.some((a) => allowKey(a) === allowKey(r) && (a.detail == null || a.detail === r.detail));

// ── base build (worktree + cache-by-SHA) ────────────────────────────────────
const SCRATCH = process.env.CLAUDE_SCRATCH || path.join(os.tmpdir(), "planner-grid");
// Base metrics are computed against the WORKING-TREE KB (both sides read the same on-disk export), so
// the SHA alone is NOT a sufficient cache key — editing tourism-kb/export leaves stale base metrics.
// Mix in a light fingerprint of the export tree (per-file name+size+mtime, no content read).
function kbFingerprint(): string {
  const h = createHash("sha1");
  for (const s of fs.readdirSync(EXPORT_ROOT).sort()) {
    const dir = path.join(EXPORT_ROOT, s);
    let st: fs.Stats;
    try { st = fs.statSync(dir); } catch { continue; }
    if (!st.isDirectory()) continue;
    for (const f of fs.readdirSync(dir).sort()) {
      const fst = fs.statSync(path.join(dir, f));
      h.update(`${s}/${f}:${fst.size}:${Math.round(fst.mtimeMs)}\n`);
    }
  }
  return h.digest("hex").slice(0, 12);
}
function baseCacheFile(sha: string, kbFp: string): string {
  return path.join(SCRATCH, `grid-base-${sha.slice(0, 12)}-${kbFp}.json`);
}
async function buildBaseModule(sha: string): Promise<BuildFn> {
  const wt = path.join(SCRATCH, `wt-${sha.slice(0, 12)}`);
  if (!fs.existsSync(wt)) {
    fs.mkdirSync(SCRATCH, { recursive: true });
    git("worktree", "add", "--detach", wt, sha);
  }
  // base store.ts imports @aws-sdk/client-s3 → base subgraph needs node_modules; junction to repo's.
  const wtNm = path.join(wt, "node_modules");
  if (!fs.existsSync(wtNm)) {
    const repoNm = path.resolve("node_modules");
    fs.symlinkSync(repoNm, wtNm, process.platform === "win32" ? "junction" : "dir");
  }
  const basePlan = path.join(wt, "trip-planner", "lib", "planner", "plan.ts");
  const mod: any = await import(pathToFileURL(basePlan).href);
  return mod.buildItinerary as BuildFn;
}
function cleanupWorktree(sha: string) {
  const wt = path.join(SCRATCH, `wt-${sha.slice(0, 12)}`);
  if (!fs.existsSync(wt)) return;
  // Remove the node_modules junction FIRST — `git worktree remove` (and rmSync) choke on it
  // ("Directory not empty"). unlinkSync on a junction removes the link, not repo's node_modules.
  const wtNm = path.join(wt, "node_modules");
  try { if (fs.existsSync(wtNm)) fs.unlinkSync(wtNm); } catch { /* fall through */ }
  try { git("worktree", "remove", "--force", wt); } catch { try { fs.rmSync(wt, { recursive: true, force: true }); git("worktree", "prune"); } catch { /* leave for next run */ } }
}

// ── main ──────────────────────────────────────────────────────────────────
(async () => {
  const baseRef = argVal("--base") || "master";
  const baseSha = git("merge-base", "HEAD", baseRef);
  const headSha = git("rev-parse", "HEAD");
  const units = (slugFilter ?? allUnits()).filter((s) => fs.existsSync(path.join(EXPORT_ROOT, s, "diem-den.json")));
  console.log(`grid-diff: head ${headSha.slice(0, 8)} vs base ${baseSha.slice(0, 8)} (merge-base with ${baseRef})`);
  console.log(`units=${units.length} · days=${DAYS.join(",")} · paces=${PACES.join(",")} · ${units.length * DAYS.length * PACES.length} configs/side\n`);

  if (baseSha === headSha) console.log("NOTE: base == head → expect 0 diff (plumbing self-test).\n");

  const pools = new Map<string, string[]>();
  for (const s of units) pools.set(s, marqueeNames(s));

  // base metrics: cache by SHA, incrementally covering units. A partial cache (from an earlier
  // --slug run) MUST NOT silently skip units in a full run — compute any MISSING keys and merge.
  const cacheFile = baseCacheFile(baseSha, kbFingerprint());
  let baseMetrics: Record<string, ConfigMetric> = {};
  if (!REBUILD_BASE && fs.existsSync(cacheFile)) baseMetrics = JSON.parse(fs.readFileSync(cacheFile, "utf-8"));
  const needKeys: [string, number, string][] = [];
  for (const s of units) for (const d of DAYS) for (const p of PACES)
    if (REBUILD_BASE || !(`${s}|${d}|${p}` in baseMetrics)) needKeys.push([s, d, p]);
  if (!needKeys.length) {
    console.log(`base: cache complete for ${units.length} unit(s) — ${path.relative(process.cwd(), cacheFile)}\n`);
  } else {
    console.log(`base: building ${needKeys.length} missing config(s) via worktree…`);
    const buildBase = baseSha === headSha ? (buildHead as BuildFn) : await buildBaseModule(baseSha);
    for (const [s, d, p] of needKeys) baseMetrics[`${s}|${d}|${p}`] = metricsOf(buildBase, s, d, p, pools.get(s)!);
    fs.mkdirSync(SCRATCH, { recursive: true });
    fs.writeFileSync(cacheFile, JSON.stringify(baseMetrics));
    if (baseSha !== headSha && !KEEP_WT) cleanupWorktree(baseSha);
    console.log(`base: cached ${path.relative(process.cwd(), cacheFile)}\n`);
  }

  // head metrics + diff
  const allow = loadAllow();
  const regs: Reg[] = [];
  const fixes: Fix[] = [];
  let changed = 0;
  for (const s of units) for (const d of DAYS) for (const p of PACES) {
    const key = `${s}|${d}|${p}`;
    const b = baseMetrics[key];
    if (!b) continue; // slug filtered out of a prior full-cache base
    const h = metricsOf(buildHead as BuildFn, s, d, p, pools.get(s)!);
    const { regs: r, fixes: f } = diffConfig(s, d, p, b, h);
    if (r.length || f.length) changed++;
    regs.push(...r);
    fixes.push(...f);
  }

  // ── report ──
  const byKind = (arr: { kind: string }[]) => arr.reduce<Record<string, number>>((m, x) => ((m[x.kind] = (m[x.kind] || 0) + 1), m), {});
  const sigLoss = regs.filter((r) => r.kind === "SIG-LOSS");
  const latN = sigLoss.filter((r) => r.lateral).length;
  console.log(`── changed configs: ${changed} ──`);
  console.log("FIXES  :", JSON.stringify(byKind(fixes)));
  console.log("REGRESS:", JSON.stringify(byKind(regs)));
  if (sigLoss.length) console.log(`  └─ SIG-LOSS split: ${latN} lateral (compensated) / ${sigLoss.length - latN} NET-LOSS (scrutinize)`);
  console.log("");

  const unallowed = regs.filter((r) => !isAllowed(allow, r));
  const allowed = regs.filter((r) => isAllowed(allow, r));
  if (allowed.length) console.log(`(${allowed.length} regression(s) suppressed by ${ALLOW_PATH})\n`);

  if (unallowed.length) {
    // Surface NET-LOSS + non-SIG-LOSS regressions FIRST (need human eyes); lateral SIG-LOSS are compensated swaps.
    const netLoss = unallowed.filter((r) => r.kind !== "SIG-LOSS" || !r.lateral);
    const lateralLoss = unallowed.filter((r) => r.kind === "SIG-LOSS" && r.lateral);
    console.log(`✗ ${unallowed.length} UN-ALLOWLISTED regression(s): ${netLoss.length} need review, ${lateralLoss.length} lateral SIG-LOSS\n`);
    if (netLoss.length) {
      console.log("  NEED REVIEW (net-loss / span / overcap / vanish):");
      for (const r of netLoss.slice(0, 200)) console.log(`    ${r.kind.padEnd(13)} ${r.slug} ${r.days}d/${r.pace}: ${r.detail}`);
    }
    if (lateralLoss.length) {
      console.log(`\n  LATERAL SIG-LOSS (net marquee count held ≥ base — a different flagship surfaced):`);
      for (const r of lateralLoss.slice(0, 60)) console.log(`    ${r.slug} ${r.days}d/${r.pace}: −${r.detail}`);
    }
    // detail is part of the printed allow line AND the dedup key → one paste-ready line per DISTINCT
    // (slug,days,pace,kind,detail) regression, so an allow entry suppresses only that specific one.
    const line = (r: Reg, reason: string) => JSON.stringify({ slug: r.slug, days: r.days, pace: r.pace, kind: r.kind, detail: r.detail, reason, pr: "TODO" });
    console.log(`\nPaste-ready allow lines for ${ALLOW_PATH} (set pr, review each reason):`);
    const seen = new Set<string>();
    for (const r of unallowed) {
      const k = `${allowKey(r)}|${r.detail}`;
      if (seen.has(k)) continue;
      seen.add(k);
      const reason = r.kind === "SIG-LOSS" && r.lateral ? "lateral reshuffle (net marquee ≥ base)" : "TODO-REVIEW";
      console.log(`  ${line(r, reason)}`);
    }
    process.exit(1);
  }
  console.log("✓ 0 un-allowlisted regressions — gate PASS.");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(2); });
