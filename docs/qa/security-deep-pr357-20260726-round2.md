# SECURITY-DEEP REVIEW — PR #357 "fix(payments): reconcile sweeper recovers VNPay transfers (#330)"

**Round 2** — re-review after review-driven fix commit `0f43bfb`.
Round 1 (`bce2a60b`) preserved at `docs/qa/security-deep-pr357-20260726.md`.

```
PR:        https://github.com/<owner>/Bus-Booking/pull/357
Base/Head: master ← fix/vnpay-recover-330 @ 0f43bfb4
State:     OPEN
Generated: 2026-07-26
Method:    gh pr diff + detached worktree at 0f43bfb (main tree never checked out);
           findings below marked [PoC] were executed, not reasoned about.
```

```
Findings: 5  (P1: 1 · P2: 3 · P3: 1)
```

---

## P1 — BLOCKING

### `lib/payment/adapters/vnpay.ts:249-257` 🚫 P1: signature-verification / parser differential — the HMAC does not cover what the sweeper later trusts

**Class:** parser differential over a signed message (same family as JWT `alg` confusion, XML
signature wrapping, HTTP request smuggling). **Impact:** free tickets — an unpaid booking is
transitioned to `paid` with an operator ledger credit.

`verifyWebhook` does not authenticate the raw bytes. It authenticates a **normalised
projection** of them:

```ts
// lib/payment/adapters/vnpay.ts:102-106  — LAST value wins on a duplicate key
const parsed: Record<string, string> = {};
for (const [key, value] of new URLSearchParams(rawBody).entries()) parsed[key] = value;
// …then buildSignData(verifyParams) is computed over THAT deduplicated record.
```

`processWebhook.ts` then persists the **raw, un-normalised bytes** (`rawBody, // stored for
audit`), and this PR adds a **second, differently-normalising reader** of those bytes:

```ts
// lib/payment/adapters/vnpay.ts:250-252  — FIRST value wins on a duplicate key
const parsed = new URLSearchParams(rawBody);
const transactionStatus = parsed.get('vnp_TransactionStatus');
const amount = Math.floor(Number(parsed.get('vnp_Amount') ?? 0) / 100);
```

Because the signature is computed over the *deduplicated* record, **prepending duplicate keys
does not invalidate it.** The adapter's own doc comment states the assumption that fails here:
*"We do NOT re-verify the HMAC: the row only exists because verifyWebhook already passed at
ingest."* True — but `verifyWebhook` passed on a *different reading* of the same row.

#### [PoC] executed at `0f43bfb`

```
genuine signed body
  verifyWebhook      → ok, status 'pending', amount 150000
  recoverVnpayEvent  → { amount: 0, success: false }                 ✓ agree

"vnp_TransactionStatus=00&vnp_Amount=99999900&" + that same signed body
  verifyWebhook      → ok, status 'pending', amount 150000   ← SIGNATURE STILL VALID
  recoverVnpayEvent  → { amount: 999999, success: true }             ✗ DIVERGE
```

#### Full kill chain — every link verified in-repo

| # | Step | Evidence |
|---|---|---|
| 1 | Attacker obtains a validly-signed `vnp_*` param set **for their own booking** | `app/api/payments/vnpay/return/route.ts` — VNPay redirects the **customer's browser** to the return URL with all `vnp_*` params *including `vnp_SecureHash`*. Harvested from the address bar. No interception required. |
| 2 | Attacker POSTs the poisoned body to the IPN receiver | `/api/payments/vnpay/webhook` is in **both** `CSRF_EXEMPT` and `RATELIMIT_EXEMPT` (`proxy.ts:70-87`) — unauthenticated **and** unthrottled. The only gate is the HMAC, which the poisoned body passes. |
| 3 | Ingest accepts it but leaves the booking payable | `classifyVnpayStatus` puts `vnp_TransactionStatus='02'` in `VNPAY_PENDING_CODES` (`vnpay.ts:39`) → canonical `pending` → `processWebhook` takes the `pending` arm: **no status transition**. Booking stays `awaiting_payment`. (`02` is VNPay's ordinary "transaction failed" status — the *expected* outcome after a declined payment.) |
| 4 | The poisoned bytes are persisted **linked to the booking** | `processWebhook.ts` inserts the `PaymentEvent` *before* the status branch, with `bookingId = booking.id` and `rawBody` verbatim. |
| 5 | The sweeper honours the attacker's injected values | After `RECONCILE_THRESHOLD_MINUTES`: `recoverEvent` → `adapter==='vnpay'` + non-JSON → `recoverVnpayEvent` → `{success:true, amount:999999}` → `isConfirming` true → `applyPaidStatusTransition` → **paid** + `appendBookingPaidLedger`. |

**Net:** a customer whose VNPay payment failed can mark their own booking `paid` without
paying, by replaying their own signed return params with two prepended keys and waiting one
sweeper tick (~15 min).

#### This diff is what arms it

On `master` the vnpay branch went through `JSON.parse`, which throws on a urlencoded body →
`{0,false}`. The divergence existed but was **unreachable**. `0f43bfb` removes the thing that
was neutralising it.

That is the CLAUDE.md **2026-07-23** rule verbatim — *"a migration that WIDENS a constraint is
not automatically safe — grep for code gated on the old constraint making something impossible
… and review each as new code, because that is exactly what it becomes."* Here the "constraint"
was `JSON.parse` throwing. It is also the **2026-07-24 Bug B round 3** meta-rule: *"fixing a
review finding is itself a change that can introduce a worse one."*

#### Severity note — round 1 under-rated this, and the PR body inherited the error

Round 1 filed it P2 on the rationale *"it requires VNPay itself to emit duplicate `vnp_*`
keys."* The PoC disproves that. The PR body's "Not delivered" section correspondingly states
*"HMAC mitigates it here, so it is not urgent"* — **inverted**: HMAC is precisely what does not
mitigate a body engineered to pass HMAC.

#### Fixes, in order of strength

1. **Best (kills the class).** Stop re-deriving money facts from `rawBody`. The verified
   `CanonicalPaymentEvent` already carries `{amount, currency, status}`; persist them as
   `PaymentEvent` columns and have the sweeper read the columns. `reconcilePayments.ts:169-170`
   already names this as the root cause — *"The PaymentEvent table stores neither amount nor
   status as columns, so we read them from the persisted body."* That single schema gap is the
   common ancestor of Bug B (#324), #330, and this finding.
2. **Sufficient for this PR.** Export one `parseVnpayParams(rawBody)` from the adapter and have
   **both** `verifyWebhook` and `recoverVnpayEvent` consume it — one duplicate-key policy, one
   reading. Add a test asserting the two agree on a duplicate-key body.
3. **Belt-and-braces.** Reject any body carrying a duplicated `vnp_*` key; VNPay never sends
   one. Canonicalise-then-verify is the standard remedy for signature/parser differentials.

---

## P2 — SHOULD FIX

### `lib/payment/adapters/vnpay.ts:249` ⚠️ P2: recovery path re-parses network-origin data with no integrity re-check

Independently of the duplicate-key bug, this PR introduces a **new parser of attacker-influenceable
persisted data that feeds a money decision**, and deliberately skips signature verification on
it. The stated justification ("verifyWebhook already passed at ingest") is a *temporal* argument
that only holds if the stored bytes have exactly one reading — which P1 shows they do not.

Even after the P1 fix, `PaymentEvent.rawBody` remains a mutable-in-principle blob trusted for
`paid` transitions. Anything with write access to that column (a future admin tool, a restore
from a tampered backup, a SQL-injection elsewhere) escalates directly to "mint a paid booking."
Fix 1 under P1 closes this too.

### `proxy.ts:82-87` ⚠️ P2: the rate-limit exemption's stated premise is weaker than assumed

`RATELIMIT_EXEMPT` comments that only *"HMAC-body-verified PSP webhooks"* skip the edge
rate-limit — i.e. HMAC is treated as an adequate substitute for throttling. P1 shows the HMAC
does not constrain the semantics the downstream consumer reads. Combined with the unthrottled,
unauthenticated endpoint, an attacker can also mint unbounded `PaymentEvent` rows (one per
distinct `vnp_TransactionNo`) as a storage/noise amplifier.

**Not introduced by this diff** — recorded because this diff is what converts the exemption
from "low consequence" to "money path." Re-evaluate the exemption when P1 is fixed.

### PR body "Rollback" ⚠️ P2: the blast-radius claim is false, in the dangerous direction

> *"`VNPAY_ENABLED` is `false` in production today, so the live blast radius is stub/preview
> environments only."*

`app/api/payments/vnpay/webhook/route.ts` calls **`getVnpayAdapter()` directly**, not
`getGatewayFor('vnpay')`. The `VNPAY_ENABLED` kill-switch (`lib/payment/select.ts:46`) gates
only **outbound gateway selection** — it never gates the **inbound IPN route**. The webhook is
live in production, so vnpay `PaymentEvent` rows can be created in production, so **P1 is a
production exposure**.

On a squash-merge this paragraph becomes the permanent `master` commit message — the exact
failure the CLAUDE.md 2026-07-24 entry records. Fix the paragraph before merge.

---

## P3 — ADVISORY (pre-existing, out of scope, file separately)

### `lib/config/env.ts:78-81` + `:419` ℹ️ P3→ potentially P1: default `VNPAY_HASH_SECRET` may be live in production

`VNPAY_HASH_SECRET` defaults to the literal `'VNPAYSECRETTEST0123456789ABCDEF01'`, and the
`superRefine` real-credential gate only fires `if (env.VNPAY_ENABLED)` (`:419`). Since the
webhook route is *not* gated by `VNPAY_ENABLED` (see P2 above), production can be running an
open IPN receiver validating signatures against a constant published in this repository — under
which an attacker needs no parser trick at all, just a self-signed `paid` IPN naming any
booking ref they hold.

`.env.production.local` sets `VNPAY_ENABLED` and **no other `VNPAY_*` var**. That file is *not
authoritative for a Vercel deploy* — **this must be confirmed against the deployed Vercel
project env before drawing any conclusion.** Do not fold into this PR; it needs its own issue
and, if confirmed, a secret rotation.

---

## Clean categories (recorded so round 3 does not re-walk them)

| Cat | Result |
|---|---|
| **1 — Crypto correctness** | No new cipher/hash/KDF/RNG in the diff. No `createCipher`, no static IV, no `Math.random()` for secrets, no weak digest. The one crypto-adjacent issue is the **verification-scope** problem in P1, not a primitive misuse. |
| **2 — Threat-model delta** | No new route, handler, upload path, redirect, `eval`, or raw-SQL interpolation. The **only** new attack surface is the stored-`rawBody` → money-decision path (P1). |
| **4 — Audit-log emission** | No new mutation handler. The diff *adds* a log line; it removes none. `reconcile.booking_paid` / `booking_expired` / `unmatched_payment_*` all intact. |
| **5 — Authz surface** | No new endpoints, no changed guards. `recoverVnpayEvent` is added to the `lib/payment` server barrel, which already exports `processPaymentWebhook` (`import 'server-only'`); `adapters/vnpay` was already reachable through `getVnpayAdapter`. No new client-bundle exposure, no `'use client'` barrel-import hazard. |
| **6 — Privacy / PII** | **Clean, and actively good.** The diff carries `bodyShape: 'json' \| 'non-json'` on `RecoveredEvent` *specifically to avoid* putting `rawBody` in a log line. Logged fields are `bookingId`, `paymentEventId`, `adapter`, `shape` — all non-PII and all already logged elsewhere in the file. No logger redact-list change needed. (Whether `bodyShape` is *useful* is an observability question, not a security one — see `docs/qa/obs-pr357-20260726-round2.md`.) |

---

## MONEY-PATH ASSESSMENT

**Can this diff cause a payment that should not happen? Yes — via P1.**

Everything else on the money path checks out and should be recorded as verified:

- `isConfirming` (`:247-249`) is unchanged and still requires `success && currency === 'VND' && amount >= totalVnd`.
- Only **linked** events can pay (`linked.find(...)`, `:381`); an orphan is still never promoted
  to a confirmation. The degraded matcher remains suspicion-only.
- The paid path credits `booking.totalVnd`, **not** the event amount (`:447`) — so even under P1
  the ledger is not inflated by the attacker's `vnp_Amount`. The loss is one free fare per
  exploited booking, not an arbitrary sum.
- `bank_transfer` and `momo`/`zalopay`/`card`/stub recovery semantics are byte-for-byte
  unchanged; `recoverJsonIpn` is a faithful extraction of the previous inline block.
- The `PAYMENTS_STUB` regression that round 1 caught (adapter-only dispatch terminally expiring
  stub-served vnpay rows) is genuinely fixed and genuinely guarded — reverting the
  `&& !isJsonBody(...)` clause makes the new test fail, and only that test.

So: the diff fixes a **missed-recovery** bug correctly, and in doing so opens a **wrong-payment**
path. Per the PR's own stated risk ordering — *"the failure mode is a missed recovery, never a
wrong payment"* — that invariant no longer holds at `0f43bfb`.

---

## RECOMMENDED NEXT

- **Do not merge** until P1 is fixed. Preferred remedy is the schema fix (persist verified
  `amount`/`status` as `PaymentEvent` columns), which retires this entire bug family; the
  shared-parser fix is acceptable for this PR.
- Add the duplicate-key agreement test — without it the class recurs on the next adapter.
- Correct the PR body's Rollback paragraph before any squash-merge.
- File the un-gated vnpay webhook route + default `VNPAY_HASH_SECRET` as a **separate P1
  investigation**, starting with the deployed Vercel env.

```
SUMMARY: 1 P1 · 3 P2 · 1 P3 · pinned to 0f43bfb4
```
