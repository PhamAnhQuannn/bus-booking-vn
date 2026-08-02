# 17 — Customer-Facing Pages

Filesystem root: `app/(customer)/`
URL root: `/` (route group parentheses stripped)

---

## Architecture

Customer pages sit inside the `(customer)` route group. Two sub-layouts exist:
- `app/(customer)/booking/layout.tsx` — booking flow wrapper (step indicator, summary rail)
- `app/(customer)/account/layout.tsx` — account section wrapper (sidebar nav)

Root layout (`app/layout.tsx`) provides `SiteHeader` + `SiteFooter` for all customer pages.

**Note:** Customer accounts are currently paused (Layer 0.5 in `proxy.ts`). Auth pages redirect to `/`, account API routes return 410 Gone. Code retained for re-enable.

---

## Page Reference

### Home & Discovery

| URL | File | Type | Description |
|-----|------|------|-------------|
| `/` | `app/(customer)/page.tsx` | RSC | Landing page — hero banner, feature highlights, popular trips, route directory, trust strip, charter CTA |
| `/search` | `app/(customer)/search/page.tsx` | RSC | Trip search results — reads query params (origin, destination, date, passengers), calls `searchTrips()`, renders trip cards with `BookButton` |
| `/routes` | `app/(customer)/routes/page.tsx` | RSC | Browse all routes — `RoutesBrowser` client component for filtering |
| `/trips/[id]` | `app/(customer)/trips/[id]/page.tsx` | RSC | Trip detail — pickup areas, bus info, pricing, `TripBooking` client component for hold creation |

### Booking Flow

| URL | File | Type | Description |
|-----|------|------|-------------|
| `/booking/review` | `app/(customer)/booking/review/page.tsx` | RSC | Review hold details — reads `bb_hold` cookie, calls `getHoldDetails()` in-process (no self-fetch), renders `ReviewClient` for payment initiation |
| `/booking/customer` | `app/(customer)/booking/customer/page.tsx` | RSC | Customer info entry — `CustomerForm` client component for contact details + consent capture |
| `/booking/confirmation/[token]` | `app/(customer)/booking/confirmation/[token]/page.tsx` | RSC | Booking success — verifies confirmation token, shows booking ref + trip details |
| `/booking/result/[token]` | `app/(customer)/booking/result/[token]/page.tsx` | RSC | Payment return — handles PSP redirect back, shows payment result |

### Charter (Group Booking)

| URL | File | Type | Description |
|-----|------|------|-------------|
| `/lien-he-dat-xe` | `app/(customer)/lien-he-dat-xe/page.tsx` | RSC | Charter request form — `ContactBookingForm` client component |
| `/lien-he-dat-xe/confirmation` | `app/(customer)/lien-he-dat-xe/confirmation/page.tsx` | RSC | Charter submission confirmation — shows charter ref |
| `/charter/status/[ref]` | `app/(customer)/charter/status/[ref]/page.tsx` | RSC | Charter status tracker — shows current state, `CancelCharterButton` if cancellable |

### Auth (Currently Paused)

| URL | File | Type | Description |
|-----|------|------|-------------|
| `/auth/login` | `app/(customer)/auth/login/page.tsx` | Client | OTP-based login — phone input, OTP verify |
| `/auth/register` | `app/(customer)/auth/register/page.tsx` | Client | Sign up — phone + password + display name |
| `/auth/forgot-password` | `app/(customer)/auth/forgot-password/page.tsx` | Client | Password recovery initiation |
| `/auth/reset-password` | `app/(customer)/auth/reset-password/page.tsx` | Client | Set new password (via reset token) |

### Account (Currently Paused)

| URL | File | Type | Description |
|-----|------|------|-------------|
| `/account/bookings` | `app/(customer)/account/bookings/page.tsx` | RSC | Booking history — paginated, filterable by status |
| `/account/bookings/[id]` | `app/(customer)/account/bookings/[id]/page.tsx` | RSC | Single booking detail — trip info, ticket download |
| `/account/settings` | `app/(customer)/account/settings/page.tsx` | RSC | Profile settings — display name, phone, password change |

---

## Root-Level Pages

| URL | File | Type | Description |
|-----|------|------|-------------|
| `/privacy` | `app/privacy/page.tsx` | RSC | Privacy policy |
| `/terms` | `app/terms/page.tsx` | RSC | Terms of service |
| `/verify/[token]` | `app/verify/[token]/page.tsx` | RSC | Email verification |
| (all) | `app/layout.tsx` | RSC | Root layout — `SiteHeader`, `SiteFooter`, font loading, metadata |
| (error) | `app/error.tsx` | Client | Error boundary |
| (error) | `app/global-error.tsx` | Client | Global error page |
| (404) | `app/not-found.tsx` | RSC | Not found page |
| (OG) | `app/opengraph-image.tsx` | RSC | OpenGraph meta image generator |

---

## Co-Located Client Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `ReviewClient` | `app/(customer)/booking/review/` | Payment method selection, initiate payment via `createHoldRequest()` |
| `CustomerForm` | `app/(customer)/booking/customer/` | Contact info form, consent checkbox, pickup selection |
| `TripBooking` | `app/(customer)/trips/[id]/` | Seat count selector, hold creation trigger |
| `RoutesBrowser` | `app/(customer)/routes/` | Client-side route filtering and search |
| `ContactBookingForm` | `components/contact/` | Charter request form (origin, destination, date, passengers, phone) |
| `CancelCharterButton` | `components/charter/` | Cancel charter with confirmation dialog |

---

## Layouts

| Layout | File | Provides |
|--------|------|----------|
| Root | `app/layout.tsx` | `SiteHeader`, `SiteFooter`, HTML metadata, fonts |
| Booking | `app/(customer)/booking/layout.tsx` | `BookingSteps` progress indicator, `BookingSummaryRail` |
| Account | `app/(customer)/account/layout.tsx` | Account sidebar navigation |

---

## Data Flow Summary

1. **Search** — URL params → `searchTrips()` (RSC, in-process) → trip cards
2. **Hold** — `BookButton` → POST `/api/holds` → `bb_hold` cookie set → redirect to `/booking/review`
3. **Review** — `bb_hold` cookie → `getHoldDetails()` (in-process, no self-fetch) → payment initiation
4. **Payment** — POST `/api/bookings/initiate` → PSP redirect → webhook → booking created
5. **Confirmation** — `/booking/confirmation/[token]` → `getBookingByConfirmationToken()` → success page
