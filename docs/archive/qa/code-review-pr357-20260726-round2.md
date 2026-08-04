# CODE REVIEW — PR #357 "fix(payments): reconcile sweeper recovers VNPay transfers (#330)" @ `0f43bfb4`

**Round 2** — re-review after review-driven fix commit `0f43bfb`.
Round 1 (`bce2a60b`) is preserved at `docs/qa/code-review-pr357-20260726.md`.

Base `master` · head `fix/vnpay-recover-330` · reviewed from `gh pr diff 357` plus a detached
`git worktree` at `0f43bfb` with its own `pnpm install`. The main working tree was left on
`fix/333-no-cycle-resolver` and never checked out.

```
Diff scope: 5 files, +228 / -15
  lib/jobs/reconcilePayments.ts
  lib/jobs/__tests__/reconcilePayments.test.ts
  lib/payment/adapters/vnpay.ts
  lib/payment/__tests__/vnpay.test.ts
  lib/payment/index.ts
```

## Empirical baseline

| Check | Result |
|---|---|
| `pnpm vitest run lib/jobs/__tests__/reconcilePayments.test.ts lib/payment/__tests__/vnpay.test.ts` | **43/43 pass** |
| `pnpm tsc --noEmit` (after `pnpm prisma generate` in the worktree) | **clean** |
| PR claim: the new *"recovers a STUB-served vnpay row"* test fails against pre-fix adapter-only dispatch | **CONFIRMED** — reverting the `&& !isJsonBody(...)` guard yields `1 failed \| 16 passed`, failing exactly that test and nothing else |

The round-1 root defect is genuinely fixed and genuinely guarded. See FIX VERDICT at the end.

---

## PRIORITY 1 — Block merge

### P1-1 [SECURITY / MONEY] `lib/payment/adapters/vnpay.ts:249-257` — the duplicate-key divergence is now a LIVE wrong-payment path, and round 1's reachability assessment was wrong

Round 1 filed this as P2 with the rationale:

> *"Reachability is low (the body is HMAC-signed by VNPay, so it requires VNPay itself to
> emit duplicate `vnp_*` keys)"*

**That is incorrect, and it is why the PR body carried the finding forward as "not urgent".**
An attacker does not need VNPay to emit duplicate keys. They can **prepend** duplicates to a
body VNPay already signed, and the signature still validates — because `verifyWebhook`
deduplicates *last-wins* before computing `buildSignData`, so the reconstructed param set is
byte-identical to the one that was signed.

`recoverVnpayEvent` reads with `URLSearchParams.get()` — **first**-wins.
`verifyWebhook` (`:102-106`) builds its record with `for (const [k,v] of params.entries())` —
**last**-wins. Two readers of the same bytes, opposite duplicate-key semantics.

Verified empirically (PoC executed in the worktree, not committed):

```
genuine signed body
  verifyWebhook      → ok, status 'pending', amount 150000
  recoverVnpayEvent  → { amount: 0, success: false }                    ✓ agree

"vnp_TransactionStatus=00&vnp_Amount=99999900&" + that same signed body
  verifyWebhook      → ok, status 'pending', amount 150000   ← HMAC STILL VALID
  recoverVnpayEvent  → { amount: 999999, success: true }                ✗ DIVERGE
```

Full reachability chain, every link verified in-repo:

1. **The endpoint is open.** `/api/payments/vnpay/webhook` is in *both* `CSRF_EXEMPT` and
   `RATELIMIT_EXEMPT` (`proxy.ts:70-87`) — unauthenticated, unthrottled. The only gate is
   the HMAC, which this body passes by construction.
2. **The booking survives ingest.** `classifyVnpayStatus` maps `vnp_TransactionStatus='02'`
   into `VNPAY_PENDING_CODES` (`vnpay.ts:39`) → canonical `pending` → `processWebhook` takes
   the `status === 'pending'` arm and makes **no status transition**. The booking stays
   `awaiting_payment`. (`02` is VNPay's ordinary "transaction failed" status — the common
   outcome after a declined payment, not an exotic one.)
3. **The poisoned bytes are persisted verbatim and linked.** `processWebhook.ts` inserts the
   `PaymentEvent` *before* the status branch, storing `rawBody, // stored for audit` exactly
   as received, with `bookingId = booking.id`.
4. **The sweeper then honours the attacker's values.** After `RECONCILE_THRESHOLD_MINUTES`
   the booking is a candidate; `recoverEvent` sees `adapter==='vnpay'` + non-JSON →
   `recoverVnpayEvent` → `{success:true, amount:999999}` → `isConfirming` true →
   `applyPaidStatusTransition` → **paid**, plus `appendBookingPaidLedger` crediting the
   operator for money that never arrived.

Net effect: **a customer whose VNPay payment did not succeed can mark their own booking paid
without paying**, by replaying their own signed return-URL/IPN params with two prepended
duplicate keys and waiting one sweeper tick.

**This diff is what makes it reachable.** On `master`, the vnpay branch went through
`JSON.parse`, which throws on a urlencoded body → `{0,false}`. The divergence existed but was
dead code. `0f43bfb` does not introduce the divergence; it removes the thing that was
neutralising it.

That is verbatim the CLAUDE.md **2026-07-23** rule — *"a migration that WIDENS a constraint is
not automatically safe — grep for code gated on the old constraint making something
impossible … and review each as new code, because that is exactly what it becomes."* Here the
"constraint" was `JSON.parse` throwing. **Auto-P1 per the Mistake-Log rule.**

It is also the **2026-07-24 Bug B round 3** meta-rule firing again: *"fixing a review finding
is itself a change that can introduce a worse one — re-run the adversarial review on the FIX."*

**Fix:** export one `parseVnpayParams(rawBody): Record<string,string>` from the adapter and
have **both** `verifyWebhook` and `recoverVnpayEvent` consume it, so there is exactly one
duplicate-key policy. Add a test asserting the two readers agree on a duplicate-key body
(`recoverVnpayEvent(b).amount === verifyWebhook(b).event.amount`, and
`success === (status === 'paid')`). Belt-and-braces: reject any body carrying a duplicated
`vnp_*` key — VNPay never legitimately sends one.

---

### P1-2 [CORRECTNESS / DOCS] PR body "Rollback" — the blast-radius claim is false in the dangerous direction

> *"`VNPAY_ENABLED` is `false` in production today, so the live blast radius is stub/preview
> environments only."*

`app/api/payments/vnpay/webhook/route.ts` calls **`getVnpayAdapter()` directly**, not
`getGatewayFor('vnpay')`. The `VNPAY_ENABLED` kill-switch lives in `lib/payment/select.ts:46`
and gates only **outbound gateway selection**. It never gates the **inbound IPN route**. The
vnpay webhook is reachable in production today, therefore vnpay `PaymentEvent` rows can be
created in production today, therefore **P1-1 is a production exposure, not a stub/preview
one** — and the PR body's own risk paragraph is what would tell a future reader otherwise.

Adjacent, **pre-existing and out of this diff's scope**, but it is what actually sets the
blast radius the PR body is asserting, so it must be resolved before that sentence can be
rewritten truthfully: `VNPAY_HASH_SECRET` defaults to the literal
`'VNPAYSECRETTEST0123456789ABCDEF01'` (`lib/config/env.ts:78-81`), and the `superRefine`
real-credential gate only fires `if (env.VNPAY_ENABLED)` (`:419`). `.env.production.local`
sets `VNPAY_ENABLED` and no other `VNPAY_*` var. **Confirm against the deployed Vercel
project env before concluding anything** — `.env.production.local` is not authoritative for a
Vercel deploy. If the deployed env also leaves it unset, the production IPN receiver is
validating signatures against a constant published in this repo, which is a standalone P1
that deserves its own issue.

**Auto-P1 per the CLAUDE.md 2026-07-24 rule:** *"before squash-merging a multi-commit PR,
re-read the PR body and any safety/rollback doc against the FINAL diff … state the rollback in
terms of what the OTHER-version code does."* On a squash-merge this paragraph becomes the
permanent `master` commit message.

**Fix:** correct the Rollback section; file the webhook-not-gated-by-`VNPAY_ENABLED` and the
default-secret questions separately.

---

## PRIORITY 2 — Fix before merge

### P2-1 [FAILURE MODE] `lib/jobs/reconcilePayments.ts:389-403` — the new warn loop is unbounded and fires on a normal condition

`if (!confirming && linked.length > 0)` emits `logger.warn` for **every** linked event with
`{amount:0, success:false}` — which is exactly what a **legitimately declined** payment
produces. So `reconcile.event_unrecoverable` fires on ordinary customer declines.

It also has no termination condition. A booking with `holdExpiresAt === null` never reaches
the expire branch (`:605-611`, `if (!holdExpired) continue;`), so it stays in the candidate
set indefinitely and re-emits this warn **every 15-minute tick, forever**. Structurally the
same shape as the CLAUDE.md 2026-07-24 "Bug B round 3" entry — *a skip that keeps a row in a
bounded work-queue's candidate set without changing anything the next iteration reads* — here
manifesting as unbounded warn-level log growth rather than budget starvation.

**Fix:** aggregate to one line per booking per tick, and gate on a predicate that actually
implies a defect (see P2-2).

### P2-2 [CORRECTNESS] `bodyShape` cannot answer the question it was added to answer

The code comment (`:387-388`) and the PR body both claim `shape` *"is what tells an operator
'parser mismatch' apart from 'customer's payment failed'"*. On the rail this PR exists for,
it does not:

| Case (adapter `vnpay`) | recovered | `shape` |
|---|---|---|
| declined payment, genuine urlencoded body | `{0,false}` | `non-json` |
| unreadable / format-mismatched body | `{0,false}` | `non-json` |

Identical on both axes. `bodyShape` only discriminates for a row whose stored format is
*unexpected for its adapter* — and after this fix no such row exists, because routing is now
shape-driven. The field is a tautology with respect to the routing decision it describes.

**Fix:** carry the discriminating signal instead — have the parsers return
`{ amount, success, parsed: boolean }` (or the recovered native status code) and log that. A
decline is `parsed:true, success:false`; a format mismatch is `parsed:false`. That also gives
P2-1 a correct gate.

### P2-3 [CORRECTNESS] `bodyShape` does not describe the routing actually taken

`bodyShape` is computed unconditionally as `isJsonBody(row.rawBody)` (`:241`), but the
`bank_transfer` branch (`:224`) never consults `isJsonBody` — a bank_transfer row goes to
`recoverSepayEvent` whatever its shape. So `shape:'json'` on a bank_transfer row does **not**
mean "was handed to the JSON parser". The field reads as routing provenance and isn't one.

**Fix:** if the field survives, set it from the branch actually taken
(`'sepay' | 'vnpay-urlencoded' | 'json'`), not from an independent second sniff.

### P2-4 [TEST / RISK PATH] the whole new observability branch and `bodyShape` have zero assertions

`lib/jobs/__tests__/reconcilePayments.test.ts:419` adds `bodyShape: 'json' as const` to one
`matchDegraded` fixture — a **type-satisfying** addition, not an assertion. Nothing in the
diff exercises `reconcile.event_unrecoverable`; nothing asserts any `bodyShape` value.

Per the severity table this is a new branch in a payment-path file with no test (nominally
P1); ranked P2 only because the branch is log-only and cannot move money.

Also untested: `isJsonBody` boundary inputs (`''`, leading whitespace, `[`, BOM) — and, the
one that matters, **no test asserts `recoverVnpayEvent` and `verifyWebhook` agree on the same
body**, which is precisely the hole P1-1 lives in.

### P2-5 [TEST / WIRE CONTRACT — round-1 P2, still open, and silently dropped from the PR body]

The sweeper-layer fixture `vnpayRawBody` (`reconcilePayments.test.ts:34-40`) is still
**hand-typed**: its own field subset, no `vnp_SecureHash`, never round-tripped through the
real adapter. Round 1 flagged this as the 2026-07-23 SePay ref-case rule verbatim, contrasting
it with the SePay guard in the *same file* (`:353-376`) which builds one body, asserts
`getBankTransferAdapter().verifyWebhook()` accepts it, then stages that same string.

`0f43bfb` did not address it, and unlike the other three carried-forward findings it does
**not** appear in the PR body's "Not delivered" section. It was silently lost.

### P2-6 [CORRECTNESS / MONEY — round-1 P2, still open, and silently dropped from the PR body]

`recoverEvent(row, recoverSepayEvent, recoverVnpayEvent)` (`:217-232`, call site `:368`) still
takes **two positionally-injected functions of the identical type**
`(rawBody: string) => { amount: number; success: boolean }`. Swapping the two arguments
type-checks silently and reinstates Bug B on both rails at once — each parser returns
`{0,false}` on the other's body: no throw, no log, just silent non-confirmation followed by
terminal expiry. The fix commit added a third format branch, so the hazard grew rather than
shrank.

Also absent from the PR body's "Not delivered" list.

**Fix (unchanged from round 1):** pass a single
`Record<string, (rawBody: string) => {...}>` and look the parser up, so the key *is* the
discriminator.

---

## PRIORITY 3 — Address when convenient

### P3-1 [READABILITY] `lib/jobs/reconcilePayments.ts:165-199` — an orphaned doc comment now asserts the rule this commit disproves

The original 20-line `recoverEvent` block comment was left in place when `recoverJsonIpn` was
extracted, so the file now carries two stacked doc comments and the upper one still reads, in
emphatic all-caps:

```
 * THE BODY SHAPE IS PER-ADAPTER — dispatch on the stored `adapter` column.
```

— directly above a function that is *not* `recoverEvent`, immediately before the code that
deliberately stops doing that. In a codebase whose review culture is driven by a Mistake Log,
a loud directive that is now false is a live regression magnet: a future reader "restoring
consistency" walks straight back into the round-1 defect.

**Fix:** merge the two comments, move the surviving rationale onto `recoverEvent`, delete the
`dispatch on the stored adapter column` sentence.

### P3-2 [READABILITY] `:201-215` — rationale attached to the wrong symbol

`isJsonBody` is a one-line predicate carrying a 12-line essay about `PaymentEvent.adapter`
semantics and `STUB_ADAPTERS`. That rationale explains the **dispatch** and belongs on
`recoverEvent` — precisely the slot the stale comment in P3-1 is squatting.

### P3-3 [HYGIENE] name drift: `RecoveredEvent.bodyShape` vs log key `shape`

`:161` declares `bodyShape`; `:397` emits it as `shape:`. Grepping either misses the other —
the same drift class the Mistake Log flags for greppable invariants.

---

## Explicitly checked — NO finding

- **`bank_transfer` and `momo` behaviour is unchanged.** `bank_transfer` takes branch 1
  untouched. `momo`/`zalopay`/`card`/stub fall through to `recoverJsonIpn`, whose body is
  logic-identical to the deleted inline `try/catch` (same `?? 0`, same
  `Number.isFinite && >= 0` guard, same `resultCode ?? -1`). The only new behaviour is
  `vnpay` + non-JSON body. All pre-existing tests pass unmodified.
- **`isJsonBody` cannot misroute a genuine VNPay body.** A VNPay body always begins `vnp_…`.
  Making one begin with `{` requires introducing a `{`-prefixed key, which lands in
  `verifyParams`, changes `buildSignData`, and fails the HMAC. Safe by construction.
- **Empty string / JSON array / leading whitespace all fail closed.** `''` → `non-json` →
  `recoverVnpayEvent('')` → all-null → `'99'` → `unknown` → `{0,false}`. `[…]` → `non-json`
  for vnpay (`{0,false}`), `recoverJsonIpn` for others (parses, no `amount`/`resultCode` →
  `{0,false}`). Leading whitespace is stripped by `trimStart`, and `JSON.parse` tolerates it.
  One cosmetic edge: a BOM-prefixed JSON body is stripped by `trimStart` (U+FEFF is in the
  ECMAScript WhiteSpace set) → classified `json` → but `JSON.parse` rejects a leading BOM →
  `{0,false}` with `shape:'json'`. Missed recovery only, never a wrong payment; folds into
  P2-3.
- **`RecoveredEvent` has no serializing consumer.** The interface is module-local; its only
  cross-boundary appearance is the exported `matchDegraded` signature (whose test fixture was
  correctly updated). Nothing spreads or `JSON.stringify`s a `RecoveredEvent`; the new log
  picks four fields explicitly. No Prisma `select` is involved, so the "`select` whitelist =
  exactly the UI contract fields" rule does not apply.
- **No new logger redaction needed.** `shape` is a closed `'json' | 'non-json'` enum;
  `adapter` / `bookingId` / `paymentEventId` are already logged elsewhere in this file.
  Carrying `bodyShape` instead of `rawBody` is the right call and keeps PII out of logs.
- **The reconcile paid path credits `booking.totalVnd`, not the event amount** (`:447`), so
  even under P1-1 the ledger is not inflated by the attacker's `vnp_Amount`. The loss is the
  full fare of a free ticket, not an arbitrary sum.

---

## Round-1 findings — disposition at `0f43bfb`

| Round-1 finding | Sev (R1) | Status |
|---|---|---|
| Adapter-only dispatch breaks stub-served vnpay rows (the root defect) | P1 | **FIXED**, with a test that genuinely fails against the old code |
| Vacuous `$executeRaw` assertion (`baseBooking()` defaults `holdExpiresAt` null) | P1 | **FIXED** — the fixture now seeds a lapsed hold |
| `recoverVnpayEvent` vs `verifyWebhook` first-wins/last-wins divergence | P2 | **OPEN — escalated to P1-1.** Disclosed in "Not delivered", but with an incorrect reachability rationale |
| Hand-typed sweeper fixture, not adapter-produced | P2 | **OPEN — P2-5. Silently dropped from the PR body** |
| Type-silent swap of two same-signature parser params | P2 | **OPEN — P2-6. Silently dropped from the PR body** |
| `vnp_TmnCode` never validated inbound | P3→ | **OPEN.** Correctly disclosed in "Not delivered". Fine to defer |
| No tick-summary log | — | **OPEN.** Correctly disclosed, scoped to #143. Fine to defer |
| `?? '99'` magic sentinel; `amount > 0` vs `>= 0`; unreachable fallback branch | P3 | **OPEN.** Minor; fold into the P1-1 extraction |

---

```
SUMMARY: 2 P1, 6 P2, 3 P3
```

## RECOMMENDED NEXT STEPS

1. **P1-1 blocks merge.** Unify `recoverVnpayEvent` and `verifyWebhook` on one shared
   param-normaliser, plus a test asserting they agree on a duplicate-key body. Round 1 rated
   this P2 on a reachability assessment that the PoC above disproves.
2. **P1-2** — correct the Rollback paragraph before any squash-merge; open a separate issue
   for the un-gated vnpay webhook route and the default `VNPAY_HASH_SECRET`, after confirming
   the deployed Vercel env.
3. **P2-5 / P2-6** — restore both to the PR body's "Not delivered" list even if not fixed
   here. Silently dropping a carried-forward finding is how it stops being tracked.
4. **P2-1..P2-4** — either give `bodyShape` a discriminating payload (`parsed:boolean`) or
   drop the field and the warn loop with it; whichever, add assertions.
5. **P3s** — delete the stale `dispatch on the stored adapter column` directive in the same
   commit as any of the above.
