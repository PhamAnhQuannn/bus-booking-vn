# 18 - Operator Portal Pages

Filesystem root: `app/op/`
URL root: `/op`

## Architecture Overview

The operator portal uses a route-group layout structure:

| Layer | File | Purpose |
|---|---|---|
| Root op layout | (none) | No `app/op/layout.tsx` exists. Auth pages inherit the root `app/layout.tsx` directly. |
| Console route-group layout | `app/op/(console)/layout.tsx` | Authenticated shell with sidebar nav, header, mobile bottom nav, command palette, approval banner, and toast provider. Gates auth via `getOperatorSession()`. |

Auth pages (`/op/login`, `/op/register`, `/op/first-login`, `/op/forgot-password`) sit OUTSIDE the `(console)` route group and render without the sidebar chrome, wrapped in `<AuthSplitLayout>` instead.

Staff dashboard (`/op/staff/dashboard`) also sits outside the console group and renders without sidebar chrome.

---

## Console Layout

| Attribute | Value |
|---|---|
| Filesystem | `app/op/(console)/layout.tsx` |
| Component type | RSC |
| Auth guard | `getOperatorSession()` from `@/lib/op` -- redirects to `/op/login` if no session, `/op/first-login` if `requiresPasswordChange` |

**Data fetching:**
- `getUnviewedPaidCount(session.operatorUserId, session.operatorId)` from `@/lib/booking` -- badge count for new bookings
- `prisma.operator.findUnique(...)` -- reads `status` and `rejectionReason` for the approval banner

Both run in `Promise.all`.

**Component tree:**

```
<OperatorNavProvider>                          [client context]
  <ToastProvider>                              [client]
    <a href="#main">                            skip-nav link (sr-only)
    <div flex-col md:flex-row>
      <OperatorNav />                          [client] desktop sidebar + mobile drawer
      <div content-column>
        <ConsoleHeader />                      [client] top bar with breadcrumbs, search, bell, user menu
        <ApprovalBanner />                     [RSC] conditional per operator.status
        <main id="main">{children}</main>
    <OperatorBottomNav />                      [client] mobile fixed bottom bar
    <CommandPalette />                         [client] Cmd+K dialog
    <Toaster />
```

**Layout components:**

| Component | File | Type | Props |
|---|---|---|---|
| `OperatorNavProvider` | `components/op/OperatorNavContext.tsx` | Client | `{ children }` -- context for drawer open/collapsed/cmdK state; collapsed persisted to `localStorage` key `op:nav-collapsed` |
| `OperatorNav` | `components/op/OperatorNav.tsx` | Client | `{ role: NavRole, unviewedCount: number }` |
| `ConsoleHeader` | `components/op/ConsoleHeader.tsx` | Client | `{ operatorName: string, role: "admin"\|"staff", unreadCount?: number }` |
| `OperatorBottomNav` | `components/op/OperatorBottomNav.tsx` | Client | `{ role: NavRole, unviewedCount?: number }` |
| `CommandPalette` | `components/op/CommandPalette.tsx` | Client | `{ role: NavRole }` |
| `ApprovalBanner` | `components/op/ApprovalBanner.tsx` | RSC | `{ status: OperatorStatus, rejectionReason?: string \| null }` |

---

## OperatorNav

| Attribute | Value |
|---|---|
| File | `components/op/OperatorNav.tsx` |
| Type | Client component (`'use client'`) |
| Props | `{ role: NavRole, unviewedCount: number }` |

**Desktop (>=md):** Sticky full-height sidebar (`w-60` or `w-14` when collapsed). Contains logo link to `/op/dashboard`, collapse toggle, Cmd+K search button, `<NavLinks>` list, and `<LogoutButton>` (POST `/api/op/auth/logout` with CSRF).

**Mobile (<md):** Sticky top bar with hamburger trigger, logo, unviewed badge. Opens a slide-in drawer (`@base-ui/react/dialog`, `w-72`) with same nav links and logout.

All CSRF tokens read via `readCsrfToken()` from `@/lib/auth/csrfClient` (deep import, not barrel).

### navConfig.ts

| File | Type | Purpose |
|---|---|---|
| `components/op/navConfig.ts` | Shared module | Single source of truth for nav items. Exports `NAV_ITEMS`, `BOTTOM_NAV_IDS`, `NavRole`, `visibleNavItems()`, `isNavItemActive()`, `findNavItem()`. |

### Nav Items (7 tabs)

| ID | Label | URL | Icon | Flags |
|---|---|---|---|---|
| `overview` | Tong quan | `/op/dashboard` | LayoutDashboard | -- |
| `fleet` | Doi xe | `/op/buses` | Bus | -- |
| `trips` | Chuyen di | `/op/trips` | Ticket | -- |
| `bookings` | Dat ve | `/op/bookings` | Ticket | `bookingsBadge: true` |
| `money` | Tai chinh | `/op/money` | Wallet | -- |
| `charter` | Thue xe | `/op/charter` | CalendarCheck | -- |
| `settings` | Cai dat | `/op/settings` | Settings | -- |

Mobile bottom nav shows 4 primary items (`overview`, `trips`, `bookings`, `money`) plus a "More" button that opens the full sidebar drawer.

Each item has Vietnamese diacritic-stripped `keywords` for command palette search.

---

## Supporting Console Components

| Component | File | Type | Purpose |
|---|---|---|---|
| `ConsoleHeader` | `components/op/ConsoleHeader.tsx` | Client | Top bar: `<Breadcrumbs>`, `<EnvBadge>`, Cmd+K trigger, bell/notification button (links to `/op/activity`), `<OperatorPillMenu>` |
| `OperatorPillMenu` | `components/op/OperatorPillMenu.tsx` | Client | Avatar + name + role pill opening a dropdown: "Ho so" (Profile) link to `/op/profile`, "Dang xuat" (Logout) with CSRF-protected POST |
| `Breadcrumbs` | `components/op/Breadcrumbs.tsx` | Client | Path-derived breadcrumbs from `usePathname()`. Resolves labels from `NAV_ITEMS`. Home anchor links to `/op/dashboard`. |
| `CommandPalette` | `components/op/CommandPalette.tsx` | Client | Cmd+K / Ctrl+K full-screen dialog. 3 groups: Recent (localStorage `op:cmdk-recent`), Pages (from navConfig, keyword-searchable), Actions (create trip, fleet, logout). |
| `EnvBadge` | `components/op/EnvBadge.tsx` | RSC | DEV/STAGING chip from `NEXT_PUBLIC_APP_ENV`. Hidden in production. |
| `ApprovalBanner` | `components/op/ApprovalBanner.tsx` | RSC | Status-dependent banner: PENDING_REVIEW/UNDER_REVIEW (warning), SUSPENDED/REJECTED (danger), APPROVED (hidden). Links to `/op/status` and `/op/kyb`. |
| `PageHeader` | `components/op/PageHeader.tsx` | RSC | Reusable page header with optional breadcrumb, title, subtitle, badge, actions, filters, back link. Used by most console pages. |
| `EmptyState` | `components/op/EmptyState.tsx` | RSC | Empty-state placeholder with message and optional action link. |
| `ConfirmDialog` | `components/op/ConfirmDialog.tsx` | Client | Confirmation dialog for destructive actions. |

---

## Shared Auth Component: AuthSplitLayout

| Attribute | Value |
|---|---|
| File | `components/auth/AuthSplitLayout.tsx` |
| Type | RSC |
| Props | `{ audience: 'customer' \| 'operator', title: string, subtitle?: ReactNode, children: ReactNode }` |

Split-panel layout used by all auth pages. Desktop: left brand panel (gradient, logo, headline, bullet points) + right form panel. Mobile: form-only with slim brand bar. For `audience="operator"`: dark warm gradient, eyebrow "Cong nha xe", bullets about fleet/revenue/bookings management.

---

## Page Inventory -- Auth Pages (outside console)

### 1. Login

| Attribute | Value |
|---|---|
| Filesystem | `app/op/login/page.tsx` |
| URL | `/op/login` |
| Component type | Client (`'use client'`) |
| Auth guard | None (public; in `proxy.ts` `OP_AUTH_FREE_PATHS`) |

**What it renders:** Login form inside `<AuthSplitLayout>`. Username input (auto-capitalize, placeholder "VD: PB-0001"), password input, error alert. Links to `/op/forgot-password` and `/op/register`.

**Behavior:** POSTs to `/api/auth/login` with `{ scope: 'operator', username, password }` and CSRF token. On success with `requiresPasswordChange`: redirects to `/op/first-login`. Otherwise: redirects to `/op/dashboard`.

**Co-located components:** None.

---

### 2. Register (Application)

| Attribute | Value |
|---|---|
| Filesystem | `app/op/register/page.tsx` |
| URL | `/op/register` |
| Component type | Client (`'use client'`) |
| Auth guard | None (public; in `proxy.ts` `OP_AUTH_FREE_PATHS`) |

**What it renders:** Operator application form (not account creation -- no password field) inside `<AuthSplitLayout>`. 7 fields: brand name, legal name, contact name, contact phone, contact email, address, routes summary. Link to `/op/login`.

**Behavior:** POSTs to `/api/op/register` with CSRF token. On 201 success: redirects to `/op/register/confirmation?ref=<applicationRef>`. Handles 429 (rate limit), 400 (validation).

**Co-located components:** None.

---

### 3. Registration Confirmation

| Attribute | Value |
|---|---|
| Filesystem | `app/op/register/confirmation/page.tsx` |
| URL | `/op/register/confirmation` |
| Component type | RSC |
| Auth guard | None (public; in `proxy.ts` `OP_AUTH_FREE_PATHS`) |

**What it renders:** Confirmation page inside `<AuthSplitLayout>`. Shows "Ho so da nhan" message, application reference code (from `?ref=` query param), estimated 2-day review timeline, and link-styled button to `/op/login`.

**Data fetching:** Reads `ref` from `searchParams` only.

**Co-located components:** None.

---

### 4. First Login (Password Change)

| Attribute | Value |
|---|---|
| Filesystem | `app/op/first-login/page.tsx` |
| URL | `/op/first-login` |
| Component type | Client (`'use client'`) |
| Auth guard | Requires authenticated operator with `requiresPasswordChange = true` in JWT. Middleware redirects here when the claim is set. |

**What it renders:** Password change form inside `<AuthSplitLayout>`. Current password, new password (`minLength={8}`), confirm password. Client-side validation that passwords match.

**Behavior:** POSTs to `/api/op/auth/password/change` with `{ currentPassword, newPassword }` and CSRF token. On 204 success: redirects to `/op/dashboard`. Error codes: `WEAK_PASSWORD`, `WRONG_CURRENT`, `SAME_AS_OLD`.

**Co-located components:** None.

---

### 5. Forgot Password

| Attribute | Value |
|---|---|
| Filesystem | `app/op/forgot-password/page.tsx` |
| URL | `/op/forgot-password` |
| Component type | Client (`'use client'`) |
| Auth guard | None (public pre-auth page; endpoints in `CSRF_EXEMPT_PREFIXES`) |

**What it renders:** Multi-step wizard with 3 steps driven by `useState<Step>`:

| Step | UI | API Endpoint |
|---|---|---|
| `phone` | Phone number input, "Gui ma OTP" button, link back to `/op/login` | `POST /api/op/auth/forgot-password` |
| `reset` | OTP code (6 digits), new password, confirm password, submit button | `POST /api/op/auth/forgot-password/verify` then `POST /api/op/auth/forgot-password/reset` |
| `done` | Success message, button to `/op/login` | -- |

Error codes: `INVALID_CODE`, `EXPIRED`, `LOCKED_OUT`, `WEAK_PASSWORD`, `INVALID_PROOF`. No CSRF tokens (all endpoints are CSRF-exempt).

**Co-located components:** None.

---

### 6. Staff Dashboard

| Attribute | Value |
|---|---|
| Filesystem | `app/op/staff/dashboard/page.tsx` |
| URL | `/op/staff/dashboard` |
| Component type | RSC |
| Auth guard | `getStaffDashboard()` from `@/lib/op`. Redirects: no auth to `/op/login`, `requiresPasswordChange` to `/op/first-login`, non-staff to `/op/dashboard`. |

**Data fetching:** `getStaffDashboard()` returns `{ requiresPasswordChange, isStaff, assignedTripId, trip, queueRows, manifestRows, manifestGeneratedAt }`.

**What it renders:** `<PageHeader>` with title "Chuyen cua toi" (My trip). If no trip assigned: empty state with `data-testid="staff-empty-state"`. If trip assigned: `<StaffDashboardClient>` island.

**Co-located components:**

| File | Type | Props | Purpose |
|---|---|---|---|
| `StaffDashboardClient.tsx` | Client (`'use client'`) | `{ tripId: string, trip: TripDto \| null, initialQueueRows: BookingQueueRow[], initialManifestRows: ManifestRow[], initialManifestGeneratedAt: string \| null }` | Staff member's trip view with booking queue and manifest for their assigned trip. |

---

## Page Inventory -- Console Pages

### 7. Dashboard

| Attribute | Value |
|---|---|
| Filesystem | `app/op/(console)/dashboard/page.tsx` |
| URL | `/op/dashboard` |
| Component type | RSC |
| Auth guard | `getOperatorSession()` -- redirects to `/op/login` or `/op/first-login` |

**Data fetching (all in parallel):**
- `getUnviewedPaidCount(operatorUserId, operatorId)` from `@/lib/booking`
- `touchLastViewed(operatorUserId)` from `@/lib/booking`
- `listUpcomingForOperator(operatorId, { limit: 24 })` from `@/lib/trips`
- `getActivityFeed({ operatorId, limit: 30 })` from `@/lib/op`
- `getTodaySnapshot(operatorId)` from `@/lib/op`
- `getOperatorBalance(operatorId)` from `@/lib/ledger`
- `prisma.bus.count(...)` -- total and active bus counts
- `listRoutesForTripIds(operatorId, routeIds)` from `@/lib/op`

**What it renders:** Operations dashboard with greeting header, 4-box overview grid (today trips/bookings, fleet count, available balance with withdraw link, alerts count), today's-trips horizontal strip for next 24h, and unified activity inbox sorted by severity.

**Co-located components:**

| File | Type | Props | Purpose |
|---|---|---|---|
| `TodayTripsStrip` (`components/op/TodayTripsStrip.tsx`) | Client | `{ trips: TripMiniCardRow[], now: number }` | Horizontal scrollable strip of upcoming trip mini-cards |
| `InboxStream` (`components/op/InboxStream.tsx`) | Client | `{ events: ActivityEvent[], now: number }` | Activity inbox list sorted by severity |

---

### 8. Bookings List

| Attribute | Value |
|---|---|
| Filesystem | `app/op/(console)/bookings/page.tsx` |
| URL | `/op/bookings` |
| Component type | RSC |
| Auth guard | `getOperatorSession()` -- redirects to `/op/login` or `/op/first-login` |

**Data fetching:**
- `getUnviewedPaidCount(operatorUserId, operatorId)` from `@/lib/booking`
- `touchLastViewed(operatorUserId)` from `@/lib/booking`
- `getDefaultTodayRange()` from `@/lib/op` (VN-timezone date, module-scope helper)
- `listOperatorBookings(operatorId, { serviceDate: today })` from `@/lib/booking`

**What it renders:** PageHeader with unviewed-booking badge count, delegates to `DashboardClient`.

**Co-located components:**

| File | Type | Props | Purpose |
|---|---|---|---|
| `DashboardClient.tsx` | Client (`'use client'`) | `{ initialRows: BookingQueueRow[], initialNextCursor: string \| null, operatorId: string, initialServiceDate?: string }` | Interactive booking queue with filter form (bus ID, service date via DatePicker, route ID, contact status). Table columns: booking ref (links to detail), passenger name, phone, ticket count, contact status badge, pickup area, payment status badge, departure time, flags (manual/escalated). Cursor-based "load more" pagination. |

**API calls (DashboardClient):** `listBookingsApi(params)` from `@/lib/api` (GET).

---

### 9. Booking Detail

| Attribute | Value |
|---|---|
| Filesystem | `app/op/(console)/bookings/[id]/page.tsx` |
| URL | `/op/bookings/:id` |
| Component type | RSC |
| Auth guard | `getOperatorSession()` -- redirects or `notFound()` if booking not found / wrong operator |

**Data fetching:** `getBookingDetailPage(operatorId, id)` from `@/lib/booking`.

**Co-located components:**

| File | Type | Props | Purpose |
|---|---|---|---|
| `BookingDetailClient.tsx` | Client (`'use client'`) | `{ booking: BookingDto }` | Read-only booking detail. Definition list: booking ref, passenger name, phone, route, bus plate, departure time, ticket count, total (VND), payment status, contact status, pickup point details (custom/point/station variants), escalation flag. No API calls. |

---

### 10. Buses (Fleet)

| Attribute | Value |
|---|---|
| Filesystem | `app/op/(console)/buses/page.tsx` |
| URL | `/op/buses` |
| Component type | RSC |
| Auth guard | `getOperatorFleet({ activeOnly: true })` from `@/lib/op` -- combines session check + fleet data |

**Data fetching:** `getOperatorFleet({ activeOnly: true })` from `@/lib/op`.

**Co-located components:**

| File | Type | Props | Purpose |
|---|---|---|---|
| `BusesClient.tsx` | Client (`'use client'`) | `{ initialBuses: OperatorBusListItem[] }` | Full fleet CRUD. Add bus form (plate, capacity 1-80, type: coach/sleeper/limousine). Bus table with inline capacity edit, maintenance toggle, deactivate. Per-bus maintenance panel (list windows, add/delete with datetime pickers). Error translation for `plate_in_use`, `capacity_reduction_blocked`, `future_trips_assigned`, `maintenance_overlap`. |

**API calls (BusesClient):**

| Function | Method | Endpoint |
|---|---|---|
| `listBusesApi(activeOnly)` | GET | `/api/op/buses` |
| `getBusApi(busId)` | GET | `/api/op/buses/:id` |
| `createBusApi(...)` | POST | `/api/op/buses` |
| `patchCapacityApi(busId, capacity)` | PATCH | `/api/op/buses/:id` |
| `deactivateBusApi(busId)` | POST | `/api/op/buses/:id/deactivate` |
| `addMaintenanceApi(busId, ...)` | POST | `/api/op/buses/:id/maintenance` |
| `deleteMaintenanceApi(busId, mid)` | DELETE | `/api/op/buses/:id/maintenance/:mid` |

All via `@/lib/api` with CSRF double-submit.

---

### 11. Bus Detail

| Attribute | Value |
|---|---|
| Filesystem | `app/op/(console)/buses/[id]/page.tsx` |
| URL | `/op/buses/:id` |
| Component type | RSC (fully server-rendered, no client island) |
| Auth guard | `getOperatorSession()` -- redirects or `notFound()` |

**Data fetching:**
- `getOperatorBusWithTrips(operatorId, id)` from `@/lib/catalog`
- `serverNow()` from `@/lib/op` (maintenance window active-state check)

**What it renders:** Status badge (active/in maintenance/deactivated). 4-card summary: plate, bus type, capacity, active selling trips count. Active trips table/cards: departure time, route, price (VND), sold/capacity, available seats, occupancy % badge (color-coded >=90/>=70/>=40/<40), manifest link. Maintenance windows section.

**Co-located components:** None.

---

### 12. Trips List

| Attribute | Value |
|---|---|
| Filesystem | `app/op/(console)/trips/page.tsx` |
| URL | `/op/trips` |
| Component type | RSC |
| Auth guard | `getOperatorSession()` -- redirects to `/op/login` or `/op/first-login` |

**Data fetching:** `listTrips(operatorId)` from `@/lib/trips`.

**Co-located components:**

| File | Type | Props | Purpose |
|---|---|---|---|
| `TripsClient.tsx` | Client (`'use client'`) | `{ initialTrips: TripDto[] }` | Trip list with management. Top bar: "Create new trip" (links to `/op/trips/new`), "Manage fixed schedules" (links to `/op/trip-templates`). Table: ID, departure, price, status badge, available seats, actions. Per-trip: sales toggle, cancel (opens `CancelTripDialog` requiring 10+ char reason). |
| `CancelTripDialog.tsx` | Client (`'use client'`) | `{ tripId, onConfirm, onClose }` | Modal for trip cancellation with required reason text (min 10 chars). Returns `cancelledBookings`, `cancelledHolds`, `notificationsEnqueued`. |

**API calls (TripsClient):**

| Function | Method | Endpoint |
|---|---|---|
| `listTripsApi()` | GET | `/api/op/trips` |
| `salesToggleApi(tripId, salesClosed)` | PATCH | `/api/op/trips/:id` |
| `cancelTripApi(tripId, reason)` | POST | `/api/op/trips/:id/cancel` |

---

### 13. New Trip

| Attribute | Value |
|---|---|
| Filesystem | `app/op/(console)/trips/new/page.tsx` |
| URL | `/op/trips/new` |
| Component type | RSC |
| Auth guard | `getOperatorSession()` -- redirects to `/op/login` or `/op/first-login` |

**Data fetching:**
- `listRoutes({ operatorId })` from `@/lib/catalog`
- `listOperatorBuses(operatorId, { activeOnly: true })` from `@/lib/catalog`
- `listOperatorPickupAreas({ operatorId })` from `@/lib/catalog`
- `listRoutePickupAreas({ operatorId, routeId })` from `@/lib/catalog` (per active route)
- `prisma.trip.findFirst(...)` per route for most recent trip's pickup areas (per-route memory, Issue 112)

**Co-located components:**

| File | Type | Props | Purpose |
|---|---|---|---|
| `NewTripClient.tsx` | Client (`'use client'`) | `{ routes: RouteOption[], buses: BusOption[], routePickupAreas: Record<string, PickupAreaOption[]>, routePickupMemory: Record<string, string[]> }` | Trip creation form. Prerequisite alert if no routes/buses (links to create pages). Fields: route (Select), bus (Select with plate + capacity), departure (datetime-local), price (VND, step 1000). Optional pickup area picker grouped by kind (station/pickup) with province filter. Per-route memory auto-applies pickup areas from most recent prior trip. On success: redirects to new trip detail page. |

**API calls (NewTripClient):** `createTripApi(...)` from `@/lib/api` (POST with CSRF).

---

### 14. Trip Detail

| Attribute | Value |
|---|---|
| Filesystem | `app/op/(console)/trips/[id]/page.tsx` |
| URL | `/op/trips/:id` |
| Component type | RSC |
| Auth guard | `getOperatorStaff()` from `@/lib/op` (includes staff list + isAdmin flag) -- redirects or `notFound()` |

**Data fetching:**
- `getTrip(operatorId, id)` from `@/lib/trips`
- `listOperatorPickupAreas({ operatorId })` from `@/lib/catalog`
- `prisma.tripPickupArea.findMany({ where: { tripId: id } })` -- enabled pickup areas

**Co-located components:**

| File | Type | Props | Purpose |
|---|---|---|---|
| `TripDetailClient.tsx` | Client (`'use client'`) | `{ trip: TripDto, staff: StaffDto[], isAdmin: boolean, pickupMenu: PickupMenuItem[], tripPickupAreaIds: string[] }` | Full trip management. Sections: (1) Trip summary definition list. (2) Lifecycle actions: "Mark departed" (scheduled), "Mark completed" (departed). (3) Reassign bus: new bus ID input. (4) Sales toggle. (5) Pickup points: checkbox picker grouped by kind with province filter. (6) Assign staff (admin-only): staff Select with assign button. (7) Cancel trip via CancelTripDialog. All sections hidden when cancelled. |

**API calls (TripDetailClient):**

| Function | Method | Endpoint |
|---|---|---|
| `reassignBusApi(tripId, newBusId)` | PATCH | `/api/op/trips/:id` |
| `salesToggleApi(tripId, salesClosed)` | PATCH | `/api/op/trips/:id` |
| `setTripPickupAreasApi(tripId, pickupIds)` | PUT | `/api/op/trips/:id/pickup-areas` |
| `cancelTripApi(tripId, reason)` | POST | `/api/op/trips/:id/cancel` |
| `departTripApi(tripId)` | POST | `/api/op/trips/:id/depart` |
| `completeTripApi(tripId)` | POST | `/api/op/trips/:id/complete` |
| `assignServiceApi(staffId, tripId)` | POST | `/api/op/staff/:staffId/assign` |

---

### 15. Routes

| Attribute | Value |
|---|---|
| Filesystem | `app/op/(console)/routes/page.tsx` |
| URL | `/op/routes` |
| Component type | RSC |
| Auth guard | `getOperatorSession()` -- redirects to `/op/login` or `/op/first-login` |

**Data fetching:** `listRoutes({ operatorId })` from `@/lib/catalog`.

**Co-located components:**

| File | Type | Props | Purpose |
|---|---|---|---|
| `RoutesClient.tsx` | Client (`'use client'`) | `{ initialRoutes: RouteItem[] }` | Route CRUD table: origin, destination, duration (min), status badge (active/deactivated), actions (edit, pickup areas, deactivate). Create button opens `RouteEditDialog` in create mode. Error translation: `reactivation_not_supported`, `already_deactivated`, `not_found`, `invalid_input`. |
| `RouteEditDialog.tsx` | Client (`'use client'`) | Discriminated: `mode: 'create'` or `mode: 'edit'` with `route: RouteItem`. Common: `onSave(origin, destination, durationMinutes)`, `onClose`, `disabled`. | Modal form: origin, destination, durationMinutes (1-7200). Validates required fields + length. No direct API calls (delegates via `onSave`). |
| `RoutePickupAreaDialog.tsx` | Client (`'use client'`) | `{ routeId: string, routeLabel: string, onClose, onSaved }` | Assigns pickup areas to a route. Loads full active menu + current assignments on mount. Checkbox list grouped by kind (station/pickup) with optional province filter. Saves full replacement set. |

**API calls (RoutesClient):**

| Function | Method | Endpoint |
|---|---|---|
| `listRoutesApi()` | GET | `/api/op/routes` |
| `createRouteApi(...)` | POST | `/api/op/routes` |
| `patchRouteApi(routeId, ...)` | PATCH | `/api/op/routes/:id` |
| `deactivateRouteApi(routeId)` | POST | `/api/op/routes/:id/deactivate` |

**API calls (RoutePickupAreaDialog):**

| Function | Method | Endpoint |
|---|---|---|
| `listPickupAreasApi()` | GET | `/api/op/pickup-areas` |
| `getRoutePickupAreasApi(routeId)` | GET | `/api/op/routes/:id/pickup-areas` |
| `setRoutePickupAreasApi(routeId, ids)` | PUT | `/api/op/routes/:id/pickup-areas` |

---

### 16. Trip Templates

| Attribute | Value |
|---|---|
| Filesystem | `app/op/(console)/trip-templates/page.tsx` |
| URL | `/op/trip-templates` |
| Component type | RSC |
| Auth guard | `getOperatorSession()` -- redirects to `/op/login` or `/op/first-login` |

**Data fetching:**
- `listTemplates(session.operatorId)` from `@/lib/trips`
- `listOperatorPickupAreas({ operatorId })` from `@/lib/catalog` -- filtered to active, mapped with `composePickupLabel`

**Co-located components:**

| File | Type | Props | Purpose |
|---|---|---|---|
| `TemplatesClient.tsx` | Client (`'use client'`) | `{ initialTemplates: TemplateDto[], pickupAreas: { id, label, kind }[] }` | Create form: route ID, bus ID, price (VND), departure time (HH:MM), day-of-week bitmask checkboxes (Mon=1 through Sun=64, default Mon-Fri=31), valid-from/valid-until dates, optional pickup area checkboxes grouped by kind. Template table: ID, route, bus, time, days label (e.g. "T2, T3, T4, T5, T6"), validity range, deactivate button. |

**API calls (TemplatesClient):**

| Function | Method | Endpoint |
|---|---|---|
| `createTemplateApi(...)` | POST | `/api/op/trip-templates` |
| `patchTemplateApi(templateId, ...)` | PATCH | `/api/op/trip-templates/:id` |
| direct `fetch` | GET | `/api/op/trip-templates` (refresh) |

---

### 17. Manifest (Index -- Redirect)

| Attribute | Value |
|---|---|
| Filesystem | `app/op/(console)/manifest/page.tsx` |
| URL | `/op/manifest` |
| Component type | RSC (redirect-only, renders no UI) |
| Auth guard | `getOperatorSession()` |

**Data fetching:** `listUpcomingForOperator(session.operatorId, { limit: 1 })` from `@/lib/trips`.

**Behavior:** If upcoming trip found: redirects to `/op/manifest/:tripId`. If none: redirects to `/op/trips`.

**Co-located components:** None.

---

### 18. Manifest Detail

| Attribute | Value |
|---|---|
| Filesystem | `app/op/(console)/manifest/[tripId]/page.tsx` |
| URL | `/op/manifest/:tripId` |
| Component type | RSC |
| Auth guard | `getOperatorSession()` |

**Data fetching:** `getManifest(session.operatorId, tripId)` from `@/lib/booking`.

**What it renders:** If not found: PageHeader + `<EmptyState>` with link to `/op/trips`. If found: PageHeader with 3-level breadcrumb (Trips > Trip > Manifest) + `<ManifestRefresh>` client island.

**Co-located components:**

| File | Type | Props | Purpose |
|---|---|---|---|
| `ManifestRefresh.tsx` | Client (`'use client'`) | `{ tripId: string, initialGeneratedAt: string, initialRows: ManifestRow[] }` | Manifest table with refresh. Refresh button + "last updated" timestamp. Token scan box (Issue 073): text input for ticket tokens, "Len xe" button resolves token via scan API then auto-checks in. Table columns (no seat-number per AC6): booking ref, passenger name, phone, ticket count, pickup point, contact status badge, payment status badge, picked-up checkmark, boarding state (checked-in/no-show/not-boarded with action buttons), flags. Per-row check-in and no-show buttons. Warning highlight for escalated/pending-custom-pickup rows. |

**API calls (ManifestRefresh):**

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/op/manifest/:tripId` | Refresh manifest data |
| POST | `/api/op/scan` | Resolve scanned ticket token (CSRF) |
| POST | `/api/op/bookings/:bookingId/check-in` | Check in passenger (CSRF) |
| POST | `/api/op/bookings/:bookingId/no-show` | Mark no-show (CSRF) |

---

### 19. Money (Finance)

| Attribute | Value |
|---|---|
| Filesystem | `app/op/(console)/money/page.tsx` |
| URL | `/op/money` |
| Component type | RSC |
| Auth guard | `getOperatorSession()` -- redirects to `/op/login` or `/op/first-login` |

**Data fetching (all in `Promise.all`):**
- `getOperatorBalance(operatorId)` from `@/lib/ledger` -- returns `{ pending, available, paidOut }` as bigint
- `getLedgerView({ operatorId, limit: 25 })` from `@/lib/admin`
- `getPayoutReport({ operatorId })` from `@/lib/ledger`
- `prisma.payout.findFirst(...)` -- next auto-payout (requested/processing, soonest scheduledAt)

**What it renders:** 5 sections:
1. **Balance** -- 3 cards: pending, available (highlighted), paid-out. BigInt-safe formatting via `fmtVndStr()`.
2. **Withdraw** -- Card with `<WithdrawButton>` island.
3. **Next auto-payout** -- Card showing soonest pending payout with amount + status badge.
4. **Ledger** -- Table of last 25 entries: timestamp, type label (vi-VN), amount (red for negative). Type labels: booking_credit, platform_fee, refund_debit, refund_out, payout_debit, payout_reversal, chargeback, adjustment, tax_withheld.
5. **Statements** -- Payout history table: date, route name, amount, status badge, settled date.

**Co-located components:**

| File | Type | Props | Purpose |
|---|---|---|---|
| `WithdrawButton.tsx` | Client (`'use client'`) | `{ availableMinor: string, minThreshold: number }` | Withdraw form. Initially "Rut tien" button (disabled if available < threshold). On click: inline form with amount input (digits only), available/minimum display, submit/cancel. Success: alert + `router.refresh()`. Error codes: `below_min`, `insufficient_available`, `invalid_amount`, `payout_account_unverified` (links to `/op/settings`). |

**API calls (WithdrawButton):** `POST /api/op/money/withdraw` with `{ amountMinor }`, `X-CSRF-Token` header, and `Idempotency-Key` header (`crypto.randomUUID()`).

---

### 20. Reports (Index -- Redirect)

| Attribute | Value |
|---|---|
| Filesystem | `app/op/(console)/reports/page.tsx` |
| URL | `/op/reports` |
| Component type | RSC (redirect-only) |
| Auth guard | None directly (console layout gates) |

**Behavior:** Immediately redirects to `/op/reports/overview`.

---

### 21. Reports -- Overview (Bus Performance)

| Attribute | Value |
|---|---|
| Filesystem | `app/op/(console)/reports/overview/page.tsx` |
| URL | `/op/reports/overview` |
| Component type | RSC (fully server-rendered, no client island) |
| Auth guard | `getOperatorSession()` |

**Data fetching:**
- `getBusPerformance({ operatorId, dateFrom, dateTo })` from `@/lib/reports`
- `getDefaultDateRange(30)` from `@/lib/op` (last 30 days VN timezone)
- Reads `dateFrom`/`dateTo` from `searchParams`

**What it renders:** Date range filter form (GET form with DatePicker inputs). Desktop: table with columns: license plate (links to `/op/buses/:id`), bus type badge, capacity, trips run, seats sold/total, gross revenue (VND), occupancy % badge (color-coded >=90 danger, >=70 success, >=40 pending, <40 neutral), footer totals. Mobile: stacked cards. Empty state links to `/op/buses`.

**Co-located components:** None.

---

### 22. Reports -- Revenue

| Attribute | Value |
|---|---|
| Filesystem | `app/op/(console)/reports/revenue/page.tsx` |
| URL | `/op/reports/revenue` |
| Component type | RSC |
| Auth guard | `getOperatorSession()` |

**Data fetching:**
- `getRevenueReport({ operatorId, dateFrom, dateTo, routeId })` from `@/lib/ledger`
- `getDefaultDateRange(30)` from `@/lib/op`
- Reads `dateFrom`, `dateTo`, `routeId` from `searchParams`

**Co-located components:**

| File | Type | Props | Purpose |
|---|---|---|---|
| `RevenueClient.tsx` | Client (`'use client'`) | `{ initialRows: RevenueRow[], dateFrom: string, dateTo: string, routeId?: string }` | Date filter band (from/to pickers + "Loc" button + CSV download link to `/api/op/reports/revenue.csv`). Revenue table: trip ID, departure time (VN timezone), route, seats sold, gross, platform fee, net payout (VND), payout status badge. Footer totals. Filter triggers `router.push()` for server re-render. |

**API calls (RevenueClient):** None (filter via URL navigation; CSV via anchor link to `/api/op/reports/revenue.csv`).

---

### 23. Reports -- Payouts

| Attribute | Value |
|---|---|
| Filesystem | `app/op/(console)/reports/payouts/page.tsx` |
| URL | `/op/reports/payouts` |
| Component type | RSC |
| Auth guard | `getOperatorSession()` |

**Data fetching:** `getPayoutReport({ operatorId })` from `@/lib/ledger`.

**Co-located components:**

| File | Type | Props | Purpose |
|---|---|---|---|
| `PayoutsClient.tsx` | Client (`'use client'`) | `{ initialRows: PayoutReportRow[] }` | Payout table: route name, departure time, gross, platform fee, net payout, status badge (with failure reason), scheduled date, settled date, action column. Failed payouts: "Thu lai" (Retry) button. On retry success: `router.refresh()`. Error codes: `not_failed`, `not_found`. |

**API calls (PayoutsClient):** `retryPayoutApi(payoutId)` from `@/lib/api` (POST with CSRF).

---

### 24. Staff Management

| Attribute | Value |
|---|---|
| Filesystem | `app/op/(console)/staff/page.tsx` |
| URL | `/op/staff` |
| Component type | RSC |
| Auth guard | `getOperatorSession()` -- admin-only; non-admin redirects to `/op/bookings`. Also calls `getOperatorStaff()`. |

**Data fetching:**
- `getOperatorSession()` from `@/lib/op`
- `getOperatorStaff()` from `@/lib/op` -- returns `{ staff, isAdmin, requiresPasswordChange }`

**Co-located components:**

| File | Type | Props | Purpose |
|---|---|---|---|
| `StaffClient.tsx` | Client (`'use client'`) | `{ initialStaff: StaffDto[], isAdmin: boolean }` | Staff roster table: name, phone, assigned trip, status badge. Admin controls: create-staff form (name + phone), per-row rename (inline input), per-row disable (with ConfirmDialog). Non-admin: read-only roster. |

**API calls (StaffClient):**

| Function | Method | Endpoint |
|---|---|---|
| `listStaffApi()` | GET | `/api/op/staff` |
| `createStaffApi(...)` | POST | `/api/op/staff` |
| `renameStaffApi(staffId, name)` | PATCH | `/api/op/staff/:id` |
| `disableStaffApi(staffId)` | POST | `/api/op/staff/:id/disable` |

---

### 25. Pickup Areas

| Attribute | Value |
|---|---|
| Filesystem | `app/op/(console)/pickup-areas/page.tsx` |
| URL | `/op/pickup-areas` |
| Component type | RSC |
| Auth guard | `getOperatorSession()` -- redirects to `/op/login` or `/op/first-login` |

**Data fetching:**
- `getOperatorSession()` from `@/lib/op`
- `listOperatorPickupAreas({ operatorId })` from `@/lib/catalog`

**Co-located components:**

| File | Type | Props | Purpose |
|---|---|---|---|
| `PickupAreasClient.tsx` | Client (`'use client'`) | `{ initialAreas: PickupAreaItem[] }` | Pickup area CRUD. Add form: name, optional address, kind ("Ben xe" station / "Don tan noi" pickup), cascading `AdminUnitPicker` (province/district/ward). Table: name with kind badge, area label, active/inactive status, edit/deactivate actions. Inline edit mode. Soft-deactivate (never hard-delete for historical booking integrity). Province filter when areas span multiple provinces. |

**API calls (PickupAreasClient):**

| Function | Method | Endpoint |
|---|---|---|
| `listPickupAreasApi()` | GET | `/api/op/pickup-areas` |
| `createPickupAreaApi(...)` | POST | `/api/op/pickup-areas` |
| `updatePickupAreaApi(id, ...)` | PATCH | `/api/op/pickup-areas/:id` |
| `deactivatePickupAreaApi(id)` | POST | `/api/op/pickup-areas/:id/deactivate` |

---

### 26. Profile

| Attribute | Value |
|---|---|
| Filesystem | `app/op/(console)/profile/page.tsx` |
| URL | `/op/profile` |
| Component type | RSC |
| Auth guard | `getOperatorProfile()` from `@/lib/op` -- returns null if not authenticated |

**Data fetching:** `getOperatorProfile()` from `@/lib/op` -- returns `OperatorProfile`.

**Co-located components:**

| File | Type | Props | Purpose |
|---|---|---|---|
| `OpProfileClient.tsx` | Client (`'use client'`) | `{ profile: OperatorProfile }` | Read-only section: login phone, role. Edit form: display name, contact phone, notification phone. Dirty-tracking against loaded profile. Error codes: `PHONES_MUST_DIFFER`, `INVALID_PHONE`. Logout button. |

**API calls (OpProfileClient):**
- `PATCH /api/op/profile` -- update profile fields (CSRF)
- `POST /api/op/auth/logout` -- logout (CSRF)

---

### 27. Settings (Hub)

| Attribute | Value |
|---|---|
| Filesystem | `app/op/(console)/settings/page.tsx` |
| URL | `/op/settings` |
| Component type | RSC |
| Auth guard | `getOperatorSession()` -- redirects to `/op/login` or `/op/first-login` |

**Data fetching:**
- `getOperatorSession()` from `@/lib/op`
- `getPayoutAccount(prisma, session.operatorId)` from `@/lib/onboarding` -- reads masked payout bank account

**What it renders:** Grid of link cards to settings sub-pages (Profile, Staff [admin-only], Pickup Areas, Registration Status, Change Password). Inline `<BankAccountForm>` for payout bank account.

**Co-located components:**

| File | Type | Props | Purpose |
|---|---|---|---|
| `BankAccountForm.tsx` | Client (`'use client'`) | `{ account: MaskedAccount \| null }` | Shows current masked account with verification badge. Form: bank name, account number (never pre-filled), holder name. Warning that editing resets verification. On success: `router.refresh()`. |

**API calls (BankAccountForm):** `POST /api/op/payout-account` with `{ bankName, accountNumber, accountHolderName }` (CSRF).

`MaskedAccount = { bankName: string, accountNumberMasked: string, accountHolderName: string, verified: boolean }`

---

### 28. Activity Feed

| Attribute | Value |
|---|---|
| Filesystem | `app/op/(console)/activity/page.tsx` |
| URL | `/op/activity` |
| Component type | RSC |
| Auth guard | `getOperatorSession()` -- redirects to `/op/login` or `/op/first-login` |

**Data fetching:** `getActivityFeed({ operatorId, limit: 50 })` from `@/lib/op`.

**Co-located components:**

| File | Type | Props | Purpose |
|---|---|---|---|
| `ActivityFeed` (`components/op/ActivityFeed.tsx`) | Client (`'use client'`) | `{ initialEvents: ActivityEvent[], variant: "page", pollIntervalMs?: number }` | Activity event list with severity-colored left border (info/success/warning/danger) and matching icons. Each event: title, body, relative time, optional link. Two variants: "rail" (compact card, 480px) and "page" (full list). Auto-polls `GET /api/op/activity?limit=30` every 30s (pauses when hidden, exponential backoff on errors up to 5 min). ARIA live region for screen readers. |

---

### 29. Charter

| Attribute | Value |
|---|---|
| Filesystem | `app/op/(console)/charter/page.tsx` |
| URL | `/op/charter` |
| Component type | RSC |
| Auth guard | `getOperatorSession()` -- redirects to `/op/login` or `/op/first-login`. `isOperatorApproved()` from `@/lib/charter` gates feature to APPROVED operators. |

**Data fetching (all in `Promise.all`):**
- `isOperatorApproved(prisma, operatorId)` from `@/lib/charter`
- `getAssignedCharters(prisma, operatorId)` from `@/lib/charter` -- assigned, not-yet-actioned leads
- `getAcceptedCharters(prisma, operatorId)` from `@/lib/charter` -- accepted contracts with contact info
- `getPublicPoolCharters(prisma, {})` from `@/lib/charter` -- unclaimed public pool

**What it renders:** Non-APPROVED operators see an "available after approval" alert. Otherwise 3 sections:
1. **Yeu cau duoc giao (Assigned)** -- Directly-assigned charter leads with accept/decline actions. Shows ref, deadline, route, passengers, vehicle type, budget. NO customer contact info (revealed on accept).
2. **Pool cong khai (Public pool)** -- Unclaimed PUBLISHED charters with claim button (first-accept-wins).
3. **Hop dong da nhan (Accepted)** -- Accepted charters WITH customer contact info (name, phone, email) for off-platform fulfillment.

**Co-located components:**

| File | Type | Props | Purpose |
|---|---|---|---|
| `CharterAssignmentActions.tsx` | Client (`'use client'`) | `{ charterId: string }` | Accept and decline buttons. Decline reveals optional reason field. On success: `router.refresh()`. |
| `ClaimButton.tsx` | Client (`'use client'`) | `{ charterId: string }` | "Claim" button for public pool. On 200: refresh. On 409: "already claimed" message + refresh to remove stale card. |

**API calls:**

| Component | Method | Endpoint |
|---|---|---|
| CharterAssignmentActions | POST | `/api/op/charter/:id/accept` (CSRF) |
| CharterAssignmentActions | POST | `/api/op/charter/:id/decline` (CSRF) |
| ClaimButton | POST | `/api/op/charter/:id/claim` (CSRF) |

---

### 30. KYB (Know Your Business)

| Attribute | Value |
|---|---|
| Filesystem | `app/op/(console)/kyb/page.tsx` |
| URL | `/op/kyb` |
| Component type | RSC |
| Auth guard | `getOperatorSession()` (relies on console layout for `requiresPasswordChange` gate) |

**Data fetching (in `Promise.all`):**
- `prisma.operator.findUnique(...)` -- operator status
- `listOperatorKybDocs(prisma, operatorId)` from `@/lib/onboarding` -- submitted KYB documents

**Co-located components:**

| File | Type | Props | Purpose |
|---|---|---|---|
| `KybUpload.tsx` | Client (`'use client'`) | `{ initialDocs: DocView[], status: string, canSubmit: boolean }` | 3 file upload inputs (business_license, identity, payout_account) accepting JPEG/PNG/WebP/PDF. Two-step upload: (1) POST to get signed URL, (2) PUT file to storage. Submitted docs list with status badges. "Submit for review" button (PENDING_REVIEW only, requires at least one doc). Error codes: INVALID_TYPE, INVALID_CONTENT_TYPE, TOO_LARGE. |

`DocView = { id: string, type: string, status: string, uploadedAt: string }`

**API calls (KybUpload):**

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/op/kyb/upload-url` | Get signed upload URL (CSRF) |
| PUT | `{uploadUrl}` | Upload file to storage (signed URL, no CSRF) |
| POST | `/api/op/kyb/submit` | Submit KYB for review (CSRF) |

---

### 31. Registration Status

| Attribute | Value |
|---|---|
| Filesystem | `app/op/(console)/status/page.tsx` |
| URL | `/op/status` |
| Component type | RSC |
| Auth guard | `getOperatorSession()` (relies on console layout for password-change gate). Redirects to `/op/login` if operator record not found. |

**Data fetching:** `prisma.operator.findUnique(...)` -- reads `status`, `rejectionReason`, `applicationRef`, `legalName`.

**What it renders:** PageHeader with title "Trang thai dang ky" and operator legal name. Status-specific content:

| Status | Badge | Content |
|---|---|---|
| PENDING_REVIEW | warning | "Waiting for submission" + link to KYB page |
| UNDER_REVIEW | info | "Under review" + email notification ETA |
| APPROVED | success | "Approved" + link to create trips |
| REJECTED | danger | "Needs supplementation" + rejection reason alert + `<ResubmitButton>` |
| SUSPENDED | danger | "Suspended" + support contact + optional reason |

Application reference number shown at bottom.

**Co-located components:**

| File | Type | Props | Purpose |
|---|---|---|---|
| `ResubmitButton.tsx` | Client (`'use client'`) | (none) | Button to resubmit application (REJECTED to PENDING_REVIEW). `POST /api/op/resubmit` with CSRF. On success: `router.refresh()`. |

---

### 32. Upcoming Trips

| Attribute | Value |
|---|---|
| Filesystem | `app/op/(console)/upcoming/page.tsx` |
| URL | `/op/upcoming` |
| Component type | RSC |
| Auth guard | `getOperatorSession()` -- redirects to `/op/login` or `/op/first-login` |

**Data fetching (in `Promise.all`):**
- `listUpcomingForOperator(operatorId, routeId ? { routeId } : {})` from `@/lib/trips`
- `listRoutes({ operatorId })` from `@/lib/catalog` -- for route filter dropdown
- Reads `routeId` from `searchParams`

**What it renders:** PageHeader with title "Chuyen xe sap khoi hanh" and route filter in header. Trips table: departure time, price, status badge, available seats, manifest link. Empty state card if no upcoming trips.

**Co-located components:**

| File | Type | Props | Purpose |
|---|---|---|---|
| `UpcomingFilter.tsx` | Client (`'use client'`) | `{ routes: RouteOption[], selected: string }` | Route filter dropdown (Select). Default "All routes". On change: `router.push('/op/upcoming?routeId=...')` for server-driven filtering. No API calls (navigational only). |

`RouteOption = { id: string, origin: string, destination: string }`

---

## Complete Client Component Index

| Component | File | Page | API Calls | CSRF |
|---|---|---|---|---|
| `DashboardClient` | `app/op/(console)/bookings/DashboardClient.tsx` | Bookings list | `listBookingsApi` (GET) | No |
| `BookingDetailClient` | `app/op/(console)/bookings/[id]/BookingDetailClient.tsx` | Booking detail | None (read-only) | No |
| `BusesClient` | `app/op/(console)/buses/BusesClient.tsx` | Fleet | 7 CRUD calls via `@/lib/api` | Yes |
| `TripsClient` | `app/op/(console)/trips/TripsClient.tsx` | Trips list | `listTripsApi`, `salesToggleApi`, `cancelTripApi` | Yes |
| `CancelTripDialog` | `app/op/(console)/trips/CancelTripDialog.tsx` | Trips list + detail | None (delegates via callback) | No |
| `NewTripClient` | `app/op/(console)/trips/new/NewTripClient.tsx` | New trip | `createTripApi` | Yes |
| `TripDetailClient` | `app/op/(console)/trips/[id]/TripDetailClient.tsx` | Trip detail | 7 management calls via `@/lib/api` | Yes |
| `RoutesClient` | `app/op/(console)/routes/RoutesClient.tsx` | Routes | 4 CRUD calls via `@/lib/api` | Yes |
| `RouteEditDialog` | `app/op/(console)/routes/RouteEditDialog.tsx` | Routes | None (delegates via callback) | No |
| `RoutePickupAreaDialog` | `app/op/(console)/routes/RoutePickupAreaDialog.tsx` | Routes | 3 calls via `@/lib/api` | Yes |
| `TemplatesClient` | `app/op/(console)/trip-templates/TemplatesClient.tsx` | Trip templates | 2 calls via `@/lib/api` + direct fetch | Yes |
| `ManifestRefresh` | `app/op/(console)/manifest/[tripId]/ManifestRefresh.tsx` | Manifest detail | 4 direct fetch calls | Yes |
| `WithdrawButton` | `app/op/(console)/money/WithdrawButton.tsx` | Money | 1 direct fetch (+ Idempotency-Key) | Yes |
| `RevenueClient` | `app/op/(console)/reports/revenue/RevenueClient.tsx` | Revenue report | None (URL navigation + CSV anchor) | No |
| `PayoutsClient` | `app/op/(console)/reports/payouts/PayoutsClient.tsx` | Payouts report | `retryPayoutApi` | Yes |
| `StaffClient` | `app/op/(console)/staff/StaffClient.tsx` | Staff | 4 CRUD calls via `@/lib/api` | Yes |
| `PickupAreasClient` | `app/op/(console)/pickup-areas/PickupAreasClient.tsx` | Pickup areas | 4 CRUD calls via `@/lib/api` | Yes |
| `OpProfileClient` | `app/op/(console)/profile/OpProfileClient.tsx` | Profile | 2 direct fetch calls | Yes |
| `BankAccountForm` | `app/op/(console)/settings/BankAccountForm.tsx` | Settings | 1 direct fetch call | Yes |
| `ActivityFeed` | `components/op/ActivityFeed.tsx` | Activity + Dashboard | Auto-polls GET `/api/op/activity` | No |
| `CharterAssignmentActions` | `app/op/(console)/charter/CharterAssignmentActions.tsx` | Charter | 2 direct fetch calls | Yes |
| `ClaimButton` | `app/op/(console)/charter/ClaimButton.tsx` | Charter | 1 direct fetch call | Yes |
| `KybUpload` | `app/op/(console)/kyb/KybUpload.tsx` | KYB | 3 calls (signed URL + upload + submit) | Yes |
| `ResubmitButton` | `app/op/(console)/status/ResubmitButton.tsx` | Status | 1 direct fetch call | Yes |
| `TodayTripsStrip` | `components/op/TodayTripsStrip.tsx` | Dashboard | None (display-only) | No |
| `InboxStream` | `components/op/InboxStream.tsx` | Dashboard | None (display-only) | No |
| `UpcomingFilter` | `app/op/(console)/upcoming/UpcomingFilter.tsx` | Upcoming | None (navigational only) | No |
| `StaffDashboardClient` | `app/op/staff/dashboard/StaffDashboardClient.tsx` | Staff dashboard | (staff-specific) | Yes |

All `'use client'` components that make non-GET requests use `readCsrfToken()` from `@/lib/auth/csrfClient` (deep import, not barrel -- per the client-component barrel-safety rule in AGENTS.md).

---

## Auth Guard Summary

| Guard Function | Source | Used By |
|---|---|---|
| `getOperatorSession()` | `@/lib/op` | Console layout + most pages |
| `getOperatorFleet()` | `@/lib/op` | Buses page (combines session + fleet data) |
| `getOperatorStaff()` | `@/lib/op` | Trip detail + Staff page (includes staff list + isAdmin) |
| `getOperatorProfile()` | `@/lib/op` | Profile page |
| `getStaffDashboard()` | `@/lib/op` | Staff dashboard page |

All redirect to `/op/login` when unauthenticated and to `/op/first-login` when `requiresPasswordChange` is true. Detail pages (`[id]` params) additionally call `notFound()` when the entity is missing or belongs to another operator.
