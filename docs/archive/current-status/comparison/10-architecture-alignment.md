# Architecture Alignment — What IS Correct

Areas where the codebase is substantially aligned with documentation specs. No gaps.

---

## 1. Data Model — ALIGNED

**Spec:** DS-001 (Data Model)
**Reality:** 38 Prisma models, 19 enums, 67 forward-only migrations

| Check | Status |
|---|---|
| All DS-001 entities exist in `schema.prisma` | YES |
| Enum values match spec | YES |
| Relations correctly modeled | YES |
| Indices declared (non-partial in DSL + SQL) | YES (Mistake Log Issue 007 rule followed) |
| Partial indices stay SQL-only | YES |
| Forward-only migration policy | YES (committed migrations never edited) |
| Soft-delete pattern (`deletedAt` nullable DateTime) | YES (Customer, Operator models) |
| Append-only tables (LedgerEntry, AdminAuditLog) | YES (PostgreSQL triggers enforce immutability) |

---

## 2. Dependency Flow — ALIGNED

**Spec:** ADR-016 (Module Boundaries), CLAUDE.md Architecture section

```
app/            →  lib/<domain>/   →  lib/core/
  (customer)         auth, booking,       db, logger, config
  op/                payment, ledger,
  admin/             catalog, search,
  api/               notification, ...
  dev/
components/     →  lib/<domain>/
proxy.ts             (Edge middleware)
```

| Check | Status |
|---|---|
| No reverse dependencies (lib/ → app/) | ENFORCED by eslint-plugin-boundaries |
| No circular dependencies | ENFORCED by eslint-plugin-import-x `no-cycle` (error severity) |
| Cross-domain imports via barrel only | ENFORCED (post-Issue 092b sweep) |
| Intra-domain deep imports allowed | YES |
| `lib/core/` and `lib/utils/` exempt from barrel rule | YES |
| `'use client'` components deep-import client-safe modules | ENFORCED (operator-smoke fix) |

---

## 3. Transaction Patterns — ALIGNED

**Spec:** ADR-009 (Concurrency & Seat Holding), Mistake Log Issues 011/013/014

| Pattern | Spec Rule | Status |
|---|---|---|
| Read-then-write uses `prisma.$transaction(async (tx) => ...)` | Callback form, not array form | YES |
| Gating row locked with `SELECT ... FOR UPDATE` | Serialize concurrent writes | YES |
| Timestamp + status update in same `tx.model.update` | Mistake Log Issue 014 | YES |
| `PaymentEvent @@unique([adapter, providerTxnId])` | Webhook idempotency | YES |
| `LedgerEntry.sourceEventId` unique constraint | Prevent double-entry | YES |
| CUID TEXT columns — no `::uuid` cast in raw SQL | Mistake Log Issue 011 | YES |

---

## 4. Currency Math — ALIGNED

**Spec:** ADR-006 (Pricing & Currency), Mistake Log Issue 016

| Check | Status |
|---|---|
| All money math in BigInt domain | YES |
| `BigInt()` constructor calls (not `1n` literal — ES2017 target) | YES |
| Platform fee encoded as `ratePpm` in BigInt domain | YES |
| Half-even rounding via `remainder * BigInt(2) === denominator` | YES |
| No `Math.round(<int> * <fractional>)` in money modules | YES (verified in Mistake Log Issue 016 fix) |

---

## 5. Timezone Handling — ALIGNED

**Spec:** ADR-006, Mistake Log Issue 014

| Check | Status |
|---|---|
| Business dates use Vietnam UTC+7 (`Asia/Ho_Chi_Minh`) | YES |
| Service date filters use `${date}T00:00:00+07:00` window | YES |
| Test date derivation matches filter timezone | YES (Mistake Log Issue 014 fix) |
| Cron sidecar runs with `TZ=Asia/Ho_Chi_Minh` | YES (SI-006 crontab config) |

---

## 6. Auth Architecture — ALIGNED

**Spec:** ADR-003 (Auth Architecture), FI-001

| Check | Status |
|---|---|
| 3-realm JWT: customer, operator, admin | YES |
| Customer: OTP-only (phone-based) | YES (soft-disabled) |
| Operator: password + OTP proof (phone verification) | YES |
| Admin: password + TOTP (authenticator app) | YES |
| JWT 15-min access TTL + refresh token rotation | YES |
| CSRF double-submit on all non-safe `/api/*` | YES |
| `requiresPasswordChange` claim in operator JWT | YES |
| Exact-match Set allowlist for path-bypass (not prefix-match) | YES (Mistake Log Issue 010) |
| OTP lockout: 3 failures → 15-min lockout | YES (Mistake Log Issue 010) |
| OTP proof: short-TTL signed JWT, one-shot via SETNX jti | YES (Mistake Log Issue 007) |
| Refresh token in HttpOnly cookie | YES |
| CSRF token in non-HttpOnly cookie (`bb_csrf`) | YES |

**Gap exception:** Admin TOTP replay protection (SETNX jti 30s) NOT implemented. See 02-security-gaps.md.

---

## 7. Edge Middleware — ALIGNED

**Spec:** ADR-003, ADR-008, proxy.ts documentation

| Check | Status |
|---|---|
| No database reads in Edge runtime | YES (JWT claims only) |
| Operator auth guard (bb_op_access cookie) | YES |
| Admin auth guard (bb_admin_access cookie) | YES |
| Customer pause layer (soft-disable auth routes) | YES |
| Rate-limit (InMemoryRatelimit dev, Upstash prod) | YES |
| CSRF double-submit validation | YES |
| Webhook exemption (HMAC auth, no CSRF) | YES |
| Request-ID generation | YES |

---

## 8. PII Handling — ALIGNED

**Spec:** ADR-008, Mistake Log Issues 001/003/007

| Check | Status |
|---|---|
| Phone placeholders: `+8490xxxxxx[N]` format | YES (escapes `.gitleaks.toml` regex) |
| Logger redact list covers sensitive fields | YES (otpProof, tempPassword, tokens) |
| `select` whitelists = UI contract fields only | YES (no filter-only columns leaked) |
| No `accessToken` in API responses | YES (A2 data leak audit check) |
| `tempPasswordPlain` scoped to dev | YES (A1 check) |

---

## 9. State Machines — ALIGNED

**Spec:** ADR-019 (State Machines), `business/domain-model/state-machines.md`

| State Machine | Spec | Implemented | Has `LEGAL_*_TRANSITIONS` |
|---|---|---|---|
| Trip lifecycle | scheduled → departed → completed / cancelled | YES | PARTIAL |
| Booking lifecycle | pending_payment → paid → cancelled | YES | YES |
| Payment lifecycle | pending → success → failed | YES | YES |
| Payout lifecycle | pending → processing → settled → failed → reversed | YES | PARTIAL |
| Charter lifecycle | submitted → assigned → accepted → completed / cancelled / expired | YES | YES |
| OTP lifecycle | active → consumed / expired / locked | YES | PARTIAL |
| Operator approval | PENDING_REVIEW → UNDER_REVIEW → APPROVED / REJECTED / SUSPENDED | YES | PARTIAL |
| E-Invoice lifecycle | pending → issued → failed / correction | YES | PARTIAL |

**Gap:** 5 of 8 machines lack formal `LEGAL_*_TRANSITIONS` constants (KG-17). Transitions work correctly in code but aren't enforced by a single canonical map.

---

## 10. Barrel Discipline — ALIGNED (Post-Issue 092b)

**Spec:** ADR-016 D8, Issue 092b (barrel sweep ~968 reach-ins → 0)

| Check | Status |
|---|---|
| Every `lib/<domain>/` has `index.ts` barrel | YES |
| Cross-domain imports go through barrel only | ENFORCED |
| `eslint-plugin-boundaries` at error severity | YES |
| `eslint-plugin-import-x` `no-cycle` at error severity | YES |
| `'use client'` files deep-import `csrfClient` not `@/lib/auth` barrel | YES (operator-smoke fix) |
| A3 data leak audit guard active | YES |

---

## 11. Mistake Log Lessons — ALL APPLIED

All 20+ Mistake Log entries from AGENTS.md have been verified as fixed:

| Issue | Lesson | Status |
|---|---|---|
| 001 | Maintenance-window filter: window-vs-window overlap | FIXED |
| 001 | Select whitelist: no filter-only columns | FIXED |
| 001 | PII placeholders: `+8490xxxxxx[N]` format | FIXED |
| 002 | No self-fetch from server components | FIXED (lib function extraction) |
| 002 | E2E: URL params not synthetic keystrokes | FIXED |
| 003 | Booking ref regex: exported constant | FIXED |
| 004 | MoMo failure codes: AC-verbatim only | FIXED |
| 007 | Raw SQL indices: dual declaration | FIXED |
| 007 | OTP proof: signed JWT not session table | FIXED |
| 007 | CSRF: grep all callers before middleware merge | FIXED |
| 010 | Hex mock validity: 64-char for SHA-256 | FIXED |
| 010 | OTP lockout: reuse row as sentinel | FIXED |
| 010 | `requiresPasswordChange`: JWT claim + exact-match Set | FIXED |
| 011 | Status codes: AC-verbatim | FIXED |
| 011 | Capacity reduction: `$transaction` + FOR UPDATE | FIXED |
| 012 | NOT NULL column: grep all create/INSERT | PROCESS ESTABLISHED |
| 013 | DTO: mirror every non-relational scalar | FIXED |
| 013 | Idempotent cancel: discriminated result | FIXED |
| 013 | Error code throw: every union variant must have throw + test | PROCESS ESTABLISHED |
| 014 | Timestamp + status: same `tx.model.update` | FIXED |
| 014 | `scheduledFor` as top-level column, not JSON payload | FIXED |
| 016 | Currency math: BigInt domain | FIXED |
| 016 | RSC purity: no `Date.now()` in render body | FIXED |
| 020 | CHECK constraint: validate all insert paths | FIXED (constraint dropped) |
| 008 | Prisma method change: update all mocks | PROCESS ESTABLISHED |
| 092b | Barrel sweep: `'use client'` deep-import rule | FIXED |
