---
name: logging-instrument
description: Wire a structured logger (pino/winston for JS, structlog for Python, zap/slog for Go) at request entry, auth, and error paths. Adds request-id middleware + child-logger pattern. Stack-branched via `/stack-profile`. Use when user says "add logging", "structured logs", "request id", "logger setup", "/logging-instrument", or before first deploy.
---

# /logging-instrument — Structured Logging Wire-up

## Why you'd care

Without structured logs + request-ids, every production debug session is grep-by-hope across freeform strings — you can't correlate the user's session to the upstream error. Wiring it in before first deploy is the only cheap moment to do it.

Invoke as `/logging-instrument`. Replaces `console.log` / `print` with a structured logger, threads a request-id through every log line, and wires log emission at the three points that matter: request entry, auth decision, error path.

---

## Pre-flight

1. Read `docs/stack/profile.md`. Missing → run `/stack-profile`, halt.
2. Detect existing logger:
   - JS: grep for `pino`, `winston`, `bunyan` in `package.json`.
   - Python: grep `structlog`, `loguru` in `pyproject.toml` / `requirements*.txt`.
   - Go: grep `zap`, `zerolog`, `slog` import in `go.mod`.
3. If logger already wired AND `lib/logger.*` exists AND request-id middleware present → halt with note: "logger present; re-run with `--reinstrument` to add missing call-sites only".
4. If profile = `cli-only` and no long-running process → emit minimal logger only (no middleware).

---

## Inputs

- Stack profile (Backend, Language, Frontend)
- Optional `--provider <pino|winston|structlog|zap|slog>` overrides default
- Optional `--reinstrument` keeps lib/logger, adds missing call-sites

---

## Logger pick per stack

| Stack            | Default lib | Why                                                    |
|------------------|-------------|--------------------------------------------------------|
| Next.js / Node   | `pino`      | Fastest, structured-first, ndjson out-of-box           |
| Express / Fastify| `pino`      | Same                                                   |
| FastAPI          | `structlog` | Async-safe, context-vars for request scope             |
| Django           | `structlog` | Same                                                   |
| Go (1.21+)       | `slog`      | Stdlib, no dep                                         |
| Go (< 1.21)      | `zap`       | Best perf in older Go                                   |
| Browser          | thin wrapper → ship to backend `/api/log` | No prod console.* |

---

## Log shape (all stacks emit identical keys)

```json
{
  "ts": "2026-05-10T12:34:56.789Z",
  "level": "info",
  "msg": "request_handled",
  "traceId": "01HXY...",
  "userId": "u_123",
  "method": "POST",
  "path": "/api/orders",
  "status": 200,
  "durationMs": 42
}
```

Rules:
- `traceId` always present. Generated at edge, propagated via `x-request-id` header.
- `userId` only after auth gate; null otherwise.
- No PII in log fields beyond `userId` (numeric/opaque id). Redact emails, IPs (if regulated), tokens.

---

## Workflow

1. Install logger dep (single package add).
2. Emit `lib/logger.<ext>` singleton + child-factory.
3. Emit request-id middleware.
4. Wire at three call-sites:
   - **Entry**: `log.info({...meta}, 'request_in')` at handler top
   - **Auth**: `log.info({userId}, 'authenticated')` after session check
   - **Error**: `log.error({err}, 'request_failed')` in catch
5. Add redaction config (token / authorization / cookie / password keys).
6. Add `NODE_ENV=production` → JSON output; dev → pretty.
7. Smoke: start dev server, hit one route, confirm `traceId` echoes in log line and response header.

---

## File templates

### Next.js / Node (pino)

`lib/logger.ts`:

```ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.token'],
    censor: '[REDACTED]',
  },
  ...(process.env.NODE_ENV !== 'production' ? { transport: { target: 'pino-pretty' } } : {}),
});

export function childLog(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}
```

`middleware.ts` (Next.js edge):

```ts
import { NextResponse, type NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const traceId = req.headers.get('x-request-id') ?? crypto.randomUUID();
  const res = NextResponse.next();
  res.headers.set('x-request-id', traceId);
  return res;
}
```

### FastAPI (structlog)

`app/logger.py`:

```python
import logging, structlog, uuid
from contextvars import ContextVar
from fastapi import Request

trace_id_var: ContextVar[str] = ContextVar("trace_id", default="-")

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.add_log_level,
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
)
log = structlog.get_logger()


async def trace_id_middleware(req: Request, call_next):
    tid = req.headers.get("x-request-id") or uuid.uuid4().hex
    trace_id_var.set(tid)
    structlog.contextvars.bind_contextvars(traceId=tid, path=req.url.path, method=req.method)
    resp = await call_next(req)
    resp.headers["x-request-id"] = tid
    return resp
```

Wire in `main.py`: `app.middleware("http")(trace_id_middleware)`.

### Go (slog)

`internal/httpx/logger.go`:

```go
package httpx

import (
  "context"
  "log/slog"
  "net/http"
  "os"

  "github.com/google/uuid"
)

type ctxKey string

const traceKey ctxKey = "traceId"

var Log = slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))

func RequestID(next http.Handler) http.Handler {
  return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    tid := r.Header.Get("X-Request-Id")
    if tid == "" {
      tid = uuid.NewString()
    }
    w.Header().Set("X-Request-Id", tid)
    ctx := context.WithValue(r.Context(), traceKey, tid)
    next.ServeHTTP(w, r.WithContext(ctx))
  })
}

func FromCtx(ctx context.Context) *slog.Logger {
  if tid, ok := ctx.Value(traceKey).(string); ok {
    return Log.With("traceId", tid)
  }
  return Log
}
```

### Browser shim

`lib/log-client.ts`:

```ts
type Lvl = 'info' | 'warn' | 'error';
export function logClient(level: Lvl, msg: string, meta?: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'development') console[level](msg, meta);
  navigator.sendBeacon?.('/api/log', JSON.stringify({ level, msg, meta, ts: Date.now() }));
}
```

---

## Advanced context wiring

### OTel correlation auto-wire

Every record auto-includes `trace_id`, `span_id` from active OTel context. No manual binding.

Pino + OTel (`lib/logger.ts`):

```ts
import pino from 'pino';
import { trace, context } from '@opentelemetry/api';

export const logger = pino({
  mixin() {
    const span = trace.getSpan(context.active());
    if (!span) return {};
    const { traceId, spanId } = span.spanContext();
    return { trace_id: traceId, span_id: spanId };
  },
});
```

Structlog + OTel (`app/logger.py`):

```python
from opentelemetry import trace

def otel_processor(_, __, ev):
    span = trace.get_current_span()
    ctx = span.get_span_context()
    if ctx.is_valid:
        ev["trace_id"] = format(ctx.trace_id, "032x")
        ev["span_id"] = format(ctx.span_id, "016x")
    return ev

structlog.configure(processors=[otel_processor, ...])
```

Tracer setup itself → `/otel-wire`. This skill assumes a tracer already exists.

### Temporal Worker async-context propagation

Each Workflow / Activity execution gets a logger pre-bound with `workflow_id`, `activity_id`, `run_id`. Pull from Temporal `Context`.

TS Activity wrapper (`workers/log.ts`):

```ts
import { Context } from '@temporalio/activity';
import { logger } from '../lib/logger';

export function activityLog() {
  const info = Context.current().info;
  return logger.child({
    workflow_id: info.workflowExecution.workflowId,
    run_id: info.workflowExecution.runId,
    activity_id: info.activityId,
    activity_type: info.activityType,
  });
}
```

Workflow side (`workers/wf-log.ts`):

```ts
import { workflowInfo } from '@temporalio/workflow';
import { logger } from '../lib/logger';

export function workflowLog() {
  const i = workflowInfo();
  return logger.child({ workflow_id: i.workflowId, run_id: i.runId, workflow_type: i.workflowType });
}
```

Python Activity (`workers/log.py`):

```python
from temporalio import activity
from app.logger import log

def activity_log():
    info = activity.info()
    return log.bind(
        workflow_id=info.workflow_id,
        run_id=info.workflow_run_id,
        activity_id=info.activity_id,
        activity_type=info.activity_type,
    )
```

Call `activityLog()` once at activity top; pass the child down.

### Next.js AsyncLocalStorage integration

Request-scoped context (user ID, request ID, route) bound to every log via `AsyncLocalStorage`. No manual passing across server components / actions.

`lib/log-context.ts`:

```ts
import { AsyncLocalStorage } from 'node:async_hooks';
import { logger } from './logger';

type Ctx = { trace_id: string; user_id?: string; route?: string };
export const logCtx = new AsyncLocalStorage<Ctx>();

export function log() {
  const c = logCtx.getStore();
  return c ? logger.child(c) : logger;
}
```

`middleware.ts` (node runtime — set `export const runtime = 'nodejs'` on routes that need ALS):

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { logCtx } from './lib/log-context';

export function middleware(req: NextRequest) {
  const trace_id = req.headers.get('x-request-id') ?? crypto.randomUUID();
  const res = NextResponse.next();
  res.headers.set('x-request-id', trace_id);
  // edge runtime: ALS unavailable. Propagate via header; re-bind in route handler.
  return res;
}
```

Server-action wrapper (`lib/with-log.ts`):

```ts
import { headers } from 'next/headers';
import { logCtx } from './log-context';

export function withLog<A extends unknown[], R>(fn: (...a: A) => Promise<R>) {
  return async (...args: A) => {
    const h = await headers();
    return logCtx.run(
      { trace_id: h.get('x-request-id') ?? crypto.randomUUID(), route: h.get('x-invoke-path') ?? '?' },
      () => fn(...args),
    );
  };
}
```

Edge quirk: `AsyncLocalStorage` is partial on Vercel Edge / Cloudflare Workers. Fallback → pass `trace_id` via header + re-bind a child logger at handler entry rather than relying on ALS.

### Per-domain logger factory

Pattern `getLogger('auth')`, `getLogger('payment')` returns child with `domain` pre-bound. Kills `logger.info({ domain: 'auth', ... })` boilerplate at every call site.

TS (`lib/logger.ts` addition):

```ts
const registry = new Map<string, ReturnType<typeof logger.child>>();
export function getLogger(domain: string) {
  let l = registry.get(domain);
  if (!l) { l = logger.child({ domain }); registry.set(domain, l); }
  return l;
}
```

Python (`app/logger.py` addition):

```python
_registry: dict[str, object] = {}
def get_logger(domain: str):
    if domain not in _registry:
        _registry[domain] = log.bind(domain=domain)
    return _registry[domain]
```

Go (`internal/httpx/logger.go` addition):

```go
func GetLogger(domain string) *slog.Logger { return Log.With("domain", domain) }
```

Usage: `const log = getLogger('payment');` at module top → all emissions tagged.

---

## Call-site injection (--reinstrument)

For each handler file in stack:

1. Insert at top: `const log = childLog({ traceId, method, path });` (or `FromCtx(r.Context())` in Go).
2. After auth: `log.info({ userId: session.user.id }, 'authenticated');`
3. In catch: `log.error({ err }, 'request_failed');`

Skip files that already have one of these lines.

---

## Output

Side-effect = logger files + middleware + inserted call-sites. After run, print:

```
Logger: <provider>. Files written: <list>. Call-sites injected: <N>. Skipped: <N>.
Next: /observability-design to wire alerts on the new log shape.
```

---

## When to re-run

- Adding a new long-running surface (worker, cron, websocket).
- Switching logger provider (`--provider`).
- Re-instrument after big refactor (`--reinstrument`).
- Do NOT re-run blind — diff lib/logger first.
