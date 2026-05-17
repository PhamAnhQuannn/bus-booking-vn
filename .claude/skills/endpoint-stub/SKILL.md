---
name: endpoint-stub
description: Generic REST/RPC/server-action endpoint stub with input validation, auth gate, error wrap, and observability hook. Stack-branched via `/stack-profile`. Use when user says "endpoint stub", "new route", "scaffold api", "/endpoint-stub <method> <path>", or before writing business logic on a new endpoint.
output_size:
  XS: 10m
  S: 15m
  M: 30m
  L: 30m
  XL: 30m
---

# /endpoint-stub — Single Endpoint Skeleton

## Why you'd care

The endpoint that ships with business logic but without auth, input validation, error wrapping, or an observability hook is the one that takes 3 hours to debug at 2am when the customer reports "it just returns 200 with nothing" — because the engineer forgot to call the logger and the request payload was malformed in a way Zod would have caught instantly. A consistent stub that wires the cross-cutting concerns first is what makes feature work focus on the business logic instead of re-deciding the boilerplate every time.

Invoke as `/endpoint-stub <method> <path>` (e.g. `/endpoint-stub POST /api/orders`). Drops one endpoint with all cross-cutting concerns wired so business logic is the only thing left.

---

## Pre-flight

1. Read `docs/stack/profile.md`. Missing → run `/stack-profile`, halt.
2. If Backend = `none` (CLI-only) → halt.
3. If `<path>` already exists in the route tree → ask: overwrite, augment, or rename.

---

## Inputs

- HTTP method (GET/POST/PUT/PATCH/DELETE) or RPC procedure name
- Path / procedure name
- Stack profile (Backend, Validator, Auth, Logger)
- Optional `--public` (skip auth gate) / `--idempotent` (add idempotency-key handling)

---

## Cross-cutting concerns baked in

| Concern         | Wired to                                   |
|-----------------|--------------------------------------------|
| Input validation| Zod/Pydantic/struct from profile           |
| Auth gate       | NextAuth getServerSession / FastAPI Depends / chi middleware |
| Error wrap      | typed `AppError` + JSON envelope `{error, code, traceId}` |
| Logger          | request id + method + path + duration ms   |
| Tracing         | OTel span open/close if profile has OTel   |
| Rate limit      | hook placeholder (concrete impl out of scope) |

---

## Stack branch

| Backend in profile | File path                          | Auth helper                                  |
|--------------------|------------------------------------|----------------------------------------------|
| Next.js (App)      | `app/api/<path>/route.ts`          | `getServerSession(authOptions)`              |
| Next.js (server actions) | `app/<slug>/actions.ts`      | `auth()` (Auth.js v5) or `getServerSession`  |
| FastAPI            | `app/routers/<slug>.py` + add to `app.include_router` | `Depends(get_current_user)` |
| Express / Fastify  | `routes/<slug>.ts`                 | `requireAuth` middleware                     |
| chi / echo (Go)    | `internal/<slug>/handler.go` + register on mux | `middleware.RequireAuth`            |
| tRPC               | `server/routers/<slug>.ts`         | `protectedProcedure` from base               |

---

## Template (Next.js POST)

`app/api/<slug>/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { AppError, toEnvelope } from '@/lib/errors';
import { randomUUID } from 'node:crypto';

const Input = z.object({
  /* TODO(endpoint-stub): fields */
});

export async function POST(req: Request) {
  const traceId = req.headers.get('x-request-id') ?? randomUUID();
  const log = logger.child({ traceId, method: 'POST', path: '<path>' });
  const start = Date.now();
  try {
    const session = await getServerSession(authOptions);
    if (!session) throw new AppError('UNAUTHENTICATED', 401);

    const parsed = Input.safeParse(await req.json());
    if (!parsed.success) throw new AppError('INVALID_INPUT', 400, parsed.error.issues);

    // TODO(endpoint-stub): business logic
    const result = { ok: true };

    log.info({ durationMs: Date.now() - start }, 'ok');
    return NextResponse.json(result);
  } catch (e) {
    const env = toEnvelope(e, traceId);
    log.error({ err: env, durationMs: Date.now() - start }, 'fail');
    return NextResponse.json(env, { status: env.status });
  }
}
```

`lib/errors.ts` (emit if absent):

```ts
export class AppError extends Error {
  constructor(public code: string, public status = 500, public detail?: unknown) { super(code); }
}
export function toEnvelope(e: unknown, traceId: string) {
  if (e instanceof AppError) return { error: e.code, status: e.status, detail: e.detail, traceId };
  return { error: 'INTERNAL', status: 500, traceId };
}
```

(Mirror for FastAPI: `APIRouter`, `Depends`, `HTTPException`. Mirror for chi: handler func + middleware chain.)

---

## Idempotency variant (with `--idempotent`)

Adds `Idempotency-Key` header read → key store lookup (Redis / Postgres) → short-circuit return if replay. Inserts TODO marker for store wiring.

---

## Workflow

1. Resolve method + path. Compute file path per stack.
2. Print plan: "Will write `<file>`. Proceed?"
3. Emit file. Also emit `lib/errors.ts` + `lib/logger.ts` shims if absent (idempotent — skip if present).
4. Update route registration if framework needs it (FastAPI `include_router`, chi `r.Mount`, Express `app.use`).
5. Smoke: typecheck on the new file only.

---

## Output

Side-effect = source files. After emit, print:

```
Stubbed <METHOD> <path>. File: <list>.
Next: /tdd <slug>   (write the test first then fill in business logic)
```

---

## When to re-run

- Per new endpoint.
- Do NOT re-run same path without overwrite confirm.
