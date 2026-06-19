---
title: Cross-page Pattern Library
date: 2026-05-27
design-language: v1.0
purpose: reusable building blocks every page assembles. Pages reference PTN-ids;
  they never invent layout primitives. Change a pattern once → all pages inherit.
---

# Pattern Library

The scalability + consistency backbone. Each pattern: **anatomy · variants ·
states · responsive · a11y · tokens · OTA precedent**. Pages cite `PTN-id`s only.
**No-invention rule:** if a page needs something not here, add a pattern here first.

| PTN | Name | One-liner |
|---|---|---|
| PTN-01 | App shell | header/footer (customer) + sidebar (operator) chrome |
| PTN-02 | Hero search | entry search module + inspiration |
| PTN-03 | Results + filter rail | dense list + sticky filters + sort + chips + count |
| PTN-04 | Entity (trip) card | price-forward result card |
| PTN-05 | Fare-family tiers | comparable coach/sleeper/limousine tier cards |
| PTN-06 | Detail layout | itinerary/facts + sticky CTA bar |
| PTN-07 | Checkout + summary rail | multi-step + sticky price summary |
| PTN-08 | Step indicator | 1-2-3 progress |
| PTN-09 | Data table | operator tables (sort/expand/bulk/mobile-stack) |
| PTN-10 | Dashboard tiles | KPI tiles + sparkline/compare + funnel |
| PTN-11 | Forms | field grouping, validation, error copy |
| PTN-12 | States | loading(skeleton)/empty/error/success |
| PTN-13 | Breadcrumbs / wayfinding | deep-page orientation |
| PTN-14 | Trust signals | price breakdown, cancellation/hold, logos, secure |

---

## PTN-01 — App shell
**OTA precedent:** Expedia/AA global chrome; operator = Booking partner portal.
**Anatomy (customer):** sticky `SiteHeader` (logo · nav: Trang chủ/Tìm chuyến/Tuyến đường/Tài khoản · aria-current) over content over `SiteFooter` (brand · link groups · legal · payment logos). **(operator):** persistent left sidebar (≥md) with per-item lucide icons + active highlight; mobile = top bar + drawer.
**Variants:** customer · operator-console · auth-minimal (logo only).
**States:** nav active/hover/focus; mobile drawer open/closed; logged-in vs guest account link.
**Responsive:** header collapses nav to essentials ≤md; sidebar → drawer ≤md.
**A11y:** `<header>`/`<nav aria-label>`/`<main>`/`<footer>` landmarks; skip-link to main; `aria-current="page"`; 44px targets; focus rings.
**Tokens:** `bg-background/90 backdrop-blur`, `border-border`, sidebar tokens, `shadow-e1`.

## PTN-02 — Hero search
**OTA precedent:** Expedia/Google Flights hero; Vexere landing.
**Anatomy:** full-bleed gradient hero band → headline + subcopy → search card (origin/dest combobox, date, ticket count) → below: trust row + optional **destination-inspiration / popular-routes** tiles.
**Variants:** home (full hero) · `/search` empty-query (compact inline search) · sticky condensed search on results scroll.
**States:** idle · validating · submitting · invalid-field.
**Responsive:** fields stack ≤md; hero padding shrinks.
**A11y:** labelled fields, combobox aria, single submit, error summary.
**Tokens:** `bg-gradient-to-b from-primary/10`, search card `shadow-e3`, `font-display`.

## PTN-03 — Results + filter rail  ★ highest-leverage
**OTA precedent:** Booking/Expedia/Google Flights results; Vexere bus results.
**Anatomy (desktop ≥md):** 2-col grid — **left sticky filter rail** (operator, time-of-day window, bus type, price range, max duration, seats-left) + **right column**: top **sort bar** (`departure/price↑↓/duration`) + **result count** ("Hiển thị N/total") + **active-filter chips** (removable) + dense list of PTN-04 cards + date ±1 nav.
**Variants:** customer search · `/routes` browse (lighter filters) · `/account/bookings` (upcoming/past tabs as the "filter").
**States:** loading (skeleton rows) · empty-base (try other dates) · empty-filtered ("bỏ bớt bộ lọc", facets retained) · results.
**Responsive (≤md):** filter rail → "Bộ lọc (N)" button opening a **bottom-sheet**; sort stays inline; chips wrap; result count sticky.
**A11y:** rail is `<aside aria-label="Bộ lọc">`; chips are buttons with "remove X" labels; sort is a labelled Select; `aria-live` on result count.
**Tokens:** rail `bg-card border-border shadow-e1`; chips `Badge`/pill; URL-driven (existing `SearchFilters` upgrades to this rail).

## PTN-04 — Entity (trip) card
**OTA precedent:** Google Flights/AA flight row; Vexere/12Go trip card.
**Anatomy (one row, scannable):** left = operator chip (avatar initial) + name; center = **depart→arrive times (mono)** + duration + route arrow; badges = bus type, seats-left urgency ("Còn N chỗ"), amenities; right = **price (mono, `text-primary`, large)** + single primary CTA "Đặt vé" + "Xem chi tiết" link. Optional expand → pickup points/amenities inline.
**Variants:** search-result · routes-browse (origin→dest + from-price) · my-trips (status badge + manage link) · compact (operator dashboard).
**States:** default · hover-lift (`e1→e2`) · seats-low (warning) · sold-out (muted, CTA disabled).
**Responsive:** stacks to 2 rows ≤md; price + CTA become a footer row.
**A11y:** `<article aria-label>`; CTA labelled with route; badges have text, not color-only.
**Tokens:** `Card`-like `rounded-xl border-border bg-card shadow-e1`, price `font-mono text-xl font-bold text-primary`.

## PTN-05 — Fare-family tiers
**OTA precedent:** ANA/AA fare families; airline cabin tiers.
**Anatomy:** 2–3 comparable tier cards for the same route/time grouped by **bus type** (Ghế ngồi / Giường nằm / Limousine), each: type name + amenity ticks + price delta + select. Or a compact comparison strip.
**Variants:** trip-detail tier selector · search "compare types" expansion.
**States:** selected · unavailable.
**Responsive:** cards → horizontal scroll/stack ≤md.
**A11y:** radiogroup semantics; amenity ticks have text labels.
**Tokens:** selected = `border-primary bg-primary/10`.

## PTN-06 — Detail layout
**OTA precedent:** AA/ANA flight detail + itinerary; Expedia property detail.
**Anatomy:** breadcrumb (PTN-13) → header (route + operator) → **facts grid** (depart, duration, bus type, seats, amenity icons) → pickup-points list (map-pin) → operator contact → **sticky bottom price + CTA bar** (PTN-07 mini). Reused for trip detail, booking confirmation (itinerary), manage-booking detail.
**Variants:** trip-detail (book CTA + ticket stepper) · confirmation (e-ticket, ref, add-to-calendar, QR) · my-trip detail (manage actions).
**States:** bookable · sold-out/closed → 404/notice · cancelled (status banner).
**Responsive:** facts grid 2-col→1-col; sticky bar full-width ≤md.
**A11y:** heading outline; sticky bar reachable; tel link.
**Tokens:** facts `Card`; sticky bar `shadow-e3 sticky bottom-0`.

## PTN-07 — Checkout + summary rail  ★ high-leverage
**OTA precedent:** Expedia/Booking/AA multi-step checkout + persistent price summary.
**Anatomy (desktop):** content column (current step form) + **right sticky summary rail**: route + depart + pax + **price breakdown line-items** + total (mono) + hold timer + trust line (PTN-14) + primary CTA. Rail persists across customer→review→pay.
**Variants:** buyer-info step · review step · payment-method step.
**States:** filling · validating · submitting · hold-expiring (timer warning) · error banner.
**Responsive (≤md):** rail → collapsible **sticky bottom bar** showing total + CTA, expandable to breakdown.
**A11y:** rail `aria-label="Tóm tắt đơn"`; total `aria-live` on change; step heading announced.
**Tokens:** rail `Card shadow-e2`; total `font-mono text-primary`.

## PTN-08 — Step indicator
**OTA precedent:** OTA checkout 1-2-3.
**Anatomy:** ordered steps (Thông tin → Xem lại → Thanh toán → Xác nhận); done=check, active=ring, future=muted; connector line.
**States:** done/active/upcoming. **Responsive:** labels hide ≤md (dots+current label). **A11y:** `<ol aria-label>`, `aria-current="step"`. Reuses existing `BookingSteps`.

## PTN-09 — Data table
**OTA precedent:** Booking/Expedia partner portals. (Refreshes `data-table-design.md`.)
**Anatomy:** `<Table>` primitive, semantic `<caption>`/`<th scope>`; sortable headers `aria-sort`; row expanders; bulk actions; cursor pagination; full-width empty `<td colSpan>`.
**Variants:** fleet/routes/trips/templates/staff/manifest/queue.
**States:** loading skeleton rows · empty (never bare) · error.
**Responsive (≤md):** stacked `Card` rows, same data source, CSS `md:` swap.
**A11y:** keyboard sort, row focus, badges non-color-only.
**Tokens:** `Badge` variants per status (`lib/op/statusLabels.ts`).

## PTN-10 — Dashboard tiles
**OTA precedent:** analytics dashboards. (Refreshes `dashboard-layout.md`.)
**Anatomy:** KPI tile grid (label · big mono value · hint · **sparkline / period-compare delta**) + status breakdown + **conversion funnel bars** + date-range form.
**Variants:** operator overview · revenue/payouts · staff single-trip.
**States:** loading · empty-period · data. **Responsive:** 4→2→1 col. **A11y:** tiles are `<section>` w/ heading; funnel bars have text values (not color-only); inline `style={{width}}` is the allowed data-driven exception. **Tokens:** teal `info` for chart series (per design-language §1).

## PTN-11 — Forms
**OTA precedent:** OTA account/checkout forms. (Anchors the 15 existing form specs.)
**Anatomy:** `Label`+`Input`/`Select`/`RadioGroup`; grouped fieldsets; inline error under field (`text-destructive text-sm`); submit = primary Button w/ pending label; alert banners (success/warning/error) with role.
**Rules:** validate on submit + on blur for touched; never placeholder-as-label; one primary submit. **Responsive:** single column, full-width fields. **A11y:** `htmlFor`, `aria-describedby` errors, `aria-invalid`, error summary for long forms, password visibility toggle.

## PTN-12 — States (loading/empty/error/success)
**OTA precedent:** universal. **Anatomy:** **loading** = Skeleton matching final layout (cards/rows), never spinner-only; **empty** = icon + message + action (e.g. "Thử ngày khác"/"Bỏ bớt bộ lọc"); **error** = `role="alert"` banner + retry/next action, scrubbed message; **success** = confirmation/toast. Every list/detail/form page MUST specify all four. **A11y:** `aria-busy` while loading; `role="alert"`/`role="status"`.

## PTN-13 — Breadcrumbs / wayfinding
**OTA precedent:** AA/Expedia deep pages. **Anatomy:** `Trang chủ / Tìm chuyến / <route>` (customer) or `Bảng điều khiển / <section> / <item>` (operator); current = non-link. On `/trips/[id]`, `/account/bookings/[id]`, operator detail pages. **A11y:** `<nav aria-label="breadcrumb">` + ordered list, `aria-current="page"`. **Responsive:** truncate middle ≤md.

## PTN-14 — Trust signals
**OTA precedent:** Booking/Expedia trust rows; airline secure-checkout.
**Anatomy:** payment-method logos (MoMo/ZaloPay/card) · "Thanh toán an toàn" + shield icon · **price breakdown** line-items + total · free-cancellation / **hold-timer** (aria-live) · operator-confirms-by-SMS reassurance · seats-left urgency. Placed on home trust row, search cards, checkout summary, confirmation.
**States:** timer normal/warning/expired. **A11y:** logos have alt/text; timer `aria-live="polite"`; non-color-only urgency.
