# ADR-016: Module Boundaries & Import Architecture

## Status
ACCEPTED

## Date
2026-06-17

## Context

The platform is a modular monolith — a single Next.js deployment with internal domain boundaries enforced by import rules. Without explicit module boundary enforcement, cross-domain imports create hidden coupling, circular dependencies, and — critically — server-only code leaking into client bundles (causing production outages when `'use client'` components import domain barrels that re-export server-only modules).

**Sources**: `design/03-architecture/` §3.1-3.2, `business/domain-model/bounded-contexts.md`, `design/31-domain-model/` §Context Map

---

## Decisions

### D1: Barrel File as Public API

Each domain module (`lib/<domain>/`) exposes a barrel file (`index.ts`) as its public API. Other domains import only through this barrel — never reach into internal files.

```
lib/booking/index.ts          ← public API (barrel)
lib/booking/initiateOnlineBooking.ts  ← internal (not imported cross-domain)
lib/booking/transitions.ts    ← internal
lib/booking/__tests__/        ← internal
```

**Rationale**: Barrel files make the public API explicit. When a module's internal file changes (renamed, refactored, split), no cross-domain consumer breaks — they only import through the stable barrel. This is the prerequisite for future service extraction (ADR-001 §Stage 1-2 evolution).

---

### D2: Layered Direction Rule

```
Experience Layer (app/)
       ↓ imports
Domain Layer (lib/<domain>/)
       ↓ imports
Core Layer (lib/core/, lib/utils/)
       ↓ imports
Infrastructure (PostgreSQL, Redis, S3, PSP adapters)
```

Each layer imports only downward. Never upward, never sideways-skip.

- `app/` calls `lib/<domain>/` — never `lib/core/` directly (except shared UI utilities)
- Domains call `lib/core/` — never other domains' internal files
- `lib/core/` calls infrastructure — never domain modules

**Rationale**: Direction enforcement prevents circular dependencies and ensures domains remain independently extractable. If `lib/booking/` imports `lib/payment/`, that's a legitimate downstream dependency. If `lib/payment/` also imports `lib/booking/`, that's a cycle that couples both domains.

---

### D3: Client Components Must Deep-Import Client-Safe Modules

`'use client'` components MUST NOT import from domain barrels (`@/lib/auth`, `@/lib/booking`). They must deep-import the specific client-safe module (`@/lib/auth/csrfClient`).

| Import | Safe? | Why |
|--------|-------|-----|
| `import { readCsrfToken } from '@/lib/auth/csrfClient'` | **Yes** | Client-safe module, no server deps |
| `import { readCsrfToken } from '@/lib/auth'` | **No** | Barrel re-exports server-only siblings → pulls `pg`, `server-only`, `next/server` into client bundle → 500 on every route |

**Rationale**: Domain barrels re-export everything in the domain, including server-only modules that import `pg`, `prisma`, `server-only`, etc. Webpack/Turbopack cannot tree-shake barrel re-exports when the consumer is a client component — the entire transitive module graph is bundled. This caused a production outage where the entire operator portal returned 500 because `OperatorNav.tsx` (`'use client'`) imported from the `@/lib/auth` barrel.

**Greppable CI guard**: Any file whose first line is `'use client'` must not contain `from '@/lib/<domain>'` (barrel) imports — only deep imports to client-safe modules.

---

### D4: Cross-Domain Through Barrels, Intra-Domain Deep Allowed

| Import pattern | Allowed? |
|----------------|----------|
| `lib/booking/` imports from `lib/payment/` (barrel) | Yes — cross-domain through barrel |
| `lib/booking/` imports from `lib/payment/processWebhook` (deep) | **No** — cross-domain must use barrel |
| `lib/booking/transitions.ts` imports from `lib/booking/bookingRepo.ts` (deep) | Yes — intra-domain deep import |
| `app/api/holds/route.ts` imports from `lib/booking/` (barrel) | Yes — experience layer → domain barrel |

**Rationale**: Cross-domain barrel enforcement means internal refactors don't break consumers. Intra-domain deep imports are fine — the barrel author controls both sides.

---

### D5: Exempt Modules

- `lib/core/` — shared primitives, imported by all domains. No barrel enforcement (too low-level).
- `lib/utils/` — pure utility functions. Same exemption.
- Test files (`__tests__/`, `*.test.ts`) — may deep-import for unit testing internals.
- Dev-only files (`app/dev/**`) — boundary-exempt for development tooling.

---

### D6: Lint Enforcement

| Tool | Rule | Scope |
|------|------|-------|
| `eslint-plugin-boundaries` | `entry-point` — cross-domain imports must go through barrel | All `lib/<domain>/` except `lib/core/`, `lib/utils/` |
| `eslint-plugin-import-x` | `import/no-cycle` — no circular dependency chains | All source files |

Both rules run as errors (not warnings) in `pnpm lint` and are gated by CI + pre-commit hook.

Note: `eslint-plugin-import@2` (legacy CJS) has no flat-config export — use `eslint-plugin-import-x` instead. `boundaries/entry-point` is deprecated in v6 but functions correctly; migrate to `boundaries/dependencies` later.

---

## Consequences

### Positive

- **No server-in-client crashes** — D3 prevents the barrel import production outage class
- **Independent domain evolution** — internal refactors don't break cross-domain consumers
- **Future service extraction** — every domain already has a defined API surface (the barrel)
- **Cycle-free** — `import/no-cycle` prevents the mutual-import coupling that makes domains inseparable
- **CI-enforced** — violations caught at lint time, not production time

### Negative

- **Barrel maintenance overhead** — every new public function must be added to the barrel
- **Deep import discipline for client components** — developers must know which modules are client-safe
- **Two lint plugins** — `eslint-plugin-boundaries` + `eslint-plugin-import-x` add configuration complexity
- **Test/dev-only internals** — some symbols (`_resetEnvCache`, `STUB_BLOBS`) must remain deep-importable for tests, creating exceptions to the barrel rule
