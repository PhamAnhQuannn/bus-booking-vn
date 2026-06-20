# DS-026 State Management

Client-side state management patterns. All stores use Zustand with optional persistence.

## Stores

| Store | File | Persistence | Purpose |
|-------|------|-------------|---------|
| `useSearchStore` | `stores/searchStore.ts` | localStorage | Search form state (origin, destination, date, ticketCount). Survives page reloads so users don't re-enter criteria. |
| `useBookingStore` | `stores/bookingStore.ts` | sessionStorage | Active booking flow state (tripId, passenger info, hold ID). Guards `/booking/*` layout — redirects to `/search` if `tripId` empty. Cleared on booking completion or hold expiry. |
| `useOperatorNav` | `stores/operatorNav.ts` | localStorage | Operator sidebar collapse state (expanded/collapsed). Persists user preference across sessions. |
| `useHoldTimerStore` | `stores/holdTimerStore.ts` | none | Countdown timer for active seat hold (expiresAt, remaining seconds). Drives HoldTimer + HoldExpiryModal. Resets on new hold or expiry. |

## Hydration

Server components render with empty/default store values. Client components hydrate from persisted storage on mount.

Pattern (SearchForm example):
1. Server renders form with empty fields
2. Client mounts, Zustand reads localStorage
3. Fields populate — brief flash acceptable (search form is interactive-only)

For stores driving layout guards (bookingStore.tripId), the guard runs client-side in the layout component. Server render shows nothing; client redirect happens immediately if store is empty.

## State Boundaries

| State Type | Where It Lives | Examples |
|------------|---------------|----------|
| Server state | RSC props / API response | Trip list, booking details, operator dashboard data |
| URL state | `searchParams` | Search filters, pagination cursor, date range |
| Client form state | Zustand store | Search criteria, booking flow progress |
| UI-only state | React `useState` | Modal open/close, dropdown, accordion, tooltip |
| Auth state | HttpOnly cookies | `bb_access`, `bb_refresh`, `bb_hold`, `bb_csrf` |

**Rule**: server data never duplicated in client stores. Zustand stores hold only user-initiated transient state (form inputs, UI preferences, timer countdowns).

## Related

- [FD-004 Form Design](../FD-004-form-design/) — SearchForm Zustand usage, hydration guard
- [FD-003 Page Inventory](../FD-003-page-inventory/) — booking layout guard on `bookingStore.tripId`
- [FD-005 Motion & Interaction](../FD-005-motion-interaction/) — HoldTimer/HoldExpiryModal state-driven UI
- [ADR-003 Auth Architecture](../../architecture-decisions/ADR-003-auth-architecture/) — cookie-based auth tokens
