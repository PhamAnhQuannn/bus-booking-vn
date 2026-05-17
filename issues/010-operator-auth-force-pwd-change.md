---
depends-on: [007-customer-otp-auth]
type: AFK
---

## Parent PRD

`issues/prd.md`

## What to build

Operator authentication using the shared AuthModule with `scope: operator`, the forced temp-password change on first login, and operator profile fields (separate contact phone + notification phone).

- Prisma `OperatorUser` model (admin role here; staff role lives in S17).
- `POST /api/auth/login` accepts `{ phone, password, scope: 'operator' }` and returns operator-scoped tokens.
- `POST /api/op/auth/password/change` — gates all `/api/op/*` access while `requiresPasswordChange` is true.
- `GET /api/op/profile` + `PATCH /api/op/profile` — read/update operator's contact phone (customer-facing) and notification phone (SMS alerts). Both required and must differ.
- `/op/login` page, `/op/first-login` forced-password-change page, `/op/profile` settings page.
- Password reset via OTP (`POST /api/op/auth/forgot-password` + verify + reset) with 15-min lockout after 3 failed OTP verifications.

## Acceptance criteria

- [ ] An operator user with `requiresPasswordChange=true` is forced to `/op/first-login` after login and cannot reach any other `/op/*` route until they change it.
- [ ] After password change the flag clears and the user can navigate freely.
- [ ] Updating profile rejects identical contact + notification phone values.
- [ ] Reset-via-OTP: 3 failed verifications triggers a 15-min lockout for the phone.
- [ ] Customer login and operator login do not cross-grant access (scope check enforced server-side).

## Blocked by

- Blocked by `issues/007-customer-otp-auth.md`

## User stories addressed

- User story 26
- User story 27
- User story 28
- User story 29
