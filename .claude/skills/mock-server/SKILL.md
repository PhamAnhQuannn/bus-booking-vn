---
name: mock-server
description: Stack-aware mock layer for external APIs and own backend. MSW for JS, responses/respx for Python, httpmock for Go. Reads `docs/design/api-contract.md` to seed handlers. Skip-when no external API consumer. Use when user says "mock api", "MSW setup", "stub external calls", "/mock-server", or before writing tests that hit a third-party API.
---

# /mock-server — Mock Layer Wire-up

## Why you'd care

Tests that hit live third-party APIs are flaky, slow, and rate-limited — and they fail at the worst moment, mid-deploy. A stack-aware mock layer is the difference between a green CI and a 4 p.m. fire drill.

Invoke as `/mock-server`. Sets up a mock layer so tests, dev, and demos run without hitting real upstreams.

---

## Pre-flight

1. Read `docs/stack/profile.md`. If `external_apis` list empty AND `frontend = none` → halt: "nothing to mock".
2. Detect existing mock setup:
   - JS: scan for `msw`, `nock` in `package.json`.
   - Python: scan for `responses`, `respx`, `pytest-httpx`.
   - Go: scan for `httpmock`, `httptest`.
3. If contract present (`docs/design/api-contract.md` or `openapi.yaml`) → seed handlers from it; else emit empty stub + TODO.
4. If mock layer already wired → halt with note: "mock present; re-run with `--add <api>` to extend".

---

## Inputs

- API contract (path resolved in pre-flight)
- Stack profile (Frontend, Backend, Test runner, External APIs list)
- Optional `--add <api-name>` adds handlers for one upstream only
- Optional `--browser-only` skips Node setup (and vice versa via `--node-only`)

---

## Stack branch

| Stack          | Lib            | Files                                            |
|----------------|----------------|--------------------------------------------------|
| Next.js / Vite | MSW            | `mocks/handlers.ts` + `mocks/browser.ts` + `mocks/node.ts` |
| FastAPI tests  | respx / responses | `tests/conftest.py` + `tests/mocks/<api>.py` |
| Go tests       | httpmock       | `internal/<api>/mock.go`                         |
| Storybook      | MSW (Storybook addon) | `.storybook/preview.ts` registers worker  |

---

## Coverage matrix

| Surface              | Mock target                                          |
|----------------------|------------------------------------------------------|
| Dev (browser)        | MSW service worker — request-time intercept           |
| Test (Vitest/Jest)   | MSW Node server                                       |
| Test (pytest)        | respx (httpx) / responses (requests)                  |
| Test (Go)            | httpmock attached to http.DefaultTransport            |
| Storybook            | MSW addon — per-story handler overrides               |
| E2E (Playwright)     | `route.fulfill` per network call — optional add-on    |

---

## Workflow

1. Install lib (single dep).
2. Emit handlers seeded from contract:
   - Per endpoint → one handler returning a representative response.
   - Per error case in contract → one error handler under `mocks/errors/<api>.ts` (opt-in per test).
3. Emit browser worker bootstrap (`mocks/browser.ts`) + Node server (`mocks/node.ts`).
4. Wire into entry points:
   - Next.js: dynamic import in `app/layout.tsx` gated on `process.env.NEXT_PUBLIC_MOCKS === 'on'`.
   - Vitest setup file: `server.listen()` in `setup.ts`, `server.close()` in `afterAll`.
5. Add `pnpm msw init public/` to install service worker file (run via Bash, idempotent).
6. Emit `.env.example` keys: `NEXT_PUBLIC_MOCKS=off`, `MOCKS_PASSTHROUGH=<comma-list>`.
7. Smoke: run one test that asserts mock hits real handler.

---

## File templates (MSW + Next.js)

`mocks/handlers.ts`:

```ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  // TODO(mock-server): seed from api-contract
  http.get('/api/health', () => HttpResponse.json({ ok: true })),
  http.post('/api/orders', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: 'mock_order_1', ...(body as object) }, { status: 201 });
  }),
];
```

`mocks/browser.ts`:

```ts
import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';
export const worker = setupWorker(...handlers);
```

`mocks/node.ts`:

```ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';
export const server = setupServer(...handlers);
```

`vitest.setup.ts`:

```ts
import { server } from './mocks/node';
import { beforeAll, afterEach, afterAll } from 'vitest';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

Bootstrap in `app/layout.tsx` (or `_app.tsx`):

```ts
if (process.env.NEXT_PUBLIC_MOCKS === 'on' && typeof window !== 'undefined') {
  import('@/mocks/browser').then(({ worker }) => worker.start({ onUnhandledRequest: 'bypass' }));
}
```

---

### Python (respx for httpx)

Third vertical alongside MSW. FastAPI service calling a SaaS CRM over `httpx`.

`tests/conftest.py`:

```python
import pytest, respx, httpx

@pytest.fixture
def crm_mock():
    with respx.mock(base_url="https://api.crm.test", assert_all_called=False) as r:
        r.get("/v1/contacts/42").mock(return_value=httpx.Response(200, json={"id": 42, "email": "a@b.co"}))
        r.post("/v1/contacts").mock(return_value=httpx.Response(201, json={"id": 99}))
        yield r
```

`tests/test_contacts.py` (async, `pytest-asyncio`):

```python
@pytest.mark.asyncio
async def test_fetch_contact(crm_mock):
    contact = await fetch_contact(42)
    assert contact.email == "a@b.co"
    assert crm_mock.calls.call_count == 1
    assert crm_mock.calls[0].request.headers["authorization"].startswith("Bearer ")
```

Assertion API: `mock.calls`, `mock.calls.call_count`, `route.called`, `route.call_count`. `assert_all_called=True` fails if any route unused.

---

### Go (httpmock)

Marketplace listing service calling an inventory upstream.

`internal/inventory/mock_test.go`:

```go
func TestListing_parallel(t *testing.T) {
  t.Parallel()
  client := &http.Client{}
  httpmock.ActivateNonDefault(client) // scoped to this client, not DefaultTransport
  defer httpmock.DeactivateAndReset()

  httpmock.RegisterResponder("GET", "https://api.inv.test/items/sku-1",
    httpmock.NewJsonResponderOrPanic(200, map[string]any{"sku": "sku-1", "qty": 7}))

  httpmock.RegisterResponderWithQuery("GET", "https://api.inv.test/items/sku-1",
    "region=eu", httpmock.NewJsonResponderOrPanic(200, map[string]any{"sku": "sku-1", "qty": 0}))

  item, _ := New(client).Get("sku-1", "")
  if item.Qty != 7 { t.Fatalf("want 7 got %d", item.Qty) }
  if httpmock.GetCallCountInfo()["GET https://api.inv.test/items/sku-1"] != 1 {
    t.Fatal("call count")
  }
}
```

`ActivateNonDefault(client)` scopes mocks to one `*http.Client` so parallel tests do not stomp the global default transport. Pair with `defer httpmock.DeactivateAndReset()`.

---

### Dynamic test-time endpoint registration

Edge-case route only one suite uses (e.g. payment processor refund 409). Register at runtime, clean up in teardown.

```ts
// MSW: afterEach in vitest.setup.ts calls server.resetHandlers()
server.use(http.post('https://api.pay.test/v1/refunds',
  () => HttpResponse.json({ code: 'already_refunded' }, { status: 409 })));
```

```python
# respx: routes auto-clear when fixture context exits
pay_mock.post("/v1/refunds").mock(return_value=httpx.Response(409, json={"code": "already_refunded"}))
```

```go
httpmock.RegisterResponder("POST", "https://api.pay.test/v1/refunds",
  httpmock.NewJsonResponderOrPanic(409, map[string]string{"code": "already_refunded"}))
t.Cleanup(httpmock.Reset) // clear responders, keep transport active
```

Rule: shared fixture = happy path. Test-time `use` / `register` = edge cases, scoped to one `it` / `test`.

---

### Stateful mocks across suites

Counter-based responder for retry / idempotency. Payment processor returns `503` once, then `200`.

```ts
let calls = 0;
server.use(http.post('https://api.pay.test/v1/charges', () => {
  calls += 1;
  return calls === 1
    ? HttpResponse.json({ err: 'upstream' }, { status: 503 })
    : HttpResponse.json({ id: 'ch_1', status: 'succeeded' });
}));
afterEach(() => { calls = 0; }); // per-test reset hook
```

```python
pay_mock.post("/v1/charges").mock(side_effect=[
    httpx.Response(503, json={"err": "upstream"}),
    httpx.Response(200, json={"id": "ch_1"}),
])
```

```go
httpmock.RegisterResponder("POST", "https://api.pay.test/v1/charges",
  httpmock.ResponderFromMultipleResponses([]*http.Response{
    httpmock.NewJsonResponseOrPanic(503, map[string]string{"err": "upstream"}),
    httpmock.NewJsonResponseOrPanic(200, map[string]string{"id": "ch_1"}),
  }))
```

Isolation: keep counters in closure / fixture scope. Never on package-level vars — parallel `t.Parallel()` and Vitest workers will bleed. Per-client `ActivateNonDefault(client)` isolates Go suites; respx fixture context auto-resets per test.

---

### Playwright route.fulfill variant

E2E browser flows: pick Playwright `route.fulfill` (CDP intercept) or MSW in the page (service worker).

```ts
await page.route('https://api.crm.test/v1/contacts/42', route =>
  route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ id: 42, email: 'a@b.co' }) }));
```

Trade-offs:

- `route.fulfill` — no SW plumbing, intercepts any origin incl. cross-origin XHR/fetch, per-test setup. Cost: handlers duplicated from MSW, no Storybook reuse, cannot touch WebSocket / SSE.
- MSW in browser — one handler set shared with Vitest, Storybook, dev. Cost: needs `mockServiceWorker.js` on app origin, will NOT intercept third-party origins unless proxied, slower boot.
- Pick `route.fulfill` for third-party-origin assertions (Stripe.js iframe, Auth0 redirect). Pick MSW-in-browser when the contract surface matches unit tests.

---

## Output

Side-effect = mock module + setup wiring. After run, print:

```
Mock layer: <lib>. Handlers seeded: <N> from <contract>. Files: <list>.
Next: `NEXT_PUBLIC_MOCKS=on pnpm dev` to run app against mocks; or `pnpm test` to run suite.
```

---

## When to re-run

- New external API added → `--add <api>`.
- Contract regenerated → re-run to re-seed handlers.
- Do NOT hand-edit handler responses without leaving a TODO marker; re-runs may overwrite.
