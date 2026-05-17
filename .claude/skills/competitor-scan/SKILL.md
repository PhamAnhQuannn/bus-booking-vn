---
name: competitor-scan
description: Build 3–5 competitor feature matrix + gap analysis to find positioning whitespace before committing to build. Outputs to `docs/inception/competitors-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "competitor scan", "who else does this", "is there whitespace", "/competitor-scan", or before `/positioning-statement`.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /competitor-scan — Competitor Matrix + Gap Analysis

## Why you'd care

"There's no competitor" usually means "I haven't looked hard enough." A real comp pass before positioning is what stops you from building the 12th identical product in a saturated category — and reveals the whitespace where it's actually safe to pitch.

Invoke as `/competitor-scan`. Forces a real comp pass before pretending the market is empty.

## Pre-flight
1. Read `docs/classify/<project>.md` if exists.
   - Class **XS** → SKIP (throwaway, no market).
   - S+ → continue.
2. Read `docs/inception/validation-<project>.md` if exists — pull "competitor traction" evidence as seed list.

## Inputs
- 3–5 closest competitors (named, URL'd). If user can name only 0–1, push back: "no competitor often = no demand."
- 5–10 product dimensions to compare (feature, price, segment, distribution, etc.).

## Process
1. **Identify** — name 3–5. Mix of direct (same use case), indirect (different use case, same job-to-be-done), substitute (manual workaround).
2. **Score matrix** — for each (competitor × dimension): note value or ✓/✗.
3. **Whitespace** — list 2–4 dimensions where ALL competitors are weak/absent.
4. **Threat ranking** — rank competitors by threat (existing customers + funding + roadmap velocity).
5. **Differentiation hypothesis** — 1 sentence: "We win on X because Y."

## Output
Write `docs/inception/competitors-<project>.md`:

```markdown
# Competitor Scan — <project>
**Date:** <YYYY-MM-DD> | **Class:** <X>

## Competitors
| # | Name | URL | Type | Funding | Customers | Threat (1-5) |
|---|------|-----|------|---------|-----------|-------------:|
| 1 | ... | ... | direct/indirect/substitute | ... | ... | X |

## Feature × competitor matrix
| Dimension | Us (target) | C1 | C2 | C3 | C4 | C5 |
|-----------|------------|----|----|----|----|----|
| Pricing | ... | ... | ... | ... | ... | ... |
| Target segment | ... | ... | ... | ... | ... | ... |
| Onboarding time | ... | ... | ... | ... | ... | ... |
| ... | ... | ... | ... | ... | ... | ... |

## Whitespace (gaps in market)
1. ...
2. ...

## Differentiation hypothesis
> "We win on **<dimension>** because **<reason>**."

## Risks
- Incumbent reaction time: <fast/slow>
- Commoditization risk: <high/med/low>
```

## Verification
- ≥3 competitors named.
- ≥5 dimensions scored.
- ≥1 whitespace gap identified OR explicit "no whitespace, kill" note.
