---
name: category-design
description: Define your product category — own / co-create / fit-existing. Outputs to `docs/inception/category-<project>.md`. Reads `/project-classify` to skip XS/S. Use when user says "category design", "create a category", "what is this product", "/category-design", or after `/positioning-statement` if existing categories don't fit.
output_size:
  XS: skip
  S: skip
  M: 1h
  L: 2h
  XL: 4h
---

# /category-design — Category Strategy

## Why you'd care

Category kings absorb 70%+ of category economics; everyone else fights over scraps. Deciding whether to fit an existing category, co-create one, or own a new one is a positioning decision that compounds — or starves — every subsequent marketing dollar.

Invoke as `/category-design`. Category-king takes 70%+. Or fit existing.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS/S → SKIP (overthinking)
   - M+ → consider only if no fit in existing taxonomy
2. Read `docs/inception/competitor-scan-<project>.md`.

## Inputs
- Product description.
- Existing categories competitors use.
- Buyer's mental model (from interviews).

## Process
1. **List existing categories** product COULD fit in.
2. **Category fit scoring** — does buyer search this term? does it position you well? compete on equal terms?
3. **Decision tree**:
   - Category exists + you fit → JOIN (cheaper, accept comparison)
   - Category exists + you don't fit → REPOSITION (find adjacent existing)
   - No category fits + you have wedge → CREATE (expensive, requires education)
   - No category fits + you don't have wedge → don't create yet (premature)
4. **If CREATE**: name it, define it, create POV manifesto.
5. **If JOIN/REPOSITION**: identify category leader, study; differentiate within.

## Output
Write `docs/inception/category-<project>.md`:

```markdown
# Category Design — <project>
**Date:** <YYYY-MM-DD>

## Decision
**JOIN / REPOSITION / CREATE**

## Existing categories considered
| Category | Buyer-search vol | Comp leaders | We fit? | Verdict |
|---|--:|---|---|---|
| CRM | high | Salesforce, HubSpot | Partial | REPOSITION as "CRM for X" |
| Customer Success | med | Gainsight | No | — |
| <new category> | n/a | — | — | CREATE |

## Chosen category
**<name>**

## Definition (1 paragraph)
<what this category solves, who buys, distinct from <adjacent>>

## POV manifesto (if CREATE)
- Old way: <X>
- Why broken: <Y>
- New way: <Z>
- Who needs it: <persona>

## Education plan (CREATE only)
- Content: blog, whitepaper, conference talk
- Allies: analysts, influencers, podcast hosts
- Timeline: 12-24 mo to category awareness

## Risks
- CREATE: education cost, slow adoption
- JOIN: commoditized, comparison-grid loss
- REPOSITION: stuck-in-middle, neither here nor there
```

## Verification
- ≥3 existing categories evaluated before CREATE.
- CREATE only if buyer search + competitor data confirm gap.
- POV manifesto crisp (1 paragraph max).
- Education plan budgeted if CREATE.
