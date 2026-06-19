---
title: OTA benchmark capture
date: 2026-05-27
mode: knowledge-based (no live web-design-capture; WebFetch not used). Patterns
  reflect well-established, stable UX conventions of each site as of training
  knowledge. Re-run /web-design-capture later for live token extraction.
targets: American Airlines, ANA, Expedia, Booking.com, Google Flights, Vexere, 12Go
---

# OTA benchmark capture

Per-target capture of the recurring UX patterns we want to adopt. Each observation
is tagged with a portable **pattern token** (→ maps to a `PTN-id` in Phase C).
Goal: a shared vocabulary of "what modern OTAs do" so our pages can cite precedent.

## Cross-OTA conventions (the through-line)
Every leader converges on the same skeleton for a search→book journey:
1. **Hero search module** front-and-center on entry (origin/dest/date/pax), persistent or sticky on results.
2. **Results = dense scannable list + persistent filter rail (left, desktop) + sort bar + result count + active-filter chips.**
3. **Option card** is price-forward, one row, with a clear single primary action; secondary detail is progressive-disclosure.
4. **Fare/option tiers** (Basic/Main/Flex) shown as comparable cards or a matrix.
5. **Checkout is a linear, numbered flow with a persistent price-summary rail** that stays visible while you fill passenger/payment.
6. **Trust signals everywhere**: price breakdown, free-cancellation/hold timer, payment logos, secure-checkout badge.
7. **Manage-booking ("My Trips")**: itinerary cards + actions (change/cancel/receipt).
8. **Confirmation = itinerary/e-ticket** with reference, add-to-calendar, next steps.

---

## American Airlines (aa.com)
- **Shell:** slim top utility bar + primary nav; strong brand blue; persistent "Find flights" entry.  `PTN-app-shell`
- **Search:** tabbed trip type, inline OD/date/pax; calendar with price hints.  `PTN-hero-search`
- **Results:** vertical list; each row = times + duration + stops + **price as the visual anchor on the right**; sort tabs (price/duration/departure); left filter rail (stops, times, airlines).  `PTN-results-rail`, `PTN-entity-card`
- **Fare families:** Basic Economy / Main / etc. as **comparable tier cards** with included/excluded ticks.  `PTN-fare-family`
- **Detail:** itinerary timeline (segment-by-segment), aircraft/amenities, sticky continue.  `PTN-detail-layout`
- **Checkout:** numbered steps, **sticky trip-summary + price rail**; guest allowed; trust/secure badges.  `PTN-checkout-rail`
- **Manage:** "Your trips" with itinerary cards, change/cancel.  `PTN-manage-booking`

## ANA (ana.co.jp)
- **Shell:** clean, generous whitespace, restrained palette (navy/blue), large type; very strong a11y + JP/EN locale switch.  `PTN-app-shell`
- **Search:** prominent hero search, calendar fare view.  `PTN-hero-search`
- **Cards:** spacious fare cards, **clear tier comparison matrix** (Economy Basic→Flex); price + miles dual display.  `PTN-fare-family`
- **Detail:** refined itinerary + baggage/amenity icons; heavy use of iconography for cabin features.  `PTN-detail-layout`, `PTN-trust-signals`
- **Takeaway for us:** ANA's **calm density + generous spacing + iconographic amenities** is the "premium, trustworthy" feel; good model for trip-detail and confirmation.

## Expedia (expedia.com)
- **Shell:** product tabs (Flights/Stays/Cars/Packages), persistent search bar.  `PTN-app-shell`
- **Search:** big hero search, "recent searches", destination inspiration tiles below.  `PTN-hero-search`
- **Results:** **left sticky filter rail** (price slider, times, stops, amenities) + sortable dense list; map toggle; "X of Y results"; active filter chips removable.  `PTN-results-rail`
- **Cards:** image + key facts + **price block right-aligned**, "Reserve" primary; badges ("Great deal", "Refundable").  `PTN-entity-card`
- **Checkout:** **multi-step with persistent price-summary sticky rail** (price details expandable, taxes/fees, total); guest checkout; "free cancellation" reassurance; payment logos.  `PTN-checkout-rail`, `PTN-trust-signals`
- **My Trips:** itinerary cards grouped upcoming/past with actions.  `PTN-manage-booking`
- **Takeaway:** Expedia is the closest model for our **search results + multi-step checkout + summary rail**.

## Booking.com
- **Results:** the gold standard for **dense list + sticky filter rail + sort dropdown + result count + map**; "X properties found"; badges; urgency cues ("2 left"). `PTN-results-rail`, `PTN-entity-card`
- **Cards:** strong info hierarchy, price + savings, single CTA, review score chip.  `PTN-entity-card`, `PTN-trust-signals`
- **Checkout:** stepped, sticky summary, "no payment needed today", free-cancellation badges.  `PTN-checkout-rail`, `PTN-trust-signals`
- **Takeaway:** scannability + trust/urgency chips; **availability cues** ("N chỗ trống") map directly to our seat counts.

## Google Flights
- **Results:** cleanest **sort bar + filter chips row + dense list**; best-price callouts, price graph, "cheapest/best" tabs.  `PTN-results-rail`
- **Cards:** minimal, price-forward, expandable detail inline.  `PTN-entity-card`
- **Takeaway:** **filter chips + sort + price emphasis** at the lightest visual weight — ideal for a mobile-first bus search where a full left rail is heavy.

## Vexere (vexere.com) — VN bus market leader
- **Results:** sticky left filter rail (operator, time-of-day buckets, bus type, price, seat type), dense trip rows; trip card shows operator, depart→arrive, duration, **seats left**, price, rating, "Chọn chuyến".  `PTN-results-rail`, `PTN-entity-card`
- **Trip card:** expandable for pickup/dropoff points, amenities, seat map.  `PTN-detail-layout`
- **Takeaway:** Vexere is the **domain-exact template** — our `/search` should look like Vexere's results with OTA-grade polish. Time-of-day buckets, bus-type filter, seats-left, operator chip all already in our data.

## 12Go (12go.asia)
- **Results:** multimodal cards (bus/train/ferry), clear from→to + duration + class + price; trust ("instant confirmation").  `PTN-entity-card`, `PTN-trust-signals`
- **Takeaway:** clean route-card anatomy + class/type labeling.

---

## Pattern-token → Phase C map (preview)
`PTN-app-shell`→PTN-01 · `PTN-hero-search`→PTN-02 · `PTN-results-rail`→PTN-03 · `PTN-entity-card`→PTN-04 · `PTN-fare-family`→PTN-05 · `PTN-detail-layout`→PTN-06 · `PTN-checkout-rail`→PTN-07 · `PTN-trust-signals`→PTN-14 · `PTN-manage-booking`→(PTN-06+09+13).
