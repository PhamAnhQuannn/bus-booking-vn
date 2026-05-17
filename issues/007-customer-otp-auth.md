---
depends-on: [003-cash-booking-confirmation]
type: AFK
---

## Parent PRD

`issues/prd.md`

## What to build

Customer auth via phone + OTP. Establishes the shared `AuthModule` + `OTPModule` (deep) that operator and admin slices reuse later.

- Prisma `Customer`, `OtpAttempt` models per PRD § Schema.
- `OTPModule`: code gen, hash + store, verify, rate-limit (max 3 sends / 15 min per phone), expiry 5 min, attempt tracking. eSMS adapter injected (stub in dev).
- `AuthModule`: issues access JWT (in-memory) + refresh token (httpOnly Secure SameSite=Lax cookie). Silent refresh on app boot.
- Endpoints: `POST /api/auth/otp/send`, `POST /api/auth/otp/verify`, `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`.
- Password validation: 8–128 chars, ≥1 letter + ≥1 digit.
- UI: `/auth/register`, `/auth/login`, `/auth/forgot-password` (UI only; reset logic ships in S8).
- CSRF protection on state-changing requests (double-submit token per PRD § Implementation Decisions).

## Acceptance criteria

- [ ] OTP send → verify → register → login round trip works against the eSMS stub.
- [ ] OTP rate limit: 4th send within 15 min returns rate-limit error.
- [ ] OTP expiry: code older than 5 min returns expired error.
- [ ] Concurrent-verify race: 2 simultaneous correct verifies → exactly 1 consumes the OTP, the other returns "already used".
- [ ] Access token expires; silent refresh transparently re-issues using the cookie.
- [ ] Logout invalidates refresh cookie server-side.
- [ ] Unit tests for `OTPModule` cover code gen, rate-limit, expiry, attempt cap, eSMS stub call counts.

## HITL requirements

First real eSMS-vendor send requires brandname credentials and template approval. Stub adapter satisfies all CI / dev work; production rollout needs a one-time human gate.

## Blocked by

- Blocked by `issues/003-cash-booking-confirmation.md` (NotificationModule + eSMS adapter)

## User stories addressed

- User story 19
- User story 20
