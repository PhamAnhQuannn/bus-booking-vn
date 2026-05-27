# Local testing — full app on stubs (no real payment keys)

The whole product runs and is testable end-to-end **without any real payment or SMS
credentials**. Online payments route through a local fake gateway; SMS is a
console-log stub with a peek endpoint for OTP codes. The only hard dependency is
PostgreSQL (provided via docker-compose).

This was verified live: the project's Playwright e2e suite was run against a freshly
seeded local server — **16/16 golden-path tests pass** (8 stub-payment for
zalopay+card, plus cash booking, customer OTP round-trip, operator first-login).

---

## Prerequisites

- **Docker Desktop running** (for PostgreSQL).
- **Node + pnpm** (`pnpm install` already done).
- No PSP/eSMS keys needed. `.env.local` is pre-configured with `PAYMENTS_STUB=true`,
  `OTP_PEEK_ENABLED=true`, `CRON_SECRET`, and all required secrets.

---

## 1. Boot the stack

```powershell
# 1. Start Postgres (port 5432, shadow 5434)
docker compose -f docker-compose.dev.yml up -d

# 2. Apply migrations + seed.
#    Prisma's CLI does NOT auto-load .env.local — set the DB URLs for these two
#    commands (next dev loads .env.local on its own, so the app itself is fine).
$env:DATABASE_URL = "postgresql://bbvn:bbvn_dev_password@localhost:5432/bbvn_dev"
$env:SHADOW_DATABASE_URL = "postgresql://bbvn:bbvn_dev_password@localhost:5434/bbvn_shadow"
pnpm prisma migrate deploy
pnpm prisma db seed

# 3. Start the app
pnpm dev
```

> If port 3000 is busy, Next auto-bumps to **3001** (watch the startup line:
> `- Local: http://localhost:3001`). Use whatever port it prints below.

bash/zsh equivalent for step 2: `set -a; . ./.env.local; set +a; pnpm prisma migrate deploy && pnpm prisma db seed`

### What the seed creates
- 2 operators, 6 buses, 4 routes, **12 trips** (Hà Nội→TP.HCM today + next 3 days,
  Đà Nẵng→Huế, Cần Thơ→Đà Lạt, a cancelled trip, a sales-closed trip, a
  maintenance-bus trip, and a capacity-1 race-test trip).
- **Operator admin login** — phone `0901230001`, temp password `BBOp2026!`
  (first login forces a password change).
- **No customer** — register one via OTP during testing (see §4).

---

## 2. Customer: book with cash (no payment at all)

1. Open `/` → search **Hà Nội → TP.HCM**, date = tomorrow, 1 ticket.
2. Pick a trip → enter buyer name + phone → review.
3. Choose **Cash on pickup** → confirmation page shows a booking ref
   (`BB-YYYY-xxxx-xxxx`). The confirmation token in the URL is the access key —
   it works with no login.

## 3. Customer: book with online payment (stub gateway)

1. Same flow, but at the payment step choose **MoMo / ZaloPay / Card**.
2. You're redirected to the local fake-gateway page **`/dev/stub-pay`**
   (only mounted when `PAYMENTS_STUB=true`).
3. Click **Pay success** → the stub signs its own HMAC IPN, runs it through the
   real webhook path, and the result page flips to **paid**.
   Click **Pay fail** to exercise the failed/retry path instead.

No real PSP account, no callback URLs — the stub stands in for momo/zalopay/card.

## 4. Customer: register / login (OTP)

SMS is a console stub, so read the code from the dev-only peek endpoint:

1. `/auth/register` → enter a phone, e.g. `0907654321`.
2. Fetch the code:
   `GET http://localhost:3001/api/auth/otp/test-peek?phone=+84907654321`
   → returns `{"code":"123456"}`. (Gated by `OTP_PEEK_ENABLED=true`; 404 in prod.)
3. Enter the code → account created. A guest booking made earlier with the same
   phone auto-attaches; see it under `/account/bookings`.

> Phone normalization: `0907654321` is stored as `+84907654321` — use the `+84…`
> form in the peek query.

## 5. Operator console

1. `/op/login` → `0901230001` / `BBOp2026!`.
2. You're forced to the **password-change** screen → set a new password.
3. Console loads: booking queue / dashboard, trip list, manifest, fleet, routes,
   reports, staff. Booking detail supports call-outcome recording; manifests have
   no seat numbers (by design).

---

## 6. Background jobs (cron) — manual trigger

Cron jobs don't run automatically locally (they're Vercel cron in prod). Trigger
them by hand with the dev `CRON_SECRET`:

```powershell
curl -H "Authorization: Bearer dev_cron_secret" http://localhost:3001/api/cron/sweep-holds
```

Routes: `sweep-holds`, `close-sales`, `complete-trips`, `send-reminders`,
`process-payouts`, `generate-trips`.

> **Hold expiry**: `HOLD_SWEEPER_MODE=count` (default) only *logs* expired holds.
> To actually expire them, set `HOLD_SWEEPER_MODE=update` in `.env.local`, restart
> `pnpm dev`, then hit `/api/cron/sweep-holds`.

---

## 7. Run the automated golden-path suite (optional)

Drive the same flows headlessly against your running server:

```powershell
$env:CI = "true"                                  # disables the auto-spawned webServer
$env:PLAYWRIGHT_BASE_URL = "http://localhost:3001"
$env:E2E_AUTH_ENABLED = "true"                    # un-skips customer-auth specs
$env:E2E_OP_AUTH_ENABLED = "true"                 # un-skips operator-auth specs
$env:DATABASE_URL = "postgresql://bbvn:bbvn_dev_password@localhost:5432/bbvn_dev"
pnpm exec playwright test e2e/stub-payment.spec.ts e2e/cash-booking.spec.ts e2e/auth-otp-roundtrip.spec.ts e2e/op-first-login.spec.ts --project=chromium --reporter=list
```

Specs that seed/mutate operators+customers; re-run `pnpm prisma db seed` afterward
to restore the documented login above.

---

## 8. Tear down

```powershell
# stop app: Ctrl-C in the pnpm dev terminal
docker compose -f docker-compose.dev.yml down        # keep data
docker compose -f docker-compose.dev.yml down -v      # wipe DB volume (fresh start)
```

---

## Deferred (Phase 2 — needs real keys)

Real ZaloPay/Card PSP adapters and the production eSMS provider are intentionally
deferred. When credentials arrive: implement the adapters against
`lib/payment/gateway.ts`, swap them into `lib/payment/select.ts`, set
`PAYMENTS_STUB=false`, swap the eSMS stub. Tracked by `issues/005-zalopay-gateway.md`
and `issues/006-card-gateway-vn-psp.md`.
