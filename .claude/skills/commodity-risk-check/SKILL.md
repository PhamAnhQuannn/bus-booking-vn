---
name: commodity-risk-check
description: Check if product becomes a commodity (race-to-zero pricing, AI-trivial-to-clone, no defensibility). Outputs to `docs/inception/commodity-risk-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "commodity risk", "race to zero", "AI will clone this", "/commodity-risk-check", or before fundraise.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /commodity-risk-check — Race-to-Zero Detector

## Why you'd care

A product that's trivial to clone with an LLM or open-source equivalent has no pricing power, and no pricing power means no margin, no R&D budget, no business. Catching commodity-shape before fundraise is what separates "interesting demo" from "fundable company."

Invoke as `/commodity-risk-check`. Commodity = no margin = not a business.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP
2. Read `docs/inception/incumbent-moat-<project>.md` if exists.

## Inputs
- Product capability list.
- Stack: AI/no-AI, OSS/proprietary.
- Customer switching cost.

## Process
1. **Commodity flags scoring** — 0=safe, 10=full commodity:
   - GPT-clonable (one-prompt LLM does 80%)
   - OSS exists (Github repo with same scope)
   - No data network effect
   - No switching cost
   - Substitute-rich (5+ comparable solutions buyers know)
   - Standardized output (interchangeable result)
   - Buyer compares on price (not features/brand)
2. **Total** ≥40 = HIGH commodity risk.
3. **Counter-moats inventory** — what can you build that's NOT commoditizable:
   - Proprietary dataset
   - Workflow integration deep
   - Brand + trust (regulated/health/finance)
   - Network effect
   - Personalization moat (your X learns user)
4. **Pricing implication** — if commodity-risk HIGH, price war is inevitable; need volume or differentiation.

## Output
Write `docs/inception/commodity-risk-<project>.md`:

```markdown
# Commodity Risk Check — <project>
**Date:** <YYYY-MM-DD>

## Risk scoring
| Flag | Score 0–10 | Rationale |
|---|--:|---|
| GPT-clonable | 8 | Core feature is LLM summarization |
| OSS exists | 5 | LangChain templates do 60% |
| No data network effect | 7 | Each user's data isolated |
| No switching cost | 6 | Export easy, no integration depth |
| Substitute-rich | 7 | 6 named alternatives |
| Standardized output | 4 | Some customization |
| Buyer compares price | 5 | Mid-market sensitive |
| **Total** | **42** | **HIGH** |

## Verdict
**LOW / MODERATE / HIGH** commodity risk

## Counter-moats inventory
- ✓ Possible: proprietary integration with <X>
- ✓ Possible: vertical-specific dataset (we collect, they don't)
- ✗ Not possible: network effect (single-player tool)
- ✓ Possible: brand/regulatory (target healthcare niche)

## Recommendation
- HIGH risk + counter-moats possible → pivot to vertical/regulated niche
- HIGH risk + no counter-moats → kill or build for short-term cash
- MODERATE → invest in 1-2 counter-moats early
- LOW → standard execution

## 12-mo defense plan
1. Build <counter-moat A>
2. Lock in <integration B>
3. Sign <regulatory cert C>
```

## Verification
- All 7 flags scored (skipping = blind spot).
- Counter-moats checked against feasibility.
- 12-mo defense plan concrete.
- HIGH = explicit pivot or kill recommendation.
