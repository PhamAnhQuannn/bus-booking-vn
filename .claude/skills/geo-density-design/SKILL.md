---
name: geo-density-design
description: Geographic density unit-economics for marketplaces — density tipping point per hex/zip/metro, network-effects-per-region scoring, expansion gating, and density-aware acquisition spend. Outputs to `docs/design/geo-density-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "marketplace", "two-sided", "platform", "supply-side", "demand-side", "density", "geo expansion", "hex", "/geo-density-design", or before opening a new city/region.
output_size:
  XS: skip
  S: 1h
  M: 2h
  L: 4h
  XL: 6h
---

# /geo-density-design — Geographic Density Unit Economics

## Why you'd care

Marketplaces that expand before hitting density in their seed city end up with thin coverage everywhere and product-market fit nowhere. The density model tells you when a metro is ready to open and when it's still bleeding acquisition spend.

Invoke as `/geo-density-design`. Defines the per-region "is this market alive?" math for any marketplace whose value depends on local liquidity. Anchored on Bill Gurley's marketplace essays, Andrew Chen on atomic networks, and DoorDash/Uber publicly disclosed density logic.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS → SKIP.
2. Read `docs/inception/cold-start-<project>.md` (atomic network).
3. Read `docs/design/supply-balance-<project>.md` if exists.
4. Read `docs/design/cost.md` if exists.

## Inputs
- Geo-locality factor: must transaction happen in person? same city? same neighborhood? virtual?
- Supply mobility: can a unit serve multiple geographies (driver) or is it fixed (Airbnb listing)?
- Buyer travel willingness (km buyer will travel to consume).
- Existing geographies served (if any).
- Per-region acquisition cost so far (CAC by city).

## Process
1. **Pick density unit**: hex (H3 res 7/8/9), ZIP, postal sector, city, MSA, country.
   - Ride-share / food-delivery → H3 hex (res 8 ≈ 0.7 km²)
   - Reservations / professional services → ZIP / postal sector
   - Vacation rentals → city or sub-city neighborhood
   - Used-goods (OfferUp, Mercari) → metro area
   - Freelance digital → country or virtual (n/a)
2. **Density tipping-point math** — derive from atomic-network theory:
   - **Floor density** = minimum suppliers per unit at which a typical buyer has ≥1 acceptable choice in their search radius
   - **Critical density** = where match rate stops improving linearly (~80% fill, <10 min ETA)
   - **Saturation density** = adding more supply doesn't improve match quality
   - Example: Uber NYC reached critical density at ~5 drivers/hex/min during peak (Andrew Chen estimate).
3. **Per-region scorecard** — build before opening any market:
   - Population in catchment
   - Smartphone penetration / target-demo density
   - Existing demand signal (search queries, waitlist signups, scraped data)
   - Supply pool size (TAM of potential suppliers)
   - Local competitor presence
   - Regulatory friction (local TNC rules, STR rules, gig-worker classification)
   - Cost of acquisition (paid CAC estimate from competitor benchmarks)
4. **Density unit economics**:
   - Variable cost per transaction (payment processing, support, driver pay)
   - Marginal value of additional supplier (does each new host steal share from existing or grow market?)
   - Density-driven LTV uplift: more density → faster match → higher retention → higher LTV
   - Break-even density: where contribution margin × volume covers local fixed cost (ops manager, marketing, support coverage)
5. **Expansion gate** — checklist before opening market N+1:
   - Existing markets at ≥critical density for ≥4 weeks
   - Unit economics positive ex-subsidy
   - Playbook documented (runbook + onboarding curriculum)
   - Local point of contact identified
   - Regulatory landscape reviewed
6. **Contraction logic** — when to PULL OUT of a market:
   - <floor density sustained 12 weeks → reduce marketing, retain core
   - <50% of floor density sustained 26 weeks → consider exit
   - Reference: Uber pulled out of Southeast Asia (sold to Grab), DoorDash pulled out of multiple early markets, OnTrac shut Northeast routes
7. **Network-effect score per region**: track these quarterly:
   - WoM coefficient (new buyer "heard from friend" rate)
   - Cross-side spillover (new host generates X new bookings within 30d)
   - Density × utilization curve fit
8. **Anti-patterns**:
   - National marketing campaign before density proof (Webvan, Sidecar)
   - Vanity "cities served" count without quality
   - Same playbook in every region (NYC ≠ rural Ohio)
   - Ignoring local regulator until they sue (Airbnb NYC, Uber London)
   - Subsidizing supply in already-saturated regions

## Output
Write `docs/design/geo-density-<project>.md`:

```markdown
# Geographic Density Design — <project>
**Date:** 2026-05-13

## Density unit
- **Primary unit:** H3 hex resolution 8 (~0.7 km²)
- **Rollup units:** ZIP, MSA, state
- **Why hex 8:** matches catchment of ~10-min ETA at urban driving speeds; fine enough for surge zones, coarse enough for ops dashboards.

## Density tiers (per active hex)
| Tier | Suppliers/hex/peak hour | Buyer experience | Action |
|---|--:|---|---|
| Dead | 0–1 | no matches | not launched / paused |
| Floor | 2–4 | match w/ 15+ min ETA, frequent fails | aggressive supply acq |
| Critical | 5–8 | match <10 min, fill rate ≥80% | sustain |
| Healthy | 9–15 | match <5 min, fill rate ≥95% | optimize quality |
| Saturated | >20 | diminishing returns; supplier earnings drop | throttle supply acq |

## Comparator density signals
| Co. | Density unit | Critical density (peak) |
|---|---|---|
| Uber | H3 hex res 8 | ~5 drivers/hex/min |
| DoorDash | ZIP × daypart | ~3 dashers/ZIP/15-min, 25+ restaurants/ZIP |
| Airbnb | city neighborhood | ~200 active listings/neighborhood |
| TaskRabbit | ZIP × day | ~10 active taskers/ZIP |
| OfferUp | metro | ~10k active listings/metro |
| Etsy | virtual / global | n/a — category density matters more |
| Fiverr | virtual / global | n/a |
| Substack | virtual / global | n/a (uses topic density instead) |

## Per-region scorecard template
| City candidate | Pop | Target demo density | Demand signal (waitlist) | Supply pool | Competitor | Reg friction | Est CAC | Score (1–10) |
|---|--:|--:|--:|--:|---|---|--:|--:|
| SF | 880k | high | 4,200 | 8k drivers | Uber/Lyft dominant | low (TNC settled) | $35 | 7 |
| Oakland | 440k | high | 1,800 | 4k drivers | weak | low | $22 | 8 |
| San Jose | 1M | med | 1,200 | 6k drivers | medium | low | $28 | 6 |
| Sacramento | 525k | med | 600 | 3k drivers | weak | low | $20 | 7 |

## Density tipping math (worked example)
- Catchment: hex 8 (0.7 km², ~10-min driving)
- Typical demand: 12 ride requests/hour peak
- Acceptable ETA: ≤8 min
- Driver inter-arrival to support 8-min ETA: ≥6 active drivers in hex
- **Floor density = 3, Critical = 6, Healthy = 10, Saturated = 18**

## Unit economics per active hex per month (healthy tier)
| Line | Value |
|---|--:|
| Transactions/hex/month | 8,400 |
| Avg GMV per txn | $18 |
| GMV/hex/month | $151,200 |
| Take rate | 22% |
| Gross revenue | $33,264 |
| Variable cost (payment + support + insurance) | $9,000 |
| Local fixed allocation (ops + mktg) | $4,500 |
| **Contribution margin** | **$19,764** |
| Margin % | ~60% |

## Break-even density (per hex)
- Local fixed cost: $4,500/mo (1 ops headcount allocated + paid mktg)
- Required contribution: $4,500
- At 22% take rate + $9 variable + $18 GMV → need ~$22 contribution per txn × ~205 txns/mo
- **Break-even = ~205 txns/hex/month = Floor tier**

## Expansion gate (must all be ✓ before opening market N+1)
- [ ] Existing markets ≥ Critical density for 4+ consecutive weeks
- [ ] Contribution margin positive ex-subsidy
- [ ] Onboarding playbook documented + tested
- [ ] Local GM / ops lead identified
- [ ] Regulatory landscape reviewed (local TNC / STR / gig-worker rules)
- [ ] Demand signal proves catchment ≥1k waitlist or ≥10k search queries
- [ ] Supply pool ≥3× projected Critical-density need
- [ ] CAC estimate <$X (varies by vertical)

## Contraction triggers
- <Floor density sustained 12 weeks → reduce paid acq spend in hex
- <50% Floor density sustained 26 weeks → strategic review: sell, sunset, or M&A
- Regulator forces structural change with negative unit econ → exit
- Reference cases: Uber SE Asia → sold to Grab. DoorDash early small-town markets shuttered. Airbnb Cuba paused on regulatory change.

## Network-effect score (per region, quarterly)
| Signal | Target | Weight |
|---|--:|--:|
| WoM coefficient (new user cites friend) | ≥0.4 | 25% |
| Cross-side spillover (1 new supplier → N new bookings 30d) | ≥3 | 25% |
| Density × match-quality curve | fitting log curve | 20% |
| Buyer 90-day retention | ≥35% | 15% |
| Supplier 90-day retention | ≥55% | 15% |

## Anti-patterns we will NOT do
- National marketing campaign before density proof
- Vanity "cities served" count
- Same playbook in every region
- Ignoring local regulator until subpoena
- Subsidize supply in saturated hexes

## References
- Bill Gurley — marketplace + density essays (Above the Crowd)
- Andrew Chen — *The Cold Start Problem*, atomic-network chapter
- Sangeet Choudary — *Platform Scale*
- Uber Engineering — H3 spatial indexing (open source)
- DoorDash Engineering blog — market-launch playbook

## Quarterly review template
- Current density tier per market: table
- Markets meeting expansion gate next quarter: list
- Markets at contraction risk: list
- CAC drift by market: chart
- New regulatory developments: list
```

## Verification
- Density unit picked + rationale.
- Tier table with action per tier.
- Worked unit-economics example with break-even.
- Expansion gate ≥6 checkboxes.
- Contraction triggers explicit.
- Comparator density signals ≥5 marketplaces.
- Network-effect scorecard weighted to 100%.
- Anti-pattern section present.
