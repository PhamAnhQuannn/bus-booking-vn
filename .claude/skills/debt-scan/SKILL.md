---
name: debt-scan
description: Surface scan for technical debt across the codebase. Scans for TODO/FIXME, TypeScript escape hatches, long functions, unused exports, missing error handlers in route handlers, and hardcoded values. Ranks findings P1–P3 and feeds them to /lead. Use pre-sprint, after a large merge, or when the user asks "what's the technical debt" / "what should we clean up".
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 3h
---

# /debt-scan — Technical Debt Surface Scan

## Why you'd care

The 47 TODOs scattered across the codebase aren't your debt problem — they're the visible top of it. The real debt is the eight route handlers without error boundaries that will silently 500 under traffic and the dozen `any` casts hiding a type contract drift that breaks at runtime in production. A pre-sprint surface scan ranking findings P1-P3 is what turns "we should clean up sometime" into a concrete prioritized list that gets actual sprint capacity, instead of guilt that accrues without action.

Invoke as `/debt-scan`. Scans the codebase for technical debt indicators and ranks them by severity. Outputs a prioritized task list for `/lead`.

---

## Pre-flight

1. Glob the project's source files. Worked example for TypeScript + Next.js + Prisma: `app/**/*.{ts,tsx}`, `components/**/*.tsx`, `lib/**/*.ts`, `prisma/**/*.ts`. Substitute your stack's roots (`src/**/*.py` for Python, `internal/**/*.go` for Go, `app/**/*.rb` for Rails, etc.) — run `/stack-profile` if uncertain.
2. Read `CLAUDE.md` Mistake Log (if present) — any debt pattern that appears there is automatically elevated to P1

---

## Scan Categories

### Category 1 — TODO/FIXME/HACK Comments

Scan for: `// TODO`, `// FIXME`, `// HACK`, `// XXX`, `// NOTE: temporary`, `// workaround`

Classify by content:
- Contains a date or issue number → Medium (tracked)
- Says "temporary" or "workaround" → High (deliberately deferred)
- No context → Low (may be stale)

### Category 2 — TypeScript Escape Hatches

Scan for:
- `as any` — type safety bypass
- `@ts-ignore` — suppressed type error
- `@ts-expect-error` — expected error (may be intentional, flag if no comment explains why)
- `!` non-null assertion without comment — risky in Prisma query results that can return `null`

### Category 3 — Long Functions

Functions over 80 lines are too complex. Scan for function declarations and check line count.

Heuristic: `function`, `const ... =>`, or `export default function` at indentation level 0–2; count lines until matching closing brace.

### Category 4 — Unused Exports

Scan for `export function` / `export const` / `export type` that have no corresponding `import` in any other file. Note: may be intentional public API of a library file — flag but don't auto-classify as debt.

### Category 5 — Missing Error Handlers in Route Handlers / Server Actions

Scan the project's HTTP entrypoints for unhandled async failures. Worked example for Next.js — route handlers (`app/api/**/route.ts`) and server actions (`'use server'` files):
- No `try/catch` around `prisma.*` calls (or your ORM equivalent)
- No `.catch()` on promise chains in handler bodies
- `export async function GET/POST/PUT/PATCH/DELETE` that doesn't handle errors from `prisma.`

For other stacks: FastAPI endpoints without `try/except` around DB calls, Express handlers without `next(err)` wiring, Rails controllers without `rescue_from`. Unhandled rejections return an opaque 500 to the client and lose the error context in logs.

### Category 6 — Hardcoded Values

Scan for:
- Hardcoded URLs (not from `process.env` or a config module)
- Hardcoded timeouts or expiry values (magic numbers) without named constants
- Hardcoded prices, tax rates, or fee percentages — these should live in a config or DB row, never inline in code

---

## Output Format

```
DEBT SCAN
─────────
Scanned: N files

PRIORITY 1 — Fix before next sprint:
  [HACK/WORKAROUND] app/api/orders/route.ts:145
    // WORKAROUND: using $queryRaw because Prisma doesn't support SELECT FOR UPDATE
    Status: May be permanent — evaluate after Prisma update

  [MISSING ERROR HANDLER] app/api/reservations/route.ts:89
    prisma.reservation.create() call has no try/catch
    Risk: Unhandled promise rejection returns opaque 500, loses log context

PRIORITY 2 — Improve before launch:
  [TS-ESCAPE] lib/cart.ts:34
    (cart.state as any).items — type bypass
    Fix: Add proper type to cart state

  [LONG FUNCTION] app/api/orders/route.ts:placeOrder (112 lines)
    Refactor: extract validation logic to separate function

PRIORITY 3 — Clean up when touching this area:
  [TODO] app/(checkout)/payment/page.tsx:23
    // TODO: add loading skeleton
    Status: UI polish — defer to post-MVP

  [UNUSED EXPORT] lib/types/order.ts
    export type OrderSummary — no imports found
    Note: May be used by future consumer — verify before removing

SUMMARY: 2 P1, 2 P2, 2 P3 — total 6 debt items

RECOMMENDED NEXT STEPS:
  → /lead "add error handler to reservations create" [P1 — risk: opaque 500]
  → /lead "add error handler to orders create" [P1 — same pattern]
```

---

## Auto-chain

- Flagged symbol has no test coverage → auto-fire `/coverage-map` to confirm, then `/tdd` to add tests before resolving the debt.

## Integration

- **Discovery**: Run pre-sprint or weekly
- **Feeds `/lead`**: each P1/P2 item becomes a `/lead` task
- **Escalation rule**: any debt touching payment, auth, or order-placement routes is auto-elevated to P1
