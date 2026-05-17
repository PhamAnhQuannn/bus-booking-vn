---
name: analyst-landscape-map
description: Map where you'd land in Gartner/Forrester/G2/Capterra reports — analyst-relations strategy. Outputs to `docs/inception/analyst-map-<project>.md`. Reads `/project-classify` to skip XS/S/M. Use when user says "Gartner", "Forrester", "G2", "Magic Quadrant", "/analyst-landscape-map", or for L+ B2B sales motion.
output_size:
  XS: skip
  S: skip
  M: 1h
  L: 2h
  XL: 4h
---

# /analyst-landscape-map — Analyst Positioning

## Why you'd care

Enterprise buyers shortlist from Gartner/Forrester quadrants before they ever see your sales deck. If you're not on the map, you're not in the eval — analyst relations is a pipeline channel, not a marketing vanity exercise.

Invoke as `/analyst-landscape-map`. Enterprise B2B: analyst placement = pipeline.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS/S/M → SKIP (analyst engagement = enterprise tax)
   - L/XL → required for enterprise GTM
2. Read `docs/inception/category-<project>.md` + `competitor-scan-<project>.md`.

## Inputs
- Product category (analyst-recognized name).
- Top analysts covering category (Gartner / Forrester / IDC / 451 / G2 / Capterra).
- Public reports + Magic Quadrants from past 2 yr.

## Process
1. **Identify covering reports** — Magic Quadrant, Wave, MarketScape, G2 Grid.
2. **Map current vendors** — quadrant by vision × execution.
3. **Identify whitespace** — leader / challenger / niche / visionary cells.
4. **Pick target placement** — where you can credibly land in 18mo.
5. **Inclusion criteria per report** — read each analyst's published criteria.
6. **Gap to inclusion** — what you must reach (revenue threshold, customer count, geo, certifications).
7. **Engagement plan** — analyst briefings, customer references, paid subscriptions.

## Output
Write `docs/inception/analyst-map-<project>.md`:

```markdown
# Analyst Landscape Map — <project>
**Date:** <YYYY-MM-DD> | **Category:** <X>

## Covering reports
| Analyst | Report | Last published | Next due | Inclusion threshold |
|---|---|---|---|---|
| Gartner | MQ for <X> | YYYY-MM | YYYY-MM | $20M ARR + 100 customers |
| Forrester | Wave for <X> | YYYY-MM | YYYY-MM | $15M ARR |
| G2 | Grid for <X> | continuous | — | 25 reviews |

## Current map (top vendors)
| Vendor | MQ position | Strengths | Weaknesses |
|---|---|---|---|
| Salesforce | Leader | brand, breadth | cost, complexity |
| HubSpot | Leader | UX, SMB | depth |
| Pipedrive | Niche | simplicity | enterprise gaps |
| <us> | not yet | — | — |

## Target placement (18 mo)
**Niche Player → Visionary in Gartner MQ**
- Rationale: vision strong, execution gap due to revenue
- Path: hit $X ARR + N enterprise refs

## Inclusion gap analysis
| Criterion | Current | Required | Gap | Plan |
|---|---|---|---|---|
| ARR | $1M | $20M | $19M | growth plan |
| Customer count | 50 | 100 | 50 | sales hire |
| Geo | US only | NA + EMEA | EU launch | 2026Q3 |
| SOC2 | none | Type II | full | /soc2-readiness-pre |

## Engagement plan
- Q1: brief Gartner X, Forrester Y (no fee)
- Q2: subscribe to Gartner ($X/yr)
- Q3: customer ref pipeline build
- Q4: inquiry-driven analyst calls

## Verdict
**ANALYST-VIABLE / TOO-EARLY / NOT-CATEGORY**
```

## Verification
- ≥2 covering reports identified.
- Inclusion criteria pulled from public source.
- Gap analysis quantified.
- Engagement plan budgeted (analyst subs are $$$).
