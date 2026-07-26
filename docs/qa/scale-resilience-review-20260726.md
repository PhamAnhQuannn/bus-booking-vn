# Scale & Resilience Design Review — Bus-Booking Platform

**Date:** 2026-07-26 · **Scope:** full platform (Next.js 16 / Prisma 7 / PostgreSQL 16 on Neon / Redis on Upstash / Vercel serverless) · **Live rail:** SePay bank transfer (VietQR); VNPay pending
**Method:** 6-analyst panel + red-team debate, synthesized. Every finding below survived adversarial review; confidence labels reflect whether the mechanism was verified in code (CONFIRMED) or inferred (PLAUSIBLE).
**Scale calibration:** Phase 1 today ≈ 200 bookings/day, 1–2 operators. Phase 2 ≈ 1K/day, 10+ operators. Phase 3 ≈ 5K/day, 50+. Every recommendation is tagged **[now]** or **[phase2/3]** — do not over-build Phase 1.

---

## 1. Executive summary

The platform's **correctness core is strong**: seat allocation is provably race-safe, money math is BigInt end-to-end over an immutable ledger, and webhook processing is replay-safe with server-derived prices. The soft spots are **availability and abuse-resistance** — the system assumes well-behaved clients and healthy dependencies, and neither assumption survives contact with growth. Three P1 items need action at Phase-1 scale today: (1) **hold-squatting** — seat holds are gated only by a regex-validated, never-verified phone number, so one attacker from one IP can empty a 45-seat trip in under a minute; (2) an **unguarded Upstash rate-limiter call** in Edge middleware that turns any Upstash blip into a sitewide 500 on every state-changing API request; and (3) the **SePay webhook's static-key authentication**, which makes the entire payment-confirmation payload attacker-controlled the moment one secret leaks. The headline cross-domain finding is the cascade these combine into: because #341 put the bank-transfer webhook behind the rate limiter, *an Upstash hiccup is now a revenue outage* — real transfers go unconfirmed for hours, backstopped only by a 15-minute cron sweeper that competes for the same constrained resources. Fixes for all three are small and surgical; the larger structural work (bounded lock acquisition bundled with the pool-size correction, payout batching, cron observability) belongs before Phase 2, not before Monday.

---

## 2. What's already solid — regression-guard, do not touch

These three subsystems were attacked by the red team and held. Any future PR touching them should trigger heightened review.

- **Seat oversell is race-safe.** `lib/core/db/holdRepo.ts:97` takes a per-trip `pg_advisory_xact_lock`, then performs a **single conditional INSERT** guarded by `capacity − held − booked >= n` in the same statement. There is no read-then-write gap, hence no TOCTOU. Confirmed correct under concurrency analysis. (Its *latency* behavior under load is a separate finding — §4 item 5 — but its correctness is not in question.)
- **Money math is BigInt end-to-end.** `lib/ledger/calcPayout.ts`, `balance.ts`, `refund.ts`, `chargeback.ts` all operate in the BigInt domain per the Issue 016 rule; `LedgerEntry` is append-only, enforced by a DB trigger, not convention.
- **Webhook idempotency and price integrity.** `PaymentEvent` carries `@@unique([adapter, providerTxnId])`, claimed via updateMany-before-insert (`lib/payment/processWebhook.ts:234`) — the P2002-safe pattern from the 2026-07-23 post-mortem. Replays are absorbed; amount and currency are guarded; price is server-derived throughout (I7 invariant intact), so there is **no client price-tampering path**.

---

## 3. The system in evolutionary order

Reading the platform oldest→newest shows how each era's design choice becomes the next era's scale constraint.

### Era 1 — Foundation (kernel, catalog, search, holds)
- **Core kernel** (`lib/core/db/client` — lazy `pg.Pool` singleton; `lib/config/env.ts` boot config): the pool-size **split-brain** lives here — `client.ts:14` reads raw `process.env` and bypasses the validated config (§4 item 6).
- **Catalog / capacityGuard**: hardened to `$transaction` + `FOR UPDATE` per Issue 011; concern is lock-wait time under concurrent operator edits, minor at all phases.
- **Search** (`lib/search` + `app/api/trips/search`): read-heavy, uncached; the first thing that needs a cache layer at Phase 2/3 traffic.
- **Holds** (`holdRepo.ts`) — the first concurrency-critical subsystem: correct (§2) but its **blocking** advisory lock is the platform's worst tail-latency amplifier under viral load (§4 item 5), and its identity gate is the platform's worst abuse surface (§4 item 1).
- **`sweep-holds` cron**: fine today; inherits the shared Neon-connection budget concern (§4 item 9).

### Era 2 — Payments & Ledger
- **`processWebhook.ts`** — a 542-line multi-adapter fan-in; single-file blast radius means any adapter change risks every rail.
- **SePay / `bankTransfer.ts`** — the only live rail; static-key auth (§4 item 3) and memo-parsing fragility (see the `BB-` ref-case saga) concentrate risk on one code path.
- **`reconcilePayments.ts`** — the 15-min sweeper, hardened through three Bug-B rounds; now a reader-only matcher that *holds* rather than pays, but its starvation is indistinguishable from idleness (§4 item 11) and it is the **sole backstop** for missed webhooks.
- **`withAdvisoryLock.ts`** — per-job locks correctly prevent cross-job interference; the real shared resource is the connection pool, not the locks.
- **Ledger (BigInt)** — solid (§2); VNPay sits behind the gateway abstraction awaiting enablement.

### Era 3 — Auth & Accounts
- **`lib/auth`** (OTP + JWT + CSRF): the OTP-jti consume path goes through Redis — its fail-open/closed posture during an Upstash outage is undecided (§4 item 2).
- **Operator auth**: JWT-claim gating in Edge middleware — deliberately DB-free, scales cleanly.
- **`lib/account`** soft-delete + **admin TOTP**: no scale concerns; keep the `deletedAt: null` predicate discipline.

### Era 4 — Operator / Trips / Manifest
- **Trip lifecycle**: status-enum + timestamp writes now atomic (Issue 014 rule); safe.
- **Manual (cash) booking**: shares the advisory lock — operator-facing latency degrades on hot trips exactly when customer traffic spikes; and its **uncapped `awaiting_payment` capacity count** freezes walk-up seats when the sweeper falls behind (Cascade C).
- **`lib/geo` / `lib/places`**: slug backfill is one-shot churn, not a scale risk.

### Era 5 — Admin & Charter
- **Admin console + `AdminAuditLog`** (append-only): sound.
- **`lib/charter`**: a parallel state machine, well-isolated — the right pattern; its NULL-`bookingId` dual-enqueue is safe but a copy-paste landmine (§4 item 14).
- **`lib/onboarding`** (KYB/payout): the platform's **fraud surface** — at 10+ operators, payout-destination changes need review workflow.
- **`lib/einvoice` / MISA**: single vendor, no fallback abstraction (§4 item 12).

### Era 6 — Ops / Cron / Notifications
- **13 crons** behind per-job advisory locks with `JobRunLog` as the *only* cross-job observability — no gap detection, no dead-man's switch.
- **`lib/notification`**: `NotificationLog` idempotent on `(bookingId, template)` — the repo's hottest mistake class (#328); retry pipeline has no dead-letter escalation (§4 item 10).
- **Retention/anonymize crons + logger redact list**: compliance posture is good; keep redact-list discipline on new fields.

### Era 7 — Newest (July hardening wave)
- **#327** orphan-PaymentEvent + admin backlog metric — first real payments observability; nothing *pages* on it yet.
- **#330** VNPay reconcile recovery, **#341** SePay account-check + webhook rate-limit — #341 quietly widened the rate-limiter blast radius to the payment rail (Cascade A).
- **#338–342** email expansion; **#333/#348** barrel/cycle CI guards — architectural erosion is now machine-checked.

---

## 4. Risk register

| Rank | Risk | P | Horizon | Confidence | Analyst convergence |
|---|---|---|---|---|---|
| 1 | Hold-squatting via unverified phones | P1 | **[now]** | CONFIRMED | 4/6 + red-team |
| 2 | Upstash rate-limiter unguarded throw → sitewide 500s | P1 | **[now]** | CONFIRMED | 5/6 |
| 3 | SePay static-key webhook forgery | P1 | **[now]** | CONFIRMED | 3/6 + red-team |
| 4 | Cascade A: Upstash blip → payment outage | P1 | **[now]** | CONFIRMED | debate synthesis |
| 5 | Blocking advisory lock in `createHold` under viral load | P1 | [phase2/3] | CONFIRMED | 4/6 |
| 6 | `DATABASE_POOL_MAX` split-brain (raw env vs Zod default) | P2 | **[now]** | CONFIRMED | 3/6 |
| 7 | `processPayouts` unbounded claim query | P2 | **[now]** | CONFIRMED | 2/6 |
| 8 | Blank-memo collision queue, no SLA/escalation | P2 | **[now]** | CONFIRMED | 3/6 |
| 9 | Neon connection-count exhaustion (crons × instances) | P2 | **[now]**→[phase2] | CONFIRMED | 4/6 (contention myth refuted) |
| 10 | Notification dead-letter gap (customer + ops alerts) | P2 | **[now]** | CONFIRMED | 2/6 |
| 11 | Sweeper starvation masked as idle | P2 | [phase2/3] | CONFIRMED | 2/6 |
| 12 | MISA e-invoice single vendor, no fallback | P2 | [phase2/3] | PLAUSIBLE | 2/6 |
| 13 | Pickup-subsystem churn (tech debt) | P3 | [phase2/3] | CONFIRMED | 1/6 |
| 14 | NotificationLog dual-enqueue copy-paste landmine | P3 | **[now]** (doc only) | CONFIRMED | red-team (false-positive demotion) |

### P1 details

**1 — Hold-squatting [now].** `buyerPhone` is validated by regex only and never OTP-verified (`lib/core/validation/hold.ts:21`). The per-phone cap of 5 (`lib/core/db/holdErrors.ts:8`) is therefore defeated by minting syntactically valid fake phones; the only other gate is the generic 60/min/IP limiter — there is no holds-specific limit. At 60 holds/min, a 45-seat trip is fully squatted from **one IP in under a minute**, and hold TTL renewal-by-recreation makes it sustainable. This is a denial-of-inventory attack against the core product with zero cost to the attacker. **Fix:** per-IP *and* per-session hold caps enforced at `/api/holds` specifically; a dedicated tighter limiter on that route; consider a lightweight challenge or small hold deposit for phase 2. Phone verification is Phase-1-scoped out (no customer auth), so the caps must not assume it.

**2 — Upstash unguarded throw [now].** `UpstashRatelimit.limit()` has no try/catch (`lib/ratelimit/index.ts:108-118`), unlike the ioredis implementation which deliberately fails open (`lib/ratelimit/index.ts:176-208`). `proxy.ts:327` calls it bare in Edge middleware, so any Upstash REST error/timeout throws before routing → **every non-safe `/api/*` request 500s sitewide** — and post-#341 that set includes the bank-transfer webhook (`proxy.ts:82-87`). **Fix:** wrap the Upstash branch identically to ioredis (fail-open for rate limiting). Separately and deliberately decide fail-open vs fail-closed for the OTP-jti `consumeJti` path (replay-safety argues fail-closed there) and document both choices at the call sites.

**3 — SePay static-key forgery [now].** Webhook auth is a constant-time compare against a static `SEPAY_API_KEY` (`app/api/payments/bank_transfer/webhook/route.ts:61`) — no per-request HMAC, no timestamp, no nonce. Once the key leaks (log, proxy, vendor breach), the **entire JSON payload is attacker-controlled**: amount, memo/booking-ref, and accountNumber. #341's account-number check does *not* mitigate this — the forger simply sets `accountNumber` to the correct value — and the 60/min throttle is throughput control, not authentication. **Fix:** adopt HMAC body signatures if SePay supports them (transcribe from vendor docs per the 2026-07-21 rule); otherwise treat the key as a crown-jewel secret (rotation schedule, egress restriction, alert on auth failures) and rely on the amount-match + booking-existence backstop as defense-in-depth, not as the perimeter.

**5 — Blocking advisory lock [phase2/3].** `holdRepo.ts:97` uses `pg_advisory_xact_lock` — the *blocking* form — inside `$transaction`, so every waiter pins a pooled connection for the full queue-wait. A viral trip (2,000 buyers on one trip in a promo window) serializes into a ≈400-second tail: 504s, stuck connections, and cross-request starvation. The pool-size fix makes this **worse per-instance** (Cascade B), which is why they must ship together. **Fix:** bounded acquisition — `pg_try_advisory_xact_lock` with short backoff/retry and a fast "seat map busy, retry" response, or a queue in front of the hot path. This, **not pool tuning**, is the real fix.

### P2 details

**6 — Pool split-brain [now].** `lib/core/db/client.ts:14` reads `process.env.DATABASE_POOL_MAX || 5`, bypassing the Zod-validated default of 1 (`lib/config/env.ts:303`) — prod silently runs at 5. `||1` is architecturally correct for Neon (total connections = instances × pool_max, and Neon's pooler multiplexes), so #301's change is a fix, **but land it bundled with item 5**: at pool=1, a request stuck in the lock wait holds the instance's *only* connection. Read the validated config, set 1, ship both together.

**7 — Unbounded payout claim [now].** `lib/jobs/processPayouts.ts:47` issues `SELECT ... FOR UPDATE SKIP LOCKED` with **no LIMIT**, unlike reconcile's `CLAIM_LIMIT=200`. A completion spike (holiday weekend, T+3 alignment) dues hundreds of payouts into one long transaction — long lock hold, big tx, timeout risk. **Fix:** mirror the CLAIM_LIMIT batch pattern; it is a one-line-plus-loop change.

**8 — Blank-memo collision queue [now].** One shared receiving account means same-fare/blank-memo transfers are inherently ambiguous. `matchDegraded` now correctly refuses to auto-pay and holds for 24h max (`lib/jobs/reconcilePayments.ts:115`) — the right call — but the resulting manual-review queue has **no severity or escalation**. At Phase-2 volume this is near-daily; an unworked queue silently becomes expired bookings with money on file. **Fix:** age-based severity on the #327 backlog metric + an alert when any suspected-hold crosses ~12h.

**9 — Neon connection count [now→phase2].** 13 crons (four sharing near-identical `vercel.json` schedules) plus web lambdas each open their own pool against Neon's connection ceiling. The debate **refuted** the cross-job lock-contention theory — per-job advisory locks mean jobs don't block each other — but raw connection *count* is real. **Fix:** stagger the co-scheduled crons now; verify pooled (PgBouncer-mode) connection strings everywhere before Phase 2.

**10 — Dead-letter gap [now].** Customer confirmations and the ops unmatched-payment alert share one dispatch pipeline; after `MAX_ATTEMPTS=5` (~70 min of backoff) both go permanently `failed` (`lib/jobs/dispatchNotifications.ts:43`). #327 surfaces dead-vs-retrying counts, but **nothing pages** — a Resend outage silently kills the very alert that reports payment problems. **Fix:** on final failure of ops-alert templates, escalate through an independent channel (even a plain SMTP fallback or logged CRITICAL that external monitoring watches).

**11 — Sweeper starvation [phase2/3].** `ORDER BY createdAt ASC LIMIT 200` means a full page of held/suspected rows starves newer bookings, and the file's own comment concedes `rowsAffected:0` is identical whether the tick was idle or fully starved (`lib/jobs/reconcilePayments.ts:90`). **Fix:** emit candidate-count vs processed-count per tick; alert on `candidates=200, progressed=0`.

**12 — MISA single vendor [phase2/3].** E-invoicing has no adapter abstraction (contrast `lib/payment/gateway.ts`). A MISA outage or contract change blocks invoice issuance with no fallback. Acceptable at Phase 1; abstract before Phase 3 compliance volume.

**14 — Dual-enqueue landmine [now, documentation only].** The charter path's two same-template enqueues are a **false positive** — charter rows carry NULL `bookingId`, and NULL is distinct under the unique index, so no collision. But any engineer copying that pattern onto a Booking-linked path reproduces #328 exactly: P2002 inside `$transaction` → whole-tx abort → sweep/webhook failure. Add a comment at the charter enqueue site naming the constraint boundary.

---

## 5. Cross-domain cascades

The debate's highest-value output: three failure chains no single-domain analysis surfaced.

### Cascade A — an Upstash blip becomes a payment outage
Upstash REST hiccup → `ratelimit.limit()` throws (`lib/ratelimit/index.ts:110`) → uncaught in `proxy.ts:327` → **every** non-safe `/api/*` request 500s. Post-#341, the bank-transfer webhook is no longer exempt (`proxy.ts:82-87`), so SePay deliveries 500 too → SePay marks them failed and retries on Fibonacci backoff over ~5 hours → real customer money sits unconfirmed until the 15-minute reconcile sweeper degrade-matches it. The sweeper is the *only* backstop — and it is a cron competing for the same Neon connections (Cascade C). Bank transfer is the only live rail, so this is not "a 500 storm"; it is a **revenue outage triggered by a third-party cache blip**. The fix is item 2: one try/catch.

### Cascade B — the pool fix sharpens the lock blast radius
At today's (accidental) pool=5, an instance blocked on a hot-trip advisory lock still has 4 connections to serve other requests. At pool=1 — the *correct* Neon value #301 introduces — that instance's **single** connection is the one parked in the lock wait, so the whole warm instance serves zero requests until `connectionTimeoutMillis` fires. The right fix for the aggregate connection storm (item 6) makes the per-instance blast radius strictly worse — which is exactly why item 5 (bounded lock acquisition) must ship **in the same release** as the pool change, never after it.

### Cascade C — the sweeper competes for the pool it exists to unblock
Neon connection pressure (crons × instances, amplified by Cascade A's backlog of unconfirmed bookings driving retry traffic) → the reconcile cron itself queues or times out acquiring a connection → its tick slips → stuck bank-transfer bookings age past the 24h suspicion bound and expire through the normal guarded branch — while `createCashBooking`'s **uncapped** `awaiting_payment` capacity count has already frozen walk-up seats for hours. The backstop is starved precisely when it is most needed. Mitigations: items 9 and 11, plus a time bound on `awaiting_payment` rows counted against capacity.

---

## 6. Recommendations, sequenced

### [now] — do before anything else
1. **Wrap the Upstash limiter** in try/catch, fail-open for rate limiting; decide and document fail-open/closed for `consumeJti` (`lib/ratelimit/index.ts:108-118`, `proxy.ts:327`). *Smallest fix, largest blast radius removed.*
2. **Holds abuse controls**: per-IP + per-session hold caps and a dedicated limiter on `/api/holds` (`lib/core/validation/hold.ts:21`, `holdErrors.ts:8`).
3. **SePay key hardening**: pursue HMAC with the vendor; meanwhile rotation schedule + auth-failure alerting on `route.ts:61`.
4. **Ship #301's pool change (`||1`, read from validated config) bundled with bounded lock acquisition** in `holdRepo.ts:97` — one release, never split (Cascade B).
5. Cheap wins while in the area: `CLAIM_LIMIT` on `processPayouts.ts:47`; age-escalation on the unmatched-payment backlog; dead-letter escalation for ops-alert templates; the charter dual-enqueue comment.

### [phase2/3] — before scaling
- Payout batching load-tested at spike volume; cron **dead-man's-switch** + `JobRunLog` gap alerting (a missed tick must page, not vanish).
- Sweeper backlog monitor distinguishing idle from starved (`reconcilePayments.ts:90`).
- Verify Neon pooled connection strings on every cron and lambda; stagger co-scheduled crons.
- Resend dead-letter queue with independent escalation channel.
- Revisit per-IP hold economics (deposit/challenge) once customer auth lands.
- MISA adapter abstraction mirroring `lib/payment/gateway.ts`.

**Load-test gap:** ADR-002 itself admits no load test has ever been run (`documentation/architecture-decisions/ADR-002-nfr-targets/README.md:290`). Before Phase 2, run a k6/artillery pass on the three hot paths — search, hold creation (one hot trip), and webhook ingestion — to convert this review's tail-latency estimates into measured numbers.
