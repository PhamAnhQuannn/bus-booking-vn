# Frontend Design — Spec vs Reality

Comparison of 30 FD (Frontend Design) specs against actual component/page inventory from `current-status/17-19` (pages) and `current-status/24` (components).

---

## FD Spec Coverage Matrix

| Spec | Title | Status | Notes |
|---|---|---|---|
| FD-001 | Design System | IMPLEMENTED | 63 components (shadcn/base-ui): Button, Input, Dialog, Table, Card, etc. |
| FD-002 | Navigation Pattern | IMPLEMENTED | SiteHeader, SiteFooter, OperatorNav, OperatorBottomNav, AdminNav |
| FD-003 | Page Inventory | IMPLEMENTED | 18 customer + 32 operator + 11 admin pages match spec |
| FD-004 | Form Design | IMPLEMENTED | Zod schema validation, form components, contact form |
| FD-005 | Motion & Interaction | PARTIAL | Basic transitions exist; no systematic motion design system |
| FD-006 | i18n Design | NOT STARTED | No internationalization framework. All text hardcoded in Vietnamese/English mix |
| FD-007 | Responsive & Mobile | IMPLEMENTED | Tailwind responsive classes; OperatorBottomNav for mobile; Playwright mobile-390 viewport |
| FD-008 | Accessibility | PARTIAL | shadcn components include ARIA; no systematic a11y audit executed |
| FD-009 | State Management | IMPLEMENTED | Zustand stores: searchStore, holdTimerStore, bookingStore, operatorStore |
| FD-010 | Error & Loading States | IMPLEMENTED | `error.tsx`, `global-error.tsx`, `not-found.tsx`, Skeleton components |
| FD-011 | Data Fetching | IMPLEMENTED | RSC data fetching, `lib/api/` client SDK, SWR-like patterns |
| FD-012 | Authentication | IMPLEMENTED | OTP login (soft-disabled), operator password, admin TOTP |
| FD-013 | Search Results | IMPLEMENTED | SearchForm, SearchFilters, SearchFormWrapper, SearchStoreHydrator |
| FD-014 | Hold Timer | IMPLEMENTED | HoldTimer.tsx (countdown), HoldExpiryModal.tsx (expiry notification) |
| FD-015 | Payment Checkout | PARTIAL | MoMo/VNPay payment flow stubs; no VietQR/SePay display page; no ZaloPay |
| FD-016 | Booking Confirmation | IMPLEMENTED | Confirmation page with token-based access, booking summary |
| FD-017 | Booking Lifecycle | IMPLEMENTED | Customer booking list, detail view, status tracking |
| FD-018 | Cancellation & Refund | NOT IMPLEMENTED | No customer cancellation UI; no refund status display |
| FD-019 | Consent & Privacy | PARTIAL | `lib/booking/consent.ts` (CONSENT_VERSION, CONSENT_TEXT); no standalone consent management UI |
| FD-020 | Complaint Tracking | PARTIAL | Charter request flow exists; no general complaint submission/tracking UI |
| FD-021 | Operator Onboarding | IMPLEMENTED | Registration, KYB upload, approval waiting, first-login password change |
| FD-022 | Operator Fleet & Trips | IMPLEMENTED | Bus CRUD, Route CRUD, Trip CRUD + lifecycle, manifest, check-in |
| FD-023 | E-Invoice | PARTIAL | `lib/einvoice/` exists; e-invoice display/download UI unclear |
| FD-024 | Operator Dashboard | IMPLEMENTED | Dashboard with KPI tiles, today's trips strip, activity feed |
| FD-025 | Operator Branding | NOT STARTED | No operator custom branding/theming system |
| FD-026 | Admin Console | IMPLEMENTED | Approvals, finance, moderation, users, charter, system flags |
| FD-027 | Performance Budget | NOT MEASURABLE | No performance monitoring deployed; LCP/FID/CLS targets defined but unmeasured |
| FD-028 | Portal Architecture | IMPLEMENTED | Route groups: (customer), op/, admin/ with isolated layouts |
| FD-029 | Notifications | PARTIAL | SMS stub only; no in-app notification UI; no push notifications |
| FD-030 | Staff Console | IMPLEMENTED | `app/op/staff/dashboard` with staff-specific view |

---

## Summary by Status

| Status | Count | FD Specs |
|---|---|---|
| IMPLEMENTED | 19 | FD-001 through FD-004, FD-007, FD-009 through FD-014, FD-016, FD-017, FD-021, FD-022, FD-024, FD-026, FD-028, FD-030 |
| PARTIAL | 7 | FD-005, FD-008, FD-015, FD-019, FD-020, FD-023, FD-029 |
| NOT IMPLEMENTED | 2 | FD-018, FD-025 |
| NOT STARTED | 1 | FD-006 |
| NOT MEASURABLE | 1 | FD-027 |

**Coverage:** 19/30 fully implemented (63%), 26/30 at least partially (87%)

---

## Page Inventory Cross-Check

### Customer Pages (FD-003 vs current-status/17)

| Page | Spec | Status |
|---|---|---|
| Home/Landing | FD-003 | IMPLEMENTED (`app/(customer)/page.tsx`) |
| Search Results | FD-003 | IMPLEMENTED (`app/(customer)/search/`) |
| Trip Detail | FD-003 | IMPLEMENTED (`app/(customer)/trips/[id]/`) |
| Hold → Review | FD-003 | IMPLEMENTED (`app/(customer)/booking/review/`) |
| Payment | FD-003 | IMPLEMENTED (`app/(customer)/booking/customer/`) |
| Confirmation | FD-003 | IMPLEMENTED (`app/(customer)/booking/confirmation/[token]/`) |
| Booking Result | FD-003 | IMPLEMENTED (`app/(customer)/booking/result/[token]/`) |
| Auth (login/register) | FD-003 | IMPLEMENTED (soft-disabled via proxy) |
| Account (bookings/settings) | FD-003 | IMPLEMENTED (soft-disabled) |
| Charter Request | FD-003 | IMPLEMENTED (`app/(customer)/charter/`) |
| Contact Form | FD-003 | IMPLEMENTED (`app/(customer)/lien-he-dat-xe/`) |
| Routes Directory | FD-003 | IMPLEMENTED (`app/(customer)/routes/`) |

### Operator Pages (FD-003 vs current-status/18)

**32 pages documented.** All match spec. Key pages:
- Dashboard, Bookings (list + detail), Trips (list + new + detail)
- Buses (list + detail), Routes, Manifest (list + trip detail)
- Staff, Charter, Money (withdrawals), KYB, Payout Account
- Reports (overview, payouts, revenue, revenue CSV)
- Profile, Settings, Status, Trip Templates, Activity, Upcoming

### Admin Pages (FD-003 vs current-status/19)

**11 pages documented.** All match spec:
- Login, Dashboard, Approvals, Operators (list + detail)
- Users (list + kind/id detail), Finance, Moderation, Charter
- System (admins, flags, audit)

---

## Component Inventory Cross-Check (FD-001 vs current-status/24)

**63 components documented across categories:**

| Category | Components | Status |
|---|---|---|
| UI Primitives | Button, Card, Input, Label, Textarea, Dialog, Select, Combobox, Table, Tabs, Radio, Checkbox, Badge, Alert, Skeleton, Toast, Calendar, DatePicker, Sparkline | IMPLEMENTED |
| Auth | AuthSplitLayout | IMPLEMENTED |
| Admin | AdminNav, navConfig | IMPLEMENTED |
| Operator | OperatorNav, OperatorBottomNav, ConsoleHeader, DataTable, PageHeader, DetailLayout, FilterBar, ConfirmDialog, CommandPalette, OperatorPillMenu, Breadcrumbs, KpiTile, TodayTripsStrip, TripMiniCard, ApprovalBanner, EnvBadge, ActivityFeed, InboxStream, EmptyState | IMPLEMENTED |
| Search | SearchForm, SearchFormWrapper, SearchFilters, SearchStoreHydrator, BookButton | IMPLEMENTED |
| Booking | BookingSteps, BookingSummaryRail | IMPLEMENTED |
| Home | IntroBanner, FeatureHighlights, PopularTrips, TrustStrip, RouteDirectory, ContractCarRental | IMPLEMENTED |
| Contact | ContactBookingForm | IMPLEMENTED |
| Charter | CancelCharterButton | IMPLEMENTED |
| Ticket | TripDetailCard | IMPLEMENTED |
| Geo | AdminUnitPicker | IMPLEMENTED |
| Layout | SiteHeader, SiteFooter | IMPLEMENTED |
| Brand | Logo | IMPLEMENTED |
| Hold | HoldTimer, HoldExpiryModal | IMPLEMENTED |

---

## Key Frontend Gaps

### 1. Customer Cancellation & Refund UI (FD-018) — NOT IMPLEMENTED
- No cancel button on booking detail page
- No refund status display
- No refund history view
- Blocked by missing backend endpoint (`POST /api/bookings/[id]/cancel`)

### 2. i18n Framework (FD-006) — NOT STARTED
- All text hardcoded
- No `next-intl`, `react-i18next`, or similar
- Vietnamese and English content mixed without localization layer
- Not a launch blocker for Vietnam-only market but limits expansion

### 3. Operator Branding (FD-025) — NOT STARTED
- No per-operator color theme, logo upload, or custom branding
- All operators share platform default theme
- Future feature, not launch blocker

### 4. VietQR Payment Display Page (FD-015) — NOT IMPLEMENTED
- DS-013 specifies a QR code display page: `/booking/bank-transfer?bookingRef=...`
- Server-side memo pre-fill via `img.vietqr.io`
- Copy-to-clipboard for memo and amount
- Blocked by SePay integration not being built

### 5. Performance Monitoring (FD-027) — NOT MEASURABLE
- Spec defines targets: LCP ≤ 2.5s, FID ≤ 100ms, CLS ≤ 0.1
- No RUM (Real User Monitoring) deployed
- No Lighthouse CI integration
- Cannot verify performance budget compliance
