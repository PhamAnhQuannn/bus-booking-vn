---
name: data-moat-design
description: Design a data moat — proprietary dataset, feedback loops, data-network effects. Outputs to `docs/inception/data-moat-<project>.md`. Use when user says "data moat", "data flywheel", "proprietary data", "AI moat", "/data-moat-design", or for AI / ML-driven products.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /data-moat-design — Data That Compounds

## Why you'd care

The "AI startup" wrapping the same foundation model competitors call from the same API has no defensible advantage — and a year in, the per-token economics get worse while three indistinguishable competitors raise the same Series A pitch. Proprietary data that uniquely flows through your product and improves it (feedback loops, labeled outcomes, edge-case corpora) is the only moat that compounds over time; designing the collection mechanism at inception is roughly 100× cheaper than retrofitting it once usage is already flowing.

Most "AI startups" don't have a data moat. They have a model someone else trained. Real data moat = data you uniquely collect that improves your product, that competitors can't get cheaply.

## Pre-flight
None. Pairs with `/network-effect-design`, `/competitive-moat-analysis`.

## Inputs
- Product surface — what data flows through it?
- AI / ML use today or planned.

## Process
1. **Inventory data sources** — what data does the product produce? Categorize:
   - **User-generated** (reviews, content, ratings)
   - **Behavioral** (clicks, dwell, sequences)
   - **Transactional** (orders, prices, outcomes)
   - **Sensor / measurement** (location, performance, environmental)
   - **Inferred / derived** (predictions feedback)
2. **Test "moat" criteria** per source — does it satisfy ALL of:
   - [ ] Hard to acquire elsewhere (not in any public dataset)
   - [ ] Compounds with use (more users → more data → better product)
   - [ ] Improves a core feature, not a side toy
   - [ ] Cannot be synthesized cheaply
   - [ ] Defensible legally (ownership clear, no scraper-replicable)
3. **Feedback-loop design** — what's the closed loop?
   - Input: <user action>
   - Capture: <data point>
   - Train / aggregate: <model / dataset>
   - Reflect: <improved output to user>
   - Effect: <user does more / different> → more data
4. **Cold-start strategy** — how do you get useful before having data?
   - Public dataset bootstrap
   - Founder-curated seed data
   - Concierge-collected (humans label)
   - Synthetic / simulated
5. **Defensibility timeline** — how many months / users until competitors' fresh data + open models close the gap?
6. **Ethics gate** — consent, anonymization, retention, jurisdiction. Flag GDPR/CCPA/HIPAA implications.

## Output
Write `docs/inception/data-moat-<project>.md`:

```markdown
# Data Moat Design — <project>
**Date:** <YYYY-MM-DD>

## Data inventory (example: B2B invoice-collections SaaS)
| Source | Type | Volume/day at 1k users | Unique to us? |
|--------|------|------------------------|---------------|
| Invoice-payment outcomes | Transactional | ~200 events | Y — proprietary |
| Dunning-email response timings | Behavioral | ~500 events | Y |
| Customer credit-risk signals | Inferred | ~100 events | Y |
| Industry benchmark reports | User-generated | ~50 events | N — also on G2/scraped |

## Moat candidate scoring
| Source | Hard to get | Compounds | Core feature | Synth cost | Legal | Moat? |
|--------|-------------|-----------|--------------|------------|-------|-------|
| Invoice-payment outcomes | ✓ | ✓ | ✓ | High | ✓ | **YES** |
| Dunning-email response timings | ✓ | ✓ | ✓ | Med | ✓ | **YES** |
| Industry benchmark reports | ✗ | — | — | — | — | No |
| Credit-risk signals | ✓ | ✓ | ✗ | High | ✓ | Maybe — needs core-feature wire |

## Feedback loop
**Loop name:** Payment-delay prediction
- **Input:** Invoice sent
- **Capture:** Outcome (paid on time / late / defaulted) + contextual signals
- **Train:** Per-vertical model retrained nightly
- **Reflect:** Risk score on outgoing invoices → suggested dunning cadence
- **Effect:** Finance team trusts suggestion → more invoices auto-flagged → more training data

## Cold-start
- **Weeks 1-4:** Synthetic + industry baseline model
- **Weeks 5-12:** Per-tenant fine-tune on first 100 invoices
- **Week 13+:** Self-sustaining loop

## Defensibility timeline
- Time to moat materialize: ~6 months from first paying customer
- Catch-up cost for fast follower: ~$<X> + ~12 months
- Risk: open-source credit-risk models + public default datasets close 60% of moat

## Ethics gate
- [ ] Consent in ToS for behavioral / outcome data
- [ ] PII anonymized / hashed
- [ ] Retention: <X> months for raw, indefinite for aggregated
- [ ] Cross-ref → `/pii-inventory`, `/privacy-by-design-charter`

## Next
- Lawful basis per data type → `/lawful-basis-mapping`
- Privacy by design → `/privacy-by-design-charter`
- Combine moats → `/competitive-moat-analysis`
```

## Verification
- ≥ 3 data sources inventoried.
- Moat criteria scored honestly (most "no").
- ≥ 1 feedback loop diagrammed end-to-end.
- Cold-start plan covers pre-data months.
- Ethics gate items concrete (not just "consent").
