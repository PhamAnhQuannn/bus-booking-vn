# BACKCOMPAT + SUPPLY-CHAIN REVIEW — Dependabot batch #383–#387

Generated: 2026-07-28 · Reviewer: automated (`/backcompat-review` checklist, supply-chain categories 4/5/6)
Repo: `PhamAnhQuannn/bus-booking-vn` · Base: `master` · Project license: **none declared** (`package.json` is `"private": true`, no `license` field)
Mode: **read-only** — no `pnpm install`, no lockfile/manifest edits, no PR comments, no merges.

---

## Summary

| PR | Bump | Section | Lock Δ | New pkg **names** | Lifecycle scripts | Semver honest? | Verdict |
|----|------|---------|--------|-------------------|-------------------|----------------|---------|
| **#387** | `shadcn` 4.12.0 → 4.15.0 | `dependencies` | 97/116 | **0** | none | yes | **merge** (rerun Integration Tests) |
| **#386** | `lucide-react` 1.22.0 → 1.27.0 | `dependencies` | 25/25 | **0** | none | yes | **merge** |
| **#385** | `@playwright/test` 1.61.1 → 1.62.0 | `devDependencies` | 45/45 | **0** | none | yes | **merge** |
| **#384** | `@sentry/nextjs` 10.65.0 → 10.68.0 | `dependencies` | 265/270 | **0** | none | **loose** (0.x transitives) | **merge** |
| **#383** | `@tailwindcss/postcss` 4.3.0 → 4.3.3 | `devDependencies` (`^4`) | 84/115 | **0** | none | **loose** (CSS output Δ) | **merge** (visual pass first) |

**Findings: 12 — P1: 0 · P2: 3 · P3: 9**

**Headline:** no P1. Zero new package *names* enter the lockfile in any of the five PRs — every single change is a version bump of a name already vendored on `master`, plus net dedups. That structurally forecloses license drift, typosquat introduction, and new lifecycle-script vectors for the whole batch (see *Cross-cutting* below). The three P2s are not security issues; they are *"this bump is bigger than its label"* issues, and the biggest of them belongs to the smallest PR (#383).

---

## Cross-cutting findings (apply to all five)

### ✅ CC-1 — Zero new package names. License drift and typosquatting are structurally impossible in this batch.

Verified mechanically, not by eyeballing the diff: every `+`-side package key in all five lock diffs was reduced to its bare name (peer-suffix and version stripped) and set-differenced against the complete `packages:` name set of `master`'s `pnpm-lock.yaml`.

| PR | package names on `+` lines | names **not** already in master's lock |
|----|---------------------------|----------------------------------------|
| #387 | 19 | **NONE** |
| #386 | 6 | **NONE** |
| #385 | 11 | **NONE** |
| #384 | 57 | **NONE** |
| #383 | 20 | **NONE** |

Consequences, all five PRs:
- **Cat 4 (license drift):** no new vendor enters the tree, so no new license can enter. Only in-place relicensing of an existing package could change anything; spot-checked the two prod-facing tops — `shadcn@4.15.0` is **MIT** (registry-confirmed), `@sentry/*@10.68.0` remains **MIT**. No GPL / AGPL / SSPL / BUSL / Commons-Clause anywhere in the delta.
- **Cat 5 (typosquat):** a typosquat requires a *new* name. There are none. Edit-distance screening is moot.

`pnpm-lock.yaml` does not record `license` fields at all, so per-package license assertion beyond the above requires `pnpm licenses list` — worth running once as a baseline, but nothing in this batch changes the answer.

### ✅ CC-2 — No new lifecycle-script surface, and the repo already blocks the vector by policy.

- `grep requiresBuild pnpm-lock.yaml` → **0 hits** across the entire lockfile. No package in the tree, before or after, is marked as requiring a build step.
- `pnpm-workspace.yaml:5` — `onlyBuiltDependencies: ["@prisma/engines", "prisma"]`. Under pnpm 10 this is an **allowlist**: every other package's `preinstall`/`install`/`postinstall` is blocked by default. Even if a bumped transitive silently gained a postinstall, it would not execute.
- `shadcn@4.15.0` registry metadata confirms **no** `preinstall` / `install` / `postinstall` / `prepare`.
- Lockfile `hasBin` deltas in #387 (line 66) and #383 (line 186) are removals attached to deduped duplicate versions, not new binaries.

### ℹ️ CC-3 — P3: All five PRs mutate the same shared lines. Merge order matters.

Every one of the five carries the identical incidental block:

```
browserslist            4.28.6 → 4.28.7
electron-to-chromium    1.5.393 → 1.5.396
baseline-browser-mapping 2.10.43 → 2.11.4
postcss                 8.5.20 → 8.5.23
update-browserslist-db  (repin)
```

Whichever merges first will put the other four into lockfile conflict, and Dependabot will have to rebase them. This is normal, but it means **"all five are green" is only true one at a time** — after the first merge the remaining four need their CI re-run post-rebase, not just re-read.

`postcss@8.5.23` satisfies the `pnpm.overrides` pin `"postcss": ">=8.5.10"` (`package.json:102`) in all five. No override violation.

**Suggested order (low blast radius → high):** #386 → #385 → #383 → #384 → #387.

---

## PR #387 — `shadcn` 4.12.0 → 4.15.0 — **MERGE** (rerun Integration Tests)

`https://github.com/PhamAnhQuannn/bus-booking-vn/pull/387` · head `ed54c99d` · +97 / −116 across 2 files
CI: 11/12 pass. **`Integration Tests` fail** — pre-diagnosed infra flake (`docker pull postgres:16` → `Get "https://registry-1.docker.io/v2/": context deadline exceeded`, 3 retries, zero tests executed). Not re-investigated per instruction. Note that `E2E Tests (chromium)`, `E2E Tests (mobile-390)`, `Dependency Audit` and the `Vercel` production build **all passed**, so the build and render paths are covered despite the red X.

### ⚠️ P2 — `package.json:54` — `shadcn` in `dependencies` puts 232 packages (30% of the production closure) behind a CLI tool.

Measured by walking `pnpm-lock.yaml`'s `snapshots:` graph from the `importers['.'].dependencies` roots, with and without `shadcn`:

```
prod closure WITH shadcn:    769 packages
prod closure WITHOUT shadcn: 537 packages
reachable ONLY via shadcn:   232 packages
```

What those 232 contain is the point — `shadcn` drags an entire HTTP server stack and a secrets-CLI into the production dependency graph:

| Package | Arrives via | Note |
|---|---|---|
| `express@5.2.1` | `shadcn` → `@modelcontextprotocol/sdk@1.29.0` | full web framework; nothing else in the tree depends on it |
| `express-rate-limit@8.5.2` | same | |
| `hono@4.12.27` | same | a **second** path to `hono` — the first (`prisma` → `@prisma/dev` → `hono`) is the exact CORS CVE that forced `--audit-level=critical` (CLAUDE.md, 2026-06-21 WT-21) |
| `body-parser`, `raw-body`, `cors`, `send`, `serve-static` | same | express middleware chain |
| `@dotenvx/dotenvx@1.75.1` | `shadcn` direct dep | secrets-management CLI |
| `systeminformation@5.31.11` | `@dotenvx/dotenvx` | host/hardware fingerprinting; **sole** consumer in the whole tree |
| `undici@7.29.0` | `shadcn` + `@dotenvx/dotenvx` | |
| `zod@3.25.76` | `shadcn` → MCP SDK | second `zod` major alongside the app's `zod@^4.4.3` |
| `@babel/*`, `ts-morph@26.0.0`, `recast` | `shadcn` direct | TS codemod machinery |

This is precisely the set that `.github/workflows/ci.yml:339` walks:

```yaml
run: pnpm audit --prod --audit-level=critical --ignore-registry-errors
```

**Recommendation and blast radius: see the dedicated section below.** Not a blocker for #387 itself — the placement problem predates this PR and the bump does not worsen it.

### ℹ️ P3 — `app/globals.css:3` — `shadcn` is **not** a pure CLI dep. It is a build-time CSS input.

```css
@import "shadcn/tailwind.css";
```

`node_modules/shadcn/package.json` exports `"./tailwind.css": "./dist/tailwind.css"`. So the Tailwind pipeline resolves the `shadcn` package at **build time** on every `next build`. Any framing of `shadcn` as "CLI-only, never imported" is wrong — it is not imported by *JavaScript*, but it is consumed by the *stylesheet*.

Version-to-version delta of that file (4.12.0 read from `node_modules`, 4.15.0 read from the registry):

| | 4.12.0 | 4.15.0 |
|---|---|---|
| lines | 629 | 827 |
| `@custom-variant` | 9 (`data-open` … `data-vertical`) | **same 9, same order** |
| `@utility` | 24 (`no-scrollbar`, `scroll-fade*`, `shimmer*`) | **same 24, same order** |
| `@property` | 8 | **same 8** |
| `@keyframes` | 7 | **same 7** |

**Public API is byte-for-byte identical in surface; only rule bodies grew (+198 lines).** So no class name a template could reference has been removed or renamed.

Risk is further bounded to ~zero by usage: grepping `app/` and `components/` for every one of those 24 utilities and 9 variants returns **0 files**. Nothing in this codebase uses anything `shadcn/tailwind.css` provides. Tailwind v4 only emits utilities found in scanned source, so the emitted-CSS delta is confined to the unconditionally-passed-through `@property` blocks — which are unchanged.

Verdict: accept. Optionally spot-check one page against the Vercel preview; a full `/visual-regression` run is not warranted for this PR.

### ℹ️ P3 — 4.13.1 ships three security fixes. This bump is a net security *gain* for developer machines.

Per the shadcn release notes for `4.13.1`:
- "Drop custom registry headers on cross-origin redirects to prevent credential leakage"
- "Validate file paths for registry items without an explicit target to prevent path traversal"
- "Prevent flag injection from registry-supplied dependency strings during install"

All three are exploitable only by a malicious/compromised component registry against whoever runs `shadcn add` — i.e. developer-workstation scope, not the deployed app. Still, this raises merge priority rather than lowering it.

### ℹ️ P3 — Rerun `Integration Tests`.

The single red check executed zero tests. Re-dispatch before merge so the green is real rather than assumed.

### Clean
- Cat 1 (API shape), Cat 2 (schema), Cat 3 (shared-lib signatures): **N/A** — diff touches only `package.json` and `pnpm-lock.yaml`.
- Cat 6 (lockfile drift): `package.json` and `pnpm-lock.yaml` both present and consistent.
- 19 changed transitive names, **all** pre-existing; `node-releases@2.0.50` dropped as a dedup (`2.0.51` already in tree).

---

## PR #386 — `lucide-react` 1.22.0 → 1.27.0 — **MERGE**

`https://github.com/PhamAnhQuannn/bus-booking-vn/pull/386` · head `736ff944` · +25 / −25 across 2 files
CI: 12/12 green.

**Cleanest PR of the five.** No findings at any severity.

- **Usage: hot path.** 65 files under `app/`, `components/`, `lib/` import from `lucide-react` (`app/(customer)/booking/bank-transfer/BankTransferClient.tsx:5`, `app/(customer)/booking/confirmation/[token]/page.tsx:19`, and 63 more). This ships into the browser bundle.
- **Semver honest.** Releases 1.23.0 → 1.27.0 are additive: new icons (`pending-cw`, `square-off`, `scan-square`, `user-shield`, `mosque`, `layout-freeform`, `shield-keyhole`, `scan-box`, `server-plus`, `paper-bag`) plus visual refinements to existing glyphs (`zap`, `book-open`, `trophy`, `feather`, `dot`, `option`, …). **No removed icons. No API or export changes. No deprecations.**
- **The one rename is unreachable.** 1.25.0 renamed `circle-euro-sign` → `circle-euro`. That icon was *introduced* in 1.24.0 — above this repo's 1.22.0 floor — so no import in this codebase could have been referencing it. Confirmed: no `CircleEuro*` import anywhere.
- Lock delta is 6 names, all pre-existing, all the CC-3 browserslist/postcss block plus `lucide-react` itself.
- Visual note (informational, not a finding): glyph *artwork* changed for `zap`, `book-open`, `trophy`, `feather`, `dot`, `option`, `ad`, `podcast`, `barrel`, `toolbox`, `hdmi-port`, `ethernet-port`, `file-box`, `columns-3-cog`. If any of those appear in a pixel-diff baseline, expect churn there and only there.

---

## PR #385 — `@playwright/test` 1.61.1 → 1.62.0 — **MERGE**

`https://github.com/PhamAnhQuannn/bus-booking-vn/pull/385` · head `54fea384` · +45 / −45 across 2 files
CI: 12/12 green — including both E2E matrix legs, which is the direct proof this bump works.

- **Usage: test-only.** ~25 specs under `e2e/**` plus `e2e/helpers/csrf.ts`. Never reaches app code or the browser bundle. `devDependencies` placement is correct.
- **Semver honest.** 1.62.0 is additive: `AbortSignal` support via a `signal` option, WebP snapshots, `reporter.preprocess()`, `retryStrategy: 'isolated'`, `locator.waitForFunction()`, `apiResponse.timing()`, WebAuthn credential persistence. The component-testing overhaul (`fixtures.mount()` stories/galleries model) is a real behavior change but this repo has no CT setup — no `playwright-ct.config.*`, no `mount()` call sites.

### ℹ️ P3 — Browser binaries bump; no cache to go stale, but local machines need a re-pull.

1.62.0 pins **Chromium 151.0.7922.34**, **Firefox 153.0**, **WebKit 26.5** — all requiring fresh downloads.

CI is safe: `.github/workflows/ci.yml:221` and `:299` both run

```yaml
run: pnpm exec playwright install --with-deps chromium webkit
```

with **no `actions/cache` step keyed on the Playwright version** anywhere in the workflow — browsers are pulled fresh every run. That is slower but immune to the stale-browser-cache failure mode this bump would otherwise trigger. Nothing to change.

Local developers must run `pnpm exec playwright install` after pulling, or specs will fail against 1.61.1 binaries.

### ℹ️ P3 — Upstream dropped Debian 11. Not applicable here.

CI runners are `ubuntu-latest`. Recorded only so it isn't rediscovered later.

### ℹ️ P3 — Pre-existing: `@playwright/mcp@0.0.78` pins a Playwright **alpha**.

`pnpm-lock.yaml:4569` / `:4579` carry `playwright-core@1.62.0-alpha-1783623505000` and `playwright@1.62.0-alpha-1783623505000`, pulled by `@playwright/mcp@0.0.78` (`devDependencies`, `package.json:74`). #385 does not touch these — it moves the *stable* copy 1.61.1 → 1.62.0 and leaves the alpha alone, so after merge the tree holds two `playwright-core` copies (`1.62.0` and `1.62.0-alpha-…`).

Not introduced by this PR and not a merge blocker. Worth its own cleanup issue: an alpha-pinned transitive in a dev toolchain is a supply-chain input nobody is tracking, and now that the stable line has reached 1.62.0 the pin may be droppable.

---

## PR #384 — `@sentry/nextjs` 10.65.0 → 10.68.0 — **MERGE**

`https://github.com/PhamAnhQuannn/bus-booking-vn/pull/384` · head `687b2d1e` · +265 / −270 across 2 files
CI: 12/12 green.

Weighted heaviest per the brief: largest lock delta and the only bump of the five shipping runtime code into the **served browser bundle**.

**Usage — both runtimes, both gated:**

| Site | Runtime | Gate |
|---|---|---|
| `instrumentation-client.ts:14` | browser bundle | `process.env.NEXT_PUBLIC_SENTRY_DSN` |
| `instrumentation.ts:17` (dynamic `await import`) | Node server | `process.env.SENTRY_DSN && NEXT_RUNTIME === 'nodejs'` |
| `lib/observability/sentry.ts:19` | server | `getEnv().SENTRY_DSN` |

Both `Sentry.init()` calls set **`tracesSampleRate: 0`** (`instrumentation.ts:23`, `instrumentation-client.ts:80`). Tracing is off. This single fact defuses most of the 10.66–10.68 delta, which is overwhelmingly span/instrumentation work.

`next.config.ts` does **not** call `withSentryConfig` — the only Sentry reference is the CSP `connect-src` allowance at line 19. The Sentry bundler plugin is not wired into the build.

### ⚠️ P2 — Semver-loose: a "minor" top-level bump carries 0.x transitives whose minors are breaking by convention.

Hidden inside the 265-line lock delta:

| Package | 10.65.0 | 10.68.0 | Δ |
|---|---|---|---|
| `@apm-js-collab/code-transformer` | 0.15.0 | **0.18.1** | 3 minors on a 0.x — semver-major ×3 |
| `@apm-js-collab/code-transformer-bundler-plugins` | 0.5.0 | **0.7.1** | 2 minors on a 0.x — semver-major ×2 |
| `@opentelemetry/core` | 2.9.0 | 2.10.0 | minor |
| `@opentelemetry/sdk-trace-base` | 2.9.0 | 2.10.0 | minor |
| `@opentelemetry/sdk-trace` | 2.9.0 | 2.10.0 | minor |
| `@opentelemetry/resources` | 2.9.0 | 2.10.0 | minor |
| `import-in-the-middle` | 3.3.1 | 3.3.2 | patch — **ESM loader hook**, patches module resolution at runtime |
| `rollup` (+ 20 `@rollup/rollup-*` native binaries) | 4.62.2 | 4.62.3 | patch |

Under `^0.x` semantics a `0.15 → 0.18` jump is three consecutive breaking-change windows. Dependabot's "minor" label is derived from `@sentry/nextjs`'s own version and says nothing about these.

**Mitigation is strong, which is why this is P2 and not P1:** the `@apm-js-collab/*` packages are Sentry's "orchestrion" build-time code transformers, reachable only through `withSentryConfig` / the bundler plugin — which this repo does not use. They are installed dead weight. `import-in-the-middle` is the riskiest *runtime* item (it hooks ESM loading for Node auto-instrumentation) but moves only 3.3.1 → 3.3.2, a genuine patch.

Action: none required, but if `withSentryConfig` is ever adopted, re-review this delta rather than assuming it was cleared here.

### ℹ️ P3 — `@sentry/node-core` was deprecated upstream in 10.66.0 and is still in the tree.

Sentry's 10.66.0 changelog: `chore(node-core): Deprecate @sentry/node-core package`. The lock still carries `@sentry/node-core@10.68.0` as a transitive of `@sentry/node`. Not directly imported by this repo. Nothing to do now; track so that the eventual removal in a future major is not a surprise.

### ℹ️ P3 — 10.66.0 adds `dataCollection.databaseQueryData` / `dataCollection.graphQL`; the existing PII scrubber would not cover them.

`feat(core): Add and use dataCollection.databaseQueryData` and `dataCollection.graphQL` land in 10.66.0, and Prisma instrumentation moved into `@sentry/server-utils`. These attach query data to **span attributes**.

Both init sites scrub via `beforeSend`, but that hook only rewrites `event.extra` and `event.contexts` (`instrumentation.ts:24-32`, `instrumentation-client.ts:81-91`). **It does not touch span attributes.** The 52-key redaction list in `instrumentation-client.ts:16-53` — `customerPhone`, `otpProof`, `refreshTokenHash`, `totpSecret`, … — would therefore not apply to a DB-query span.

**No exposure today**, because `tracesSampleRate: 0` means no spans are sampled or transmitted. Recorded as a tripwire: if tracing is ever enabled, `dataCollection.*` must be explicitly reviewed and the scrubber extended to span attributes in the same commit. Given this project's PII posture (Vietnam PDPL, phone numbers as the primary customer identifier), that is not a theoretical concern.

### ℹ️ P3 — Browser-bundle surface changed but did not grow.

`@sentry/browser`, `@sentry/browser-utils`, `@sentry/replay`, `@sentry/replay-canvas`, `@sentry/feedback`, `@sentry/react`, `@sentry/core` all move 10.65.0 → 10.68.0, and `@sentry/conventions` moves 0.15.1 → **0.16.0** (another 0.x minor). Sentry's own size-limit report holds the Next.js client bundle at ~49.5–50 KB and the base browser bundle at ~27 KB across this range. Replay/feedback/canvas are only pulled in when their integrations are registered, and neither init site registers any — so the practical served delta is the core SDK only.

### Clean
- Cat 1 / 2 / 3: N/A — `package.json` + `pnpm-lock.yaml` only.
- 57 changed transitive names, **all** pre-existing. `es-module-lexer@2.3.0` dropped as a dedup (`2.1.0` and `2.3.1` remain in tree).
- All `@sentry/*` packages remain MIT.

---

## PR #383 — `@tailwindcss/postcss` 4.3.0 → 4.3.3 — **MERGE** (run a visual pass first)

`https://github.com/PhamAnhQuannn/bus-booking-vn/pull/383` · head `8fe56533` · +84 / −115 across **1 file**
CI: 12/12 green.

### ✅ Coherence check (brief item 5): **CONFIRMED CORRECT.** No manifest/lock drift; `--frozen-lockfile` is satisfied.

The absence of a `package.json` edit is exactly right, and here is the proof rather than the assertion:

```yaml
# pnpm-lock.yaml, importers['.'].devDependencies — the ONLY change in this hunk
      '@tailwindcss/postcss':
        specifier: ^4          # ← unchanged
-       version: 4.3.0
+       version: 4.3.3         # ← only the resolution moves
```

- `package.json:76` declares `"@tailwindcss/postcss": "^4"`. `4.3.3` satisfies `^4`. The manifest needs no edit and correctly has none.
- `pnpm install --frozen-lockfile` compares the manifest's **specifiers** against the lock's `specifier:` fields, not the resolved versions. The specifier is untouched, so the check passes.
- Empirically confirmed: six CI jobs run `pnpm install --frozen-lockfile` (`.github/workflows/ci.yml:35, 65, 133, 208, 287, 336`) and all twelve checks are green on this PR.

**No drift. Nothing to fix. This is what a correct lockfile-only bump looks like.**

### ✅ Net supply-chain *reduction* — the only PR of the five that shrinks the tree.

−115 / +84 is a genuine net removal of 31 lines, because `@tailwindcss/postcss@4.3.0` was pinning a **second, older copy** of the Tailwind engine alongside the one the direct `tailwindcss: ^4` devDep already resolved to 4.3.3. Bumping the plugin dedupes them:

| Dropped entirely | Why it's safe |
|---|---|
| `tailwindcss@4.3.0` | `tailwindcss@4.3.3` already in tree from the direct devDep |
| `enhanced-resolve@5.21.3` | `5.24.3` already in tree; `@tailwindcss/node` now uses it |
| `nanoid@3.3.12` | `3.3.15` already in tree |
| `postcss@8.5.14` | `8.5.16` / `8.5.23` already in tree |

Four duplicate package copies removed. This is a supply-chain win, not just a version bump.

### ⚠️ P2 — This "lockfile-only devDependency patch" is the **only** PR of the five with a user-visible rendering delta.

The framing that makes this easy to wave through — *devDependency, patch range, no manifest change* — is exactly what conceals it.

`postcss.config.mjs` loads `@tailwindcss/postcss`, which compiles `app/globals.css` via its own bundled `@tailwindcss/node` → `tailwindcss` copy. That copy was **4.3.0**. The top-level `tailwindcss@4.3.3` devDep is *not* what generates the site's CSS. So the CSS engine actually shipping the site today is 4.3.0, and this PR moves it to 4.3.3 — **crossing 4.3.1 and 4.3.2**, which include a `Changed` section:

**4.3.1 — Changed:**
- Spacing utilities emit `0` instead of `calc(var(--spacing) * 0)` for `m-0`, `left-0`, …
- Spacing utilities emit `var(--spacing)` instead of `calc(var(--spacing) * 1)` for `m-1`, `left-1`, …

**4.3.1–4.3.3 — output-affecting fixes:**
- **Preflight replaces `system-ui` / `ui-sans-serif` with explicit platform fonts for correct CJK rendering on Windows.**
- Firefox's native `iframe:focus-visible` outline preserved in Preflight.
- Arbitrary hex colors match theme colors case-insensitively (`bg-[#FFF]` now collapses to `bg-white`).
- Achromatic theme colors no longer shift hue in polar spaces like `oklch`.
- `--spacing(0)` optimizes to `0px` rather than `0`, to stay valid inside `calc(…)`.
- Fractional opacity modifiers on named shadow sizes (`shadow-sm/12.5`).
- `[data-foo]div` now parses as two distinct selectors.

Semver-wise Tailwind considers these patches. For a consumer site they are output changes, and the Preflight font-stack change lands on a **Vietnamese-language** product.

**Bounding the risk:** `app/globals.css:11` pins `--font-sans: var(--font-be-vietnam)` (and `--font-heading` / `--font-display` likewise), so the primary type stack is explicitly set and insulated from the Preflight default change. The spacing-utility change is a serialization change that should compute identically. The `oklch` achromatic fix could shift near-grey theme tokens by a hair.

**Recommendation:** merge, but run `/visual-regression` (or diff the Vercel preview against production on 3–4 representative pages: home, search results, seat map, confirmation) before doing so. The existing baselines `validate-289-349-home.png` and `validate-mobile-header.png` in the repo root are a reasonable starting comparison. This is a ten-minute check against the one PR in the batch that can actually change what a customer sees.

### Clean
- Cat 1 / 2 / 3: N/A — `pnpm-lock.yaml` only.
- Cat 6 (lockfile drift): lock touched without `package.json` — **correct and expected here**, see the coherence check above. Not a P3.
- 20 changed transitive names, **all** pre-existing.
- Interaction note: this PR moves `enhanced-resolve` 5.21.3 → 5.24.3 *inside* `@tailwindcss/node` — the very resolver that resolves the bare specifier `shadcn/tailwind.css` at `app/globals.css:3`. Both E2E legs and the Vercel production build are green on this PR, so resolution demonstrably still works.

---

## Named finding — should `shadcn` move to `devDependencies`?

### Recommendation: **YES — move it. As its own PR, not folded into #387.**

### Grounds

1. **Nothing imports it at runtime.** Exhaustive grep across `app/`, `components/`, `lib/`, `e2e/`, `scripts/` and every root config for the identifier `shadcn` returns exactly two hits, neither of which is a JS/TS import:
   - `components.json:2` — `"$schema": "https://ui.shadcn.com/schema.json"` (the CLI's own config file)
   - `package.json:54` — the dependency declaration itself

   There is no `import … from 'shadcn'`, no `require('shadcn')`, and no `shadcn` entry in `scripts` — it is invoked ad hoc via `pnpm dlx` / `npx shadcn add` when scaffolding a component.

2. **It is 30% of the production supply-chain surface.** 232 of 769 packages in the production closure are reachable only through it — including `express@5.2.1`, `express-rate-limit`, `hono`, `cors`, `body-parser`, `serve-static`, `@modelcontextprotocol/sdk`, `@dotenvx/dotenvx`, `systeminformation`, `undici`, a second `zod` major, and the whole `@babel/*` + `ts-morph` codemod stack. A bus-booking web app has no business shipping an Express server and a hardware-fingerprinting library in its production dependency graph.

3. **It is what `pnpm audit --prod` walks.** `.github/workflows/ci.yml:339` runs `pnpm audit --prod --audit-level=critical`. Per the 2026-06-21 WT-21 mistake-log entry, that gate was already downgraded from `high` to `critical` because of a `prisma → @prisma/dev → hono` CORS CVE. `shadcn` supplies a **second independent path to `hono`** plus an entire Express stack — i.e. it is actively enlarging the surface that forced the gate to be weakened. Moving it lets a future attempt to restore `--audit-level=high` succeed against a 537-package tree instead of a 769-package one.

### Blast radius

**What changes**

| Effect | Magnitude |
|---|---|
| Production closure | 769 → **537** packages (−232, −30%) |
| Surface walked by `pnpm audit --prod` | −232 packages |
| Packages removed from a `pnpm install --prod` | 232 |
| On-disk install size | −186 packages only — 46 of the 232 are already reachable from `devDependencies`, so they stay |
| Runtime behavior of the deployed app | **zero** — nothing imports it |
| Served bundle size | **zero** — nothing imports it |
| `pnpm-lock.yaml` | one line moves between the `dependencies:` and `devDependencies:` blocks of `importers['.']`; no resolutions change |

**The one real risk, and it is manageable**

`app/globals.css:3` does `@import "shadcn/tailwind.css"`, so `shadcn` **must be installed at build time**. Concretely:

- ✅ **Vercel** — installs devDependencies, runs `next build`, serves prebuilt output. Unaffected. (Empirically: `tailwindcss` and `@tailwindcss/postcss` are *already* `devDependencies` and the build works.)
- ✅ **CI** — all six install steps are `pnpm install --frozen-lockfile` with no `--prod`. Unaffected.
- ❌ **Any `pnpm install --prod && next build` sequence would break** with an unresolvable CSS import. No such path exists in `.github/workflows/**` or `package.json` scripts today, but this is the failure mode to state in the PR body so nobody adds one later.

**Execution**

1. Land this as a standalone PR — do **not** amend #387. Dependabot PRs should stay mechanical; mixing a placement change into one makes the rebase messy and buries the rationale.
2. Verify with a clean `pnpm install --frozen-lockfile && pnpm build` plus one E2E leg.
3. State the `--prod`-install caveat explicitly in the PR body, since on squash-merge that body becomes the permanent commit message.

**Optional follow-up that would retire the coupling entirely**

Nothing in `app/` or `components/` uses **any** of the 24 utilities (`no-scrollbar`, `scroll-fade*`, `shimmer*`) or 9 custom variants (`data-open`, `data-closed`, …) that `shadcn/tailwind.css` provides — grep returns 0 files for every one. Dropping the `@import` at `app/globals.css:3` would remove the last build-time tie and make `shadcn` a pure, uncoupled CLI tool that could safely live in `devDependencies` under any install mode. Worth its own issue; verify against a visual diff first, since the file's `@property` declarations do pass through to the emitted stylesheet.

---

## Recommended next actions

1. Re-dispatch `Integration Tests` on **#387** (flake, zero tests executed).
2. Run a visual pass against the **#383** preview before merging — the one PR here that can change rendered output.
3. Merge in ascending blast-radius order: **#386 → #385 → #383 → #384 → #387**, re-running CI on each after Dependabot rebases it (all five share the same browserslist/postcss lock lines — see CC-3).
4. Open a standalone PR moving `shadcn` from `dependencies` to `devDependencies` (`package.json:54`).
5. Open a tracking issue for `@playwright/mcp@0.0.78`'s alpha Playwright pin (`pnpm-lock.yaml:4569`).
6. Record a tripwire on the Sentry PII gap: if `tracesSampleRate` is ever raised above 0, the `beforeSend` scrubbers must be extended to span attributes in the same commit.

**SUMMARY: 0 P1 · 3 P2 · 9 P3 — all five verdicts MERGE. Pinned to `ed54c99d` / `736ff944` / `54fea384` / `687b2d1e` / `8fe56533`.**
