ARCHITECT REVIEW — PR #301 "feat(ledger): migrate Payout to BigInt + Neon index readiness" @ b4cd55f6
─────────────────────────────
Base: master · Head: feat/payout-bigint-neon · State: OPEN (ready)
URL: https://github.com/PhamAnhQuannn/bus-booking-vn/pull/301
Mode: PR (re-review — supersedes docs/qa/architect-review-pr301-20260716.md @ f66a1caf)

METHOD DEVIATION (declared): the skill's PR mode refuses a dirty working tree and does a
checkout/restore dance. The working tree carries ~19 untracked files (docs/qa reports,
smoke PNGs), so instead of stashing the user's work this audit ran against a detached
`git worktree` at the PR head. Same HEAD state, zero risk to the user's tree.

SNAPSHOT NOT OVERWRITTEN (declared): `docs/qa/arch-graph.json` exists from a prior
full-repo run. This audit was scoped to the PR's blast radius (lib/core, lib/config,
lib/ledger, lib/admin, lib/jobs, lib/trips + their app consumers) rather than a full
re-lex of every module. Writing a partial graph to the canonical drift-baseline path
would silently corrupt the next run's drift comparison, so the snapshot was left intact.
Re-run `/architect-review` with no arg on master for a true baseline refresh.

STATUS: HELD. Blocked on #362 + #363. Do not merge.


PRIORITY 1 — Block push, fix first:

  [LAYER BYPASS] lib/core/db/client.ts:14-27
    `const max = Number(process.env.DATABASE_POOL_MAX) || 1;` reads the raw environment
    at the single most safety-critical config site in the system, bypassing the
    Zod-validated contract at lib/config/env.ts:303:
        DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(1)

    The correct seam ALREADY EXISTS and is unobstructed. `lib/core/config/index.ts` is
    exactly two lines — `export * from '@/lib/config'` — and its own header comment
    states it "imports NO domain". `lib/config/env.ts` imports nothing but `zod`. So
    `client.ts` importing `getEnv` from `@/lib/core/config` is cycle-free, and legal
    under eslint.config.mjs `boundaries/entry-point` (target `lib-core` → `allow: "**"`).
    There is no architectural obstacle. The bypass is not a constraint; it is an omission.

    What the raw read actually drops, at the site that governs prod availability:
      · `.max(50)`  — `DATABASE_POOL_MAX=500` is accepted and handed straight to pg.Pool
      · `.int()`    — `DATABASE_POOL_MAX=2.7` yields a fractional pool max
      · `.min(1)`   — `DATABASE_POOL_MAX=-3` yields a negative pool max
                       (`0` survives only by accident of `|| 1`)

    This PR does not create the bypass, but it does something worse than leaving it
    alone: by flipping the literal from 5 to 1 it makes the two DEFAULTS agree while
    the VALIDATION stays divergent. Before this PR, `5` here versus `.default(1)` there
    was a visible, greppable contradiction that any audit would trip over. After it, the
    numbers match, the divergence looks resolved, and the remaining validation gap goes
    invisible. The PR then adds an 8-line comment explaining the magic number — codifying
    the bypass as intentional rather than removing it.
    Fix: #363. Import `getEnv().DATABASE_POOL_MAX`. Delete the literal.

  [ADR MISSING — architecturally significant decision recorded only in a code comment]
                lib/core/db/client.ts:15-21
    The comment states a load-bearing availability decision: "Default max:1 is intentional
    for Vercel's one-request-per-invocation model — Neon's pooler handles cross-invocation
    concurrency, so each warm instance needs only a single physical connection." It
    further concedes the consequence: "`Promise.all([...])` query fan-out serializes on
    that one connection (sum, not max, of latencies)."

    No ADR records this. ADR-020 (deployment) §D6 discusses Neon's pooler at the
    connection-STRING level — "Neon provides pooled + unpooled connection strings
    natively. PgBouncer is not needed. The `DATABASE_URL`/`DIRECT_URL` pattern in
    `lib/core/db/client.ts` works identically" — and says nothing about per-instance
    `pg.Pool` max sizing, which is a different layer with a different failure mode.

    Worse, the decision directly contradicts an existing ADR's domain without engaging
    it. ADR-009 (concurrency & seat holding) owns the advisory-lock strategy that
    lib/core/db/holdRepo.ts:97 implements as a BLOCKING `pg_advisory_xact_lock` inside
    `prisma.$transaction`. "One physical connection per instance" and "a blocking
    cross-request lock held inside a transaction" are jointly a self-DoS: one contended
    trip parks the only connection and the instance serves nothing. That is open issue
    #362. The two decisions live in two files, neither cites the other, and the PR that
    activates the collision references neither.

    An 8-line comment is the wrong home for a decision whose consequence is an
    availability incident. It is invisible to anyone reading the deployment ADR, and it
    cannot be superseded, dated, or reversed the way an ADR can.
    Fix: `/adr-writer` — either a new ADR (serverless connection strategy) or an amendment
    to ADR-020 with an explicit cross-reference to ADR-009 and the #362 precondition.
    Merging this PR before that ADR exists means the reasoning survives only as long as
    the comment does.


PRIORITY 2 — Fix before next release:

  [ADR DRIFT LEFT INVERTED] documentation/architecture-decisions/ADR-006-pricing-currency/
                            README.md:138-142 and :280
    ADR-006 D5 carries an explicit drift block that this PR resolves:
      > **IMPLEMENTATION STATUS** (2026-06-18)
      > - **Actual**: Payout columns ... are `Int` (32-bit, max ~2.1B VND ≈ $84K) ...
      >   `BigInt` in schema should be considered for Payout amount columns at scale.
      > - **Status**: `PARTIALLY_IMPLEMENTED`
      > - **Tracking**: ... migrate Payout columns to BigInt before any single payout
      >   batch exceeds 2.1B VND.
    plus a Risks entry at :280 — "**Payout Int overflow** ... Should be `BigInt` for
    production safety."

    This is the rare good case: the ADR predicted the work and the PR does it. But the PR
    touches no documentation. Post-merge, ADR-006 asserts the columns are `Int` when they
    are `BigInt`, and the risk register lists a resolved risk as open. A drift note that
    is wrong in the *safe* direction is a nuisance; one that is wrong in the *reassuring*
    direction — "we still need to do this" when it is done — trains readers to distrust
    every other IMPLEMENTATION STATUS block in the ADR series, including the genuinely
    open one 50 lines below it (D6 tax withholding, `NOT_IMPLEMENTED`, hard-dated to the
    1 Jul 2026 E-Commerce Law).
    Fix: flip D5 to `IMPLEMENTED`, cite this migration, strike the :280 risk entry — in
    this PR, so the doc and the schema move atomically.

  [MISSING BOUNDARY CONVENTION] lib/ledger/**, lib/admin/**, app/**
    The PR introduces a new architectural seam — where a `bigint` stops being a `bigint` —
    and lands three mutually incompatible answers with nothing declaring which is canon:
      · bigint → `string`  at the DTO boundary (getPayoutReport, getPayoutQueue,
                            getOperatorDetail, the retry route)
      · bigint → `Number`  at the same DTO layer (getRevenueReport:142-143)
      · string → `BigInt` → Intl vs string → `Number` → Intl, split across the admin
                            console (lossless) and the operator console (lossy)
    Three conventions, one commit, one domain, zero comments explaining the split. ADR-006
    D5 governs storage and computation but is silent on serialization. This is the seam a
    convention is *for*: it is crossed by every future money-bearing DTO, and the cost of
    getting it wrong is silent precision loss, not a type error.
    Fix: declare the rule (recommend: bigint end-to-end server-side, `string` over every
    JSON/RSC boundary, `BigInt()` → `Intl.NumberFormat` at render — `Intl` accepts bigint
    natively) in ADR-006 D5, then make the four sites agree. Line-level detail in the
    /code-review report.

  [SHALLOW MODULE / DEAD SEAM] lib/core/config/index.ts
    Two lines, one re-export, and — verified by grep across all of `lib/core/**` — zero
    consumers. The module exists solely to give `lib/core` a boundary-legal path to
    validated config. The one `lib/core` module that most needs validated config
    (`db/client.ts`, holding the production pool parameters) reaches around it to
    `process.env` instead. The abstraction was built and then not used by its only
    intended caller. This is the same finding as P1 viewed from the other end, and the
    two should be closed by one change.
    Fix: #363 makes `client.ts` the first consumer and retires this finding.


PRIORITY 3 — Track on roadmap:

  [CONTRADICTORY RATIONALE] lib/config/env.ts:303 vs ADR-020:149
    env.ts documents the default as "(default 1 — PgBouncer handles pooling)". ADR-020
    §D6 states "Neon provides pooled + unpooled connection strings natively. **PgBouncer
    is not needed.**" The stack does not run PgBouncer. The inline comment names the wrong
    component as the justification for the default — and after this PR that comment is
    part of the only written rationale for a production availability parameter.
    Fix: say "Neon pooler". Trivial edit, but it is load-bearing text now.

  [ADR ACCURACY] ADR-006:140 names the Payout money columns `grossVnd`, `feeVnd`,
    `netVnd`. The schema has `gross`, `platformFee`, `net`. :280 additionally names a
    `Payout.amount` column that has never existed. Pre-existing, out of the surgical
    scope of this diff — but the D5 block has to be edited anyway (P2 above), so the
    correction is free.


VERIFIED CLEAN (checked, no finding):

  [OK] No new cycle. `lib/config/env.ts` imports only `zod`; the PR adds no cross-domain
       edge. `import-x/no-cycle` is at `error` and CI lint is green.
  [OK] `boundaries/entry-point` satisfied. lib/admin → `@/lib/ledger` (barrel);
       lib/jobs → `@/lib/ledger` (barrel, lazy-imported to keep the prisma singleton out
       of unit-test module graphs — the Issue 092b discipline is preserved);
       lib/core is `allow: "**"` by rule.
  [OK] No `'use client'` barrel leak. `PayoutsClient.tsx` deep-imports
       `@/lib/op/statusLabels`, which is on the explicit client-safe allowlist in
       eslint.config.mjs. The 2026-06-04 operator-console 500 class does not recur here.
  [OK] No UI→DB layer violation. Both touched RSCs (admin operator detail, op money) read
       through `lib/` service functions; no `prisma` import reaches `app/**` or
       `components/**` in this diff.
  [OK] No payment crypto relocated, no DDL via `$executeRaw` in app code, no secret
       literal, no `process.env.<SECRET>` newly exposed to a client module.
  [OK] Coupling spread is appropriate, not leaky. The diff touches 6 domains
       (ledger, admin, jobs, trips-adjacent, core, app) but every edit is the forced
       consequence of one column-type change propagating along existing edges — the
       signature of a type migration, not of an eroding seam. `lib/ledger` remains the
       single owner of payout money computation; no consumer reimplements fee math.
  [OK] `lib/ledger/index.ts` exports 19 symbols over a substantial implementation — under
       the 20-symbol shallow-barrel threshold and backed by real depth.


SUMMARY: 2 P1, 3 P2, 2 P3
Graph snapshot NOT updated (see METHOD DEVIATION) — docs/qa/arch-graph.json left intact.

RECOMMENDED NEXT STEPS:
  → Both P1s are closed by work already scoped: #363 closes the layer bypass and the dead
    seam together; `/adr-writer` closes the missing-ADR finding.
  → The ADR-006 D5 edit belongs IN this PR — it is the commit that makes the doc true.
  → Merge order stands: #362 → #363 → #301.
