---
name: error-boundary-wire
description: Framework-aware crash UI + server panic recover wire-up. Emits Next.js `error.tsx`/`global-error.tsx`/`not-found.tsx`, React `<ErrorBoundary>`, Vue `<Suspense>` fallback, or server panic-recover middleware. Stack-branched via `/stack-profile`. Skip-when CLI/headless. Use when user says "error boundary", "crash UI", "panic recover", "/error-boundary-wire", or before first prod deploy.
output_size:
  XS: 10m
  S: 15m
  M: 30m
  L: 30m
  XL: 30m
---

# /error-boundary-wire — Crash Surface Wire-up

## Why you'd care

The unhandled render exception on the checkout page blanks the screen for the user mid-flow — and instead of a "something went wrong, retry?" component they see a white page that costs the cart and the customer's trust. Wiring the framework's first-class error surfaces (Next.js `error.tsx`, React boundaries, server panic recover) before first prod deploy is what turns a render bug from a session-ending outage into a single component falling back gracefully, and the Sentry-style telemetry hook in the same wire-up is what makes the bug fixable in the next deploy.

Invoke as `/error-boundary-wire`. Wires the framework's first-class error surfaces so a thrown render or a panicked handler does not blank the screen or crash the process.

---

## Pre-flight

1. Read `docs/stack/profile.md`. Missing → run `/stack-profile`, halt.
2. If Frontend = `none` AND Backend = `cli` → halt: "no surface to wire".
3. Detect existing boundaries:
   - Next.js: scan `app/**/error.tsx`, `app/global-error.tsx`, `app/**/not-found.tsx`.
   - React (Vite/CRA): scan for `class ErrorBoundary` or `react-error-boundary` import.
   - Vue: scan for `errorCaptured` hook / `<Suspense>`.
   - Go: scan handlers for `defer recover()`.
   - FastAPI / Express: scan for global error middleware.
4. If full coverage detected → halt with note: "boundaries present; re-run with `--force` to overwrite".

---

## Inputs

- Stack profile (Frontend, Backend, Logger)
- Optional `--force` overwrites existing boundary files
- Optional `--with-fallback-page` emits a styled fallback (not just text)

---

## Coverage matrix

| Layer        | Surface                              | Wired to                                  |
|--------------|--------------------------------------|-------------------------------------------|
| Route-level  | Next.js `app/error.tsx`              | Per-segment crash UI                       |
| Root-level   | Next.js `app/global-error.tsx`       | Root layout crash (catches root errors)    |
| 404          | Next.js `app/not-found.tsx`          | Unmatched routes                           |
| React tree   | `<ErrorBoundary>` HOC                | Wraps `<App />` or per-feature             |
| Vue          | `<Suspense>` + `onErrorCaptured`     | Wraps router-view                          |
| Server (Go)  | `recover` middleware                 | Wraps chi/echo router                      |
| Server (Py)  | FastAPI `exception_handler(Exception)` | Catches uncaught                         |
| Server (Node)| Express `app.use((err,req,res,n)=>)`  | Final middleware                          |
| Unhandled    | `process.on('unhandledRejection')`    | Logs + structured exit                    |

---

## Stack branch

### Next.js (App Router)

Emit `app/error.tsx`:

```tsx
'use client';
import { useEffect } from 'react';
import { logger } from '@/lib/logger';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    logger.error({ err: error, digest: error.digest }, 'route_error');
  }, [error]);
  return (
    <div role="alert" style={{ padding: 24 }}>
      <h2>Something broke.</h2>
      <p>Reference: {error.digest ?? 'n/a'}</p>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
```

Emit `app/global-error.tsx` (must include `<html>` + `<body>`):

```tsx
'use client';
export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <html>
      <body>
        <h2>Application crashed.</h2>
        <button onClick={reset}>Retry</button>
      </body>
    </html>
  );
}
```

Emit `app/not-found.tsx`:

```tsx
export default function NotFound() {
  return <div role="alert"><h2>Not found</h2></div>;
}
```

### React (non-Next.js)

Emit `src/components/ErrorBoundary.tsx`:

```tsx
import { Component, type ReactNode } from 'react';
import { logger } from '@/lib/logger';

export class ErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  componentDidCatch(err: Error, info: { componentStack: string }) {
    logger.error({ err, componentStack: info.componentStack }, 'react_error_boundary');
  }
  render() {
    if (this.state.err) return this.props.fallback ?? <div role="alert">Something broke.</div>;
    return this.props.children;
  }
}
```

Update `src/main.tsx` to wrap root.

### Vue 3 (Suspense + onErrorCaptured)

Emit `src/App.vue` — top-level Suspense + capture + retry:

```vue
<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue';
import { logger } from '@/lib/logger';
const err = ref<Error | null>(null), key = ref(0);
onErrorCaptured((e, _i, info) => {
  logger.error({ err: e, info }, 'vue_error_captured');
  err.value = e as Error; return false;
});
const retry = () => { err.value = null; key.value++; };
</script>
<template>
  <div v-if="err" role="alert">
    <h2>Something broke.</h2><button @click="retry">Try again</button>
  </div>
  <Suspense v-else :key="key">
    <RouterView />
    <template #fallback><p>Loading...</p></template>
  </Suspense>
</template>
```

### Go (chi)

Emit `internal/httpx/recover.go`:

```go
package httpx

import (
  "log/slog"
  "net/http"
  "runtime/debug"
)

func Recover(next http.Handler) http.Handler {
  return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    defer func() {
      if rec := recover(); rec != nil {
        slog.Error("panic", "err", rec, "stack", string(debug.Stack()), "path", r.URL.Path)
        http.Error(w, `{"error":"INTERNAL"}`, http.StatusInternalServerError)
      }
    }()
    next.ServeHTTP(w, r)
  })
}
```

Register before route mounts: `r.Use(httpx.Recover)`.

### FastAPI

Emit `app/errors.py`:

```python
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import logging

log = logging.getLogger(__name__)

def install(app: FastAPI) -> None:
    @app.exception_handler(Exception)
    async def _unhandled(req: Request, exc: Exception):
        log.exception("unhandled", extra={"path": req.url.path})
        return JSONResponse({"error": "INTERNAL"}, status_code=500)
```

Call `install(app)` in `main.py` after router mounts.

### Express

Emit `middleware/error.ts`:

```ts
import type { ErrorRequestHandler } from 'express';
import { logger } from '../lib/logger';

export const errorMiddleware: ErrorRequestHandler = (err, req, res, _next) => {
  logger.error({ err, path: req.path }, 'unhandled');
  res.status(500).json({ error: 'INTERNAL' });
};
```

Register LAST: `app.use(errorMiddleware)`.

---

## Process-level (Node / Python)

Emit `lib/process-guards.ts` (Node):

```ts
process.on('unhandledRejection', (reason) => {
  console.error('unhandledRejection', reason);
});
process.on('uncaughtException', (err) => {
  console.error('uncaughtException', err);
  process.exit(1);
});
```

Python: `sys.excepthook` override in `app/__main__.py`.

---

### Error-sink wiring (provider-agnostic)

Same hook on every boundary; only sink call swaps. Forward: user ID, route/path, timestamp, release, breadcrumbs, request ID.

| Layer    | Hook point                              | Forward                              |
|----------|-----------------------------------------|--------------------------------------|
| React    | `componentDidCatch(err, info)`          | err, componentStack, userId, route   |
| Vue 3    | `onErrorCaptured(err, inst, info)`      | err, info, userId, route             |
| Next.js  | `useEffect` in `error.tsx` (digest)     | err, digest, pathname                |
| FastAPI  | `@app.exception_handler(Exception)`     | exc, req.url.path, request_id, user  |
| Go       | `defer recover()` in middleware         | rec, debug.Stack(), path, user       |
| Express  | final `(err,req,res,next)`              | err, req.path, req.id, user          |

Provider swap = one file — `lib/error-sink.ts`:

```ts
// Sentry
import * as Sentry from '@sentry/browser';
export const report = (err: unknown, ctx: Record<string, unknown>) =>
  Sentry.captureException(err, { extra: ctx, tags: { route: ctx.route as string } });
// Bugsnag     — Bugsnag.notify(err, e => e.addMetadata('ctx', ctx))
// Honeybadger — Honeybadger.notify(err, { context: ctx })
// Homegrown   — fetch('/api/errors', { method:'POST', body: JSON.stringify({err:String(err), ctx}) })
```

Call `report(err, { userId, route, ts: Date.now(), breadcrumbs })` inside each hook. Boundary code never changes when provider swaps.

---

### Fallback-page UX template

Human, not stack trace. Components: calm illustration/icon (broken-link glyph, not red X); headline "Something went wrong." (never exception class); one-line hint ("we couldn't load this page", never `TypeError: undefined`); primary **Retry** CTA (calls `reset`/`retry()`); secondary "Report this" link w/ incident ID prefilled; tertiary support/status link; copyable incident ID (`error.digest` / Sentry event ID / request ID).

```
+--------------------------------------------------+
|                  [ icon ]                        |
|           Something went wrong.                  |
|     We couldn't load this page. Sorry.           |
|     [  Try again  ]   Report this issue          |
|     Incident: 7f3a-92bd  (copy)                  |
|     Status: status.example.com                   |
+--------------------------------------------------+
```

A11y: container `role="alert"`, headline `tabindex="-1"` + `.focus()` on mount. Cross-ref `/a11y-design` for focus-trap + announcement.

---

## Workflow

1. Detect stack + existing boundaries (pre-flight).
2. Print plan: list files to write + files to skip.
3. Emit per matrix.
4. Wire registration where framework requires (Express `app.use`, Go `r.Use`, FastAPI `install(app)`).
5. Smoke: typecheck/build the new files only.

---

## Output

Side-effect = boundary files. After emit, print:

```
Wired error boundaries: <list>. Skipped (existed): <list>.
Next: trigger a synthetic throw to verify boundary catches.
```

---

## When to re-run

- Adding a new route segment that needs its own boundary.
- Stack swap (re-detects in pre-flight).
- Do NOT re-run without `--force` if coverage already complete.
