---
name: refactor-extract
description: Language-aware extract-function / extract-component refactor with call-site update across files. Uses `atomic-file-edit` protocol for multi-file safety. Detects parameters, return type, and closure captures. Stack-branched via `/stack-profile`. Use when user says "extract function", "extract component", "pull this out", "refactor extract", "/refactor-extract <selector>", or when a function/component grows past readability threshold.
---

# /refactor-extract — Extract Function / Component

Invoke as `/refactor-extract <symbol>` or with a target file + line range. Pulls a block out into a named function or component, updates call sites, runs typecheck.

---

## Why you'd care

Manual extract refactors that touch every call site are how regressions sneak in — miss one, ship a bug. A language-aware refactor with multi-file update is what makes the cleanup safe enough to actually do.

## Pre-flight

1. Read `docs/stack/profile.md`. Halt if Language unknown.
2. Resolve target:
   - Symbol form: `/refactor-extract MyHugeComponent#renderHeader` → locate by name.
   - Range form: `<file>:<startLine>-<endLine>` → read exact span.
3. If span includes partial expressions or unmatched braces → halt: "select complete statements only".
4. If destination path collides with existing symbol → ask: rename, overwrite, or merge.
5. Confirm: chain into `atomic-file-edit` (multi-file safety) if >1 call site exists.

---

## Inputs

- Selector (`symbol` or `file:lines`)
- New name (optional, prompt if absent)
- Destination (optional, default = sibling file or same file)
- Stack profile (Language, Framework)
- Optional `--component` forces React/Vue component extraction (vs plain function)
- Optional `--hook` forces React hook extraction (function returning state/effects)

---

## Decision: function vs component vs hook

| Span contains                                | Extract as          |
|----------------------------------------------|---------------------|
| JSX/template returning markup                | Component           |
| Hook calls (`useState`, `useEffect`, etc.)   | Custom hook         |
| Pure compute, no JSX, no hooks               | Function            |
| Side-effect-only (writes, calls)             | Procedure / handler |
| Async fetch + return                         | Async function      |

---

## Inference passes (read-only first)

1. **Capture pass** — variables referenced in span but declared outside → become parameters.
2. **Mutation pass** — variables assigned inside span but used outside → become return values (or refs).
3. **Closure pass** — `this`, `self`, outer-scope state references → flag for explicit pass-through.
4. **Type pass** — infer parameter types from declarations; return type from final expression.
5. **Side-effect pass** — IO, console, fetch, DOM, state-setters → annotate; influences naming.

---

## Workflow

1. Run inference passes → build extraction signature: `name(params): returnType`.
2. Print plan:
   ```
   Extract: <name>
   Params: <list>
   Returns: <type>
   Destination: <path>
   Call-site rewrites: <count>
   Files touched: <list>
   ```
3. User confirm.
4. Invoke `/atomic-file-edit` flow:
   - Write extracted symbol to destination.
   - Replace span at original site with call.
   - Update imports at origin (+ any newly importing file).
5. Run language typecheck:
   - TS: `pnpm tsc --noEmit`
   - Python: `mypy <paths>` or `pyright`
   - Go: `go build ./...`
6. If typecheck fails → revert all writes, report error.
7. If passes → run smoke (lint + nearest test file).

---

## File templates

### React component extraction (TS)

Before — `app/dashboard/page.tsx`:

```tsx
export default function Dashboard({ user }: { user: User }) {
  return (
    <div>
      <header>
        <h1>Hi {user.name}</h1>
        <button onClick={signOut}>Sign out</button>
      </header>
      {/* ... */}
    </div>
  );
}
```

After (`--component` Header, dest `components/dashboard/Header.tsx`):

```tsx
// components/dashboard/Header.tsx
import { signOut } from '@/lib/auth';
import type { User } from '@/lib/types';

export function Header({ user }: { user: User }) {
  return (
    <header>
      <h1>Hi {user.name}</h1>
      <button onClick={signOut}>Sign out</button>
    </header>
  );
}
```

```tsx
// app/dashboard/page.tsx
import { Header } from '@/components/dashboard/Header';

export default function Dashboard({ user }: { user: User }) {
  return (
    <div>
      <Header user={user} />
      {/* ... */}
    </div>
  );
}
```

### Custom hook extraction

Before:

```tsx
const [items, setItems] = useState<string[]>([]);
useEffect(() => {
  fetch('/api/items').then((r) => r.json()).then(setItems);
}, []);
```

After (`useItems` in `hooks/useItems.ts`):

```ts
import { useState, useEffect } from 'react';

export function useItems() {
  const [items, setItems] = useState<string[]>([]);
  useEffect(() => {
    fetch('/api/items').then((r) => r.json()).then(setItems);
  }, []);
  return items;
}
```

Call site → `const items = useItems();`

### Python function extraction

Before — `service.py`:

```python
def process_order(order):
    # validate
    if order.total <= 0:
        raise ValueError("total must be > 0")
    if not order.items:
        raise ValueError("no items")
    # ... rest of logic
```

After (`validate_order` in same file):

```python
def validate_order(order: Order) -> None:
    if order.total <= 0:
        raise ValueError("total must be > 0")
    if not order.items:
        raise ValueError("no items")


def process_order(order: Order) -> None:
    validate_order(order)
    # ... rest of logic
```

### Go function extraction

Before — `internal/order/process.go`:

```go
func Process(o Order) error {
  if o.Total <= 0 { return errors.New("total must be > 0") }
  if len(o.Items) == 0 { return errors.New("no items") }
  // ... rest
}
```

After:

```go
func validate(o Order) error {
  if o.Total <= 0 { return errors.New("total must be > 0") }
  if len(o.Items) == 0 { return errors.New("no items") }
  return nil
}

func Process(o Order) error {
  if err := validate(o); err != nil { return err }
  // ... rest
}
```

### Rust trait extraction

Detect duplicated method signature across structs → extract `trait` → `impl` per struct. Preserve `Self` so receiver type stays struct-local.

Before — `src/billing.rs`:

```rust
struct Invoice { total: u64, paid: bool }
struct Quote   { total: u64, sent: bool }
impl Invoice { fn formatted_total(&self) -> String { format!("${}", self.total) } }
impl Quote   { fn formatted_total(&self) -> String { format!("${}", self.total) } }
```

After (`Priced` trait extracted):

```rust
trait Priced { fn formatted_total(&self) -> String; }
impl Priced for Invoice { fn formatted_total(&self) -> String { format!("${}", self.total) } }
impl Priced for Quote   { fn formatted_total(&self) -> String { format!("${}", self.total) } }
```

Rules: `&self` stays `&self` (don't rewrite to `&Invoice`). Bodies diverge → keep per-impl. Default body only if bodies are byte-identical and reference no struct-specific field. `cargo check` after; revert on fail.

---

## Inline-if-used (≤1 call site) heuristic

Before extracting, check the inverse case: should the existing function instead be **inlined**?

Rule: if function `F` is called from **exactly one** site AND `F`'s body is **≤10 lines**, prefer inline over extract — the indirection costs more than it saves.

Detect:

```sh
rg -n --type ts -w "myFunc\(" src/    # call-site count
rg -nA 20 "^(export )?function myFunc" src/lib/x.ts   # body lines
```

If `call_sites == 1` and `body_lines <= 10` → inline: paste body at call site, delete original, drop import. Then run typecheck.

Skip inline (extract anyway): public API / cross-crate export; early `return` changes semantics inlined; recursive; name carries domain meaning (`validateInvoice` ≫ `if total <= 0 ...`).

---

## Param reordering post-extract

After signature is built, reorder params before final write:

1. **Receiver / value first** — if extracting a method, `self` / `this` / primary value leads. Python: `self`. Rust: `&self`. TS class method: implicit `this`, so primary subject is param 0.
2. **Required-before-optional** — no `Option<T>` / `T | undefined` / default-valued param before a required one.
3. **Related params together** — `(x, y)` coords, `(start, end)` ranges, `(min, max)` bounds stay adjacent and in natural order.

Examples:

```python
# pre  → post (Python)
def charge(amount, currency: str | None, user, key): ...
def charge(user, amount, key, currency: str | None = None): ...
```

```rust
// pre → post (Rust)
fn slice(end: usize, buf: &[u8], start: usize) -> &[u8] { }
fn slice(buf: &[u8], start: usize, end: usize) -> &[u8] { }
```

Re-run type-check pass after reorder (extract → check → reorder → check). If the second check fails (e.g., a positional call site couldn't be rewritten cleanly, ambiguous overload, macro expansion broke) → **revert the reorder only**, keep the extraction. Log: `reorder reverted: <cause>`.

---

## Naming heuristics

| Span purpose                  | Name pattern              |
|-------------------------------|---------------------------|
| Validation / guard            | `validateX` / `assertX`   |
| Pure transform                | `toX` / `fromX` / `mapX`  |
| Boolean check                 | `isX` / `hasX` / `canX`   |
| Async fetch                   | `fetchX` / `loadX`        |
| Render fragment (component)   | `XHeader` / `XList`       |
| Handler / event               | `handleX` / `onX`         |
| Hook                          | `useX`                    |

Reject names: `helper`, `util`, `do`, `process`, `manage`. Prompt for re-name.

---

## Multi-file safety (uses `/atomic-file-edit`)

When call sites span multiple files, the edit set is single-turn atomic:

1. Grep all references first.
2. Build edit batch (destination write + origin rewrite + N call-site rewrites + N import inserts).
3. Apply in one turn — no intermediate broken state.
4. Re-grep to confirm zero stale references.
5. Typecheck. Revert on failure.

---

## Refuse list (do not extract)

- Spans with `return` from outer function (unless you also extract the surrounding flow).
- Spans with `break` / `continue` referencing outer loop.
- Spans declaring variables consumed after the span (mutation pass should reject these unless return tuple is acceptable).
- Generators / async-generator boundaries.

On refuse → print reason, suggest manual flow.

---

## Output

Side-effect = N file edits. After run, print:

```
Extracted: <name> → <dest path>. Origin: <file>. Call sites updated: <N>. Files touched: <N>.
Typecheck: PASS. Lint: PASS.
Next: run nearest tests; commit as "refactor: extract <name>".
```

---

## When to re-run

- Per extraction. No state carries between runs.
- If typecheck fails twice in a row on same target → halt and ask for manual split.
- Do NOT chain multiple extractions in one invocation — one at a time keeps blame clean.
