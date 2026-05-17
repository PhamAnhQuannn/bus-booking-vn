---
name: coverage-map
description: Identifies untested API entrypoints (route handlers, server actions) and page components in the codebase, ranked by role-based business criticality (P1–P7). Feeds untested paths directly into /tdd. Use when the user asks "what's untested", "where are the coverage gaps", or before a launch readiness review.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 3h
---

# /coverage-map — Test Coverage Gap Prioritizer

## Why you'd care

The untested route that takes payment webhooks is the one that silently double-charges customers the week after the next refactor — and the post-mortem will note that nobody knew it had no tests. Ranking gaps by role-based criticality before launch is what turns "we have 60% coverage" into "the money paths and auth writes are covered, the marketing pages aren't, and we're fine with that".

Invoke as `/coverage-map`. Identifies untested API entrypoints, server actions, and page components, ranked by role-based business criticality. Feeds directly into `/tdd`.

Stack worked here: Next.js + Prisma + vitest + Playwright. Adapt globs and frameworks for your stack — run `/stack-profile` if uncertain.

---

## Pre-flight

1. Glob API entrypoints. Worked example for Next.js: `app/api/**/route.ts` (exclude `__tests__/`, `*.test.ts`). Other stacks: FastAPI `app/routers/*.py`, Express `src/routes/**/*.ts`, Rails `app/controllers/**/*.rb`, Go `internal/http/**/*.go`.
2. Glob server actions / RPC handlers: `**/*.ts` files containing the directive `'use server'`, or the stack's equivalent (tRPC routers, gRPC handlers, GraphQL resolvers).
3. Glob page components: `app/**/page.tsx` (Next.js App Router) or your stack's view layer.
4. Glob test files:
   - Unit/integration: `**/*.test.ts`, `**/*.test.tsx`, `**/__tests__/**/*.{test,spec}.{ts,tsx}` — or `tests/**/test_*.py`, `*_test.go`, `spec/**/*_spec.rb`
   - E2E: `e2e/**/*.spec.ts`, `tests/e2e/**/*.spec.ts` (Playwright/Cypress)
5. **Detect business domains.** List immediate subdirs of `app/api/`, `src/routes/`, `src/modules/`, or `services/` — the names returned drive the P3/P4 split below.
6. Read `CLAUDE.md` Mistake Log (if present) — any path that appears there is auto-elevated to P1

---

## Coverage Logic

### API entrypoints

For each handler file, look for:
- A sibling test file (`route.test.ts`, `__tests__/route.test.ts`, `test_<name>.py`, `<name>_test.go`)
- A test file referencing the same path string (`'/api/...'`)

### Server actions / RPC handlers

For each action / handler file, look for a co-located test that imports and invokes the handler.

### Page components

For each page file, look for:
- A co-located unit test (`page.test.tsx` or `__tests__/page.test.tsx`)
- An E2E spec that navigates to that page's route (match `page.goto('/<route>')`)

### Money-handling path priority

Any handler that touches `priceCents`, `amount`, `currency`, a payment processor SDK (`stripe`, `@stripe/*`, `braintree`, `adyen`, `paypal`, `square`, `razorpay`), ledger entries, or balance fields gets **P1 weight regardless of role-based rank**. A read-only `/api/balance` endpoint is P1, not P5. An admin `/api/admin/refunds` is P1, not P6.

Auto-detect via import-graph traversal: any file that transitively imports a payment processor SDK or the ledger module (`lib/ledger`, `services/ledger`, `db/ledger`) is money-tainted. Walk imports recursively — a handler that calls `lib/billing.ts` which imports `stripe` is P1.

Token-grep fallbacks when import-graph is unavailable: `/priceCents|amountCents|currency|stripe\.|charge\(|refund\(|payout|ledger|balance/i` over the handler file and its first-degree imports.

Multi-vertical examples:
- restaurant: `/api/orders/[id]/tip` → touches `amountCents` → P1
- fintech: `/api/accounts/[id]/balance` GET → reads ledger → P1
- marketplace: `/api/payouts/release` → Stripe Connect → P1
- SaaS: `/api/billing/subscription` → Stripe SDK → P1

### WebSocket / realtime handlers

Treat the following as **first-class entry points with the same weight as HTTP routes** — they accept untrusted input and mutate state just like a POST handler:

- WebSocket message handlers — detect: `socket.on(`, `ws.on(`, `io.on('connection'`, `socket.on('message'`, `@WebSocketGateway` (NestJS), `useWebSocketHandler`
- Server-Sent Event endpoints — detect: `new EventSource(`, `Content-Type: text/event-stream`, `ReadableStream` returned from a route that streams `data:` frames
- Temporal Workflow / Activity handlers — detect: `@temporal/worker`, `@temporal/workflow`, `defineSignal`, `defineQuery`, `proxyActivities`, files under `workflows/`, `activities/`

Rank these by the same role table: a Temporal workflow that calls a payment processor is P1; a chat-message WebSocket handler is P3 (primary user-action) for a chat app, P4 for a SaaS with chat as a side feature.

Multi-vertical examples:
- fintech: `workflows/disburseFunds.ts` (Temporal) → P1
- marketplace: `socket.on('bid:place')` → P3
- SaaS: `ws.on('cursor:move')` (presence) → P5
- restaurant: SSE `/api/orders/stream` (kitchen display) → P3

### E2E-scenario to route mapping table

After globbing `tests/e2e/**/*.spec.ts` (or `e2e/**/*.spec.ts`, `cypress/e2e/**/*.cy.ts`), emit a table mapping each scenario to the routes it exercises. Two detection methods:

1. **Static parse** — grep each spec for `page.goto('<route>')`, `page.goto(\`<route>\`)`, `request.post('<route>')`, `request.get('<route>')`, `cy.visit(`, `cy.request(`. Collect all literal route strings per spec.
2. **Playwright route recording** — if the spec uses `page.route('**/api/**', ...)` or a recorded HAR is checked in, parse those for actual network calls.

Emit:

```
E2E COVERAGE MAP
────────────────
| Scenario                              | Routes exercised                                   |
|---------------------------------------|----------------------------------------------------|
| tests/e2e/checkout.spec.ts            | /cart, /checkout, POST /api/orders, /order/[id]    |
| tests/e2e/login.spec.ts               | /login, POST /api/auth/login, /dashboard           |
| tests/e2e/admin-refund.spec.ts        | /admin/orders, POST /api/admin/refunds             |

UNTESTED ROUTES (no E2E scenario covers them):
  [P1] POST /api/payouts/release
  [P2] POST /api/auth/reset-password
  [P3] POST /api/listings
```

Untested-routes = the set difference: `(all route-handler paths) − (union of routes exercised across all E2E specs)`. Cross-reference with the unit/integration coverage above — a route with unit tests but no E2E still appears here, flagged `UNIT-ONLY`.

Multi-vertical examples:
- restaurant: `tests/e2e/place-order.spec.ts` → `/menu, POST /api/orders, /order/[id]/status`
- fintech: `tests/e2e/transfer.spec.ts` → `/transfers/new, POST /api/transfers, /transfers/[id]`
- marketplace: `tests/e2e/list-and-buy.spec.ts` → `/sell, POST /api/listings, /listing/[id], POST /api/orders`

---

## Role-based Criticality Ranking

Rank untested paths by role of the endpoint, not by domain name (P1 = highest risk):

| Rank | Role | Examples (your project will differ) |
|---|---|---|
| **P1** | **Money-handling endpoints** — payment webhooks, charge/refund endpoints, payout endpoints | `app/api/webhooks/stripe/route.ts`, `/api/transfers/initiate`, `/api/payouts/release` |
| **P2** | **Auth & session writes** — login, register, password reset, token refresh, session revoke | `/api/auth/login`, `/api/auth/register`, `/api/auth/reset-password` |
| **P3** | **Primary user-action endpoints** — the top 1–2 detected business domains' write paths | restaurant: `/api/orders` POST; fintech: `/api/transfers` POST; marketplace: `/api/listings` POST; SaaS: `/api/workspaces/invite` |
| **P4** | **Secondary user-action endpoints** — remaining detected business domains' writes | restaurant: `/api/reservations` POST; fintech: `/api/cards` POST; marketplace: `/api/messages` POST |
| **P5** | **Read-only / list endpoints** | search, filter, listing-by-id, public catalog |
| **P6** | **Admin endpoints** — back-office, dashboards, staff mgmt, reports | `app/api/admin/**`, internal portals |
| **P7** | **Internal / cron / marketing pages** — scheduled jobs, static pages, low-traffic surfaces | `app/(marketing)/**`, `/api/cron/*` |

Assign rank by reading the endpoint's role, not by name-matching its directory. A list endpoint inside `app/api/orders/` is P5, not P3.

---

## Output Format

```
COVERAGE MAP
────────────
Scanned: N API entrypoints, N server actions, N page components, N test files
Detected business domains: <A>, <B>, ...

UNTESTED — API entrypoints (ordered by criticality):
  [P1] <money-handling endpoint path> — NO TESTS
       Next: /tdd "<HTTP-verb> <path> <expected behavior>"
  [P2] <auth endpoint path> — NO TESTS
       Next: /tdd "<HTTP-verb> <path> rejects <bad-input>"
  [P3] <primary-domain write endpoint> — PARTIAL (happy path only, missing <conflict/validation> test)
       Next: /tdd "<HTTP-verb> <path> <error-case>"
  [P4] <secondary-domain write endpoint> — NO TESTS
  [P5] <list endpoint> — NO TESTS

UNTESTED — Server actions (ordered by criticality):
  [P3] <action file path> — NO TESTS (<action name>)
       Next: /tdd "<action name> <invariant>"

UNTESTED — Page components (ordered by criticality):
  [P3] <primary user page> — NO TESTS
       No E2E spec covers <flow name>
  [P7] <marketing page> — NO TESTS

TESTED — already covered:
  <endpoint path> ✓ (unit + integration)
  <page path> ✓ (E2E)

SUMMARY:
  API entrypoints: N/M have tests (N%)
  Server actions: N/M have tests (N%)
  Pages: N/M have tests (N%)

TOP 3 GAPS TO ADDRESS:
  1. /tdd "<P1 endpoint>"
  2. /tdd "<P2 endpoint>"
  3. /tdd "<P3 action>"
```

---

## Integration

- **Discovery**: run pre-sprint or after a large merge
- **Feeds `/tdd`**: each untested path becomes a `/tdd <endpoint or page>` task
- **Mistake Log cross-reference**: any untested path that appears in `CLAUDE.md` Mistake Log is auto-elevated to P1
