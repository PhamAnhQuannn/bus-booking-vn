# Migration chain anomalies (informational)

Recorded 2026-08-02. **No migration is edited to fix these** — committed migrations are
immutable (project rule); the chain applies cleanly and the DB is correct. This note exists
so a future reader doesn't mistake these for corruption.

## 1. Duplicate timestamp prefix

Two directories share the prefix `20260610000000`:

- `20260610000000_pickup_area_kind_default_station`
- `20260610000000_route_pickup_areas`

Prisma orders migrations lexicographically by full directory name, so the tie breaks on the
suffix (`pickup_area_kind…` before `route_pickup_areas`) — deterministic and benign. Both are
part of the pickup-area feature that was later removed (`20260622100000_remove_pickup_area_system`),
so neither affects the current schema.

## 2. Near-duplicate issue_010 pair

- `20260519042901_issue_010_operator_auth`
- `20260519042906_issue_010_operator_auth`

Same issue, authored 5 seconds apart; both are real, sequential migrations (the second continues
the operator-auth work). Not a duplicate to collapse.

## 3. Inconsistent `down.sql` coverage

Only the three earliest migrations carry a `down.sql`:

- `20260518052219_booking_v1`
- `20260518161139_issue_004_payment_event`
- `20260519003311_issue_007_auth`

The remaining 77 have none. Prisma does not use `down.sql` for `migrate deploy`; rollback in this
project is by **forward migration** (see the `*-safety.md` files in this directory for the
per-migration reverse plans that matter). The early `down.sql` files are historical and not relied
upon.
