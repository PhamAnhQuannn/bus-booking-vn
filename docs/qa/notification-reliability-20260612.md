# Notification Reliability Audit
Date: 2026-06-12
Scope: Outbox dispatcher, email/SMS adapters, reminder cron, notification templates

## Summary

The core outbox dispatcher (`lib/notification/dispatchNotifications.ts`) is well-architected: claim-then-dispatch with `FOR UPDATE SKIP LOCKED`, advisory-lock serialization, exponential backoff, and AC5 decoupling. The principal reliability risk is `sendReminders` — it performs SMS delivery **inside** the advisory-lock transaction (a documented V1 note), which becomes a connection-hold/timeout risk when real eSMS HTTP replaces the in-memory stub. A secondary structural gap is that several notification types bypass the outbox entirely (direct `sendSms` call, log result, done), meaning retry/backoff is unavailable for those failures. The subsystem is production-ready for stub operation but requires two specific fixes before `NOTIFY_STUB=false` can go live safely.

---

## Delivery Guarantee Analysis

**Dispatcher (outbox path): Effectively at-least-once, structurally approaching at-most-once.**

Evidence:
- `FOR UPDATE SKIP LOCKED` in the claim query (`lib/notification/dispatchNotifications.ts:84-96`) ensures two concurrent dispatcher invocations cannot claim the same row simultaneously.
- The advisory lock `'notify-dispatch'` (`withAdvisoryLock`) serializes whole ticks; the `SKIP LOCKED` is belt-and-suspenders for manual-trigger races.
- Once a row reaches `status='sent'`, the claim predicate (`status IN ('pending','failed')`) permanently excludes it from future dispatch ticks. No double-send of an already-sent row is possible.
- The `@@unique([bookingId, template])` constraint (`prisma/schema.prisma:551`) prevents duplicate enqueues for the same (booking, template) pair — but only for non-null `bookingId` rows (NULLs are distinct in Postgres, confirmed by the int-test at `dispatchNotifications.int.test.ts:164`).
- The `NotificationLog.id` is forwarded as the eSMS `RequestId` idempotency key (`esms.ts:199`), so a cron re-run that re-dispatches a row that was sent but whose DB update failed would present the same `RequestId` to eSMS — eSMS's own idempotency gate would then deduplicate at the provider level.

**sendReminders (reminder path): At-most-once within the transaction window, with no retry.**

- `sendReminders` calls `sendSms` inside the advisory-lock `$transaction`, then writes `reminderSentAt` and a `NotificationLog` row — all in the same tx. If the SMS succeeds but the tx rolls back (e.g. a Postgres error after the send), the SMS is delivered but `reminderSentAt` stays `NULL`, and the next cron tick will re-send. This is at-most-once only when the tx commits successfully; it degrades to at-least-once on tx rollback.

**Direct-send paths (createOperator, resetOperatorAdminPassword, createStaff): At-most-once with no retry.**

- These call `sendSms` in-process, write the result to a `NotificationLog` row, and are done. A provider failure produces `status='failed'` in the log but the row is never re-attempted — it is not enqueued as `pending`, it is written with its final `status` immediately. No dispatcher retry is possible.

---

## P1 — Reliability Risks

**P1-1: sendReminders performs network I/O (SMS send) inside the advisory-lock transaction — will block the DB connection when real eSMS HTTP replaces the stub.**

- File: `lib/jobs/sendReminders.ts:41-98` (entire `JobCore` body); `lib/jobs/withAdvisoryLock.ts:17-22` (the V1 note acknowledging this)
- The `sendReminders` `JobCore` receives the advisory-lock `tx` handle and calls `sendSms(...)` (line 70) inside it. While the stub returns in-memory (<1ms), the real eSMS HTTP call involves DNS resolution, TLS handshake, and a 10s `AbortController` timeout (`esmsClient.ts:47`). A single slow eSMS response holds the Postgres connection for up to 10 seconds per booking; a batch of 50 bookings holds it for up to 500 seconds, starving the connection pool.
- Impact: Under real eSMS load, this will cause connection pool exhaustion, advisory lock accumulation, and cascading 500s across the API surface.
- Fix: Implement the claim-then-dispatch pattern documented in the V1 note. In the lock transaction: set `reminderSentAt = now` (claim). Outside the transaction: call `sendSms`. Then write the `NotificationLog` row with the result. Alternatively, convert reminders to the full outbox: enqueue a `pending` `NotificationLog` row inside the tx, let the `dispatch-notifications` cron deliver it with retry.

**P1-2: Three direct-send paths bypass the outbox entirely — failures receive no retry.**

- Files: `lib/admin/createOperator.ts:115-129`, `lib/admin/resetOperatorAdminPassword.ts:82-96`, `lib/staff/createStaff.ts:82-95`
- These call `sendSms` directly (in-process), record the result in a `NotificationLog` row with `status: smsResult.ok ? 'sent' : 'failed'`, and return. A failed SMS to a new operator admin or staff member (with their temp password) produces a `status='failed'` log row, but the dispatcher's claim query excludes rows that were written with `status='failed'` at creation and have no `nextAttemptAt` set (the `FOR UPDATE SKIP LOCKED` claim only reclaims rows written as `pending` or `failed` with `attemptCount < MAX_ATTEMPTS`). Since these rows are written with `attemptCount=0` but `status='failed'` and no explicit `nextAttemptAt`, they **will actually be picked up by the dispatcher** (the claim predicate at line 87-94 of `dispatchNotifications.ts` does not exclude them). However, re-delivery will re-send the rendered body already stored in `payload` — but `createOperator` stores `{ phone, loginUrl }` in `payload` (not the full rendered SMS body), meaning the dispatcher would pass a JSON object string to `sendSmsBody`, which expects a pre-rendered body string. This mismatch means retry would send garbled content.
- Impact: Staff/operator temp-password SMS failures silently fail; if retried by dispatcher, the re-sent body is the raw JSON payload, not the human-readable SMS.
- Fix: Either (a) enqueue as `status='pending'` with the pre-rendered body in `payload` (mirrors the webhook path), or (b) keep the direct-send pattern but write `status='sent'/'failed'` with `attemptCount=MAX_ATTEMPTS` so the dispatcher's `attemptCount < MAX_ATTEMPTS` predicate permanently excludes these rows from re-dispatch.

---

## P2 — Should Fix Before Go-Live

**P2-1: `ticketReady` template is not in the `EmailTemplate` union in `email.ts`, and has no subject line in the `SUBJECTS` map.**

- File: `lib/notification/email.ts:19-49` (EmailTemplate union), `lib/notification/email.ts:75-99` (SUBJECTS map)
- `generateTicketPdfs.ts:109` enqueues `template: 'ticketReady'` for email channel. The `EmailTemplate` union does not include `'ticketReady'`, and `SUBJECTS['ticketReady']` is undefined — `renderEmailSubject` falls back to the generic `'BusBookVN'` subject. The `sendEmail` function accepts `template: EmailTemplate | string` so tsc does not catch the mismatch at the call site, but the subject will always be wrong and the template is untracked.
- Fix: Add `'ticketReady'` to the `EmailTemplate` union and add a meaningful subject to `SUBJECTS`.

**P2-2: `charterDeclined` template is enqueued with `recipient: 'ops'` — a literal string, not an email address.**

- File: `lib/charter/declineCharter.ts:65-69`
- The `charterDeclined` notification is sent to `recipient: 'ops'` (not an email address). When real email is wired, the adapter will attempt to send to `'ops'` as an email address, which will be rejected by any real SMTP/API provider.
- Fix: Either use a configured ops email address from `getEnv()`, or convert to a different internal alerting channel. Also: `'charterDeclined'` is not in the `EmailTemplate` union or the `SUBJECTS` map.

**P2-3: `charterSubmitted`, `charterMatched`, `charterClaimWon`, `charterClaimLost`, `charterReturnedToReview` templates are in the `EmailTemplate` union but have no SMS template rendering — they are enqueued as SMS with a JSON payload body.**

- Files: `lib/charter/createCharterRequest.ts:132-144`, `lib/charter/claimCharter.ts:161-193`, `lib/charter/charterStatus.ts:319-332`
- Charter notifications are enqueued with `channel: 'sms'` and `payload: JSON.stringify({...})` — the stored payload is raw JSON, not a human-readable SMS body. When the dispatcher calls `sendSmsBody` with this as the `body` argument, eSMS will deliver `{"ref":"CH-...","contactName":"..."}` as the SMS text.
- Fix: Call `renderTemplate(template, payload)` before storing in `NotificationLog.payload` for SMS channel rows, or add charter templates to the `SmsTemplate` union and `renderTemplate` switch statement.

**P2-4: `NotificationLog` rows have no retention policy — they accumulate indefinitely.**

- File: `lib/jobs/retentionSweeper.ts` (no `NotificationLog` deletion), `prisma/schema.prisma:531-555`
- The retention sweeper scrubs guest Booking PII and purges KYB docs, but never deletes or anonymizes `NotificationLog` rows. `NotificationLog.recipient` contains the buyer's phone or email in plaintext. `NotificationLog.payload` contains rendered SMS bodies that may include route, departure time, booking ref, and (for operator SMS) buyer phone. These accumulate without bound.
- Impact: GDPR right-to-erasure requests require scrubbing recipient + payload on NotificationLog rows tied to a deleted customer. The current anonymizeCustomer path (`lib/account/anonymizeCustomer.ts`) likely does not cover NotificationLog.
- Fix: Add a retention window for NotificationLog rows (e.g. delete sent rows older than 90 days in the retentionSweeper), and ensure the customer anonymize path nulls/masks `recipient` on all related NotificationLog rows.

**P2-5: `email.ts` is always a stub — the `NOTIFY_STUB` flag is never consulted for the email channel.**

- File: `lib/notification/email.ts:106-123`
- Unlike `esms.ts` (which checks `notifyStubbed()`), `email.ts`'s `sendEmail` function always runs the stub path regardless of `NOTIFY_STUB`. There is no real email provider wired and no switch on `NOTIFY_STUB`. This means setting `NOTIFY_STUB=false` enables real eSMS but email notifications remain stubbed silently.
- Fix: Add a `NOTIFY_STUB` check to `sendEmail`, matching the eSMS pattern. Document explicitly that real email provider integration is pending.

---

## P3 — Advisory

**P3-1: `captureException` is a logger fallback, not a real alerting sink.**

- File: `lib/observability/sentry.ts:138-165`
- When `SENTRY_DSN` is unset (the current default), `captureException` routes to `logger.error` with `sentry:'fallback'`. The TODO comment at line 152 confirms the real Sentry forward is not yet implemented. A dispatch failure (5 retries exhausted) calls `captureException` per failed row, but in production those errors are only in the structured log — no alert fires, no on-call page triggers.
- Advisory: Wire a real Sentry DSN or substitute a PagerDuty/Slack webhook before go-live. The seam is clean; only `SENTRY_DSN` needs to be set.

**P3-2: No dead-letter visibility for exhausted NotificationLog rows.**

- File: `lib/notification/dispatchNotifications.ts:43` (`MAX_ATTEMPTS = 5`)
- After 5 failures, a row's `attemptCount` reaches `MAX_ATTEMPTS` and the claim query permanently excludes it. The row sits in `status='failed'` in the DB with no alert, no dashboard widget, no admin UI, and no automated sweep. Ops can only discover exhausted rows via raw SQL (`WHERE status='failed' AND "attemptCount" >= 5`).
- Advisory: Add a cron or admin UI query that surfaces exhausted rows (count by template + channel). Even a daily log line would improve visibility.

**P3-3: `sendReminders` uses `new Date()` for `reminderSentAt` and `sentAt`, not the `opts.now` clock.**

- File: `lib/jobs/sendReminders.ts:77` (`data: { reminderSentAt: new Date() }`), line 87 (`sentAt: result.ok ? new Date() : null`)
- The `JobCore` receives `opts` with a `now` parameter but ignores it, calling `new Date()` directly. This breaks deterministic time control in integration tests (the `now` override exists precisely for this purpose) and makes the reminder window test in CI dependent on wall-clock time.
- Advisory: Replace `new Date()` with `opts?.now ?? new Date()` consistent with the dispatcher pattern.

**P3-4: `claimDueRows` acquires row locks inside a short transaction then immediately commits (releasing the locks), then dispatches outside any transaction.**

- File: `lib/notification/dispatchNotifications.ts:82-96`
- The comment on line 78 correctly notes this: the row lock is only held during the claim transaction, not across the dispatch. The advisory lock (`'notify-dispatch'`) serializes whole ticks, so in practice a row claimed in tick N cannot be re-claimed in tick N+1 until tick N's dispatch loop completes and status is updated. However, if the Node.js process crashes mid-loop (after claim tx commits, before outcome update), the row remains in `status='pending'` and will be re-dispatched on the next tick — which is the intended at-least-once behavior. The eSMS `RequestId` idempotency key (the `NotificationLog.id`) handles the provider-side deduplication in this case. This is the correct design; no fix needed — documenting for clarity.

**P3-5: `@@unique([bookingId, template])` constraint does not apply to null-bookingId rows.**

- File: `prisma/schema.prisma:551`
- Notifications for operator/staff provisioning, charter lifecycle, and operator status changes all have `bookingId: null`. Multiple identical-template rows (e.g. two `operatorPending` SMS rows for the same operator) can be inserted without constraint violation. This is not a current bug (each enqueue happens after a state transition that is itself guarded), but adds risk if a service is called twice (e.g. idempotent re-submit of operator registration).
- Advisory: Consider adding a secondary unique index for null-bookingId rows on `(template, recipient)` or enforcing idempotency at the service layer before the log write.

---

## Throughput Model

| Parameter | Value | Source |
|-----------|-------|--------|
| Batch size | 50 rows/tick | `dispatchNotifications.ts:47` |
| Cron interval | 1 minute | `vercel.json` (`* * * * *`) |
| Nominal throughput | 50 notifications/min | |
| Vercel Hobby/Pro cron | 1 invocation/min max | Vercel plan limit |

**Burst scenario (flash sale — 500 bookings in 1 minute):**
- Each booking generates 2 notifications (customerBookingPaid + operatorNewBooking) = 1,000 rows enqueued.
- At 50 rows/tick, 1 tick/min: drain time = 1,000 / 50 = **20 minutes**.
- During this drain, customers experience notification delays up to 20 minutes after payment.
- If a second flash sale starts before the queue drains, the backlog compounds.

**Risk of permanent lag:** Not under normal load. At 50/min throughput, the system needs more than 50 notifications/min sustained to fall behind permanently. A sustained booking rate above ~25 bookings/min (each generating 2 notifications) would cause unbounded queue growth. For a bus-booking platform this is unlikely under normal conditions but possible during a large promotional event.

**Mitigation options:** Increase BATCH_SIZE (currently conservatively set; the limit is Vercel function timeout — 10s for Hobby, 60s for Pro); run two cron instances at 30s offset if Vercel plan allows sub-minute crons; or add a BATCH_SIZE configurable via env.

---

## Failure Handling

| Property | Value | Notes |
|----------|-------|-------|
| MAX_ATTEMPTS | 5 | `dispatchNotifications.ts:43` |
| Backoff formula | min(2^N, 30) minutes | N = post-failure attemptCount |
| Backoff schedule | 2m, 4m, 8m, 16m, 30m | For attempts 1-5 |
| Total retry window | ~60 minutes | From first failure to 5th attempt |
| Dead-letter mechanism | None | Exhausted rows silently stay `status='failed'` |
| Monitoring for exhausted rows | None automated | Requires manual SQL query |
| Exception alerting | `captureException` → `logger.error` fallback | Sentry not yet wired |
| Per-row isolation | Yes | A failure updates only the NotificationLog row, never the Booking (AC5) |
| Advisory lock on failure | Lock releases (xact-scoped) | Concurrent tick can run after failure |

The retry window of ~60 minutes covers transient eSMS outages (typical sub-1-hour). A longer provider outage (>60 minutes) will exhaust retries and silently drop notifications with no operator alert.

---

## Notification Type Inventory

| Template | Channel | Via Outbox | Body Pre-rendered | SMS Body Correct | Tested |
|----------|---------|-----------|------------------|-----------------|--------|
| `customerBookingPaid` | SMS | Yes | Yes (`renderTemplate`) | Yes | Unit + Int |
| `operatorNewBooking` | SMS | Yes | Yes (`renderTemplate`) | Yes | Unit + Int |
| `payout_scheduled` | SMS (audit only, not customer) | Yes | JSON payload | No (see P2-3) | Int (scheduledFor gating only) |
| `trip_cancelled` | SMS | Yes (`cancelTrip`) | JSON payload (`{ tripId, operatorId }`) | No (see P2-3) | — |
| `bookingReminder24h` | SMS | No (direct `sendSms` in tx) | Yes | Yes | — |
| `ticketReady` | Email | Yes | JSON payload | N/A | Unit (mock) |
| `operatorPending` | Email | Yes | JSON payload | N/A | Unit (mock) |
| `operatorApproved/Rejected/Suspended/UnderReview/Resubmit` | SMS + Email | Yes | JSON payload | No (JSON stored, not rendered) | Unit (mock) |
| `operatorAccountCreated` | Email | Yes | JSON payload | N/A | Unit |
| `staffTempPassword` | SMS | No (direct `sendSms`) | Yes (rendered before send) | Yes | Int |
| `operatorAdminTempPassword` | SMS | No (direct `sendSms`) | Yes (rendered before send) | Yes | Int |
| `charterSubmitted` | SMS + Email | Yes | JSON payload | No (JSON stored) | Unit (mock) |
| `charterMatched` | SMS + Email | Yes | JSON payload | No (JSON stored) | Unit + Int |
| `charterClaimWon` | SMS + Email | Yes | JSON payload | No (JSON stored) | Int |
| `charterReturnedToReview` | Email | Yes (inferred) | JSON payload | N/A | — |
| `charterDeclined` | Email | Yes (best-effort) | JSON payload | N/A | Unit (mock) |
| `otpCode` | SMS | No (direct `sendSms`, synchronous) | Yes | Yes | — |
| `customerBookingExpired` | SMS | Yes (inferred from reconcile) | Yes (inferred) | Yes | — |

**Key finding:** The majority of charter, operator status, and payout notification rows store raw JSON in `payload` rather than a pre-rendered SMS body string. When the dispatcher calls `sendSmsBody({ body: row.payload, ... })`, it passes `{"ref":"CH-..."}` as the SMS content to eSMS. This is correct for email (where the body is rendered server-side by the real email provider from a template), but incorrect for SMS (where `body` must be the final human-readable message text).

---

## Stub→Real Migration Risks

| Risk | Severity | Notes |
|------|----------|-------|
| `sendReminders` network I/O inside DB tx | P1 | Connection hold/timeout; fix required before go-live |
| Charter/status/payout SMS bodies are JSON, not rendered text | P1 | Real eSMS will deliver `{"ref":"..."}` as the SMS |
| `sendEmail` always stubs regardless of `NOTIFY_STUB` | P2 | No real email will be sent even when `NOTIFY_STUB=false` |
| `ticketReady` missing from `EmailTemplate` union and `SUBJECTS` | P2 | Subject defaults to generic `'BusBookVN'` |
| `charterDeclined` sent to `recipient: 'ops'` (not a real address) | P2 | Any real email provider will reject this |
| ESMS credentials not validated until `getEnv()` is called | Low | Covered by `superRefine` in `env.ts` — will fail fast at boot |
| `RequestId` truncated to 50 chars for eSMS | Low | `row.id` (cuid) is 25 chars, well within limit |
| Vietnamese diacritics in custom pickup detail | Handled | `IsUnicode` detection in `esmsClient.ts:52` |
| eSMS rate limits not handled | Low | Non-100 codes map to `ok:false`; standard retry will back off |
| Resend/SES bounces not handled | Low | Email adapter is fully stubbed; no bounce handling exists yet |
| `ESMS_SANDBOX=true` must be flipped to `false` for real messages | Deployment | Controlled by `getEnv().ESMS_SANDBOX` |

---

## Test Coverage

| Component | Unit Test | Integration Test | Assessment |
|-----------|-----------|-----------------|------------|
| `dispatchNotifications` (core) | Yes — full failure/success/claim/AC5 | Yes — sent/dedup/concurrent/scheduledFor/nextAttemptAt | Strong |
| `dispatchNotifications` (cron route) | Yes — auth/skipped-locked/500 | No (mocked runJob) | Adequate |
| `sendEmail` (stub) | Yes — ok/structured-payload/never-throws/subject | No | Adequate for stub |
| `sendSms`/`renderTemplate` (stub) | Yes — template rendering, ok:true | No | Adequate for stub |
| `postEsms` (real HTTP client) | Yes — 100/non-100/timeout/network-error/RequestId | No | Good for the HTTP boundary |
| `sendReminders` | No dedicated unit test | No | Missing — no coverage of reminder logic |
| `notificationLogRepo` | Via integration tests of callers | Covered indirectly | Adequate |
| Charter notification enqueue | Unit (mock createNotificationLog) | claimCharter.int (counts rows) | Partial — body content not verified |
| Operator status notification enqueue | Unit (mock createNotificationLog) | No | Partial |
| Staff/operator direct-send path | Integration (log content verified, no tempPassword in payload) | Yes | Good for PII; no failure-path coverage |
| generateTicketPdfs notification enqueue | Unit (mock createNotificationLog) | No | Partial |

---

## Recommendations

1. **[P1 — Before go-live]** Fix `sendReminders` to use claim-then-dispatch: set `reminderSentAt` inside the advisory-lock tx (the claim), then send SMS outside the tx. See `withAdvisoryLock.ts` V1 note for the pattern already documented.

2. **[P1 — Before go-live]** Fix charter/operator-status/payout SMS payloads to store pre-rendered body strings (call `renderTemplate` before storing), matching the pattern used in `processWebhook.ts` for `customerBookingPaid` and `operatorNewBooking`. Add charter templates to the `SmsTemplate` union and `renderTemplate` switch.

3. **[P1 — Before go-live]** Fix direct-send paths (`createOperator`, `resetOperatorAdminPassword`, `createStaff`) to either: (a) store a pre-rendered body as `payload` and use `status='pending'` so the dispatcher can retry, or (b) write `attemptCount = MAX_ATTEMPTS` on the log row so exhausted rows are not re-dispatched with garbled JSON content.

4. **[P2 — Before go-live]** Wire a real `sendEmail` implementation behind the `NOTIFY_STUB` seam. Add `'ticketReady'` to the `EmailTemplate` union and `SUBJECTS` map. Fix `charterDeclined` recipient to a real ops email address from `getEnv()`.

5. **[P2 — Before go-live]** Add a `NotificationLog` retention sweep to `retentionSweeper.ts`: delete `status='sent'` rows older than 90 days, and null/mask `recipient` on rows linked to anonymized bookings. Verify `anonymizeCustomer.ts` handles NotificationLog.

6. **[P2 — Before go-live]** Wire Sentry DSN (`SENTRY_DSN` env var) so `captureException` on dispatch failure produces actionable alerts, not just log lines.

7. **[P3 — Post go-live]** Add a monitoring query or admin UI panel for `status='failed' AND attemptCount >= 5` rows. Consider a daily summary log from the retention sweeper (or a dedicated dead-letter cron) that emits the count.

8. **[P3]** Replace `new Date()` with `opts?.now ?? new Date()` in `sendReminders.ts` (lines 77 and 87) for deterministic test control.

9. **[P3]** Add a unit test for `sendReminders` covering: reminder sent, `reminderSentAt` stamped, `NotificationLog` row created, already-reminded booking skipped, booking outside 23-25h window skipped.

10. **[P3]** For the burst-sale scenario, evaluate increasing `BATCH_SIZE` from 50 to 100+ or consider making it an env-configurable constant. Document the Vercel function timeout limit as the constraint.
