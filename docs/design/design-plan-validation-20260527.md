---
title: Design plan validation + coverage (Phase E)
date: 2026-05-27
design-language: v1.0
scope: docs-only design plan (no code built this round)
---

# Design plan validation (Phase E)

Confirms the design plan is **complete + internally consistent** before any
implementation round. Targets are stated for the post-implementation re-runs.

## E1 — Cross-doc consistency review
| Check | Result |
|---|---|
| Every page spec references only PTN-ids that exist in `patterns/_index.md` | ✅ (PTN-01..14 all defined; pages cite within range) |
| Every pattern cites tokens that exist in `design-language.md`/`globals.css` | ✅ (orange/warm/shadow-e*/radius all real; teal `info` flagged as to-add) |
| No page contradicts the design language (single primary CTA, no raw color, no invented layout) | ✅ |
| Stale docs deprecated | ✅ `design-system.md` banner → `design-language.md`; `review-20260526.md` corrected in `baseline-built-ui-20260527.md` |
| All 33 routes covered by a spec | ✅ (see E4 matrix) |
| Single source of truth established | ✅ `design-language.md` v1.0 |
| One unresolved cross-dependency | ⚠️ teal `info` token + chart colors not yet in `globals.css` (design decision recorded; implement in build phase) |

## E2 — Anti-generic (target, re-run after build)
- Current built genericness (pre-redesign): **0.54 / 13** (`anti-generic-audit.md`).
- Plan addresses the open flags: secondary accent (teal `info`), layout personality (results rail + summary rail + hero, not centered column), richer cards, motion choreography, iconography (already strong).
- **Target after implementation: ≤ 0.30** benchmarked against the OTA corpus (`benchmarks/ota-capture.md`), not VN-only.

## E3 — Product scorecard (target, re-run after build)
- Current: **4.56 / 5** (`product-design-scorecard.md`); weakest = overview dashboard 4.00, review/stub-pay genericness ~4.25.
- Plan directly targets all ranked fixes (search rail #1, payment icons #2, stub-pay #3, dashboard sparklines #4, trip-detail alignment #5) plus checkout summary rail + trust signals + manage-booking.
- **Target after implementation: ≥ 4.7 / 5, no surface < 4.3.**

## E4 — Coverage matrix (33 routes × completeness)
Criteria: Spec'd (has a section) · ≥1 PTN · OTA precedent named · States enumerated · A11y noted.

### Customer (15)
| Route | Spec | PTN | OTA | States | A11y |
|---|:--:|:--:|:--:|:--:|:--:|
| `/` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/search` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/routes` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/trips/[id]` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/booking/customer` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/booking/review` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/booking/result/[token]` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/booking/confirmation/[token]` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/dev/stub-pay` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/auth/login` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/auth/register` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/auth/forgot-password` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/auth/reset-password` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/account/bookings` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/account/bookings/[id]` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/account/settings` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/terms`,`/privacy` | ✅ | ✅ | ✅ | ✅ | ✅ |

### Operator (16)
| Route | Spec | PTN | OTA | States | A11y |
|---|:--:|:--:|:--:|:--:|:--:|
| `/op/login` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/op/first-login` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/op/(console)/dashboard` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/op/(console)/dashboard/[id]` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/op/(console)/reports/overview` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/op/(console)/reports/revenue` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/op/(console)/reports/payouts` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/op/(console)/trips` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/op/(console)/trips/[id]` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/op/(console)/routes` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/op/(console)/buses` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/op/(console)/trip-templates` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/op/(console)/manifest/[tripId]` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/op/(console)/upcoming` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/op/(console)/staff` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/op/(console)/profile` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/op/staff/dashboard` | ✅ | ✅ | ✅ | ✅ | ✅ |

**Coverage: 33/33 routes design-complete.** No gaps.

## Implementation roadmap (next round, when approved)
Recommended build order (highest perceived-quality leverage first), each shippable:
1. **PTN-03 search results + filter rail** (`/search`) — biggest jump.
2. **PTN-07 checkout summary rail + PTN-08** across booking flow.
3. **PTN-04 richer trip card + PTN-14 trust signals** (search/routes/home).
4. **PTN-06 confirmation e-ticket + manage-booking** (`/booking/confirmation`, `/account/bookings*`).
5. **design-language token adds** (teal `info`, chart colors) + PTN-10 dashboard sparklines.
6. Remaining polish per page specs; then re-run E2/E3.

## Deliverables index (this round)
- `baseline-built-ui-20260527.md` — as-built truth + stale-doc corrections
- `benchmarks/ota-capture.md` — AA/ANA/Expedia/Booking/Google Flights/Vexere/12Go patterns
- `benchmarks/ota-gap-analysis.md` — gap matrix + prioritized steal list
- `design-language.md` v1.0 — canonical source of truth
- `patterns/_index.md` — PTN-01..14 reusable library
- `pages/_template.md`, `pages/customer-pages.md`, `pages/operator-pages.md` — all 33 route specs
- `design-plan-validation-20260527.md` — this gate
