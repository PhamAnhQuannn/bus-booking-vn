---
name: codegen-from-contract
description: Reads `docs/design/api-contract.md` (or OpenAPI / tRPC schema) and emits validators, handler stubs, and a typed client SDK matching the stack from `/stack-profile`. Stack-branched (Zod+Next.js / Pydantic+FastAPI / Go structs+chi). Use when user says "generate from contract", "codegen api", "stub handlers from spec", "/codegen-from-contract", or after `/api-contract` lands.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /codegen-from-contract — Contract → Code

## Why you'd care

Hand-writing validators, handler stubs, and client SDKs from an API spec produces three places where drift creeps in. Generating from the contract makes the spec the single source of truth — when it changes, the surrounding code can't quietly disagree.

Invoke as `/codegen-from-contract`. Turns an API contract into runnable skeletons: server-side validators, handler stubs, and a typed client.

---

## Pre-flight

1. Read `docs/stack/profile.md`. Missing → run `/stack-profile` first, halt.
2. Read `docs/design/api-contract.md` (or `openapi.yaml` / `trpc/router.ts`). Missing → halt with note: "no contract — run `/api-contract` or point me at an OpenAPI file".
3. If class = **XS** → ask user "this is overkill for XS — proceed anyway?".
4. If existing handlers already cover endpoints in contract → diff mode: emit only the missing ones.

---

## Inputs

- Contract file (markdown table, OpenAPI 3.x, or tRPC router)
- Stack profile (Backend, Language, Test runner, Logger)
- Optional `--client-only` / `--server-only` flags

---

## Stack branch

| Backend in profile        | Validator   | Handler shape                     | Client SDK             |
|---------------------------|-------------|-----------------------------------|------------------------|
| Next.js route handlers    | Zod         | `app/api/<path>/route.ts`         | typed fetch wrapper    |
| FastAPI                   | Pydantic    | `app/routers/<name>.py`           | `httpx` + Pydantic models |
| Go (chi/echo)             | go-playground/validator | `internal/<name>/handler.go` | typed client struct |
| Express / Fastify         | Zod         | `routes/<name>.ts`                | typed fetch wrapper    |
| tRPC                      | Zod (built-in) | `server/routers/<name>.ts`     | auto-generated         |

---

## Workflow

1. Parse contract → list of endpoints `{method, path, request schema, response schema, auth, errors}`.
2. For each endpoint:
   - Emit validator module (Zod/Pydantic/struct).
   - Emit handler stub with auth gate placeholder, validator call, TODO marker for business logic, error wrap, logger entry/exit lines.
   - Emit client method: typed input, typed output, throws on non-2xx.
3. Emit one shared `errors.ts` (or equivalent) with the contract's error codes if not already present.
4. Emit one `index.ts` barrel per concern (validators, handlers, client) so re-runs don't fight imports.
5. Run `lint` + `typecheck` smoke (do not auto-fix).

---

## File templates (Next.js + Zod)

`app/api/<slug>/_schema.ts`:

```ts
import { z } from 'zod';
export const <Slug>Request = z.object({ /* TODO */ });
export const <Slug>Response = z.object({ /* TODO */ });
export type <Slug>RequestT = z.infer<typeof <Slug>Request>;
export type <Slug>ResponseT = z.infer<typeof <Slug>Response>;
```

`app/api/<slug>/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { <Slug>Request } from './_schema';
import { logger } from '@/lib/logger';

export async function POST(req: Request) {
  const parsed = <Slug>Request.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT', issues: parsed.error.issues }, { status: 400 });
  // TODO(codegen): auth gate
  // TODO(codegen): call service
  logger.info({ slug: '<slug>' }, 'handled');
  return NextResponse.json({ ok: true });
}
```

`lib/api/<slug>.client.ts`:

```ts
import type { <Slug>RequestT, <Slug>ResponseT } from '@/app/api/<slug>/_schema';
export async function <slug>(input: <Slug>RequestT): Promise<<Slug>ResponseT> {
  const r = await fetch('/api/<slug>', { method: 'POST', body: JSON.stringify(input), headers: { 'content-type': 'application/json' } });
  if (!r.ok) throw new Error(`<slug> failed: ${r.status}`);
  return r.json();
}
```

(Mirror for FastAPI: Pydantic models + router + httpx client. Mirror for Go: struct + chi handler + typed client struct.)

---

### tRPC full-stack adapter

Worked example — `server/routers/booking.ts` (telehealth vertical):

```ts
import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
export const bookingRouter = router({
  create: protectedProcedure
    .input(z.object({ patientId: z.string().uuid(), slotIso: z.string().datetime() }))
    .output(z.object({ id: z.string(), status: z.enum(['booked','waitlist']) }))
    .mutation(async ({ input, ctx }) => ctx.svc.book(input)),
  byPatient: protectedProcedure
    .input(z.object({ patientId: z.string().uuid() }))
    .query(async ({ input, ctx }) => ctx.svc.list(input.patientId)),
});
export type BookingRouter = typeof bookingRouter;
```

Client (`web/lib/trpc.ts`) infers types from `BookingRouter` — no separate SDK. React Query hook is auto-generated:

```ts
const { data } = trpc.booking.byPatient.useQuery({ patientId });
const mut = trpc.booking.create.useMutation();
```

Pick tRPC over REST when: TypeScript on both ends, monorepo, no third-party consumers, no need for OpenAPI tooling/curl playgrounds. Pick REST when: polyglot clients, public API, mobile native, gateway/CDN caching.

---

### OpenAPI 3.1 (vs 3.0)

Differences that bite codegen:

- `nullable: true` deprecated → use `type: [string, "null"]` (JSON Schema union).
- Full **JSON Schema 2020-12** alignment — `if/then/else`, `unevaluatedProperties`, `$dynamicRef` now legal.
- `webhooks:` top-level object (peer of `paths:`) — outbound callbacks the API sends (Stripe-style events).
- `examples` must be an object map; `example` (singular) still allowed but discouraged.
- `exclusiveMinimum` / `exclusiveMaximum` are numbers, not booleans.
- `info.license.identifier` (SPDX) added alongside `license.url`.

Generator flags to emit/parse 3.1:

- `openapi-generator-cli generate -i spec.yaml -g typescript-fetch --openapi-normalizer KEEP_ONLY_FIRST_TAG_IN_OPERATION=true` + ensure spec header `openapi: 3.1.0`.
- `openapi-typescript spec.yaml -o types.ts` — 3.1 native since v6.
- `datamodel-code-generator --input spec.yaml --input-file-type openapi --openapi-scopes schemas paths` (Python/Pydantic v2 — supports 3.1).
- `oapi-codegen -package api spec.yaml` (Go) — 3.1 since v2.
- Validate with `redocly lint spec.yaml` (3.1-aware) before codegen; bail on errors.

If contract says `openapi: 3.0.x` but uses `type: [string, "null"]`, halt and ask to upgrade the header.

---

### gRPC .proto stubs

Worked example — `proto/payments/v1/payments.proto` (fintech vertical):

```proto
syntax = "proto3";
package payments.v1;
service Payments {
  rpc Charge(ChargeReq) returns (ChargeRes);                  // unary
  rpc StreamLedger(LedgerFilter) returns (stream LedgerEntry); // server-stream
  rpc BulkRefund(stream RefundReq) returns (RefundSummary);    // client-stream
  rpc Reconcile(stream TickReq) returns (stream TickRes);      // bidi
}
message ChargeReq  { string account_id = 1; int64 cents = 2; string idempotency_key = 3; }
message ChargeRes  { string txn_id = 1; string status = 2; }
```

Codegen pipeline:

- `buf generate` (preferred) with `buf.gen.yaml` listing plugins: `buf.build/protocolbuffers/go`, `buf.build/grpc/go`, `buf.build/community/stephenh-ts-proto`, `buf.build/protocolbuffers/python`.
- Or `protoc --go_out=. --go-grpc_out=. --ts_proto_out=. --python_out=.` (older shops).
- Emits Go `payments_grpc.pb.go` (server interface + client stub), TS `payments.ts` (gRPC-web client), Python `payments_pb2_grpc.py`.

Streaming choice rubric:

- **Unary** — request/response (CRUD-shaped).
- **Server-stream** — long-running query, server pushes pages/ticks (ledger tail, log follow).
- **Client-stream** — client uploads chunks/batch, server returns summary (bulk import).
- **Bidi** — interactive sessions (chat, telemetry sync, agent loops); requires HTTP/2 end-to-end (gRPC-web does NOT support bidi — degrade to server-stream + POST).

Emit handler stubs returning `codes.Unimplemented` so unmerged work fails loudly.

---

### Vendor-SDK patterns (Stripe / Twilio / SendGrid)

Two cross-cutting concerns codegen must wire, not leave to handler authors:

**Request-context propagation.** Pull `correlation_id` + `user_id` from request context, forward as SDK metadata so vendor logs join your traces.

**Idempotency keys.** One key per *logical* request (not per HTTP attempt). Persist BEFORE the SDK call so retries replay the same key. Store `(key, vendor_response)` so duplicate inbound requests short-circuit.

Wrapper pattern — Stripe (payments):

```ts
export async function chargeOnce(ctx: Ctx, input: ChargeInput) {
  const key = input.idempotencyKey ?? `chg_${input.orderId}`;
  const cached = await ctx.kv.get(`stripe:${key}`);
  if (cached) return JSON.parse(cached);
  const res = await ctx.stripe.paymentIntents.create(
    { amount: input.cents, currency: 'usd', customer: input.customerId, metadata: { correlation_id: ctx.cid, user_id: ctx.uid } },
    { idempotencyKey: key, maxNetworkRetries: 2 },
  );
  await ctx.kv.set(`stripe:${key}`, JSON.stringify(res), { ex: 86400 });
  return res;
}
```

Twilio (messaging) — no SDK-level idempotency; emulate by hashing `(to, body, window)` and dedup in your store before `messages.create({ to, from, body, statusCallback: cidUrl(ctx.cid) })`.

SendGrid (email) — set `X-Message-Id` header from `${ctx.cid}:${logicalId}` and dedup on your side; SendGrid will retry on 5xx but accepts duplicates, so the gate must be yours.

Codegen emits one `vendors/<provider>.ts` wrapper per provider listed in stack profile; handlers call the wrapper, never the raw SDK.

---

## Output

Side-effect = source files. After emit, write `docs/qa/codegen-<date>.md`:

```markdown
# /codegen-from-contract run — <YYYY-MM-DD>
- Contract: <path>
- Endpoints emitted: <N>
- Files written: <list>
- Skipped (already existed): <list>
- Smoke: lint <pass|fail>, typecheck <pass|fail>
```

---

## When to re-run

- Contract changes — re-run to diff and emit new endpoints.
- Stack changes — re-run to switch validator/handler shape.
- Do NOT re-run to fill in business logic; that's manual.
