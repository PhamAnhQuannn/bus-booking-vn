---
name: atomic-file-edit
description: Multi-file edit protocol for safe symbol removal/rename across the codebase. Forces grep-all-usages → plan → write-all-in-one-turn → re-grep → typecheck to prevent intermediate broken states (a removed export with surviving call sites). Use whenever the change removes an export, renames a function/type/component/store action, changes a function signature, or moves a symbol between files — particularly in HMR-sensitive dev servers (Next.js, Vite) where mid-turn saves can crash the browser.
output_size:
  XS: 5m
  S: 5m
  M: 10m
  L: 15m
  XL: 15m
---

# /atomic-file-edit — Atomic Multi-File Edit Protocol

## Why you'd care

Saving a removed export before its call sites get rewritten crashes HMR mid-edit and corrupts the dev loop. The atomic protocol — grep-all → plan → write-in-one-turn → re-grep — is the difference between a clean rename and a half-broken tree that takes ten minutes to recover.

Invoke as `/atomic-file-edit <description of the change>`. Use this protocol whenever a change involves removing or renaming a symbol that is imported or used in multiple files.

> **Why this matters in dev:** Next.js Hot Module Replacement processes saves individually. A save that is valid TypeScript on its own but references a symbol no longer exported from a not-yet-saved dependency will compile, then crash the browser at runtime with `ReferenceError: <symbol> is not defined`.

---

## When to use

Use this protocol before making any edit that involves:
- Removing an export from a module
- Renaming a function, type, component, hook, or context value
- Changing a function signature (adding/removing parameters, changing return type)
- Moving a symbol from one file to another
- Removing an import and all its usages

If the change touches only one file and introduces no cross-file reference changes, the standard Edit tool is sufficient.

---

## High-Risk Symbol Categories

These categories are typically used across many files in a Next.js app. Extra care required:

| Category                               | Why high-risk                                                |
|----------------------------------------|--------------------------------------------------------------|
| Cart / order state hooks (e.g. `useCart`, `useOrder`) | Used in nav, drawer, checkout pages, confirmation page  |
| Auth context / hook                    | Wraps the entire app — every protected page reads it         |
| Server actions exported from `app/.../actions.ts` | Called from multiple client components                  |
| Prisma model types re-exported via `lib/types`     | Used in API routes, server components, and client components |
| Constants in `lib/config.ts`           | Imported by both server and client modules                   |
| `localStorage` / `cookies` keys        | One writer, multiple readers — rename breaks state continuity |

---

## The 5-Step Protocol

### Step 1 — Pre-flight: grep all usages

Before touching any file, find every reference to the symbol:

```bash
grep -rn "<symbol>" app/ components/ lib/ prisma/ --include="*.ts" --include="*.tsx"
```

(In PowerShell, use the Grep tool with `glob: "**/*.{ts,tsx}"`.)

List each file and line number. This is the complete edit surface.

### Step 2 — Plan the atomic write

Write out the complete set of changes required across all files:

```
ATOMIC CHANGE PLAN
──────────────────
Symbol: <name>
Change: <what is changing — removal / rename / signature>

Files to edit:
1. lib/cart.ts — remove export `addToCart`
2. components/MenuItemCard.tsx — remove import `addToCart`, replace call with `cart.add()`
3. app/(checkout)/cart/page.tsx — remove import `addToCart`, update call site

Files NOT affected (confirmed via grep): ...
```

Do not proceed until this plan accounts for every grep hit.

### Step 3 — Write all files in one turn

Execute all edits in a single response. Do not save any file in an intermediate broken state where:
- An import is removed but its call site remains
- A call site is updated but the export does not yet match the new signature
- A renamed symbol has both old and new names present in different files

If using the Edit tool, make all edits across all files before the turn ends. If rewriting a file completely, use Write — but only after Reading the current version.

**Order within the turn (when removing an export):** write the consuming files first (remove the usage), then write the exporting file (remove the export). This way, even if HMR processes saves in order, no consumer ever references a missing export.

### Step 4 — Verify zero stale references

After all edits, grep for the old symbol name again:

```bash
grep -rn "<old-symbol>" app/ components/ lib/ prisma/ --include="*.ts" --include="*.tsx"
```

Expected result: zero matches (or only matches in comments/docs that are intentional).

If any match is found, fix it before proceeding.

### Step 5 — Type check

Run:

```bash
pnpm tsc --noEmit
```

A clean type check confirms no dangling references remain. Fix any errors before marking the task done.

---

## HMR Awareness

Next.js Fast Refresh (built on React Refresh + Turbopack/Webpack HMR) processes file saves immediately. A save that is valid TypeScript but references a symbol that no longer exists in a not-yet-saved dependency will:
1. Compile successfully (TypeScript may not catch runtime-only issues, especially for runtime-resolved imports or `'use client'` boundaries)
2. Crash the browser at runtime with `ReferenceError: <symbol> is not defined` or a Fast Refresh full-reload loop

The only safe approach is to ensure every intermediate save — including partial edits within a single turn — leaves each file in a valid state relative to its current imports.

When in doubt: write the consuming files first (remove the usage), then write the exporting file (remove the export).
