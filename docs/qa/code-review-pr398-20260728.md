CODE REVIEW — PR #398 "docs(claude): log the review round; fix pickup comment drift (#366)" @ 41bc8a07
────────────────────────────────
Diff scope: 3 files, +22 / -4 lines
Base: `master` · Head: `docs/post-merge-mistake-log-and-pickup-comment-drift` · Pinned SHA: `41bc8a070139796e14b21345bf5b714051221d51`
State: OPEN, not draft, 12/12 CI checks green.

Zero runtime change. Review lens is therefore **truth of the asserted claims**, not code correctness —
per CLAUDE.md 2026-07-28 ("an invariant comment asserted something its own parenthetical contradicted —
and squash-merge ships that as permanent justification"), a false comment is worse than no comment,
because the next reader treats it as already verified.

## Claim verification (the three the PR stakes itself on)

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 1 | `pickupAreaLabel` "no longer exists anywhere" | **FALSE** | 5 live-tree hits, incl. `lib/geo/data/PROVENANCE.md:27` |
| 2 | `createOperatorPickupArea` no longer exists | **TRUE (code)** | zero `.ts`/`.tsx` definitions or callers; only stale docs |
| 3 | `customPickupRequested` exists and is returned | **TRUE** | `lib/booking/getManifest.ts:30` (type), `:87` (select), `:100` (map) |

Also verified from the PR body: `OperatorPickupArea` is absent from `prisma/schema.prisma` entirely — **TRUE**
(zero matches). No orphaned FK. That half of #366 is genuinely closed.

---

PRIORITY 1 — Block merge, fix first:

  [CORRECTNESS / FALSE ASSERTION — CLAUDE.md Mistake Log pattern match] lib/booking/getManifest.ts:9
    The new comment asserts `pickupAreaLabel` "no longer exists **anywhere**". It does. The
    falsifier is one directory away from the other file this same PR edits:

      lib/geo/data/PROVENANCE.md:27
        "Booking rows snapshot the resolved label (`pickupAreaLabel`) so a future swap does
         not orphan historical pickups."

    `lib/geo/vnAdmin.ts` — fixed by this PR — reads `lib/geo/data/vn-admin-tree.json`.
    `PROVENANCE.md` is that dataset's own provenance doc, in the same directory. The PR opened
    `lib/geo/`, corrected one file, and left the sibling asserting the removed field.

    Further live-tree survivors (not build artifacts, not migrations):
      - documentation/design-specifications/DS-001-data-model/README.md:380,407 — lists
        `pickupAreaLabel` as a live Hold/Booking column ("Denormalized snapshot")
      - documentation/design-specifications/DS-003-api-contract/README.md:506 — in a response body
      - documentation/feature-implementation/FI-007-booking-flow/README.md:47,48
      - documentation/feature-implementation/FI-013-customer-account/README.md:57
      - docs/current-status/08-lib-booking.md:357 — documents **`ManifestRow` itself** as containing
        `pickupAreaLabel`. This is the exact return shape the PR says "a reader would have trusted."

    `documentation/` is declared authoritative for scope/feature work in AGENTS.md, so these are
    live spec, not archive. (`docs/current-status/*` is a dated 2026-06-21 snapshot predating the
    2026-06-22 removal migration — weaker, but 08-lib-booking.md:357 is squarely on point.)
    Legitimate survivors correctly left alone: `prisma/migrations/**` (never edited), `coverage/**`.

    Two independent defects, one root:
      (a) The absolute quantifier is untrue as written — the precise, defensible claim is
          "no longer exists in the schema or in any TypeScript source."
      (b) Issue #366 asks to "Confirm no orphaned FK/select references **or dead code** survived
          the removal." The PR body says this "closes out #366's actual question." It does not:
          a dangling reference survives inside `lib/`.

    This is a verbatim instance of the pattern this PR's own CLAUDE.md entry logs — an assertion
    whose falsifier the author was already holding. Per the skill's severity table, a Mistake-Log
    pattern match in the diff is auto-P1.

    Fix: either delete `lib/geo/data/PROVENANCE.md:27`'s clause and narrow the getManifest claim to
    "no longer exists in the schema or in any TypeScript source", or drop the absolute quantifier
    entirely. Do not ship the sentence as written — squash-merge makes it the permanent commit
    message, and the next reader will treat "anywhere" as verified.

---

PRIORITY 2 — Fix before merge:

  [CORRECTNESS / STALE SAFETY GUARANTEE] lib/geo/data/PROVENANCE.md:27
    Beyond naming a dead symbol, this line asserts a **safety property that is now false**, and
    that property is the stated justification for the dataset-swap procedure directly above it:

      "To swap datasets, replace this file with the same {provinces, districts, wards} shape and
       keep lib/geo/vnAdmin.ts unchanged. Booking rows snapshot the resolved label
       (`pickupAreaLabel`) so a future swap does not orphan historical pickups."

    `Hold.pickupAreaLabel` and `Booking.pickupAreaLabel` were both dropped by
    `prisma/migrations/20260622100000_remove_pickup_area_system/migration.sql:83,85`. No geo label
    is snapshotted onto a booking row anymore. A maintainer performing the Vietnam 2025 2-tier
    reform swap would rely on an orphan-protection that no longer exists.

    Ranked below the P1 only because nothing reads it today. It is the more *dangerous* of the two
    lines — the getManifest comment misdescribes a return shape a reader can check in 12 lines;
    this one authorises a migration on a guarantee that evaporated.

    Fix: delete the final sentence, or replace with "Pickup rows no longer snapshot a resolved geo
    label (issue 104); re-derive orphan risk before swapping."

  [TRACEABILITY / WRONG PR CITED] CLAUDE.md:141, :146, :148 (three new entries)
    Three entries attribute shipped behaviour to **#382**:
      - :141 "#382 converted the trip advisory lock to `pg_try_advisory_xact_lock`"
      - :146 "#382 added `CLAIM_LIMIT = 200` plus `ORDER BY scheduledAt ASC` to processPayouts"
      - :148 "#382 was based on #381's branch"

    `gh pr view 382` → **CLOSED**, "fix(holds): bound the trip lock so a contended trip cannot pin
    the pool". Never merged. The PR that actually carries this work into `master` is **#397**
    (`e66d19d`, "fix(holds,payouts): bound all three hold locks; Payout BigInt + Neon pool
    readiness"). Entry :148 narrates the closure and the "fresh PR from the same head branch" —
    but never names #397, so the log documents the recovery without recording the recovered
    identifier. A future session chasing #382 lands on a closed PR with a partial diff and no
    forward pointer.

    Ranked P2 rather than P3 because CLAUDE.md is loaded into every session's context as
    instruction. Note the code cites *issue* numbers for the same changes (`holdRepo.ts:16` → #362,
    `processPayouts.ts:45` → #364), so `#N` is already overloaded between issues and PRs here;
    the log should say which it means.

    Fix: append "(merged as #397)" to entries :141 and :146, and name #397 in :148.

  [COMMENT DRIFT / SAME CLASS, LEFT UNFIXED] lib/core/db/holdRepo.ts:5, :10
    Out of diff, but in scope by the PR's own framing: this is the file three of the new
    mistake-log entries are about, and the PR's stated job is eliminating comments that name
    behaviour the code no longer has.

      :5   "0. Acquires pg_advisory_xact_lock(hashtext('hold-session:' || sessionId))"
      :10  "1. Acquires pg_advisory_xact_lock(hashtext('hold-phone:' || customerPhone))"
      :137 `SELECT pg_try_advisory_xact_lock(hashtext('hold-session:' || ${sessionId}))`
      :160 `SELECT pg_try_advisory_xact_lock(hashtext('hold-phone:' || ${customerPhone}))`

    Both were converted to TRY-locks; the numbered steps still name the blocking function. Line 19
    of the *same docblock* then says "Locks 0 and 1 are try-locks too" — so the docblock contradicts
    itself internally, which is precisely the shape CLAUDE.md:139 was written to condemn
    ("if the sentence needs a parenthetical to qualify the claim, the claim is probably the wrong
    shape"). The distinction is load-bearing: blocking-vs-try on those two keys is the whole
    `DATABASE_POOL_MAX=1` exhaustion argument in entry :141.

    Fix: s/pg_advisory_xact_lock/pg_TRY_advisory_xact_lock/ on :5 and :10, matching :15's casing
    convention, and delete the now-redundant clarification on :19.

---

PRIORITY 3 — Address when convenient:

  [READABILITY / PARTIAL LIST REGRESSION] lib/booking/getManifest.ts:4-6
    **Position: the list should be deleted, not repaired.** A partial-and-deferring list is worse
    than either alternative.

    `ManifestRow` (`:20-42`) declares 15 fields. The new list names 10 and omits `bookingId`,
    `bookingRef`, `checkedInAt`, `noShowAt`, and `manualFlag`. `manualFlag` was **in the old list**
    and was silently dropped by this edit — so the fix improved accuracy on one axis while
    regressing coverage on another, in a 3-line comment, in a PR whose entire purpose is comment
    accuracy. That is the drift mechanism demonstrating itself inside its own remediation.

    The trailing "— see ManifestRow below for the authoritative shape" concedes the type is the
    source of truth while keeping a hand-maintained copy 12 lines above it. Nothing gates the two
    against each other: no test, no lint rule, no type. The copy has now drifted twice.

    Fix: replace :4-6 with a single line — `* Row shape: see \`ManifestRow\` below.` Zero drift
    surface, same information, and the reader's eye travels 12 lines instead of parsing a list that
    is wrong by omission. If a summary is genuinely wanted, name only the *invariants* a caller
    cannot read off the type (AC6's seatNumber exclusion, already on :11).

  [READABILITY / CHANGELOG IN PERMANENT DOCBLOCK] lib/booking/getManifest.ts:8-10, lib/geo/vnAdmin.ts:12-13
    **Position: both `(#366: ...)` parentheticals should be deleted; keep only the corrected text.**

    They describe what the comment *used to say*. That belongs in three places that already have
    it — the diff, the PR body (which states it at length), and the squash-merge commit message.
    In source it is permanent overhead paid by every future reader for information with zero
    bearing on calling the function. The same squash-merge-permanence argument the PR invokes to
    justify writing them argues against it: git history is where the before/after already lives
    losslessly, and `#366` is a closed issue whose context decays.

    `lib/geo/vnAdmin.ts` is the worse of the two. That docblock's job is a single load-bearing
    safety instruction — *do not import this from `'use client'`, it drags a ~690 KB dataset into
    the browser bundle*. Appending two lines about a function that no longer exists dilutes the
    warning with archaeology. The corrected sentence on :11 ("Server components, route handlers,
    and server-side validation use it directly") is complete on its own; the note beneath it adds
    nothing a reader can act on.

    Fix: delete `getManifest.ts:8-10` and `vnAdmin.ts:12-13`. The corrected text is the fix.

  [HYGIENE / FORMATTING] lib/booking/getManifest.ts:10-11
    The `(#366: ...)` block is wedged between the "Returns rows:" paragraph and `AC6: NO seatNumber
    field in output.` with no blank line before AC6, so an unrelated AC statement now reads as a
    continuation of the parenthetical. Resolved for free by the deletion above.

---

## Mistake-log spot-checks (5 of 12 entries verified against source)

Sampled the entries making the most specific, most falsifiable claims about current `master`.
**All five check out** — no false claim about current source found, so no P1 on this axis.

| Entry | Claim | Verified |
|-------|-------|----------|
| :140 fail-open | `failClosed?: boolean` per limiter, one shared `onStoreFailure()` in **both** remote backends | `lib/ratelimit/index.ts:45` (option), `:109` + `:210` (two backends), `:354` (`failClosed: true`) — exact |
| :141 lock bounding | all three hold locks are try-locks | `lib/core/db/holdRepo.ts:137,160,210` — all three `pg_try_advisory_xact_lock` |
| :143 retry budget | "Raised to 6" | `lib/core/db/holdErrors.ts:103` — `TRIP_LOCK_ATTEMPTS = 6` |
| :146 payout LIMIT | `CLAIM_LIMIT = 200`, `ORDER BY scheduledAt ASC`, `EXISTS` on verified `PayoutAccount`, blocked backlog counted separately | `lib/jobs/processPayouts.ts:68,86,82,92-103` — all four present |
| :145 e2e visibility | assertion switched to `:visible`; a third match lives in the **footer** | `e2e/site-header.spec.ts:49` (`:visible`), `:87` (`getByRole('contentinfo')`), `:39` (drawer note) |

Also confirmed `RequestInFlightError` is carried end-to-end as :142 claims: `lib/core/db/holdErrors.ts`
→ `holdRepo.ts` → `app/api/holds/route.ts`, with `SeatMapBusyError`'s Vietnamese copy still scoped to
trip contention at `app/(customer)/booking/customer/CustomerForm.tsx:382`.

Only the PR-number attribution (P2 above) is wrong; every behavioural claim sampled is accurate and
specific enough to be re-checked. The three restored 2026-07-27 tourism-KB entries are outside this
repo's runtime and were not verifiable from source — accepted as narrative.

---

SUMMARY: 1 P1, 3 P2, 3 P3

VERDICT: **needs change** — one-line fix.

The P1 is a single false quantifier with a one-directory-away falsifier that the PR opened the
enclosing directory to fix. Everything else is sound: the two comment corrections are real
improvements, the schema/FK half of #366 is genuinely verified, and every mistake-log claim sampled
against code holds. Minimum to merge: narrow "no longer exists anywhere" to "no longer exists in the
schema or in any TypeScript source", and delete the stale clause at `lib/geo/data/PROVENANCE.md:27`
(P2 #1) — which converts the P1 into a true statement and actually closes #366. Both are one-liners.

RECOMMENDED NEXT STEPS:
  → Fix P1 + P2 (PROVENANCE.md) together — they are the same defect from two sides, ~2 lines total.
  → Add "(merged as #397)" to CLAUDE.md:141 and :146 while the file is open. Cheap; CLAUDE.md is
    instruction context for every future session and a dangling #382 misdirects it.
  → P2 (holdRepo.ts docblock) is out of this diff. Fold in here if the branch is already open —
    same defect class, same file the log entries describe — otherwise file it.
  → P3s are judgement calls, argued above; taking them shrinks the diff rather than growing it.
  → Consider a follow-up sweeping the 6 stale `documentation/` + `docs/current-status/` references,
    especially `docs/current-status/08-lib-booking.md:357`, which misdescribes `ManifestRow` —
    the same return shape this PR corrected in the source docblock.
