---
depends-on: [038-scaffold-lib-core-tenant-helper-lint]
type: FEATURE
wave: 2
spec: [SYS17, S11]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [SYS17]

## What to build

A **DB-backed feature-flag store** + cached read helper. Today only static env flags exist
(`PAYMENTS_STUB`, and `NOTIFY_STUB` from issue 058) — no runtime-toggleable flags, no
kill-switches, no admin toggle. Spec [SYS17]: flag store (env + DB), read helper cached,
admin System-tab UI (the UI is Wave 3; this is the store + helper).

- `model FeatureFlag(key unique, enabled, value?, updatedBy, updatedAt)` + migration.
- Read helper `getFlag(key)` with a short cache (in-process/Redis TTL) so reads are cheap;
  env flags remain the source for `*_STUB` infra toggles, DB flags for runtime feature gates
  + payment-rail toggles + kill-switches.
- Resolution order documented (env override vs DB). Changing a flag is audit-logged
  (`AdminAuditLog`) — write path used by the Wave 3 System tab.
- NOTE ([SYS17]): `FeeConfig` (issue 048) is NOT a flag — keep them separate.

## Acceptance criteria

- [ ] `FeatureFlag` model + migration; `getFlag(key)` cached read helper.
- [ ] Payment-rail toggles + kill-switches representable as DB flags; `*_STUB` stay env.
- [ ] Resolution order (env vs DB) documented + tested.
- [ ] Flag changes audit-logged.
- [ ] FeeConfig is not modeled as a flag.

## Blocked by

- Blocked by `issues/038-scaffold-lib-core-tenant-helper-lint.md`

## User stories addressed

- [SYS17] toggle behavior + rails without redeploys; kill-switches; admin-controlled.
