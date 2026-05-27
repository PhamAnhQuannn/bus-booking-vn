---
last-updated: 2026-05-26
scope: whole product (customer + operator), incl. search filters, /routes, /trips/[id], payment flow, KPI dashboard
builds-on: review-20260526.md, anti-generic-audit.md, design-system.md
---

# Product Design Scorecard

Treats the app as a complete product and scores every primary surface against five
weighted dimensions. Scores are 1–5 (5 = exemplary). This is a living doc; re-run
after each design-affecting change.

## Dimensions & weights

| Dim | Weight | What it measures |
|-----|--------|------------------|
| Token adherence | 0.25 | No raw hex / arbitrary tailwind grays / inline color-spacing; uses `globals.css` tokens + primitives |
| CTA hierarchy | 0.20 | One primary per view; action-verb labels; destructive demoted |
| Consistency | 0.20 | Same concept rendered the same way; container/spacing rhythm; primitive reuse |
| A11y (WCAG 2.2 AA) | 0.20 | Focus rings, ≥44px targets, labels, contrast, aria |
| Genericness (inverse) | 0.15 | Distinct from default-AI look — brand orange, Be Vietnam Pro, warm shadows, motion |

Weighted score = Σ(dim × weight). Product score = mean of surface scores.

## Per-surface scores

| Surface | Token | CTA | Consist | A11y | Generic | Weighted |
|---------|:----:|:---:|:------:|:----:|:------:|:-------:|
| Home `/` | 5 | 5 | 5 | 5 | 4 | **4.85** |
| Search + filters `/search` | 5 | 4 | 4 | 4 | 4 | **4.20** |
| Browse routes `/routes` | 5 | 5 | 5 | 5 | 4 | **4.85** |
| Trip detail `/trips/[id]` | 5 | 5 | 4 | 4 | 4 | **4.45** |
| Buyer info `/booking/customer` | 5 | 5 | 5 | 5 | 4 | **4.85** |
| Review `/booking/review` | 5 | 4 | 5 | 4 | 3 | **4.25** |
| Stub pay `/dev/stub-pay` | 5 | 5 | 4 | 4 | 3 | **4.30** |
| Result `/booking/result` | 5 | 4 | 5 | 4 | 4 | **4.40** |
| Confirmation `/booking/confirmation` | 5 | 5 | 5 | 5 | 4 | **4.85** |
| Hold expiry modal | 5 | 5 | 5 | 5 | 4 | **4.85** |
| Operator overview `/op/reports/overview` | 4 | 4 | 4 | 4 | 4 | **4.00** |
| Operator revenue/payouts reports | 5 | 4 | 5 | 4 | 4 | **4.50** |
| Operator console (nav/dashboard/trips/fleet) | 5 | 5 | 5 | 5 | 5 | **5.00** |

**Product score ≈ 4.56 / 5.**

## What moved the needle this cycle
- Removed the last `bg-blue-600` CTAs (HoldExpiryModal, CustomerForm) and raw `<input>`/`<button>` → primitives. Token adherence now uniformly 5 on customer flow.
- New search filters add genuine product depth (operator/price/window/duration/sort) — biggest UX gain.
- New `/routes` + `/trips/[id]` close the discovery gap (previously search-only).
- Funnel instrumentation gives the first real conversion signal.

## Ranked fixes (highest leverage first)

1. **Search filters CTA/consistency (−)**: the filter panel toggles open; on mobile validate it doesn't compete with the book CTAs. Consider a sticky "N kết quả" bar. (CTA 4→5)
2. **Review payment-method radios genericness (3)**: the 2-col radio grid reads generic. Add operator/method iconography + selected-state motion per `motion-direction-spec.md`. (Generic 3→4)
3. **Stub-pay genericness (3)**: functional but utilitarian; acceptable since dev-gated, but under `PAYMENTS_STUB` it's the live pay screen — add a brand header + trust line. (Generic 3→4)
4. **Overview dashboard (4 across)**: KPI tiles are plain; add sparklines/period-compare per `dashboard-layout.md`; the inline-width funnel bars are the one data-driven `style` exception (documented). (Token/Consist 4→5)
5. **Trip detail consistency (4)**: align the sticky price/CTA bar styling with the search `TripCard` footer so the two read as one system. (Consist 4→5)

## Method notes
- Customer flow audited against `design-system.md` Do/Don't list; operator console scored from `review-20260526.md`.
- Genericness uses the `anti-generic-audit.md` 13-tell checklist; brand orange + Be Vietnam Pro + warm `shadow-e*` keep most surfaces ≥4.
- Data-driven inline `style={{ width }}` (progress/funnel bars) is an allowed exception to the no-inline-style rule — width can't be a static token.
