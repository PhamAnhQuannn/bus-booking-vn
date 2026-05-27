---
title: OTA-vs-us gap analysis + steal list
date: 2026-05-27
inputs: baseline-built-ui-20260527.md, benchmarks/ota-capture.md, trend-travel.md (VN, cited not duplicated)
---

# OTA gap analysis + steal list

Bridges research → pattern library. Matrix of the cross-OTA patterns (rows) ×
our pages (cols). Cell: ✅ present · ◐ partial · ✗ absent.

## Pattern × page coverage (customer)
| OTA pattern | home | search | routes | trip | book.customer | book.review | confirm | my-trips |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Hero search module | ✅ | ◐ | – | – | – | – | – | – |
| Results + **sticky filter rail** | – | ◐ | ✗ | – | – | – | – | ✗ |
| Sort bar + filter chips + result count | – | ◐ | ✗ | – | – | – | – | – |
| Price-forward **entity card** w/ badges | ◐ | ◐ | ◐ | – | – | – | – | ◐ |
| **Fare/option tiers** | – | ✗ | – | ✗ | – | – | – | – |
| Detail itinerary + amenity icons | – | – | – | ◐ | – | – | ◐ | – |
| **Multi-step checkout + sticky summary rail** | – | – | – | – | ✗ | ✗ | – | – |
| Step indicator | – | – | – | – | ✅ | ✅ | – | – |
| **Trust signals** (breakdown/cancel/logos/timer) | ◐ | ✗ | – | ◐ | ✗ | ◐ | ◐ | – |
| Manage-booking actions | – | – | – | – | – | – | – | ◐ |
| Confirmation = e-ticket (ref/calendar/QR) | – | – | – | – | – | – | ◐ | – |
| Breadcrumbs / wayfinding | – | ◐ | ◐ | ✗ | – | – | – | ✗ |
| Empty/loading(skeleton)/error states | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ | – | ◐ |

## Steal list — prioritized (highest leverage first)
1. **Search results = persistent sticky filter rail + sort bar + filter chips + result count** (Expedia/Booking/Vexere). Our filters are a collapsed toggle; make them a first-class rail on desktop, bottom-sheet on mobile. → PTN-03. *Biggest single perceived-quality jump.*
2. **Multi-step checkout with a sticky price-summary rail** (Expedia/AA/Booking) across `/booking/customer`→`/review`→pay. Summary (route, time, pax, price breakdown, total) stays visible. → PTN-07.
3. **Richer price-forward trip card** with operator chip, seats-left urgency, bus-type/amenity badges, duration, depart→arrive, single primary CTA (Vexere/Google Flights). → PTN-04.
4. **Trust signals** system: price breakdown line-items, free-cancellation/hold-timer, payment-method logos, secure badge — on home, search cards, checkout, confirmation. → PTN-14.
5. **Fare/option tiers** for trip types (coach/sleeper/limousine) presented as comparable cards (ANA/AA fare families). → PTN-05.
6. **Manage-booking surface** on `/account/bookings[/id]` (itinerary card + change/cancel/receipt/contact actions). → PTN-06+09+13.
7. **Confirmation as e-ticket**: prominent booking ref, add-to-calendar, QR/boarding info, "what's next". → PTN-06+14.
8. **Consistent empty/loading/error** (skeletons during RSC fetch, friendly empties, actionable errors) everywhere. → PTN-12.
9. **Breadcrumbs** on deep pages (account, operator, trip detail). → PTN-13.
10. **Destination inspiration / popular routes** module on home + `/routes` imagery (Expedia). → PTN-02 extension.

## Notes
- Operator console already matches OTA-grade admin density (Booking/Expedia partner portals); main operator steal = dashboard **sparklines/period-compare** (already a scorecard fix) and aligning trip-detail sticky bar to the customer card system.
- VN-domain fit (Vexere) means our results rail filters map 1:1 to existing data: operator, time-of-day window, bus type, price, seats-left — no new data model needed.
