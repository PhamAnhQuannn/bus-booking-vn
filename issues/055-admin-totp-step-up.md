---
depends-on: [054-admin-auth-core]
type: FEATURE
wave: 1
spec: [S10]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [S10] (security-critical)

## What to build

**Mandatory TOTP** + **step-up re-auth** for admins. Spec [S10]: email + password +
mandatory TOTP (NOT SMS-OTP — resists SIM-swap); step-up (re-prompt 2FA) on money/approval
actions.

- TOTP enrollment (provision secret + QR for an authenticator app) on first admin login;
  login is incomplete until TOTP is verified — `totpSecret`/`totpEnabledAt` on `AdminUser`
  (issue 054 model).
- TOTP verify step in the login flow; admin session is not fully privileged until TOTP
  passes. Encode 2FA-satisfied + role in the admin JWT claim (Edge-safe, consumed by the
  middleware in issue 056).
- **Step-up re-auth**: a re-prompt-TOTP gate for high-privilege actions — payouts, refunds,
  fee changes, operator approval. A short-lived "step-up" claim/marker required by those
  routes (Finance/Approvals land in Wave 3 but the step-up primitive ships here).
- Strict rate-limit + lockout on TOTP attempts (reuse the Mistake-Log Issue 010 lockout
  sentinel pattern where applicable).

## Acceptance criteria

- [ ] Admin login requires a valid TOTP code; password alone does not yield a privileged
      session.
- [ ] TOTP enrollment flow provisions a secret + QR; secret stored per issue 054 model.
- [ ] Step-up primitive: a protected action requires a fresh TOTP re-prompt (short-lived
      step-up claim), verified by test.
- [ ] 2FA-satisfied + role encoded in the admin JWT claim (no DB read needed in middleware).
- [ ] TOTP attempts rate-limited + locked out on repeated failure.

## Blocked by

- Blocked by `issues/054-admin-auth-core.md`

## User stories addressed

- [S10] mandatory TOTP; step-up re-auth on money/approval actions.
