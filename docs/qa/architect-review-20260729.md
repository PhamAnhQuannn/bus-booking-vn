# ARCHITECT REVIEW — repo-wide (local mode, read-only)

```
Date:    2026-07-29
Tree:    D:\Bus-Booking @ branch feat/tourism-kb-scripts
         NOTE: the working tree was on `docs/post-merge-mistake-log-and-pickup-comment-drift`
         when this review was commissioned; it had already moved to `feat/tourism-kb-scripts`
         by the time the audit ran (concurrent agents share this tree). This review performed
         NO checkout and did not move HEAD. Validity for master is established below.
Scope:   Job 1 — merge-gate on PRs #386 / #385 / #384 / #383
         Job 2 — verify the import-x/no-cycle gate is genuinely enforcing (post #390/#343)
Method:  READ-ONLY. No checkout, no worktree, no install, no source mutation.
         Evidence from `gh pr diff`, `npx eslint`, `npx eslint --print-config`,
         and an independent import-graph/Tarjan SCC pass run from the scratchpad.
Scanned: 953 source files (app/ components/ lib/), 669 non-test graph nodes, 2507 edges,
         131 commits / 30-day churn window.
```

### Validity of this audit for `master`

The audited tree diverges from `origin/master` by **two source files, both comment-only**:

```
git diff --stat origin/master...HEAD -- app lib components eslint.config.mjs package.json tsconfig.json
  lib/booking/getManifest.ts | 9 +++++++--
  lib/geo/vnAdmin.ts         | 5 +++--
```

Both diffs are docblock text (#366 pickup-comment drift); neither adds, removes, or changes a
single `import`. Critically, **`eslint.config.mjs`, `package.json`, and `tsconfig.json` are
byte-identical to `origin/master`** — they do not appear in the diff at all. The remaining
divergence is confined to `scripts/` (39 files), `.gitignore`, `.husky`, and `CLAUDE.md`.

Therefore every Job 2 conclusion about the gate, and every graph finding below, holds for
`master` unchanged.

---

## SUMMARY

**0 P1 · 2 P2 · 5 P3**

- **PRs #386, #385, #384, #383 — no blockers. All four cleared to merge.**
- **The `import-x/no-cycle` gate IS genuinely enforcing today.** Both #333 root causes are
  provably dead, verified by direct execution rather than by reading the config. Details in
  Job 2 below.

---

# JOB 1 — the four queued dependency PRs

| PR | Bump | Files | CI | Verdict |
|----|------|-------|----|---------|
| #386 | `lucide-react` 1.22.0 → 1.27.0 | package.json, pnpm-lock.yaml | CLEAN (9 checks) | **PASS** |
| #385 | `@playwright/test` 1.61.1 → 1.62.0 | package.json, pnpm-lock.yaml | CLEAN (9 checks) | **PASS** |
| #384 | `@sentry/nextjs` 10.65.0 → 10.68.0 | package.json, pnpm-lock.yaml | CLEAN (9 checks) | **PASS** |
| #383 | `@tailwindcss/postcss` 4.3.0 → 4.3.3 | pnpm-lock.yaml **only** | CLEAN (9 checks) | **PASS** |

**Architectural signal: none, as expected.** Each `package.json` diff is literally one line
(`#383` does not touch `package.json` at all — the existing `^4` range already admits 4.3.3,
so it is a lockfile-only resolution bump).

**The one real question — does any of the four change a module boundary, a layer rule, or the
dependency graph the ESLint boundaries config enforces? Answer: no.** Verified concretely:

- None touches `eslint.config.mjs`, `tsconfig.json`, `.github/workflows/`, or any file under
  `lib/`, `app/`, `components/`.
- None touches `eslint`, `eslint-plugin-import-x`, `eslint-plugin-boundaries`,
  `eslint-import-resolver-typescript`, `eslint-config-next`, or `typescript` — i.e. nothing in
  the toolchain that computes or enforces the graph. This was the specific risk worth checking,
  because a resolver or plugin bump is exactly how the #333 blindness could silently return.
- The incidental lockfile churn is peer-resolution noise only: `#385`'s `next@…` lines change
  solely because `@playwright/test` appears inside next's peer-resolution key
  (`(@playwright/test@1.61.1)` → `(@playwright/test@1.62.0)`); `#383` drops now-unreferenced
  duplicate entries (`enhanced-resolve@5.21.3`, `nanoid@3.3.12`, `postcss@8.5.14`). No
  first-party dependency is added or removed anywhere in the four.

**ADR coverage for the four (Category 4):** all covered by existing ADRs — `@sentry/nextjs`
→ `ADR-007-observability`, `@playwright/test` → `ADR-018-testing-strategy`, Tailwind and
`lucide-react` → `ADR-001-stack-pick`. No ADR gap; these are version bumps of already-recorded
choices, not new architectural decisions.

**Note on check count (2026-07-28 mistake-log entry):** all four report the full ~9-check
suite, not the reduced 2 checks that stacked/branch-based PRs silently receive. All four are
`base: master`, `mergeable: MERGEABLE`, `mergeStateStatus: CLEAN`.

---

# JOB 2 — is the no-cycle gate actually firing?

## Verdict: **YES — genuinely enforcing.** Not a silent rule.

I deliberately did not accept "0 cycles" at face value, because a blind rule and a clean tree
produce byte-identical output. Four independent lines of evidence settle it.

### The four config checks (all PASS)

Resolved config for a real `app/` file, via
`npx eslint --print-config "app/op/(console)/routes/RoutesClient.tsx"` — this is the *effective*
config, not the source text, so it also proves no later block overrides it:

```
no-cycle:                 [2, {"maxDepth":null,"ignoreExternal":true,
                               "allowUnsafeDynamicCyclicDependency":false}]
settings.extensions:      [".ts",".tsx",".mts",".cts",".js",".jsx",".mjs",".cjs"]
resolver-next present:    true
legacy resolver present:  false
```

1. **Resolver wired via `resolver-next`, not the legacy object form** — PASS.
   `eslint.config.mjs:130-132` uses `createTypeScriptImportResolver({project:'./tsconfig.json'})`.
   `import-x/resolver` (legacy, silently ignored by v4) is **absent** from the resolved config.
2. **`import-x/extensions` includes `.ts`/`.tsx`/`.mts`/`.cts`** — PASS. `eslint.config.mjs:138`.
3. **`import-x/no-cycle` at `error`** — PASS. Severity `2` in the resolved config
   (`eslint.config.mjs:186`). `maxDepth` serialises to `null` in JSON only because the source
   value is `Infinity`; `no-cycle.js:50-52` treats any non-number as `Number.POSITIVE_INFINITY`,
   so depth is unbounded either way.
4. **The temporary `warn` override scoped to `lib/{booking,payment,ledger}` is DELETED** — PASS.
   This was the flagged P1 candidate and it is clean. `eslint.config.mjs` contains exactly **one**
   `no-cycle` entry, at `error`, with no `files`-scoped downgrade anywhere in the array; the only
   config object after it is `globalIgnores`, which lists no `lib/` path. `eslint.config.mjs:180-185`
   records the deletion and warns future readers not to re-add a domain-scoped downgrade. The three
   highest-traffic money domains **are** guarded.

### Direct proof the two #333 failure modes are dead

Config review alone would only prove the text was changed, not that it works. I executed both
gates directly (scratchpad script, repo untouched):

```
resolver: eslint-import-resolver-typescript  iface 3
RESOLVE @/lib/payment       from lib/booking/createCashBooking.ts
                            => {"found":true,"path":"D:\Bus-Booking\lib\payment\index.ts"}
RESOLVE @/lib/notification  from lib/payment/processWebhook.ts
                            => {"found":true,"path":"D:\Bus-Booking\lib\notification\index.ts"}
RESOLVE ./esmsClient        from lib/notification/esms.ts
                            => {"found":true,"path":"D:\Bus-Booking\lib\notification\esmsClient.ts"}

getFileExtensions({})              = ['.js', '.mjs', '.cjs']        <-- the #333 default
getFileExtensions(repo settings)   = ['.ts','.tsx','.mts','.cts','.js','.jsx','.mjs','.cjs']
```

The first block kills #333 cause (1): the TS resolver loads and resolves `@/*` aliases to real
`.ts` files. The second kills cause (2): the library default is *exactly* the three-extension set
the mistake-log entry names, and the repo's setting widens it to cover every source extension.
Those are the only two gates between `ExportMap` and the graph.

### Cross-check: an independent graph agrees with ESLint

I rebuilt the import graph from source (regex import lexer + `@/*` and relative resolution +
Tarjan SCC) and compared against `npx eslint`:

```
npx eslint (whole repo):  0 errors, 43 warnings   (all 43 are @typescript-eslint/no-unused-vars)
independent Tarjan:       0 cycles over VALUE edges
                          4 SCCs that exist ONLY when type-only edges are counted
```

The two analyses agree exactly, and the residual is fully explained: `no-cycle` skips type-only
imports **by design**, at both the entry point and during traversal —
`no-cycle.js:68-72` (`importKind === 'type'`, or every specifier inline-`type`) and
`no-cycle.js:94-95` (`!isOnlyImportingTypes`). So ESLint's 0 is the *correct* answer for the
value-edge graph, not a symptom of a blind walker.

### Historical firing evidence

Commit `329315f` ("burn down all 11 barrel cycles…") reports running counts in its own message —
*"Cycles: 11 -> 5"*, then to 0 — under these exact settings. A rule that reports a decreasing
non-zero count is a rule that runs. `eslint.config.mjs` has not been modified since that commit
(`git log -- eslint.config.mjs` → `329315f` is HEAD for that path), and none of the four queued
PRs touches it.

### Answer to the required question

**"0 cycles" here is evidence of a clean tree, not evidence of a silent rule** — established by
checks 1-4 passing, by direct execution of both gate mechanisms, and by an independent SCC pass
that independently returns 0 on the value-edge graph.

### Injection recipe (not run — no mutation permitted)

Recorded so a future run can re-confirm cheaply. Per the #333 rule, prove the rule fires *before*
trusting a green result:

```bash
# 1. two mutually-importing VALUE modules inside one guarded domain
printf "import { b } from './_cyc_b';\nexport const a = () => b();\n" > lib/booking/_cyc_a.ts
printf "import { a } from './_cyc_a';\nexport const b = () => a();\n" > lib/booking/_cyc_b.ts
npx eslint lib/booking/_cyc_a.ts     # MUST print: error  Dependency cycle detected  import-x/no-cycle
rm lib/booking/_cyc_a.ts lib/booking/_cyc_b.ts
```
Use **value** imports — `import type` is skipped by design and would produce a false "gate is
broken" reading. A cross-domain variant (`lib/payment` ↔ `lib/ledger` via barrels) additionally
confirms the deleted `warn` override has not been reintroduced.

---

# FINDINGS

## PRIORITY 1 — none

No cycles, no layer violations, no domain-invariant breaches, no ADR gaps blocking merge.
Specifically checked and clean:

- `lib/core` → domain imports (SYS20 rule 4): **0 edges**.
- `'use client'` files value-importing a server-only domain barrel (the 2026-06-04 P1 class that
  took down the whole operator portal): **0**. Two value imports of a domain barrel exist —
  `components/home/PopularDestinations.tsx:20` and `components/home/PopularTrips.tsx:16`, both
  `import { searchHref } from '@/lib/search'` — and both are safe: `lib/search/index.ts`
  re-exports only `applyTripFilters` and `searchHref`, whose sole imports are `import type`
  (`lib/search/applyTripFilters.ts:13-14`). No server-only, `pg`, Prisma, or `next/server`
  transitive. The other 20 client→domain-barrel imports are all type-only and erase at compile
  time.
- God module (>70% of files): **none**. Highest is `lib/core/db/client.ts` at 252 importers
  (26.4%), which is a core primitive at the bottom of the declared layer flow.

## PRIORITY 2 — fix before next release

### [P2] Four cross-domain cycles survive, held open only by `import type` — and the config comment reads as broader than what holds

`eslint.config.mjs:180-185` states *"the count is 0 and the rule now genuinely blocks everywhere."*
That is true of **value** cycles. It is not true of the module graph as a whole: four SCCs remain,
each closed by exactly one type-only edge.

```
lib/booking/index.ts:20      export { createCashBooking, ... } from './createCashBooking'
lib/booking/createCashBooking.ts:19   import { appendBookingPaidLedger } from '@/lib/payment'
lib/payment/index.ts:9       export { processPaymentWebhook, ... } from './processWebhook'
lib/payment/processWebhook.ts:48      import { renderTemplate } from '@/lib/notification'
lib/notification/index.ts:13 export { dispatchNotifications, ... } from './dispatchNotifications'
lib/notification/dispatchNotifications.ts:40  import type { JobCore, JobOpts } from '@/lib/jobs'   <-- [type]
lib/jobs/index.ts:9          export { generateTicketPdfs } from './generateTicketPdfs'
lib/jobs/generateTicketPdfs.ts:28     import type { CustomerBookingDetail } from '@/lib/booking'  <-- [type]
   -> back to lib/booking/index.ts
```

Second, disjoint chain through `lib/trips`:
`lib/payment/index.ts:9` → `lib/payment/processWebhook.ts:48` → `lib/notification/index.ts:13` →
`lib/notification/dispatchNotifications.ts:40` *[type]* → `lib/jobs/index.ts:5` →
`lib/jobs/autoCompleteTrips.ts:16` → `lib/trips/index.ts:7` → `lib/trips/cancelTrip.ts:21`
(`import { refundOut } from '@/lib/payment'`) → back to `lib/payment/index.ts`.

Plus two local pairs:
- `lib/notification/esms.ts:15` → `lib/notification/esmsClient.ts:18` *[type]* → back.
- `app/op/(console)/routes/RoutesClient.tsx:34` → `app/op/(console)/routes/RouteEditDialog.tsx:20`
  *[type]* → back.

**This is fail-safe, not a hole** — converting any one of those `import type`s to a value import
makes the whole chain value-only and `no-cycle` fires immediately. So it does not block the four
PRs and it is not a P1. It is P2 because the *documentation* overstates the guarantee: a future
reader who needs a runtime symbol where a type currently suffices will be surprised by a build
failure spanning seven domains (`booking → payment → notification → jobs → trips → ledger →
account`), and the comment currently reads as if that were impossible. Fix: amend the comment at
`eslint.config.mjs:180-185` to say *value* cycles are at zero and name the four type-only-closed
chains, so the next reader knows the seam is load-bearing.

### [P2] Eight domain barrels are re-export piles above the Category-3 threshold

Public-API surface with near-zero implementation (`>20` exports → shallow module):

| Barrel | Exports | Lines |
|---|---|---|
| `lib/auth/index.ts` | 67 | 62 |
| `lib/ledger/index.ts` | 58 | 105 |
| `lib/onboarding/index.ts` | 51 | 76 |
| `lib/booking/index.ts` | 39 | 38 |
| `lib/admin/index.ts` | 37 | 33 |
| `lib/charter/index.ts` | 31 | 47 |
| `lib/api/index.ts` | 30 | 41 |
| `lib/trips/index.ts` | 22 | 54 |

Flagging with the caveat that this is **mandated** by ADR-016 / SYS20 rule 3 (barrel-only
cross-domain entry), so it is a consequence of a recorded decision, not accidental drift. The
reason it still matters is the causal link `329315f` itself identifies: *"a barrel re-exports the
whole domain, so any bidirectional domain pair is automatically a cycle even when the symbols
involved do not cycle at runtime."* Barrel width is the mechanism that manufactures cycle
pressure — the four surviving type-only cycles above are all barrel-routed, and none of them is a
real runtime cycle. Every future cross-domain need in `lib/auth` (67 exports) is a coin-flip on
whether it creates a cycle the author must then refactor around. The durable fix is the one #343
already used twice: move shared leaves down into `lib/core` (as `bookingRef` and the transition
map were) rather than widening barrels. Track via `/improve-codebase-architecture`; no action
needed for this merge.

## PRIORITY 3 — track on roadmap

### [P3] `lib/config` ↔ `lib/core` is a bidirectional folder dependency
`lib/core/config/index.ts:9` is `export * from '@/lib/config'`, while `lib/config/env.ts:9-10`
imports `@/lib/core/db/poolConfig` and `@/lib/core/http/ratelimitBackend`. This registers as a
domain-level SCC in the graph but is **not** a file-level cycle — both of those `lib/core`
targets are pure leaves with zero imports, so nothing loops back and `no-cycle` (which is
file-level) is correct to stay silent. It is also a deliberate, documented exemption: `config` is
excluded from `LIB_DOMAINS` (`eslint.config.mjs:13-14`) as a core primitive, and the shim header
says the env module "does NOT move in this scaffold wave". Worth retiring the shim when
convenient so the folder graph is acyclic too.

### [P3] `no-cycle` scope excludes root-level and out-of-tree source
The rule block (`eslint.config.mjs:112`) covers `app/**`, `components/**`, `lib/**`. Not covered:
root-level `proxy.ts` / `instrumentation.ts` / `sentry.*.config.ts`, plus `scripts/**` and
`e2e/**`. Low risk — a cycle requires ≥2 mutually-importing modules and these are entry points or
leaves that nothing imports back — but a cycle *through* them would be invisible.

### [P3] `app/dev/**` is exempt from both `boundaries/entry-point` and `no-cycle`
`eslint.config.mjs:115,125`. Justified (local-only stub scaffolding reaching stub internals), but
worth noting alongside the 2026-07-28 finding that `/dev/stub-pay` was a reachable signing oracle:
this tree is exempt from the module-boundary gates as well as from the payment gates.

### [P3] AGENTS.md's documented client-barrel-leak guard is stale relative to the real CI script
AGENTS.md (2026-06-04 entry) documents the guard as a grep for `from '@/lib/auth'` only. The
actual CI job (`scripts/audit/greppable-invariants.sh`, G6, wired at
`.github/workflows/ci.yml:341-349`) is far stronger: it derives the server-only barrel set by
fixpoint taint propagation, asserts a required set
(`auth booking payment notification admin onboarding config geo einvoice ratelimit`), fails if
the derivation collapses below 20 tainted domains, and excludes `import type`. Documentation
drift only — the guard is in better shape than its write-up. Worth correcting the AGENTS.md text
so nobody "restores" the weaker version.

### [P3] Coupling spread is healthy — recorded as baseline
30-day window, 131 commits. Highest-churn files: `app/(customer)/page.tsx` (11),
`lib/config/env.ts` (9), `lib/jobs/reconcilePayments.ts` (8, with its test at 8),
`lib/payment/adapters/bankTransfer.ts` (7, with its test at 7). No file repeatedly spanning >3
domains; the payment/reconcile churn is a single coherent domain pair and matches the
recorded SePay/Bug-B work. No missing seam indicated.

## Category 6 — dep-graph drift

Prior snapshot: `docs/qa/arch-graph.json` @ commit `158c3fb` — generated 2026-07-23 in PR mode
against **PR #324** (`fix/bank-transfer-reconcile-orphan`, head `0435fe17`).

**IMPROVEMENT — `lib/ledger` has left the cross-domain SCC.** This is the measurable payoff of
#343/#390 and it confirms the burndown did what its commit message claimed:

```
prior (2026-07-23, PR #324) — 8-domain module SCC:
  lib/auth, lib/account, lib/trips, lib/jobs, lib/notification, lib/ledger, lib/payment, lib/booking

current (2026-07-29, master-equivalent) — 7-domain module SCC:
  lib/auth, lib/account, lib/trips, lib/jobs, lib/notification, lib/payment, lib/booking
                                                        ^ lib/ledger REMOVED
```

`lib/ledger` dropping out matches `329315f`'s second commit (`refundOut` moved into
`lib/payment`, breaking the `ledger ↔ payment` pair). Per the skill's drift rules, a removed
boundary-crossing edge is **SAFE / noted as improvement**.

**No new boundary-crossing edges and no new cycles** versus the prior snapshot.

Two caveats on comparing the raw counts (`files 669` both runs, but `file_edges` 1984 prior vs
2507 now): the two snapshots were produced by different lexers with different inclusion rules —
this run counts `export … from` re-exports and dynamic `import()` as edges. The **SCC membership
comparison above is the meaningful signal**; the edge totals are not directly comparable and
should not be read as graph growth.

The residual 7-domain SCC is the type-only-closed chain documented in the P2 finding — it is a
module-*folder*-level SCC, not a value-edge cycle, which is why `no-cycle` correctly reports zero.

Snapshot overwritten with the current graph, with the prior run's provenance preserved in the
`previous` key.

---

## RECOMMENDED NEXT STEPS

1. **Merge #386, #385, #384, #383.** No architectural objection; all four CLEAN on the full check
   suite. Nothing in them can affect the boundary or cycle gates.
2. Amend `eslint.config.mjs:180-185` so the "0 cycles" claim reads *value cycles* and names the
   four type-only-closed chains (P2).
3. Correct the stale G6 description in AGENTS.md (P3).
4. Before trusting any future green `no-cycle` result, run the injection recipe above — per #333,
   a silent rule and a clean tree are indistinguishable from the output alone.
