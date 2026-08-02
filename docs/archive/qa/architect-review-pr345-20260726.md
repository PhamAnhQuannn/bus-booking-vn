ARCHITECT REVIEW — PR #345 "fix(lint): make import-x/no-cycle gate actually detect cycles (#333)" @ d6603e5b
─────────────────────────────
Base: `master` · Head: `fix/333-no-cycle-resolver` · State: open (ready, not draft)
URL: https://github.com/PhamAnhQuannn/bus-booking-vn/pull/345
Scanned: 671 source files, 1,521 `@/` import edges, 41 modules
Mode: PR (standalone — no auto-comment, no PR mutation)

Pre-flight note: the skill refuses PR mode on a dirty tree. `git status --porcelain` was non-empty but
contained **only untracked `docs/qa/*.md` review artifacts — zero tracked modifications** — so the
checkout was non-destructive and no stash was needed. Branch restored to `master` on exit; temp
branch retained as `pr-345-review` (delete with `git branch -D pr-345-review`).

---

## This PR's effect on the architecture: none (by design)

The diff touches `eslint.config.mjs` and `CLAUDE.md` only. **Zero source files change, so the
dependency graph at this PR's HEAD is byte-identical to `master`.** This PR adds no edge, removes
no edge, and creates no cycle. What it changes is *observability* of the graph — which is precisely
why it warrants an architectural review rather than a code-only one.

## Independent corroboration that the gate is correct and complete

The central risk with #333 is a fix that trades "reports nothing" for "reports something plausible."
To test that, the domain graph was rebuilt from scratch here (independent lexer, Tarjan SCC) and
compared against what the fixed ESLint gate reports.

| Method | Strongly-connected component |
|---|---|
| `import-x/no-cycle` @ PR #345 (11 findings) | files in **booking, payment, ledger** |
| Independent graph, **value edges only** | **`booking ↔ ledger ↔ payment`** — 3 domains |
| Independent graph, **including `import type`** | `account, auth, booking, jobs, ledger, notification, payment, trips` — 8 domains |
| Prior snapshot `arch-graph.json` (PR #324, 2026-07-23) | same 8 domains (type-inclusive) |

Two independently-implemented methods agree exactly on the value-edge cycle set. That is strong
evidence the gate is **neither vacuous nor over-reporting** — it is measuring the right thing, at the
right granularity, and `no-cycle`'s documented behaviour of ignoring type-only edges fully explains
the 8-vs-3 gap against the older snapshot. The 11 findings are real and the count is complete.

The precise value edges forming the SCC (all verified by direct grep):

    lib/payment/adapters/bankTransfer.ts:24   → @/lib/booking  { BOOKING_REF_REGEX }
    lib/payment/applyPaidTransition.ts:28     → @/lib/booking  { legalPredecessors }
    lib/payment/processWebhook.ts:53          → @/lib/booking  { legalPredecessors }
    lib/booking/createCashBooking.ts:19       → @/lib/payment  { appendBookingPaidLedger }
    lib/booking/initiateOnlineBooking.ts:30   → @/lib/payment  { getGatewayFor }
    lib/ledger/refund.ts:46                   → @/lib/payment  { refundPayment }

---

PRIORITY 1 — Block push, fix first:

  [CYCLE] booking ↔ payment ↔ ledger (3-domain SCC)
    SCC members: lib/booking, lib/payment, lib/ledger
    Representative path:
      lib/booking/createCashBooking.ts → @/lib/payment (index.ts:10)
        → lib/payment/applyPaidTransition.ts → @/lib/booking (index.ts:16)
        → lib/booking/createCashBooking.ts
    Per this skill's Category 1, any non-trivial SCC is P1.

    **This is pre-existing and is NOT introduced by PR #345 — it is not a reason to block this PR.**
    It is reported at P1 because architect-review is repo-wide, and because until #345 merges the
    repo had no automated way to see it at all. Tracked by #343.

    Highest-leverage fix for #343 — the payment→booking edge is carried by exactly two symbols, and
    both are **pure, dependency-free kernel values**:
      · `BOOKING_REF_REGEX`   — a format constant
      · `legalPredecessors`   — the booking status state machine (used at 2 sites)
    Neither needs the booking domain's service graph. Relocating both into `lib/core` (already exempt
    from the barrel rule, importable by every domain) **deletes the payment→booking edge outright**,
    which drops `booking` out of the SCC entirely and reduces the remaining cycle to `payment ↔ ledger`
    (`appendBookingPaidLedger` / `refundPayment`). That is a two-symbol move, not a barrel refactor —
    substantially cheaper than the framing in #343 implies, and it should be sequenced first.

PRIORITY 2 — Fix before next release:

  [SHALLOW MODULE / CYCLE AMPLIFIER] Three domain barrels exceed the 20-export threshold:
      lib/booking/index.ts   23 export statements,  8 implementation lines
      lib/auth/index.ts      23 export statements, 36 implementation lines
      lib/admin/index.ts     21 export statements,  8 implementation lines

    Mechanically these are "re-export piles." They are NOT a defect on their own — ADR-016 mandates
    barrel-only cross-domain entry, so the barrel *is* the intended design and "delete the barrel" would
    contradict the ADR. The architectural point is narrower and matters for #343: **barrel width is the
    mechanism that converts a domain-level dependency into a file-level cycle.** Importing one symbol
    from a 23-export barrel makes the importer transitively depend on all 23 export sites' graphs, so
    any bidirectional domain pair becomes an automatic file cycle.

    The risk this creates for #343: the obvious way to make `no-cycle` go quiet is to add deep-import
    exceptions to the `boundaries/entry-point` allowlist. That would be the wrong fix twice over — it
    silences `no-cycle` while leaving the bidirectional coupling fully intact, and it dilutes the
    allowlist, which currently exists for a *client-safety* purpose (the 2026-06-04 operator-portal
    outage). Each non-client-safety entry added to that list weakens the invariant that caused that
    incident.
    Fix direction: split kernel constants into a narrow, dependency-free entry (`lib/core`, per the P1)
    rather than widening the allowlist. #343 should state this explicitly so the burn-down is not
    "fixed" by exception.

  [ADR GOVERNANCE] ADR-016 is the governing decision record for this rule and is now factually stale.
      documentation/architecture-decisions/ADR-016-module-boundaries/README.md:113
        "**Cycle-free** — `import/no-cycle` prevents the mutual-import coupling that makes domains
        inseparable" — disproved by this PR: 11 cycles across 3 domains.
      documentation/architecture-decisions/ADR-016-module-boundaries/README.md:98
        lists `import/no-cycle` as an active constraint over "All source files".
    Demoting the rule error→warn is a change in *enforcement posture* for an ADR-recorded decision, and
    ADR-016 records neither the temporary posture nor the discovered cycle set.
    Fix: amend ADR-016 with a short status note (cycles detected but not blocked; #343 restores `error`).
    Overlaps the spec-drift finding in `pr-review-pr345` — that report covers SI-001/SI-003/SI-004/HD-004;
    this entry is specifically about the ADR as decision record. Count once when consolidating.

PRIORITY 3 — Track on roadmap:

  [GRAPH METHODOLOGY] `docs/qa/arch-graph.json` conflated type-only and value edges.
    The prior snapshot (PR #324) recorded a single 8-domain SCC with no indication that it included
    `import type` edges. Compared naively against this PR's gate output (3 domains), that reads as a
    contradiction and invites the conclusion that one of the two is broken — exactly the wrong
    inference, and a live risk while #343 is open and people are counting cycles.
    Fixed in this run: the snapshot now records `sccs_value` and `sccs_including_type` separately, plus
    a `method` block stating that `no-cycle` counts value edges only.

  [LAYERING] Three high-fan-in modules sit outside the `boundaries/elements` taxonomy.
      lib/logger.ts (5.4% fan-in) · lib/utils.ts (7.7%) · lib/withErrorHandler.ts (15.9%, 107 files)
    `boundaries/elements` classifies `lib/*` with `mode: "folder"`, so bare `.ts` files directly under
    `lib/` match no element and are unclassified in both directions — the barrel rule constrains neither
    imports of them nor imports made by them. `lib/withErrorHandler.ts` in particular is the 3rd
    most-imported module in the repo and is architecturally unconstrained.
    Note this does **not** weaken PR #345's fix: `no-cycle` walks the resolved import graph and ignores
    `boundaries` classification entirely, so cycles through these files are still detected.
    Also note the naming ambiguity: CLAUDE.md exempts "`lib/utils/`" while the actual artifact is the file
    `lib/utils.ts`, and `"utils"` simultaneously appears in `LIB_DOMAINS`.

  [GOD MODULE] None — clean. Highest fan-in is `lib/core/db/client` at 27.7% of source files, then
    `lib/auth` 19.2% and `lib/withErrorHandler` 15.9%. All well under the 70% threshold. No layer
    violations found: no `components/**` file imports `lib/core/db` or Prisma directly, and no payment
    signature verification appears outside the webhook routes.

SUMMARY: 1 P1, 2 P2, 3 P3  (the GOD MODULE entry above is a clean bill of health, not a finding)
Graph snapshot updated → docs/qa/arch-graph.json (now records value vs type-inclusive SCCs separately)

RECOMMENDED NEXT STEPS:
  → The P1 SCC is pre-existing and does not block PR #345. PR #345 is architecturally sound and is the
    prerequisite for ever fixing it — merging it strictly increases what the repo can see.
  → Feed the two-symbol extraction path (BOOKING_REF_REGEX + legalPredecessors → lib/core) into #343;
    it removes booking from the SCC without a barrel refactor.
  → Add the "do not fix by widening the entry-point allowlist" constraint to #343 before work starts.
  → /adr-writer or a direct amendment on ADR-016 to record the interim enforcement posture.
