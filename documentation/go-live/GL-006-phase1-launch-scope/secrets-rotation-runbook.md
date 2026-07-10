# Secrets Rotation Runbook (KG-06)

Production secrets rotation procedures for BusBookVN Phase 1.

## Rotation Schedule

| Interval | Secrets |
|----------|---------|
| 90 days | JWT_SECRET, JWT_OPERATOR_SECRET, JWT_ADMIN_SECRET, REFRESH_TOKEN_SECRET, TOTP_ENCRYPTION_KEY, BANK_ENCRYPTION_KEY, DATABASE_URL password |
| 180 days | HOLD_SECRET, CRON_SECRET, REDIS password |
| On breach | All secrets in affected category immediately |

## Pre-Rotation Checklist

- [ ] Schedule during low-traffic window (02:00-05:00 UTC+7)
- [ ] Confirm backup of current `.env.production`
- [ ] Have rollback `.env.production.bak` ready
- [ ] Monitor dashboard open (error rate, latency, auth failures)

---

## 1. JWT Signing Secrets

**Secrets:** `JWT_SECRET`, `JWT_OPERATOR_SECRET`, `JWT_ADMIN_SECRET`

**Impact:** All active sessions for rotated realm invalidated. Users re-authenticate.

**Procedure:**

```bash
# Generate new secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Update .env.production with new value
# Update in Vercel Environment Variables, then redeploy:
# vercel --prod
```

**Post-checks:**
- [ ] Login flow works for affected realm (customer/operator/admin)
- [ ] No spike in 401 errors beyond expected session invalidation
- [ ] Refresh token endpoint returns new tokens

**Rollback:** Restore old secret from `.env.production.bak`, restart.

---

## 2. Refresh Token Secret

**Secret:** `REFRESH_TOKEN_SECRET`

**Impact:** All refresh tokens invalidated. Users must re-login (not just re-auth).

**Procedure:**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Update .env.production, restart app
```

**Post-checks:**
- [ ] Token refresh endpoint issues new tokens
- [ ] No persistent 401 loops (client should redirect to login)

**Rollback:** Restore old secret, restart.

---

## 3. Encryption Keys (At-Rest)

**Secrets:** `TOTP_ENCRYPTION_KEY`, `BANK_ENCRYPTION_KEY`

**Impact:** Existing encrypted fields unreadable with new key until re-encrypted.

**Procedure:**

1. Generate new key:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. Run re-encryption migration script (one-time):
   ```bash
   # Script reads all rows, decrypts with OLD key, re-encrypts with NEW key
   # Must be run BEFORE switching the app to the new key
   OLD_KEY=<old_hex> NEW_KEY=<new_hex> node scripts/rotate-encryption-key.ts --model AdminUser --field totpSecret
   OLD_KEY=<old_hex> NEW_KEY=<new_hex> node scripts/rotate-encryption-key.ts --model PayoutAccount --field accountNumber
   ```

3. Update `.env.production` with new key
4. Restart application

**Post-checks:**
- [ ] Admin TOTP login works (verifies TOTP decryption)
- [ ] Operator payout account display shows masked number (verifies bank decryption)
- [ ] No `Error: Unsupported state or unable to authenticate data` in logs

**Rollback:** Restore old key, restart. Re-encrypted rows use `enc:v1:` prefix so backward compat applies to both old and new ciphertext (both decrypt correctly with their respective key during the transition window).

**WARNING:** Do NOT rotate encryption keys without running the re-encryption script. The app cannot decrypt old ciphertext with a new key.

---

## 4. Hold Cookie Secret

**Secret:** `HOLD_SECRET`

**Impact:** Active seat holds (12-min TTL) invalidated. Users in booking flow restart hold selection.

**Procedure:**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Update .env.production, restart app
```

**Post-checks:**
- [ ] New hold creation works
- [ ] Hold cookie verification works (booking review page loads)

**Rollback:** Restore old secret, restart. Impact bounded by 12-min hold TTL.

---

## 5. Cron Secret

**Secret:** `CRON_SECRET`

**Impact:** Cron jobs fail authentication until new secret propagated.

**Procedure:**

1. Generate new secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. Update `CRON_SECRET` in Vercel Environment Variables

3. Redeploy: Vercel Cron (`CRON_SECRET` injected by Vercel) will use the new value automatically after redeployment

**Post-checks:**
- [ ] Cron endpoints return 200 (check `/api/cron/sweep-holds` manually)
- [ ] No 401s in cron logs
- [ ] Hold sweeper, notification dispatch, trip completion all firing

**Rollback:** Restore old secret in Vercel Environment Variables, redeploy.

---

## 6. Database Password

**Secret:** `DATABASE_URL`, `DIRECT_URL`, `SHADOW_DATABASE_URL` (password component)

**Impact:** App loses DB connectivity during rotation window.

**Procedure:**

1. Create new PostgreSQL password:
   ```sql
   ALTER USER bbvn WITH PASSWORD 'new_secure_password_here';
   ```

2. Update all three connection strings in `.env.production`:
   ```
   DATABASE_URL=postgresql://bbvn:new_password@host:6432/bbvn
   DIRECT_URL=postgresql://bbvn:new_password@host:5432/bbvn
   SHADOW_DATABASE_URL=postgresql://bbvn:new_password@host:5432/bbvn_shadow
   ```

3. If using PgBouncer, update `userlist.txt` with new password hash

4. Restart PgBouncer (if applicable), then restart application

**Post-checks:**
- [ ] `SELECT 1` via app health endpoint returns 200
- [ ] No connection pool exhaustion in logs
- [ ] Prisma migrations work with new DIRECT_URL: `pnpm prisma migrate status`

**Rollback:** Restore old password in PostgreSQL (`ALTER USER`), restore `.env.production.bak`, restart.

---

## 7. Redis Password

**Secret:** `REDIS_URL` (password component) or `UPSTASH_REDIS_REST_TOKEN`

### Upstash Redis

1. Regenerate token in Upstash console
2. Update `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
3. Restart application

**Post-checks:**
- [ ] Rate limiting works (rapid requests get 429)
- [ ] OTP proof JTI consumption works (replay prevention)

---

## 8. Payment Gateway Secrets

### MoMo (`MOMO_SECRET_KEY`)

1. Request new credentials from MoMo merchant portal
2. Update `.env.production`
3. Restart application
4. Test: create a test payment, verify webhook signature validates
5. Monitor IPN success rate for 1 hour

### VNPay (`VNPAY_HASH_SECRET`)

1. Request new credentials from VNPay merchant portal
2. Update `.env.production`
3. Restart application
4. Test: create a test payment, verify return URL signature validates
5. Monitor IPN success rate for 1 hour

**WARNING:** Coordinate with PSP. Old and new keys must coexist during transition. If PSP does not support dual keys, schedule a maintenance window.

---

## 9. SMS Provider (`ESMS_API_KEY`, `ESMS_SECRET_KEY`)

1. Regenerate in eSMS.vn dashboard
2. Update `.env.production`
3. Restart application
4. Test: trigger OTP send, verify SMS delivery

---

## 10. Emergency Rotation (Breach Response)

If a secret is suspected compromised:

1. **Identify scope** — which secret(s) exposed, which systems affected
2. **Rotate immediately** — follow the relevant procedure above, skip scheduling
3. **Audit access** — check logs for unauthorized usage during exposure window
4. **Notify affected users** if authentication secrets leaked (force password reset if applicable)
5. **Document incident** — add entry to `documentation/incidents/` with timeline and remediation

### Priority order for full breach:
1. Database password (data access)
2. Encryption keys (at-rest data protection)
3. JWT secrets (session hijacking)
4. Payment gateway secrets (financial)
5. SMS/email provider secrets (notification channel)
6. Cron/hold secrets (operational)

---

## Secret Generation Commands

```bash
# 32-byte hex (JWT secrets, HOLD_SECRET)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 32-byte hex for encryption keys (TOTP, BANK)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Secure password (database)
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
```
