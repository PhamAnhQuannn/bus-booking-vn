PR REVIEW — PR #324 "fix(payments): reconcile sweeper could not recover ANY bank transfer (Bug B)" @ 1365cc4f
─────────────────────────────
Diff scope: 16 files, +1032/-77 (net +955; net excl. migration.sql: +906), 3 commits
PR exists: yes
State: OPEN (not draft)
Base: master  Head: fix/bank-transfer-reconcile-orphan

Prior report (`pr-review-pr324-20260723.md`) reviewed commit 1 only (0435fe1). This
re-review covers all 3 commits at current HEAD (1365cc4) per the task's remit.

## What changed since the prior review

- **Commit 2** (`320b7dc`, "never auto-pay a booking from a guessed payment match") —
  found that the nullable migration didn't just add an audit row, it switched on a
  **pre-existing** (already-on-master) `matchDegraded()` auto-pay path that had been
  permanently unreachable only because `bookingId` was `NOT NULL`. Once reachable,
  matching on (exact amount + rail + ±30min) with one shared receiving account is a
  zero-credential wrong-payee payout. Removed the CAS-claim-and-pay design entirely;
  `matchDegraded` is now suspicion-only (logs + holds `awaiting_payment`, never pays,
  never claims the row, never expires it). Added a second migration
  (`20260723180000`, partial index on `PaymentEvent(receivedAt) WHERE bookingId IS NULL`,
  SQL-only, correctly kept out of `schema.prisma`). Inverted the two-bookings-one-payment
  test to assert *neither* is paid, rather than "exactly one."
- **Commit 3** (`1365cc4`, "bound the suspected-payment hold...") — found commit 2's
  unbounded hold was itself a bug: since `matchDegraded`'s inputs never change, a held
  booking is held forever, which (a) starves the sweeper via the `ORDER BY createdAt ASC
  LIMIT 200` claim query, reintroducing Bug B for everything behind the backlog, (b) is
  invisible because `rowsAffected` only counts paid+expired, and (c) permanently freezes
  a seat because `createCashBooking` counts `awaiting_payment` toward capacity with no
  time bound. Added `SUSPECTED_HOLD_MAX_AGE_MINUTES = 24h`; past that the booking expires
  via the normal branch with the log escalated warn→error.

Verified directly (not taken on trust): `lib/jobs/reconcilePayments.ts` at HEAD contains
no `paymentEvent.update`/claim call anywhere, and `matchDegraded`'s only two outcomes are
`continue` (log + hold) or fall through to expiry once `SUSPECTED_HOLD_MAX_AGE_MINUTES`
elapses — the CAS-claim-and-pay design described in the PR body is fully absent from the
shipped code.

## Findings

PRIORITY 1 — Block push, fix first:

  [ROLLBACK] The stated rollback ("revert the code, leave the column nullable — harmless,
  there is no reason to ever run the reverse") is **not correct** once this PR has been live
  for any length of time, and the linked safety report's own text proves it: the safety doc
  says nullable-with-no-orphan-rows is "behaviourally identical to the old schema," but its
  own "Post-deploy monitoring" section is written expecting orphan rows to accumulate
  immediately after deploy ("Orphan rows are new... run daily"). `master`'s pre-PR
  `reconcilePayments.ts` (verified via `git show master:...`) already contains the
  `matchDegraded()` auto-pay call — `confirming = matchDegraded(...)` with no CAS claim, no
  double-credit guard, no hold cap — it was simply unreachable because `bookingId` could
  never be `NULL`. Reverting this PR's 3 commits while leaving the migration (and any
  accumulated orphan rows — the intended, near-immediate result of shipping it) applied
  restores exactly that dead-until-now vulnerable branch to life: the wrong-payee /
  double-credit bug commit 2 was written to close. Neither the PR body's "## ⚠️ Deploy
  order" section nor `docs/migrations/20260723120000_payment_event_orphan_bookingid-safety.md`
  (written for commit 1, never revisited after commits 2–3) was updated to reflect this.
  Fix: correct the rollback recommendation in both documents — a true rollback needs the
  orphan rows triaged first (as the doc's own "Reverse migration" section already prescribes
  for the *forward-migration* path), or the revert must additionally neuter/no-op
  `matchDegraded`'s auto-pay call in the code being rolled back to. "Just revert the deploy"
  is not a safe option once orphans exist.

  [PR DESC] The PR body was written for commit 1 and never updated for commits 2–3, and the
  drift is not cosmetic — it describes the **opposite** of what shipped. "## The fix" /
  "## Two hazards found... also closed" present CAS-claim-then-pay as the live mechanism
  ("Now CAS-claimed (`UPDATE ... WHERE bookingId IS NULL`) before the match is trusted"),
  which is precisely the design commit 2 ripped out and logged as a "zero-credential attack."
  The body never mentions: `matchDegraded` is now suspicion-only and never pays; the 24h
  `SUSPECTED_HOLD_MAX_AGE_MINUTES` bound or the starvation/seat-freeze bug it fixes; the
  second migration (partial index) added in commit 2; or the items commit 2's own message
  separately logged as newly deferred (webhook rate-limit gap on the SePay endpoint, orphan
  retention/PII, backlog alerting, "stop recording unrelated deposits"). A reviewer — or a
  future on-call engineer pulling up this PR during an incident — reading only the body would
  believe the sweeper auto-pays on a CAS-claimed guess. Given the stated plan is squash-merge,
  this body (or GitHub's auto-generated squash summary, if the body isn't used) is likely to
  become the **permanent commit message on master** — fix before merge, not after.

PRIORITY 2 — Fix before merge:

  [NEGATIVE SPACE / PROCESS] No CLAUDE.md mistake-log entry for the round-3 finding
  (unbounded hold → sweeper starvation + invisible 0-count ticks + permanent seat-freeze).
  Rounds 1 and 2 of this same PR each got entries (6 new bullets total, confirmed via
  `git diff master...HEAD -- CLAUDE.md`) — round 3 is comparably severe (a self-inflicted
  reintroduction of Bug B, discovered before merge only because of a third review pass) and
  breaks the project's own "every mistake → append to CLAUDE.md immediately" rule inside the
  very PR that exercised that rule twice already.

  [NEGATIVE SPACE / MIGRATION] The second migration (`20260723180000_payment_event_orphan_
  receivedat_idx`) has no companion `docs/migrations/*-safety.md` report, unlike migration 1
  in the same PR (full GO-verdict review). Low risk standing alone (additive `CREATE INDEX`
  on an empty table, correctly SQL-only), but the omission means the PR's deploy-order
  guidance never actually accounts for two migrations shipping together, or states whether
  their relative order matters (it appears not to — the index is a pure read-path
  optimization independent of the nullability change — but that should be said, not implied).

  [DOC DRIFT] The `PaymentEvent.bookingId` doc-comment added to `prisma/schema.prisma`
  still reads "...and then CAS-claim it (sets bookingId)" — describing the commit-1
  mechanism commit 2 deleted. Unlike the PR body this text lives permanently in the schema
  file and will mislead the next reader of the model indefinitely unless corrected.

PRIORITY 3 — Address when convenient:

  [COMMIT MSG] 2 of 3 commit subjects exceed the skill's 70/72-char soft guidance (commit 1:
  76 chars; commit 3: ~79 chars, "fix(payments): bound the suspected-payment hold so it
  cannot starve the sweeper"). Cosmetic, and moot on squash-merge.

  [SIZE] Net diff grew from ~787 (commit 1, prior review) to ~955 lines across the same 16
  files (source net ~259, test net ~641, migrations excluded). Crosses the skill's line-count
  P1 threshold nominally but file count (16) stays well under the 40-file P1 bar, and the
  growth is proportionate — commits 2–3 each added source fixes with matching inverted/new
  tests, not sprawl. Consistent with the prior review's reasoning; not raised as a blocking
  finding.

SUMMARY: 2 P1, 3 P2, 2 P3

## Scope discipline verdict (the question this review was asked to settle)

Single-thread, not scope creep: all 3 commits touch only the bank-transfer reconcile
surface (`lib/jobs/reconcilePayments.ts` + its two test files, the bank_transfer webhook
route + adapter + shared `processWebhook.ts`, the two migrations, `schema.prisma`,
`CLAUDE.md`, and mechanical MoMo mock fixes from the shared transaction path). No file
outside that surface appears in any of the 3 commits. Commits 2 and 3 are not new features
bolted onto commit 1 — they are the review process finding and closing two increasingly
subtle defects *in commit 1's own design*, each one only reachable because of the fix
before it. That is the correct shape for a single PR, and the fact that it took 3 rounds to
land on a safe design is evidence the review process worked, not evidence of scope
mismanagement. **Recommend keeping this as one PR** — splitting would separate a fix from
the vulnerability it closes.

The "fix → fix the fix → fix that fix" shape is acceptable given squash-merge collapses it
to one commit on master. The cost of that shape didn't show up in the git history — it
showed up in the artifacts that weren't revised in lockstep with the code: the rollback
plan, the PR body, the migration-1 safety report, and one schema comment, all written
against commit 1 and never walked forward. That's this review's central finding, not the
number of commits.

RECOMMENDED NEXT STEPS:
  → Rewrite the PR body's "## The fix" / "## Two hazards" / "## ⚠️ Deploy order" /
    "## Deferred" sections against the actual HEAD before squash-merging — do not let a
    stale body become the permanent master commit message on a payments PR.
  → Add a short addendum (or new dated section) to
    `docs/migrations/20260723120000_..._-safety.md` correcting the rollback claim, and add
    a companion safety note for the second migration.
  → File a CLAUDE.md mistake-log entry for the round-3 starvation/seat-freeze finding to
    keep parity with rounds 1–2.
  → Fix the stale `schema.prisma` doc-comment (`bookingId`) in the same pass.
  → No blocker on commit count or file scope — 3 commits stay as one PR, squash as planned,
    once the P1s above are cleared.
