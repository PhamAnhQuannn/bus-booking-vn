#!/usr/bin/env node
// Bundle-size budget gate (#778) — enforces a per-route first-load JS regression budget,
// derived from FD-027 §4 (Performance Budget). Run AFTER `pnpm build`.
//
// WHY: FD-027 targets a mid-range Android on 4G. Customer pages are data-cost-sensitive, so
// the spec sets a per-route first-load JS budget (§4.1: 150 KB soft / 200 KB hard, gzipped)
// and asks CI to block merges that regress it (§4.3 / §10.2). This gate sums the gzipped
// first-load JS per route and fails if any CUSTOMER route exceeds the hard budget.
//
// DATA SOURCE (Next 16 + Turbopack): Next 16 dropped the per-route size columns from the
// build output AND no longer emits .next/app-build-manifest.json. We therefore reconstruct
// each route's client chunk set from:
//   - .next/build-manifest.json  → rootMainFiles (the shared JS every app route first-loads)
//   - .next/server/app/**/page_client-reference-manifest.js → the route's client modules,
//     each carrying its `chunks` list (the RSC client-reference manifest).
// First-load JS(route) = gzip-sum of the UNION of rootMainFiles + the route's client chunks.
// Summing per-file gzip slightly over-approximates the wire size (each file re-inits the gzip
// window) — a conservative bias, appropriate for a regression gate.
//
// BUDGET CALIBRATION (#778): the current tree already ships FAR above the FD-027 target — the
// Turbopack shared baseline alone is ~203 KB gzipped, and customer routes are ~330–430 KB.
// Per the issue, a self-blocking gate must STOP REGRESSION, not block launch, so the active
// hard budget is set just above today's worst customer route (headroom for churn). The FD-027
// target (150/200 KB) is retained below as the aspirational goal and reported as a finding.
// FOLLOW-UP (#778): customer first-load JS is ~2–3x the FD-027 budget — investigate the 144 KB
// shared root chunk and the ~88 KB homepage map chunk (Leaflet/protomaps) for code-splitting.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, resolve } from 'node:path';
import vm from 'node:vm';

const KB = 1024;
const ROOT = resolve(process.cwd());
const NEXT_DIR = join(ROOT, '.next');
const BUILD_MANIFEST = join(NEXT_DIR, 'build-manifest.json');
const APP_SERVER_DIR = join(NEXT_DIR, 'server', 'app');

// ---- Budgets (gzipped JS, KB). See BUDGET CALIBRATION above. ----
// FD-027 §4.1 aspirational target (reported, not enforced as the block today):
const FD027_SOFT_KB = 150;
const FD027_HARD_KB = 200;
// Active regression budget for the CUSTOMER group — calibrated to today's max (~430 KB) with
// headroom. FAIL above HARD, WARN above SOFT. Lower these toward FD-027 as bundles shrink;
// never raise without a matching perf-work justification (#778: gate stops regression).
const CUSTOMER_HARD_KB = 470;
const CUSTOMER_SOFT_KB = 440;

if (!existsSync(BUILD_MANIFEST)) {
  console.error(`bundle-size: ${BUILD_MANIFEST} not found. Run \`pnpm build\` first.`);
  process.exit(1);
}
if (!existsSync(APP_SERVER_DIR)) {
  console.error(`bundle-size: ${APP_SERVER_DIR} not found. Run \`pnpm build\` first.`);
  process.exit(1);
}

const gzCache = new Map();
function gz(rel) {
  if (gzCache.has(rel)) return gzCache.get(rel);
  const abs = join(NEXT_DIR, rel);
  const size = existsSync(abs) ? gzipSync(readFileSync(abs)).length : 0;
  gzCache.set(rel, size);
  return size;
}
function gzSum(files) {
  let total = 0;
  for (const f of files) if (f.endsWith('.js')) total += gz(f);
  return total;
}

// Shared JS first-loaded on every app route.
const rootMainFiles = JSON.parse(readFileSync(BUILD_MANIFEST, 'utf8')).rootMainFiles ?? [];

// Recursively collect every page_client-reference-manifest.js (one per navigable route).
function findPageManifests(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...findPageManifests(p));
    else if (name === 'page_client-reference-manifest.js') out.push(p);
  }
  return out;
}

/** Load a client-reference manifest and return { route, chunks:Set }. */
function parseManifest(file) {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(`globalThis.__RSC_MANIFEST = globalThis.__RSC_MANIFEST || {};`, ctx);
  vm.runInContext(readFileSync(file, 'utf8'), ctx);
  const manifest = ctx.__RSC_MANIFEST ?? {};
  const route = Object.keys(manifest)[0];
  if (!route) return null;
  const chunks = new Set(rootMainFiles);
  for (const mod of Object.values(manifest[route].clientModules ?? {})) {
    for (const ch of mod.chunks ?? []) {
      chunks.add(ch.replace(/^\/_next\//, '').replace(/^\//, ''));
    }
  }
  return { route, chunks };
}

function groupOf(route) {
  if (route.includes('(customer)')) return 'customer';
  if (/\/op\//.test(route) || route.includes('(op)')) return 'operator';
  if (/\/admin\//.test(route) || route.includes('/admin')) return 'admin';
  return 'other';
}

const routes = [];
for (const file of findPageManifests(APP_SERVER_DIR)) {
  const parsed = parseManifest(file);
  if (!parsed) continue;
  routes.push({ route: parsed.route, group: groupOf(parsed.route), gz: gzSum(parsed.chunks) });
}
routes.sort((a, b) => b.gz - a.gz);

const fmt = (bytes) => `${(bytes / KB).toFixed(1)} KB`;

console.log('--- bundle-size: first-load JS (gzipped) per route (#778, FD-027 §4) ---');
console.log(`Shared baseline (rootMainFiles): ${fmt(gzSum(rootMainFiles))}`);
console.log(`Customer budget — SOFT ${CUSTOMER_SOFT_KB} KB / HARD ${CUSTOMER_HARD_KB} KB (FD-027 target: ${FD027_SOFT_KB}/${FD027_HARD_KB})`);
for (const g of ['customer', 'operator', 'admin']) {
  const rs = routes.filter((r) => r.group === g);
  if (rs.length === 0) continue;
  console.log(`\n[${g}] ${rs.length} routes — largest:`);
  for (const r of rs.slice(0, 5)) console.log(`  ${fmt(r.gz).padStart(9)}  ${r.route}`);
}

// ---- Gate: customer routes only ----
let failures = 0;
let warnings = 0;
const customer = routes.filter((r) => r.group === 'customer');
if (customer.length === 0) {
  console.error('FAIL  no customer routes found in build manifests — gate misconfigured (route grouping or manifest paths changed).');
  process.exit(1);
}
for (const r of customer) {
  const kb = r.gz / KB;
  if (kb > CUSTOMER_HARD_KB) {
    console.error(`\nFAIL  customer route over HARD budget (${CUSTOMER_HARD_KB} KB): ${fmt(r.gz)}  ${r.route}`);
    failures++;
  } else if (kb > CUSTOMER_SOFT_KB) {
    console.warn(`\nWARN  customer route over SOFT budget (${CUSTOMER_SOFT_KB} KB): ${fmt(r.gz)}  ${r.route}`);
    warnings++;
  }
}

// FD-027 aspirational-target finding (informational — does NOT fail the build).
const overFd027 = customer.filter((r) => r.gz / KB > FD027_HARD_KB).length;

console.log('\n=== Bundle Size Budget (#778) ===');
const max = customer[0];
console.log(`Customer routes: ${customer.length}  |  largest: ${max ? `${fmt(max.gz)} (${max.route})` : 'none'}`);
if (overFd027 > 0) {
  console.log(`NOTE  ${overFd027}/${customer.length} customer routes exceed the FD-027 target (${FD027_HARD_KB} KB gzipped) — tracked as a #778 perf follow-up, not blocking.`);
}
console.log(`Failures: ${failures}  Warnings: ${warnings}`);
process.exit(failures > 0 ? 1 : 0);
