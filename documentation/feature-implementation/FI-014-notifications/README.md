# FI-014: Notifications (Thong bao)

> **Status:** DOCUMENTED
> **Last Updated:** 2026-06-20
> **Related:** ADR-012, ADR-013, DS-001, DS-003, DS-006, FD-029

## Overview

The Notification system is a cron-driven outbox pattern using `NotificationLog` as the persistent queue. The primary channel is SMS via eSMS.vn (Vietnam aggregator, 95-99% delivery rate), with Zalo ZNS as the aspirational primary channel (NOT YET IMPLEMENTED) and Resend as email supplementary. Latency-sensitive notifications (OTP, booking confirmation, trip cancellation) use Next.js `after()` for sub-second dispatch alongside the outbox. The system enforces I9: phone number stored in `NotificationLog.recipient` only, NEVER duplicated in `payload` JSON.

## Scope & Boundaries

### In Scope

- SMS via eSMS.vn: OTP, booking confirmation, trip cancellation, departure reminder, refund, operator new-booking alert, payout scheduled, KYB status change, license expiry warning, booking expiry
- Email via Resend: supplementary to SMS (booking confirmation, KYB status)
- Cron-based outbox dispatch (`notificationDispatch` job, every 1 min)
- `after()` acceleration for latency-sensitive paths (OTP, booking confirmation, trip cancellation, payment webhooks)
- Exponential backoff retry via `attemptCount` and `nextAttemptAt`
- `scheduledFor` as top-level indexed column (NOT payload JSON key) for payout_scheduled dispatch
- Channel waterfall: ZNS -> 60s wait -> SMS fallback (documented; ZNS not yet active)
- Frontend toast system, operator notification center, `/op/activity` feed
- Polling-based real-time updates (no WebSocket/SSE in v1)

### Out of Scope

- Zalo ZNS integration: documented as primary, NOT YET IMPLEMENTED (eSMS is actual primary) -> future issue
- Push notifications (mobile app): not planned for v1
- WebSocket/SSE real-time updates: deferred post-launch
- Marketing SMS campaigns and DNC registry checking -> future issue
- OTP delivery mechanics (rate limiting, lockout) -> [FI-001](../FI-001-core-auth/README.md)
- Payment webhook side effects -> [FI-008](../FI-008-payment-integration/README.md)
- KYB status change notifications (trigger side) -> [FI-002](../FI-002-operator-onboarding/README.md)
- Trip cancellation SMS (trigger side) -> [FI-005](../FI-005-trip-management/README.md)

### Bounded Context(s)

**Notification Context** -- Models: `NotificationLog`. Services: `lib/notification/dispatchNotifications.ts`, `lib/notification/email.ts`, `lib/notification/esms.ts`, `lib/notification/esmsClient.ts`. Repo: `lib/core/db/notificationLogRepo.ts`.

**Dependencies on other FI features:**
- All domains produce `NotificationLog` rows: [FI-007](../FI-007-booking-flow/README.md) (Booking), [FI-005](../FI-005-trip-management/README.md) (Trip), [FI-002](../FI-002-operator-onboarding/README.md) (KYB), [FI-010](../FI-010-payout-system/README.md) (Payout)
- eSMS.vn account with brandname registration (2-4 weeks lead; hard blocker before go-live)
- Upstash Redis: rate limiting for OTP send (5 per 15 min per IP+phone)
- Resend (email): FCT withholding 5% CIT + 5% VAT required; CDTIA/DPA required

## Key Entities

| Model | Key Columns | Constraints | Notes |
|-------|-------------|-------------|-------|
| NotificationLog | id (CUID PK), bookingId? (@db.Uuid FK->Booking onDelete:Cascade), channel (NotificationChannel default sms), template (String), recipient (String -- sole PII column per I9), payload (String -- JSON, must NOT contain phone), status (NotificationStatus default pending), externalRef? (eSMS SMSID or Resend msg ID), sentAt?, scheduledFor? (top-level indexed column), attemptCount (default 0), nextAttemptAt?, lastError?, createdAt | Partial unique: `[bookingId, template]` WHERE bookingId IS NOT NULL; composite `@@index([status, nextAttemptAt])`; composite `@@index([template, scheduledFor])` | `recipient` = phone for SMS, email for email channel. `scheduledFor` is the cron predicate column for payout_scheduled dispatch (NEVER in payload JSON -- Mistake Log Issue 014) |

**Indexes on NotificationLog:**

| Index | Columns | Purpose |
|-------|---------|---------|
| Partial unique | `[bookingId, template]` WHERE bookingId IS NOT NULL | Dedup per-booking notifications; null-bookingId rows (OTP/system) bypass |
| Standard | `[bookingId]` | Per-booking notification lookup |
| Composite | `[template, scheduledFor]` | Scheduled dispatch cron: `WHERE template = 'payout_scheduled' AND scheduledFor <= NOW()` |
| Composite | `[status, nextAttemptAt]` | Notification dispatch cron: `WHERE status = 'pending' AND (nextAttemptAt IS NULL OR nextAttemptAt <= NOW())` |

**Enums relevant to FI-014:**

| Enum | Values |
|------|--------|
| NotificationChannel | `sms`, `email` |
| NotificationStatus | `pending`, `sent`, `failed` |

## API Endpoints

Notifications are system-internal (no customer-facing notification API). Relevant endpoints:

| Method | Path | Auth | Description | Status Codes |
|--------|------|------|-------------|--------------|
| POST | `/api/auth/otp/send` | Public (rate-limited) | Side effect: OTP SMS enqueued via notification system. `after()` dispatch for latency. Rate: 5 req / 15 min per IP+phone | 200, 429, 403 |
| GET | `/api/cron/notification-dispatch` | Cron secret | `notificationDispatch` job. Every 1 min. Predicate: `status = 'pending' AND (nextAttemptAt IS NULL OR nextAttemptAt <= NOW())`. Uses `FOR UPDATE SKIP LOCKED` | 200 |

### eSMS API Reference

| Parameter | Value | Notes |
|-----------|-------|-------|
| Endpoint | `POST https://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_post_json/` | |
| Auth | `ApiKey` + `SecretKey` | |
| Phone format | `84xxxxxxxxx` (no `+` prefix) | |
| SmsType | `"2"` (brandname) or `"7"` (random) | Brandname requires registration |
| RequestId | UUID, max 50 chars, valid 24h | Idempotency key |
| CallbackUrl | Delivery confirmation webhook | |

### eSMS Error Codes

| Code | Meaning |
|------|---------|
| 100 | Accepted (not delivered -- use CallbackUrl for delivery confirmation) |
| 99 | Invalid request |
| 101 | Auth failed |
| 103 | Insufficient balance |
| 104 | Brandname not found |
| 108 | Invalid phone format |
| 124 | Duplicate RequestId |
| 140 | IP not whitelisted |
| 146 | Template not registered |

## State Machine

### NotificationLog Status Transitions

```
States: pending | sent | failed

Transitions:
  (creation)  -> pending:  any domain enqueues notification
  pending     -> sent:     cron dispatches via eSMS/Resend; externalRef + sentAt set
  pending     -> failed:   dispatch fails (eSMS error, network timeout); lastError set;
                           attemptCount incremented; nextAttemptAt set (exponential backoff)
  failed      -> pending:  retry eligibility: attemptCount < MAX_ATTEMPTS AND
                           nextAttemptAt <= NOW(); cron re-picks up
```

### Channel Waterfall (documented; ZNS NOT YET IMPLEMENTED)

```
ZNS attempt -> wait 60s -> check ZNS delivery status
  +-- Delivered: done
  +-- Not delivered: SMS fallback via eSMS
       +-- Sent: done
       +-- Failed: retry with exponential backoff
```

**Actual current behavior** (eSMS is primary, no ZNS):

```
eSMS SMS attempt -> CodeResult 100 (accepted by eSMS)
  +-- Delivery confirmed via CallbackUrl: sentAt set
  +-- Dispatch error: lastError set, nextAttemptAt calculated, retry by cron
```

## Business Rules & Invariants

1. **I9 -- No Raw Phone in Payload** -- `NotificationLog.recipient` carries the phone number. The `payload` JSON field MUST NOT duplicate the phone number. Enforcement: code review rule in `lib/trips/cancelTrip.ts`, `lib/trips/reassignBus.ts`, all notification producers. No automated linter check currently.

2. **Decree 91/2020 -- Transactional SMS** -- OTP, booking confirmations, departure reminders are transactional. NO consent required, NO DNC check, NO time restriction. Template classified at creation time.

3. **Decree 91/2020 -- Marketing SMS** -- Explicit opt-in required (`ConsentRecord.consentType: 'marketing_sms'`). No sends 10PM-8AM. DNC registry check required. Violation fine: 60-80M VND.

4. **Brandname Registration** -- Required for SmsType `"2"` (OTP/CSKH). 5-10 business day carrier approval. Hard go-live blocker.

5. **Template Pre-registration** -- All SMS templates must be pre-approved with carriers before use. Unregistered template returns eSMS CodeResult `146`.

6. **`after()` Exemption (ADR-013 D4)** -- OTP, booking confirmation, trip cancellation, payment webhook notifications are dispatched immediately via Next.js `after()` post-commit, NOT waiting for the 1-min cron cycle.

7. **scheduledFor Rule (Mistake Log Issue 014)** -- Any field that is a WHERE predicate for a cron/sweeper MUST be a top-level indexed column, NEVER a JSON payload key. The payout_scheduled template uses `scheduledFor` column with composite index `[template, scheduledFor]`.

8. **Rate Limit: OTP Send** -- 5 requests / 15 min per IP + phone. Upstash Redis ratelimit. Fails OPEN on Redis downtime (no in-memory fallback).

9. **Retry Backoff** -- Exponential backoff via `nextAttemptAt`. `attemptCount` incremented per failure. Cron re-picks failed rows only when `nextAttemptAt <= NOW()`.

10. **PDPL 2025 / I9** -- Phone number in `recipient` column only. Log-redacted via `piiLogger`. No phone in `payload` JSON.

11. **Resend (Email) -- Regulatory** -- Foreign contractor tax: 5% CIT + 5% VAT withheld on Resend payments. DPA + CDTIA filing required within 60 days.

12. **DNC Registry** -- Transactional SMS exempt. Marketing SMS must check VNPT DNC under MOIT. Implementation gate for marketing campaigns.

## Frontend Surfaces

### Toast System (FD-029)

| Type | Color | Auto-dismiss | ARIA Role |
|------|-------|-------------|-----------|
| Success | Green | 4 seconds | `role="status"` |
| Error | Red | 8 seconds | `role="alert"` |
| Warning | Amber | 8 seconds | `role="alert"` |
| Info | Blue | 4 seconds | `role="status"` |
| Action Required | Orange | Persistent | `role="alert"` |

- Desktop: top-right, 360px wide
- Mobile: top-center, full-width
- Max 3 visible; oldest dismissed on 4th
- Keyboard dismiss: Escape key

### Operator Notification Center

| Surface | Description |
|---------|-------------|
| Bell icon | In ConsoleHeader with unread badge (max "99+") |
| Bell dropdown | Last few notifications with icons and deep links |
| `/op/activity` | Full notification list, grouped by date, infinite scroll 20/page, "Danh dau tat ca da doc" button |

**Deep link targets:**
- New booking -> `/op/bookings/{id}`
- Payout -> `/op/money`
- KYB status -> `/op/settings`

### Polling Configuration (no WebSocket/SSE in v1)

| Surface | Interval | Notes |
|---------|----------|-------|
| Dashboard | 60 seconds | |
| Notification badge count | 60 seconds | |
| Payment status check | 2 seconds | Booking confirmation page only |
| Pause on tab hidden | Yes | Visibility API gated |
| Network-aware | Yes | 120s on 2G |
| Error backoff | Yes | Double interval, max 300s |

### Zalo OA Follow Prompt

Non-blocking banner post-booking. `localStorage` 30-day dismiss.

### SMS/ZNS Templates

| Template | Channel | Trigger | Dispatch Method |
|----------|---------|---------|-----------------|
| OTP | SMS (eSMS SmsType "2") | `/api/auth/otp/send` | `after()` |
| Booking confirmation (cash) | SMS | Hold consumed, cash method | `after()` |
| Booking confirmation (paid) | SMS | Payment webhook success | `after()` |
| Staff temp password | SMS | `createStaff` | `after()` |
| Booking reminder (24h) | SMS | `24hSmsReminder` cron | Cron |
| Booking expired | SMS | `expireHolds` cron | Cron |
| Departure reminder | SMS | Cron (24h before departure) | Cron |
| Trip delay/cancellation | SMS | `cancelTrip` service | `after()` |
| Refund processed | SMS | `refundOut` service | Cron |
| New booking (operator) | SMS | Payment webhook success | `after()` |
| Payout scheduled | SMS | `completeTripCore` | Cron (`scheduledFor`) |
| KYB status change | SMS + email | `transitionOperatorStatus` | Cron |
| License expiry warning | SMS | `operatorLicenseAlert` cron | Cron |

## Regulatory Requirements

| Regulation | Requirement | Status |
|------------|-------------|--------|
| Decree 91/2020 -- Transactional | OTP/transactional SMS = no consent, no DNC, no time restriction | Implemented by template type classification |
| Decree 91/2020 -- Marketing | Marketing SMS = explicit consent, no 10PM-8AM, DNC check; violation = 60-80M VND fine | Marketing not yet implemented |
| Decree 91/2020 Art. 12 | Brandname SMS registration required for commercial communications | Requires 2-4 week carrier approval; go-live blocker |
| PDPL 2025 | Phone PII in `recipient` only; I9 invariant; log redaction | I9 enforced; `piiLogger` redact list |
| FCT on Resend | Foreign contractor tax: 5% CIT + 5% VAT withholding on Resend payments | DPA + CDTIA required |
| Zalo ZNS | Requires Zalo OA verification with business registration documents; ~200-500 VND/msg; 75M MAU | NOT YET IMPLEMENTED |
| Consumer Protection Law 2023 | Email + Zalo OA minimum viable customer support | Zalo OA not yet verified |

## Testing Strategy

### Unit Tests

- `dispatchNotifications.ts`: template rendering with each template + variable substitution
- I9 invariant: assert `payload` object does NOT contain `phone` key (automated check)
- `scheduledFor` column: assert value NOT in `payload` JSON (dual-source drift guard per Issue 014)
- eSMS client: `CodeResult` parsing, idempotency via `RequestId`, error code handling (99, 101, 103, 104, 108, 124, 140, 146)
- `requestId` generation: `uuid()` output must be max 50 chars (eSMS limit)

### Integration Tests

- `notificationDispatch` cron with real DB: `FOR UPDATE SKIP LOCKED` batch pickup; `status -> sent` on success; `attemptCount` increment + `nextAttemptAt` set on failure
- `NotificationLog_bookingId_template_key` partial unique: null `bookingId` rows bypass uniqueness; non-null rows deduplicate by `[bookingId, template]`
- `after()` dispatch tests: OTP path enqueues immediately post-commit
- `scheduledFor` predicate: `payout_scheduled` row with `scheduledFor <= NOW()` is picked up by cron sweep; `scheduledFor > NOW()` is skipped
- Exponential backoff: `nextAttemptAt` calculated correctly per `attemptCount`

### E2E Tests

- OTP flow end-to-end: send -> receive -> verify (sandbox mode: `ESMS_SANDBOX="true"`, `CodeResult: "100"`)
- Booking confirmation: payment webhook -> `NotificationLog` `status = 'sent'` within 60s
- Toast system: booking error shows red toast with 8s dismiss; success shows green toast with 4s dismiss
- `primeCsrf()` before all POST mutations
- `sendSms` mock must stub `esmsClient.ts` POST method name exactly (not just module export)

## Cross-References

- **Architecture Decisions:** [ADR-012](../../architecture-decisions/ADR-012-background-jobs/README.md), [ADR-013](../../architecture-decisions/ADR-013-notification-architecture/README.md)
- **Design Specifications:** [DS-001](../../design-specifications/DS-001-data-model/README.md) (section 2.8), [DS-003](../../design-specifications/DS-003-api-contract/README.md) (section 10), [DS-006](../../design-specifications/DS-006-background-jobs/README.md)
- **Frontend Design:** [FD-029](../../frontend-design/FD-029-notifications/README.md)
- **Business/Domain:** [bounded-contexts.md](../../business/domain-model/bounded-contexts.md)
- **Regulatory:** [telecom-sms.md](../../business/regulatory/telecom-sms.md)
- **Guides:** [esms-registration-guide.md](../../guides/esms-registration-guide.md)
- **Scaffolding:** [SI-005](../../scaffolding-infra/SI-005-testing-strategy/README.md)
- **Invariants:** [invariants-catalog.md](../../business/domain-model/invariants-catalog.md) (I9)
- **Related FIs:** [FI-001](../FI-001-core-auth/README.md) (OTP delivery), [FI-002](../FI-002-operator-onboarding/README.md) (KYB status notifications), [FI-005](../FI-005-trip-management/README.md) (trip cancellation SMS), [FI-007](../FI-007-booking-flow/README.md) (booking confirmation), [FI-008](../FI-008-payment-integration/README.md) (payment webhook side effects), [FI-010](../FI-010-payout-system/README.md) (payout scheduled)

## Known Gaps & Open Questions

- **HIGH -- ZNS NOT IMPLEMENTED**: Documented as primary channel; actual primary is eSMS SMS. No Zalo OA verification started. Channel waterfall is currently SMS-only.
- **HIGH -- Brandname SMS registration**: 2-4 week hard blocker. Must start the process before targeting any go-live date. Requires eSMS dashboard + carrier approval.
- **HIGH -- NOTIFY_STUB default in production**: Must confirm `NOTIFY_STUB="false"` in production env; accidental stub mode silences all SMS.
- **MEDIUM -- OTP dispatch conflict**: Three conflicting descriptions: ADR-012 says `after()`-accelerated, ADR-013 says cron-only for non-OTP, actual code uses inline `sendSms()` in `lib/auth/otp.ts`. Reconciliation needed.
- **MEDIUM -- Marketing consent flow**: `ConsentRecord.consentType: 'marketing_sms'` exists in schema but no opt-in UI or DNC check implemented.
- **MEDIUM -- Resend DPA + CDTIA**: Required for email compliance under PDPL 2025; not confirmed as done.
- **MEDIUM -- No delivery confirmation loop**: `CallbackUrl` for eSMS delivery status is documented but implementation status unclear. `externalRef` stores SMSID but delivery confirmation write-back not confirmed.
- **MEDIUM -- Rate limiter fails OPEN**: Redis downtime = no OTP rate limiting; no in-memory fallback.
- **LOW -- Zalo OA customer support**: Required for Consumer Protection Law 2023 compliance; Zalo OA account/verification not started.
- **LOW -- Payment recon sweeper**: `paymentReconSweeper` (every 30 min) documented in job catalog but implementation status unclear.
- **LOW -- `completeBooking` notification**: When operator marks booking `completed`, no notification template defined in documentation.
