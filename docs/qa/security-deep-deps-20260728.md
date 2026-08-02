# SECURITY-DEEP REVIEW — dependency surface across PRs #383–#387

```
Generated:  2026-07-28
Scope:      does merging these five dependabot bumps change the security posture
            of the running application?
Mode:       READ-ONLY. No checkout, no worktree, no install, no lockfile write.
Method:     gh pr diff · pnpm-lock.yaml instance analysis · `pnpm audit --prod`
            (registry read, no write) · GitHub Advisory DB via `gh api /advisories`
            · npm registry metadata · Sentry SDK source read from installed
              node_modules/@sentry/core@10.65.0 + raw.githubusercontent @10.68.0
Excluded:   license · typosquat · semver policy · lifecycle scripts · shadcn
            package.json placement rationale (covered by a separate agent)
```

| PR | Bump | HEAD | Verdict |
|----|------|------|---------|
| #383 | `@tailwindcss/postcss` 4.3.0 → 4.3.3 (dev) | `8fe56533` | **SAFE TO MERGE** |
| #384 | `@sentry/nextjs` 10.65.0 → 10.68.0 | `687b2d1e` | **SAFE TO MERGE** + take P2-2 as follow-up |
| #385 | `@playwright/test` 1.61.1 → 1.62.0 (dev) | `54fea384` | **SAFE TO MERGE** |
| #386 | `lucide-react` 1.22.0 → 1.27.0 | `736ff944` | **SAFE TO MERGE** |
| #387 | `shadcn` 4.12.0 → 4.15.0 | `ed54c99d` | **SAFE TO MERGE** — highest security value of the five |

**Findings: 9 (P1: 1 · P2: 4 · P3: 4)**

**Headline:** none of the five bumps introduces an advisory, a new package, or a PII
default change. One of them (#387) silently closes two HIGH advisories. The real
finding is what sits *underneath* all five and is invisible to CI.

---

## ⚠️ ADVISORIES THAT CI WOULD NOT HAVE CAUGHT

CI's dependency gate is `.github/workflows/ci.yml:339`:

```yaml
run: pnpm audit --prod --audit-level=critical --ignore-registry-errors
```

Empirically verified against `master`'s lockfile on 2026-07-28:

```
30 vulnerabilities found
Severity: 20 moderate | 10 high
```

**Zero critical.** `--audit-level=critical` therefore exits 0. The gate is green
today while ten HIGH advisories sit in the production dependency tree. Running the
same command without the flag exits 1.

### The 10 HIGH advisories the gate is currently suppressing

| Package @ version | Path | Advisory | Fixed in | In served runtime? | Fixed by any of #383–#387? |
|---|---|---|---|---|---|
| `next@16.2.10` | `.>next` | [GHSA-6gpp-xcg3-4w24](https://github.com/advisories/GHSA-6gpp-xcg3-4w24) — **Middleware / Proxy bypass in App Router** | 16.2.11 | **YES** | ❌ |
| `next@16.2.10` | `.>next` | [GHSA-89xv-2m56-2m9x](https://github.com/advisories/GHSA-89xv-2m56-2m9x) — SSRF in Server Actions | 16.2.11 | **YES** | ❌ |
| `next@16.2.10` | `.>next` | [GHSA-p9j2-gv94-2wf4](https://github.com/advisories/GHSA-p9j2-gv94-2wf4) — SSRF in rewrites | 16.2.11 | **YES** | ❌ |
| `next@16.2.10` | `.>next` | [GHSA-m99w-x7hq-7vfj](https://github.com/advisories/GHSA-m99w-x7hq-7vfj) — DoS via Server Actions | 16.2.11 | **YES** | ❌ |
| `sharp@0.34.5` | `.>next>sharp` | [GHSA-f88m-g3jw-g9cj](https://github.com/advisories/GHSA-f88m-g3jw-g9cj) — libvips CVE-2026-33327/33328/35590/35591 | 0.35.0 | YES (image opt.) | ❌ |
| `postcss@8.5.16` | `.>next>postcss` | [GHSA-r28c-9q8g-f849](https://github.com/advisories/GHSA-r28c-9q8g-f849) — path traversal in previous-source-map | 8.5.18 | build-time | ❌ (see P2-1) |
| `fast-uri@3.1.2` | `.>@sentry/nextjs>@sentry/webpack-plugin>webpack>schema-utils>ajv>fast-uri` | [GHSA-v2hh-gcrm-f6hx](https://github.com/advisories/GHSA-v2hh-gcrm-f6hx) — host confusion via backslash authority | 3.1.4 | build-time | ✅ **#387 only** |
| `fast-uri@3.1.2` | same | [GHSA-4c8g-83qw-93j6](https://github.com/advisories/GHSA-4c8g-83qw-93j6) — host confusion via failed IDN | 3.1.3 | build-time | ✅ **#387 only** |
| `brace-expansion@5.0.7` | `.>@sentry/nextjs>@sentry/bundler-plugin-core>glob>minimatch>brace-expansion` | [GHSA-mh99-v99m-4gvg](https://github.com/advisories/GHSA-mh99-v99m-4gvg) — DoS via unbounded expansion | 5.0.8 | build-time | ❌ |
| `hono@4.12.19` | `.>prisma>@prisma/dev>hono` | [GHSA-88fw-hqm2-52qc](https://github.com/advisories/GHSA-88fw-hqm2-52qc) — CORS reflects any Origin with credentials | 4.12.25 | dev-tool only | ❌ |

The 20 MODERATE are: 9 more `hono@4.12.19` + 2 `@hono/node-server@2.0.4` + 1
`valibot` (all `.>prisma>@prisma/dev>*`, dev-tool only), 5 more `next@16.2.10`
(cache confusion ×2, unbounded Server Action payload in Edge, image-optimisation
DoS, unauthenticated disclosure of internal Server info) — all fixed in 16.2.11.

### Advisories against the NEW versions being merged

**None.** Every target version and every transitive it moves is clean in the
GitHub Advisory Database as of 2026-07-28:

- `@sentry/nextjs@10.68.0` — 3 historical advisories, all patched long before 10.65.0
  (latest: [GHSA-6465-jgvq-jhgp](https://github.com/advisories/GHSA-6465-jgvq-jhgp),
  headers leaked when `sendDefaultPii: true`, fixed 10.27.0 — see P2-2, this repo
  never sets it).
- `@playwright/test@1.62.0` — clean. The one Playwright HIGH
  ([GHSA-7mvr-c777-76hp](https://github.com/advisories/GHSA-7mvr-c777-76hp),
  browsers downloaded without authenticity verification) was fixed in 1.55.1;
  the current pin 1.61.1 is already past it.
- `lucide-react@1.27.0` — zero advisories, ever.
- `shadcn@4.15.0` — zero advisories.
- `@tailwindcss/postcss@4.3.3` — zero advisories.
- Bumped transitives verified clean at their new versions: `undici@7.29.0`
  (7.28.0 already carried the cache-whitespace and WebSocket-fragment fixes),
  `systeminformation@5.33.1` (all 10 historical command-injection advisories,
  including 1 CRITICAL, patched at ≤5.31.7; current pin is 5.31.11),
  `hono@4.12.32`, `@hono/node-server@2.0.12`, `rollup@4.62.3`,
  `import-in-the-middle@3.3.2`, `postcss@8.5.23`, `express-rate-limit@8.6.1`.

### Bumps that CLOSE an advisory

**#387 (`shadcn`) only** — and not for shadcn's own code. It is the sole PR that
moves `fast-uri` 3.1.2 → 3.1.4, closing **two HIGH advisories**. See P2-3 for why
this is structurally uncomfortable rather than simply good news.

**#384 (`@sentry/nextjs`) closes zero.** Both `fast-uri` HIGHs *and* the
`brace-expansion` HIGH sit on paths rooted at `@sentry/nextjs`, and bumping
`@sentry/nextjs` fixes none of them — the vulnerable packages hang off
`@sentry/webpack-plugin` and `@sentry/bundler-plugin-core`, whose own transitive
pins did not move.

---

## P1 — BLOCKING

### P1-1 · `next@16.2.10` — middleware/proxy bypass, in a codebase whose entire request gate is middleware

`package.json:48` · `pnpm-lock.yaml` `.>next` · [GHSA-6gpp-xcg3-4w24](https://github.com/advisories/GHSA-6gpp-xcg3-4w24)

`next@16.2.10` carries **4 HIGH + 5 MODERATE** advisories, all patched in
**16.2.11**. None of the five PRs touches it, and `--audit-level=critical` means
CI has never reported it.

This is P1 and not P2 because of what this specific repo puts in middleware.
`CLAUDE.md` describes `proxy.ts` as *"Edge middleware: auth guards, rate-limit,
CSRF"* — three independent controls, one bypass. `proxy.ts` is also what enforces
the Phase-1 customer-auth 410 gate and the `/op/first-login` `requiresPasswordChange`
redirect (whose whole design rationale, per `AGENTS.md` 2026-05-18 Issue 010, was
that a *layer-level* guard is safer than per-route checks). A middleware bypass
inverts that reasoning.

The SSRF-in-Server-Actions advisory (GHSA-89xv-2m56-2m9x) compounds a gap the
project already logged: `CLAUDE.md` 2026-07-28 records that *"Server Actions are
not under `proxy.ts`'s `/api/*` gates"* — so Server Actions in this app have no
rate limit and no CSRF gate independent of Next's own.

**Action:** open a `next` 16.2.10 → 16.2.11 PR and merge it **before or alongside**
these five. None of #383–#387 is blocked *by* it, but merging five green dependabot
PRs while this sits unreported is the posture problem worth naming. `sharp@0.34.5`
(HIGH, libvips) rides in the same bump if `next` re-resolves it — verify after.

**Pre-existing. Not introduced by any of the five PRs.** Listed here because the
question asked was "does the dependency surface change the security posture of the
running application", and this is the dependency-surface fact that dominates all
five bumps combined.

---

## P2 — SHOULD FIX

### P2-1 · `pnpm.overrides.postcss` is a floor set *below* the patch line

`package.json:102`

```json
"pnpm": { "overrides": { "@hono/node-server": ">=1.19.13", "postcss": ">=8.5.10" } }
```

`postcss` is HIGH-vulnerable at `<=8.5.17` ([GHSA-r28c-9q8g-f849](https://github.com/advisories/GHSA-r28c-9q8g-f849)).
The override floor is `>=8.5.10` — seven patch versions short. Master's tree has
three postcss instances:

| Instance | Version | Consumer | After #383/#384/#386/#387 |
|---|---|---|---|
| `pnpm-lock.yaml:9859` | 8.5.16 | **`next`** | **8.5.16 — still vulnerable** |
| `pnpm-lock.yaml:10607` | 8.5.16 | `shadcn` | 8.5.23 (fixed by #387) |
| `pnpm-lock.yaml:11150` | 8.5.20 | `vite` | 8.5.23 (fixed by #384/#386/#387) |
| `pnpm-lock.yaml:7328` | 8.5.14 | `@tailwindcss/postcss` | removed by #383 |

Three of the five PRs bump *a* postcss instance to 8.5.23 and leave `.>next>postcss`
at 8.5.16 — which is the one `pnpm audit` reports. Merging all five leaves the HIGH
open.

**Fix:** raise the existing override to `"postcss": ">=8.5.18"`. One line, fixes
every instance at once, and the override mechanism is already in place. Note the
sibling `"@hono/node-server": ">=1.19.13"` has the same defect — it is two major
lines below the `>=2.0.10` needed for [GHSA-9mqv-5hh9-4cgg](https://github.com/advisories/GHSA-9mqv-5hh9-4cgg).
An override floor that predates the advisory is a floor that does nothing; both
should be re-derived from current patch lines rather than left at whatever value
resolved the original conflict.

### P2-2 · Sentry `dataCollection`: setting the key *at all* flips the base from restrictive to fully permissive — and 10.66 adds two new reasons to reach for it

`instrumentation.ts:20-33` · `instrumentation-client.ts:77-92`

Read from the installed SDK
(`node_modules/.pnpm/@sentry+core@10.65.0/.../resolveDataCollectionOptions.js`) and
confirmed identical in shape at
[10.68.0](https://raw.githubusercontent.com/getsentry/sentry-javascript/10.68.0/packages/core/src/utils/data-collection/resolveDataCollectionOptions.ts):

```js
const base = options.dataCollection != null
  ? DEFAULTS                                              // ← fully permissive
  : defaultPiiToCollectionOptions(options.sendDefaultPii); // ← restrictive when unset
```

| Category | `dataCollection` **absent** (this repo) | `dataCollection` **present** (any value) |
|---|---|---|
| `cookies` | `{ deny: PII_HEADER_SNIPPETS }` | **`true`** |
| `httpHeaders.request` / `.response` | `{ deny: … }` / `{ deny: … }` | **`true` / `true`** |
| `httpBodies` | `[]` | **all four: incoming/outgoing request/response** |
| `urlQueryParams` | `{ deny: … }` | **`true`** |
| `userInfo` | `false` | **`true`** |
| `genAI.inputs/outputs` | `false` / `false` | `true` / `true` |
| `databaseQueryData` *(new in 10.66)* | `false` | `true` |
| `graphQL` *(new in 10.66)* | `{document: true, variables: true}` | same |

So `dataCollection: { databaseQueryData: false }` — a maintainer trying to *reduce*
capture — silently turns **on** cookie capture, request **and** response header
capture, all four HTTP body categories, query-param capture and user info. The
project has already been bitten by this exact shape (`CLAUDE.md` 2026-07-28: an
env override enforced only inside `if (FLAG)`, so the "off" state suppressed the
check).

The bump 10.65 → 10.68 does not change the defaults, but **10.66 adds
`dataCollection.databaseQueryData` and `dataCollection.graphQL`** — two new
sub-keys that a maintainer reading the changelog would plausibly want to set. The
bump is what makes the footgun reachable.

This matters for Vietnam PDPL 2025 (memory: `user-handles-cdtia`) because
`connect-src ... https://*.ingest.sentry.io` (`next.config.ts:19`) is a
**cross-border** egress path, and the categories above are exactly customer phone /
name / address territory (`bb_hold` cookie, `Authorization` headers, booking
request bodies).

The repo's own belt-and-braces would **not** catch it — see P3-4.

**Fix:** pin `dataCollection` explicitly *now*, with every category stated, rather
than relying on the absent-key branch:

```ts
dataCollection: {
  userInfo: false, cookies: false,
  httpHeaders: { request: false, response: false },
  httpBodies: [], urlQueryParams: false,
  databaseQueryData: false, genAI: { inputs: false, outputs: false },
},
```

…and add a unit assertion on the resolved options so a future SDK default shift
fails a test instead of shipping.

### P2-3 · Merge order determines the resulting security posture — do not audit these PRs one at a time

Each dependabot PR regenerates the whole lockfile, re-floating unrelated transitives.
The set of *incidental* fixes differs per PR and is arbitrary:

- `fast-uri` 3.1.2 → **3.1.4** — only in #387 (`pr387` lock diff, single shared
  instance at `pnpm-lock.yaml:3255`). Closes 2 HIGH.
- `postcss` 8.5.20 → 8.5.23 — in #384, #386, #387.
- `browserslist` / `baseline-browser-mapping` / `electron-to-chromium` — in all five.
- `enhanced-resolve` 5.21.3 and `nanoid` 3.3.12 duplicates dropped — only in #383.

Consequence: whichever PR is merged **last** regenerates the lock against the then-current
registry, and the two HIGH `fast-uri` fixes that arrive with #387 are not guaranteed to
survive a later merge that re-resolves that subtree.

**Action:** merge the five, then run `pnpm audit --prod` (no `--audit-level`) **once on
the merged result** and confirm the count has gone `30 → 28`. Per-PR CI green tells you
nothing here, because per-PR CI is `--audit-level=critical` and reports 0 either way.

### P2-4 · `shadcn` in prod `dependencies` puts three network/exec-capable subtrees into the production install

`package.json:54`

`shadcn` is a scaffolding CLI. It is imported by **zero** files under `app/`,
`components/`, `lib/`, `scripts/` (verified by grep); `components.json` confirms
CLI-only use. But because it sits in `dependencies`, its whole tree is installed
by `pnpm install --prod` and scanned by `pnpm audit --prod`:

| Subtree | Capability |
|---|---|
| `shadcn > @dotenvx/dotenvx > systeminformation@5.31.11 → 5.33.1` | **spawns shell commands** (`child_process`) to enumerate host state. 10 command-injection advisories in its history, one CRITICAL ([GHSA-gx6r-qc2v-3p3v](https://github.com/advisories/GHSA-gx6r-qc2v-3p3v)), 4 of them in the last 12 months |
| `shadcn > @dotenvx/dotenvx > undici@7.28.0 → 7.29.0` | HTTP client — **network egress** |
| `shadcn > @modelcontextprotocol/sdk > hono@4.12.27 → 4.12.32`, `@hono/node-server@2.0.6 → 2.0.12`, `express@5.2.1`, `express-rate-limit`, `eventsource` | **two full HTTP servers** + SSE client |

None of these is a *new* package — every one is a version change of something
already present (see "no new packages" below) — so this is not a regression
introduced by #387. But merging #387 entrenches it, and it is the reason the
`--audit-level` loosening feels necessary: most of the audit noise the gate was
loosened to silence comes from CLI trees that have no business being in the
production install at all.

**Fix:** move `shadcn` to `devDependencies`. This removes 3 capability-bearing
subtrees from the prod attack surface *and* shrinks `pnpm audit --prod` enough to
make P2-5's `--audit-level=high` tractable. *(The placement/semver rationale is the
other reviewer's lens; recorded here only for the attack-surface consequence.)*

### P2-5 · The `--audit-level=critical` exemption is now suppressing far more than the transitive it was granted for

`.github/workflows/ci.yml:339` · rationale in `CLAUDE.md` 2026-06-21 (WT-21)

The log records the loosening as scoped: *"Transitive vuln in `prisma>@prisma/dev>hono`
(CORS middleware CVE) — not actionable, Prisma internal dev tool we don't use. Fix:
changed to `--audit-level=critical`."*

That reasoning is still sound for `@prisma/dev`. But the mechanism chosen was a
**global severity floor**, not a scoped ignore — so it now also suppresses a
Next.js middleware bypass in the served application. This is the same shape as
`CLAUDE.md` 2026-07-28's `RATELIMIT_EXEMPT` and fail-open-limiter entries: *a
blanket policy on the transport is a policy on every caller, including the ones
for which it is a vulnerability.*

**Fix:** restore `--audit-level=high` and scope the exemption to the package that
earned it — either an explicit ignore list for the `@prisma/dev` subtree, or
`pnpm.auditConfig.ignoreGhsas` naming the specific GHSA IDs with an expiry comment.
Pairing this with P2-4 (moving `shadcn` to dev) drops the prod-tree HIGH count to a
size where `--audit-level=high` is a gate a human can keep green.

---

## P3 — ADVISORY

### P3-1 · `@sentry/nextjs` is the only one of the five without SLSA provenance — and the only one shipping browser code with external network egress

`package.json:37`

```
lucide-react@1.27.0        provenance: https://slsa.dev/provenance/v1   publisher: GitHub Actions
shadcn@4.15.0              provenance: https://slsa.dev/provenance/v1   publisher: GitHub Actions
@playwright/test@1.62.0    provenance: https://slsa.dev/provenance/v1   publisher: GitHub Actions
@tailwindcss/postcss@4.3.3 provenance: https://slsa.dev/provenance/v1   publisher: GitHub Actions
@sentry/nextjs@10.68.0     provenance: (none)                           publisher: sentry-bot
@sentry/nextjs@10.65.0     provenance: (none)                           publisher: sentry-bot
```

`@sentry/nextjs@10.68.0` carries only registry signatures (`dist.signatures`, keyid
`SHA256:DhQ8wR5...`), which attest that npm served the tarball — not that it was
built from the claimed source. Sole maintainer: the bot account
`sentry-bot <accounts@sentry.io>`. 610 files, 1.9 MB unpacked.

Unchanged between 10.65.0 and 10.68.0, so this is **not a regression** — but it is
the relevant posture fact for the one package in this set that (a) ships runtime
code into the served browser bundle and (b) has an allow-listed CSP egress to an
external host (`next.config.ts:19`).

### P3-2 · Three of the five bumps are to releases published within 4 days of review; `lucide-react` is single-maintainer

| Package | Target published | Age at review |
|---|---|---|
| `lucide-react@1.27.0` | 2026-07-25 21:03 UTC | **3 days** |
| `shadcn@4.15.0` | 2026-07-25 18:05 UTC | **3 days** |
| `@sentry/nextjs@10.68.0` | 2026-07-24 09:09 UTC | **4 days** |
| `@playwright/test@1.62.0` | 2026-07-24 21:57 UTC | 4 days |
| `@tailwindcss/postcss@4.3.3` | 2026-07-16 12:03 UTC | 12 days |

`lucide-react` has **one** maintainer (`ericfennis <eric.fennis@gmail.com>`) and
shipped 6 minor releases in 5 weeks (1.21.0 on 06-18 → 1.27.0 on 07-25). It renders
in the client bundle on every page. No advisories, no maintainer handoff detected,
provenance present — so nothing is wrong today.

The 2026 npm worm campaigns (Shai-Hulud / Miasma lineage; the June 3 `binding.gyp`
wave compromised 57 packages across 286 versions in under two hours) all propagate
by republishing from compromised maintainer accounts, and detection lags publication
by days. `lucide-react` was **not** on that campaign's affected list — checked
against the Snyk zero-day tracker and the GitHub Advisory DB (`total_count: 0` for
`lucide-react`), so an earlier search snippet suggesting otherwise is unsupported.

**Suggestion:** configure a dependabot `cooldown` (e.g. 7 days) for
production-`dependencies` bumps that reach the client bundle. Cheap; removes the
same-week-publish window entirely.

### P3-3 · #384 quietly bumps four runtime source-rewriting packages that the PR title does not name

`pr384` lock diff · `package.json:37`

Riding inside "bump @sentry/nextjs":

| Package | Change | Capability |
|---|---|---|
| `@apm-js-collab/code-transformer` | 0.15.0 → **0.18.1** | rewrites application source at build/load time (Rust→WASM, forked from `DataDog/orchestrion-js`) |
| `@apm-js-collab/code-transformer-bundler-plugins` | 0.5.0 → **0.7.1** | injects the above into the bundler pipeline |
| `@apm-js-collab/tracing-hooks` | 0.10.1 → **0.13.0** | Node module-load hooks |
| `import-in-the-middle` | 3.3.1 → **3.3.2** | intercepts every ESM import in the server process |

This is the highest-capability class in the tree: a compromise here is arbitrary
code in the server bundle, executed before any application code runs, with no
signature to forge. Sentry 10.66 explicitly migrated more instrumentation onto
orchestrion, and 10.68 continues (Firebase, Cloudflare).

Provenance check on `@apm-js-collab`: SLSA v1 attestations present, published via
GitHub Actions, but the org is young (first publish **2025-01-31**) and the
packages are maintained by two individuals (`timfish`, `bizob2828`) rather than an
org bot. Zero advisories. **No defect found — recorded as capability inventory**, so
that a future advisory against `@apm-js-collab/*` is recognised as server-side RCE
rather than filed as "a Sentry sub-dep".

### P3-4 · `beforeSend` scrubs `extra` and `contexts` only — not the surfaces `dataCollection` controls

`instrumentation.ts:24-32` · `instrumentation-client.ts:81-91`

Both hooks are identical in shape:

```ts
beforeSend(event) {
  if (event.extra)    event.extra    = scrubPii(event.extra)    as …;
  if (event.contexts) event.contexts = scrubPii(event.contexts) as …;
  return event;
}
```

Not scrubbed: `event.request` (url / headers / cookies), `event.breadcrumbs`,
`event.user`, `event.exception.values[].value`, `event.tags`.

Two consequences:

1. **It cannot mitigate P2-2.** Every category `dataCollection` gates —
   cookies, headers, HTTP bodies, query params, user info — lands in `event.request`
   or `event.user`, neither of which this hook touches. The file's own docblock
   calls it *"belt-and-suspenders … this catches any direct SDK call that bypasses
   the abstraction"* — true for `extra`/`contexts`, false for everything the SDK
   captures automatically.

2. **`event.request.url` is captured unconditionally**, independent of any
   `dataCollection` setting. This app has token-bearing URL *paths*:
   `app/(customer)/booking/result/[token]`, `app/(customer)/booking/confirmation/[token]`,
   `app/(customer)/charter/status/[ref]`. A client-side error on any of those pages
   transmits the ticket token to Sentry. Path segments are not query params, so no
   deny-list reaches them.

   Client breadcrumbs compound this: the browser SDK's default integrations include
   `breadcrumbsIntegration` (console args verbatim, fetch/xhr URLs, DOM click
   targets) — none of it scrubbed here.

**Pre-existing; not introduced by #384.** Recorded because #384 is the PR that puts
this file under review, and because the fix for P2-2 should extend `beforeSend` to
`event.request` and `event.breadcrumbs` in the same commit.

**Verified inert, for the record:** Session Replay is **not** enabled. `@sentry/replay`
and `@sentry/replay-canvas` are in the tree, but `replayIntegration` is absent from
`getDefaultIntegrations()` in the installed `@sentry/nextjs` client build, and no
`replaysSessionSampleRate` / `replaysOnErrorSampleRate` is set. Had it been on, it
would record DOM including customer phone/name form fields. Re-check this if anyone
adds an `integrations:` array.

---

## Sentry PII verdict — check #3

> **NO CHANGE. 10.65.0 → 10.68.0 does not alter what this application captures or
> transmits.**

Evidence:

1. **`sendDefaultPii` is not set** anywhere in the repo. `SENTRY_DSN` is
   `z.string().optional()` (`lib/config/env.ts:277`); both inits pass only
   `dsn`, `environment`, `tracesSampleRate: 0`, `beforeSend`.
2. **`dataCollection` is not set**, so `resolveDataCollectionOptions` takes the
   `defaultPiiToCollectionOptions(undefined)` branch. Read at 10.68.0 source:
   `userInfo: false`, `cookies: {deny: PII_HEADER_SNIPPETS}`, both `httpHeaders`
   deny-listed, `httpBodies: []`, `urlQueryParams: {deny: …}`,
   `genAI: {inputs: false, outputs: false}`, **`databaseQueryData: false`**.
   The two keys new in 10.66 land on the safe side of the fallback.
3. `graphQL: {document: true, variables: true}` is `true` even in the restrictive
   branch (upstream comment: *"to preserve that behavior"*) — **inert here**: this
   app is Prisma + REST, no GraphQL layer.
4. **`tracesSampleRate: 0`** in both inits. 10.68's new `URL.full` / `URL.path`
   span attributes on server spans and core fetch instrumentation are therefore
   never transmitted — spans are created but dropped before send. Re-evaluate this
   line if tracing is ever turned on: `URL.full` includes the query string, and
   10.66's `dataCollection.databaseQueryData` gates DB filter values / mutation
   bodies onto span attributes, which `beforeSend`'s `extra`/`contexts` scrubbing
   does not reach.
5. No change to breadcrumb scope, replay defaults, request-body capture or
   `sendDefaultPii` semantics in the 10.66 / 10.67 / 10.68 changelogs. 10.67's
   `queryParams` → `urlQueryParams` rename is back-compatible and this repo sets
   neither.

The forward-looking risk is P2-2 (presence of the key flips the base), not the
bump itself.

---

## Check #4 — newly-added transitive packages with capability

**None. There are zero genuinely new packages across all five lock diffs.**

Every entry in every diff is a *version change* of a package already present in
`master`'s `pnpm-lock.yaml` — verified by grepping each added package name against
the pre-merge lock. The packages that *look* new in #387 (`iconv-lite@0.7.3`,
`fast-uri@3.1.4`, `ip-address@10.3.1`, `media-typer@1.1.1`, `hono@4.12.32`,
`undici@7.29.0`, `systeminformation@5.33.1`, `@hono/node-server@2.0.12`,
`express-rate-limit@8.6.1`, `fs-extra@11.4.0`, `yocto-spinner`, `yoctocolors`) all
have predecessors at `pnpm-lock.yaml:3536, 3255, 3574, 4113, 3496, 5300, 5131,
6262, 3212, 3326, 5573, 5577`.

Capability-bearing packages whose *versions* move are inventoried in P2-4 (network
/ `child_process` / HTTP servers, via `shadcn`) and P3-3 (source rewriting + module-load
interception, via `@sentry/nextjs`).

`@sentry/nextjs`'s removed `es-module-lexer@2.3.0` and `#383`'s removed
`enhanced-resolve@5.21.3` / `nanoid@3.3.12` / `postcss@8.5.14` are net
**reductions** in duplicate instances — mildly positive.

---

## RECOMMENDED NEXT

1. **Open a `next` 16.2.10 → 16.2.11 PR** (P1-1) and treat it as higher priority
   than any of these five. Confirm `sharp` re-resolves to ≥0.35.0 with it.
2. **Raise `pnpm.overrides.postcss` to `>=8.5.18`** and `@hono/node-server` to
   `>=2.0.10` (P2-1) — one-line, closes a HIGH the five PRs leave open.
3. **Merge all five.** No blockers in any of them.
4. **After merging, run `pnpm audit --prod` with no `--audit-level`** and confirm
   `30 → 28` (P2-3). Per-PR CI cannot tell you this.
5. **Pin `dataCollection` explicitly** in both `instrumentation.ts` and
   `instrumentation-client.ts`, and extend `beforeSend` to `event.request` +
   `event.breadcrumbs` in the same commit (P2-2 + P3-4).
6. **Move `shadcn` to `devDependencies`**, then restore CI to
   `--audit-level=high` with a scoped GHSA ignore list for the `@prisma/dev`
   subtree (P2-4 + P2-5).
7. Consider a 7-day dependabot `cooldown` on prod-`dependencies` bumps (P3-2).

```
SUMMARY: 1 P1 · 4 P2 · 4 P3
         0 advisories against any new version · 0 new packages
         Sentry PII posture: UNCHANGED
         All five PRs SAFE TO MERGE
         30 open advisories in the prod tree (10 HIGH) that CI reports as green
```
