# 23 -- Cron Job & Dev-Only Routes

Audit date: 2026-06-21

This document covers two categories of routes that sit outside the normal customer/operator/admin request flow:

1. **Cron routes** (`app/api/cron/`) -- scheduled background jobs invoked by Vercel Cron.
2. **Dev routes** (`app/dev/`, `app/dev/stub-storage/`) -- stub endpoints active only in development.

---

## 1. Cron Routes

### 1.1 Common Pattern

Every cron route handler follows the same structure:

- **Runtime:** `nodejs` (explicit `export const runtime = 'nodejs'`).
- **HTTP method:** `GET`.
- **Auth:** `Authorization: Bearer <CRON_SECRET>` header. Vercel injects this automatically on scheduled invocations. Returns `401 UNAUTHORIZED` if missing or mismatched.
- **Concurrency safety:** Most jobs run through `runJob(lockKey, jobFn)` from `lib/jobs`, which wraps the job function in a PostgreSQL advisory lock + `JobRunLog` audit row. A concurrent tick that finds the lock held returns `{ status: 'skipped_locked', rowsAffected: 0 }` without re-running.
- **Response:** `{ rowsAffected, status }` on success; `{ error: 'internal_error' }` with HTTP 500 on failure.

### 1.2 Cron Schedule (from vercel.json)

| Route | Schedule | Human-Readable |
|---|---|---|
| `/api/cron/sweep-holds` | `* * * * *` | Every minute |
| `/api/cron/close-sales` | `* * * * *` | Every minute |
| `/api/cron/dispatch-notifications` | `* * * * *` | Every minute |
| `/api/cron/generate-ticket-pdfs` | `*/2 * * * *` | Every 2 minutes |
| `/api/cron/complete-trips` | `*/5 * * * *` | Every 5 minutes |
| `/api/cron/send-reminders` | `*/15 * * * *` | Every 15 minutes |
| `/api/cron/reconcile-payments` | `*/15 * * * *` | Every 15 minutes |
| `/api/cron/process-payouts` | `0 * * * *` | Every hour (top of hour) |
| `/api/cron/charter-expiry` | `0 * * * *` | Every hour (top of hour) |
| `/api/cron/generate-trips` | `0 1 * * *` | Daily at 01:00 UTC |
| `/api/cron/retention` | `0 3 * * *` | Daily at 03:00 UTC |

Vercel region: `sin1` (Singapore).

### 1.3 Route Details

| Route | Lock Key | Job Function | Purpose |
|---|---|---|---|
| `sweep-holds` | `hold-expiry` | `expireHolds` | Expires active holds past their `expiresAt`. Two modes controlled by `HOLD_SWEEPER_MODE` env: `"count"` (read-only, no lock) or `"update"` (marks up to 500 expired holds via `LIMIT` + `FOR UPDATE SKIP LOCKED`). |
| `close-sales` | `sales-close` | `autoCloseSales` | Closes ticket sales on scheduled trips whose departure time has arrived (sets `salesClosed = true`). |
| `complete-trips` | `trip-complete` | `autoCompleteTrips` | Completes departed trips whose journey duration has elapsed. Creates the aggregate `Payout` row per trip. |
| `send-reminders` | `reminder-24h` | `sendReminders` | Sends 24-hour pre-departure SMS reminder once per eligible booking. Uses claim-then-dispatch pattern (B-07): manages its own advisory lock for the claim phase, dispatches SMS outside the transaction. Writes `JobRunLog` inline (does not use `runJob` wrapper). |
| `dispatch-notifications` | `notify-dispatch` | `dispatchNotifications` | Delivers due `NotificationLog` rows (`status` pending/failed, `attemptCount < MAX_ATTEMPTS`, `nextAttemptAt`/`scheduledFor` due) through channel adapters with exponential backoff (Issue 058). `FOR UPDATE SKIP LOCKED` inside the claim query prevents double-delivery. |
| `generate-ticket-pdfs` | `ticket-pdf` | `generateTicketPdfs` | Sweeps PAID bookings with `ticketPdfKey IS NULL`, renders the ticket PDF with QR in-process, uploads via `lib/storage.putObject`, stamps the key, and enqueues a `ticketReady` email `NotificationLog` row (Issue 074). |
| `generate-trips` | `trip-generate` | `generateTrips` | Generates `Trip` rows for the next 14 days from all active `RecurringTripTemplate` records. Per-row idempotency via partial unique on `(recurringTemplateId, departureAt)` as defense-in-depth (Issue 043). |
| `process-payouts` | `payout-processor` | `processPayouts` | Settles pending payouts whose T+3 `scheduledAt` has arrived. Transitions `pending` -> `processing` -> `settled`/`failed`. |
| `charter-expiry` | `charter-sweep` | `charterExpirySweeper` | Reroutes timed-out charter leads back to admin review (Issue 086). `ASSIGNED_DIRECT` past `acceptByAt` -> `ADMIN_REVIEW`. `PUBLISHED` past `claimByAt` -> `EXPIRED` -> `ADMIN_REVIEW`. Per-row `SELECT ... FOR UPDATE SKIP LOCKED`. |
| `retention` | `retention-sweep` | `retentionSweeper` | Enforces Issue 090 retention windows: (1) Guest PII scrub (365 days) on bookings whose trip departed > 1 year ago -- scrubs guest buyer name/phone/email snapshot, retains money/audit columns. (2) KYB docs purge (90 days) for REJECTED/SUSPENDED operators -- deletes storage object, stamps `purgedAt`. |
| `reconcile-payments` | `reconcile-payments` | `reconcilePayments` | Resolves stuck `awaiting_payment` bookings the webhook left behind (Issue 095). Confirms via matching `PaymentEvent`, expires if hold has lapsed, handles underpaid/wrong-currency, and degraded bank-transfer matching. Uses monotonic guard to prevent paid regression. `SELECT ... FOR NO KEY UPDATE SKIP LOCKED`. |

### 1.4 Advisory Lock Keys (complete inventory)

All 11 lock keys in use, verified no collisions:

`hold-expiry`, `sales-close`, `trip-complete`, `reminder-24h`, `notify-dispatch`, `ticket-pdf`, `trip-generate`, `payout-processor`, `charter-sweep`, `retention-sweep`, `reconcile-payments`

---

## 2. Dev-Only Routes

### 2.1 Stub Payment Gateway

| Aspect | Detail |
|---|---|
| **Page path** | `/dev/stub-pay` |
| **Source files** | `app/dev/stub-pay/page.tsx`, `app/dev/stub-pay/actions.ts` |
| **Guard** | `getEnv().PAYMENTS_STUB` must be truthy; returns `notFound()` otherwise. |
| **Purpose** | Local fake-gateway checkout page standing in for MoMo/ZaloPay/Card hosted checkout. Displays the order summary (adapter name, order ID, amount in VND) and two buttons: "Thanh toan" (pay success) and "That bai" (pay fail). |
| **How it works** | Query params `adapter`, `orderId`, `amount`, `redirectUrl` are set by the stub adapter's `createPayment` payUrl. On button click, the `submitStubPayment` server action signs a self-issued IPN with `STUB_PAYMENT_SECRET` via `buildStubIpn()`, then feeds it through the real `processPaymentWebhook` pipeline (same code path as live gateways). After processing, redirects to `redirectUrl` (the booking result page). |
| **Supported adapters** | `momo`, `zalopay`, `card` (validated via `STUB_ADAPTERS` Set). |
| **No self-fetch** | Uses server action (not an API route POST), so it bypasses the `/api/*` CSRF gate. No HTTP self-fetch. |

### 2.2 Stub Storage

| Aspect | Detail |
|---|---|
| **Route path** | `/dev/stub-storage/[...key]` |
| **Source file** | `app/dev/stub-storage/[...key]/route.ts` |
| **HTTP methods** | `PUT` (upload), `GET` (download) |
| **Guard** | `getEnv().STORAGE_STUB` must be truthy; returns `404 stub_storage_disabled` otherwise. |
| **Purpose** | In-memory S3 replacement for dev/test (Issue 059). Bytes stored in a process-local `Map` (`STUB_BLOBS` from `lib/storage/stubStore`) keyed by the object key. Non-persistent -- server restart drops all data. |
| **Auth** | Both verbs verify the inbound request via `verifyStubSignature` (constant-time HMAC over `key|METHOD|exp` + expiry check). Forged or expired signed URLs are rejected with `403 invalid_signature`, mimicking real S3 pre-signed URL behavior. |
| **PUT** | Reads `content-type` header and request body bytes, stores in `STUB_BLOBS`. Returns `{ ok: true, key, sizeBytes }`. |
| **GET** | Looks up key in `STUB_BLOBS`. Returns the raw bytes with the original `content-type`, or `404 not_found`. |
| **Shared store** | The `STUB_BLOBS` Map is imported from `lib/storage/stubStore`, shared with the server-side `putObject()` upload path so that objects uploaded programmatically (e.g., ticket PDF generation) are readable through this GET endpoint. |

### 2.3 Dev Guard Summary

| Route | Guard Env Var | Behavior When Off |
|---|---|---|
| `/dev/stub-pay` | `PAYMENTS_STUB` | Next.js `notFound()` (404) |
| `/dev/stub-storage/[...key]` | `STORAGE_STUB` | JSON `{ error: 'stub_storage_disabled' }` (404) |

Both guards read from `getEnv()` (`lib/config`), which caches the parsed environment. Neither route is reachable in production where these env vars are unset.

---

## 3. Source File Index

### Cron routes

| File | Lock Key |
|---|---|
| `app/api/cron/sweep-holds/route.ts` | `hold-expiry` |
| `app/api/cron/close-sales/route.ts` | `sales-close` |
| `app/api/cron/complete-trips/route.ts` | `trip-complete` |
| `app/api/cron/send-reminders/route.ts` | `reminder-24h` |
| `app/api/cron/dispatch-notifications/route.ts` | `notify-dispatch` |
| `app/api/cron/generate-ticket-pdfs/route.ts` | `ticket-pdf` |
| `app/api/cron/generate-trips/route.ts` | `trip-generate` |
| `app/api/cron/process-payouts/route.ts` | `payout-processor` |
| `app/api/cron/charter-expiry/route.ts` | `charter-sweep` |
| `app/api/cron/retention/route.ts` | `retention-sweep` |
| `app/api/cron/reconcile-payments/route.ts` | `reconcile-payments` |

### Dev routes

| File | Purpose |
|---|---|
| `app/dev/stub-pay/page.tsx` | Fake payment gateway UI |
| `app/dev/stub-pay/actions.ts` | Server action: sign stub IPN, run through processPaymentWebhook |
| `app/dev/stub-storage/[...key]/route.ts` | In-memory S3 stub (PUT/GET) |
