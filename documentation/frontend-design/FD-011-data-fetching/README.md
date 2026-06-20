# DS-028 Data Fetching Patterns

How data flows between server and client in the Next.js App Router architecture.

## Server Components (RSC) — Default

Pages and layouts are server components by default. They fetch data directly via lib functions (Prisma queries, service calls) — no API round-trip.

```
app/(customer)/search/page.tsx  →  lib/trips/searchTrips.ts  →  Prisma
app/op/(console)/trips/page.tsx →  lib/trips/listOperatorTrips.ts → Prisma
```

**Critical rule**: server components MUST NOT self-fetch their own API routes. Extract shared logic into a `lib/` function and call it from both the route handler AND the server component. (See Mistake Log Issues 002, 003.)

## Client Components (`'use client'`)

Used only when interactivity requires it: forms, timers, modals, real-time updates, browser APIs.

Client components fetch via:
1. **Props from parent RSC** — server component fetches, passes as props (preferred)
2. **Client-side fetch** to `/api/*` — only when data changes after initial render (e.g., hold creation, booking initiation, payment status polling)

### Import Safety

Client components MUST deep-import client-safe modules:
- `@/lib/auth/csrfClient` — NOT `@/lib/auth` (barrel pulls server-only code)
- Never import domain barrels (`@/lib/booking`, `@/lib/payment`) from `'use client'` files

See [ADR-016 Module Boundaries](../../architecture-decisions/ADR-016-module-boundaries/) for the full rule.

## Streaming & Suspense

RSC pages stream progressively. Expensive data sections wrapped in `<Suspense>`:

```
<Suspense fallback={<DashboardStatsSkeleton />}>
  <DashboardStats operatorId={operatorId} />
</Suspense>
<Suspense fallback={<TripListSkeleton />}>
  <TodayTrips operatorId={operatorId} />
</Suspense>
```

Each `<Suspense>` boundary streams independently — fast sections render while slow ones load.

## Cache & Revalidation

- **Static pages** (home, privacy, terms): ISR with `revalidate = 3600` (1 hour)
- **Dynamic pages** (search, dashboard, bookings): `dynamic = 'force-dynamic'` — no caching, always fresh
- **API routes**: no response caching; each request hits DB

No client-side cache library (no React Query / SWR). Server components re-fetch on each navigation. Client components that poll (e.g., hold status) use `setInterval` with cleanup.

## Server Actions

Used sparingly for mutations that don't need a dedicated API route:
- Form submissions where the response is a redirect (not JSON)
- Progressive enhancement patterns

Most mutations go through `/api/*` routes with CSRF protection. Server actions are NOT the primary mutation path.

## Auth Context in Data Fetching

- **Server components**: read `bb_access` cookie via `cookies()`, verify JWT, extract `operatorId` / `customerId`
- **Client components**: include `bb_csrf` cookie token as `X-CSRF-Token` header on POST/PUT/DELETE
- **Operator scope**: every operator query filters by `operatorId` from JWT — never trusts client-sent operator ID

See [ADR-003 Auth Architecture](../../architecture-decisions/ADR-003-auth-architecture/) and [ADR-004 Multi-Tenancy](../../architecture-decisions/ADR-004-multi-tenancy/).

## Related

- [FD-010 Error & Loading States](../FD-010-error-loading-states/) — Suspense fallbacks, error boundaries
- [FD-004 Form Design](../FD-004-form-design/) — CSRF token handling on form submissions
- [FD-009 State Management](../FD-009-state-management/) — server state vs client state boundaries
- [DS-003 API Contract](../../design-specifications/DS-003-api-contract/) — endpoint catalog
