---
title: Customer page specs
date: 2026-05-27
design-language: v1.0
template: ./_template.md
patterns: ../patterns/_index.md
---

# Customer page specs

All customer routes, each assembling pattern-library `PTN-id`s + an OTA precedent.

### `/`  —  Home
- **Audience / goal:** any visitor; start a search in <10s.
- **OTA precedent:** Expedia / Google Flights hero landing; Vexere home.
- **Patterns:** PTN-01, PTN-02, PTN-14.
- **Layout (desktop):** full-bleed gradient hero → headline + search card (origin/dest combobox, date, ticket count) → trust row (3 cards) → **destination-inspiration / popular-routes tile strip** (new, links to `/routes` + prefilled search).
- **Layout (mobile):** hero padding shrinks; search fields stack; inspiration tiles 1-col scroll.
- **States:** idle; search submitting; (no list here).
- **CTA hierarchy:** primary = "Tìm chuyến"; tertiary = inspiration tiles.
- **A11y:** `<main>` + h1; combobox aria; trust icons `aria-hidden`.
- **Open:** add imagery to inspiration tiles? (asset dependency).

### `/search`  —  Trip results  ★ flagship
- **Audience / goal:** searcher; compare + pick a trip.
- **OTA precedent:** Booking/Expedia/Google Flights results; Vexere bus results.
- **Patterns:** PTN-01, PTN-03 (results+filter rail), PTN-04 (trip card), PTN-12, PTN-14 (seats-left).
- **Layout (desktop):** condensed sticky search summary on top → **2-col: left sticky filter rail** (operator, time window, bus type, price, max duration) + **right: sort bar + result count + active-filter chips + trip-card list + ±1-day nav**.
- **Layout (mobile):** "Bộ lọc (N)" → bottom-sheet; sort inline; chips wrap; sticky result count.
- **States:** loading skeleton cards; empty-base (try other dates); empty-filtered (bỏ bớt bộ lọc, facets kept); results.
- **CTA hierarchy:** primary per card = "Đặt vé"; "Xem chi tiết" tertiary; filters secondary.
- **A11y:** `<aside aria-label="Bộ lọc">`; chips removable buttons; `aria-live` count; cards `<article>`.
- **Open:** "compare types" inline expansion (PTN-05) now or later?
- **Upgrade note:** existing collapsible `SearchFilters` → promote to PTN-03 persistent rail.

### `/routes`  —  Browse all routes
- **Goal:** discover destinations without a query.
- **OTA precedent:** Booking destination browse; Expedia inspiration.
- **Patterns:** PTN-01, PTN-04 (route variant: origin→dest + from-price + operator count + duration), PTN-12.
- **Layout (desktop):** text filter + card grid (2–3 col); optional sort (price/duration/popularity).
- **Layout (mobile):** 1-col grid.
- **States:** loading skeleton; empty (no routes); results.
- **CTA:** card → prefilled `/search`.
- **A11y:** grid as list; cards labelled.
- **Open:** route imagery assets.

### `/trips/[id]`  —  Trip detail
- **Goal:** confirm a specific trip + book.
- **OTA precedent:** AA flight detail; ANA itinerary + amenities.
- **Patterns:** PTN-01, PTN-13 (breadcrumb), PTN-06 (detail), PTN-05 (type/tier context), PTN-07-mini (sticky CTA bar), PTN-14.
- **Layout (desktop):** breadcrumb → route+operator header → facts grid (depart/duration/bus type/seats + amenity icons) → pickup points → operator contact → sticky price + ticket-stepper + "Đặt vé" bar.
- **Layout (mobile):** facts 1-col; sticky bar full-width bottom.
- **States:** bookable; not-bookable → 404; low-seats warning.
- **CTA:** primary = "Đặt vé"; stepper secondary.
- **A11y:** breadcrumb nav; heading outline; tel link; stepper aria-live.

### `/booking/customer`  —  Checkout step 1 (buyer info)
- **Goal:** enter passenger details.
- **OTA precedent:** Expedia checkout traveler step.
- **Patterns:** PTN-01, PTN-08 (step 1), PTN-07 (summary rail), PTN-11 (form), PTN-14.
- **Layout (desktop):** content (buyer name/phone form) + **right sticky summary rail** (route/time/pax/price/total + hold timer + trust).
- **Layout (mobile):** rail → sticky bottom total+CTA bar.
- **States:** filling/validating/submitting; sold_out; rate_limited; error; hold-expiring.
- **CTA:** primary "Tiếp tục".
- **A11y:** labelled fields; error under field; summary `aria-live` total.

### `/booking/review`  —  Checkout step 2 (review + pay method)
- **Goal:** confirm + choose payment.
- **OTA precedent:** Expedia/Booking review + payment step.
- **Patterns:** PTN-01, PTN-08 (step 2), PTN-07 (summary rail), PTN-14, PTN-11.
- **Layout (desktop):** order summary + **payment-method selector with method icons** (MoMo/ZaloPay/card/cash) + summary rail + hold timer.
- **Layout (mobile):** rail → bottom bar.
- **States:** ready/submitting/error/hold-expiring.
- **CTA:** primary "Thanh toán" (or "Đặt vé — trả tiền mặt"); payment radios secondary.
- **A11y:** radiogroup labels + icons w/ text; total aria-live.
- **Fix:** add method icons + selected-state motion (scorecard fix #2).

### `/booking/result/[token]`  —  Payment result (polling)
- **Goal:** show pending/paid/failed outcome.
- **OTA precedent:** OTA payment-processing/confirmation interstitial.
- **Patterns:** PTN-01, PTN-12 (status states), PTN-14.
- **Layout:** status header (icon + message) + summary card + auto-refresh while pending.
- **States:** awaiting (spinner + reassurance); paid → link to confirmation; failed → retry/back to search.
- **CTA:** contextual (view confirmation / try again).
- **A11y:** `role="status"` live region for status; meta-refresh announced.

### `/booking/confirmation/[token]`  —  Confirmation (e-ticket)
- **Goal:** proof of booking + next steps.
- **OTA precedent:** AA itinerary confirmation / e-ticket.
- **Patterns:** PTN-01, PTN-06 (itinerary), PTN-14.
- **Layout:** success header + **booking ref (mono, prominent)** + status badge → trip itinerary card + buyer/booking details + operator contact → **next-steps** (cash-pay notice / "operator will call"). Add: **add-to-calendar + QR/boarding info** (new).
- **States:** paid; cash-pending (warning banner); cancelled.
- **CTA:** secondary = download/ticket, view in account.
- **A11y:** h1 success; details as description list.

### `/dev/stub-pay`  —  Stub payment gateway (dev, live under PAYMENTS_STUB)
- **Goal:** simulate gateway pay success/fail.
- **OTA precedent:** hosted PSP checkout (brand + trust).
- **Patterns:** PTN-07-mini, PTN-14.
- **Layout:** branded header + order summary Card + Thanh toán / Thất bại buttons (done this session).
- **States:** ready; (server action submits).
- **A11y:** form labels; buttons action-verb.

### `/auth/login`, `/register`, `/forgot-password`, `/reset-password`
- **Goal:** authenticate / recover.
- **OTA precedent:** OTA account auth (clean centered card; optional brand split-panel).
- **Patterns:** PTN-01 (auth-minimal shell), PTN-11 (form), PTN-12.
- **Layout (desktop):** centered card (max-w-md); optional left brand panel for polish.
- **Layout (mobile):** full-width card.
- **States:** filling/validating/submitting; OTP-sent; rate-limited/locked; error.
- **CTA:** one primary per step; links to sibling auth pages.
- **A11y:** labels, error summary, OTP input aria, password visibility toggle.

### `/account/bookings`  —  My Trips
- **Goal:** see upcoming/past bookings + manage.
- **OTA precedent:** AA/Expedia "My Trips".
- **Patterns:** PTN-01, PTN-13, Tabs (upcoming/past), PTN-04 (my-trip card w/ status badge + manage link), PTN-09 or card list, PTN-12.
- **Layout (desktop):** breadcrumb + tabs + booking cards (route/date/status/ref + "Quản lý"); cursor pagination.
- **Layout (mobile):** stacked cards.
- **States:** loading skeleton; empty ("chưa có chuyến nào" + CTA to search); error.
- **CTA:** card → detail; tabs secondary.
- **A11y:** tablist aria; status badges non-color-only.

### `/account/bookings/[id]`  —  Booking detail / manage
- **Goal:** view + manage one booking.
- **OTA precedent:** OTA manage-booking detail.
- **Patterns:** PTN-01, PTN-13, PTN-06 (itinerary), PTN-14, PTN-09 (actions).
- **Layout:** breadcrumb → itinerary card → details → **manage actions** (download ticket/PDF, contact operator; cancel if policy) → status.
- **States:** active/completed/cancelled; download pending.
- **CTA:** primary contextual (download ticket); destructive (cancel) soft + demoted.
- **A11y:** heading outline; action buttons labelled.

### `/account/settings`  —  Account settings
- **Goal:** manage name/phone/password/delete.
- **OTA precedent:** OTA account settings (sectioned).
- **Patterns:** PTN-01, PTN-13, PTN-11 (grouped form sections), PTN-12.
- **Layout (desktop):** optional section nav + grouped form cards (name, password, phone, delete-account).
- **States:** per-section saving/success/error; delete confirmation (Dialog).
- **CTA:** per-section save (one primary each); delete = destructive soft, double-confirm.
- **A11y:** section headings; destructive confirm dialog focus-trap.

### `/terms`, `/privacy`  —  Legal
- **Goal:** read legal content.
- **OTA precedent:** OTA legal/content page.
- **Patterns:** PTN-01, PTN-13, (optional TOC).
- **Layout:** prose container (max-w-2xl), readable measure, optional sticky TOC ≥md.
- **States:** static.
- **A11y:** heading outline, skip-to-section.
