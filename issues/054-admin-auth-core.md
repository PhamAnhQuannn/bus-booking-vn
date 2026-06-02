---
depends-on: [038-scaffold-lib-core-tenant-helper-lint]
type: FEATURE
wave: 1
spec: [S10, SYS02, SYS18]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [S10] / [SYS02] (security-critical — do not compress)

## What to build

The admin **credential store + auth core** (third realm). Today no admin auth exists; only
`AdminAuditLog` + CLI fns. Spec [S10]: admin in a **distinct table/role**, never in
customer/operator tables, **invite-only (no self-registration)**, email + password.

- `model AdminUser(id, email unique, passwordHash, role, totpSecret?, totpEnabledAt?,
  invitedBy?, status, createdAt)` — **distinct table**, separate from Customer/Operator.
- `AdminRole` enum: `SUPER_ADMIN | FINANCE | SUPPORT` (least-privilege tiers).
- Email + password auth (Argon2/bcrypt per existing customer hash scheme); **no public
  registration route** — accounts created only by invite (super-admin) or bootstrap (issue
  057).
- Admin session = its own JWT realm + cookie scope (distinct cookie name, not `bb_rt`),
  stateless rotating refresh per existing `lib/auth/session.ts` pattern, **short TTL** +
  strict rate-limit on the login route.
- Cross-realm rejection: admin token rejected by customer/operator verifiers and vice-versa
  (extend the existing 3-realm `jwt.ts` verify split).
- TOTP enrollment/verify + middleware gate + bootstrap are separate issues (055/056/057);
  this issue gates login behind "TOTP required" but the enforcement lands in 055.

## Acceptance criteria

- [ ] `AdminUser` + `AdminRole` models in a distinct table (migration); no admin rows in
      Customer/Operator tables.
- [ ] Email+password login issues an admin-realm session (separate cookie scope, short TTL).
- [ ] No public admin-registration route exists.
- [ ] Admin token rejected by customer/operator verifiers; operator/customer tokens rejected
      by the admin verifier (cross-realm tests both directions).
- [ ] Login route strict-rate-limited.

## Blocked by

- Blocked by `issues/038-scaffold-lib-core-tenant-helper-lint.md`

## User stories addressed

- [S10] admin separate hardened door, distinct credential store, invite-only.
