ARCHITECT REVIEW — PR #357 "fix(payments): reconcile sweeper recovers VNPay transfers (#330)" @ bce2a60b
─────────────────────────────
Base: master · Head: fix/vnpay-recover-330 · State: OPEN (ready)
URL: https://github.com/PhamAnhQuannn/bus-booking-vn/pull/357
Scanned: 671 source files (tests excluded, matching the prior snapshot's methodology), 41 modules, 153 module edges, 1987 file edges, 58 commits in the 30d window
Prior snapshot: docs/qa/arch-graph.json @ 2026-07-23 (PR #324, 669 files / 41 modules / 154 edges)
Pre-flight note: working tree had 0 tracked modifications (only untracked `docs/qa/*` reports from this review session, which survive checkout). Temp branch `_architect-review-pr357` used and removed; prior branch restored.

## Graph verdict (the questions this PR was flagged for) — ALL CLEAN

- **New module edges: ZERO.** Edge-set diff vs the prior snapshot: `0` added, `1` removed (`lib/jobs → lib/ticketing`, from unrelated master commits since 2026-07-23 — an improvement, not this PR).
  `lib/payment/index.ts` already re-exported `./adapters/vnpay` (for `getVnpayAdapter`), so adding `recoverVnpayEvent` to the same statement introduces no edge. `lib/jobs/reconcilePayments.ts` already imported `@/lib/payment`. Outside the (boundary-exempt) test files, the diff adds no import statement at all.
- **New cycle: NONE.** SCC set is byte-identical to the baseline — one 8-module component
  `{lib/account, lib/auth, lib/booking, lib/jobs, lib/ledger, lib/notification, lib/payment, lib/trips}`
  — the pre-existing cross-domain barrel cycle tracked by issue #343. This PR neither joins nor widens it.
- **`import-x/no-cycle` / `boundaries/entry-point` gate:** both are already at `"error"` in `eslint.config.mjs:126,158`. `pnpm lint` on this HEAD → **0 errors**, 43 warnings, none in this PR's files. When PR #345 makes the cycle detection actually functional, this PR contributes nothing new for it to find (the #343 backlog is what will surface).
- **Barrel discipline:** cross-domain access is `lib/jobs → @/lib/payment` (the barrel). Correct per SYS20 rule 3 / ADR-016. The deep `importActual('../../payment/adapters/vnpay')` is in a test file, explicitly exempt (`eslint.config.mjs:107,117`).
- **Client-bundle safety:** no `'use client'` file in `app/**` or `components/**` imports `@/lib/payment` (verified by grep). No server-only transitive is pulled into a client bundle. The barrel allowlist at `eslint.config.mjs:141-153` is untouched.
- **ADR coverage:** no new framework/library/provider, so no ADR is owed. The relevant decisions already exist — ADR-005 (payment architecture, names VNPay + the canonical `paid|failed|pending|unknown` normalization), ADR-012 (background jobs), ADR-016 (module boundaries).
- **God module:** top importee `lib/core` at 32.5% of source files (threshold 70%). No finding.
- **Layer violations:** none. No UI→DB edge, no DDL in app code, no payment crypto relocated.

---

PRIORITY 1 — Block push, fix first:

  [DOMAIN MODEL / OVERLOADED DISCRIMINATOR] `PaymentEvent.adapter`
  lib/jobs/reconcilePayments.ts:185-196 · lib/payment/select.ts:46 · app/dev/stub-pay/actions.ts:57-63

    This PR makes `PaymentEvent.adapter` carry a second, incompatible meaning.

    Meaning 1 (existing): the payment METHOD the booking used. It mirrors
    `Booking.paymentMethod`, and `matchDegraded` legitimately reads it that way
    (`reconcilePayments.ts:236` — "which receiving account the money landed in").
    Meaning 2 (added here): the FORMAT of `rawBody`, used to pick a parser.

    These are not the same function, and the codebase already contains the proof:
    `lib/payment/select.ts:46` routes method `vnpay` to the **stub** gateway whenever
    `PAYMENTS_STUB` is on (`VNPAY_ENABLED && !PAYMENTS_STUB` is the only path to the
    real adapter), and `app/dev/stub-pay/actions.ts:60` then persists the stub's JSON
    body under `adapter: 'vnpay'`. So `adapter` is a function of the METHOD, never of
    the producing gateway — the exact property meaning 2 requires.

    `bank_transfer` masked this: it is the only adapter absent from
    `STUB_ADAPTERS = { momo, zalopay, card, vnpay }` (`app/dev/stub-pay/actions.ts:22`),
    so for SePay alone method ⇒ format holds. Generalising that accident to `vnpay` is
    what breaks. Behavioural consequence is filed as P1 in
    `docs/qa/code-review-pr357-20260726.md` (stub-vnpay rows stop recovering).

    The architectural point beyond the bug: `recoverEvent` is now a **second, private
    copy of a routing decision `lib/payment/select.ts` already owns**, and the two
    disagree. `getGatewayFor(method, ...)` resolves method + environment to the gateway
    that actually handled the payment; `recoverEvent`'s `if/else` chain re-derives that
    from a string column and gets a different answer under stub mode. Two routers, one
    decision, divergent results — in the jobs domain rather than the payment domain
    that owns gateway selection.

    Fix direction (architectural, not a patch): make recovery a capability of the
    gateway rather than a lookup keyed on a column — add `recoverEvent(rawBody)` to the
    `PaymentGateway` interface (`lib/payment/gateway.ts`) and have the sweeper obtain it
    from the existing `getGatewayFor(...)`. Each adapter then owns its own recovery
    exactly as it owns `verifyWebhook`, the stub owns the stub shape, `lib/jobs` holds
    zero per-adapter knowledge, the payment barrel stops growing per adapter (P3 below),
    and the ADR-005 normalization boundary is respected on the recovery path as well as
    the ingest path. This also dissolves P2 #1 below.

PRIORITY 2 — Fix before next release:

  [INVARIANT HALF-ENFORCED] lib/payment/gateway.ts:13 vs lib/jobs/reconcilePayments.ts:188-195

    `gateway.ts` states the invariant this PR invokes as its rationale, verbatim:
    "native gateway field names never leak past the adapter boundary. Callers never
    access raw IPN fields without first calling this."

    The PR honours it for VNPay (`recoverVnpayEvent` lives in the adapter) and inherits
    the SePay precedent — but leaves the `else` branch three lines below reading MoMo's
    and the stub's native `amount` / `resultCode` **inline inside `lib/jobs`**. Two of
    four shapes now live behind the boundary and two do not, with the exception sitting
    directly under a comment asserting the rule. Each adapter migrated this way makes
    the remaining inline branch look more like a deliberate default and less like debt.

    This is not cosmetic — that inline branch is precisely what has been (correctly)
    recovering stub bodies, including the stub-`vnpay` rows P1 now diverts away from it.
    Fix: export `recoverMomoEvent` / `recoverStubEvent` from their adapters, or adopt the
    P1 fix (gateway-owned recovery), which removes the branch entirely.

  [COUPLING SPREAD / MISSING SEAM] lib/jobs ↔ lib/payment
    30d window (58 commits): `lib/jobs/reconcilePayments.ts` is the joint-2nd most-churned
    source file (6 touches), tied with `lib/payment/adapters/bankTransfer.ts` (6). The
    pair `lib/jobs + lib/payment` is co-edited in 10% of commits — 3rd highest pair after
    `app+components` (20%) and `app+lib/payment` (13%).

    Below the 50% co-edit threshold, so no rubric trigger — but the *shape* is diagnostic:
    every one of those paired edits (#320, #322, #324, now #357) adds per-adapter payment
    knowledge to the jobs domain and its matching parser to the payment domain. A change
    that cannot be made in one domain is a missing seam, and the seam is the one named in
    P1. Recording it so the trend is visible if a 5th adapter repeats it.

PRIORITY 3 — Track on roadmap:

  [BARREL GROWTH] lib/payment/index.ts — 18 exported symbols after this PR (was 17)
    Under the 20-symbol shallow-module threshold, so no rubric finding. Noted because the
    growth is structural, not incidental: `recoverSepayEvent`, `recoverVnpayEvent` and
    `buildStubIpn` are per-adapter internals promoted to the domain's public API purely so
    a cross-domain caller can dispatch on them. The barrel's width is now a function of
    adapter count — it crosses 20 at the second-next adapter. The P1 fix caps it.

  [UNDOCUMENTED TRUST INVARIANT] lib/payment/adapters/vnpay.ts (new fn) / processWebhook.ts:110-135
    `recoverVnpayEvent` deliberately skips HMAC re-verification, correctly justified in its
    doc comment ("the row only exists because verifyWebhook already passed at ingest").
    That is a real invariant with a real enforcement point — `recordUnmatchedPaymentEvent`
    is the only writer of unverified-ref rows and it is gated to `bank_transfer` + `paid`
    (`processWebhook.ts:198`) — but it is asserted only in prose, in two adapters, and is
    not recorded on the `PaymentEvent` model or in ADR-005. A future writer of
    `PaymentEvent` rows has nothing to tell them they are the load-bearing check for two
    downstream parsers. Worth one line in the schema model comment.

  [DRIFT — IMPROVEMENT] `lib/jobs → lib/ticketing` edge removed since the 2026-07-23
    baseline (unrelated master commits). Recorded, no action.

SUMMARY: 1 P1, 2 P2, 3 P3
Graph snapshot updated → docs/qa/arch-graph.json (671 files, 41 modules, 153 module edges, SCC unchanged)

RECOMMENDED NEXT STEPS:
  → P1 is the same defect code-review found, seen structurally: the fix is to move
    recovery onto `PaymentGateway` and source it from `getGatewayFor`, not to add a
    third `else if`. Doing it that way closes P1, P2 #1, P2 #2 and P3 #1 together.
  → Cycles, barrel discipline, client-bundle safety, layer boundaries, ADR coverage and
    god-module checks are all clean; nothing about the module graph argues against this PR.
  → The #343 8-module SCC remains the standing architectural debt; PR #345 will make it
    visible. Unaffected by this PR either way.
