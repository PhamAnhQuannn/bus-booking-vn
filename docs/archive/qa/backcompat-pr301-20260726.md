BACKCOMPAT REVIEW — PR #301 "feat(ledger): migrate Payout to BigInt + Neon index readiness"
───────────────────────────────────────
PR:        https://github.com/PhamAnhQuannn/bus-booking-vn/pull/301
Base/Head: master ← feat/payout-bigint-neon @ b4cd55f6
Decision:  (none)
Size:      +677 / -79 across 33 files
Project license: none declared — `package.json` is `"private": true`, single Next.js app,
                 no published package, no external consumers.
Generated: 2026-07-26
Note:      Re-review. Supersedes docs/qa/backcompat-review-pr301-20260716.md @ f66a1caf,
           which predates commit 8618573 (the retry-route serialization change).

Findings: 5  (P1: 2 · P2: 2 · P3: 1)


P1 — BLOCKING:

  app/api/op/reports/payouts/[id]/retry/route.ts:36-45  💥 P1: Six response fields change
  wire type from JSON number to JSON string. Silent break — no parse error, no type error.

    Before (master):
      { payout: { ..., gross: 1500000, platformFee: 90000, net: 1410000,
                       taxVat: 0, taxPit: 0, taxTotal: 0 } }
    After:
      { payout: { ..., gross: "1500000", platformFee: "90000", net: "1410000",
                       taxVat: "0", taxPit: "0", taxTotal: "0" } }

    This is the most dangerous shape of API break, worse in practice than a removed field.
    A removed field yields `undefined` and fails loudly at the first use. A number→string
    swap parses cleanly and then corrupts arithmetic silently:
        payout.net + fee        → "1410000" + 5000 = "14100005000"   (string concat)
        payout.net.toFixed(0)   → TypeError
        payout.net > threshold  → lexicographic comparison, wrong for any differing digit count
        sum += payout.net       → accumulator becomes a string on the first add

    The change itself is *necessary* — `BigInt` is not JSON-serializable, so without it
    `NextResponse.json` throws `TypeError: Do not know how to serialize a BigInt` and the
    endpoint 500s outright. Commit 8618573 is a correct fix for a real bug the migration
    introduced. The finding is that a wire-contract change shipped with:
      · no version bump and no `/v2` path,
      · no note in the PR body (the body predates the commit entirely),
      · no contract test asserting the new shape.

    Blast radius is genuinely small and worth stating plainly: the only in-repo consumer is
    `PayoutsClient.tsx` `handleRetry`, which does `await retryPayoutApi(payoutId)` and
    discards the body before calling `router.refresh()`. Zero fields consumed. The endpoint
    is operator-authenticated, not public, and no external integration is documented.
    So this will not break anything today.

    It is P1 anyway because the *class* is untracked: nothing in this repo records that
    payout money crosses the wire as a string. The next consumer — an operator mobile app,
    a CSV export, a partner integration — will be written against a field named `net` and
    will assume it is a number, exactly as every other money field in every other endpoint
    in this codebase still is.
    Fix: either narrow the response to `{ payout: { id, status } }` (matches what the sole
    consumer actually uses), or document the string convention in ADR-006 D5 and add a
    response-shape assertion in `test/helpers/responseShape.ts`.

  prisma/migrations/20260725120000_neon_readiness/migration.sql:2-7  💥 P1: The Int→BigInt
  widening is forward-safe and backward-hostile, and the PR documents no version-skew or
  rollback story for either direction.

    The widening itself is correct and non-breaking in the forward direction — every stored
    int4 value fits int8, no data loss, no default lost (Postgres carries `DEFAULT 0`
    through `ALTER COLUMN ... SET DATA TYPE`). That is not the problem.

    The problem is the two windows where old code meets the new schema:

    (a) **Deploy skew.** Vercel runs `prisma migrate deploy` and then cuts over. For the
        interval between them — plus any in-flight request and any cron invocation on the
        prior deployment — master's code (which declares `gross Int`, `net Int`, … in
        `schema.prisma`) is reading BIGINT columns through `@prisma/adapter-pg`. node-postgres
        does not register an int8 parser by default; int8 arrives as a JS **string**, and
        Prisma's `Int` field expects a number. The result is a deserialization failure or a
        coerced value on the **payout** path. The affected surface is exactly the money
        surface: `processPayouts`, `retryPayout`, `getPayoutReport`, `getOperatorDetail`.

    (b) **Rollback.** Reverting the migration means
        `ALTER COLUMN ... SET DATA TYPE INTEGER`, which **fails outright** the moment any
        stored value exceeds 2^31−1 — which is the entire stated purpose of the change.
        Reverting only the *code* and leaving the columns BIGINT lands you in case (a)
        permanently.

    CLAUDE.md's 2026-07-24 rule is explicit about this framing: *"For any migration, state
    the rollback in terms of what the OTHER-version code does against the migrated schema,
    not just the schema shape."* The 2026-07-16 pr-review got it exactly backwards —
    "Int→BigInt is backward-compatible (BigInt stores all Int values) ... Standard rollback:
    forward migration to revert" — reasoning about the schema shape alone and concluding
    the category was clean. That is the same error the mistake log was written to prevent,
    made two days before the log entry that names it.
    Fix: write `docs/migrations/20260725120000_neon_readiness-safety.md` stating all three
    cases (code-only revert, migration-only revert, both) explicitly. Detailed treatment in
    the /migration-safety report.


P2 — SHOULD FIX:

  lib/ledger/index.ts:98,104,105 · lib/admin/index.ts:21  ⚠️  P2: Five barrel-exported
  types change shape. Mechanically these are P1 by this skill's rule ("P1 if the symbol is
  re-exported from a package barrel"); calibrated to P2 because the barrels are internal.

        lib/ledger/index.ts:105  CalcPayoutResult.{gross,platformFee,net}   number → bigint
        lib/ledger/index.ts:104  SettlePayoutInput.net                      number → bigint
        lib/ledger/index.ts:98   PayoutReportRow.{gross,platformFee,net}    number → string
        lib/admin/index.ts:21    PayoutQueueRow.net                         number → string
        lib/admin/getOperatorDetail.ts:31  OperatorPayoutHistoryItem.net    number → string
                                 (deep-import only — not re-exported from lib/admin/index.ts)

    Calibration rationale: `package.json` is `"private": true` with no published artifact,
    so "consumer" means "another file in this repo", and every such consumer is under
    `tsc --noEmit`, which is green in CI. No external integration can break. Reporting these
    as merge-blocking P1 would be mechanical rule-application over judgement.

  app/admin/(console)/finance/page.tsx:45 · app/admin/(console)/operators/[id]/page.tsx:31 ·
  app/op/(console)/money/page.tsx:52 · app/op/(console)/reports/payouts/PayoutsClient.tsx:38
  ⚠️  P2: The `number → string` DTO breaks above are NOT fully caught by the type checker,
  because the consuming formatters were widened to accept `string` in the same commit.

    This is the finding that makes "CI is green" insufficient evidence here. The pattern:

        - function formatVnd(amount: bigint | number): string
        + function formatVnd(amount: bigint | number | string): string

        - function fmtVndNum(v: number): string
        + function fmtVndNum(v: string): string

        - function formatVnd(amount: number): string
        + function formatVnd(amount: string): string

    Once a formatter accepts `string`, any caller handing it a stringified bigint compiles
    silently — and so does any caller handing it an *unstringified* number, a numeric string
    from a URL param, or a non-integer string. `formatVnd`'s `BigInt(amount)` branch throws
    `SyntaxError: Cannot convert ... to a BigInt` on any non-integer string input, uncaught,
    inside an RSC render — a 500, not a formatting glitch.

    So tsc is not the safety net it appears to be for this half of the migration. The
    `number → bigint` changes ARE genuinely tsc-enforced (bigint and number do not mix under
    arithmetic or assignment without an explicit conversion, which is why the type checker
    caught every consumer). The `number → string` changes are enforced only until someone
    widens a signature — and this PR widens three.
    Fix: keep the formatter parameters narrow (`bigint` for the admin pair, `string` for the
    operator pair) rather than unions, so a wrong-typed caller is a compile error again.


P3 — ADVISORY:

  lib/ledger/getRevenueReport.ts:142-143  ℹ️  P3: `RevenueRow.platformFeeVnd` and
  `netPayoutVnd` keep their `number` type while every sibling money DTO in the same commit
  switches to `string`.

    Purely as a back-compat matter this is the *only* payout-derived DTO in the PR that
    does NOT break its contract — the `Number()` casts at :142-143 exist precisely to
    preserve it. Worth recording because it inverts the usual reading: the site flagged
    P1 for correctness in the /code-review report (Number-domain accumulation reopening
    the Issue 016 precision hole) is simultaneously the site with the cleanest back-compat
    story. Whichever way it is resolved, one of those two properties gets traded for the
    other, and it should be a decision rather than an oversight.
    Fix: pick the convention deliberately (see the /architect-review P2 on the missing
    money-serialization boundary rule), then apply it to all four DTOs at once.


CLEAN (scanned, no finding):

  Cat 1 — API shape. No response field REMOVED or RENAMED anywhere in the diff. No status
    code changed (the retry route's `switch (result.error)` mapping is untouched). No route
    file deleted or renamed. No request param type narrowed — the retry route's input
    contract (`payoutId` from the URL) is unchanged.
  Cat 2 — Schema. No column dropped. No column renamed. No type NARROWED — all six changes
    widen. No new NOT NULL column, with or without default, so the Issue 012/013 fixture
    grep rule does not apply. No enum value removed (`PayoutStatus` untouched). Index
    changes affect query planning only, never row shape: `Trip_busId_idx` and
    `LedgerEntry_operatorId_createdAt_idx` are pure additions;
    `Hold_expiresAt_idx → Hold_status_expiresAt_idx` was audited against every
    `Hold.expiresAt` consumer (none query it without also constraining `status`);
    `Operator_id_idx` duplicated the primary key.
  Cat 4 — New dep license. **No dependency changes.** `package.json` is not in the diff.
    No license question to answer.
  Cat 5 — Typosquat + lifecycle scripts. N/A — zero new packages.
  Cat 6 — Lockfile drift. N/A — neither `package.json` nor `pnpm-lock.yaml` is touched.
    No drift possible.


RECOMMENDED NEXT:
  - The migration-skew P1 is the one that matters. Write the safety doc before merge; it is
    the artifact that would have caught the inverted rollback claim in the 2026-07-16 review.
  - Narrow the four formatter signatures back down. That single change restores tsc as a
    real gate over the `number → string` half of this migration.
  - The retry-route P1 is cheap to close: return `{ payout: { id, status } }` and the wire
    contract carries no money at all.

SUMMARY: 2 P1 · 2 P2 · 1 P3 · pinned to b4cd55f6
