# DS-033 — OAuth Account Linking (Google Sign-In)

> **Related:** ADR-021, ADR-003, ADR-008, DS-001, DS-003, FI-016, FD-012, HD-012

## 1. Overview

This spec defines the data model and linking rules for **customer** OAuth identity (Google Sign-In),
per ADR-021 D3/D4. It is an extension of the Auth context in [DS-001 §2.1](../DS-001-data-model/README.md)
(Customer realm) and does not touch operator/admin realms. Persistence is PostgreSQL 16 via Prisma 7.

**Design stance**: store the *minimum* identity needed to recognise a returning Google user. We keep
only the provider + provider subject id linked to a `Customer`. Google access/refresh tokens are
**not** persisted — they are used once during the callback (to read `id_token` claims) and discarded.
This keeps the OAuth PII/secret surface minimal (ADR-008 data-minimisation).

---

## 2. Entity Catalog

### 2.1 Account (new)

Customer↔provider link. One row per (provider, external account). A `Customer` may have zero or one
Google `Account` (and, in future, other providers).

| Column | Prisma Type | Nullable | Default | Constraints / Notes |
|--------|-------------|----------|---------|---------------------|
| id | String | No | `@default(cuid())` | Primary key |
| customerId | String | No | — | FK → `Customer.id`, `onDelete: Cascade` |
| provider | String | No | — | Provider key, lowercase. Phase: `"google"` only |
| providerAccountId | String | No | — | Provider subject id. For Google = the OIDC `sub` claim (stable, opaque) |
| email | String | Yes | — | Email asserted by provider at link time (audit/debug only; the authoritative email is `Customer.email`) |
| createdAt | DateTime | No | `@default(now())` | |
| updatedAt | DateTime | No | `@updatedAt` | |

**Indices / constraints**
- `@@unique([provider, providerAccountId])` — one Customer per Google account; prevents a second
  customer claiming the same Google identity.
- `@@index([customerId])` — list a customer's linked providers.

**Relation**: `Customer` gains `accounts Account[]` (see DS-001 §2.1 amendment).

> **Not stored**: `access_token`, `refresh_token`, `id_token`, `expires_at`. We do not act on the
> user's behalf against Google APIs; identity is read once at callback and dropped. If a future
> feature needs Google API access, add token columns then — and add them to the logger redact list and
> at-rest encryption first (ADR-008 / DS-001 conventions).

### 2.2 Customer (amended — see DS-001 §2.1)

Two changes relevant here:
- `emailVerifiedAt DateTime?` — set to `now()` when the email is proven: at registration via the
  email OTP (the code sent to the email proves ownership) or when Google asserts `email_verified=true`.
  Gates safe OAuth auto-linking.
- `passwordHash` (hashed with **scrypt** today; **argon2id** is the planned upgrade, P19) is **nullable
  and legitimately null** for OAuth-only customers (resolves the ADR-003
  D1 "IMPLEMENTED_DIFFERENTLY" note — the column is load-bearing, and null now means "no password
  credential, OAuth or unverified-signup only").

Email uniqueness is already enforced by the existing partial unique index
`Customer_email_key ON "Customer"("email") WHERE "email" IS NOT NULL` (migration
`20260519003311_issue_007_auth`). It stays SQL-only (project rule: partial/WHERE indices are not
expressed as Prisma `@unique`).

---

## 3. Account-Linking Rules

Resolution order in `GET /api/auth/google/callback`, after `id_token` validation yields
`{ sub, email, email_verified }`:

1. **Known link** — `Account.findUnique({ provider:'google', providerAccountId: sub })`.
   → Load its `Customer`. If that Customer is `deletedAt`/`suspendedAt`, reject (fail like
   `requireCustomerAuth`).
2. **Link to existing email** — else `Customer.findFirst({ email, deletedAt: null })`
   **AND `email_verified === true`** → create `Account` linking `sub` to that Customer; set
   `emailVerifiedAt = now()` if not already set.
3. **New customer** — else create `Customer { email, passwordHash: null, emailVerifiedAt: email_verified
   ? now() : null }` + `Account`, then `backfillGuestBookingsByEmail(tx, customerId, email)`.
   (Tightening: an unverified Google email must not silently mark the new account's email as proven.)

**Invariants**
- **L1 — No unverified auto-link.** Step 2 requires `email_verified === true`. An unverified Google
  email must NOT link to an existing password account (account-takeover guard, HD-012).
- **L2 — Single Google account per Customer.** Enforced by `@@unique([provider, providerAccountId])`;
  a P2002 on link is treated as "already linked", resolved by re-reading the link (idempotent).
- **L3 — Atomic create+link+backfill.** Steps 2/3 run inside one `prisma.$transaction` (callback form)
  so a partial link (Customer without Account, or Account without session) cannot occur.
- **L4 — Session parity.** On success, mint a customer session via the same `createSession` path as
  password login (DS-003 §customer-auth) — no OAuth-specific token type.

---

## 4. Transient OAuth State (not persisted in DB)

PKCE `code_verifier` + CSRF `state` are **request-scoped**, not stored in Postgres:
- `GET /api/auth/google/start` generates `state` + `code_verifier` (via `arctic`), stores both in a
  **short-lived signed HttpOnly cookie** (e.g. `bb_goauth`, `SameSite=Lax`, `maxAge` ~10 min,
  `secure` in prod), and 302s to Google.
- `GET /api/auth/google/callback` reads the cookie, checks the returned `state` matches, uses
  `code_verifier` in the token exchange, then clears the cookie.

No DB table is added for OAuth state — it is one round-trip and self-expiring. This mirrors the
double-submit CSRF stance (stateless, Edge-friendly) of ADR-003 D5.

---

## 5. Migration Strategy

Forward migration (new file under `prisma/migrations/`, never edit committed ones):
1. `CREATE TABLE "Account"` with the columns/constraints in §2.1; FK to `Customer(id)` ON DELETE
   CASCADE; `CREATE UNIQUE INDEX "Account_provider_providerAccountId_key"`; `CREATE INDEX
   "Account_customerId_idx"`.
2. `ALTER TABLE "Customer" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3)` (nullable; existing rows null).
3. Declare `Account` + `emailVerifiedAt` in `schema.prisma` (the unique + customerId indices are plain
   B-tree → expressible as Prisma `@@unique`/`@@index`; the pre-existing `Customer_email_key` partial
   index remains SQL-only).

**NOT NULL / backfill**: no new NOT NULL column on an existing table (`emailVerifiedAt` is nullable),
so no backfill required. Per project rule, before merging grep every `prisma.customer.create` /
`INSERT INTO "Customer"` in `e2e/`, `prisma/seed.ts`, `__tests__/` — none need changes since the new
column is nullable and `Account` is additive.

**Rollback**: drop `Account`, drop `Customer.emailVerifiedAt` (reverse migration). No data loss for
password customers (email + passwordHash untouched).

---

## 6. Cross-References

- **Decision:** [ADR-021](../../architecture-decisions/ADR-021-customer-email-google-auth/README.md) (D3/D4)
- **Base data model:** [DS-001 §2.1](../DS-001-data-model/README.md)
- **API contract:** [DS-003](../DS-003-api-contract/README.md) (Google start/callback endpoints)
- **Implementation:** [FI-016](../../feature-implementation/FI-016-google-oauth/README.md)
- **Hardening:** [HD-012](../../hardening/HD-012-auth-attack-surface/README.md) (OAuth attack surface)
