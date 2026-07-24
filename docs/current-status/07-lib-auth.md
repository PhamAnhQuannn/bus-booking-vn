# 07 — lib/auth/ : Three-Realm Authentication System

> **Directory:** `lib/auth/`
> **Barrel:** `lib/auth/index.ts`
> **Design refs:** ADR auth decisions, DS auth specs, Issue 007/010/054/055

---

## Architecture Overview

The auth system serves three isolated realms, each with its own signing secret, session table, cookie namespace, and auth guard:

| Realm | Users | Credentials | JWT Secret Env | Access Cookie | Session Table | Access TTL |
|---|---|---|---|---|---|---|
| **Customer** | End-user passengers | Phone + password (OTP for verify) | `JWT_SECRET` | Bearer header (not cookie) | `Session` | 900s (15 min) |
| **Operator** | Bus company admins/staff | Generated username + password | `JWT_OPERATOR_SECRET` | `bb_op_access` (HttpOnly) | `OperatorSession` | 900s (15 min) |
| **Admin** | Platform admins | Email + password + TOTP 2FA | `JWT_ADMIN_SECRET` | `bb_admin_access` (HttpOnly) | `AdminSession` | 600s (10 min) |

**Cross-realm isolation (AUTH-02):** Each realm uses a dedicated HS256 signing secret. `verifyAccess` rejects tokens with `scope='operator'` or `scope='admin'`; `verifyOperatorAccess` requires `scope='operator'`; `verifyAdminAccess` requires `scope='admin'`. A compromised secret in one realm cannot forge tokens for another.

**Refresh token rotation:** All three realms use HMAC-SHA256 refresh tokens (`<base64url(payload)>.<hex-hmac>`) with family-based reuse detection. If a revoked refresh token is presented, the entire token family is revoked (session hijack mitigation).

**CSRF double-submit:** The Edge middleware (`proxy.ts`) sets a `bb_csrf` cookie on first GET. Non-safe-method `/api/*` requests must echo it in the `X-CSRF-Token` header. Client components deep-import `csrfClient.ts` to read the cookie (never the barrel -- barrel pulls server-only transitives into client bundles).

---

## File Reference

### jwt.ts -- JWT Sign/Verify (HS256 via jose)

Per-realm signing secrets with test fallbacks (`NODE_ENV === 'test'`).

| Export | Kind | Description |
|---|---|---|
| `AccessPayload` | interface | `{ sub: string; role: 'customer' }` |
| `OperatorAccessPayload` | interface | `{ sub, scope: 'operator', role: 'admin'\|'staff', requiresPasswordChange, operatorId }` |
| `AdminAccessPayload` | interface | `{ sub, scope: 'admin', role: 'SUPER_ADMIN'\|'FINANCE'\|'SUPPORT', totpVerified }` |
| `signAccess(payload)` | async fn | Sign customer access JWT (900s TTL) |
| `verifyAccess(token)` | async fn | Verify customer token; rejects scope='operator'/'admin'; returns `AccessPayload \| null` |
| `signOperatorAccess(payload)` | async fn | Sign operator access JWT (900s TTL) with scope/role/requiresPasswordChange/operatorId claims |
| `verifyOperatorAccess(token)` | async fn | Verify operator token; requires scope='operator' + non-empty operatorId; returns `OperatorAccessPayload \| null` |
| `signAdminAccess(payload)` | async fn | Sign admin access JWT (600s TTL) with scope/role/totpVerified claims |
| `verifyAdminAccess(token)` | async fn | Verify admin token; requires scope='admin' + valid role; returns `AdminAccessPayload \| null` |
| `signAdminStepUp(adminId)` | async fn | Sign admin step-up JWT (300s TTL, scope='admin_stepup') |
| `verifyAdminStepUp(token)` | async fn | Verify step-up token; requires scope='admin_stepup'; returns `{ sub } \| null` |

**Constants:** `ACCESS_TTL_SECONDS = 900`, `ADMIN_ACCESS_TTL_SECONDS = 600`, `ADMIN_STEPUP_TTL_SECONDS = 300`.

---

### otp.ts -- OTP Generation, Hashing, and CAS Consumption

Pure crypto helpers plus atomic DB consumption via raw SQL (Prisma `$queryRaw`/`$executeRaw` with `Prisma.sql` template tag).

| Export | Kind | Description |
|---|---|---|
| `generateCode()` | fn | 6-digit zero-padded string via `crypto.randomInt` |
| `generateSalt()` | fn | 16-byte random hex (32 chars) |
| `hashCode(code, salt)` | fn | SHA-256 hex digest of `${salt}:${code}` |
| `MAX_OTP_ATTEMPTS` | const | `5` -- max wrong-code attempts before lockout |
| `ConsumeResult` | interface | `{ status: 'ok' \| 'mismatch' \| 'gone' \| 'attempt_cap'; otpId?: string }` |
| `consume(phone, plainCode)` | async fn | Atomic CAS consumption: fetch active row, timing-safe hash compare, increment attempts on mismatch, consume on match |

---

### otpProof.ts -- Cross-Route OTP Proof JWT

Short-lived proof JWT (5 min TTL) for transferring verified-phone state between route boundaries (Mistake Log Issue 007). One-shot replay protection via jti consumption (Redis SETNX in production, in-memory Map in dev/test).

| Export | Kind | Description |
|---|---|---|
| `OtpProofPurpose` | type | `'otp_proof' \| 'op_pwd_reset' \| 'reset_password' \| 'phone_change'` |
| `issueOtpProof(phone, purpose)` | async fn | Sign proof JWT with phone/purpose/jti claims |
| `verifyOtpProof(token, purpose)` | async fn | Verify + purpose-match; for `otp_proof`/`reset_password`/`phone_change` enforces one-shot jti consume; returns `{ phone, jti } \| null` |

**JTI providers:** Upstash Redis (`UPSTASH_REDIS_REST_URL`/`TOKEN`), ioredis (`REDIS_PROVIDER=ioredis`), or in-memory fallback.

---

### password.ts -- Password Hashing (Argon2id / scrypt Fallback)

| Export | Kind | Description |
|---|---|---|
| `SCRYPT_PREFIX` | const | `'scrypt$'` -- prefix for scrypt-hashed values |
| `hash(plain)` | async fn | Hash password; tries argon2id first, falls back to Node.js scrypt |
| `verify(storedHash, plain)` | async fn | Auto-detects algorithm from stored hash prefix (`$argon2id$` or `scrypt$`) |
| `dummyVerify()` | async fn | Run equivalent-cost verification against a constant hash; prevents timing-based phone enumeration on unknown-phone login paths |

**Argon2 loading:** Dynamic import via `new Function('m', 'return import(m)')` to hide from bundler static analysis. Argon2 is an optional peer dep.

---

### csrf.ts -- Server-Side CSRF Token Utilities

| Export | Kind | Description |
|---|---|---|
| `generateToken()` | fn | 32-byte crypto random hex (64 chars) |
| `compareTokens(a, b)` | fn | Constant-time comparison via `crypto.timingSafeEqual`; returns false on length mismatch |

---

### csrfClient.ts -- Browser-Side CSRF Token Reader (CLIENT-SAFE)

**WARNING:** `'use client'` files MUST deep-import this file (`@/lib/auth/csrfClient`), never the barrel (`@/lib/auth`). The barrel pulls server-only transitives into the client bundle, causing 500s on every operator console route (Mistake Log operator-smoke entry).

| Export | Kind | Description |
|---|---|---|
| `CSRF_COOKIE` | const | `'bb_csrf'` |
| `readCsrfToken()` | fn | Reads `bb_csrf` cookie from `document.cookie`; returns empty string on server |

---

### authService.ts -- Customer Auth Service

Orchestrates customer register, login, OTP verify, refresh, and logout. All functions call DB/session libs in-process (no self-fetch).

| Export | Kind | Description |
|---|---|---|
| `RegisterInput` | interface | `{ phone, password, displayName? }` |
| `LoginInput` | interface | `{ phone, password }` |
| `AuthResult` | interface | `{ accessToken, refreshToken, refreshHash, csrf, customer: { id, phone, displayName } }` |
| `AuthError` | type | `'INVALID_CREDENTIALS' \| 'PHONE_TAKEN' \| 'OTP_MISMATCH' \| 'OTP_GONE' \| 'SESSION_NOT_FOUND' \| 'SESSION_REUSE' \| 'REFRESH_INVALID'` |
| `AuthServiceError` | class | Extends Error with `.code: AuthError` |
| `register(input)` | async fn | Create customer (with guest-booking backfill), issue session, update lastLoginAt |
| `login(input)` | async fn | Find by phone (soft-delete aware), verify password (dummy on miss), issue session |
| `VerifyOtpResult` | interface | `{ status: 'ok' \| 'mismatch' \| 'gone' \| 'attempt_cap'; otpId? }` |
| `verifyOtp(rawPhone, code)` | async fn | Normalize phone, delegate to `otp.consume()` |
| `refresh(rawToken)` | async fn | Verify refresh token, rotate session; throws on reuse |
| `logout(rawToken)` | async fn | Revoke session by refresh hash; idempotent |

---

### operatorAuthService.ts -- Operator Auth Service

| Export | Kind | Description |
|---|---|---|
| `OperatorLoginInput` | interface | `{ username, password }` |
| `OperatorAuthResult` | interface | `{ accessToken, refreshToken, refreshHash, operator: { id, username, displayName, requiresPasswordChange }, requiresPasswordChange }` |
| `operatorLogin(input)` | async fn | Authenticate by username (not phone); dummy verify on miss/disabled (no enumeration); returns session tokens |

**Note:** Operators log in with a system-generated username (`BRAND_ACRONYM-last4phone`), not their phone number.

---

### adminAuthService.ts -- Admin Auth Service

| Export | Kind | Description |
|---|---|---|
| `AdminLoginResult` | type | `{ ok: true; adminUserId; role } \| { ok: false }` |
| `adminLogin(email, password)` | async fn | Authenticate by email; timing-equalized via constant dummy hash on miss/disabled; never throws (discriminated result). No registration function -- admin accounts are invite-only. |

---

### session.ts -- Customer Session Management

Refresh token rotation with family-based reuse detection. Session expiry: 30 days.

| Export | Kind | Description |
|---|---|---|
| `SessionTokens` | interface | `{ access, refreshToken, refreshHash, csrf }` |
| `CreateSessionResult` | interface | extends SessionTokens with `family: string` |
| `rotateRefresh(oldHash, ip)` | async fn | Atomic rotation in `$transaction`: find by hash, reuse detection (revoke family), revoke old, create new row, sign new access+CSRF |
| `createSession(customerId, ip)` | async fn | Fresh session: generate family, produce refresh token, create Session row, sign access+CSRF |
| `revokeSession(refreshHash)` | async fn | Soft-delete (set revokedAt); idempotent |

---

### operatorSession.ts -- Operator Session Management

Mirrors `session.ts` but operates on `OperatorSession` rows with inline HMAC refresh token helpers.

| Export | Kind | Description |
|---|---|---|
| `OperatorSessionTokens` | interface | `{ accessToken, refreshToken, refreshHash }` |
| `IssueOperatorSessionResult` | interface | extends OperatorSessionTokens with `family` |
| `issueOperatorSession(operatorUserId, requiresPasswordChange?, operatorId?, role?)` | async fn | Create fresh operator session; resolves operatorId/role from DB if not passed |
| `rotateOperatorRefresh(oldHash, requiresPasswordChange?, operatorId?)` | async fn | Atomic rotation with family-reuse detection |
| `revokeOperatorSession(refreshHash)` | async fn | Soft-delete; idempotent |
| `revokeAllOperatorSessions(operatorUserId, excludeSessionId?)` | async fn | Revoke all sessions for a user (optionally excluding one) |
| `verifyOpRefreshToken(token)` | fn | Verify operator refresh token HMAC; returns `{ payload, hash } \| null` |

---

### adminSession.ts -- Admin Session Management

Mirrors `operatorSession.ts` but operates on `AdminSession` rows. Session expiry: 30 days.

| Export | Kind | Description |
|---|---|---|
| `AdminSessionTokens` | interface | `{ accessToken, refreshToken, refreshHash }` |
| `IssueAdminSessionResult` | interface | extends AdminSessionTokens with `family` |
| `issueAdminSession(adminUserId, role, totpVerified?)` | async fn | Create fresh admin session (totpVerified defaults to false) |
| `rotateAdminRefresh(oldHash, role?, totpVerified?)` | async fn | Atomic rotation with family-reuse detection; resolves role from DB if not passed |
| `revokeAdminSession(refreshHash)` | async fn | Soft-delete; idempotent |
| `revokeAllAdminSessions(adminUserId)` | async fn | Revoke all sessions for an admin |
| `verifyAdminRefreshToken(token)` | fn | Verify admin refresh token HMAC; returns `{ payload, hash } \| null` |

---

### operatorOtp.ts -- Operator Password Reset OTP

Mirrors `sendOtp.ts` but uses `OperatorOtpAttempt` table with lockout sentinel behavior.

| Export | Kind | Description |
|---|---|---|
| `SendOpOtpResult` | type | `{ ok: true } \| { ok: false; reason: 'rate_limited' \| 'locked_out'; retryAfter }` |
| `sendOperatorPasswordResetOtp(rawPhone)` | async fn | Rate-limited (3/15min per phone); checks lockout sentinel before sending; atomic supersede via ON CONFLICT |
| `VerifyOpOtpResult` | interface | `{ status: 'ok' \| 'mismatch' \| 'gone' \| 'attempt_cap' \| 'locked_out'; otpId? }` |
| `verifyOperatorOtp(rawPhone, plainCode)` | async fn | CAS verification; 3 failed attempts triggers 15-min lockout sentinel (consumed=true + expiresAt extended) |

**Lockout sentinel pattern:** On the 3rd verify failure, the OTP row is repurposed as a lockout marker (`consumed=true`, `attemptCount>=3`, `expiresAt=now+15min`). Blocks both send and verify paths for the window.

---

### operatorUsername.ts -- Operator Username Generation

System-generated login usernames in the format `BRAND_ACRONYM-last4phone`.

| Export | Kind | Description |
|---|---|---|
| `buildAcronym(brandName)` | fn | First letter of each word (multi-word) or first 3 letters (single word); Vietnamese diacritics stripped; uppercase |
| `last4(phone)` | fn | Last 4 digits of phone; pads with leading zeros |
| `buildUsername(brandName, phone)` | fn | `${buildAcronym(brandName)}-${last4(phone)}` |
| `ensureUniqueUsername(client, base)` | async fn | Collision resolution: appends `-2`, `-3`, ... if base is taken. Must run inside the insert transaction. |

---

### totp.ts -- TOTP Primitives (RFC 6238 / RFC 4226)

Zero-dependency implementation using only Node.js `crypto`. HMAC-SHA1, 30s period, 6 digits, 160-bit secret.

| Export | Kind | Description |
|---|---|---|
| `base32Encode(buf)` | fn | RFC 4648 Base32 encode (uppercase, no padding) |
| `base32Decode(input)` | fn | RFC 4648 Base32 decode (tolerates lowercase + padding) |
| `generateTotpSecret()` | fn | 20-byte (160-bit) random secret as Base32 string |
| `totpAuthUri(secret, accountEmail, issuer?)` | fn | Build `otpauth://totp/...` URI for authenticator apps |
| `generateTotp(secret, timeStepCounter)` | fn | Compute HOTP/TOTP code for a given step counter |
| `verifyTotp(secret, code, atMs?, window?)` | fn | Verify candidate code with +/-window tolerance (default +/-1 step = +/-30s); timing-safe compare |

---

### totpCrypto.ts -- TOTP Secret Encryption at Rest (AUTH-03)

AES-256-GCM encryption for `AdminUser.totpSecret`. Encrypted format: `enc:v1:<base64(iv + ciphertext + authTag)>`.

| Export | Kind | Description |
|---|---|---|
| `encryptTotpSecret(plaintext)` | fn | Encrypt with AES-256-GCM; 12-byte random IV; returns `enc:v1:<base64>` |
| `decryptTotpSecret(stored)` | fn | Decrypt; passes through plaintext secrets without the `enc:v1:` prefix (rolling migration support) |

**Key:** `TOTP_ENCRYPTION_KEY` env var (64-char hex = 32-byte key). Test fallback: `'ab'.repeat(32)`.

---

### adminTotp.ts -- Admin TOTP Enrollment and Verification

Two-phase enrollment state machine built on `totp.ts` + `totpCrypto.ts`.

| Export | Kind | Description |
|---|---|---|
| `BeginEnrollmentResult` | interface | `{ secret, otpauthUri }` |
| `ConfirmEnrollmentResult` | type | `{ ok: true } \| { ok: false; reason: 'not_started' \| 'bad_code' }` |
| `VerifyLoginTotpResult` | type | `{ ok: true } \| { ok: false; reason: 'enrollment_required' \| 'bad_code' }` |
| `beginEnrollment(adminId)` | async fn | Generate secret, persist encrypted (totpEnabledAt stays NULL); throws `'already_enrolled'` if TOTP active |
| `confirmEnrollment(adminId, code)` | async fn | Verify first code against stored secret; sets `totpEnabledAt=now()` on success |
| `verifyLoginTotp(adminId, code)` | async fn | Verify code for login/step-up against active secret; returns `enrollment_required` if TOTP not enabled |

---

### sendOtp.ts -- Customer OTP Dispatch

| Export | Kind | Description |
|---|---|---|
| `SendOtpResult` | type | `{ ok: true } \| { ok: false; reason: 'rate_limited'; retryAfter }` |
| `sendOtp(rawPhone)` | async fn | Rate-limited (3/15min per phone); atomic supersede via ON CONFLICT on partial unique index; dispatches SMS via `lib/notification` |

---

### refreshToken.ts -- Customer Refresh Token Utilities

HMAC-SHA256 refresh tokens: `<base64url(JSON payload)>.<hex-hmac>`. Secret: `REFRESH_TOKEN_SECRET`.

| Export | Kind | Description |
|---|---|---|
| `RefreshPayload` | interface | `{ tokenId, family, customerId, iat, rotation }` |
| `ProduceResult` | interface | `{ token, hash }` |
| `VerifyResult` | interface | `{ payload: RefreshPayload, hash }` |
| `produce(payload)` | fn | Produce token string + SHA-256 hash (for DB storage) |
| `verify(token)` | fn | Verify HMAC (timing-safe), decode payload, compute hash; returns `VerifyResult \| null` |
| `generateFamily()` | fn | `crypto.randomUUID()` |

---

### requireCustomerAuth.ts -- Customer Auth Guard (API Routes)

| Export | Kind | Description |
|---|---|---|
| `CustomerAuthContext` | interface | `{ customerId: string }` |
| `requireCustomerAuth()` | fn | HOF: reads `Authorization: Bearer` header, verifies access JWT, suspension gate (Issue 066: re-reads Customer row, 403 if suspendedAt set), threads `CustomerAuthContext` |
| `getCustomerOptional(req)` | async fn | Non-throwing optional auth: returns `customerId \| null` for routes that work both signed-in and as guest |

---

### requireOperatorAuth.ts -- Operator Auth Guard (API Routes)

| Export | Kind | Description |
|---|---|---|
| `RequireOperatorAuthOptions` | interface | `{ allowDuringPasswordChange?, adminOnly?, staffTripScope? }` |
| `OperatorAuthContext` | interface | `{ operatorUserId, operatorId, role: 'admin'\|'staff', assignedTripId: string\|null }` |
| `requireOperatorAuth(options?)` | fn | HOF: reads `bb_op_access` cookie, verifies JWT, re-reads OperatorUser row (disabled check), password-change gate (403), admin-only gate (403), staff-trip-scope gate (404 -- never 403 to avoid leaking trip existence) |

---

### requireAdminAuth.ts -- Admin Auth Guard (API Routes)

| Export | Kind | Description |
|---|---|---|
| `ADMIN_ACCESS_COOKIE` | const | `'bb_admin_access'` |
| `RequireAdminAuthOptions` | interface | `{ role?: AdminRole \| AdminRole[]; requireTotp?: boolean }` |
| `AdminAuthContext` | interface | `{ adminId, role, totpVerified }` |
| `requireAdminAuth(options?)` | fn | HOF: reads `bb_admin_access` cookie, verifies JWT, re-reads AdminUser row (ACTIVE status check), role gate (403), TOTP gate (403 TOTP_REQUIRED) |

---

### requireAdminPage.ts -- Admin Page Guard (RSC Defense-in-Depth)

| Export | Kind | Description |
|---|---|---|
| `AdminPageContext` | interface | `{ adminId, role, totpVerified }` |
| `requireAdminPage()` | async fn | Reads `bb_admin_access` cookie in RSC context; redirects to `/admin/login` if missing/invalid/totpVerified=false. Does NOT re-read AdminUser row (600s TTL bounds the window; mutations go through `requireAdminAuth`). |

---

### requireStepUp.ts -- Admin Step-Up Gate

Composes on top of `requireAdminAuth({ requireTotp: true })` for high-sensitivity finance/approval actions.

| Export | Kind | Description |
|---|---|---|
| `ADMIN_STEPUP_COOKIE` | const | `'bb_admin_stepup'` |
| `requireStepUp(handler)` | fn | Wrapper: reads `bb_admin_stepup` cookie, verifies step-up JWT (300s TTL), subject must match authenticated admin; 403 `STEP_UP_REQUIRED` on failure |

---

### safeReturnTo.ts -- Post-Login Redirect Validation

| Export | Kind | Description |
|---|---|---|
| `safeReturnTo(raw, fallback?)` | fn | Allows same-origin relative paths (`/path`); rejects absolute URLs, protocol-relative (`//evil.tld`), backslash tricks (`/\evil.tld`); falls back to `/` |

---

### types.ts -- Zod Schemas and TypeScript Types

| Export | Kind | Description |
|---|---|---|
| `phoneSchema` | Zod | Vietnamese phone: `(0\|+84)[35789][0-9]{8}` |
| `passwordSchema` | Zod | 8-128 chars, at least one letter + one digit |
| `LoginCustomerSchema` | Zod | `{ phone, password, scope: 'customer' }` |
| `LoginOperatorSchema` | Zod | `{ phone, password, scope: 'operator' }` |
| `LoginRequestSchema` | Zod | Discriminated union on `scope` |
| `LoginNoScopeSchema` | Zod | Backward-compat variant (scope undefined) |
| `LoginCustomerInput` | type | inferred from LoginCustomerSchema |
| `LoginOperatorInput` | type | inferred from LoginOperatorSchema |
| `LoginRequestInput` | type | inferred from LoginRequestSchema |
| `OperatorProfileSchema` | Zod | `{ phone, contactPhone, notificationPhone, displayName, requiresPasswordChange }` |
| `OperatorProfile` | type | inferred from OperatorProfileSchema |
| `PatchOperatorProfileSchema` | Zod | `{ contactPhone?, notificationPhone?, displayName? }` -- blank strings coerced to undefined |
| `PatchOperatorProfileInput` | type | inferred from PatchOperatorProfileSchema |
| `ChangePasswordSchema` | Zod | `{ currentPassword, newPassword }` |
| `ChangePasswordInput` | type | inferred |
| `ForgotPasswordSchema` | Zod | `{ phone }` |
| `ForgotPasswordInput` | type | inferred |
| `ForgotPasswordVerifySchema` | Zod | `{ phone, code }` (6 digits) |
| `ForgotPasswordVerifyInput` | type | inferred |
| `ForgotPasswordResetSchema` | Zod | `{ otpProof, newPassword }` |
| `ForgotPasswordResetInput` | type | inferred |

---

### index.ts -- Barrel Exports

The barrel re-exports the public API of the auth domain. **Client components (`'use client'`) must NOT import from this barrel** -- it pulls server-only transitives (`prisma`, `pg`, `server-only`). Client components must deep-import `@/lib/auth/csrfClient` directly.

Barrel exports (grouped by source):

| Source Module | Exports |
|---|---|
| `adminAuthService` | `adminLogin` |
| `adminSession` | `issueAdminSession`, `revokeAdminSession`, `rotateAdminRefresh`, `verifyAdminRefreshToken` |
| `adminTotp` | `beginEnrollment`, `confirmEnrollment`, `verifyLoginTotp` |
| `authService` | `login`, `logout`, `refresh`, `register`, `verifyOtp`, `AuthServiceError` |
| `csrfClient` | `readCsrfToken` |
| `jwt` | `signAccess`, `verifyAccess`, `signOperatorAccess`, `verifyOperatorAccess`, `signAdminAccess`, `signAdminStepUp`, `verifyAdminStepUp`, `verifyAdminAccess`, type `AccessPayload`, type `OperatorAccessPayload`, type `AdminAccessPayload` |
| `operatorAuthService` | `operatorLogin` |
| `operatorUsername` | `buildUsername`, `buildAcronym`, `last4`, `ensureUniqueUsername` |
| `operatorOtp` | `sendOperatorPasswordResetOtp`, `verifyOperatorOtp` |
| `operatorSession` | `issueOperatorSession`, `revokeOperatorSession`, `revokeAllOperatorSessions`, `rotateOperatorRefresh`, `verifyOpRefreshToken` |
| `otp` | `generateCode`, `generateSalt`, `hashCode` |
| `otpProof` | `issueOtpProof`, `verifyOtpProof` |
| `password` | `hash`, `verify` |
| `requireAdminAuth` | `requireAdminAuth`, type `AdminAuthContext` |
| `requireAdminPage` | `requireAdminPage` |
| `requireCustomerAuth` | `requireCustomerAuth`, `getCustomerOptional`, type `CustomerAuthContext` |
| `requireOperatorAuth` | `requireOperatorAuth`, type `OperatorAuthContext` |
| `requireStepUp` | `requireStepUp` |
| `safeReturnTo` | `safeReturnTo` |
| `sendOtp` | `sendOtp` |
| `types` | `ChangePasswordSchema`, `ForgotPasswordSchema`, `ForgotPasswordVerifySchema`, `ForgotPasswordResetSchema`, `PatchOperatorProfileSchema`, `passwordSchema`, `phoneSchema` |

---

## Auth Flow Diagrams

### Customer: OTP + Password

```
1. POST /api/auth/otp/send       -> sendOtp(phone)          -> SMS via eSMS
2. POST /api/auth/otp/verify     -> verifyOtp(phone, code)  -> issueOtpProof(phone, 'otp_proof')
3. POST /api/auth/register       -> verifyOtpProof(proof)   -> register({ phone, password })
   POST /api/auth/login          -> login({ phone, password })
4. POST /api/auth/refresh        -> refresh(refreshToken)   -> rotateRefresh(oldHash)
5. POST /api/auth/logout         -> logout(refreshToken)    -> revokeSession(hash)
```

### Operator: Username + Password

```
1. POST /api/op/auth/login       -> operatorLogin({ username, password })
                                  -> issueOperatorSession(userId, requiresPasswordChange, operatorId)
2. POST /api/op/auth/refresh     -> verifyOpRefreshToken(token) -> rotateOperatorRefresh(oldHash)
3. POST /api/op/auth/logout      -> revokeOperatorSession(hash)
4. POST /api/op/auth/forgot-password       -> sendOperatorPasswordResetOtp(phone)
5. POST /api/op/auth/forgot-password/verify -> verifyOperatorOtp(phone, code)
                                             -> issueOtpProof(phone, 'op_pwd_reset')
6. POST /api/op/auth/forgot-password/reset  -> verifyOtpProof(proof, 'op_pwd_reset')
                                             -> hash(newPassword) -> update OperatorUser
```

### Admin: Email + Password + TOTP 2FA

```
1. POST /api/admin/auth/login    -> adminLogin(email, password)
                                  -> issueAdminSession(adminUserId, role, totpVerified=false)
2. POST /api/admin/auth/totp/enroll   -> beginEnrollment(adminId) -> QR code
3. POST /api/admin/auth/totp/confirm  -> confirmEnrollment(adminId, code)
4. POST /api/admin/auth/totp/verify   -> verifyLoginTotp(adminId, code)
                                       -> re-issue session with totpVerified=true
5. POST /api/admin/auth/step-up       -> verifyLoginTotp(adminId, code)
                                       -> signAdminStepUp(adminId)  [300s token]
6. POST /api/admin/auth/refresh  -> verifyAdminRefreshToken(token) -> rotateAdminRefresh(oldHash)
7. POST /api/admin/auth/logout   -> revokeAdminSession(hash)
```

---

## Security Properties

| Property | Mechanism |
|---|---|
| Cross-realm isolation | Per-realm HS256 secrets + scope claim guards in every verify function |
| Timing-safe comparisons | `crypto.timingSafeEqual` in OTP hash compare, CSRF compare, refresh token HMAC, TOTP code verify |
| Anti-enumeration | `dummyVerify()` on unknown-phone/email paths equalizes response timing |
| Refresh token reuse detection | Family-based: presenting a revoked token revokes the entire family |
| TOTP secrets at rest | AES-256-GCM encryption (`totpCrypto.ts`); rolling migration from plaintext |
| OTP replay prevention | CAS-based consumption via raw SQL `UPDATE ... WHERE consumed=false ... RETURNING id` |
| Proof JWT replay prevention | One-shot jti consumption via Redis SETNX (or in-memory for dev/test) |
| Open redirect prevention | `safeReturnTo()` allows only same-origin relative paths |
| CSRF double-submit | Server generates token (32 bytes); Edge middleware sets cookie; client echoes in header |
| Lockout sentinel | 3 failed OTP verifies extends row lifetime to 15 min as a lockout marker |
| Suspension backstop | `requireCustomerAuth` re-reads Customer.suspendedAt on every request |
| Step-up re-auth | 300s step-up JWT for high-sensitivity admin actions; scope='admin_stepup' prevents use as access token |
| Password change gate | `requiresPasswordChange` encoded in operator JWT claim; Edge middleware redirects without DB read |
| Staff trip scope | `staffTripScope` resolver returns 404 (not 403) on mismatch to avoid leaking trip existence |

---

## Environment Variables

| Variable | Realm | Required | Purpose |
|---|---|---|---|
| `JWT_SECRET` | Customer | prod | HS256 signing secret for customer access tokens |
| `JWT_OPERATOR_SECRET` | Operator | prod | HS256 signing secret for operator access tokens |
| `JWT_ADMIN_SECRET` | Admin | prod | HS256 signing secret for admin access + step-up tokens |
| `REFRESH_TOKEN_SECRET` | All | prod | HMAC-SHA256 secret for refresh tokens (all three realms) |
| `TOTP_ENCRYPTION_KEY` | Admin | prod | AES-256-GCM key (64-char hex) for encrypting TOTP secrets at rest |
| `UPSTASH_REDIS_REST_URL` | Customer | prod | Upstash Redis for OTP proof jti consumption |
| `UPSTASH_REDIS_REST_TOKEN` | Customer | prod | Upstash Redis auth token |
| `REDIS_URL` | Customer | prod (ioredis) | ioredis URL for OTP proof jti consumption |
| `REDIS_PROVIDER` | Customer | opt | `'upstash'` or `'ioredis'`; auto-detected if Upstash env vars present |
| `OTP_PEEK_ENABLED` | Operator | dev only | Skip rate-limiter in dev/e2e (MUST NOT be set in production) |

All have test fallbacks when `NODE_ENV === 'test'`.

---

## Test Files

| File | Type | Coverage |
|---|---|---|
| `__tests__/password.test.ts` | unit | Scrypt hash/verify: format, correctness, salt uniqueness |
| `__tests__/csrf.test.ts` | unit | Token generation (64-char hex), timing-safe comparison |
| `__tests__/refreshToken.test.ts` | unit | Produce/verify roundtrip, family-based rotation |
| `__tests__/otpProof.test.ts` | unit | Purpose enforcement, jti consumption, replay rules per purpose |
| `__tests__/adminAuthService.test.ts` | unit | Admin login no-enumeration contract (missing/disabled/wrong all same shape) |
| `__tests__/authService.test.ts` | unit | Customer register, login, session creation with mocked Prisma |
| `__tests__/jwt.test.ts` | unit | Sign/verify roundtrip, TTL, role claims for all three realms |
| `__tests__/operatorOtp.test.ts` | unit | Operator OTP verify/send, 15-min lockout sentinel behavior |
| `__tests__/operatorSession.test.ts` | unit | Operator session lifecycle: issue, rotate (reuse detection), revoke |
| `__tests__/otp.int.test.ts` | integration | Concurrent OTP consume race on real DB -- exactly one succeeds |
| `__tests__/otp.test.ts` | unit | OTP primitives: 6-digit generation, hashing, consume logic |
| `__tests__/patchOperatorProfileSchema.test.ts` | unit | Zod schema: blank phone coercion, validation |
| `__tests__/requireAdminPage.test.ts` | unit | RSC admin guard: missing/invalid cookie redirects |
| `__tests__/requireCustomerAuth.test.ts` | unit | Customer auth middleware: JWT validation, suspension gate |
| `__tests__/requireOperatorAuth.test.ts` | unit | Operator auth HOF: cookie/token/password-change/cross-scope gates |
| `__tests__/requireStepUp.test.ts` | unit | Step-up gate: missing cookie, sub mismatch, valid passthrough |
| `__tests__/safeReturnTo.test.ts` | unit | Open-redirect guard: relative paths OK, absolute/protocol-relative/backslash rejected |
| `__tests__/sendOtp.test.ts` | unit | OTP sending with mocked rate limiter and eSMS |
| `__tests__/session.test.ts` | unit | Customer session CRUD with mocked Prisma transactions |
| `__tests__/totp.test.ts` | unit | RFC 6238 primitives: base32, code generation/verification against test vectors |
| `__tests__/operatorUsername.test.ts` | unit | Acronym building (Vietnamese diacritics), last4, collision resolution |
| `__tests__/adminTotp.test.ts` | unit | TOTP enrollment state machine (begin/confirm) and login verification |
| `__tests__/totpCrypto.test.ts` | unit | AES-GCM encrypt/decrypt roundtrip: format prefix, unique IVs, tamper detection |

---

## Cookie Reference

| Cookie | Realm | Type | Set By | Read By |
|---|---|---|---|---|
| `bb_csrf` | All | non-HttpOnly | `proxy.ts` (Edge) | `csrfClient.ts` (browser) |
| `bb_op_access` | Operator | HttpOnly | login/refresh route | `requireOperatorAuth` |
| `bb_admin_access` | Admin | HttpOnly | login/refresh route | `requireAdminAuth`, `requireAdminPage` |
| `bb_admin_stepup` | Admin | HttpOnly | step-up route | `requireStepUp` |
| `bb_refresh` | Customer | HttpOnly | login/register route | refresh route |
| `bb_op_refresh` | Operator | HttpOnly | login route | refresh route |
| `bb_admin_refresh` | Admin | HttpOnly | login route | refresh route |
