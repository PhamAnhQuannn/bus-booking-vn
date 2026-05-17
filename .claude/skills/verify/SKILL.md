---
name: verify
description: Targeted post-fix verification. Reads `git diff --name-only`, classifies changed files, then runs only the checks that match — typecheck, focused test run, lint, schema validate — and stops at the first failure. Faster than full QA. Use after a small fix, after `/tdd` completes, or before staging a commit.
---

# /verify — Post-fix Minimum Verification

Invoke as `/verify`. After a quick fix or `/tdd` completion, runs the minimum required verification based on what changed. Faster than full QA — targeted to the touched scope.

---

## Why you'd care

Running the full QA suite after every small fix is how an hour's work becomes an afternoon. Targeted verification scoped to what changed is the difference between a fast iteration loop and a slow one.

## Pre-flight

1. Run `git diff --name-only` (and `git diff --name-only --cached` for staged) — identify changed files
2. If git is unavailable, fall back to running the full check matrix
3. Classify changed files by domain to determine which checks to run

---

## Verification Matrix

Stack worked here: Next.js + Prisma + pnpm + vitest. Adapt commands for your stack (`uv run pytest`, `go test ./...`, `bundle exec rspec`, `mypy`, `ruff`, `alembic check`, etc.) — run `/stack-profile` if uncertain.

| Changed domain                                        | Checks to run                                                  |
|-------------------------------------------------------|----------------------------------------------------------------|
| `prisma/schema.prisma`                                | `pnpm prisma validate`, `pnpm prisma format`, `pnpm tsc --noEmit` |
| `prisma/migrations/**`                                | `pnpm prisma migrate status`, `pnpm tsc --noEmit`              |
| `app/api/webhooks/**`                                 | Manual payment-webhook review (signature verification, idempotency), `pnpm tsc --noEmit` |
| `app/api/**/route.ts` (any)                           | `pnpm tsc --noEmit`, `pnpm vitest run` for that route's tests  |
| Server actions (`'use server'` files)                 | `pnpm tsc --noEmit`, run nearest `*.test.ts`                   |
| `app/**/page.tsx`, `app/**/layout.tsx`                | `pnpm tsc --noEmit`, `pnpm next lint`                          |
| `components/**/*.tsx`                                 | `pnpm tsc --noEmit`, `pnpm next lint`                          |
| `lib/**/*.ts`                                         | `pnpm tsc --noEmit`, run any `*.test.ts` that imports the file |
| Any TypeScript file                                   | `pnpm tsc --noEmit`                                            |
| Any file in branch                                    | `pnpm vitest run --changed` (always)                           |

---

## Execution

Run the relevant checks sequentially. Stop at the first failure and report it.

```bash
# Next.js + Prisma + pnpm example — substitute your stack's equivalents
pnpm tsc --noEmit          # typecheck:  mypy / tsc / cargo check / go vet
pnpm vitest run --changed  # tests:      pytest / go test / cargo test / rspec
pnpm next lint             # lint:       ruff / eslint / golangci-lint / rubocop
pnpm prisma validate       # schema:     alembic check / drizzle-kit check
pnpm prisma format
```

For running existing tests targeted to a path:
```bash
pnpm vitest run <test-file-path>   # or: pytest <path>, go test <pkg>, rspec <file>
```

---

## Output Format

```
VERIFY
──────
Changed files:
  app/api/orders/route.ts
  app/api/orders/__tests__/route.test.ts

Checks triggered:
  → pnpm tsc --noEmit (TypeScript affected)
  → pnpm vitest run app/api/orders/__tests__/route.test.ts
  → pnpm next lint (route handler in app/)

Results:
  pnpm tsc --noEmit:                                PASS ✓
  pnpm vitest run app/api/orders/__tests__/...:     PASS ✓ (3 tests, 0 failed)
  pnpm next lint:                                   PASS ✓

VERDICT: PASS — all runnable checks met

--- OR ---

VERDICT: FAIL
  pnpm tsc --noEmit: FAIL
    app/api/orders/route.ts:89
      Argument of type 'string' is not assignable to parameter of type 'OrderStatus'
  Fix type error before proceeding.
```

---

## Auto-chain

- After all verify steps pass (type-check + lint + unit tests + build) → **auto-fire `/smoke-test`** on the affected routes/endpoints before declaring done. Skip only if the change is docs-only or a trivial comment fix (call this out explicitly).
- Verify failure → do NOT auto-chain anything; surface the failure verbatim and stop.

## After Passing

- If any criterion requires browser verification (UI state, user flow), recommend `/smoke-test`.
- If many files staged or changed, recommend `/commit-split` next.
