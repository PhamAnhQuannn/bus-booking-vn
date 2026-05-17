---
name: commit-split
description: Group all currently-modified files into scoped, dependency-ordered commits with conventional-commit messages. Maps each file to a domain (auto-detected business domains + universal slots: schema, shared-lib, auth, payment, ui, admin, infra, claude-config) and orders commits so each group compiles cleanly. Flags cross-domain files for manual split. Use when the user says "commit", "stage", "group my changes", or whenever 10+ files span 3+ domains.
output_size:
  XS: 5m
  S: 10m
  M: 15m
  L: 20m
  XL: 30m
---

# /commit-split — Commit Grouping Gate

## Why you'd care

A single 40-file commit spanning schema, auth, billing, and UI is impossible to review, impossible to bisect, and impossible to revert cleanly. Grouping by domain and ordering by dependency turns the same change into commits that each compile, each tell a story, and each roll back independently.

Invoke as `/commit-split`. Groups all modified files into scoped, dependency-ordered commits.

---

## Pre-flight

Before producing the commit plan:
1. Run `git status` — identify all modified, added, deleted files
2. Run `git diff --stat` — confirm which files have actual changes
3. If git is unavailable, stop and tell the user — this skill needs git
4. **Detect business domains.** List the immediate subdirs under whichever of these exists in the repo: `app/api/`, `app/(routes)/`, `src/modules/`, `src/routes/`, `services/`, `internal/`. Each top-level subdir name becomes a candidate domain. If none of those layouts exist, run `/stack-profile` first.

---

## Domain Taxonomy

Domains come from two sources: **universal slots** (cross-vertical, hardcoded below) and **detected business domains** (from Pre-flight step 4).

### Universal slots

Map each file to exactly one universal domain when its path matches:

| Domain          | Path patterns (Next.js + Prisma worked example — adapt for your stack)                                          |
|-----------------|-----------------------------------------------------------------------------------------------------------------|
| `schema`        | `prisma/schema.prisma`, `prisma/migrations/**` — or `alembic/versions/**`, `db/migrate/**`, `drizzle/**`        |
| `shared-lib`    | `lib/types/**`, `lib/utils.ts`, `lib/constants.ts`, `lib/db.ts` — or `src/lib/**`, `<pkg>/common/**`            |
| `auth`          | `app/api/auth/**`, `app/(auth)/**`, `lib/auth.ts`, `middleware.ts` — or `auth/**`, `<pkg>/auth/**`              |
| `payment`       | `app/api/webhooks/**`, `app/api/payment/**`, `lib/stripe.ts`, `lib/payment.ts` — or `<pkg>/payments/**`, `<pkg>/webhooks/**` |
| `ui`            | `components/ui/**`, `components/<other generic>/**`, `app/globals.css`, `tailwind.config.*`, `app/layout.tsx` — or `src/components/**`, `templates/**` |
| `admin`         | `app/admin/**`, `app/api/admin/**`, `components/admin/**` — or `<pkg>/admin/**`, `internal/admin/**`            |
| `infra`         | `next.config.*`, `tsconfig.json`, `package.json`, `pnpm-lock.yaml`, `vitest.config.*`, `playwright.config.*`, `.env*`, `Dockerfile`, `docker-compose*`, `vercel.json` — or `pyproject.toml`, `requirements*.txt`, `go.mod`, `Gemfile`, `.github/**` |
| `claude-config` | `.claude/**`, `CLAUDE.md`                                                                                       |

### Detected business domains

For each domain name returned by Pre-flight step 4, map files under its top-level dir (and matching component/route subtrees) to that domain. Examples:

- Restaurant: `menu`, `orders`, `reservations`
- Fintech: `accounts`, `transfers`, `cards`, `kyc`
- Marketplace: `listings`, `messaging`, `payouts`
- SaaS-tool: `workspaces`, `members`, `billing`
- Content: `posts`, `comments`, `feeds`

The list is project-specific. Do not hardcode business domain names — re-detect every invocation.

If a file spans two domains (e.g., a generic util used by both `auth` and a detected domain), flag it as `[SPLIT NEEDED]` and ask the user to resolve before committing.

---

## Dependency Graph

Commits must be ordered so that each group compiles cleanly:

```
schema → shared-lib → auth → <detected business domains, in PRD order or alphabetical> → payment → ui → admin → infra
```

- `schema` first: migrations must exist before app code references new columns; codegen (`prisma generate`, `alembic upgrade`, `drizzle-kit migrate`) must run before any consumer compiles
- `shared-lib` second: consumers (routes, components, server actions) must not see type errors
- `payment` after the domains that emit payment calls — webhook handlers and signature code stay grouped
- `infra` last: config changes may reference any of the above
- `claude-config` can go any time (not code — no compile dependency)

---

## Logic

1. Classify every modified file into a domain (universal slot or detected business domain)
2. Flag cross-domain files as `[SPLIT NEEDED]`
3. Sort domains by the dependency graph above
4. For each group: draft a conventional commit message (`feat/fix/chore/refactor(scope): description`)
5. For groups containing schema changes: append `RUN AFTER COMMIT: <stack's migrate + generate>, then /verify` — e.g. `pnpm prisma migrate dev && pnpm prisma generate`, `alembic upgrade head`, `rails db:migrate`
6. For groups containing payment changes: append `GATES TO RUN: payment-webhook review (signature verification, idempotency), /verify`
7. For groups containing auth changes: append `GATES TO RUN: /verify, /smoke-test (auth golden path)`

### Monorepo group-by-package

When `.workspace-map.json` exists at repo root (or `/workspace-detect` was invoked this session), prefer grouping commits by **package boundary** before applying the domain graph: one commit per package, with inner-domain grouping inside each package.

- Read `.workspace-map.json` for the canonical package list + dependency edges
- Outer key: package (e.g. `@org/auth`, `apps/web`, `packages/ui`)
- Inner key: domain (universal slot or detected business domain) within that package
- Order packages by topological sort of the inter-package dep graph: **if pkg A depends on pkg B, commit B first**
- Within a package, apply the standard dependency graph (`schema → shared-lib → auth → ...`)
- Cross-package files (rare — usually generated) flag as `[SPLIT NEEDED]`

### Code-graph domain auto-detect

For repos without an explicit module layout, infer domains from imports:

1. Lex every modified file's import statements (`import ... from '<spec>'`, `require('<spec>')`, `from <spec> import ...`)
2. Extract the path prefix of each spec — e.g. `@org/auth/session` → `auth`, `src/billing/stripe` → `billing`, `internal/kyc/...` → `kyc`
3. Cluster files sharing import roots — files importing predominantly from `@org/auth/*` belong to `auth` domain
4. Tie-break by the file's own path prefix when import roots split evenly
5. Cross-ref the resulting cluster names against `/workspace-detect` output (`.workspace-map.json` `packages[].name`) — canonical package names win over inferred names when they overlap

Files with zero domain-bearing imports (pure infra, config) fall back to the universal-slot table.

### Rollback-safety annotation per group

Every commit group emits a rollback rating, surfaced in the output diff table:

- `SAFE` — pure UI, isolated component, no schema/auth/payment touch, single domain, no downstream consumers in this changeset
- `CARE` — schema-touch (must pair with migration rollback), or single-domain logic with 1–2 internal consumers, or auth-touch isolated to one route
- `RISKY` — multi-domain coupling, payment + schema in same chain, cross-package edits, or any group with `[SPLIT NEEDED]` siblings; requires manual sequence review before landing

Rating computed from: (a) domain set in group, (b) presence of schema/payment/auth, (c) downstream consumer count from the code graph, (d) `[SPLIT NEEDED]` proximity.

### Auto-chain on approval

Plan is presented, user approves. **On approve → auto-stage group → auto-`/verify` → next group; final group → auto-`/smoke-test`.** Not "suggest" — fire.

- Wait for explicit user `approve` / `yes` / `go`
- For each group in order: `git add <files>` → `git commit -m "<message>"` → invoke `/verify`
- If `/verify` fails mid-chain: halt, surface the failing group, do not proceed to the next group
- After the final group lands cleanly: invoke `/smoke-test` automatically
- `RISKY`-rated groups pause for re-confirmation before staging even within an approved chain

---

## Output Format

```
COMMIT PLAN
───────────
Total files: N across M domains
Detected business domains: <domain-A>, <domain-B>, ...

Group 1 [schema] — N files — rollback: CARE
  Files:
    <schema file>
    <migration file>
  Suggested message: "feat(db): <description>"
  Depends on: none
  Risk: migration must run before Group 2
  RUN AFTER COMMIT: <stack migrate + generate>, then /verify

Group 2 [shared-lib] — N files — rollback: SAFE
  Files:
    lib/types/<entity>.ts
  Suggested message: "feat(types): <description>"
  Depends on: Group 1

Group 3 [<detected-domain>] — N files — rollback: SAFE | CARE | RISKY
  Files:
    <api route file>
    <page or component file>
  Suggested message: "feat(<detected-domain>): <description>"
  Depends on: Group 2

...

[SPLIT NEEDED]
  lib/<file>.ts — touches both <domain-A> and <domain-B> logic
  Resolve: decide if this belongs in <domain-A>, <domain-B>, or shared-lib, then split manually.

RECOMMENDED NEXT STEP: git add <group-1-files> && git commit -m "..."
APPROVE TO AUTO-CHAIN: reply `approve` → auto-stage → auto-/verify per group → auto-/smoke-test after final group
```

---

## Completion Criteria

- Every modified file is assigned to exactly one group
- Groups are ordered by the dependency graph (and by package topology when `.workspace-map.json` present)
- Each group has a conventional commit message
- Each group carries a rollback-safety rating (`SAFE` / `CARE` / `RISKY`)
- Cross-domain files are flagged
- Gate / post-commit requirements are noted per group
- On user approval, auto-chain fires `/verify` per group and `/smoke-test` after the final group
