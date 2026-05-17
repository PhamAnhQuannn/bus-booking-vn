---
name: scaffold-feature
description: Generate the full file skeleton for one issue/feature slice — route + page + component + test + types — matching the chosen stack from `/stack-profile`. Reads `issues/<slice>.md` + `docs/stack/profile.md`. Emits files directly into the project tree. Use when user says "scaffold this", "generate slice", "stub this issue", "/scaffold-feature", or before `/tdd` on a new vertical slice.
---

# /scaffold-feature — One-Shot Feature Skeleton

Invoke as `/scaffold-feature <issue-slug>`. Reads one issue file, the stack profile, and emits all the boilerplate files for that slice so the human/Claude can drop straight into writing business logic.

---

## Why you'd care

Hand-rolling every route + page + component + test for each new slice is where momentum goes to die. A scaffold matching the stack profile saves an hour per slice and prevents the drift between similar features.

## Pre-flight

1. Read `docs/stack/profile.md`. If missing → run `/stack-profile` first, halt.
2. Read `issues/<issue-slug>.md`. If missing → halt with list of `issues/` candidates.
3. Read `docs/classify/<project>.md` to honor class-scaled scaffold depth.
4. Check current git state. If unstaged changes touch the same paths the scaffold would emit → halt and ask user.

---

## Inputs

- Issue file (vertical slice: name, AC, edge cases if present)
- Stack profile (frontend, backend, ORM, test, auth, logger)
- Project class (depth knob)

---

## Class-scaled depth

| Class | What gets scaffolded                                                                                            |
|-------|-----------------------------------------------------------------------------------------------------------------|
| XS    | Single file w/ inline test block. No types file.                                                                 |
| S     | `feature.ts` + `feature.test.ts`. Flat layout.                                                                   |
| M     | Layered slice: route handler + page/component + service + types + test. Subfolder per feature.                   |
| L     | M + WS handler (if realtime in profile) + queue job stub (if queue in profile) + integration test.              |
| XL    | L + audit-log call + RBAC gate + threat-model checklist comment + contract-test stub.                            |

---

## Stack-branched emit map

Pick the row that matches `docs/stack/profile.md`:

| Frontend stack | Files emitted                                                                                       |
|----------------|------------------------------------------------------------------------------------------------------|
| Next.js App Router | `app/<slug>/page.tsx`, `app/<slug>/loading.tsx`, `app/api/<slug>/route.ts`, `app/<slug>/_components/<Slug>.tsx`, `app/<slug>/_lib/<slug>.service.ts`, `app/<slug>/_lib/<slug>.types.ts`, `app/<slug>/__tests__/<slug>.test.ts` |
| Vite + React   | `src/features/<slug>/<Slug>.tsx`, `src/features/<slug>/<slug>.api.ts`, `src/features/<slug>/<slug>.types.ts`, `src/features/<slug>/<slug>.test.tsx` |
| FastAPI / Python | `app/routers/<slug>.py`, `app/services/<slug>.py`, `app/schemas/<slug>.py`, `tests/test_<slug>.py` |
| Go (chi/echo)  | `internal/<slug>/handler.go`, `internal/<slug>/service.go`, `internal/<slug>/handler_test.go`, `internal/<slug>/service_test.go` |
| CLI only (XS)  | `src/<slug>.ts` + inline test  OR  `cmd/<slug>/main.go` + `<slug>_test.go`                            |

If frontend = none, omit page/component rows.

---

## File templates (TS / Next.js M example)

Each emitted file gets a minimal skeleton, NOT a full implementation. The body holds: imports, function signature, single TODO marker, and (where relevant) the test scaffold pointing at the empty function.

```ts
// app/api/<slug>/route.ts
import { NextResponse } from 'next/server';
// TODO(scaffold-feature): validate input via Zod
// TODO(scaffold-feature): call <slug>.service
export async function POST(req: Request) {
  return NextResponse.json({ ok: true });
}
```

```ts
// app/<slug>/__tests__/<slug>.test.ts
import { describe, it, expect } from 'vitest';
import { <slug>Service } from '../_lib/<slug>.service';

describe('<slug>', () => {
  it.todo('happy path');
  it.todo('rejects invalid input');
  it.todo('handles auth failure');
});
```

(Mirror equivalents for Python pytest, Go testing, etc.)

### Rust crate scaffold

For M+ when stack profile = Rust workspace. Treat each feature as its own crate under `crates/<name>`.

```bash
cargo new --lib crates/<name>
```

Layout:

```
crates/<name>/
  Cargo.toml
  src/lib.rs
  src/error.rs
  tests/integration.rs
```

`crates/<name>/Cargo.toml` (workspace member entry):

```toml
[package]
name = "<name>"
version = "0.1.0"
edition = "2021"

[dependencies]
thiserror = { workspace = true }
```

Root `Cargo.toml` gains `members = [..., "crates/<name>"]`.

`src/lib.rs` — public API re-export pattern:

```rust
mod error;
mod service;

pub use error::{Error, Result};
pub use service::<Name>Service;
// TODO(scaffold-feature): wire concrete impl
```

`src/error.rs`:

```rust
use thiserror::Error;

#[derive(Debug, Error)]
pub enum Error {
    #[error("invalid input: {0}")]
    Invalid(String),
}

pub type Result<T> = std::result::Result<T, Error>;
```

`tests/integration.rs`:

```rust
use <name>::<Name>Service;

#[test]
fn happy_path() { todo!() }
#[test]
fn rejects_invalid_input() { todo!() }
```

### FastAPI router scaffold

For M+ when backend = FastAPI. Split router / schema / service / test.

`app/routers/<feature>.py`:

```python
from fastapi import APIRouter
from app.schemas.<feature> import <Feature>In, <Feature>Out
from app.services.<feature> import <feature>_service

router = APIRouter(prefix="/<feature>", tags=["<feature>"])

@router.post("", response_model=<Feature>Out)
async def create_<feature>(payload: <Feature>In):
    # TODO(scaffold-feature): call service, map errors
    return await <feature>_service.create(payload)
```

`app/schemas/<feature>.py` (Pydantic):

```python
from pydantic import BaseModel

class <Feature>In(BaseModel):
    name: str

class <Feature>Out(BaseModel):
    id: str
    name: str
```

`app/services/<feature>.py` (business logic):

```python
from app.schemas.<feature> import <Feature>In, <Feature>Out

class <Feature>Service:
    async def create(self, payload: <Feature>In) -> <Feature>Out:
        # TODO(scaffold-feature): persist + return
        raise NotImplementedError

<feature>_service = <Feature>Service()
```

`tests/test_<feature>.py`:

```python
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_create_<feature>_happy(client: AsyncClient):
    pytest.skip("TODO(scaffold-feature)")
```

Register in `app/main.py`:

```python
from app.routers import <feature>
app.include_router(<feature>.router)
```

### Workspace-aware placement

Before emit, cross-ref `/workspace-detect` to find the correct package root (monorepo, Cargo workspace, pnpm/turbo, uv workspace, Go modules).

Rules:

1. Run `/workspace-detect`. Consume its package list.
2. Single matching package for the slice domain → emit there.
3. Multiple candidates could host the feature → fail-soft. Print candidates with one-line rationale per package, prompt user to pick. Do NOT guess.
4. Respect existing folder conventions per package: if package already uses `src/features/<x>/` flat, do not introduce `internal/<x>/handler.go` layering — mirror the local idiom.
5. Re-emit the stack-branched table relative to the chosen package root, not repo root.

Ambiguity prompt: list each candidate `path (stack hint) — rationale` and wait for pick.

---

## Workflow

1. Resolve slug from arg. Lowercase-kebab.
2. Compute emit list from stack profile × class depth.
3. Print plan: "Will create N files: <list>. Proceed?" Wait for confirm.
4. Emit all files in single batch (parallel Write).
5. Echo `git status` summary.
6. Recommend `/tdd <slug>` next.

---

## Output

No separate report file. Side-effect = source files. After emit, print:

```
Scaffolded <slug>. <N> files created.
Next: /tdd <slug>
```

---

## When to re-run

Per new issue/slice. Do not re-run on the same slug unless `--force` (will overwrite).
