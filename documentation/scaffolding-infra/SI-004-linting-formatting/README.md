# SI-004: Linting, Formatting & Code Quality Standards

> Status: DOCUMENTED | References: ADR-008, ADR-015, ADR-016, ADR-018

## Purpose

This document consolidates the linting, formatting, and static-analysis conventions for the BenXe bus-booking platform. It draws from the module boundary enforcement rules (ADR-016), the security posture that places `pnpm lint` as Layer 5 of the defense-in-depth model (ADR-008 D1), the API response standards that govern how validation errors are shaped (ADR-015), and the test-quality rules derived from hard-learned production bugs (ADR-018). The goal is a single reference that a developer can consult to understand what runs in pre-commit hooks, what runs in CI, why each rule exists, and what the greppable enforcement patterns are.

---

## 1. ESLint Configuration

The project uses ESLint flat config (not the legacy `.eslintrc.*` format). The flat config format is required because `eslint-plugin-import-x` -- the successor to the now-legacy `eslint-plugin-import@2` -- ships with a flat-config export; the older `eslint-plugin-import@2` is CJS-only and has no flat-config export (ADR-016 D6).

### 1.1 Core Plugins

| Plugin | Purpose | Severity |
|--------|---------|--------|
| `@next/eslint-plugin-next` | Next.js-specific rules (Image, Link, font optimization, server component patterns) | error / warn per rule |
| `@typescript-eslint` | TypeScript strict mode rules (see Section 1.2) | error |
| `eslint-plugin-boundaries` | Module boundary enforcement -- cross-domain barrel rule (see Section 2.1) | error |
| `eslint-plugin-import-x` | Cycle detection -- `import/no-cycle` (see Section 2.2) | error |

### 1.2 TypeScript Strict Mode

TypeScript is configured with `strict: true` in `tsconfig.json`. This activates:

- `strictNullChecks` -- no implicit `null | undefined` assignments
- `noImplicitAny` -- all parameters and return types must be typed or inferred
- `strictFunctionTypes` -- function type variance is checked correctly
- `noUncheckedIndexedAccess` -- array/object index access returns `T | undefined`

The ESLint TypeScript plugin enforces rules that TypeScript's own compiler does not catch, including no-floating-promises (prevents unhandled async errors) and no-unused-vars with an underscore convention for intentionally unused parameters.

Type checking is run as a separate gate (`tsc --noEmit`) rather than inside ESLint to avoid the performance cost of typed lint rules on the full codebase. Both gates are required: ESLint catches import/boundary issues; `tsc --noEmit` catches type errors.

### 1.3 Gating

`pnpm lint` runs ESLint across the full project. It is gated by:

1. **CI pipeline** -- every PR must pass `pnpm lint` before merge (see SI-003 Section 1)
2. **Pre-commit hook** -- lint runs on staged files before every local commit (see Section 5)

---

## 2. Module Boundary Enforcement

The platform is a modular monolith. Without enforced import boundaries, cross-domain coupling accumulates silently. The two specific failure modes that drove the rules below were: (a) barrel imports pulling server-only modules into client bundles causing full-portal 500 errors; and (b) circular dependency chains preventing independent domain extraction.

### 2.1 eslint-plugin-boundaries -- Entry-Point Rule

**Rule**: `boundaries/entry-point` (error severity)

**What it enforces** (ADR-016 D4):

| Import pattern | Allowed |
|----------------|--------|
| `lib/booking/` imports from `lib/payment/index.ts` (barrel) | Yes -- cross-domain through barrel |
| `lib/booking/` imports from `lib/payment/processWebhook.ts` (deep) | No -- cross-domain must use barrel |
| `lib/booking/transitions.ts` imports from `lib/booking/bookingRepo.ts` (deep) | Yes -- intra-domain deep import is allowed |
| `app/api/holds/route.ts` imports from `lib/booking/index.ts` | Yes -- experience layer to domain barrel |

**Exempt modules** (ADR-016 D5):
- `lib/core/` -- shared primitives imported by all domains; no barrel enforcement
- `lib/utils/` -- pure utility functions; same exemption
- Test files (`__tests__/`, `*.test.ts`, `*.int.test.ts`) -- may deep-import for unit testing internals
- Dev-only files (`app/dev/**`) -- boundary-exempt for development tooling

**Plugin version note**: `boundaries/entry-point` is deprecated in `eslint-plugin-boundaries` v6 but continues to function correctly. Migration to `boundaries/dependencies` is deferred; the current rule must not be removed until the replacement is in place.

### 2.2 eslint-plugin-import-x -- No Cycle Rule

**Rule**: `import/no-cycle` (error severity)

No circular import chains across any source files. If `lib/booking/` imports `lib/payment/` and `lib/payment/` imports `lib/booking/`, both domains become inseparable -- neither can be extracted to a separate service.

**Why import-x and not import@2**: `eslint-plugin-import@2` is legacy CJS with no flat-config export. The flat-config-native successor is `eslint-plugin-import-x` (ADR-016 D6).

### 2.3 Direction Rule

The architectural layering direction is enforced by convention and code review (ADR-016 D2). See SI-001 Section 4.1 for the full four-layer import direction diagram. No upward imports are permitted.

---

## 3. Client Component Guard

This rule directly prevents the class of production outage where a `'use client'` component imports a domain barrel that re-exports server-only siblings, pulling `pg`, `prisma`, `server-only`, or `next/server` into the client bundle and causing every route in the affected layout to 500.

### 3.1 The Rule

`'use client'` files MUST NOT import domain barrels. They must deep-import only the specific client-safe module (ADR-016 D3).

| Import | Safe | Reason |
|--------|------|-------|
| `import { readCsrfToken } from '@/lib/auth/csrfClient'` | Yes | Client-safe module; no server deps |
| `import { readCsrfToken } from '@/lib/auth'` | No | Barrel re-exports server-only siblings, causing 500 on every route in the layout |

The established safe pattern used across all `app/admin/(console)/**` and `app/booking/**` client components is the deep import to the specific client-safe file (`@/lib/auth/csrfClient`, `@/lib/booking/holdClient`, etc.).

### 3.2 Greppable CI Guard

The following shell expression must return zero results in CI (ADR-016 D3):

```sh
grep -rln "from ['\"]@/lib/[a-z]*/['\"]" app components \
  | while read f; do head -1 "$f" | grep -q "use client" && echo "$f"; done
```

Any file whose first line is `'use client'` and which contains a barrel import (`from '@/lib/<domain>'`) is a violation.

### 3.3 Codemod Safety Note

Any future reach-in-to-barrel sweep (rewriting deep imports to barrel imports) must skip files whose first line is `'use client'`. The sweep must also not rewrite `vi.mock()`/`vi.importActual()` string arguments -- only `from '...'` and `import('...')` specifiers (Mistake Log 2026-06-03 Issue 092b).

---

## 4. Prettier

Prettier provides deterministic formatting so that code review diffs contain only meaningful changes.

### 4.1 Configuration

- **Print width**: 100 characters
- **Tab width**: 2 spaces (no tabs)
- **Semicolons**: enabled
- **Single quotes**: disabled (double quotes)
- **Trailing commas**: `'all'` (ES5+ compatible)
- **Arrow function parens**: `'always'`

### 4.2 Ignored Paths

The `.prettierignore` file excludes:
- `node_modules/`
- `.next/`
- Generated files (`prisma/generated/`)
- Migration SQL files (`prisma/migrations/**/*.sql`) -- hand-authored SQL is preserved as written

### 4.3 Integration with ESLint

`eslint-config-prettier` disables ESLint formatting rules that would conflict with Prettier. ESLint handles logic and import rules; Prettier handles whitespace and syntax style. Running both in the pre-commit hook applies formatting first, then linting, so lint errors are not masked by formatting violations.

---

## 5. Pre-Commit Hooks

Pre-commit hooks run before every `git commit`. They provide fast feedback and prevent bad commits from entering version history.

### 5.1 Hook Steps (in order)

1. **Prettier format** -- formats staged files in place
2. **ESLint lint** -- runs on staged files; fails on any error (warnings do not block)
3. **TypeScript type check** (`tsc --noEmit`) -- full project type check
4. **Gitleaks secret scan** -- detects accidentally staged secrets and PII

### 5.2 Gitleaks -- PII and Secret Detection

Gitleaks is configured in `.gitleaks.toml` with rules specific to the Vietnamese platform context (ADR-008 D1 Layer 5).

**Phone number detection**: The regex `\+84[35789]\d{8}` matches Vietnamese mobile numbers with real prefixes. Seed and test fixtures must use PII-safe placeholder values. The safe pattern is `+8490xxxxxx[N]` -- the literal `x` characters prevent `\d{8}` from consuming them.

**Secret detection**: JWT secrets, HMAC keys, PSP credentials, and database URLs are all detected by Gitleaks rules.

**Sandbox sentinel detection**: `env.ts` `superRefine` rejects deployment when `PAYMENTS_STUB=false` and sandbox credential values are present (e.g., `VNPAY_TMN_CODE === 'VNPAYTEST'`) -- prevents accidental production launch with test keys (ADR-008 D7).

---

## 6. Input Validation Convention

Input validation is a two-layer system. No user input reaches business logic without passing both layers (ADR-008 D5).

### 6.1 Layer 1 -- Zod at API Boundary

Every route handler (`app/api/**/route.ts`) calls `schema.parse()` on the raw request body BEFORE calling any service function. Parse failure returns HTTP 400 with Zod error details. Invalid data never reaches the service layer.

Zod operates in `.strip()` mode by default, which removes unrecognized keys from parsed input. This prevents mass-assignment attacks where an attacker injects `operatorId`, `price`, or `status` fields into the request body.

No raw user input reaches SQL. Prisma parameterizes all queries. `$queryRaw` calls use `Prisma.sql` tagged templates with parameter binding -- never string interpolation (ADR-008 D5).

### 6.2 Layer 2 -- Domain Invariants in Service Layer

Business rules that depend on consistent database state are enforced inside `$transaction` callbacks in the service layer (`lib/<domain>/`), not in route handlers. Examples:

- **Invariant I1** (no double-sell): `SELECT ... FOR UPDATE` on the Bus row inside the transaction, followed by a booking count check
- **Invariant I7** (no client-originated price): price on customer-facing booking endpoints is always derived server-side from the Trip record. Operator-side endpoints under `/api/op/**` are I7-exempt (the operator IS the price authority); each exemption is documented inline with `// I7-exempt:` comments.
- **Capacity and maintenance overlap**: checked inside the same transaction as the write (TOCTOU race prevention)

**Thin route handlers** (ADR-015 D4): Route handlers have exactly five responsibilities: parse + validate (Zod), extract auth context, call service, map result to HTTP, map errors to HTTP error response. Business logic lives only in the service layer.

### 6.3 Validation Error Shape

Zod validation failures return HTTP 400 with the standard error envelope (ADR-015 D1):

```json
{
  "error": {
    "code": "validation_error",
    "message": "Request body failed schema validation",
    "details": [
      { "field": "departureAt", "message": "Invalid date string" }
    ]
  }
}
```

---

## 7. API Response Standards

Consistent API responses reduce the surface area of client-side error handling across the three portals and webhook endpoints (ADR-015).

### 7.1 Standard Error Envelope

All error responses use the nested envelope shape (ADR-015 D1):

```json
{
  "error": {
    "code": "plate_in_use",
    "message": "A bus with this license plate already exists"
  }
}
```

- `code` -- machine-readable snake_case string; stable across API versions; clients switch on this field
- `message` -- human-readable English string; may change without notice; for logs and debugging only
- `details` -- optional array of `{ field, message }` objects for validation errors (HTTP 400 only)

**Implementation gap**: Most routes currently return `{ "error": "code_string" }` (flat string) rather than the nested envelope. The nested envelope is the documented target; standardization is deferred to a client refactor (ADR-015 D1 status: `IMPLEMENTED_DIFFERENTLY`).

### 7.2 HTTP Status Code Semantics

The following mapping resolves the recurring 409-vs-422 ambiguity across all route handlers (ADR-015 D2):

| Status | Meaning | Example in BenXe |
|--------|---------|----------------|
| 400 | Malformed input -- fails Zod schema | Missing `departureAt`, invalid date format |
| 401 | Not authenticated | No session cookie; expired JWT |
| 403 | Not authorized | Operator accessing another operator's trip |
| 409 | Resource conflict -- retry may resolve | Maintenance window overlap; bus assigned to overlapping trip |
| 422 | Business validation failure -- inherent to request data | Duplicate license plate; capacity reduction blocked by existing bookings |
| 429 | Rate limited | Exceeds OTP request rate; response includes `Retry-After` header |

**Key distinction**: 409 = error goes away if the conflicting resource state changes (timing/concurrency). 422 = error is inherent to the request data regardless of timing.

### 7.3 Idempotent Operation Pattern

Idempotent operations (cancel trip, complete booking, mark departed) use a discriminated result from the service layer -- not a thrown error -- so the route handler returns HTTP 200 with the entity DTO in all cases (ADR-015 D3). See SI-001 Section 6.6 for the pattern details.

### 7.4 Spec Conflict Declaration

When two acceptance criteria specify divergent HTTP status codes for the same error code, each divergent site carries an inline `// SPEC CONFLICT:` comment naming the other site and the conflicting code. This prevents silent "fixes" that resolve the inconsistency in the wrong direction.

---

## 8. Test-Related Lint and Quality Rules

The following rules derive from ADR-018 and address specific test failure classes. For detailed testing strategy and concurrency testing, see SI-005.

### 8.1 Mock Method Names Must Match Reality (ADR-018 D3)

When a Prisma query method changes (e.g., `findUnique` to `findFirst`), every hand-rolled mock that stubs the old method name must be updated in the same commit. See SI-005 Section 3.1 for the full rationale.

### 8.2 Every Declared Error Code Must Have a Throwing Path (ADR-018 D4)

When an error-code variant is added to a service's error union, the service file must contain an actual `throw` of that code, and a test must exercise the negative path. A future lint rule (`no-unused-error-codes`) could automate detection, but none is currently wired.

### 8.3 Crypto Hex Strings Must Be Valid (ADR-018 D6)

Any test passing a string literal to `Buffer.from(s, 'hex')` must use a hex-valid string of the correct byte width. See SI-005 Section 3.2 for the detailed explanation and helper pattern.

### 8.4 Timezone-Aware Date Derivation (ADR-018 D5)

Tests that seed a timestamp and query it through a Vietnam-local-date filter must derive the date string in the same timezone. See SI-005 Section 3.3 for correct approaches.

### 8.5 Currency Math Must Use BigInt

Any multiplication of an integer VND minor-unit value by a fractional rate must be done in the BigInt domain. Greppable smell: `Math.round(<int> * <fractional>)` or `Math.floor(<minor-unit-int> * <rate>)` in any money-handling module. For ES2017 target, use `BigInt(n)` constructor calls -- the `1n` literal suffix is a parser error. See SI-005 Section 8 for detailed testing guidance.

---

## Cross-References

- **ADR-008** -- Security Posture: Layer 5 (CI Pipeline) places `pnpm lint`, Gitleaks, `tsc --noEmit`, and test suites as security gates; Zod input validation (D5); secret management (D7); tenant isolation lint enforcement (D8)
- **ADR-015** -- Error Contract: Standard error envelope (D1); HTTP status code semantics (D2); discriminated result for idempotent operations (D3); thin route handler pattern (D4)
- **ADR-016** -- Module Boundaries: Barrel-as-public-API (D1); layered direction rule (D2); client component deep-import rule (D3); cross-domain-through-barrel (D4); exempt modules (D5); lint enforcement tools and severities (D6)
- **ADR-018** -- Testing Strategy: Mock method name hygiene (D3); error code coverage (D4); timezone-aware date derivation (D5); crypto hex string validity (D6)
- **SI-001** -- Project Scaffold: four-layer import direction, module architecture overview
- **SI-003** -- CI/CD Pipeline: pipeline stage sequence, lint as CI gate
- **SI-005** -- Testing Strategy: detailed mock hygiene rules, concurrency testing, financial math testing

---

## Known Gaps

- The `boundaries/entry-point` rule is deprecated in `eslint-plugin-boundaries` v6; migration to `boundaries/dependencies` is deferred. The deprecated rule functions correctly but should be migrated before a major plugin upgrade (ADR-016 D6).
- The standard nested error envelope (`{ "error": { "code": "...", "message": "..." } }`) is not yet implemented across all routes -- most routes currently return a flat string or top-level `error`/`message` shape (ADR-015 D1).
- No automated lint rule enforces the "every declared error code must have a throwing path" requirement (ADR-018 D4). Enforced by code review convention only.
- The Gitleaks CI step and `pnpm audit --audit-level=high` CI gate are documented but not yet added to the CI workflow (ADR-008 D6).
- HTTP security headers (HSTS, CSP, etc.) are documented in ADR-008 D4 but not yet configured in `next.config.ts` (ADR-008 D4).
- The greppable CI guard for client component barrel imports (Section 3.2) is described as a shell expression but not yet wired as an automated CI check step.
