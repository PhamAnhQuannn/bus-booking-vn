---
depends-on: [077-kyb-doc-submit, 043-harden-generate-trips-cron-lock]
type: FEATURE
wave: 7
spec: [SYS13, S04]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [SYS13] / [S04]

## What to build

A **retention policy job** for guest PII + KYB docs. Today there's no retention job; erase is
anonymize-in-place (`anonymizeCustomer.ts`) but it doesn't scrub `Booking` guest-snapshot PII
and there's no scheduled retention.

- Retention policy: define max-retention windows for guest PII (buyer name/phone/email
  snapshot on old, settled bookings) + KYB docs (after a decision + window). Document the
  windows.
- Cron (run-locked, issue 043 pattern): anonymize/scrub guest-snapshot PII on bookings past
  the retention window (retain money/audit/financial totals per [S04] — erase ≠ delete
  financial history); purge/expire KYB docs from storage (issue 059) past their window.
- Predicate columns top-level + indexed (Mistake-Log Issue 014).
- Extend `anonymizeCustomer` so account-deletion also scrubs the booking guest snapshot (the
  PARTIAL flagged in `rebuild-mismatches.md`).

## Acceptance criteria

- [ ] Retention windows defined + documented (guest PII, KYB docs).
- [ ] Run-locked cron anonymizes expired guest-snapshot PII (money/audit retained).
- [ ] KYB docs purged from storage past their window.
- [ ] Account-deletion anonymize now also scrubs the booking guest snapshot.
- [ ] Predicate columns top-level + indexed; integration test on the sweep.

## Blocked by

- Blocked by `issues/077-kyb-doc-submit.md`,
  `issues/043-harden-generate-trips-cron-lock.md`

## User stories addressed

- [SYS13]/[S04] retention policy on guest PII + KYB docs; anonymize-in-place erase.
