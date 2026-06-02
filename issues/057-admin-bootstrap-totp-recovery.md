---
depends-on: [054-admin-auth-core, 055-admin-totp-step-up]
type: FEATURE
wave: 1
spec: [S10]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [S10] (security-critical)

## What to build

**First super-admin bootstrap** + **lost-TOTP recovery** — close the two operational
dead-ends of an invite-only admin realm.

- **Bootstrap**: provision the first `SUPER_ADMIN` out-of-band — a migration seed OR a
  sealed env-credential path (NOT a public route). Idempotent (re-run doesn't create dupes).
  Document the procedure + where the sealed credential lives. The first admin then invites
  the rest (invite flow under super-admin; full invite UI is Wave 3 System tab, but the
  invite service primitive ships here).
- **Lost-TOTP recovery**: reset by ANOTHER super-admin (reset target's `totpSecret`, force
  re-enrollment on next login). If no other super-admin exists → a documented sealed
  break-glass procedure. **No self-service reset.** No operational dead-end.
- Audit-log bootstrap + every recovery action (who/what/when) via `AdminAuditLog`.

## Acceptance criteria

- [ ] Bootstrap provisions exactly one initial super-admin out-of-band; idempotent on re-run;
      no public path.
- [ ] A super-admin can reset another admin's TOTP (forces re-enrollment); target cannot
      self-reset.
- [ ] Sealed break-glass procedure documented for the "no other super-admin" case.
- [ ] Bootstrap + TOTP-reset actions audit-logged.
- [ ] Invite primitive exists (super-admin creates an AdminUser invite).

## Blocked by

- Blocked by `issues/054-admin-auth-core.md`, `issues/055-admin-totp-step-up.md`

## User stories addressed

- [S10] first super-admin bootstrap + lost-TOTP recovery (no dead-ends).
