# ARCHITECT REVIEW — PR #324 "fix(payments): reconcile sweeper blind to bank transfers (Bug B)" @ 0435fe17

```
Base: master  ·  Head: fix/bank-transfer-reconcile-orphan  ·  State: open
Mode: PR (audited in-place — working tree IS the PR HEAD; no checkout performed,
      six concurrent review agents share this tree)
Date: 2026-07-23
```

Scanned: **41 modules**, **154 module edges**, **1984 file edges**, **669 source files**
(`app/**`, `components/**`, `lib/**`, excluding `__tests__` and `*.test.ts`)
30-day window: 56 commits.

Diff under review: 15 files, +846/−59 — `lib/payment/{gateway,index,processWebhook}.ts`,
`lib/payment/adapters/bankTransfer.ts`, `lib/jobs/reconcilePayments.ts`,
`app/api/payments/bank_transfer/webhook/route.ts`, `prisma/schema.prisma` +
`20260723120000_payment_event_orphan_bookingid`, tests, `CLAUDE.md`.

---

## Verdict on the five questions asked

| # | Question | Verdict |
|---|----------|---------|
| 1 | Adapter-boundary invariant honestly satisfied? | **No — half-enforced.** See A1 (P1). The invariant is violated *today*, in the same file, for `vnpay`, with a live money-loss consequence. |
| 2 | `lib/jobs` → `lib/payment` coupling / new cycle? | **Clean.** Zero new module edges; the edge and the dynamic-import statement both pre-exist on `master`. Matches the documented lazy-import pattern verbatim. See A2. |
| 3 | Duplicated claim logic acceptable? | **No — extract it.** `applyPaidTransition.ts` is the exact precedent and its own header says why. See A3 (P2). |
| 4 | Missing orphan abstraction? | **Yes.** The concept exists in 11 comments, 2 log strings and 4 predicates, and in zero types, constants or function names shared across the two domains that own it. See A4 (P2). |
| 5 | Barrel exports appropriate? No layering violation / new cycle? | **Both exports appropriate; no layering violation; no new cycle.** One naming caveat (P3). See A5. |

---

## PRIORITY 1 — Block merge, fix first

### A1 · [DOMAIN INVARIANT] `lib/jobs/reconcilePayments.ts:141-152` — the adapter boundary is still breached, and `vnpay` is the live casualty

`lib/payment/gateway.ts:11-14` states the invariant verbatim:

> *"Each adapter maps its own native IPN field names + result codes into this single canonical shape — **native gateway field names never leak past the adapter boundary**. Callers never access raw IPN fields without first calling this."*

The PR moves **one** provider's parse behind the boundary (`recoverSepayEvent`) and leaves the
other branch exactly where it was:

```ts
if (row.adapter === 'bank_transfer') {
  ({ amount, success } = recoverSepayEvent(row.rawBody));
} else {
  const parsed = JSON.parse(row.rawBody) as Record<string, unknown>;
  const rawAmount = Number(parsed.amount ?? 0);       // ← MoMo native field name
  success = Number(parsed.resultCode ?? -1) === 0;    // ← MoMo native result code
}
```

`amount` and `resultCode` are MoMo's native IPN field names, living in `lib/jobs`, read
straight off a raw provider body without going through any adapter. That is the literal
thing the invariant forbids. So the answer to the question posed is: **half-migration, and
the invariant is merely half-enforced** — the comment at `recoverEvent` now *claims*
per-adapter dispatch ("THE BODY SHAPE IS PER-ADAPTER — dispatch on the stored `adapter`
column") while the code dispatches for exactly one of five adapter values.

**This is not cosmetic. The identical Bug B is still live for VNPay:**

- `app/api/payments/vnpay/webhook/route.ts:44-55` builds `rawBody` as a **URL-encoded query
  string** (`vnp_Amount=...&vnp_ResponseCode=...`), never JSON, and passes it to
  `processPaymentWebhook({ rawBody, adapter: 'vnpay' })` → stored verbatim in
  `PaymentEvent.rawBody`.
- `recoverEvent`'s else-branch calls `JSON.parse` on that string → throws → `catch` →
  `{ amount: 0, success: false }`.
- `isConfirming()` is therefore **always false for every `vnpay` row**, `matchDegraded()`
  bails at `!ev.success`, and a stuck VNPay booking gets `payment_failed_expired` — which
  `lib/booking/transitions.ts:38` documents as TERMINAL — while the money sits with the PSP.
- Even if the body *were* JSON, `vnp_Amount` is in **×100 minor units** (`vnpay.ts:142`
  divides by 100) and the success code is `vnp_ResponseCode`, not `resultCode`.

This is character-for-character the failure mode the PR's own new CLAUDE.md rule describes —
*"a single parse shape is a latent per-provider outage that only fires for the providers you
didn't write it against"* — written in the same commit that leaves the second provider
un-dispatched.

Mitigating: `VNPAY_ENABLED` is currently off (`lib/payment/select.ts:47`), so vnpay routes to
the stub, whose bodies *do* carry `{amount, resultCode}`. The defect is latent behind a
kill-switch that memory records as a pre-go-live HITL gate — i.e. it arms itself the moment
someone flips the flag, with no test and no comment warning them.

**Fix (also resolves A3/A4 and reduces the touch count below the rejected option):** the
rejected alternative was adding `recoverStoredEvent()` to the `PaymentGateway` *interface* —
correctly rejected, because `getStubAdapter()` needs a `baseUrl` the cron has no request
context for. But that objection applies only to routing through `getGatewayFor()`. A third
option was not considered: a **standalone pure dispatcher in the payment domain**, which
needs no `baseUrl` at all:

```ts
// lib/payment/recoverStoredEvent.ts  (or fold into select.ts, which already owns
// the OnlinePaymentMethod union and the routing table)
export function recoverStoredEvent(
  adapter: string,
  rawBody: string
): { amount: number; success: boolean } {
  switch (adapter) {
    case 'bank_transfer': return recoverSepayEvent(rawBody);
    case 'vnpay':         return recoverVnpayEvent(rawBody);   // ← the missing one
    case 'momo':
    case 'card':
    case 'zalopay':
    default:              return recoverMomoShapedEvent(rawBody);
  }
}
```

Cost: 1 new file + 1 per-adapter parser + 1 barrel line + `lib/jobs` drops from
*one-import-plus-inline-parse* to *one import* — **4 files, one fewer than the rejected
option**, and `lib/jobs` ends with zero native field names. Then the invariant at
`gateway.ts:11-14` is true as written rather than true-for-one-adapter.

---

### A2 · [CYCLE] 8-module SCC through `lib/payment ↔ lib/booking` — **PRE-EXISTING, not introduced by #324** — and `import-x/no-cycle` does not fire

Tarjan on the module graph returns one non-trivial SCC:

```
{ lib/auth, lib/account, lib/trips, lib/jobs, lib/notification,
  lib/ledger, lib/payment, lib/booking }
```

Shortest concrete file-level path:

```
lib/payment/index.ts
  → lib/payment/adapters/bankTransfer.ts:24   import { BOOKING_REF_REGEX } from '@/lib/booking'
  → lib/booking/index.ts:8 / :16
  → lib/booking/createCashBooking.ts:19       import { appendBookingPaidLedger } from '@/lib/payment'
  → lib/payment/index.ts                                                        ← closes the loop
```

Also `lib/payment/{applyPaidTransition,processWebhook}.ts` → `@/lib/booking` and
`lib/booking/initiateOnlineBooking.ts` → `@/lib/payment`.

**Not this PR's doing.** Verified against `master` with `git show`: all three
`payment → booking` edges and the `booking → payment` edge exist unchanged on the base.
This PR adds **zero** module-level edges (its only import changes are additional *symbols*
inside import statements that already targeted `@/lib/payment`).

The second half of the finding is the one that matters going forward: the config declares
`"import-x/no-cycle": ["error", { maxDepth: Infinity, ignoreExternal: true }]`
(`eslint.config.mjs:151`) as a Stage-3 hard gate — and **the rule is inert**. Empirically
verified during this review (temp files created and deleted, tree left clean):

| Probe | Expected | Actual |
|-------|----------|--------|
| Two files under `lib/payment/` importing each other (trivial 2-cycle) | `import-x/no-cycle` error | **no output — clean** |
| Same, with `--rule '{"import-x/no-cycle":["error",{"maxDepth":10,"ignoreExternal":true}]}'` | error | **no output — clean** |
| `lib/payment/_probe.ts` deep-importing `@/lib/booking/createCashBooking` | `boundaries/entry-point` error | **error raised correctly** ✅ |

So `boundaries/entry-point` is genuinely enforcing (the barrel contract is real and this PR
complies with it), but the companion no-cycle gate has been passing vacuously since the
092b Stage-3 flip. `eslint-import-resolver-typescript@4` is installed and `import-x@4.17` is
loaded — the likely cause is the v4 resolver-settings key (`import-x/resolver` vs the v4
`import-x/resolver-next` shape) leaving `no-cycle`'s ExportMap unable to resolve `@/*`, which
makes every cycle invisible rather than failing loudly.

**Fix (separate PR — do not scope-creep #324):**
1. Repair the resolver wiring so `no-cycle` fires; re-run the 2-file probe as the acceptance test.
2. It will then immediately red on the pre-existing `payment ↔ booking` cycle. The clean break
   is to move `BOOKING_REF_REGEX` (a pure regex constant with no dependencies) and
   `legalPredecessors` / the transition map out of `lib/booking` into `lib/core` — both are
   shared vocabulary, not booking behaviour, and that single move cuts the `payment → booking`
   direction entirely, collapsing the 8-module SCC.
3. AGENTS.md 2026-06-03 records that cycles were driven "to zero" before the flip — that claim
   should be treated as unverified until the probe passes.

---

## PRIORITY 2 — Fix before next release

### A3 · [DUPLICATION / MISSING SEAM] the orphan claim is written twice, in two idioms, in two domains

| Site | Idiom | Selector | Guard |
|------|-------|----------|-------|
| `lib/payment/processWebhook.ts:232` | Prisma `tx.paymentEvent.updateMany` | natural key `(adapter, providerTxnId)` | `bookingId: null` |
| `lib/jobs/reconcilePayments.ts:313` | raw `tx.$executeRaw(Prisma.sql\`UPDATE …\`)` | PK `id` | `"bookingId" IS NULL` |

The selectors legitimately differ (natural key vs PK). The **guard is the invariant**, and it is
the thing duplicated: *an orphan may be claimed exactly once, and the claim must be a
compare-and-set that reports its rowcount.* Nothing structural keeps the two in step. Add a
`claimedAt` column, an audit row, or a `WHERE receivedAt > …` staleness bound to one site and
the other silently diverges — and one of the two divergent paths mints operator ledger credit.

**Answer to the question as posed: not acceptable duplication.**
`lib/payment/applyPaidTransition.ts:1-7` is the precedent *and states this exact rationale*:

> *"Extracted (Issue 095) so the payment webhook (`lib/payment/processWebhook.ts`) and the
> reconciliation sweeper (`lib/jobs/reconcilePayments.ts`) reach the SAME paid effect and can
> never drift."*

The claim is the *second* effect those same two callers now share, and it gates the first.
It belongs in the same place, by the same argument:

```ts
// lib/payment/claimPaymentEvent.ts — exported from the barrel next to applyPaidStatusTransition
export async function claimOrphanPaymentEvent(
  tx: Prisma.TransactionClient,
  bookingId: string,
  by: { paymentEventId: string } | { adapter: string; providerTxnId: string }
): Promise<{ claimed: boolean }>
```

Secondary note: the raw-SQL form in `lib/jobs` is unnecessary — `tx` there is a
`Prisma.TransactionClient` (`reconcilePayments.ts:496`), so
`tx.paymentEvent.updateMany({ where: { id, bookingId: null }, data: { bookingId } })` returns
the same `{ count }`. Two idioms for one operation is pure incidental variance. (The `::uuid`
casts themselves are correct — both `Booking.id` and `PaymentEvent.id` are `@db.Uuid`, unlike
the CUID/TEXT case in the Issue 011 log entry.)

### A4 · [MISSING ABSTRACTION] the "orphan" is a first-class domain concept with no name in the type system

The concept is now load-bearing across a domain boundary — written by `lib/payment`, read and
mutated by `lib/jobs`, persisted by a nullable FK — and it exists **only in prose**:

- 11 comment occurrences of "orphan" across `gateway.ts`, `bankTransfer.ts`, `processWebhook.ts`,
  `reconcilePayments.ts`, `schema.prisma`, `migration.sql`, `route.ts`
- 2 log strings, which **use both names in one line**:
  `'payment.webhook.unmatched_recorded — orphan PaymentEvent stored for reconciliation'`
- 4 hand-written predicates (`bookingId: null` ×2 Prisma, `"bookingId" IS NULL` ×2 SQL)
- 0 types, 0 constants, 0 shared functions

Two names for one thing (`unmatched` in `VerifyWebhookResult.unmatched` /
`recordUnmatchedPaymentEvent`, `orphan` everywhere else) is the tell that the concept was
never modelled. Compounding, the *gating* value is a bare string literal repeated at three
decision points with no shared constant, even though `lib/payment/select.ts:22` already exports
the canonical union:

```
lib/payment/processWebhook.ts:196   if (adapter === 'bank_transfer' && status === 'paid')
lib/jobs/reconcilePayments.ts:141   if (row.adapter === 'bank_transfer')
lib/payment/select.ts:34            if (method === 'bank_transfer')          ← + the union at :22
```

**Fix:** a small `lib/payment/orphanEvent.ts` owning the vocabulary — `type OrphanPaymentEvent`,
`ORPHAN_WHERE = { bookingId: null } as const`, `recordOrphanPaymentEvent`,
`claimOrphanPaymentEvent` (A3), `ORPHAN_ELIGIBLE_ADAPTERS: ReadonlySet<OnlinePaymentMethod>` —
and pick **one** word. `lib/jobs` then consumes a named concept instead of re-deriving a
predicate. This also gives A1's `recoverStoredEvent` a natural home.

### A5 · [SPEC DRIFT / ADR GAP] a new persistent money-evidence state landed with no spec or ADR update — and it is the model DS-013 explicitly deferred

Nullable-FK orphan rows are architecturally significant state: rows that assert *money arrived*
and are the sole DB evidence of it. Four spec documents are now stale:

| Document | Says | Reality after #324 |
|----------|------|--------------------|
| `DS-013…/README.md:205-207` | `no_booking_ref_in_memo` → 200, unlinked, "requires admin manual reconciliation" | now also writes an orphan `PaymentEvent` |
| `DS-013…/README.md:268-271` | `ReconAttempt` model "not needed at launch"; would be introduced when "admin manual reconciliation UI needs to track unmatched transfers" | that tracking now exists — implemented by **overloading `PaymentEvent` with a nullable FK** instead of the named model |
| `business/domain-model/event-flows.md:105` | "INSERT `PaymentEvent` (idempotent; P2002 → 200 no-op)" | now **CLAIM-then-INSERT**; P2002 remains the fallback |
| `business/domain-model/invariants-catalog.md:182` | "`@@unique([adapter, providerTxnId])`; P2002 → 200 no-op" | still true, but no longer the whole idempotency story |

Choosing "widen `PaymentEvent.bookingId` to nullable" over "add the `ReconAttempt` model DS-013
named" is a real trade-off (fewer tables and one dedup key, vs. an audit table whose every row
is by definition a linked payment) and it was decided in a code comment. It deserves an ADR
amendment under ADR-005, plus a DS-013 revision entry. Cross-link `/adr-writer`.

*(Category-4 automated ADR scan is otherwise clean: no new `package.json` dependencies, no new
framework/auth/DB/deploy/queue/AI-provider surface; ADR-005 and ADR-012 both exist and cover
the payment + background-jobs choices.)*

### A6 · [LIFECYCLE OWNERSHIP] orphan rows have no consumer past the ±30-minute window, no operator surface, and no retention anchor

Follows directly from A4 — nobody owns the concept, so nobody owns its lifecycle.

1. **Unreachable after the window.** `matchDegraded()` only considers orphans within
   `±DEGRADED_MATCH_WINDOW_MINUTES` of hold creation, and the SQL pre-filter
   (`reconcilePayments.ts:268-276`) applies the same bound. An orphan that misses its window
   is permanently invisible to every code path in the repo. It is retained, and unreadable.
2. **No operator surface, though two ADRs require one.** ADR-005:228 — *"admin reconciliation
   dashboard flags unmatched bank transfer payments; manual resolution documented in support
   agent workflow"*; ADR-012:172 — *"Surface unmatched in admin reconciliation dashboard."*
   Both were written for exactly these rows. Nothing in `app/admin/**` queries
   `bookingId IS NULL`. DS-013:423 tracks the UI as post-launch/MEDIUM — fair, but the data
   starts accumulating on merge and the schema comment ("never delete one without reconciling
   it against the bank statement first") is a manual-process instruction with no tooling behind it.
3. **Retention has no anchor.** `lib/jobs/retentionSweeper.ts` has **zero** `paymentEvent`
   references; the ADR-008 model anonymizes PII on `Booking`/`Customer` and reaches financial
   rows through the booking relation. An orphan has no booking. Its `rawBody` is a SePay payload
   carrying `accountNumber`, `subAccount`, `content` and `description` — payer bank-account data,
   i.e. financial PII with a 5–10 year Accounting-Law retention obligation (ADR-007:189) and no
   deletion path.

**Fix:** minimally, one admin read view over `PaymentEvent WHERE bookingId IS NULL` plus an alert
when the count is non-zero for > 1 hour; and an explicit decision (recorded in the A5 ADR
amendment) on how an orphan's PII is aged out absent a booking anchor.

### A7 · [SHALLOW MODULE] barrels over the 20-export threshold — pre-existing

| Barrel | Exports | Domain impl lines |
|--------|---------|-------------------|
| `lib/auth/index.ts` | 23 | 3710 |
| `lib/booking/index.ts` | 23 | 2281 |
| `lib/admin/index.ts` | 21 | 2582 |
| `lib/ratelimit/index.ts` | **17** | **293** ← genuinely shallow |

`lib/payment/index.ts` is **11 exports over 1814 implementation lines — a deep module**, and the
two exports this PR adds do not change that. `lib/ratelimit` (17 exports / 293 lines) is the one
true shallow module: a re-export pile adding no abstraction. Not this PR's concern; tracked here
because the category was scanned. Cross-link `/improve-codebase-architecture`.

---

## PRIORITY 3 — Track on roadmap

- **[NAMING] `recoverSepayEvent` leaks vendor identity into the payment barrel.** Every other
  payment-domain symbol names the *method* (`getBankTransferAdapter`, `'bank_transfer'`,
  `OnlinePaymentMethod`); this one names the *vendor*. A reader of `lib/payment/index.ts` must
  already know SePay ≡ bank_transfer to connect the export to the `row.adapter === 'bank_transfer'`
  branch that calls it. Mildly ironic in a function whose stated purpose is keeping vendor
  specifics behind the boundary. Prefer `recoverBankTransferEvent`, or fold it behind
  `recoverStoredEvent(adapter, rawBody)` per A1 and stop exporting it at all.
- **[DI SHAPE] `recoverEvent(row, recoverSepayEvent)` passes a dependency as a positional
  parameter** because the enclosing job core resolves `@/lib/payment` lazily. Correct given the
  constraint, but it does not scale: a second provider parser makes it
  `recoverEvent(row, fnA, fnB)`. A1's single `recoverStoredEvent` collapses it back to one
  parameter permanently.
- **[COUPLING SPREAD] `app/api/bookings/initiate/route.ts`** — 6 touches in 30 days, co-edited
  with `{booking, payment, ledger, jobs, api:payments, api:holds, config, logger, core}`. The
  highest-fan-in junction file in the tree. Not touched by this PR; flagged as a growing seam.
- **[CO-EDIT] `api:payments + payment` co-edited in 5/5 payment-API commits (100%)** and
  `jobs + payment` in 3/7 jobs commits (43%). The first is expected route↔domain coupling. The
  second is below the 50% threshold but trending — A1/A3/A4 all reduce it.

---

## Category results

| Category | Result |
|----------|--------|
| 1 · Dependency graph | 1 non-trivial SCC (8 modules) — **pre-existing**, zero new edges from #324 (A2). No god module: top importee `lib/core` at 33.6% of 669 files, well under 70%. |
| 1 · Layer violations | **None.** No `components/**` → db. Payment crypto/auth confined to `app/api/payments/**` + `lib/payment/adapters/**`. All four cross-domain edges in the diff go through barrels; `boundaries/entry-point` verified live and green on the changed dirs. |
| 2 · Coupling spread | See P3. No pair over the 50% co-edit threshold except the expected route↔domain pair. |
| 3 · Deep vs shallow | A7. `lib/payment` remains deep (11 exports / 1814 lines). |
| 4 · ADR coverage | No new deps/frameworks → no new ADR *required* by the automated scan; but A5 flags a significant decision recorded only in comments. |
| 5 · Domain isolation invariants | **A1 — `gateway.ts:11-14` violated** (MoMo native field names in `lib/jobs`). No DDL in `$executeRaw`. No `process.env` secret reads outside server modules. No new logger-redaction gap (`providerTxnId`/`adapter` are non-PII; `rawBody` is stored, never logged). |
| 6 · Dep-graph drift | **Baseline established** — no prior `docs/qa/arch-graph.json`. Written this run; next run diffs against it. |

---

## SUMMARY: 2 P1, 5 P2, 4 P3

**Of which attributable to #324: 1 P1 (A1), 3 P2 (A3, A4, A5), 2 P3.**
A2 and A7 are pre-existing repo conditions surfaced by the repo-wide scan; #324 neither causes
nor worsens them.

The core architectural judgement: **#324 fixes a real production outage and its concurrency
hardening (the CAS claim, claim-before-insert) is well-reasoned and correctly placed.** What it
does not do is finish the abstraction it starts. It states a per-adapter dispatch rule, applies
it to one adapter, and leaves the identical latent outage armed behind `VNPAY_ENABLED`; and it
introduces a new cross-domain domain concept ("orphan") without giving it a name, an owner, or a
lifecycle. Those are the same defect viewed from two angles — an abstraction pushed one step
short of where it needed to land.

## RECOMMENDED NEXT STEPS

1. **A1 before merge** — `recoverStoredEvent(adapter, rawBody)` in `lib/payment`, with the
   `vnpay` branch and a test that feeds a REAL `vnpay` adapter-produced `rawBody` through it
   (per the PR's own "one producer, two consumers" rule). Fewer files than the rejected option
   and it makes `gateway.ts:11-14` true as written.
2. **A3 + A4 in the same pass** — `lib/payment/orphanEvent.ts` owning `claimOrphanPaymentEvent`,
   `recordOrphanPaymentEvent`, the `bookingId: null` predicate and one chosen word.
   `applyPaidTransition.ts` is the template.
3. **A2 as a separate PR** — repair the `import-x` resolver wiring; verify with the 2-file cycle
   probe; then break `payment ↔ booking` by relocating `BOOKING_REF_REGEX` + `legalPredecessors`
   to `lib/core`. Do not scope-creep #324.
4. **A5** — `/adr-writer` amendment under ADR-005 for the nullable-FK-vs-`ReconAttempt` decision;
   revise DS-013 §205-207 / §268-271, `event-flows.md:105`, `invariants-catalog.md:182`.
5. **A6** — admin unmatched-payments view + non-zero-orphan alert; decide and record the orphan
   PII retention path.

*Report is advisory. No source files were modified by this review; the two ESLint probe files
were created and deleted within a single command and the tree was verified clean afterward.*
