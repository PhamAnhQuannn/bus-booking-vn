# DS-045 FD-028: Portal Architecture & RSC/Client Boundaries

## 1. Overview

The platform is a single Next.js application (App Router) serving three distinct portals via route groups. This spec defines the route structure, the decision framework for server vs. client components, the self-fetch prohibition, import safety rules, Suspense boundary placement, mutation patterns, and auth context propagation. These are mandatory architectural constraints --- violations are treated as bugs (see Mistake Log entries).

---

## 2. Route Group Structure

### 2.1 Top-Level Route Groups

| Route Group | URL Prefix | Purpose | Auth |
|-------------|-----------|---------|------|
| `app/(customer)/` | `/` (root) | Customer portal --- search, booking, payment, ticket | Public + auth-gated (booking history) |
| `app/op/` | `/op/` | Operator portal --- fleet, routes, trips, staff, finance | All auth-gated except `/op/login`, `/op/register` |
| `app/admin/` | `/admin/` | Admin portal --- operations, finance, compliance | All auth-gated, TOTP step-up required for finance |

### 2.2 Operator Console Sub-Group

```
app/op/
  |-- login/page.tsx              Public
  |-- register/page.tsx           Public
  |-- first-login/page.tsx        Password change gate
  |-- (console)/                  Auth-gated console layout
      |-- layout.tsx              Sidebar + header shell
      |-- dashboard/page.tsx
      |-- buses/page.tsx
      |-- routes/page.tsx
      |-- trips/page.tsx
      |-- trips/[id]/page.tsx
      |-- trips/new/page.tsx
      |-- bookings/page.tsx
      |-- bookings/[id]/page.tsx
      |-- manifest/[tripId]/page.tsx
      |-- money/page.tsx
      |-- reports/revenue/page.tsx
      |-- activity/page.tsx
      |-- settings/page.tsx
      |-- profile/page.tsx
      |-- staff/page.tsx
```

The `(console)` route group applies the console layout (sidebar nav, header with bell icon, breadcrumbs) to all child pages without affecting the URL structure.

### 2.3 Admin Console Structure

```
app/admin/
  |-- login/page.tsx              Public (admin login)
  |-- (console)/                  Auth-gated + TOTP
      |-- layout.tsx              Admin sidebar + header
      |-- page.tsx                Dashboard
      |-- approvals/page.tsx
      |-- operators/page.tsx
      |-- operators/[id]/page.tsx
      |-- users/page.tsx
      |-- finance/page.tsx
      |-- system/page.tsx
```

### 2.4 Customer Routes

```
app/(customer)/
  |-- page.tsx                    Home / landing
  |-- search/page.tsx             Search results (RSC)
  |-- nha-xe/[slug]/page.tsx      Operator public page (RSC)
  |-- booking/
  |   |-- review/page.tsx         Booking review (RSC + client sections)
  |   |-- confirmation/page.tsx   Post-payment confirmation
  |-- lien-he/page.tsx            Contact / charter request
  |-- dieu-khoan/page.tsx         Terms of service (ISR)
  |-- chinh-sach/page.tsx         Privacy policy (ISR)
```

---

## 3. RSC vs Client Component Decision Tree

### 3.1 Default: Server Component (RSC)

Every component is a server component by default. This means:
- It renders on the server during the request
- It can directly call `lib/` functions (Prisma queries, business logic)
- It has zero client-side JavaScript footprint
- It can `await` async operations in the render body

### 3.2 When to Use `'use client'`

Add the `'use client'` directive ONLY when the component requires one or more of:

| Reason | Examples |
|--------|---------|
| Form interactivity | Controlled inputs, form validation, submit handlers |
| Browser APIs | `localStorage`, `sessionStorage`, `navigator`, `window` |
| Timers / countdowns | Hold expiry timer, payment polling, auto-refresh |
| Event handlers | `onClick`, `onChange`, `onSubmit`, `onKeyDown` |
| Zustand store access | Global UI state (toast queue, sidebar collapse) |
| Third-party client libs | Chart rendering, PDF generation in-browser |

### 3.3 Composition Pattern

The standard pattern is: RSC page fetches data, passes as props to client interactive sections.

```
// page.tsx (Server Component - NO 'use client')
export default async function TripsPage() {
  const trips = await getOperatorTrips(operatorId);
  return (
    <div>
      <h1>Quan ly chuyen</h1>
      {/* Client component receives server-fetched data as props */}
      <TripsClient initialTrips={trips} />
    </div>
  );
}
```

```
// TripsClient.tsx ('use client')
'use client';
export function TripsClient({ initialTrips }: { initialTrips: TripDto[] }) {
  // Client-side interactivity: sorting, filtering, row actions
}
```

### 3.4 Decision Checklist

Before adding `'use client'`:

1. Can this be done with a Server Action instead? (form submission with redirect)
2. Can the interactive part be isolated to a smaller child component?
3. Does the parent RSC already fetch the data this component needs?

If all three answers are yes, keep the parent as RSC and extract only the interactive leaf as client.

---

## 4. Self-Fetch Prohibition (Mandatory)

### 4.1 Rule

**Server components MUST call `lib/` functions directly. They MUST NOT `fetch('/api/...')`.**

This rule is non-negotiable. Violations are architectural bugs. The Mistake Log documents two incidents (Issues 002 and 003) where self-fetch caused production failures:
- Issue 002: `process.env.NEXT_PUBLIC_BASE_URL` broke when dev server port changed
- Issue 003: Header-derived base URL was a band-aid; the real fix is in-process calls

### 4.2 Correct Pattern

```
// WRONG - server component self-fetching its own API
export default async function ReviewPage() {
  const res = await fetch(`${baseUrl}/api/holds/${holdId}`);  // BUG
  const hold = await res.json();
  ...
}

// CORRECT - server component calling lib function directly
import { getHoldDetails } from '@/lib/booking/getHoldDetails';

export default async function ReviewPage() {
  const hold = await getHoldDetails(holdId);  // Direct in-process call
  ...
}
```

### 4.3 Shared Logic Extraction

When both a route handler (`app/api/.../route.ts`) and a server component need the same data:

1. Extract the logic into a `lib/` function
2. Import and call from the route handler
3. Import and call from the server component
4. Both callers share the same business logic and DB queries

---

## 5. Import Safety Rules

### 5.1 Client Components Must Deep-Import

`'use client'` files MUST NOT import from domain barrels (`@/lib/auth`, `@/lib/booking`, `@/lib/payment`). Domain barrels re-export server-only modules that pull `pg`, `server-only`, and `next/server` into the client bundle, causing a build crash.

| Import | Status | Reason |
|--------|--------|--------|
| `import { readCsrfToken } from '@/lib/auth/csrfClient'` | CORRECT | Deep import of client-safe module |
| `import { readCsrfToken } from '@/lib/auth'` | BUG | Barrel pulls `requireOperatorAuth` -> `pg` -> crash |
| `import { formatPrice } from '@/lib/utils/currency'` | CORRECT | `lib/utils/` is exempt (no server deps) |
| `import { formatPrice } from '@/lib/core/currency'` | CORRECT | `lib/core/` is exempt (utilities only) |

### 5.2 Architectural Layers (ADR-016)

```
Experience Layer (app/)
    imports from -> Domain Layer (lib/<domain>/)
                        imports from -> Core Layer (lib/core/, lib/utils/)
                                            imports from -> Infrastructure (PG, Redis, S3)
```

Each layer imports only downward. Cross-domain imports go through barrel files. Intra-domain deep imports are allowed.

### 5.3 Exempt Modules

| Module | Reason |
|--------|--------|
| `lib/core/*` | Utility functions, no server-only deps |
| `lib/utils/*` | Pure utility functions |
| `__tests__/**` | Test files can deep-import anything |
| `app/dev/**` | Dev-only pages, no production constraints |

### 5.4 Lint Enforcement

- `eslint-plugin-boundaries`: `entry-point` rule enforces barrel-only cross-domain imports
- `eslint-plugin-import-x`: `import/no-cycle` prevents circular dependencies
- Both configured as `error` severity, gated by `pnpm lint` in CI and pre-commit hook

### 5.5 CI Guard for Client Safety

Greppable check (must return zero matches):

```bash
grep -rln "from ['\"]@/lib/auth['\"]" app components | \
  while read f; do head -1 "$f" | grep -q "use client" && echo "$f"; done
```

Any match = a client component importing a server-tainted barrel = build-breaking bug.

---

## 6. Suspense Boundary Placement

### 6.1 Placement Strategy

| Level | When to Use | Skeleton |
|-------|-------------|----------|
| Page-level | Page has a single primary data dependency | Full-page skeleton matching final layout |
| Section-level | Page has 2+ independent data sources | Per-section skeleton (e.g., stats cards vs. table) |
| Component-level | A heavy widget loads asynchronously | Widget-sized skeleton placeholder |

### 6.2 Skeleton Dimension Rules

| Rule | Enforcement |
|------|-------------|
| Skeleton height MUST match final content height | Visual review in Storybook / dev |
| Skeleton column count MUST match data table columns | Hardcoded skeleton, not dynamic |
| Skeleton card count MUST match expected card count (or cap at 5) | Prevents CLS on data load |
| Use `animate-pulse` on `bg-muted` | Consistent with design system |

### 6.3 Example: Dashboard with Independent Sections

```tsx
export default async function DashboardPage() {
  return (
    <div>
      <Suspense fallback={<StatCardsSkeleton />}>
        <DashboardStats operatorId={operatorId} />
      </Suspense>

      <Suspense fallback={<DeparturesTableSkeleton />}>
        <TodaysDepartures operatorId={operatorId} />
      </Suspense>
    </div>
  );
}
```

Stats and departures stream independently --- the faster one renders first without blocking the other.

---

## 7. Server Actions vs API Routes

### 7.1 Decision Matrix

| Pattern | Use Case | CSRF | Response |
|---------|----------|------|----------|
| API Route (`app/api/.../route.ts`) | Primary mutation path | `X-CSRF-Token` header from `bb_csrf` cookie | JSON body |
| Server Action (`'use server'`) | Form submissions that redirect | Built-in (Next.js token) | Redirect or revalidation |

### 7.2 Rules

- **API Routes** are the primary mutation mechanism. All operator and admin actions use API routes.
- **Server Actions** are used ONLY for form submissions that result in a redirect (e.g., search form -> search results page). Progressive enhancement: the form works without JavaScript.
- **Never** use server actions for operations that return data to the client. Server actions are fire-and-redirect, not request-response.

### 7.3 CSRF Protection

All non-safe HTTP methods (`POST`, `PUT`, `PATCH`, `DELETE`) to `/api/*` require the `X-CSRF-Token` header. The token is read from the `bb_csrf` cookie (non-HttpOnly, accessible to client JS).

Client-side helper (`lib/auth/csrfClient.ts`):

```typescript
export function readCsrfToken(): string | null {
  // Read bb_csrf cookie value
  // Include as X-CSRF-Token header on all mutations
}
```

Webhook routes (`/api/payments/momo/webhook`) are exempt --- they authenticate via HMAC signature.

---

## 8. Auth Context

### 8.1 Server-Side Auth

```
Request -> Edge Middleware (jose.jwtVerify on bb_access cookie)
        -> Extract claims: { userId, operatorId?, role?, requiresPasswordChange? }
        -> Pass to route handler / server component via cookies()
```

Server components read the `bb_access` JWT from `cookies()` and extract the user identity. The JWT contains:

| Claim | Customer | Operator | Admin |
|-------|----------|----------|-------|
| `sub` | `customerId` | `operatorUserId` | `adminId` |
| `operatorId` | --- | Operator tenant ID | --- |
| `role` | --- | `admin` or `staff` | `SUPER_ADMIN` / `FINANCE` / `SUPPORT` |
| `requiresPasswordChange` | --- | Boolean | --- |

### 8.2 Client-Side Auth

Client components do not read the JWT directly. They:
1. Receive user identity as props from the parent RSC
2. Include the CSRF token on all mutations via `readCsrfToken()`
3. The server validates the JWT on every API request

### 8.3 Operator Tenant Scope

**Every operator-side query MUST filter by `operatorId` from the JWT.** The `operatorId` is never sent by the client and never trusted from the request body.

```typescript
// In lib/ functions called from operator routes:
const trips = await prisma.trip.findMany({
  where: {
    operatorId,  // From JWT, not from request
    ...otherFilters,
  },
});
```

This is enforced via `withOperatorScope(operatorId)` which wraps queries with the tenant filter.

### 8.4 Password Change Gate

If `requiresPasswordChange` is `true` in the JWT, Edge middleware redirects ALL `/op/*` routes to `/op/first-login` (exact-match allowlist, not prefix-match). The operator must change their password before accessing any console page.

After password change, a new JWT is minted with `requiresPasswordChange: false`.

### 8.5 Token Lifecycle

| Token | Cookie | TTL | Refresh |
|-------|--------|-----|---------|
| Access token | `bb_access` (HttpOnly, Secure, SameSite=Lax) | 15 minutes | Via `/api/op/auth/refresh` |
| CSRF token | `bb_csrf` (non-HttpOnly, Secure, SameSite=Lax) | Matches access token | Refreshed alongside access token |

Long-running browser sessions must periodically call the refresh endpoint. The operator console shell (`OperatorNav`) handles this transparently.

---

## 9. Edge vs Origin Split

| Concern | Runtime | Rationale |
|---------|---------|-----------|
| JWT verification | Edge (middleware) | Stateless, `jose` library, < 1ms |
| CSRF validation | Edge (middleware) | String comparison, no DB |
| Password change gate | Edge (middleware) | JWT claim read, no DB |
| Auth guards (`requireOperatorAuth`) | Origin | May need DB for role lookup |
| DB queries (Prisma) | Origin | `pg` driver, `SELECT FOR UPDATE` |
| Ledger writes | Origin | Full ACID transactions |
| File uploads | Origin | S3/object storage integration |

---

## 10. Date/Time Handling in RSC

### 10.1 Purity Rule

Server component render bodies MUST NOT call `Date.now()`, `Math.random()`, `crypto.randomUUID()`, or any other non-deterministic API. These break RSC caching and make debugging non-reproducible.

### 10.2 Correct Pattern

```typescript
// WRONG - Date.now() inside RSC render body
export default async function RevenuePage() {
  const end = new Date(Date.now());  // Impure
  ...
}

// CORRECT - helper outside component function
function getDefaultDateRange() {
  const now = new Date();
  return { start: subDays(now, 30), end: now };
}

export default async function RevenuePage() {
  const { start, end } = getDefaultDateRange();
  ...
}
```

### 10.3 Vietnam Timezone

All business-date computations use `Asia/Ho_Chi_Minh` timezone:

```typescript
const vnDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh',
}).format(date);
// Returns: '2026-06-19' (ISO date in Vietnam local time)
```

---

## 11. Cross-References

| Reference | Relevance |
|-----------|-----------|
| ADR-001 Stack Pick | Next.js App Router, SSR streaming, edge/origin split, monorepo structure |
| ADR-016 Module Boundaries | Barrel file convention, layered imports, client deep-import rule, lint enforcement |
| DS-028 FD-011 Data Fetching | RSC data fetching, self-fetch prohibition, Suspense streaming, cache strategy |
| DS-044 FD-027 Performance Budget | Bundle size per route group, code splitting, streaming SSR targets |
| DS-018 FD-001 Design System | Skeleton styling (`animate-pulse`, `bg-muted`), component primitives |
| Mistake Log Issue 002 | Self-fetch with env var broke on port change |
| Mistake Log Issue 003 | Self-fetch mandate hardened to "extract lib function" |
| Mistake Log: operator-smoke | Client barrel import crashed entire operator portal |
| Bounded Contexts: Auth | Three auth realms, JWT claims, TOTP step-up |
