# Runbook — secret rotation (SEC-SECRET-ROTATION #568)

Every production-required secret must have a mechanical rotation path (on suspected leak, on
contractor offboarding, or on schedule). This covers the app's secrets except `SEPAY_API_KEY`
(its own file: `sepay-api-key-rotation.md`) and `DATABASE_URL` (`db-least-privilege-role.md`).

Two classes: **stateless** (swap value + redeploy; existing sessions/tokens simply re-mint) and
**at-rest encryption keys** (a naked swap makes existing ciphertext undecryptable → needs a
dual-key re-encrypt).

---

## Class A — stateless secrets (swap + redeploy)

Procedure for ALL of these (order matters only in that the new value must be live before you rely on it):
1. Generate a new value (`openssl rand -hex 32` for the 64-hex keys; `openssl rand -base64 32` for opaque).
2. Set it in Vercel → Project → Settings → Environment Variables → **Production**.
3. **Redeploy** production (`getEnv()` parses once at boot — the new value is not live until a fresh deploy).
4. Verify the affected flow works (column "verify" below).
5. The old value is now dead; no revoke step (these aren't stored anywhere external).

| Secret | Used for | Blast radius of rotation | Verify |
|--------|----------|--------------------------|--------|
| `JWT_SECRET` | customer access-token signing (`lib/auth/jwt.ts`) | in-flight customer access tokens (15-min TTL) become invalid → clients silently `/api/auth/refresh` and re-mint | customer login + an authed call |
| `JWT_OPERATOR_SECRET` | operator access tokens | operators' access tokens invalid → refresh re-mints | operator dashboard loads |
| `JWT_ADMIN_SECRET` | admin access + step-up tokens | admin access tokens invalid → re-login/refresh; step-up must be redone | admin login + a step-up action |
| `REFRESH_TOKEN_SECRET_CUSTOMER` | customer refresh-token HMAC | **all customer refresh tokens invalid → one forced re-login** (env.ts notes this cutover) | customer must log in again |
| `REFRESH_TOKEN_SECRET_OPERATOR` | operator refresh HMAC | one forced operator re-login | operator re-login |
| `REFRESH_TOKEN_SECRET_ADMIN` | admin refresh HMAC | one forced admin re-login | admin re-login |
| `TICKET_SECRET` | ticket/lookup token signing (`lib/*ticket*`) | outstanding ticket links invalidated; re-issue on next view | open a ticket PDF/lookup link |
| `CRON_SECRET` | cron bearer (`lib/core/http/cronAuth.ts`) | **must also update the Vercel Cron config's Authorization header** or crons 401 | trigger a cron, expect 200 |
| `HOLD_SECRET` | `bb_hold` cookie HMAC (`lib/security/holdCookie.ts`) | in-flight seat holds' cookies invalid (12-min TTL) → re-hold | create a hold |
| `GOAUTH_COOKIE_SECRET` | Google OAuth `bb_goauth` state cookie | in-flight Google sign-ins fail (retry) | complete a Google sign-in |

Note: `CRON_SECRET` is the one with an external consumer (Vercel Cron) — rotate the env AND the cron
Authorization header together, or crons break.

---

## Class B — at-rest encryption keys (DUAL-KEY re-encrypt, NOT a naked swap)

A straight swap makes every existing ciphertext undecryptable — a data-loss incident. Both keys
already carry a versioned `enc:v1:` prefix and a plaintext-passthrough branch, which is the seam.

| Key | Cipher module | Encrypts |
|-----|---------------|----------|
| `BANK_ENCRYPTION_KEY` | `lib/security/bankCrypto.ts` (AES-256-GCM, `enc:v1:<b64(iv+ct+tag)>`) | `PayoutAccount.accountNumber` |
| `TOTP_ENCRYPTION_KEY` | `lib/auth/totpCrypto.ts` (same scheme) | `AdminUser.totpSecret` |

### Dual-key rotation procedure
1. **Add the new key alongside the old.** Introduce `*_ENCRYPTION_KEY_OLD` (or bump ciphertext to
   `enc:v2:` with a key-id). Set the NEW value in `*_ENCRYPTION_KEY`, move the CURRENT value to
   `*_ENCRYPTION_KEY_OLD`.
2. **Deploy dual-decrypt.** Change `decrypt*` to try the new key first, then fall back to the old key
   (keyed by the `enc:vN:` version or by trying both). Encrypt always uses the NEW key. Deploy — now
   the app reads old-key ciphertext and writes new-key ciphertext.
3. **Run a one-shot re-encrypt sweep** (a script/migration): for every `PayoutAccount` /`AdminUser`
   row, read → `decrypt` (old) → `encrypt` (new) → write back, in batches. Idempotent (re-encrypting
   an already-new row is a no-op decrypt-new/encrypt-new).
4. **Verify no old-key rows remain.** The check depends on which seam you chose in step 1:
   - **`enc:v2:`+key-id path:** count rows whose stored version tag is still the old one → expect 0.
   - **`*_ENCRYPTION_KEY_OLD` path (default):** old- and new-key ciphertext are byte-**indistinguishable**
     (both write the same `enc:v1:` prefix, no key-id), so a prefix count proves nothing. Instead
     decrypt every row with the **NEW key only** (disable the old-key fallback for the check) and
     require **0 decryption failures**. A single failure = an un-swept old-key row; re-run step 3
     before proceeding.
   Spot-check a payout account decrypts and a TOTP verifies.
5. **Retire the old key:** remove `*_ENCRYPTION_KEY_OLD`, drop the fallback branch, deploy.

Do NOT skip step 3: if you retire the old key with old-key ciphertext still in the DB, that data is
permanently unrecoverable (bank account numbers, admin TOTP secrets).

### When to rotate these
On suspected key leak, or on a scheduled cadence (suggested: 12 months — longer than Class A because
the re-encrypt sweep is heavier). Trigger the full dual-key procedure, never a naked swap.

---

Handling rules (all secrets): Vercel Production env only — never in the repo, `.env.example`, a PR
body, an issue, or chat. All are on the logger redact list (`lib/logger.ts`) — keep them there.
Related: #568, HD-013 rule 14.
