# 24 — React Components

All shared components live in `components/`. Total: 63 files across 14 subdirectories.

Built with React 19, @base-ui/react primitives, Tailwind v4.

---

## UI Primitives (`components/ui/`)

Base components, mostly shadcn/ui-style wrappers over @base-ui/react:

| File | Component | Description |
|------|-----------|-------------|
| `alert.tsx` | `Alert`, `AlertTitle`, `AlertDescription` | Alert banner (info/warning/error variants) |
| `badge.tsx` | `Badge` | Status/label badge (color variants) |
| `button.tsx` | `Button` | Primary action button (size/variant props) |
| `calendar.tsx` | `Calendar` | Date picker calendar grid |
| `card.tsx` | `Card`, `CardHeader`, `CardContent`, `CardFooter` | Content card container |
| `checkbox.tsx` | `Checkbox` | Checkbox input with label |
| `combobox.tsx` | `Combobox` | Searchable select dropdown |
| `date-picker.tsx` | `DatePicker` | Date input with calendar popup |
| `dialog.tsx` | `Dialog`, `DialogTrigger`, `DialogContent` | Modal dialog |
| `input.tsx` | `Input` | Text input with label + error state |
| `label.tsx` | `Label` | Form label |
| `radio-group.tsx` | `RadioGroup`, `RadioGroupItem` | Radio button group |
| `select.tsx` | `Select`, `SelectTrigger`, `SelectContent`, `SelectItem` | Dropdown select |
| `skeleton.tsx` | `Skeleton` | Loading placeholder |
| `sparkline.tsx` | `Sparkline` | Inline mini chart (KPI tiles) |
| `table.tsx` | `Table`, `TableHead`, `TableRow`, `TableCell` | Data table |
| `tabs.tsx` | `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | Tab navigation |
| `toast.tsx` | `Toast`, `useToast` | Toast notification |

---

## Layout (`components/layout/`)

| File | Component | Description |
|------|-----------|-------------|
| `SiteHeader.tsx` | `SiteHeader` | Global top nav — logo, search link, auth buttons (customer portal) |
| `SiteFooter.tsx` | `SiteFooter` | Global footer — links, legal, social |

---

## Auth (`components/auth/`)

| File | Component | Description |
|------|-----------|-------------|
| `AuthSplitLayout.tsx` | `AuthSplitLayout` | Two-column auth layout — form left, brand right. Used by all login/register pages |

---

## Brand (`components/brand/`)

| File | Component | Description |
|------|-----------|-------------|
| `Logo.tsx` | `Logo` | SVG logo + text. Reusable across all 3 portals |

---

## Booking Flow (`components/booking/`)

| File | Component | Description |
|------|-----------|-------------|
| `BookingSteps.tsx` | `BookingSteps` | Step indicator (Search → Customer → Review → Confirmation). Highlights current step |
| `BookingSummaryRail.tsx` | `BookingSummaryRail` | Side panel showing trip details + seat count + price during booking flow |

---

## Search (`components/search/`)

| File | Component | Description |
|------|-----------|-------------|
| `SearchForm.tsx` | `SearchForm` | Main search input — origin, destination, date, passenger count. Submits as URL params |
| `SearchFormWrapper.tsx` | `SearchFormWrapper` | Layout wrapper for search form (hero vs compact) |
| `SearchFilters.tsx` | `SearchFilters` | Advanced filters — time range, price range, bus type, amenities |
| `SearchStoreHydrator.tsx` | `SearchStoreHydrator` | Hydrates Zustand search store from URL params on mount |
| `BookButton.tsx` | `BookButton` | "Book now" button on trip cards — triggers hold creation via POST `/api/holds` |

---

## Ticket (`components/ticket/`)

| File | Component | Description |
|------|-----------|-------------|
| `TripDetailCard.tsx` | `TripDetailCard` | Trip info card — operator name, route, departure time, bus type, amenities |

---

## Hold/Expiry (root `components/`)

| File | Component | Description |
|------|-----------|-------------|
| `HoldTimer.tsx` | `HoldTimer` | Countdown timer showing remaining hold time. Reads from `useHoldTimerStore()` |
| `HoldExpiryModal.tsx` | `HoldExpiryModal` | Modal warning when hold expires — option to restart or abandon |
| `__tests__/HoldTimer.test.tsx` | — | Unit test for HoldTimer countdown logic |

---

## Home Page (`components/home/`)

| File | Component | Description |
|------|-----------|-------------|
| `IntroBanner.tsx` | `IntroBanner` | Hero section — headline, search CTA, background |
| `FeatureHighlights.tsx` | `FeatureHighlights` | Feature cards — safety, convenience, pricing |
| `ContractCarRental.tsx` | `ContractCarRental` | Charter/car rental CTA section |
| `RouteDirectory.tsx` | `RouteDirectory` | Popular routes grid with links |
| `PopularTrips.tsx` | `PopularTrips` | Featured trips carousel |
| `TrustStrip.tsx` | `TrustStrip` | Trust badges — operator count, trip count, booking count |

---

## Operator Portal (`components/op/`)

| File | Component | Description |
|------|-----------|-------------|
| `OperatorNav.tsx` | `OperatorNav` | Sidebar navigation — links to all console sections, collapse state |
| `OperatorNavContext.tsx` | `OperatorNavContext` | React Context for nav collapse/expand state |
| `OperatorBottomNav.tsx` | `OperatorBottomNav` | Mobile bottom tab bar |
| `OperatorPillMenu.tsx` | `OperatorPillMenu` | Pill-shaped filter/sort menu (mobile) |
| `ConsoleHeader.tsx` | `ConsoleHeader` | Top bar — breadcrumbs, user menu, notifications |
| `Breadcrumbs.tsx` | `Breadcrumbs` | Navigation breadcrumb trail |
| `PageHeader.tsx` | `PageHeader` | Page title + action buttons row |
| `DetailLayout.tsx` | `DetailLayout` | Two-column layout for detail pages (main + sidebar) |
| `DataTable.tsx` | `DataTable` | Generic sortable/paginated table — used for bookings, trips, buses, routes, staff |
| `FilterBar.tsx` | `FilterBar` | Filter controls above data tables |
| `EmptyState.tsx` | `EmptyState` | No results placeholder with icon + message |
| `KpiTile.tsx` | `KpiTile` | Single KPI metric card — value, label, trend sparkline |
| `TodayTripsStrip.tsx` | `TodayTripsStrip` | Today's trip summary bar (departure times, occupancy) |
| `TripMiniCard.tsx` | `TripMiniCard` | Compact trip card for upcoming trips view |
| `CommandPalette.tsx` | `CommandPalette` | Cmd+K quick action search overlay |
| `ConfirmDialog.tsx` | `ConfirmDialog` | Confirmation modal for destructive actions (cancel, deactivate) |
| `ActivityFeed.tsx` | `ActivityFeed` | Timeline of operator actions (bookings, departures, payouts) |
| `InboxStream.tsx` | `InboxStream` | Real-time notification list |
| `EnvBadge.tsx` | `EnvBadge` | Dev/staging/prod environment indicator badge |
| `ApprovalBanner.tsx` | `ApprovalBanner` | Status banner for operators pending approval |

---

## Admin Portal (`components/admin/`)

| File | Component | Description |
|------|-----------|-------------|
| `AdminNav.tsx` | `AdminNav` | Admin sidebar navigation — approvals, operators, finance, moderation, system |

---

## Charter (`components/charter/`)

| File | Component | Description |
|------|-----------|-------------|
| `CancelCharterButton.tsx` | `CancelCharterButton` | Cancel charter request with confirmation dialog |

---

## Contact (`components/contact/`)

| File | Component | Description |
|------|-----------|-------------|
| `ContactBookingForm.tsx` | `ContactBookingForm` | Charter request form — origin/destination, date range, passenger count, phone, notes. Uses CSRF token via `readCsrfToken()` (deep import from `@/lib/auth/csrfClient`) |

---

## Geographic (`components/geo/`)

| File | Component | Description |
|------|-----------|-------------|
| `AdminUnitPicker.tsx` | `AdminUnitPicker` | Cascading province → district → ward picker. Fetches from `/api/geo` |

---

## Key Patterns

1. **`'use client'` boundary** — all interactive components use `'use client'` directive. Import `readCsrfToken` from `@/lib/auth/csrfClient` (deep), never from `@/lib/auth` barrel
2. **@base-ui/react** — primitives from Base UI (not MUI). `onChange` is internal; public API is `onValueChange`
3. **Tailwind v4** — utility classes, no CSS modules. Orange primary color
4. **Zustand stores** — `useSearchStore`, `useHoldTimerStore`, `useBookingStore` for client state
5. **No server-only imports** — components never import from lib/ barrels that pull server-only transitives
