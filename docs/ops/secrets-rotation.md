# Secrets Rotation Runbook

**Cadence:** every 90 days, and immediately on suspected leak / staff offboarding.
**Where:** Vercel project `bus-booking-vn` (scope `phamanhquannns-projects`) → Settings → Environment Variables.
All secrets are validated at boot by `lib/config/env.ts` (`getEnv()` throws on missing/short) — a bad
rotation fails the deploy fast rather than at first request.

## Secret inventory (source: `lib/config/env.ts` boot schema, 2026-08-04)
| Secret | Purpose | Format | Rotatable without downtime? |
|--------|---------|--------|------------------------------|
| `JWT_SECRET` | customer session JWT (HS256) | ≥32 chars | No — invalidates live customer sessions (Phase 1: no customer auth, low impact) |
| `JWT_OPERATOR_SECRET` | operator session JWT | ≥32 chars | No — operators re-login |
| `JWT_ADMIN_SECRET` | admin session JWT | ≥32 chars | No — admin re-login |
| `REFRESH_TOKEN_SECRET_CUSTOMER` | customer refresh-token HMAC (P17) | ≥32 chars | No — customers re-login |
| `REFRESH_TOKEN_SECRET_OPERATOR` | operator refresh-token HMAC (P17) | ≥32 chars | No — operators re-login |
| `REFRESH_TOKEN_SECRET_ADMIN` | admin refresh-token HMAC (P17) | ≥32 chars | No — admins re-login |
| `TOTP_ENCRYPTION_KEY` | AES-256-GCM for admin TOTP secret at rest | 64 hex | **Careful** — must re-encrypt stored TOTP secrets (see procedure) |
| `BANK_ENCRYPTION_KEY` | AES-256-GCM for PayoutAccount.accountNumber | 64 hex | **Careful** — must re-encrypt stored account numbers |
| `CRON_SECRET` | Bearer auth on cron routes | ≥16 chars | Yes — update Vercel Cron config same time |
| `TICKET_SECRET` | ticket QR lookup token (HS256) | ≥16 chars | No — invalidates outstanding ticket QR links |
| `HOLD_SECRET` | bb_hold cookie HMAC | 64 hex | Yes — in-flight holds drop (10-min TTL absorbs it) |
| `STORAGE_STUB_SECRET` | stub storage URL HMAC | ≥16 chars | Yes (stub only; STORAGE_STUB=true in prod) |
| `STUB_PAYMENT_SECRET` | stub gateway IPN HMAC | ≥16 chars | Yes (dev-only path) |

## Standard rotation procedure (stateless secrets — JWT/REFRESH/CRON/TICKET/HOLD/stub keys)
1. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` (or 24 bytes for ≥16-char ones).
2. Vercel → set the new value on **Production** (and Preview if used).
3. Redeploy (env change alone does not restart running functions until next deploy). `getEnv()` validates at boot.
4. `CRON_SECRET`: update the Vercel Cron Authorization header in the same deploy.
5. Verify: `GET /api/health` 200; one operator login; one cron `JobRunLog` row appears on schedule.

## Careful rotation (encryption keys — TOTP_ENCRYPTION_KEY / BANK_ENCRYPTION_KEY)
These encrypt data AT REST. A naive swap makes existing ciphertext undecryptable.
1. Deploy a dual-key read window (new key for writes, old key retained for reads) OR run a one-off
   re-encrypt migration: decrypt-with-old → encrypt-with-new for every `AdminUser.totpSecret` /
   `PayoutAccount.accountNumber` row, inside a transaction.
2. Only after all rows re-encrypted, remove the old key.
3. Verify a payout-account read + an admin TOTP challenge succeed post-rotation.
(If no re-encrypt tooling exists yet, treat these two as break-glass-only rotations and build the
re-encrypt script first — do NOT blind-swap.)

## On suspected leak
Rotate the affected secret immediately via the procedure above; if `BANK_ENCRYPTION_KEY` or a JWT
secret, also force-invalidate sessions and audit `JobRunLog` + access logs for the exposure window.
