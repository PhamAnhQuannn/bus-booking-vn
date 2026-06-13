# Launch Checklist — Bus-Booking SaaS
Generated: 2026-06-13
Sources: 24 review documents from 2026-06-12 (two sweeps)

---

## Executive Summary

| Tier | Count | Gate |
|------|-------|------|
| **BLOCKER** | 24 items | Must fix before real money flows (Issue 094) |
| **LAUNCH** | 32 items | Must fix before public announcement / marketing |
| **POST-LAUNCH** | 28 items | Ship with these; fix within 30 days |
| **Total open findings** | 84 | Across 24 review documents + grill-me self-assessment |

**Estimated effort summary:**
- BLOCKER: ~XL (4–5 engineer-weeks)
- LAUNCH: ~L (2–3 engineer-weeks)
- POST-LAUNCH: ~M (1–2 engineer-weeks)

---

## BLOCKER — Must Fix Before Real Money Flows
> These items gate **Issue 094 (go-live with real payment keys)**. No real payment credentials, real eSMS keys, or real bank-payout keys should be set until every BLOCKER is resolved.

| # | Finding | Severity | Source Docs | Effort | Status |
|---|---------|----------|-------------|--------|--------|
| B-01 | `tempPasswordPlain` stored in cleartext DB column | P0 | pii-inventory, security-review, backcompat-review, migration-safety, issues/113 | M | open |
| B-02 | CRON_SECRET fails-open — all 11 cron endpoints unauthenticated when env var unset | P0 | security-review, code-review, cron-correctness | S | open |
| B-03 | Financial FK delete behavior drifted to SET NULL in last migration | P0 | migration-safety | S | open |
| B-04 | Unsafe `Number()` on webhook amounts allows `Infinity`/`NaN` to bypass payment checks | P1 | code-review | S | open |
| B-05 | Missing `departedAt` guard in `completeTripCore` allows premature payout trigger | P1 | code-review | S | open |
| B-06 | Refund failures during trip cancellation silently orphaned — no retry mechanism | P1 | code-review | M | open |
| B-07 | `sendReminders` performs SMS network I/O inside DB advisory-lock transaction | P1 | cron-correctness, notification-reliability | M | open |
| B-08 | Charter/operator-status/payout SMS payloads stored as raw JSON, not rendered text | P1 | notification-reliability | M | open |
| B-09 | Three direct-send paths bypass outbox; retry re-sends garbled JSON body | P1 | notification-reliability | M | open |
| B-10 | Charter TOCTOU ownership gap — operator can accept a charter reassigned concurrently | P1 | charter-lifecycle | M | open |
| B-11 | `claimCharter` post-commit notifications not wrapped in try/catch — 500 on successful claim | P1 | charter-lifecycle | S | open |
| B-12 | Charter sweeper leaves row stranded in EXPIRED state if second transition throws | P1 | charter-lifecycle | S | open |
| B-13 | `autoCloseSales` cron runs unbounded UPDATE — no LIMIT on batch | P1 | cron-correctness | S | open |
| B-14 | `autoCompleteTrips` cron claims unlimited rows — risk of Vercel function timeout under load | P1 | cron-correctness | S | open |
| B-15 | Charter sweeper `notifyReturned` not wrapped in try/catch — single DB error aborts entire tick | P1 | charter-lifecycle | S | open |
| B-16 | `(tx as any).paymentEvent.create` cast in `processWebhook.ts` masks missing model type | P2 | type-safety | S | open |
| B-17 | No DPA with any sub-processor (MoMo, eSMS, Upstash, Vercel) — PDPL non-compliant | P0 | pii-inventory | L | open |
| B-18 | `sendEmail` always stubs regardless of `NOTIFY_STUB` flag — real email never sends | P2 | notification-reliability | M | open |
| B-19 | `ticketReady` missing from `EmailTemplate` union and SUBJECTS map — email subject wrong | P2 | notification-reliability | S | open |
| B-20 | `charterDeclined` email sent to literal `'ops'` string, not a real address | P2 | notification-reliability | S | open |
| B-21 | `lib/auth/totpDisabled.ts` TEMPORARY bypass must be removed before go-live | P2 | debt-scan | S | open |
| B-22 | Real PSP refund API not wired (`lib/payment/refund.ts` returns stub) | P2 | debt-scan | L | open |
| B-23 | DB connection pooling: production skips singleton, no pool max, cold-start exhaustion risk | P1 | grill-me | S | open |
| B-24 | `JWT_SECRET` + `DATABASE_URL` not in Zod env schema — forgeable tokens if unset | P0 | grill-me | S | open |

---

### B-01: Remove or Encrypt `tempPasswordPlain`
**What:** `OperatorUser.tempPasswordPlain` stores the admin-generated operator password in plaintext in the PostgreSQL database. Column was added in migration `20260612063249_add_temp_password_plain`.
**Why it blocks:** Plaintext passwords in a production database are a critical security defect. A DB breach exposes every operator account credential.
**Fix:** Execute Issue 113 Option A: drop the column, remove all write sites in `lib/admin/createOperatorAccount.ts`, `app/api/op/auth/password/change/route.ts`, `app/api/op/auth/forgot-password/reset/route.ts`; remove all read sites in `lib/admin/getOperatorDetail.ts`, `app/admin/(console)/operators/[id]/page.tsx`, `CreateAccountAction.tsx`. Wire real email delivery so operators receive credentials via email. Alternatively Option B: encrypt at rest with AES-256-GCM key.
**Files:** `lib/admin/createOperatorAccount.ts`, `lib/admin/getOperatorDetail.ts`, `app/api/op/auth/password/change/route.ts`, `app/api/op/auth/forgot-password/reset/route.ts`, `app/admin/(console)/operators/[id]/page.tsx`, `CreateAccountAction.tsx`, migration file
**Sources:** pii-inventory-20260612, security-review-full-20260612, backcompat-review-20260612, migration-safety-audit-20260612, issues/113-remove-temp-password-plain

---

### B-02: Fix CRON_SECRET Failing-Open Authentication
**What:** All 11 `/api/cron/*` route handlers use `if (cronSecret && authHeader !== ...)` — when `CRON_SECRET` env var is unset, the entire auth block is skipped and the endpoint executes with no authentication. `CRON_SECRET` is not in the Zod env schema; no startup validation exists.
**Why it blocks:** An attacker or misconfiguration can trigger financial cron jobs (process-payouts, reconcile-payments, complete-trips) without credentials, causing unauthorized payouts or data deletion.
**Fix:** Change all 11 handlers from `if (cronSecret && ...)` to `if (!cronSecret || authHeader !== ...)`. Add `CRON_SECRET: z.string().min(16)` to `lib/config/env.ts` so startup fails if missing. Update the unit test in `process-payouts/__tests__/route.test.ts` that explicitly asserts the failing-open behavior. Consider extracting a `cronRoute()` HOF.
**Files:** All files in `app/api/cron/*/route.ts`, `lib/config/env.ts`
**Sources:** security-review-full-20260612, code-review-full-20260612, cron-correctness-20260612

---

### B-03: Revert Financial FK Delete Behavior to RESTRICT
**What:** The migration `20260612063249_add_temp_password_plain` silently changed `ON DELETE RESTRICT → ON DELETE SET NULL` for three financial FKs: `LedgerEntry.bookingId`, `Payout.tripId`, `FeeConfig.operatorId`. Deleting a Booking/Trip/Operator now orphans ledger entries instead of blocking the delete.
**Why it blocks:** Violates ledger I7 causality invariant. Orphaned ledger entries can corrupt operator balance calculations.
**Fix:** Author new migration `20260613_revert_financial_fk_restrict` with three ALTER TABLE statements reverting to `ON DELETE RESTRICT ON UPDATE CASCADE`. See migration-safety-audit for exact SQL.
**Files:** New migration file in `prisma/migrations/`
**Sources:** migration-safety-audit-20260612

---

### B-04: Guard Against `Infinity`/`NaN` Amount in Payment Webhooks
**What:** `lib/payment/adapters/momo.ts:128` and `lib/jobs/reconcilePayments.ts:133` both use `Number(parsed.amount ?? 0)`. If MoMo sends `"amount": "1e400"` → `Infinity`; `"amount": "abc"` → `NaN`. Both bypass the underpayment check (`Infinity` is not `< totalVnd`).
**Why it blocks:** A malformed IPN could mark a booking as paid without valid amount. Financial integrity failure.
**Fix:** Add `if (!Number.isFinite(amount) || amount < 0) return { ok: false, reason: 'invalid_amount' }` before any comparison in both files.
**Files:** `lib/payment/adapters/momo.ts:128`, `lib/jobs/reconcilePayments.ts:133`
**Sources:** code-review-full-20260612

---

### B-05: Add `departedAt` Validation to `completeTripCore`
**What:** `lib/trips/completeTripCore.ts:65-90` fetches the locked Trip row but never checks `departedAt`. The manual `markCompleted` path can skip the `departed` state entirely, triggering the payout pipeline for a trip still in progress.
**Why it blocks:** Premature payout pipeline execution for non-departed trips.
**Fix:** Add guard after FOR UPDATE lock: `if (!row.departedAt) throw new TripServiceError('trip_not_departed')`.
**Files:** `lib/trips/completeTripCore.ts`
**Sources:** code-review-full-20260612

---

### B-06: Handle Refund Failures During Trip Cancellation
**What:** `lib/trips/cancelTrip.ts:219-233` logs refund failures but provides no retry, escalation, or manual-reconciliation flag. A `trip_cancelled` booking with a failed `refundOut()` is left in an orphaned state — customer loses money with no automated recovery.
**Why it blocks:** Silent money loss for customers when cancellation refunds fail.
**Fix:** Return partial-refund failure in the discriminated result so the route can surface it. Flag the booking for manual reconciliation review, or enqueue a retry job.
**Files:** `lib/trips/cancelTrip.ts`
**Sources:** code-review-full-20260612

---

### B-07: Move `sendReminders` SMS Call Outside Advisory-Lock Transaction
**What:** `lib/jobs/sendReminders.ts` calls `sendSms(...)` inside the `prisma.$transaction` callback that holds the DB advisory lock. Currently safe with the stub, but when real eSMS HTTP replaces the stub, each HTTP call (up to 10s timeout) holds the Postgres connection, causing pool exhaustion.
**Why it blocks:** When `NOTIFY_STUB=false`, real eSMS calls inside the lock will cause connection pool exhaustion and cascading 500s across the API.
**Fix:** Implement claim-then-dispatch: set `reminderSentAt = now()` inside the tx (claim only), then send SMS and write NotificationLog outside the tx.
**Files:** `lib/jobs/sendReminders.ts`
**Sources:** cron-correctness-20260612, notification-reliability-20260612

---

### B-08: Pre-Render SMS Bodies for Charter/Operator-Status/Payout Notifications
**What:** Charter, operator-status, and payout notification rows store raw JSON in `NotificationLog.payload` (`{"ref":"CH-...","contactName":"..."}`). When the dispatcher calls `sendSmsBody`, it passes this JSON object string as the SMS body — eSMS will deliver `{"ref":"..."}` as the message text.
**Why it blocks:** Real eSMS will send garbled JSON as SMS messages to customers and operators when `NOTIFY_STUB=false`.
**Fix:** Call `renderTemplate(template, payload)` before storing in `NotificationLog.payload` for SMS channel rows. Add charter templates to the `SmsTemplate` union and `renderTemplate` switch statement.
**Files:** `lib/charter/createCharterRequest.ts`, `lib/charter/claimCharter.ts`, `lib/charter/charterStatus.ts`, notification template files
**Sources:** notification-reliability-20260612

---

### B-09: Fix Direct-Send Paths to Prevent Garbled Retry Content
**What:** Three direct-send paths (`lib/admin/createOperator.ts`, `lib/admin/resetOperatorAdminPassword.ts`, `lib/staff/createStaff.ts`) bypass the outbox, writing `status='failed'` rows that the dispatcher will retry by sending the raw JSON payload as SMS body.
**Why it blocks:** Failed temp-password SMS retried by dispatcher sends garbled JSON to operators.
**Fix:** Either (a) write as `status='pending'` with pre-rendered body so dispatcher retries correctly, or (b) write with `attemptCount = MAX_ATTEMPTS` so dispatcher permanently excludes these rows from retry.
**Files:** `lib/admin/createOperator.ts`, `lib/admin/resetOperatorAdminPassword.ts`, `lib/staff/createStaff.ts`
**Sources:** notification-reliability-20260612

---

### B-10: Fix Charter TOCTOU Ownership Gap in Accept/Decline Routes
**What:** `app/api/op/charter/[id]/accept/route.ts` and `decline/route.ts` perform a plain `findUnique` ownership check (no lock) then call `transitionCharterRequest` (which takes its own FOR UPDATE). An admin can reassign between these two reads, allowing Operator A to accept a charter meant for Operator B.
**Why it blocks:** Cross-operator charter acceptance — an operator can accept (and profit from) a lead they do not own.
**Fix:** Move `assigneeOperatorId === operatorId` check inside the `$transaction` after the FOR UPDATE lock is held. Add `requiredAssigneeOperatorId` parameter to `transitionCharterRequest`.
**Files:** `app/api/op/charter/[id]/accept/route.ts`, `app/api/op/charter/[id]/decline/route.ts`, `lib/charter/charterStatus.ts`
**Sources:** charter-lifecycle-20260612

---

### B-11: Wrap `claimCharter` Post-Commit Notifications in try/catch
**What:** `lib/charter/claimCharter.ts:157-196` issues four sequential `createNotificationLog` calls without try/catch. A DB error on call 2 causes a 500 response to the winning operator even though the claim already committed.
**Why it blocks:** Operator sees 500 on a successful claim and may retry (getting a confusing "already claimed" response). Customer may receive only partial notifications.
**Fix:** Wrap each `createNotificationLog` call in individual try/catch with `logger.warn`. Mirror the `declineCharter` pattern.
**Files:** `lib/charter/claimCharter.ts`
**Sources:** charter-lifecycle-20260612

---

### B-12: Prevent Charter Stranding in EXPIRED State
**What:** `lib/jobs/charterExpirySweeper.ts:154-163`: if the EXPIRED → ADMIN_REVIEW second-step transition throws a non-`illegal_transition` error, the row is stranded in EXPIRED permanently with no recovery mechanism.
**Why it blocks:** Charter leads can be permanently lost, never routed to admin review, customer never notified.
**Fix:** Wrap the second-step transition in a try/catch that logs a critical alert. Expand the sweeper's candidate query to also reclaim rows stuck in EXPIRED state directly.
**Files:** `lib/jobs/charterExpirySweeper.ts`
**Sources:** charter-lifecycle-20260612

---

### B-13: Add LIMIT to `autoCloseSales` Batch
**What:** `lib/jobs/autoCloseSales.ts:14-27` runs an unbounded UPDATE with no LIMIT. Under a large backlog (clock drift, outage recovery), this can hold the advisory lock for many seconds and hit Vercel function timeouts.
**Why it blocks:** Under load, a single cron tick can stall the entire sales-closing pipeline.
**Fix:** Adopt the CTE+RETURNING pattern from `expireHolds`: `WITH due AS (SELECT id FROM "Trip" WHERE ... LIMIT 500 FOR UPDATE SKIP LOCKED) UPDATE "Trip" SET ... WHERE id IN (SELECT id FROM due)`.
**Files:** `lib/jobs/autoCloseSales.ts`
**Sources:** cron-correctness-20260612

---

### B-14: Add LIMIT to `autoCompleteTrips` Claim Query
**What:** `lib/jobs/autoCompleteTrips.ts:22-31` claims ALL departed-past-duration trips with no LIMIT, then loops calling `completeTripCore` for each (N × ~5 DB round-trips inside the advisory lock).
**Why it blocks:** Under load (after deployment outage with 50+ trips queued), transaction can exceed Vercel's 10–30s function timeout, leaving payout pipeline stuck.
**Fix:** Add `LIMIT 50` to the claim query. Subsequent cron ticks pick up the remainder.
**Files:** `lib/jobs/autoCompleteTrips.ts`
**Sources:** cron-correctness-20260612

---

### B-15: Wrap `notifyReturned` Calls in try/catch in Charter Sweeper
**What:** `lib/jobs/charterExpirySweeper.ts:135` awaits `notifyReturned(row)` without try/catch. A NotificationLog DB error propagates to the sweeper loop and aborts all subsequent reroutes for that tick.
**Why it blocks:** A single notification failure stops the entire sweep tick, leaving many charter leads unprocessed.
**Fix:** Wrap both `await notifyReturned(row)` calls in try/catch (mirror `declineCharter` pattern).
**Files:** `lib/jobs/charterExpirySweeper.ts`
**Sources:** charter-lifecycle-20260612

---

### B-16: Remove `(tx as any).paymentEvent.create` Cast in `processWebhook.ts`
**What:** `lib/payment/processWebhook.ts:157` casts the transaction client to `any` to access `paymentEvent.create`, suppressing a type error that signals `PaymentEvent` may be missing from the Prisma generated client.
**Why it blocks:** If `PaymentEvent` is not on `TransactionClient`, the cast bypasses the type error silently — payment events may not be created correctly in transactions, leading to unrecorded payments.
**Fix:** Run `pnpm prisma generate`, confirm `PaymentEvent` appears on `Prisma.TransactionClient`, then remove the cast.
**Files:** `lib/payment/processWebhook.ts:157`
**Sources:** type-safety-audit-20260612

---

### B-17: Sign DPAs with All Sub-Processors
**What:** No Data Processing Agreement exists with MoMo, eSMS.vn, Upstash (Redis), or Vercel. All four actively process Vietnamese customer PII (phone numbers, booking data, IP addresses).
**Why it blocks:** Vietnam's Personal Data Protection Law (PDPL) requires DPAs with all data processors before data is shared with them. Operating without DPAs is a legal compliance failure.
**Fix:** Execute DPA agreements with each vendor before go-live: MoMo (payment data), eSMS.vn (phone + SMS body), Upstash (IP/phone as rate-limit keys), Vercel (server logs + request metadata).
**Files:** N/A — legal/business process
**Sources:** pii-inventory-20260612

---

### B-18: Wire Real Email Provider Behind `NOTIFY_STUB` Flag
**What:** `lib/notification/email.ts` always runs the stub path regardless of `NOTIFY_STUB` flag. Setting `NOTIFY_STUB=false` enables real eSMS but email notifications silently remain stubbed.
**Why it blocks:** Booking confirmation emails, ticket delivery emails, and operator notifications will never be sent in production.
**Fix:** Add a `NOTIFY_STUB` check to `sendEmail` matching the eSMS pattern. Wire a real email provider (Resend/SES) behind the seam. Also add `ESMS_SANDBOX=false` to go-live env checklist.
**Files:** `lib/notification/email.ts`
**Sources:** notification-reliability-20260612

---

### B-19: Add `ticketReady` to `EmailTemplate` Union and SUBJECTS Map
**What:** `generateTicketPdfs.ts:109` enqueues `template: 'ticketReady'` for email channel, but `ticketReady` is not in the `EmailTemplate` union in `email.ts` and has no subject in the `SUBJECTS` map. Emails default to the generic `'BusBookVN'` subject.
**Why it blocks:** Every ticket-ready email will have a meaningless subject line, reducing open rate and failing quality expectations.
**Fix:** Add `'ticketReady'` to `EmailTemplate` union and add a meaningful Vietnamese subject to `SUBJECTS`.
**Files:** `lib/notification/email.ts`
**Sources:** notification-reliability-20260612

---

### B-20: Fix `charterDeclined` Email Recipient
**What:** `lib/charter/declineCharter.ts:65-69` enqueues `charterDeclined` with `recipient: 'ops'` — a literal string, not an email address. Real SMTP/API providers will reject this.
**Why it blocks:** Admin ops team never receives decline notifications. Also `'charterDeclined'` is not in `EmailTemplate` union or `SUBJECTS` map.
**Fix:** Use a configured ops email address from `getEnv()`. Add `'charterDeclined'` to `EmailTemplate` union and `SUBJECTS`.
**Files:** `lib/charter/declineCharter.ts`, `lib/notification/email.ts`
**Sources:** notification-reliability-20260612

---

### B-21: Remove TEMPORARY Admin TOTP Bypass
**What:** `lib/auth/totpDisabled.ts` is a TEMPORARY bypass file with two call sites in `app/api/admin/auth/login/route.ts:65` and `app/api/admin/auth/refresh/route.ts:44`. While protected by `NODE_ENV !== 'production'`, it should not exist in a go-live build.
**Why it blocks:** Even with the production guard, the bypass creates a false sense of security in staging-but-production-NODE_ENV environments and is a debt marker explicitly flagged for pre-094 removal.
**Fix:** Delete `lib/auth/totpDisabled.ts` and its 2 call sites.
**Files:** `lib/auth/totpDisabled.ts`, `app/api/admin/auth/login/route.ts:65`, `app/api/admin/auth/refresh/route.ts:44`
**Sources:** debt-scan-20260612

---

### B-22: Wire Real PSP Refund API
**What:** `lib/payment/refund.ts:55` returns a stub response with a `// TODO(094-go-live-real-payment-keys)` marker. Refund flows called from trip cancellation and admin refund-out will silently stub in production.
**Why it blocks:** Refunds to customers will not actually be processed through MoMo/ZaloPay.
**Fix:** Wire the real MoMo/ZaloPay refund API behind the `PAYMENTS_STUB` flag. Align with the real payment key rollout plan in Issue 094.
**Files:** `lib/payment/refund.ts`
**Sources:** debt-scan-20260612

---

### B-23: Fix DB Connection Pooling for Serverless Production
**What:** `lib/core/db/client.ts:26-28` only caches the PrismaClient singleton in non-production. In production on Vercel, every cold start creates a new `PrismaClient` + `new Pool()` with pg default `max=10`. Under burst traffic (50 concurrent instances), that's 500 PG connections against Vercel Postgres limits (100 hobby / 500 pro).
**Why it blocks:** Connection exhaustion under load causes full API outage — all routes 500.
**Fix:** Store `prisma` on `globalForPrisma` in ALL environments. Add `DATABASE_POOL_MAX` env var (default 5). Pass to `new Pool({ max })`.
**Files:** `lib/core/db/client.ts`, `lib/config/env.ts`
**Sources:** grill-me self-assessment Q1, Issue 114

---

### B-24: Add JWT_SECRET and DATABASE_URL to Zod Env Schema
**What:** `JWT_SECRET` (used for all 3 auth realms) and `DATABASE_URL` are not in the Zod env schema. `JWT_SECRET` has a test-only fallback (`'s'.repeat(32)`) — an unset `JWT_SECRET` in production means ALL tokens are signed with the test key and every token is forgeable. `DATABASE_URL` throws only at first DB call, not at startup.
**Why it blocks:** Missing `JWT_SECRET` = every JWT forgeable. Missing `DATABASE_URL` = delayed failure instead of fail-fast. Combined with B-02 (CRON_SECRET), three critical vars lack startup validation.
**Fix:** Add `JWT_SECRET: z.string().min(32)`, `DATABASE_URL: z.string().startsWith('postgres')` to `lib/config/env.ts`. Subsumes B-02 scope for CRON_SECRET.
**Files:** `lib/config/env.ts`, `lib/auth/jwt.ts`
**Sources:** grill-me self-assessment Q2, Issue 115

---

## LAUNCH — Must Fix Before Public Announcement
> These items gate the public marketing launch and broad customer acquisition. They don't block taking real payments but do affect user experience, legal compliance, accessibility, and discoverability.

| # | Finding | Severity | Source Docs | Effort | Status |
|---|---------|----------|-------------|--------|--------|
| L-01 | Hero image uses CSS `backgroundImage` — not discovered by preload scanner (LCP failure) | P1 | perf-audit-runtime | S | open |
| L-02 | `/search` page fires two full `searchTrips` calls per load (doubles DB queries) | P1 | perf-audit-runtime | S | open |
| L-03 | No CHECK constraints on monetary DB fields (price, totalVnd, gross, net) | P0 | data-model-review | M | open |
| L-04 | `Payout.net ≠ gross - platformFee` not DB-enforced | P0 | data-model-review, ledger-invariants | S | open |
| L-05 | No per-trip active-hold cap — single IP can DoS available seats | D1 | threat-model | M | open |
| L-06 | No Content-Security-Policy header configured | S2 | threat-model | S | open |
| L-07 | Admin login page: all three inputs lack `<label>` tags (WCAG 3.3.2 violation) | P1 | a11y-design-review, a11y-runtime | S | open |
| L-08 | Admin login page: error message has no `role="alert"` (WCAG 4.1.3 violation) | P1 | a11y-design-review, a11y-runtime | S | open |
| L-09 | Orange primary text on white fails WCAG 4.5:1 contrast ratio for normal text | P1 | a11y-design-review, a11y-runtime | M | open |
| L-10 | `NewTripClient` and `BusesClient`: Select labels not linked to triggers via `aria-labelledby` | P1 | a11y-runtime | S | open |
| L-11 | `BusesClient`: Capacity edit input in table cell has no accessible label | P1 | a11y-runtime | S | open |
| L-12 | Operator trips table overflows on mobile — action buttons unreachable on phones | P1 | design-review | S | open |
| L-13 | Bus fleet table same overflow problem — "Deactivate" button unreachable on mobile | P1 | design-review | S | open |
| L-14 | BookingSteps labels hidden below `sm` breakpoint (360–479px phones see only numbers) | P1 | design-review | S | open |
| L-15 | Missing OpenGraph tags on ALL indexable pages — social shares show generic previews | P1 | seo-audit | S | open |
| L-16 | `/search` page metadata is too weak (21-char title, 24-char description, no OG) | P1 | seo-audit | S | open |
| L-17 | Hero images on homepage are raw `<img>` without `next/image` — no CLS protection | P2 | perf-audit-runtime, seo-audit | M | open |
| L-18 | Homepage renders fully dynamic despite data changing at most hourly — no ISR | P2 | perf-audit-runtime | S | open |
| L-19 | Payment webhook routes have zero handler-level logging — no entry/exit trace | P1 | observability-review | S | open |
| L-20 | Payout/auto-complete/expire-holds jobs have no entry/exit summary logging | P1 | observability-review | S | open |
| L-21 | Auth routes (admin, operator, account) have zero request-level logging | P2 | observability-review | M | open |
| L-22 | Bank account number stored plaintext in `PayoutAccount` | P1 | pii-inventory | L | open |
| L-23 | TOTP secret stored plaintext in `AdminUser` — DB compromise = TOTP bypass | P1 | pii-inventory | L | open |
| L-24 | `ipAddress` on OTP attempts not in Pino logger redaction list — leaks to logs | P1 | pii-inventory | S | open |
| L-25 | Admin skip-link missing (keyboard users must tab through full 7-item nav) | P2 | a11y-runtime | S | open |
| L-26 | Customer portal has no skip-link (keyboard users tab through header on every page) | P2 | a11y-runtime | S | open |
| L-27 | No `loading.tsx` skeleton files anywhere in `app/` — blank pages during RSC fetches | P2 | design-review | M | open |
| L-28 | Finance admin — raw CUID input for refund/chargeback with no booking-ref lookup | P1 | design-review | M | open |
| L-29 | Rate limit in-memory fallback ineffective on serverless — Upstash required in prod | P1 | grill-me | S | open |
| L-30 | No backup runbook, no restore procedure, no RPO test | P1 | grill-me | M | open |
| L-31 | No external monitoring/alerting — zero production visibility on failures | P1 | grill-me | M | open |
| L-32 | No go-live deployment runbook — deploy sequence, env vars, rollback undocumented | P1 | grill-me | M | open |

---

### L-01: Replace Hero CSS Background with `next/image priority`
**What:** `app/(customer)/page.tsx:62-73` renders the hero as two `<div style={{ backgroundImage: ... }}>` elements. CSS background images are not discovered by the browser's HTML preload scanner — the LCP image is deferred until CSSOM is built.
**Why it blocks launch:** On Moto G Power over 4G with 4× CPU throttle, LCP almost certainly exceeds the 2.5s NFR-001 budget. This is the single highest-impact CWV gap (see NFR-001 at-risk).
**Fix:** Replace both hero `<div>` elements with `<Image src="..." fill priority quality={85} className="object-cover" />` from `next/image`. Add `images.localPatterns` to `next.config.ts`. Remove the existing `preload()` calls — `priority` handles them natively.
**Files:** `app/(customer)/page.tsx`, `next.config.ts`
**Sources:** perf-audit-runtime-20260612, seo-audit-20260612, nfr.md (NFR-001)

---

### L-02: Eliminate Duplicate `searchTrips` Call on `/search` Page
**What:** `app/(customer)/search/page.tsx:396-402` calls `searchTrips` twice per page load — once with `limit: Number.MAX_SAFE_INTEGER` for facets and once with `cursor`+`limit` for the page slice. Both calls execute the same 3-query pipeline (route lookup → trips → hold/booking aggregates), doubling TTFB.
**Why it blocks launch:** Directly violates p95 ≤ 300ms target (NFR-002). On a popular route with 200+ trips, the base call returns thousands of rows to Node memory.
**Fix:** Call `searchTrips` once without cursor, then derive both facets and the page slice from the single result set in-memory.
**Files:** `app/(customer)/search/page.tsx`
**Sources:** perf-audit-runtime-20260612, nfr.md (NFR-002)

---

### L-03: Add CHECK Constraints on Monetary DB Fields
**What:** `Trip.price`, `Booking.totalVnd`, `Payout.gross/net/platformFee`, `FeeConfig.ratePpm` all accept 0 or negative values at DB level. No database-level guard prevents corrupt financial data.
**Why it blocks launch:** A bug or malicious input could write a zero-price trip or negative payout, corrupting operator financial statements.
**Fix:** Author a migration adding CHECK constraints: `CHECK (price > 0)` on Trip, `CHECK (totalVnd > 0)` on Booking, `CHECK (gross > 0 AND net >= 0 AND platformFee >= 0)` on Payout, `CHECK (ratePpm > 0)` on FeeConfig.
**Files:** New migration, `prisma/schema.prisma`
**Sources:** data-model-review-20260612, ledger-invariants-audit-20260612

---

### L-04: Add CHECK for `Payout.net = gross - platformFee`
**What:** `Payout.net` is denormalized from `gross - platformFee` but no CHECK constraint validates the invariant. An application bug or direct DB write could corrupt the net amount silently.
**Fix:** Add `CHECK (net = gross - "platformFee")` to the Payout table in a migration.
**Files:** New migration, `prisma/schema.prisma`
**Sources:** data-model-review-20260612, ledger-invariants-audit-20260612, threat-model-full-20260612 (T5)

---

### L-05: Add Per-Trip Active-Hold Cap
**What:** No per-user or per-trip hold limit exists (rated D1/score 9 in threat model). A single IP can hold ~5 seats before expiry at the 60/min rate limit; a distributed attack can lock an entire bus for the 5-minute hold window.
**Why it blocks launch:** A DoS attack can prevent all legitimate bookings on a popular route.
**Fix:** Add a per-trip active-hold cap (e.g., max 6 active holds/trip/IP or max N total active holds/trip). Enforce in `POST /api/holds` before creating a new hold.
**Files:** `app/api/holds/route.ts`, `lib/db/holdRepo.ts`
**Sources:** threat-model-full-20260612 (D1)

---

### L-06: Add Content-Security-Policy Header
**What:** No CSP header configured. Flagged as highest-priority web security gap in threat model (S2, score 6).
**Fix:** Add `Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-{nonce}'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.momo.vn https://payment.zalopay.vn` via Next.js `headers()` in `next.config.ts` or middleware.
**Files:** `next.config.ts` or `proxy.ts`
**Sources:** threat-model-full-20260612 (S2)

---

### L-07 + L-08: Fix Admin Login Form Accessibility (Labels + Error Announcement)
**What:** `app/admin/login/page.tsx` uses `placeholder` as the sole label for all three inputs (email, password, TOTP) with no `<label>` tags. Error message renders as plain `<p>` without `role="alert"`. Both confirmed WCAG AA violations.
**Fix:** Replace bare `<input>` elements with design-system `<Label>` + `<Input>` pairs with `htmlFor`/`id` linking. Replace bare `<button>` with `<Button>` component. Add `role="alert" aria-live="assertive"` to the error paragraph. Estimated 1 hour total.
**Files:** `app/admin/login/page.tsx`
**Sources:** a11y-design-review-20260612, a11y-runtime-20260612

---

### L-09: Darken Orange Primary Color for Text Contexts
**What:** `--primary: oklch(0.646 0.222 41.116)` on white ≈ 3:1 contrast. Fails WCAG 1.4.3 for normal-size text at: footer links, inline text links (register/login pages), active nav item (`text-sm`), price display links.
**Fix:** Define `--primary-text: oklch(0.55 0.20 41)` (~4.6:1 on white) for text-only uses. Keep `--primary` for backgrounds/buttons. Update `text-primary` on normal-size text elements to use `text-primary-text`.
**Files:** `app/globals.css`, affected link elements in login/register/footer/header
**Sources:** a11y-design-review-20260612, a11y-runtime-20260612, nfr.md (NFR-015 at-risk)

---

### L-10: Link Select Labels to Triggers in Operator Forms
**What:** `NewTripClient.tsx:201,222` and `BusesClient.tsx:275,283` have `<Label>` components with no `htmlFor`, and `<SelectTrigger>` with no matching `id`. Labels are not programmatically associated with their controls.
**Fix:** Add `id` to `SelectTrigger` (as `aria-labelledby` target since it's a `<button>`): `<Label id="route-label">Tuyến đường</Label><SelectTrigger aria-labelledby="route-label">`.
**Files:** `app/op/(console)/trips/new/NewTripClient.tsx`, `app/op/(console)/buses/BusesClient.tsx`
**Sources:** a11y-runtime-20260612

---

### L-11: Add aria-label to Capacity Edit Input in Buses Table
**What:** `BusesClient.tsx:421-429` — inline capacity-edit `<Input>` inside each table row has no label, `aria-label`, or `aria-labelledby`. Column header `<th>` is not programmatically linked to individual inputs.
**Fix:** Add `aria-label={`Sức chứa xe ${bus.licensePlate}`}` to each per-row Input.
**Files:** `app/op/(console)/buses/BusesClient.tsx`
**Sources:** a11y-runtime-20260612

---

### L-12 + L-13: Fix Table Overflow on Mobile in Operator Console
**What:** `TripsClient.tsx:146` and `BusesClient.tsx:308` both use `<Card className="overflow-hidden py-0">` around multi-column tables. On 360px phones, the action buttons (Cancel, Deactivate) are clipped and unreachable.
**Fix:** Replace `overflow-hidden` with `overflow-x-auto` on the Card's inner container, or wrap the Table in `<div className="overflow-x-auto">`.
**Files:** `app/op/(console)/trips/TripsClient.tsx`, `app/op/(console)/buses/BusesClient.tsx`
**Sources:** design-review-20260612

---

### L-14: Show Booking Step Labels at All Viewport Widths
**What:** `components/booking/BookingSteps.tsx:31` — `className="hidden text-sm font-medium sm:inline"` hides step labels (Thông tin, Xác nhận, Thanh toán) below 640px. All mid-range Vietnamese phones (360–390px) see only numbered circles.
**Fix:** Remove the `hidden sm:inline` hiding or show abbreviated labels at all widths.
**Files:** `components/booking/BookingSteps.tsx`
**Sources:** design-review-20260612

---

### L-15: Add Per-Page OpenGraph Tags
**What:** No page exports `og:image`, `og:url`, or `og:type`. Social media shares on Facebook and Zalo (dominant in Vietnam) show generic previews.
**Fix:** Add per-page OG in `generateMetadata()` for all indexable pages: `/`, `/search`, `/routes`, `/lien-he-dat-xe`, `/trips/[id]`.
**Files:** `app/(customer)/page.tsx`, `app/(customer)/search/page.tsx`, `app/(customer)/routes/page.tsx`, `app/(customer)/lien-he-dat-xe/page.tsx`, `app/(customer)/trips/[id]/page.tsx`
**Sources:** seo-audit-20260612

---

### L-16: Strengthen `/search` Page Metadata
**What:** `/search` is the highest-traffic page. Title "Tìm chuyến xe" (21ch) is vague; description (24ch) is far below 140-160ch target. No OG tags. No SearchResultsPage schema.
**Fix:** Dynamic title: `Xe {origin} đi {destination} — Đặt vé online | BBVN`. Rich description. Add OG. Add SearchResultsPage + ItemList JSON-LD.
**Files:** `app/(customer)/search/page.tsx`
**Sources:** seo-audit-20260612

---

### L-17: Replace Content `<img>` Elements with `next/image`
**What:** `PopularTrips.tsx:85`, `FeatureHighlights.tsx:73`, `ContractCarRental.tsx:76` use native `<img loading="lazy">` with no width/height attributes — causes layout shift (CLS violations) and unoptimized downloads.
**Fix:** Add `images.localPatterns` to `next.config.ts`. Replace `<img>` with `<Image>` from `next/image` in all three components, with explicit `width`/`height` or `fill`+`sizes`.
**Files:** `components/home/PopularTrips.tsx`, `components/home/FeatureHighlights.tsx`, `components/home/ContractCarRental.tsx`, `next.config.ts`
**Sources:** perf-audit-runtime-20260612

---

### L-18: Enable ISR on Homepage and `/routes` Page
**What:** Homepage calls `getSearchablePlaces()`, `getActiveRoutes()`, `getHomeMetrics()` — three DB queries per page visit. Data changes at most hourly. No ISR configured.
**Fix:** Add `export const revalidate = 300;` (5 minutes) to `app/(customer)/page.tsx` and `app/(customer)/routes/page.tsx`.
**Files:** `app/(customer)/page.tsx`, `app/(customer)/routes/page.tsx`
**Sources:** perf-audit-runtime-20260612

---

### L-19: Add Handler-Level Logging to Payment Webhook Routes
**What:** `app/api/payments/momo/webhook/route.ts`, `card/webhook/route.ts`, `zalopay/webhook/route.ts` — zero handler-level logging. If the handler throws before `processPaymentWebhook`, there is no trace that the webhook arrived at all.
**Fix:** Add `logger.info({ adapter }, 'payment.webhook.received')` on entry, `logger.error({ err, adapter }, 'payment.webhook.failed')` in catch.
**Files:** All three webhook route files
**Sources:** observability-review-20260612, nfr.md (NFR-018 at-risk)

---

### L-20: Add Entry/Exit Logging to Payout, Auto-Complete, and Expire-Holds Jobs
**What:** `lib/jobs/processPayouts.ts`, `lib/jobs/autoCompleteTrips.ts`, `lib/jobs/expireHolds.ts` — no entry log, no summary log. Zero operational visibility.
**Fix:** Add `logger.info({ jobName, count }, 'job.started')` / `logger.info({ jobName, rowsAffected }, 'job.completed')` at start and end of each job.
**Files:** `lib/jobs/processPayouts.ts`, `lib/jobs/autoCompleteTrips.ts`, `lib/jobs/expireHolds.ts`
**Sources:** observability-review-20260612

---

### L-21: Add Structured Logging to Auth Routes
**What:** All 12 auth route handlers (admin login/logout/refresh/TOTP, operator login/register/logout/refresh, account delete/name/password/phone) have zero logging. Admin login has no IP/timestamp audit trail.
**Fix:** Add `logger.info({ event, ip, phone/email }, 'auth.event')` at each auth route entry. Account deletion is a compliance-critical event that must be logged.
**Files:** Auth route files in `app/api/auth/`, `app/api/op/auth/`, `app/api/admin/auth/`, `app/api/account/`
**Sources:** observability-review-20260612

---

### L-22: Encrypt Bank Account Number at Rest
**What:** `PayoutAccount.accountNumber` is stored in plaintext. Required for payout-send but a DB breach exposes all operator bank account numbers.
**Why it blocks launch:** Financial PII stored plaintext is a compliance and security risk for operators.
**Fix:** Encrypt `accountNumber` at rest using an app-level AES-256-GCM key. Decrypt only when submitting a payout transfer. Store only the last 4 digits in plaintext for display.
**Files:** `lib/payout/payoutAccount.ts`, `prisma/schema.prisma`, new migration
**Sources:** pii-inventory-20260612

---

### L-23: Encrypt TOTP Secret at Rest
**What:** `AdminUser.totpSecret` is stored in plaintext. A DB breach gives attackers the 2FA shared secret, completely bypassing TOTP protection.
**Fix:** Encrypt `totpSecret` at rest using an app-level AES-256-GCM key. Decrypt only when verifying TOTP codes.
**Files:** `lib/auth/totp.ts`, `lib/auth/adminTotp.ts`, `prisma/schema.prisma`, new migration
**Sources:** pii-inventory-20260612

---

### L-24: Add `ipAddress` to Pino Logger Redaction List
**What:** `OtpAttempt.ipAddress` and `OperatorOtpAttempt.ipAddress` are not in the logger's 44-path redaction list. IP addresses in structured logs can be correlated with user identity.
**Fix:** Add `ipAddress` to the redaction paths in `lib/logger.ts`.
**Files:** `lib/logger.ts`
**Sources:** pii-inventory-20260612, threat-model-full-20260612 (I3)

---

### L-25 + L-26: Add Skip Links to Admin and Customer Portal
**What:** Admin console layout (`app/admin/(console)/layout.tsx`) has no skip-to-content link. Root layout (`app/layout.tsx`) customer portal has no skip link. Keyboard users must tab through all navigation on every page load.
**Fix:** Add skip link to admin console layout targeting `#admin-main`. Add skip link to root layout targeting a consistent `#main` id on all customer pages.
**Files:** `app/admin/(console)/layout.tsx`, `app/layout.tsx`
**Sources:** a11y-runtime-20260612 (P2-05, P2-06)

---

### L-27: Add `loading.tsx` Skeleton Files to Key Routes
**What:** Zero `loading.tsx` files exist anywhere in `app/`. Navigating to `/op/dashboard` (6 parallel DB queries), `/search`, or `/booking/review` shows a blank page until all data resolves.
**Fix:** Add `loading.tsx` with skeleton components to at minimum: `app/(customer)/search/loading.tsx`, `app/(customer)/booking/review/loading.tsx`, `app/op/(console)/dashboard/loading.tsx`.
**Files:** New `loading.tsx` files in each route directory
**Sources:** design-review-20260612

---

### L-28: Add Booking-Ref Lookup to Finance Admin Refund/Chargeback Forms
**What:** `app/admin/(console)/finance/page.tsx` and `FinanceActions.tsx` — refund and chargeback forms require raw internal `op_…` CUID and booking ID. No search or autocomplete. A mistyped ID fails silently after the TOTP step-up gate.
**Fix:** Add a booking-ref (`BB-YYYY-xxx-xxx`) lookup input that resolves to the internal ID before displaying the refund/chargeback form.
**Files:** `app/admin/(console)/finance/page.tsx`, `FinanceActions.tsx`
**Sources:** design-review-20260612

---

### L-29: Require Upstash for Production Rate Limiting
**What:** `lib/ratelimit/index.ts` silently falls back to `InMemoryRatelimit` when Upstash env vars are unset. On Vercel serverless, each function instance has its own memory — rate limits aren't shared across instances. An attacker rotating across instances bypasses the 60 req/min/IP limit entirely.
**Fix:** Require `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` in production via `lib/config/env.ts` superRefine. Warn in dev/test. Fail fast in production.
**Files:** `lib/config/env.ts`, `lib/ratelimit/index.ts`
**Sources:** grill-me self-assessment Q6, Issue 116

---

### L-30: Create Backup & Restore Runbook
**What:** No backup scripts, restore procedures, or RPO test exists. Vercel Postgres (Neon) has automatic snapshots on paid tiers but no documented procedure for restore.
**Fix:** Create `docs/ops/backup-restore.md` covering snapshot schedule, manual pg_dump script, restore procedure, RPO/RTO targets, tested restore on staging.
**Files:** New `docs/ops/backup-restore.md`
**Sources:** grill-me self-assessment Q13, Issue 117

---

### L-31: Set Up External Monitoring & Alerting
**What:** `instrumentation.ts` is empty. No UptimeRobot/BetterStack. No Sentry installed. Zero production alerting — if `process-payouts` fails for 24 hours, nobody knows.
**Fix:** Install `@sentry/nextjs`, init in `instrumentation.ts`, create `/api/health` endpoint, configure external uptime monitor, add error-level logging to all 11 cron handlers. Create `docs/ops/monitoring.md`.
**Files:** `instrumentation.ts`, `package.json`, new `app/api/health/route.ts`, new `docs/ops/monitoring.md`
**Sources:** grill-me self-assessment Q14-15, Issue 118, merges PL-24 scope

---

### L-32: Create Go-Live Deployment Runbook
**What:** Issue 094 defines go-live requirements but no runbook documents the deploy sequence, env var transition, smoke tests, or rollback procedure. A misconfigured deploy during the highest-stakes transition risks real money.
**Fix:** Create `docs/ops/go-live-runbook.md` with pre-flight checklist, env var transition table, deploy sequence, and rollback procedure (including in-flight IPN handling).
**Files:** New `docs/ops/go-live-runbook.md`
**Sources:** grill-me self-assessment Q25-26, Issue 119

---

## POST-LAUNCH — Fix Within 30 Days
> These items can ship as-is but should be resolved in the first post-launch sprint.

| # | Finding | Severity | Source Docs | Effort | Status |
|---|---------|----------|-------------|--------|--------|
| PL-01 | `NotificationLog` has no retention policy — PII accumulates indefinitely | P2 | notification-reliability, pii-inventory | M | open |
| PL-02 | Normalize `invalid_input` → `validation_failed` in operator fleet/catalog routes (10 files) | P1 | consistency-audit, backcompat-review | S | open |
| PL-03 | Operator bus routes use HTTP 400 for Zod validation failures; all others use 422 | P2 | backcompat-review, consistency-audit | S | open |
| PL-04 | `consent_required` lowercase in otherwise SCREAMING_SNAKE `initiate` route | P1 | backcompat-review, consistency-audit | S | open |
| PL-05 | `already_cancelled` snake_case in cancel route vs camelCase in depart/complete | P2 | backcompat-review, consistency-audit | S | open |
| PL-06 | `POST /api/op/auth/forgot-password` leaks lockout state via differentiated 429 codes | P1 | backcompat-review | S | open |
| PL-07 | `POST /api/op/auth/refresh` leaks access token in response body (XSS risk) | P2 | backcompat-review | S | open |
| PL-08 | `/api/trips/search` cursor in `X-Next-Cursor` header, not response body | P1 | backcompat-review, consistency-audit | M | open |
| PL-09 | No API versioning strategy — no `/v1/` prefix before customer-facing routes freeze | P3 | backcompat-review | L | open |
| PL-10 | 4 dead operator components (`KpiTile`, `DetailLayout`, `DataTable`, `FilterBar`) | P1 | dead-code-scan | S | open |
| PL-11 | `shadcn` and `tw-animate-css` misclassified as production dependencies | P2 | dead-code-scan | S | open |
| PL-12 | Trip.pairedTripId is a zombie DTO field — no active consumers after paired-return deletion | P2 | dead-code-scan | M | open |
| PL-13 | `ContactStatus` write path never implemented — filter dropdown shows options user can never set | P2 | dead-code-scan | M | open |
| PL-14 | 3 `op/reports/*` GET routes missing `withErrorHandler` — unlogged 500s on DB throws | P2 | debt-scan | S | open |
| PL-15 | `HoldDetails` interface declared in two files with risk of divergence | P1 | consistency-audit | S | open |
| PL-16 | `MaintenanceWindow` type declared with incompatible field types (Date vs string) | P1 | consistency-audit | S | open |
| PL-17 | Normalize customer auth error casing to lowercase_snake throughout send/verify/register/login | P1 | backcompat-review | S | open |
| PL-18 | Add DB CHECK constraints for status↔timestamp consistency (cancelledAt→status='cancelled', etc.) | P1 | data-model-review | M | open |
| PL-19 | `Trip.busId` FK not indexed — full table scan for "all trips for bus X" | P2 | data-model-review | S | open |
| PL-20 | Missing partial indexes for soft-delete columns (active buses/routes/templates) | P2 | data-model-review | S | open |
| PL-21 | Admin audit log has no immutability trigger (unlike LedgerEntry and ConsentRecord) | P2 | pii-inventory, threat-model | M | open |
| PL-22 | No suspense account for orphaned payment events in ledger | P1 | ledger-invariants-audit | M | open |
| PL-23 | LedgerEntry currency column not constrained to 'VND' | P2 | ledger-invariants-audit | S | open |
| PL-24 | Wire Sentry DSN so `captureException` produces actionable alerts | P2 | notification-reliability, debt-scan | M | open |
| PL-25 | `HoldExpiryModal` provides no keyboard-accessible countdown announcement | P1 | a11y-runtime | S | open |
| PL-26 | `PopularTrips` carousel `role="region"` on `<ul>` overrides list semantics | P2 | a11y-runtime | S | open |
| PL-27 | Calendar weekday abbreviations lack `role="columnheader"` | P2 | a11y-runtime | S | open |
| PL-28 | Payment webhook card and ZaloPay routes have zero unit tests | P1 | coverage-map | M | open |

---

### PL-01: Add Retention Policy for NotificationLog
**What:** `NotificationLog.recipient` (phone/email) and `payload` (rendered SMS bodies with booking data) accumulate indefinitely. GDPR/PDPL right-to-erasure requires scrubbing on customer account deletion. Sn't covered by `anonymizeCustomer.ts`.
**Fix:** Add deletion of `status='sent'` NotificationLog rows older than 90 days to `retentionSweeper.ts`. Ensure `anonymizeCustomer.ts` nulls/masks `recipient` on rows linked to deleted customers.
**Files:** `lib/jobs/retentionSweeper.ts`, `lib/account/anonymizeCustomer.ts`
**Sources:** notification-reliability-20260612, pii-inventory-20260612

---

### PL-02: Normalize Operator Validation Error Code to `validation_failed`
**What:** 10 operator fleet/catalog routes use `'invalid_input'` while 13 other operator routes use `'validation_failed'`. A frontend client normalizing on one string breaks silently for the other group.
**Fix:** Rename `invalid_input` → `validation_failed` in: `op/buses/route.ts`, `op/buses/[id]/route.ts`, `op/buses/[id]/maintenance/route.ts`, `op/routes/route.ts`, `op/routes/[id]/route.ts`, `op/staff/route.ts`, `op/staff/[id]/route.ts`, `op/staff/[id]/assign-service/route.ts`, `op/pickup-areas/route.ts`, `op/pickup-areas/[id]/route.ts`. Update tests in same commit.
**Files:** 10 operator route files
**Sources:** consistency-audit-20260612, backcompat-review-20260612

---

### PL-03 through PL-09: API Contract Consistency Fixes
These are the remaining backcompat/consistency findings. Full details are in `backcompat-review-20260612.md` and `consistency-audit-20260612.md`. Priority order: PL-04 (one-liner), PL-05 (one-liner), PL-06 (security-relevant enumeration leak), PL-03 (HTTP status normalization), PL-07 (token leak from response body), PL-08 (cursor location normalization), PL-09 (versioning strategy — requires team decision).
**Sources:** backcompat-review-20260612, consistency-audit-20260612

---

### PL-10 through PL-13: Dead Code Cleanup
Delete `KpiTile.tsx`, `DetailLayout.tsx`, `DataTable.tsx`, `FilterBar.tsx` from `components/op/`. Move `shadcn` and `tw-animate-css` to `devDependencies`. File cleanup issues for `Trip.pairedTripId` and `ContactStatus` write path.
**Sources:** dead-code-scan-20260612

---

### PL-14: Wrap `op/reports/*` Routes with `withErrorHandler`
Three report GET routes skip `withErrorHandler`. DB throws surface as unformatted Next.js 500 with no Pino log entry. 15 minutes each.
**Files:** `app/api/op/reports/revenue/route.ts`, `app/api/op/reports/revenue.csv/route.ts`, `app/api/op/reports/payouts/route.ts`
**Sources:** debt-scan-20260612

---

### PL-15 through PL-17: Type/Interface Deduplication
Export `HoldDetails` from `lib/booking` barrel (remove duplicate in `ReviewClient.tsx`). Rename client-side `MaintenanceWindow` to `MaintenanceWindowJson`. Normalize customer auth error casing to lowercase_snake.
**Sources:** consistency-audit-20260612, backcompat-review-20260612

---

### PL-18 through PL-20: DB Schema Hardening
Add status↔timestamp CHECK constraints. Add `Trip.busId` index. Add partial indexes for soft-deleted rows.
**Sources:** data-model-review-20260612

---

### PL-21: Add Immutability Trigger to AdminAuditLog
`AdminAuditLog` can be deleted, unlike `LedgerEntry` and `ConsentRecord` which have DB-level immutability triggers. Add `BEFORE UPDATE/DELETE` trigger.
**Files:** New migration
**Sources:** pii-inventory-20260612, threat-model-full-20260612 (R2)

---

### PL-22 through PL-28: Remaining Findings
Detailed descriptions for PL-22 through PL-28 are available in the respective source documents. These are well-understood, bounded fixes in the 30-min to 2-hour range each.

---

## Review Coverage Summary

| Review Document | Date | P0 | P1 | P2 | P3 | Items merged into checklist |
|----------------|------|----|----|----|----|----------------------------|
| security-review-full-20260612 | 2026-06-12 | 0 | 1 | 0 | 0 | B-02 |
| threat-model-full-20260612 | 2026-06-12 | 0 | 3 | 3 | 2 | B-02, L-05, L-06 |
| code-review-full-20260612 | 2026-06-12 | 0 | 5 | 12 | 7 | B-02, B-04, B-05, B-06, B-16 |
| coverage-map-20260612 | 2026-06-12 | 0 | 6 | 9 | 4 | PL-28 |
| data-model-review-20260612 | 2026-06-12 | 2 | 4 | 4 | 3 | L-03, L-04, PL-18, PL-19, PL-20 |
| ledger-invariants-audit-20260612 | 2026-06-12 | 0 | 2 | 2 | 2 | L-03, L-04, PL-22, PL-23 |
| migration-safety-audit-20260612 | 2026-06-12 | 1 | 3 | 0 | 0 | B-03 |
| observability-review-20260612 | 2026-06-12 | 0 | 4 | 8 | 3 | L-19, L-20, L-21 |
| pii-inventory-20260612 | 2026-06-12 | 2 | 5 | 3 | 0 | B-01, B-17, L-22, L-23, L-24, PL-01, PL-21 |
| a11y-design-review-20260612 | 2026-06-12 | 0 | 3 | 5 | 4 | L-07, L-08, L-09 |
| seo-audit-20260612 | 2026-06-12 | 0 | 3 | 5 | 3 | L-01, L-15, L-16 |
| perf-audit-runtime-20260612 | 2026-06-12 | 0 | 2 | 5 | 6 | L-01, L-02, L-17, L-18 |
| a11y-runtime-20260612 | 2026-06-12 | 0 | 6 | 10 | 12 | L-07, L-08, L-09, L-10, L-11, L-25, L-26, PL-25, PL-26, PL-27 |
| backcompat-review-20260612 | 2026-06-12 | 0 | 6 | 6 | 6 | B-01, PL-02, PL-03, PL-04, PL-05, PL-06, PL-07, PL-08, PL-09, PL-17 |
| cron-correctness-20260612 | 2026-06-12 | 0 | 3 | 5 | 4 | B-02, B-07, B-13, B-14 |
| charter-lifecycle-20260612 | 2026-06-12 | 0 | 4 | 4 | 6 | B-10, B-11, B-12, B-15 |
| notification-reliability-20260612 | 2026-06-12 | 0 | 5 | 5 | 5 | B-07, B-08, B-09, B-18, B-19, B-20, PL-01, PL-24 |
| consistency-audit-20260612 | 2026-06-12 | 0 | 4 | 5 | 3 | PL-02, PL-03, PL-04, PL-05, PL-08, PL-15, PL-16 |
| dead-code-scan-20260612 | 2026-06-12 | 0 | 4 | 3 | 3 | PL-10, PL-11, PL-12, PL-13 |
| debt-scan-20260612 | 2026-06-12 | 0 | 0 | 4 | 7 | B-21, B-22, PL-14 |
| type-safety-audit-20260612 | 2026-06-12 | 0 | 0 | 4 | 6 | B-16 |
| design-review-20260612 | 2026-06-12 | 0 | 4 | 8 | 6 | L-12, L-13, L-14, L-27, L-28 |
| issues/113-remove-temp-password-plain | 2026-06-11 | 1 | 0 | 0 | 0 | B-01 |
| nfr.md | 2026-06-12 | — | — | — | — | Status reference for at-risk NFRs |
| grill-me self-assessment | 2026-06-13 | 1 | 5 | 0 | 0 | B-23, B-24, L-29, L-30, L-31, L-32 |

---

## NFR Status

| NFR | Requirement | Target | Status | Checklist Item |
|-----|-------------|--------|--------|----------------|
| NFR-001 | Customer pages CWV "good" | LCP ≤ 2.5s, CLS ≤ 0.1, INP ≤ 200ms | **at-risk** — hero image is CSS background | L-01, L-17 |
| NFR-002 | API search p95 ≤ 300ms | p95 ≤ 300ms on `/api/trips/search` | **at-risk** — double searchTrips call | L-02 |
| NFR-003 | JS bundle ≤ 150kB gzip per page | ≤ 150kB gz | **proposed** — unverified (no bundle analyzer) | Add `@next/bundle-analyzer` |
| NFR-004 | 100 concurrent hold→book flows | 100 simultaneous | **proposed** — untested | No k6 load test run |
| NFR-005 | ≤ 20 DB pool connections under peak | ≤ 20 connections | **proposed** — unverified | No measurement tooling |
| NFR-006 | 0 critical CVE in production deps | 0 critical | **proposed** — `pnpm audit --prod` not in CI | Add to CI |
| NFR-007 | OWASP Top 10 baseline | All 10 categories addressed | **met** — security review found only CRON_SECRET gap | B-02 (fixes last open item) |
| NFR-008 | CRON_SECRET mandatory in production | Env var required, min 16 chars | **at-risk** — not in Zod schema, fails-open | B-02 |
| NFR-009 | Vietnam PDPL compliance — DPA with all sub-processors | DPA signed | **at-risk** — all 4 sub-processors pending | B-17 |
| NFR-010 | PII retention — guest bookings 365d | Anonymize on schedule | **met** | — |
| NFR-011 | PII retention — KYB docs 90d | Purge on schedule | **met** | — |
| NFR-012 | No plaintext passwords in DB | 0 plaintext password columns | **at-risk** — `tempPasswordPlain` column exists | B-01 |
| NFR-013 | WCAG 2.2 Level AA — customer portal | AA on all public pages | **proposed** — unvalidated; runtime audit found P1 gaps | L-07 through L-11, L-25, L-26 |
| NFR-014 | Touch target minimum 44×44px | 44×44px on interactive elements | **proposed** — unverified | Confirm with axe-core |
| NFR-015 | Color contrast 4.5:1 for normal text | 4.5:1 | **at-risk** — orange primary confirmed failing | L-09 |
| NFR-016 | Vietnamese locale end-to-end | vi locale | **met** — full audit passed | — |
| NFR-017 | Admin console Vietnamese | 95% translated | **met** | — |
| NFR-018 | Structured logging on all routes | ≥ 50% of API routes | **at-risk** — only 10% (13/134) have structured logging | L-19, L-20, L-21 |
| NFR-019 | Error tracking via Sentry | Error logging to Pino | **proposed** — Sentry deferred, fallback to logger | PL-24 |
| NFR-020 | PII redaction in logs | All known PII in redact list | **met** — 44 paths; `ipAddress` gap | L-24 |
| NFR-021 | Uptime 99.5% monthly | 99.5% monthly | **proposed** — no external monitor set up | Set up UptimeRobot/BetterStack |
| NFR-022 | Payment webhook idempotency | 0 duplicate processing | **met** | — |
| NFR-023 | Ledger immutability | 0 mutations to committed entries | **met** | — |
| NFR-024 | Hold expiry sweep ≤ 2 minutes | ≤ 2 min | **met** | — |
| NFR-025 | TypeScript strict mode, 0 `@ts-ignore` | 0 errors | **met** | — |
| NFR-026 | Test coverage — unit ≥ 70% | ≥ 70% line coverage | **proposed** — unverified | Run `vitest --coverage` |
| NFR-027 | Test coverage — all financial paths | All P1 paths have integration tests | **at-risk** — card/ZaloPay webhooks untested | PL-28 |
| NFR-028 | Module boundaries enforced (0 cross-domain reach-ins) | 0 violations | **met** — boundaries@error in CI | — |
| NFR-029 | No import cycles | 0 cycles | **met** — no-cycle@error in CI | — |

---

## Pre-Launch Verification Gates

Before executing Issue 094 (real payment keys), verify all BLOCKER items by running:

```bash
# 1. CRON_SECRET fix verification
grep -r 'if (cronSecret &&' app/api/cron/
# Expected: 0 matches

# 2. tempPasswordPlain removal
grep -r 'tempPasswordPlain' prisma/schema.prisma lib/ app/
# Expected: 0 matches

# 3. Financial FK verification  
# Run against production DB:
# SELECT tc.constraint_name, rc.delete_rule FROM information_schema.table_constraints tc
# JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
# WHERE tc.table_name IN ('LedgerEntry', 'Payout', 'FeeConfig');
# Expected: All show delete_rule = 'RESTRICT'

# 4. Full test suite
pnpm tsc --noEmit && pnpm test

# 5. Bundle analysis
ANALYZE=true pnpm build
# Check: @react-pdf/renderer NOT in client bundle

# 6. Lighthouse audit
npx lighthouse --preset=perf --throttling-method=simulate https://[staging-url]/
# Check: LCP ≤ 2.5s, CLS ≤ 0.1
```
