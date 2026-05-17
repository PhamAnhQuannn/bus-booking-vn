---
name: early-design-partner-plan
description: Recruit 3–10 design partners for co-build phase — selection, contract, cadence, exit. Outputs to `docs/inception/design-partners-<project>.md`. Reads `/project-classify` to skip XS/S. Use when user says "design partner", "co-build", "lighthouse customer", "/early-design-partner-plan", or for B2B M+.
output_size:
  XS: skip
  S: skip
  M: 1h
  L: 2h
  XL: 4h
---

# /early-design-partner-plan — Design Partner Program

## Why you'd care

The B2B product that ships without 3-10 named design partners is the one that gets feature-shop momentum but no contractual feedback loop — and the founder builds three quarters of roadmap based on the loudest demo question instead of structured input from teams who've committed to use the product in real workflows. A formal design-partner cohort with a contract, cadence, and exit clause is what converts "we have lots of interest" into named logos for the deck and the production-grade signal needed to lock the wedge.

Invoke as `/early-design-partner-plan`. B2B M+. 3–10 partners, named, deeply involved, ≤6 mo.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS/S → SKIP (B2C / solo)
2. Read `docs/inception/buyer-persona-<project>.md`.

## Inputs
- ICP firmographic.
- Founder network + warm intros available.
- Non-binding LOI templates.

## Process
1. **Partner profile** — must-haves:
   - Felt the pain acutely (interviewed, scored painkiller)
   - Has budget authority OR sponsor with it
   - Willing to invest 2–4 hr/wk for 3–6 mo
   - Tolerates rough edges
   - Allows public reference (logo + quote) on graduation
2. **Sourcing** — warm intros only (cold = wrong fit risk):
   - Founder network
   - Investor intros
   - Past colleagues
3. **Vetting call** — pain severity, alternatives tried, willingness to commit.
4. **Contract / MOU** — non-binding but explicit:
   - Free or steeply discounted (≤50% list)
   - 6-mo program length
   - Cadence: weekly 30-min sync
   - Mutual exit clause (either side, 14d notice)
   - IP: customer owns their data, you own product
   - Reference rights at graduation
5. **Cadence ops**:
   - Weekly 30-min call (founder + champion)
   - Slack/Teams shared channel
   - Bi-weekly written progress recap
   - Monthly exec readout (sponsor)
6. **Graduation criteria**:
   - 3 use cases successfully delivered
   - Champion would defend product internally
   - Public case study + reference call OK
7. **Anti-patterns** — too many partners, no exit clause, building per-customer features that don't generalize.

## Output
Write `docs/inception/design-partners-<project>.md`:

```markdown
# Design Partner Plan — <project>
**Date:** <YYYY-MM-DD> | **Target partners:** 3–10

## Partner profile criteria
- Pain severity ≥7/10 (per `/pain-severity-rubric`)
- Budget or sponsor with budget
- 2–4 hr/wk commitment for 3–6 mo
- Allows reference on graduation
- Firmographic: <X>

## Target partner list
| Org | Champion | Source | Pain severity | Status |
|---|---|---|--:|---|
| Acme Co | VP Eng Jane | warm intro | 8 | call scheduled |
| Beta Inc | Director Bob | investor intro | 7 | LOI signed |
| Gamma Ltd | Founder Carol | founder network | 9 | onboarding |

## MOU template
- Term: 6 months
- Pricing: free first 3 mo, 50% list mo 4–6
- Cadence: weekly 30-min
- Exit: 14d notice mutual
- IP: customer owns data; vendor owns product
- Reference: logo + quote permitted at graduation
- Confidentiality: mutual NDA

## Operating cadence
- Weekly: 30-min sync (champion + founder)
- Slack: shared channel #<name>-<project>
- Bi-weekly: written recap (delivered features, blockers, next)
- Monthly: exec readout to sponsor (15 min)

## Graduation criteria (per partner)
1. ≥3 use cases live
2. Champion-internal advocacy proven (shared internally)
3. Public case study draft approved
4. Converts to paying contract

## Anti-patterns
- ✗ >10 partners (cannot serve)
- ✗ No exit clause (drag forever)
- ✗ Per-customer features (build for class not customer)
- ✗ Free indefinitely (no skin in game)

## Success metrics
- Activation: ≥80% of partners active in product weekly by D30
- Graduation: ≥60% convert to paying by D180
- Reference: ≥80% of graduates allow case study
```

## Verification
- Partner profile criteria quantified.
- MOU template has term + pricing + exit + reference clauses.
- Cadence ops specific.
- Graduation criteria explicit.
- Anti-patterns called out.
