CONSISTENCY AUDIT
─────────────────
Date: 2026-06-05
Scope: app, components, lib, prisma
Branch: feat/rebuild-complete (base master) — most files [modified-in-branch] (whole rebuild)

| Severity | Count | Areas affected |
|---|---|---|
| P1 | 0 | — |
| P2 | 1 | lib/api ↔ lib/catalog |
| P3 | 2 | lib/auth ↔ lib/op, lib/auth |

Gate: CLEAN of P1 — 0 canonical-source / security-boundary violations.

─── P2 findings ───

**P2 — `MaintenanceWindow` declared independently in two modules (client/server contract drift)**

| Field | Value |
|---|---|
| Locations | A: `lib/api/busesClient.ts:20` — `export interface MaintenanceWindow {…}`  B: `lib/catalog/getOperatorBus.ts:11` — `export interface MaintenanceWindow {…}` |
| Violation | Same shape declared twice — one on the client-facing API module, one on the server data-access module. No shared source. |
| Why it matters | These two form a client↔server contract. If a field is added to one (e.g. a reason/label) the other silently diverges; tsc won't catch it because they're structurally independent declarations. |
| Branch status | [modified-in-branch] |
| Fix | Declare once in the owning domain barrel (`lib/catalog`), `export` it, and have `lib/api/busesClient.ts` import the type. Re-export through `lib/catalog/index.ts`. |

─── P3 findings ───

**P3 — `OperatorProfile` name collision across two distinct concepts**
- `lib/auth/types.ts:67` — `type OperatorProfile = z.infer<OperatorProfileSchema>` (registration/auth profile input).
- `lib/op/getOperatorProfile.ts:15` — `interface OperatorProfile {…}` (operator-console profile DTO).
  Different domain objects sharing one name. Not drift (they're genuinely different), but a reader
  grepping `OperatorProfile` gets two unrelated shapes. Branch status: [modified-in-branch].
  Fix: rename one — e.g. `OperatorRegistrationInput` (auth) vs `OperatorProfileDto` (op console).

**P3 — `AdminRole` re-derived alias in 3 files**
- `lib/auth/adminAuthService.ts:19`, `lib/auth/adminSession.ts:21`, `lib/auth/requireAdminAuth.ts:23`
  each declare `type AdminRole = AdminAccessPayload['role']`. Consistent (single source: the JWT
  payload type) so no drift risk, but the alias is copy-pasted. Branch status: [modified-in-branch].
  Fix (optional): export `AdminRole` once from `lib/auth/adminJwt` (or wherever AdminAccessPayload
  lives) and import it. Low value — they can't diverge while the RHS is identical.

─── Observations (not findings) ───
- **No central `lib/types/index.ts`.** Pass 1.1 (type-redeclaration-vs-canonical) was skipped — the
  project deliberately uses PER-DOMAIN barrels (`lib/<domain>/index.ts`, 32 of them) + Prisma-
  generated types as the type homes, not a single shared `lib/types`. This is an intentional
  architecture (issue 091/092), not a violation. Per-domain DTOs (`TripDto`, etc.) are correct here.
- Helper naming is uniform: `get*`/`create*`/`update*` camelCase, suffix-qualified throughout
  `lib/**`. No gen-vs-generate / mk-vs-make divergence found.
- No payment crypto outside its webhook route (lives in `lib/payment/adapters/{momo,stub}.ts`).
- No `'use client'` component issuing `prisma.*` calls.
- The 31× `RouteContext`, 29× `Props`, 12× `PageProps` "duplicates" are idiomatic per-route /
  per-component local aliases (App Router params + React props) — NOT drift, correctly excluded.

SUMMARY: 0 P1 · 1 P2 · 2 P3
Gate: PASS (no blocker). Consistency is a strong dimension — barrel enforcement + uniform naming hold.
