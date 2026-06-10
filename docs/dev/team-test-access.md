# Team test access — BBVN dev tunnel

Shared dev build for team testing. **URL + credentials are sent separately (chat), not in this repo.**

- **Base URL:** the dev tunnel (`https://93ppgcdj-3001.usw3.devtunnels.ms`). Open it directly — no
  GitHub sign-in (tunnel is set Public; keep the URL within the team).
- This is a **dev** environment: payments are fake, SMS/email are not sent. Details below.

## What you can test

### 1. Guest booking (no login)
`/` → `/search?...` (or use the home search form) → pick a trip → **Đặt vé** → buyer info
(`/booking/customer`) → review (`/booking/review`) → pay.
- Pay lands on the **stub payment page** (fake gateway): click **"Thanh toán"** = success,
  **"Thất bại"** = failure.
- Success → `/booking/result` → `/booking/confirmation` with the **ticket + QR shown on screen**
  (also viewable at `/verify/[token]`).

### 2. Operator console — `/op/login`
Log in with the shared **operator username + password**. Test fleet, routes, trips, manifest,
money/payouts, profile, etc.

### 3. Admin console — `/admin/login`
Log in with the shared **admin email + password + TOTP**. Add the shared TOTP secret to an
authenticator app (Google Authenticator / Authy / 1Password), or use a freshly generated 6-digit
code. Test approvals, operators, finance, moderation, system, users.

## Known stubs / expectations (not bugs)
- **Payments are fake** — no real charge; the stub page simulates success/failure.
- **SMS + email are NOT delivered** — the ticket/QR appears on the confirmation + `/verify` pages
  instead of arriving by SMS/email.
- **Customer accounts are parked** — `/auth/*` and `/account/*` redirect to `/`. Booking is
  **guest-only** by design (no customer signup/login).
- Data is shared/live dev data — bookings you make are real rows others may see.

## Reporting issues
Note the **URL/path**, what you did, and what you expected vs saw (screenshot helps).
