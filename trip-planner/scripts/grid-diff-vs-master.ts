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
// ({slug,days,pace,kind,reason,pr}); the script prints a paste-ready allow line for each NEW one.
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
const spanKm = (pts: { lat: number | null; lon: number | null }[]): number => {
  const p = pts.filter((q) => q.lat != null && q.lon != null) as { lat: number; lon: number }[];
  let mx = 0;
  for (let i = 0; i < p.length; i++)
    for (let j = i + 1; j < p.length; j++)
      mx = Math.max(mx, haversine(p[i].lat, p[i].lon, p[j].lat, p[j].lon) / 1000);
  return mx;
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
  if (!hl.length) for (const r of recs.slice(0, AUTO_MARQUEE_K)) pool.add(r.name); // auto-marquee only when no hand-list
  for (const r of recs) if (r.ext?.destination?.loi_vao_dac_trung) pool.add(r.name); // sig-access
  return [...pool];
}

// ── per-config metrics ────────────────────────────────────────────────────────
type ConfigMetric =
  | { ok: false; err: string }
  | {
      ok: true;
      dayCount: number;
      spans: number[]; // per day-index
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
  const spans: number[] = [];
  const counts: number[] = [];
  const surfaced = new Set<string>();
  const poolFolded = pool.map(fold);
  for (const d of it.days) {
    const dd = d.items.filter((i) => i.role === "diem-den");
    spans.push(spanKm(dd.map((i) => ({ lat: i.lat, lon: i.lon }))));
    counts.push(dd.length);
    for (const i of dd) {
      const nf = fold(i.name);
      for (let k = 0; k < pool.length; k++)
        if (poolFolded[k] === nf || nameMatch(pool[k], i.name)) surfaced.add(poolFolded[k]);
    }
  }
  return { ok: true, dayCount: it.days.length, spans, counts, marqueeSurfaced: [...surfaced], noteBlob: fold(it.notes.join(" ‖ ")) };
}

// ── diff one config → regression + fix records ─────────────────────────────────
type Kind = "NEW-WIDE" | "SIG-LOSS" | "NEW-OVERCAP" | "SILENT-VANISH" | "NEW-THROW";
type Reg = { slug: string; days: number; pace: string; kind: Kind; detail: string };
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
  const nDays = Math.max(base.dayCount, head.dayCount);
  for (let i = 0; i < nDays; i++) {
    const bSpan = base.spans[i], hSpan = head.spans[i];
    const bWide = bSpan != null && bSpan > WIDE_DAY_KM;
    const hWide = hSpan != null && hSpan > WIDE_DAY_KM;
    if (hWide && !bWide) regs.push({ slug, days, pace, kind: "NEW-WIDE", detail: `day${i + 1} span ${hSpan!.toFixed(1)}km (base ${bSpan == null ? "—" : bSpan.toFixed(1)})` });
    if (bWide && !hWide) fixes.push({ kind: "WIDE-FIXED", slug, days, pace });
    const bOver = base.counts[i] != null && base.counts[i] > cap;
    const hOver = head.counts[i] != null && head.counts[i] > cap;
    if (hOver && !bOver) regs.push({ slug, days, pace, kind: "NEW-OVERCAP", detail: `day${i + 1} ${head.counts[i]} > ${cap}` });
    if (bOver && !hOver) fixes.push({ kind: "OVERCAP-FIXED", slug, days, pace });
  }
  const bSet = new Set(base.marqueeSurfaced), hSet = new Set(head.marqueeSurfaced);
  for (const m of bSet)
    if (!hSet.has(m)) {
      const silent = !head.noteBlob.includes(m); // pin gone AND unnamed in any note = #703-2 detector
      regs.push({ slug, days, pace, kind: silent ? "SILENT-VANISH" : "SIG-LOSS", detail: m });
    }
  for (const m of hSet) if (!bSet.has(m)) fixes.push({ kind: "SIG-GAIN", slug, days, pace });
  return { regs, fixes };
}

// ── allowlist ──────────────────────────────────────────────────────────────
type Allow = { slug: string; days: number; pace: string; kind: string; reason?: string; pr?: string };
function loadAllow(): Allow[] {
  if (!fs.existsSync(ALLOW_PATH)) return [];
  return fs
    .readFileSync(ALLOW_PATH, "utf-8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("//"))
    .map((l) => JSON.parse(l) as Allow);
}
const allowKey = (r: { slug: string; days: number; pace: string; kind: string }) => `${r.slug}|${r.days}|${r.pace}|${r.kind}`;

// ── base build (worktree + cache-by-SHA) ────────────────────────────────────
const SCRATCH = process.env.CLAUDE_SCRATCH || path.join(os.tmpdir(), "planner-grid");
function baseCacheFile(sha: string): string {
  return path.join(SCRATCH, `grid-base-${sha.slice(0, 12)}.json`);
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

  // base metrics: cache by SHA, else build via worktree module
  const cacheFile = baseCacheFile(baseSha);
  let baseMetrics: Record<string, ConfigMetric>;
  if (!REBUILD_BASE && fs.existsSync(cacheFile)) {
    baseMetrics = JSON.parse(fs.readFileSync(cacheFile, "utf-8"));
    console.log(`base: loaded cache ${path.relative(process.cwd(), cacheFile)}\n`);
  } else {
    console.log("base: building via worktree…");
    const buildBase = baseSha === headSha ? (buildHead as BuildFn) : await buildBaseModule(baseSha);
    baseMetrics = {};
    for (const s of units) for (const d of DAYS) for (const p of PACES)
      baseMetrics[`${s}|${d}|${p}`] = metricsOf(buildBase, s, d, p, pools.get(s)!);
    fs.mkdirSync(SCRATCH, { recursive: true });
    fs.writeFileSync(cacheFile, JSON.stringify(baseMetrics));
    if (baseSha !== headSha && !KEEP_WT) cleanupWorktree(baseSha);
    console.log(`base: cached ${path.relative(process.cwd(), cacheFile)}\n`);
  }

  // head metrics + diff
  const allow = loadAllow();
  const allowSet = new Set(allow.map(allowKey));
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
  console.log(`── changed configs: ${changed} ──`);
  console.log("FIXES  :", JSON.stringify(byKind(fixes)));
  console.log("REGRESS:", JSON.stringify(byKind(regs)), "\n");

  const unallowed = regs.filter((r) => !allowSet.has(allowKey(r)));
  const allowed = regs.filter((r) => allowSet.has(allowKey(r)));
  if (allowed.length) console.log(`(${allowed.length} regression(s) suppressed by ${ALLOW_PATH})\n`);

  if (unallowed.length) {
    console.log(`✗ ${unallowed.length} UN-ALLOWLISTED regression(s):\n`);
    for (const r of unallowed.slice(0, 200))
      console.log(`  ${r.kind.padEnd(13)} ${r.slug} ${r.days}d/${r.pace}: ${r.detail}`);
    if (unallowed.length > 200) console.log(`  … +${unallowed.length - 200} more`);
    console.log(`\nIf any are intended, append to ${ALLOW_PATH} (paste-ready):`);
    const seen = new Set<string>();
    for (const r of unallowed) {
      const k = allowKey(r);
      if (seen.has(k)) continue;
      seen.add(k);
      console.log(`  ${JSON.stringify({ slug: r.slug, days: r.days, pace: r.pace, kind: r.kind, reason: "TODO", pr: "TODO" })}`);
    }
    process.exit(1);
  }
  console.log("✓ 0 un-allowlisted regressions — gate PASS.");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(2); });
