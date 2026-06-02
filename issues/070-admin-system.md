---
depends-on: [056-admin-middleware-segment, 060-db-feature-flag-store, 057-admin-bootstrap-totp-recovery, 062-admin-audit-immutability]
type: FEATURE
wave: 3
spec: [S11, SYS17, SYS13]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [S11] (System tab)

## What to build

Admin **System** tab — feature flags + payment-rail toggles, admin account management
(invite/revoke/roles — super-admin only), audit log (read-only, exportable).

- Feature-flag + payment-rail toggle UI over the DB flag store (issue 060) incl.
  `PAYMENTS_STUB` surface; changes audit-logged. Kill-switches.
- **Admin accounts**: invite (issue 057 primitive), revoke, assign roles — **super-admin
  only**; step-up required.
- **Audit log** viewer: read-only, **exportable**; reads the immutable `AdminAuditLog`
  (issue 062).

## Acceptance criteria

- [ ] Flag/rail toggle UI over DB flag store; changes audit-logged; kill-switches work.
- [ ] Admin invite/revoke/role management (super-admin only, step-up).
- [ ] Audit-log viewer is read-only + exportable.
- [ ] Behind admin auth; super-admin gating on account management.

## Blocked by

- Blocked by `issues/056-admin-middleware-segment.md`, `issues/060-db-feature-flag-store.md`,
  `issues/057-admin-bootstrap-totp-recovery.md`, `issues/062-admin-audit-immutability.md`

## User stories addressed

- [S11] admin System: flags + rail toggles, admin accounts, audit export.
