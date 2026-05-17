---
name: supply-balance-design
description: Demand/supply ratio targets, overage/underage handling, surge/throttle/dynamic-capacity design for two-sided marketplaces. Outputs to `docs/design/supply-balance-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "marketplace", "two-sided", "platform", "supply-side", "demand-side", "supply balance", "surge", "throttle", "/supply-balance-design", or before a marketplace hits its first holiday/event peak.
output_size:
  XS: skip
  S: 1h
  M: 3h
  L: 4h
  XL: 6h
---

# /supply-balance-design — Supply/Demand Balance Mechanics

Invoke as `/supply-balance-design`. Sets the levers a marketplace operator uses to keep both sides in equilibrium. Anchored on Bill Gurley ("All Markets Are Not Created Equal"), Andrew Chen on supply-side market shocks, and Uber's marketplace-pricing canon.

## Why you'd care

Marketplace launches die from imbalance — too much supply with no demand, or vice versa. Designing the demand/supply ratio targets and surge/throttle policy up-front is what keeps both sides engaged through the first peak.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS → SKIP.
2. Read `docs/inception/cold-start-<project>.md` (chosen atomic network).
3. Read `docs/design/data-model.md` if exists.

## Inputs
- Liquidity model: instant-match (Uber) vs reservation (Airbnb) vs auction (eBay) vs queue (DoorDash)?
- Demand arrival pattern: smooth, spiky (commute), seasonal (holiday rentals), bursty (concert release)?
- Supply elasticity: can suppliers scale up minute-to-minute (gig drivers) or week-to-week (hosts) or year-to-year (landlords)?
- Geographic scope of balancing unit (hex, ZIP, city, national)?
- Price flexibility: fixed price, dynamic surge, supplier-set, auction?

## Process
1. **Define the balancing unit (BU)**: smallest place+time bucket where you balance supply and demand. Examples:
   - Uber: hex × 1-minute
   - DoorDash: ZIP × 15-minute dayparts
   - Airbnb: city × night
   - TaskRabbit: ZIP × day
   - Instacart: store × 1-hour window
2. **Set ratio targets** for each BU class (peak / off-peak / shoulder):
   - **Healthy**: 0.7–1.3 ratio of active-demand to available-supply
   - **Undersupplied** (>1.3): introduce surge / lengthen ETAs / throttle demand
   - **Oversupplied** (<0.7): pause supply incentives / boost demand promos / pause supplier onboarding
3. **Lever inventory** — pick which you can pull and how fast:
   | Lever | Time-to-effect | Side | Risk |
   |---|---|---|---|
   | Surge pricing | seconds | both | brand damage; regulator scrutiny |
   | Driver/supplier bonus | minutes-hours | supply | margin compression |
   | Promo code (demand) | minutes | demand | trains discount habit |
   | Search rank boost | seconds | both | invisible to users |
   | Waitlist / queue | seconds | demand | rage-quit risk |
   | ETA padding | seconds | demand | conversion drop |
   | Onboarding throttle | days-weeks | supply | slows long-run growth |
   | Geo-fence expand/contract | hours | both | confusing UX |
   | Categorical removal (e.g., XL only) | seconds | supply class | revenue hit |
4. **Surge / dynamic pricing design** (if used):
   - Trigger: ratio > 1.3 sustained ≥2 cycles
   - Multiplier curve: 1.0× → 1.5× → 2.0× → cap at 3.0× (Uber caps ~3–5×; ride-share regulators in many jurisdictions cap surge during emergencies)
   - Decay: ratio recovers → drop one step per cycle, not instant (avoid oscillation)
   - Communication: show surge transparently pre-confirm
   - **Anti-pattern**: hidden surge, surge during disasters (Uber Hurricane Sandy → policy now caps emergency surge)
5. **Underage (oversupply) handling**:
   - Avoid burning supplier morale: don't show empty queues. Backstop with demand promo.
   - Throttle new-supplier onboarding when ratio <0.5 sustained 7d.
   - Pause supplier-side advertising spend.
6. **Forecast & pre-positioning**:
   - Build hourly forecast model (Prophet / SARIMA / XGBoost on past 12 weeks).
   - Send supplier nudges 1–4h ahead of predicted shortage (Uber's "high demand zone" map).
   - For Airbnb-style reservation marketplaces, dynamic pricing recs to hosts for upcoming dates.
7. **Spillover handling**: when one BU is undersupplied and a neighbor is oversupplied:
   - Cross-BU incentives (drive 5 mi to busy area = +$3)
   - Wider search radius for demand
   - Cost: increases ETA / decreases match quality
8. **Anti-patterns**:
   - Single global ratio target (ignores geo variance — DoorDash early days)
   - Surge as primary lever instead of supply growth (creates anti-rider sentiment)
   - No tripwire on surge cap (PR disaster waiting)
   - Ignoring supplier morale during oversupply (drivers churn, return to former job)
   - Subsidizing both sides during shortage (burns runway fast)

## Output
Write `docs/design/supply-balance-<project>.md`:

```markdown
# Supply/Demand Balance Design — <project>
**Date:** 2026-05-13

## Marketplace shape
- **Match type:** instant-match (Uber-style)
- **Balancing unit:** H3 hex (resolution 8, ~0.7 km²) × 5-minute window
- **Demand arrival:** spiky (commute peaks 7–9am, 5–7pm; nightlife 11pm–2am Fri/Sat)
- **Supply elasticity:** 30–60 min (gig drivers logging on/off)

## Ratio targets per BU class
| Class | Ratio (demand/supply) | Status | Action |
|---|--:|---|---|
| Critical shortage | >2.0 | RED | Surge 2.0×, cross-hex bonus, push notif supply |
| Shortage | 1.3–2.0 | AMBER | Surge 1.3×, supplier nudges |
| Healthy | 0.7–1.3 | GREEN | no action |
| Slack | 0.4–0.7 | AMBER | demand promo to lapsed riders |
| Critical surplus | <0.4 | RED | freeze supplier acq, $5 demand credit |

## Surge curve
| Ratio | Multiplier | Display |
|--:|--:|---|
| <1.3 | 1.0× | (none) |
| 1.3 | 1.3× | "Prices slightly higher" |
| 1.5 | 1.5× | "Demand high" |
| 1.8 | 1.8× | "Demand very high" |
| 2.0 | 2.0× | "Demand very high" |
| 2.5 | 2.5× | "Peak pricing" |
| 3.0 | 3.0× cap | "Maximum pricing" |

- Hard cap: 3.0× (regulatory + brand). Disable surge entirely if local state of emergency.
- Decay: one step per 5-min cycle once ratio drops.
- Hysteresis: don't flip surge tier more than once per cycle.

## Lever priority during shortage
1. Supplier push notif ("$X guarantee if online next 30 min") — 5 min lead
2. Surge tier increase — instant
3. ETA padding — instant
4. Cross-hex bonus — 10 min lead
5. Demand throttle (queue) — last resort, ≥3.0× sustained

## Lever priority during surplus
1. Pause supplier ads — instant
2. Pause supplier bonus campaigns — instant
3. Demand promo to lapsed cohort — daily batch
4. Freeze new-supplier onboarding — if >7d sustained
5. Re-allocate supply via cross-hex incentive — instant

## Forecasting
- Model: SARIMA per hex × hour-of-week; refit weekly
- Horizon: 4h short-term, 7d medium-term
- MAPE target: <20% at 1h, <35% at 4h
- Anomaly detection: 2σ deviation triggers ops alert

## Comparator playbook
| Co. | Match type | BU | Primary lever | Cap |
|---|---|---|---|---|
| Uber | instant | hex × min | surge | 3–5× |
| Lyft | instant | hex × min | Prime Time | similar |
| DoorDash | dispatch | ZIP × daypart | dasher pay boost + surge | ~2× |
| Instacart | window | store × hr | shopper bonus | ~1.8× |
| Airbnb | reservation | city × night | host price recs (no platform surge) | n/a |
| Etsy | catalog | n/a | search rank + ad credits | n/a |
| TaskRabbit | dispatch | ZIP × day | tasker rate auto-set | n/a |
| OfferUp | catalog | metro | n/a (peer pricing) | n/a |

## Emergency / disaster policy
- State of emergency in BU → cap surge at 1.0× automatically
- Donate ride credits in affected geo
- Open evacuation routes free
- Reference: Uber Hurricane Sandy → today's policy

## KPIs to dashboard
| KPI | Target | Alert if |
|---|--:|--:|
| % BU-cycles in GREEN | ≥85% | <70% |
| Median wait time (demand) | <5 min | >8 min |
| Median idle time (supply) | <8 min | >15 min |
| % requests with surge >1.5× | <15% weekly | >25% |
| Forecast MAPE 1h | <20% | >30% |
| Supplier churn correlated to oversupply hexes | <5%/mo | >10% |

## Anti-patterns we will NOT do
- Single global ratio target
- Surge during declared emergencies
- Hide surge multiplier pre-confirmation
- Subsidize both sides during shortage
- Ignore supplier morale during sustained oversupply

## References
- Bill Gurley — "All Markets Are Not Created Equal" + "On the Road to Recap"
- Andrew Chen — "The Cold Start Problem", marketplace shocks chapter
- Liran Einav / Jonathan Levin — empirical surge pricing papers
- Uber Engineering blog — surge mechanics + H3 spatial indexing
- Sangeet Choudary — *Platform Scale*

## Open questions
- [ ] Build vs buy forecasting (Prophet OSS vs DataRobot)?
- [ ] Regulator notice required for surge in <state>?
- [ ] Supplier-set vs platform-set pricing for v2?
```

## Verification
- Balancing unit defined (geo × time bucket).
- Ratio bands with action per band.
- Surge curve with cap.
- Lever priority order documented.
- Forecasting model + MAPE target.
- Emergency policy explicit.
- Comparator table includes ≥5 marketplaces.
- Anti-pattern list present.
