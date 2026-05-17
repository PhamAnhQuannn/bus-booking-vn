---
name: dependency-update
description: Monthly dependency upgrade pass — vuln scan, breaking-change scan, batch ordering by blast radius, regression budget per batch, rollout sequence with per-batch rollback. Language-aware (npm/pip/go/cargo). Read-only emit-script (never auto-upgrade). Use when user says "update deps", "bump packages", "renovate review", "dependabot", "monthly upgrade", "/dependency-update", or when `/hipaa-risk-assessment` chains here.
output_size:
  XS: skip
  S: 1h
  M: 2h
  L: 3h
  XL: 4h
---

# /dependency-update — Monthly Dependency Upgrade Pass

## Why you'd care

Three failure modes hide inside any "let's just update everything" Friday afternoon:

- **Update everything at once** — 47 packages bumped in one PR. Test suite goes red. You spend 6 hours bisecting which dep broke what, then revert the whole batch and ship none of the fixes including the Critical CVE.
- **Skip vuln scan, trust GitHub Dependabot alerts** — alerts cover direct deps only; the transitive dep with the actively-exploited RCE doesn't trigger because nothing in your `package.json` mentions it by name.
- **Ship core framework + leaf libs in same deploy** — React 18 → 19 AND lodash patch AND new auth SDK MAJOR ship together; auth migration takes 4 days; React migration takes 3 weeks; you can't roll back React without also rolling back the auth fix. So neither ships.

One pre-written pass, monthly cadence (or CVE-Critical ad-hoc), buckets by severity + semver-delta + blast-radius and ships in ordered batches with regression budget per batch. Read-only emit-script — never auto-executes. Pairs tight with `/dead-code-scan` (post-bump orphans), `/hipaa-risk-assessment` (compliance trigger), and `/rollback-plan` (per-batch reverse).

Invoke as `/dependency-update`. Read-only scan + emit graded batch plan; you run each batch manually.

## When This Skill Applies

Triggers (user phrases):
- "update deps", "bump packages", "renovate review", "dependabot review", "monthly upgrade"
- "/dependency-update"
- "audit dependencies", "vuln scan", "outdated packages", "what needs updating"

Auto-invoke (chained FROM):
- **`/hipaa-risk-assessment`** — compliance pass requires current dep posture + vuln-status snapshot. This skill produces the snapshot.
- **Monthly cadence** — if `/project-status` detects > 30 days since last `dependency-update-*.md`, surface as a TODO.
- **CVE-Critical alert** — any Critical / 9.0+ CVSS in a direct or transitive dep skips the monthly cadence and fires ad-hoc.

## Pre-flight

1. **Lockfile committed.** `package-lock.json` / `pnpm-lock.yaml` / `poetry.lock` / `go.sum` / `Cargo.lock` must be in git. Missing lockfile = halt (cannot diff lockfile state, cannot guarantee reproducible bump).
2. **Test suite green on current versions.** Run `/verify` (or `npm test`) before any bump. If red on current → fix that first; don't pile dep-bump regressions on existing failures.
3. **Coverage trust check.** `/coverage-map` output recent enough (< 60d) to trust regression signal. Stale coverage = false confidence; bumps land "green" against tests that don't exercise the changed code.
4. **Class check.** Read `docs/classify/<project>.md`. Class **XS** → SKIP (single-user CLI doesn't need monthly hygiene; revisit at S+).
5. **Branch / PR strategy.** Default: one branch per batch (not per package). XL projects with many batches may use one PR per batch all stacked.
6. **Regression budget agreed.** What test-failure % is acceptable per batch? Default 0% (any new red = abort batch); some teams accept up to 5% for low-risk leaf-dep batches.

## Inputs

- **Project root** + detected package manager.
- **Vuln-feed source** — `npm-audit | pip-audit | govulncheck | cargo-audit | snyk | github-advisories`. Default = official tool per language.
- **Breaking-change tolerance** — `low | medium | high`. Low = no MAJORs this month (defer); medium = MAJOR only if security-driven; high = MAJORs welcome with dedicated PR per package.
- **CVE-Critical threshold** — default CVSS ≥ 9.0 (or any RCE / auth-bypass regardless of score).
- **Period slug** — `2026-05` (monthly) OR `cve-yyyy-xxxx-emergency` (ad-hoc).

## Language × tool branch

Detect package manager, pick the pair:

| Language | Vuln scan | Outdated scan | Notes |
|---|---|---|---|
| npm / pnpm / yarn | `npm audit` / `pnpm audit` (or `yarn npm audit`) | `pnpm outdated` / `npm outdated` | Pair with `npx better-npm-audit` for non-prod-only filter. `pnpm audit --prod` for runtime-only |
| pip / poetry | `pip-audit` (uvx pip-audit) | `pip list --outdated` / `poetry show --outdated` | `safety check` is alternative; pip-audit pulls from PyPI Advisory DB |
| Go | `govulncheck ./...` | `go list -u -m all` | `govulncheck` is call-graph aware (only flags vulns ACTUALLY reachable from your code) — high signal-to-noise |
| Rust | `cargo audit` | `cargo outdated` (or `cargo-edit`) | `cargo audit` consumes RustSec Advisory DB; pair with `cargo-deny` for license + dupe checks |
| Java / Maven | `mvn dependency-check:check` (OWASP plugin) | `mvn versions:display-dependency-updates` | Heavy plugin — schedule outside CI hot path |
| Ruby | `bundler-audit check` | `bundle outdated` | RubyGems Advisory DB |
| .NET | `dotnet list package --vulnerable` | `dotnet list package --outdated` | Built-in since .NET 5 |
| PHP / Composer | `composer audit` | `composer outdated` | FriendsOfPHP/security-advisories |

**Monorepo note:** run per-workspace (cross-ref `/workspace-detect`). A vuln in `apps/web` is not the same urgency as a vuln in `tools/scripts` even if same package name.

## Process

1. **Run vuln scan, capture CVEs by severity.** Tool per language (table above). Categorize:

   | Severity | CVSS | Action |
   |---|---|---|
   | Critical | 9.0–10.0 | P1 — ship today, ad-hoc batch |
   | High | 7.0–8.9 | P1 — this batch (within 7d) |
   | Medium | 4.0–6.9 | P2 — next monthly batch |
   | Low | < 4.0 | P3 — opportunistic |

   Filter by reachability where tool supports (govulncheck does; npm audit doesn't — manual triage required for dev-only deps).

2. **Run outdated scan, capture by semver delta.**

   | Delta | Example | Default action |
   |---|---|---|
   | Patch | `1.2.3 → 1.2.7` | Auto-bump in patch-roundup batch (P2) |
   | Minor | `1.2.3 → 1.5.0` | Patch-roundup batch (P2); read changelog for behavior changes |
   | Major | `1.2.3 → 2.0.0` | Dedicated PR per package (P3); read full migration guide |

3. **Read changelogs for each non-patch bump.** Breaking-change detection — every MINOR with "BREAKING:" tag, every MAJOR. For each MAJOR:
   - Note migration steps required
   - Note expected test-suite impact (small / medium / large rewrite)
   - Note any paired changes (e.g. React MAJOR → may force `react-dom` + `@testing-library/react` paired bumps)

4. **Bucket into batches.** Three priority tiers, ordered by ship-window:

   | Bucket | Contents | When | PR strategy |
   |---|---|---|---|
   | **P1 — Security-critical** | Critical CVE + High CVE | Ship within 7d (Critical = today) | One PR, narrow scope, fast-tracked review |
   | **P2 — Patch + Minor roundup** | All Patch bumps + non-breaking Minor bumps + Medium CVEs | Weekly batch on Tuesday (or monthly per period) | One PR for entire roundup |
   | **P3 — Major bumps** | Each MAJOR bump | One PR per package, dedicated review | Spread across the month |

5. **Order batches by blast radius (low → high).** Per-batch sequence:
   - Tier 1: leaf utility deps (lodash, date-fns, axios) — low blast, easy to revert
   - Tier 2: mid-tier libs (testing libs, build tooling, lint tooling) — medium blast
   - Tier 3: framework + runtime (React/Vue, Express/FastAPI, Postgres driver) — high blast, dedicated batch

   Rationale: if Tier 1 batch breaks something, you've isolated cause to 5 lodash-shaped packages, not "the 47-package update PR".

6. **Per-batch execution.** For each batch:
   - Create branch `deps/<period>/<batch>` (e.g. `deps/2026-05/p1-security`)
   - Bump package versions in manifest (per-batch package list)
   - Regenerate lockfile
   - Run test suite → record pass/fail count vs baseline
   - Run `/verify` (typecheck + lint + tests for changed scope)
   - Run `/smoke-test` if Tier 2+ (UI / API surface dependency)
   - If failures > regression budget → abort batch; do not ship; investigate which package caused regression

7. **Regression budget per batch.** Acceptable test-failure count before rollback:
   - P1 security batch: 0% (any new failure aborts; security urgency does NOT override correctness)
   - P2 patch-roundup: 0% default; up to 5% acceptable if all failures are in same single-package test file (suggests one bad dep — isolate + remove from batch + retry)
   - P3 major: per-package; MAJOR bump expected to have some test churn (migration work); document the acceptable churn in batch PR description

8. **Rollout sequence (staging soak per batch).** Per batch:
   - Merge to staging → soak 24h (Tier 1) / 48h (Tier 2) / 7d (Tier 3 framework)
   - Watch error rate + p95 + business KPIs in staging
   - Ship to prod with `/rollback-plan` referenced (revert PR pre-created if Tier 3)
   - 24h prod observation per batch before next batch ships
   - Tier 3 framework batches: one batch per ship-window; never overlap

9. **Transitive-dep audit (sub-deps that arrived via direct-dep upgrade).** After each batch's lockfile regenerated, diff transitive deps:
   ```
   git diff HEAD~1 pnpm-lock.yaml | grep -E '^[\+\-]\s+/' | head -50
   ```
   Flag any unexpected adds (e.g. `axios → 1.6.0` brought in `proxy-from-env` 2.0.0 — was 1.x before).
   Run vuln scan AGAIN post-bump to catch new transitive CVEs.

10. **Lockfile + audit re-run after each batch lands.** Update the running tally:
    - `vuln_summary` updated post-batch (CVE counts should monotonically decrease for P1+P2; can fluctuate during P3 as new transitives appear)
    - `lockfile_sha` recorded per batch
    - `sbom_regenerated` if `/sbom-generate` skill present in project (HIPAA / SOC2 / regulated trigger)

## Output Format

Write `docs/ops/dependency-update-<period>.md`:

```markdown
---
period: <YYYY-MM | cve-emergency-yyyy-xxxx>
package_manager: <pnpm | npm | yarn | pip | poetry | go | cargo | maven | bundler | dotnet | composer>
lockfile_path: <path/to/lockfile>
lockfile_sha_before: <sha>
lockfile_sha_after: <sha | null until last batch lands>
vuln_summary_before:
  critical: 0
  high: 2
  medium: 7
  low: 14
vuln_summary_after:
  critical: 0
  high: 0
  medium: 3
  low: 11
batches:
  - p1-security
  - p2-patch-roundup
  - p3-react-19-major
regression_budget_pct: 5
status: <planning | in-progress | completed>
sbom_regenerated: <true | false | n/a>
companion_docs:
  rollback_plan: <link>
  coverage_map: <link>
  dead_code_scan: <link>
---

# Dependency Update — <period>

## 1. Vuln-scan results (pre-bump)
| Severity | Count | Tool |
|---|---:|---|
| Critical | 0 | pnpm audit |
| High | 2 | pnpm audit |
| Medium | 7 | pnpm audit |
| Low | 14 | pnpm audit |

Direct CVEs requiring action:
- `axios@0.27.2` — CVE-2026-XXXX (High, CVSS 7.5) — SSRF; upgrade ≥ 1.7.0
- `<other>@<v>` — CVE-... — Medium; ...

## 2. Outdated scan
| Package | Current | Latest | Delta | Bucket |
|---|---|---|---|---|
| axios | 0.27.2 | 1.7.4 | MAJOR | P1 (security-driven) |
| date-fns | 2.30.0 | 2.30.0-patch.3 | PATCH | P2 |
| eslint | 8.42 | 9.0.0 | MAJOR | P3 (dedicated PR) |
| typescript | 5.4.2 | 5.4.5 | PATCH | P2 |
| ... | | | | |

## 3. Batches

### P1 — Security batch (ship 2026-05-15)
**Packages:** axios 0.27.2 → 1.7.4 (CVE-2026-XXXX)
**Regression budget:** 0%
**Blast radius:** Tier 2 (used in 12 modules)
**Migration steps:**
- axios MAJOR: response shape changes for `axios.create()` instances; check `lib/http-client.ts`
- Verify webhook signature flow (uses axios internally)
**Test plan:** `/verify` + smoke-test all API integration paths
**Rollback:** revert PR pre-created at `<link>`; per `/rollback-plan` Tier 4 (code revert)
**Status:** [ ] Branch created [ ] Tests pass [ ] Staging soak [ ] Prod ship

### P2 — Patch + Minor roundup (ship 2026-05-22)
**Packages:** date-fns, typescript, prettier, vitest, @types/*, ... (~28 packages)
**Regression budget:** 5%
**Blast radius:** Tier 1 (utility/tooling)
**Migration steps:** none expected (all PATCH + non-breaking MINOR per changelog)
**Test plan:** full test suite; staging soak 24h
**Rollback:** revert PR per package if isolated; otherwise full batch revert
**Status:** [ ] Branch created [ ] ...

### P3 — React 19 MAJOR (dedicated PR, ship 2026-05-29 or defer to 2026-06)
**Packages:** react 18.2 → 19.0; react-dom 18.2 → 19.0; @testing-library/react 14 → 15
**Regression budget:** documented expected churn (~30 component tests need useEffect cleanup updates)
**Blast radius:** Tier 3 (framework — every component)
**Migration steps:** React 19 migration guide — Suspense behavior changes; `useEffect` cleanup timing; `forwardRef` deprecation
**Test plan:** full test suite + full E2E + 7d staging soak + canary 10% in prod
**Rollback:** per `/rollback-plan`; Tier 3 deploy = blue-green if available; otherwise image revert
**Status:** [ ] Migration guide read [ ] Branch created [ ] Component audit [ ] ...

## 4. Transitive-dep watch
Post-P1 batch, monitor for new transitive deps introduced by axios 1.7.4:
- `proxy-from-env`, `form-data`, `follow-redirects` — verify versions; re-run vuln scan
- Any new sub-deps surfaced → log in this section + re-run audit

## 5. Per-batch rollback
| Batch | Rollback action | SLA |
|---|---|---|
| P1 | Revert PR + redeploy | 15 min |
| P2 | Revert PR + redeploy | 15 min |
| P3 | Blue-green flip-back OR image revert (Tier 3 — full deploy cycle) | 30 min |

## 6. Post-batch verification
- [ ] Vuln scan re-run after each batch lands
- [ ] `/dead-code-scan` re-run after P3 to find newly-orphaned imports (React 19 may obsolete some packages)
- [ ] `/contract-test` run if HTTP/API dep bumped (axios bump → re-run integration tests against staging endpoints)
- [ ] `/sbom-generate` (if HIPAA / SOC2 / regulated project)

## 7. Schedule
- P1: 2026-05-15 (security urgency overrides cadence)
- P2: 2026-05-22 (Tuesday batch)
- P3: 2026-05-29 (dedicated PR window) OR defer to 2026-06 if P1+P2 regression budget consumed
```

## Multi-vertical worked examples

### TypeScript SaaS monorepo — pnpm workspace, 4 packages, mixed-tier
- **Detector**: `pnpm-lock.yaml` + `pnpm-workspace.yaml`. Cross-ref `/workspace-detect`.
- **Vuln scan**: `pnpm audit --prod` per workspace; results aggregated.
- **Outdated**: `pnpm outdated -r` (recursive workspace).
- **Buckets**: 1 Critical (Redis client RCE) → P1 today; 23 patch + 4 minor → P2 weekly; 3 MAJORs (React 19, ESLint 9, Vitest 2) → P3 spread.
- **Per-workspace blast**: vuln in `apps/web` urgent (customer-facing); same vuln in `tools/scripts` lower (internal-only).
- **Output**: `docs/ops/dependency-update-2026-05.md` with batches scoped to workspace.

### Python data app — Poetry, FastAPI + SQLAlchemy + pandas
- **Detector**: `pyproject.toml` + `poetry.lock`.
- **Vuln scan**: `uvx pip-audit` (or `poetry export | pip-audit`).
- **Outdated**: `poetry show --outdated`.
- **Buckets**: 2 High CVE (urllib3 + cryptography) → P1 within 7d; 18 patch + 6 minor → P2 monthly; 1 MAJOR (Pydantic v1 → v2) → P3 dedicated, large migration.
- **Special concern**: pandas major bumps often break notebook code; coordinate with data-team review.
- **Output**: `docs/ops/dependency-update-2026-05.md`; P3 Pydantic v2 batch references migration guide.

### Go service — modules + govulncheck
- **Detector**: `go.mod` + `go.sum`.
- **Vuln scan**: `govulncheck ./...` (call-graph aware — only reports reachable vulns; high signal-to-noise).
- **Outdated**: `go list -u -m all`.
- **Buckets**: 0 Critical (call-graph filter); 3 High in unreachable code (acknowledge but defer to P3 quarterly cleanup); 12 minor + patch → P2 monthly; 1 MAJOR (`gorm.io/gorm` v1 → v2) → P3 dedicated.
- **Test plan per batch**: `go test ./... -race` + `golangci-lint run` + integration tests against staging Postgres.
- **Output**: `docs/ops/dependency-update-2026-05.md`; govulncheck output linked.

## Boundaries

- **Read-only scan + emit-script.** This skill never auto-bumps, never auto-pushes, never auto-merges. Emits the batch plan; you run each batch manually. Per `/dead-code-scan` precedent.
- **Not the same as `/sbom-generate`.** That produces the bill of materials; this updates the materials. Pairs but does not duplicate.
- **Not the same as `/threat-model`.** Threat-model assesses risk; this remediates one risk class (outdated/vulnerable). Cross-ref but separate.
- **Does not handle license drift.** Cross-ref `/licensing-audit` for license-policy changes (GPL→AGPL ambush, dual-license shifts).
- **Does not handle production runtime upgrades** (Node 20 → 22, Python 3.11 → 3.12, Postgres 14 → 16). Those need `/blue-green-deploy` not a monthly batch.
- **Does not author per-package migration code.** Surfaces the work; the actual code change for "React 18 → 19" lives in a feature PR with the eng team.
- **Does not bypass human review.** Every batch PR gets normal review per repo policy.

## Re-run Behavior

- Monthly cadence by default. One file per period: `dependency-update-2026-05.md`, `dependency-update-2026-06.md`, ...
- Ad-hoc for CVE-Critical: `dependency-update-cve-2026-xxxx-emergency.md` outside cadence.
- Cumulative log: `docs/ops/dependency-update-lineage.md` one-line per period with batches shipped + CVE remediation count + lockfile-sha-end.
- Period status flows: `planning → in-progress → completed`. Locked at `completed`; corrections = new file with `supersedes:` field.
- Trigger re-run early if:
  - Any Critical CVE published in a direct OR transitive dep (within 24h)
  - Any HIPAA / SOC2 audit window opening (compliance-driven snapshot)
  - Major framework deprecation announced (Node version EOL date approaching)

## Auto-chain

- **Fires (downstream):**
  - `/verify` — after each batch, before merge.
  - `/contract-test` — if HTTP / API / DB-driver dep bumped (any package that participates in cross-process contract).
  - `/migration-author` — if DB-driver MAJOR bump (e.g. `pg` 7 → 8) requires migration work (driver-level behavior change).
  - `/rollback-plan` — referenced per batch; Tier 3 batches must have rollback plan pre-written.
  - `/dead-code-scan` — post-batch (esp. post-P3 MAJOR) to find newly-orphaned imports from removed APIs.
  - `/threat-model` — review when security-boundary dep majors (auth / crypto / parser / serialization).
  - `/sbom-generate` — regenerate BOM after each batch lands (HIPAA / SOC2 / regulated).
- **Reads (upstream):**
  - `/coverage-map` — regression-signal trust (stale coverage = false-green risk).
  - `/licensing-audit` — license drift to consider in parallel.
  - `/workspace-detect` — monorepo per-workspace scoping.
  - `/hipaa-risk-assessment` — compliance-driven trigger (explicit chain-FROM caller).
- **Pairs with:**
  - `/release-notes` — when a Major / Breaking dep bump ships, surface in release-notes "Dev-facing" or "Breaking change" bucket.

## Verification

1. `docs/ops/dependency-update-<period>.md` exists with frontmatter populated (period, package_manager, lockfile_sha_before, vuln_summary_before).
2. Vuln scan results section has counts per severity AND named CVEs for any Critical / High.
3. Outdated table has at least one row OR explicit "no outdated packages" note.
4. Batches section has ≥ 1 batch with packages list + regression budget + blast-radius tier + migration steps + rollback action.
5. Each batch has status checkboxes (branch / tests / staging / prod) — not collapsed to "shipped".
6. Per-batch rollback action specified (revert PR / blue-green flip-back / image revert) with SLA.
7. Transitive-dep watch section present (even if "none expected").
8. Read-only emit-script confirmed — no commits, no merges, no auto-push commands in output.
9. Cross-references in `## Auto-chain` resolve to existing skill files.
10. Schedule has concrete ship-dates per batch (not "TBD").

## Example Trigger

User: "renovate filed 18 PRs this week — what should we actually ship?"

→ `/dependency-update` runs:
- Detect: pnpm monorepo + `pnpm-lock.yaml` + `pnpm-workspace.yaml` (cross-ref `/workspace-detect`)
- Vuln scan: `pnpm audit --prod` → 1 Critical (axios 0.27.2 SSRF) + 2 High + 4 Medium
- Outdated scan: 18 packages, mix of patch (11) / minor (5) / major (2)
- Bucket:
  - P1 security: axios (Critical) — ship today; 2 High deferred to P2 (no active exploit)
  - P2 patch-roundup: 11 patches + 5 minors, single PR, ship Tuesday
  - P3 Major: React 19 + ESLint 9, one PR each, ship Week 4 (or defer)
- Read changelogs: React 19 = large migration (~30 component tests need cleanup updates); ESLint 9 = config-format migration
- Order: P1 axios (Tier 2 mid-blast) → P2 leaf utilities (Tier 1) → P3 framework (Tier 3)
- Per-batch: regression budget 0% / 5% / documented-churn; staging soak 24h / 24h / 7d; rollback action per Tier
- Schedule: P1 today, P2 Tuesday, P3 Week 4 or defer
- Auto-chain: `/contract-test` for axios bump (HTTP client crosses contract), `/dead-code-scan` post-P3 (React 19 may orphan imports), `/rollback-plan` referenced for P3
- Output: `docs/ops/dependency-update-2026-05.md`
