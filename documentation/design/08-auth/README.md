> ← [Previous](../07a-form-validation/) | [Index](../README.md) | [Next →](../09-payment/)

## 8. Identity & Access Control

### 8.1 Three Auth Realms — Why Separate?

Each user group has a different trust level and attack surface:

| Realm | Login Method | Session | Why Different |
|-------|-------------|---------|---------------|
| **Customer** | Phone + OTP (paused; guest-only now) | Short JWT | Low trust; high volume; guest allowed |
| **Operator** | Username + password | JWT + refresh cookie | Medium trust; tenant-scoped; staff roles |
| **Admin** | Email + password + TOTP (mandatory) | Short JWT + step-up | High trust; high privilege; invite-only |

They use **separate database tables, separate cookie scopes, and separate middleware chains**. An operator credential cannot log into admin. A customer credential cannot access operator data.

### 8.2 JWT — JSON Web Token

**What it is**: A JWT is a small, signed data packet that proves who you are. The server creates it at login and the client sends it with every request. The server verifies the signature without hitting the database.

**Structure**: `header.payload.signature`
- **Header**: Algorithm used (HS256)
- **Payload** (claims): `{ userId, operatorId, role, requiresPasswordChange, exp }` — what the server needs to authorize the request
- **Signature**: HMAC hash proving the server issued it and nobody tampered with it

**Why JWT over sessions?**
- **Stateless**: No server-side session store to manage. Any server instance can verify the token.
- **Edge-safe**: Vercel Edge middleware can read JWT claims without a database query (critical — Edge runtime can't use Prisma/PostgreSQL).

**Token lifecycle**:
1. User logs in → server issues an **access token** (15-min TTL) + **refresh token** (7-day TTL, stored as HttpOnly cookie + hashed in DB)
2. Client sends access token with every request
3. Access token expires → client uses refresh token to get a new access token
4. Refresh token rotation: each use issues a new refresh token and invalidates the old one (reuse detection → revoke all sessions)

> **Trade-off**: A single `JWT_SECRET` signs all tokens across all three realms. Simpler than per-realm key management, but rotating the key invalidates ALL active sessions (customer + operator + admin simultaneously). Mitigation: access token TTL is short (15 min for customer/operator, 10 min for admin), so natural expiry handles most rotation lag. Stage 1 improvement: per-realm signing keys.

### 8.3 RBAC — Role-Based Access Control

**What it is**: Each user has a role, and each role has permissions. The system checks "does this user's role allow this action?" rather than "is this specific user allowed?"

**Operator roles**:
- `admin` — full access to operator console (fleet, trips, bookings, money, settings, staff management)
- `staff` — limited access (bookings, manifest, check-in; no money, no fleet edits)

**Admin roles**:
- `super_admin` — everything including admin account management, system config
- `finance` — finance tab only (payouts, ledger, refunds, disputes)
- `support` — user management, moderation; no finance

### 8.4 Tenant Isolation

**What it is**: Ensuring Operator A can never see, modify, or affect Operator B's data. Every row belonging to an operator has an `operatorId` column, and every query includes `WHERE operatorId = ?`.

**How it's enforced**: A `withOperatorScope(operatorId)` helper wraps every operator-realm database query, automatically injecting the tenant filter. Developers never write unscoped queries by hand.

**Defense in depth**:
1. JWT carries `operatorId` claim (can't be changed by the client)
2. Middleware extracts `operatorId` from JWT
3. Every DB query uses the tenant-scope helper
4. Integration tests verify cross-tenant queries return empty results

### 8.5 Edge Middleware Auth

**The problem**: Next.js middleware runs on the **Edge Runtime** (a lightweight JavaScript environment at the CDN edge). Edge Runtime cannot use Node.js APIs like `crypto` (for password hashing) or database drivers (Prisma/pg). So auth checks in middleware can't query the database.

**The solution**: Encode all gate state into the JWT claim itself. Middleware reads the claim with `jose.jwtVerify()` (Edge-safe).

Example: The `requiresPasswordChange` flag is a JWT claim, not a DB lookup. When an operator changes their password, the server mints a fresh token with `requiresPasswordChange: false`.

**`requiresPasswordChange` gate precision**:
- Bypass paths use an **exact-match `Set`** of allowed paths (NOT `startsWith`) — prevents `/op/first-login-bypass`-style sneak-throughs.
- The fresh token (with `requiresPasswordChange: false`) must be minted in the **same transaction** as the DB password update — otherwise the old JWT keeps redirecting to first-login.

### 8.6 CSRF Double-Submit Pattern

**Layer 2** in `proxy.ts` (after the JWT auth gate): for all **non-safe HTTP methods** (POST, PUT, PATCH, DELETE) on `/api/*`, the middleware requires an `X-CSRF-Token` header whose value matches the `bb_csrf` cookie.

- **Cookie**: `bb_csrf` — non-HttpOnly (JavaScript must read it), SameSite=Lax.
- **Client helper**: `lib/auth/csrfClient.ts` exports `readCsrfToken()` for browser-side code. E2E helper: `e2e/helpers/csrf.ts` `primeCsrf()` extracts the cookie via Playwright's `request.storageState()`.
- **Exemptions**: HMAC-authenticated webhooks (`/api/payments/momo/webhook`) are exempt (authenticated by HMAC signature, not cookies). Pre-auth routes (`/api/op/auth/forgot-password*`) are exempt (no token exists yet).
- **`'use client'` components** must deep-import `@/lib/auth/csrfClient` — never the `@/lib/auth` barrel (which pulls server-only modules and breaks the client bundle).

### 8.7 Operator Session Details

**Unified login route**: Operator login uses `POST /api/auth/login` with `{ scope: 'operator' }` in the body — NOT a separate `/api/op/auth/login` endpoint. The route handler checks the `scope` field and dispatches to operator-specific credential verification. This means the login route must be CSRF-exempt for both customer and operator flows.

**Two-cookie session**:

| Cookie | TTL | Scope |
|--------|-----|-------|
| `bb_op_access` | 15 minutes, HttpOnly | Operator access token |
| `bb_op_refresh` | 30 days, HttpOnly | Operator refresh token (hashed in DB) |

**Anti-enumeration**: Operator login uses `dummyVerify` on miss (phone not found) and disabled accounts — constant-time fake bcrypt comparison to prevent timing-based account enumeration. Same technique as customer auth.

### 8.8 `otpProof` JWT Details

The `otpProof` JWT carries a `purpose` claim with distinct values:
- `otp_proof` — for registration flow
- `reset` — for forgot-password flow

Each consuming endpoint **rejects mismatched purposes** — a `reset` proof cannot be used at the register endpoint and vice versa.

The `otpProof` field is on the **logger redaction list** (`lib/logger.ts`) — it is never logged in structured output.

### 8.9 Session Revocation Scope

Session revocation behavior differs by trigger:

| Trigger | Revoked sessions | Why |
|---------|-----------------|-----|
| **Password change** | All *other* sessions (keeps current) | User is already authenticated on this device |
| **Password reset** (forgot-password) | ALL sessions (including current) | The reset proves phone ownership, not current-device trust |

### 8.10 Soft-Delete Phone Anonymization

When a customer deletes their account:
- Phone is set to `NULL` (not masked, not hashed) — this frees the unique constraint slot and allows re-registration with the same phone number.
- `deletedAt` is set to the current timestamp.
- Booking rows are **retained** (buyer fields are snapshotted on the Booking row at booking time — customer anonymization does not orphan booking history).

### 8.11 Staff Provisioning Flow

1. Operator admin creates a staff member → server generates a temporary password
2. Temp password delivered via SMS (template: `operatorAdminTempPassword`) — the SMS is the only copy of the credential
3. JWT minted with `requiresPasswordChange: true` → staff forced to `/op/first-login` on next access
4. After password change → server mints fresh JWT with `requiresPasswordChange: false` in the same transaction

**Role is immutable**: Once assigned at creation, an operator user's role (`admin` / `staff`) cannot be changed via the API. To change a role, disable the account and create a new one.

### 8.12 Transaction Guard for Operator Mutations

All operator CRUD mutations that validate-then-write use `prisma.$transaction(async (tx) => {...})` (**callback form**, NOT array form — the array form provides no `tx` handle for raw SQL) with a leading `SELECT ... FOR UPDATE` on the gating row to serialize concurrent modifications.

Example: capacity-reduction guard reads `SUM(seats)` from bookings, then writes the new capacity to the Bus row. Without the transaction + row lock, a concurrent `/api/holds` could push paid bookings above the new capacity between the read and write.

### 8.13 I7 Price Authority Rule

**Customer-facing endpoints** (`/api/holds/**`, `/api/bookings/**`, `/api/payments/**`): price on the request body is **rejected**. The server computes price from the Trip row — no client-originated price (prevents underpayment).

**Operator-facing endpoints** (`/api/op/**`): price on the request body is **accepted**. The operator IS the authoritative price source for their trips (Route has no `basePrice` to derive from). Each exempt route handler carries an inline `// I7-exempt:` comment.
