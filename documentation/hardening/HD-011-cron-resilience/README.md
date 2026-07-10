# HD-011: Cron & Background Job Resilience

> Status: NOT_STARTED | References: DS-006, FI-010, FI-014, FI-015

## Purpose

Verify that all cron jobs and background tasks are resilient: idempotent re-entry, correct batch sizing, missed-cron detection, and proper response contracts. A missed or stuck cron can strand payments, expire holds incorrectly, or silently stop notifications.

## Skill Invocation

- **Primary**: `/observability-review` -- cron health monitoring
- **Supplementary**: `/chaos-drill` -- missed-cron simulation

## Acceptance Criteria

### Cron Response Contract (DS-006 Section 2.3)

- [ ] Every cron endpoint returns: `{ job, status, rowsAffected, durationMs }`
- [ ] No cron returns raw strings or unstructured responses
- [ ] HTTP 200 for successful execution (even if zero rows affected)
- [ ] HTTP 500 only for unexpected errors (not "nothing to process")

### Cron Job Inventory (All 16 Endpoints)

Verify each cron is implemented, tested, and has correct scheduling:

**Implemented:**
- [ ] `holdExpiry` -- 10-min TTL sweep, batch 500, `FOR UPDATE SKIP LOCKED`
- [ ] `settlePayout` -- T+3 eligible payouts, batch 500, `FOR UPDATE SKIP LOCKED`
- [ ] `notificationDispatch` -- pending notifications, batch 100
- [ ] `salesClose` -- auto-close sales N hours before departure

**Not Yet Built (FI-002, FI-013, FI-008 gaps):**
- [ ] `operatorLicenseAlert` -- license expiry warning (FI-002 dependency)
- [ ] `piiAnonymization` -- anonymize PII past retention period (FI-013, schema ready)
- [ ] `memoMismatchSweep` -- periodic check for unmatched bank transfers awaiting admin reconciliation (~5% of SePay webhooks have no extractable bookingRef)
- [ ] `strandedPayoutRecovery` -- recover `processing` payouts stuck > threshold

**Status for unbuilt crons:**
- [ ] Each unbuilt cron has explicit deferral documented with implementation timeline
- [ ] OR: all unbuilt crons implemented before go-live

### Idempotent Re-Entry

- [ ] Every cron is safe to invoke twice in a row (no double-processing)
- [ ] `FOR UPDATE SKIP LOCKED` prevents concurrent cron instances from processing same rows
- [ ] If cron is interrupted mid-batch: next run picks up remaining rows without data loss

### Missed-Cron Detection (ADR-007 P4)

- [ ] Alert fires if any cron misses its expected invocation window
- [ ] Detection method documented:
  - [ ] Heartbeat: cron writes `lastRunAt` to health table; sweeper checks staleness
  - [ ] OR: external monitoring (BetterStack heartbeat URL pinged by each cron)
  - [ ] OR: log-based detection (structured log absence triggers alert)
- [ ] Alert routing: notification reaches on-call within 5 minutes of missed window

### Batch Sizing & Lock Contention

- [ ] Hold expiry: batch 500 with `SKIP LOCKED` (no lock wait on concurrent sweep)
- [ ] Payout settlement: batch 500 with `SKIP LOCKED`
- [ ] Notification dispatch: batch 100 (smaller batch = faster per-iteration for time-sensitive delivery)
- [ ] No cron processes unbounded row sets (always `LIMIT` or batch loop)

### Timezone & Scheduling

- [ ] Cron schedules documented (not hardcoded in application)
- [ ] Business-date-sensitive crons (payout settlement, license alert) use Vietnam local date, not UTC
- [ ] `scheduledFor` column on NotificationLog: composite `@@index([template, scheduledFor])` exists (Mistake Log Issue 014 rule)
- [ ] No cron queries use `payload->>'field'` predicates (must be top-level indexed columns)

### CRON_SECRET Authentication

- [ ] All cron endpoints require `CRON_SECRET` header
- [ ] `CRON_SECRET` generated with sufficient entropy (>= 32 bytes)
- [ ] Cron endpoints not accessible without valid secret (returns 401)

## Verdict

**PASS** when: all implemented crons return correct contract shape, idempotent re-entry verified, missed-cron detection active, and unbuilt crons have documented deferral with timeline.

## Cross-References

- DS-006 -- cron job design (batch sizes, response contract, scheduling)
- FI-010 -- payout system (`settlePayout` cron)
- FI-014 -- notification system (`notificationDispatch` cron)
- FI-015 -- e-invoice system (invoice generation timing)
- FI-002 -- operator onboarding (`operatorLicenseAlert` cron)
- FI-013 -- customer account (`piiAnonymization` cron)
- ADR-007 P4 -- missed-cron alert path
- HD-009 -- financial integrity (payout pipeline resilience)
