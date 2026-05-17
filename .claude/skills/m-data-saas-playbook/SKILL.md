---
name: m-data-saas-playbook
description: M-class data-SaaS inception playbook — names the regulatory front-load reorder vs. canonical order. For products that scrape, store PII, or move payments, regulatory deal-killers MUST fire in PARALLEL with `/problem-validation`, not after. Outputs to `docs/inception/m-data-saas-playbook-<project>.md`. Use when user says "data SaaS inception", "scrape product inception", "PII product playbook", "/m-data-saas-playbook", or when `/project-classify` returns M AND domain in {scrape, PII, payments}.
output_size:
  XS: skip
  S: skip
  M: 30m
  L: 30m
  XL: skip
---

# /m-data-saas-playbook — M Data-SaaS Inception Reorder

## Why you'd care

M-class data SaaS (scraping + PII + payments) has regulatory deal-killers that fire AFTER you've done validation if you follow the canonical order — by then the kill is more expensive. The playbook re-orders GDPR/scraping-ethics into parallel with validation, not after.

Invoke as `/m-data-saas-playbook`. Canonical inception order (problem → market → pricing → financials → regulatory) is WRONG for M-class scrape/PII/payments products. Regulatory deal-killers must surface BEFORE customer-validation effort sinks. Sim sweep finding: 4/10 M sims hit this pattern (price-monitor-amazon, indie-newsletter-analytics, podcast-host-saas, dev-status-page-saas).

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - Class ≠ M → SKIP (XL has its own regulated-product playbook; XS/S skip; L runs full sequence anyway).
   - Domain not in {scrape, PII, payments} → SKIP.
2. M + qualifying domain → continue.

## Inputs
- Product domain (scrape / PII-heavy / payments).
- Target 3rd-party services (LinkedIn, Amazon, Twitter, Stripe, etc.).
- Target geos (US, EU, UK, CA, etc.).

## Process
1. **Identify the parallel track**. Standard canonical order assumes regulatory is a late check. Front-load reverses that:

   | Canonical step | M data-SaaS reorder |
   |---|---|
   | 1. problem-validation | 1a. problem-validation **+** 1b. regulatory-preflight (parallel) |
   | 2. founder-fit | 2. founder-fit (unchanged) |
   | 3. competitor-scan | 3. competitor-scan (unchanged) |
   | 4. market-sizing | 4. market-sizing (unchanged) |
   | 5. pricing-model | 5. pricing-model (unchanged) |
   | 6. unit-economics | 6. unit-economics (gated by regulatory verdict) |
   | 7. regulatory-preflight (late) | — already done at step 1b — |
   | 8. inception-gate-review | 8. inception-gate-review |

2. **Name the parallel skills per domain**:

   | Domain | Skills running in parallel with `/problem-validation` |
   |---|---|
   | scrape | `/scraper-ethics-pre`, `/tos-violation-screen`, `/regulatory-preflight` |
   | PII-heavy | `/gdpr-preflight`, `/pii-inventory-pre`, `/regulatory-preflight`, `/ccpa-preflight` (if US-CA) |
   | payments | `/pci-preflight`, `/aml-kyc-design`, `/sanctions-screen`, `/regulatory-preflight` |

3. **Set the abort condition**. If ANY parallel-track skill verdict = KILL (e.g., ToS scraping forbidden + no API alternative; GDPR DPIA + no lawful basis; PCI Level 1 required + no path to compliance), abort `/problem-validation` immediately. Sunk-cost-protect the validation hours.

4. **Set the gate**. Both tracks must reach ≥PASS before `/inception-gate-review`. Regulatory CONDITIONAL (e.g., switch from scrape to paid API at $X/mo) carries forward as a CONDITIONAL-GO item.

5. **Document the timeline**.

## Output
Write `docs/inception/m-data-saas-playbook-<project>.md`:

```markdown
# M Data-SaaS Playbook — <project>
**Date:** <YYYY-MM-DD> | **Domain:** scrape / PII-heavy / payments

## Why front-load
Canonical order would sink <N> hours into customer validation before discovering <regulatory deal-killer>. Reorder fires regulatory checks in parallel.

## Parallel-track skill set
| Track | Skill | Verdict-by date |
|---|---|---|
| Validation | /problem-validation | <YYYY-MM-DD> |
| Regulatory | /regulatory-preflight | <YYYY-MM-DD> |
| Regulatory | /<domain-specific-skill-1> | <YYYY-MM-DD> |
| Regulatory | /<domain-specific-skill-2> | <YYYY-MM-DD> |

## Abort condition
If any regulatory verdict = KILL by <YYYY-MM-DD>, abort `/problem-validation`. Pivot or `/idea-kill-list`.

## Carry-forward to gate
| Item | To gate-review as | Owner | Deadline |
|---|---|---|---|
| <named regulatory CONDITIONAL> | CONDITIONAL-GO blocker | <name> | <YYYY-MM-DD> |

## Sequence diagram
```mermaid
gantt
  title M data-SaaS inception (front-loaded)
  dateFormat YYYY-MM-DD
  section Validation
  problem-validation         :a1, 2026-MM-DD, 7d
  section Regulatory
  regulatory-preflight       :b1, 2026-MM-DD, 4d
  scraper-ethics-pre         :b2, 2026-MM-DD, 3d
  tos-violation-screen       :b3, 2026-MM-DD, 3d
  section Gate
  inception-gate-review      :c1, after a1 b1 b2 b3, 1d
```

## Verdict
**FRONT-LOAD-CONFIRMED** — parallel tracks scheduled with named verdict-by dates and a documented abort condition.
```

## Verification
- Domain identified (scrape / PII / payments).
- Parallel-track skill set named per domain.
- Abort condition has a named date.
- CONDITIONAL items, if any, carried to `/inception-gate-review` AMBER block.
- Gantt or sequence drawn.
