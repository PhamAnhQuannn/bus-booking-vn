# Module boundaries (SYS20)

The monolith stays navigable by enforcing one dependency direction and a single
cross-domain import surface. Dependency graph (no cycles):

```
app/  →  lib/<domain>  →  lib/core
```

## Rule 3 — the per-module `index.ts` barrel is the only cross-domain surface

Every `lib/<domain>/` exposes a PUBLIC API barrel `index.ts`. Other domains import
 from that barrel ONLY — never reach into a sibling's internals (`@/lib/booking/holdRepo`
is forbidden; `@/lib/booking` is the contract). The barrel IS the future service boundary:
when a hotspot domain lifts to its own deploy, every caller already went through `index.ts`.

```ts
// lib/booking/index.ts  — the public API barrel
export { initiateBooking } from './initiateBooking';
export type { BookingDto } from './types';
```

```ts
// lib/notification/sendBookingEmail.ts  — a cross-domain import
import { initiateBooking } from '@/lib/booking'; // ✅ through the barrel
// import { x } from '@/lib/booking/holdRepo';   // ❌ reaching into internals
```

## Rule 4 — `lib/core` direction (imported by domains, imports no domain)

`lib/core/` holds cross-cutting primitives (`db/ money/ time/ id/ result/ errors/
logger/ config/ jobs/ http/`). Domains import core; core imports NO domain. This keeps
the graph acyclic. `logger`, `config`, and `db` are core primitives even though their
implementation files currently still live at `lib/` root — those re-exports are NOT
domains and are allowed inside core.

## Rule 2 — `lib/<domain>` must not import `app/` or `components/`

Business logic never depends on the routing realm or UI. `app/` calls `lib/<domain>`
in-process (never self-fetch its own API — see AGENTS.md Mistake Log). Exception:
`lib/stores/**` is client-only state and is exempt from this rule.

## Rule 5 — operator-owned queries go through the tenant-scope door

Every operator-owned repo read/write injects the tenant filter via
`withOperatorScope(operatorId, args)` from `@/lib/core/db`, so a repo can't forget the
`operatorId` predicate and leak cross-operator data.

```ts
import { prisma, withOperatorScope } from '@/lib/core/db';

await prisma.bus.findMany(
  withOperatorScope(operatorId, { where: { deactivatedAt: null } }),
);
```

## Enforcement

`eslint.config.mjs` enforces rules 2 & 4 via `no-restricted-imports` at **`warn`**
severity (Wave 8 flips to `error`). Pre-existing violations surface as warnings, not
build breaks.
