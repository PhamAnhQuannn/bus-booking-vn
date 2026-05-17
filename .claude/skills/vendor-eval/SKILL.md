---
name: vendor-eval
description: Build-vs-buy scorecard with 3-yr TCO, lock-in risk, and exit cost for any external dependency (SaaS, API, library). Outputs to `docs/inception/vendor-<dep>.md`. Reads `/project-classify` to skip XS/S. Use when user says "build or buy", "evaluate vendor", "vendor decision", "/vendor-eval", or before adopting paid dependency.
output_size:
  XS: skip
  S: skip
  M: 1h
  L: 2h
  XL: 4h
---

# /vendor-eval — Build vs Buy + TCO

Invoke as `/vendor-eval`. Forces TCO + lock-in math before adopting any paid external dep.

## Why you'd care

Build-vs-buy decisions made on three-month thinking compound into three-year lock-in. A scorecard with 3-yr TCO and exit cost is what catches the vendor that's cheap today and unaffordable to leave in 2027.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - **XS / S** → SKIP (cheap stuff, just try).
   - M+ → continue.
2. Confirm dependency category: SaaS / API / library / managed infra.

## Inputs
- 2–4 candidate vendors (named).
- Build alternative (rough effort estimate in dev-weeks).
- Required capabilities (must-have list).
- Expected scale (users / req-per-sec / GB / etc.) at year 1, 2, 3.

## Process
1. **Capability matrix** — must-have vs nice-to-have per vendor.
2. **3-yr TCO** — pricing × scale projection per year. Include hidden costs (egress, integration eng-time, support tier).
3. **Build TCO** — eng-weeks × loaded cost + ongoing maint + opportunity cost.
4. **Lock-in score** — how hard to migrate off (data export? proprietary API? std protocol?).
5. **Exit cost** — months of eng-time to swap out at year 3.
6. **Verdict** — BUILD / BUY-VENDOR-X / WAIT.

## Output
Write `docs/inception/vendor-<dep-slug>.md`:

```markdown
# Vendor Eval — <dependency>
**Date:** <YYYY-MM-DD> | **Verdict:** BUILD / BUY-<vendor> / WAIT

## Candidates
| Vendor | Pricing model | Yr1 cost | Yr3 cost | Lock-in (1-5) | Exit cost (mo) |
|--------|---------------|---------:|---------:|--------------:|---------------:|
| V1 | ... | $X | $Y | X | X |
| V2 | ... | $X | $Y | X | X |
| Build | dev-weeks | $X | $Y | 0 | 0 |

## Capability matrix
| Capability (must) | V1 | V2 | Build |
|-------------------|:--:|:--:|:-----:|
| ... | ✓ | ✓ | ⨯ |

## TCO 3-yr projection
| Year | Users | V1 | V2 | Build |
|------|------:|---:|---:|------:|
| 1 | ... | $ | $ | $ |
| 2 | ... | $ | $ | $ |
| 3 | ... | $ | $ | $ |
| **Total** | | **$** | **$** | **$** |

## Lock-in & exit
- V1: <std formats? data export?>
- V2: <std formats? data export?>

## Verdict rationale
<2–3 sentences. Cheapest is rarely the answer; weight lock-in + exit cost.>

## Re-evaluate when
- Pricing changes 2x
- Scale crosses next tier
- Critical feature gap appears
```

## Verification
- ≥2 vendors compared (not single-vendor decision).
- TCO covers 3 yr with explicit scale assumption.
- Lock-in + exit cost scored, not waved away.
