---
name: consistency-audit
description: Three-pass auditor for naming, structural, and placement consistency across the project's single-app workspace. Surfaces type redeclarations, divergent helper names, mixed flat/subdir layouts, payment crypto outside webhooks, and near-duplicate utilities. Advisory only — never modifies source. Use when the user asks for a consistency check, a structure audit, or "is the code organized sensibly".
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /consistency-audit — Naming, Structure & Placement Auditor

## Why you'd care

Inconsistency compounds: two helpers with different names doing the same job means every future bug fix only lands in half the codebase, and type drift across modules turns a simple refactor into a multi-day untangle. Catching it before merge is the difference between a codebase that ages well and one a new hire can't make sense of in six months.

Invoke as `/consistency-audit`. Runs three sequential passes across the workspace to surface naming violations, structural inconsistencies, and misplaced code. Advisory only — never modifies source files.

**Stack assumption:** the rules below are written for a Next.js + Prisma layout (`app/`, `components/`, `lib/`, `prisma/`). For other stacks, run `/stack-profile` first and re-map the globs (e.g. `src/` for Vite, `pages/` for old Next.js, `apps/<name>/` for monorepos, `<package>/<module>/` for Python).

---

## Scope

Single Next.js workspace. Auditable globs:
- `app/**/*.{ts,tsx}` — excludes `*.test.*`, `*.spec.*`, `*.config.*`
- `components/**/*.tsx` — same exclusions
- `lib/**/*.ts` — excludes `*.test.ts`, `*.config.ts`
- `prisma/**/*.ts` — excludes `migrations/`

Also excluded: `node_modules/`, `dist/`, `build/`, `.next/`, `*.d.ts`, `public/`, `.claude/`, `docs/`

---

## Conventions

| Domain | Convention | Source of truth |
|---|---|---|
| Shared types/enums | Single declaration in `lib/types/` or `prisma/` (Prisma-generated), imported elsewhere | `lib/types/index.ts` |
| Type/interface names | PascalCase, declared once if used in 2+ modules | `lib/types/` |
| Server-side helper functions | camelCase, suffix-qualified (`generateOrderReference`, not `genOrderRef`) | majority pattern in `lib/` |
| Route handlers | `app/api/<group>/route.ts` (Next.js convention) | App Router contract |
| Route subgroup files | `app/api/<group>/<subgroup>/route.ts` | App Router convention |
| Page components | `app/<route>/page.tsx` (App Router) — never PascalCase filename | App Router convention |
| Client components | PascalCase filenames in `components/` (`OrderCard.tsx`, `MenuItemRow.tsx`) | observed pattern |
| Hook filenames | camelCase, prefixed `use` (`useCart.ts`, `useReservation.ts`) | `lib/hooks/` |
| Script filenames | kebab-case (`seed-menu.ts`, `apply-pending-migrations.ts`) | `prisma/scripts/` or `scripts/` |
| Payment signature/HMAC | Lives only in the webhook handler dir for your stack (`app/api/webhooks/` for Next.js App Router) | architectural rule |
| Cross-module duplicate utility | Extract to `lib/` once two identical copies exist | architectural rule |

---

## Pre-flight

1. Anchor working directory to the repo root (`git rev-parse --show-toplevel`) regardless of where the skill was invoked.
2. If a git repository exists, run `git diff --name-only main...HEAD` — cache the modified-file list. Tag each finding `[modified-in-branch]` or `[pre-existing]`. If git is absent or fails, tag everything `[pre-existing]` and emit a one-line note.
3. Read `lib/types/index.ts` (if present) — collect all re-exported names as the **SharedTypes** list (used by Pass 1 step 1). If empty/unreadable, skip Pass 1 step 1 and emit a one-line note.

---

## Pass 1 — Naming Consistency

### 1.1 Type/interface redeclaration vs canonical

Grep `(export\s+)?(type|interface)\s+(\w+)` across `app/**/*.{ts,tsx}`, `components/**/*.tsx`, `lib/**/*.ts`. Cross-reference each captured name against **SharedTypes** (and Prisma-generated types from `@prisma/client`). If a name from SharedTypes also appears declared (not just imported) in a module file: **P1**.

### 1.2 Helper-function name divergence

Grep `^export (function|const) (\w+)` and `^function (\w+)` (top-level) across all auditable files. Bucket by canonical English root (e.g., `orderReference`). If the same root appears under different prefixes (`generate` vs `gen`, `make` vs `create`) in 2+ files: **P2**.

### 1.3 Filename casing within a directory

For each leaf directory, tally PascalCase / camelCase / kebab-case basenames. Flag the minority only when conforming count ≥ 3 **and** non-conforming count = 1 (75% confidence floor): **P3**. Suppress if directory has < 3 files total.

Note: `app/` subroutes use lowercase (`page.tsx`, `route.ts`, `layout.tsx`) and dynamic segments use `[bracket]` — those are App Router conventions, not casing violations.

---

## Pass 2 — Structural Consistency

### 2.1 Mixed flat-file/subdirectory under `app/api/<group>/`

For each `app/api/<group>/`, check whether children are subdirectories (containing their own `route.ts`) or flat (group has only its own `route.ts` plus nested route files). Flag if the same group mixes both **and** any of those files appears in `[modified-in-branch]`: **P2**. Pre-existing mixed groups with no branch activity: **P3**.

### 2.2 Missing barrel export from `lib/types`

If a `lib/types/index.ts` exists, glob all `lib/types/**/*.ts` (excluding `index.ts`). For each file, verify its top-level exports appear in `lib/types/index.ts`. Any file with un-exported public symbols: **P2**.

### 2.3 Page logic outside `app/`

Glob `components/**/*.tsx` for files that contain server-only data fetching (`prisma.*` direct calls, server-action imports). Server data access belongs in route handlers, server actions, or page server components — not in client components: **P2**.

---

## Pass 3 — Placement Consistency

### 3.1 Payment crypto outside webhooks

Grep `crypto\.createHmac|stripe\.webhooks\.constructEvent|webhook[._]?secret` across `app/api/`, excluding `app/api/webhooks/`. Any match: **P1**.

### 3.2 Near-duplicate file across modules

For each filename present in both `lib/` and `components/` (or in two different `lib/` subdirectories), read both files. If line count is within ±10% **and** ≥ 80% of non-empty lines match exactly, and the file is ≥ 20 lines: **P2** (extract to a single canonical location).

### 3.3 Unused export

For each `export (function|const|type|interface) <Name>` outside `lib/types/index.ts`, grep for `import.*<Name>` across the workspace. Zero hits: **P3**. Suppress if: (a) default export of a route file (`route.ts`, `page.tsx`, `layout.tsx`), (b) a React component re-exported elsewhere, (c) named export of a Next.js convention (`metadata`, `generateMetadata`, `generateStaticParams`, `revalidate`, `dynamic`).

### Monorepo sub-package naming rules

Applies only when `/workspace-detect` reports a monorepo (cross-ref `/workspace-detect`). Enforce `@org/<scope>-<purpose>` canonical form (e.g. `@org/ui-button`, `@org/db-prisma`). For each `packages/*/package.json`, verify `name` matches `@org/<scope>-<purpose>` and that the folder basename equals the unscoped package name (`packages/ui-button/` → `@org/ui-button`). Mismatch: **P1**. Any `index.ts` re-export that crosses a package boundary without a corresponding `exports` field entry in the source package's `package.json`: **P2**.

### Shared-constant drift detection

Grep `^(export\s+)?const\s+([A-Z_][A-Z0-9_]+)\s*=\s*(['"][^'"]+['"]|\d+)` across all `packages/*/src/**/*.ts`. Bucket by identifier. If the same identifier appears in 2+ packages with different RHS literals (e.g. `MAX_UPLOAD_MB = 25` in `packages/api/` and `MAX_UPLOAD_MB = 50` in `packages/web/`): **P1**. Same identifier with identical RHS in 2+ packages: **P2** (extract to a shared `@org/config` package). Report with full package paths.

### TS path-alias enforcement

Read `.workspace-map.json` (the canonical alias registry). For every `import ... from '@org/<x>'` across the workspace, verify `<x>` resolves to a package entry. Orphan aliases (no matching entry): **P1**. Build the package-import graph from those imports; any cycle (`A → B → A`): **P1**. Deep imports of the form `@org/<pkg>/src/...` or `@org/<pkg>/<internal>/...` that bypass the package root entry point: **P2** — packages must be consumed via their root export only.

---

## Severity Rubric

| Severity | Definition | Examples |
|---|---|---|
| **P1** | Canonical-source violation, security boundary crossed, or type drift across module boundary | Type redeclared instead of imported from `lib/types`; payment HMAC outside `app/api/webhooks/` |
| **P2** | Same thing implemented twice, or sibling files diverging in a way that will compound | Two helpers with different names doing the same job; near-duplicate file in two modules; missing barrel export |
| **P3** | Single outlier in an otherwise-uniform pattern; cosmetic or low-impact placement | One filename casing in a directory of 3+ uniform files; flat page while siblings use a subdirectory |

**Thresholds (apply across all passes):** flag the minority only when the conforming pattern has ≥ 80% of files in the relevant set and ≥ 3 conforming files exist.

---

## Output Format

```
CONSISTENCY AUDIT
─────────────────
Date: <YYYY-MM-DD>
Scope: app, components, lib, prisma
Branch: main

| Severity | Count | Areas affected |
|---|---|---|
| P1 | 1 | app/api |
| P2 | 1 | lib |
| P3 | 1 | components |

Gate: BLOCKED — 1 P1

─── P1 findings ───

**P1 — Type redeclared across modules**

| Field | Value |
|---|---|
| Locations | `app/api/auth/route.ts`, `app/api/account/route.ts`, `app/api/orders/route.ts` (3 files) |
| Canonical source | `lib/types/auth.ts` |
| Violation | `JwtPayload` is locally redeclared in 3 route files instead of imported from `lib/types`. |
| Why it matters | Adding a claim to one declaration silently diverges the others; type drift makes auth refactors fragile. |
| Branch status | [pre-existing] |
| Fix | Declare `JwtPayload` once in `lib/types/auth.ts`, export via barrel, replace 3 local declarations with `import type { JwtPayload } from '@/lib/types'`. |

─── P2 findings ───

**P2 — Sibling helper named two different ways**

| Field | Value |
|---|---|
| Locations | A: `lib/orders.ts:67` — `generateOrderReference()`  B: `app/api/admin/orders/route.ts:27` — `genOrderRef()` |
| Violation | Two modules implement the same order-reference generator under different names and formats. |
| Why it matters | A bug fix applied to one copy will not reach the other. |
| Branch status | [pre-existing] |
| Fix | Move canonical `generateOrderReference()` to `lib/orderReference.ts`; import from both call sites; delete the admin copy. |

─── P3 findings ───

**P3 — Inconsistent filename casing in components/**
- `components/order-card.tsx` is kebab-case while every other component uses PascalCase. Branch status: [pre-existing]. Fix: rename to `OrderCard.tsx` and update imports.

─── Clean run ───

Gate: CLEAN — no consistency violations found.
```

---

## Auto-chain

- Flagged symbol / inconsistent module has no test coverage → auto-fire `/coverage-map` to confirm, then `/tdd` to add tests before refactoring.

## Integration

- **Output length cap**: if total findings exceed 100, print every P1 in full and replace P2/P3 with severity counts only — never truncate P1.
- Hand P1s to `/lead` if any exist; otherwise no action needed.
- **Skill complete** when (1) all three passes ran and (2) the output report was emitted.
