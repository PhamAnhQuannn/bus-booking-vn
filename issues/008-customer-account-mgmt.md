---
depends-on: [007-customer-otp-auth]
type: AFK
---

## Parent PRD

`issues/prd.md`

## What to build

Customer account self-service: password reset via OTP, password change in-app, phone-number change via OTP, display-name edit, account deletion with soft-delete + PII anonymization.

- `POST /api/auth/forgot-password` flow: OTP to registered phone, max 3 resends, verify code, then `POST /api/auth/reset-password` with new password (must differ from old hash).
- `POST /api/account/password` — change in-app: requires current + new password.
- `POST /api/account/phone/init` + `POST /api/account/phone/confirm` — OTP to new phone; on confirm, switch phone and release old.
- `PATCH /api/account/name` — 4–100 chars Unicode.
- `DELETE /api/account` — soft-delete: PII anonymized (`phone → null-anonymized-id`, `name → 'Deleted user'`), booking history retained per PDPD 2023; confirmation modal; session invalidated immediately.
- UI under `/account/settings` for each action.

## Acceptance criteria

- [ ] Forgot-password OTP flow lets a user log in with a new password.
- [ ] Change-password requires correct current password and rejects matching-new.
- [ ] Phone change requires OTP verify on the new number; old phone is freed and can be re-registered.
- [ ] Name edit persists and shows on future bookings as buyer name when chosen.
- [ ] Account delete: customer row anonymized, bookings remain accessible by ref, refresh tokens revoked, immediate logout.
- [ ] OTP 15-min lockout after 3 failed verifications applies to reset + phone-change flows.

## Blocked by

- Blocked by `issues/007-customer-otp-auth.md`

## User stories addressed

- User story 21
- User story 22
- User story 23
- User story 24
- User story 25
