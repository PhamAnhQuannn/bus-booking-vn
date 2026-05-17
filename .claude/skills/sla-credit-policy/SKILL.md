---
name: sla-credit-policy
description: Service-level agreement tier + automated credit-issue policy so the sales team has a contractable number and the finance team has a deterministic refund rule. Outputs to `docs/design/sla-credits.md`. Reads `/project-classify` to skip XS/S. Use when user says "SLA", "service credits", "uptime guarantee", "credit policy", "/sla-credit-policy", or before first enterprise contract with uptime clause.
output_size:
  XS: skip
  S: skip
  M: 4h
  L: 4h
  XL: 4h
---

# /sla-credit-policy — SLA + Credits Contract

Invoke as `/sla-credit-policy`. SLA without credit policy is marketing. Credit policy without SLO basis is gambling. Tie SLA tier to measurable SLOs, auto-issue credits, cap exposure.

## Why you'd care

Selling enterprise without an SLA means the buyer writes one for you — and the credit policy gets negotiated in the worst possible moment, the moment of an outage. Build it before the first contract.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS/S → SKIP.
2. SLOs defined (see `/slo-define`); SLA is contractual derivative of SLO.
3. Billing system can issue credits (manual is OK for v1; automated for scale).

## Inputs
- SLO baseline per surface (e.g., API availability 99.9% monthly)
- Pricing tiers (free / pro / enterprise) — each gets own SLA tier
- Max acceptable credit exposure (% of MRR per incident)
- Customer-segment patience (enterprise demands SLA; SMB tolerates "best effort")

## Process

1. **SLA tier table** — match contract to plan:

   | Plan | Uptime SLA | Measurement window | Credit cap |
   |---|---|---|---|
   | Free | none ("best effort") | n/a | n/a |
   | Pro (self-serve) | 99.9% monthly | calendar month | 30% of monthly fee |
   | Business | 99.95% monthly | calendar month | 50% of monthly fee |
   | Enterprise | 99.99% monthly + 4h MTTR | rolling 30d | 100% of monthly fee |

   SLA is always looser than SLO. SLO budget tells you when to slow down; SLA tells you when you owe money.

2. **What counts as "down"** — make this unambiguous:

   | Counts | Doesn't count |
   |---|---|
   | API 5xx error rate > 5% for ≥5min | Single-request 5xx |
   | Login flow failure > 10% for ≥5min | One user's flaky network |
   | Customer-facing endpoint p99 > 10× baseline for ≥10min | Background job slow |
   | Hard outage (full region) | Scheduled maintenance with notice |
   | Customer data inaccessible | Read-only mode during failover |

   Exclude (always): scheduled maintenance ≤4h/month with ≥72h notice, force majeure, customer's own misconfig, third-party IdP outage.

3. **Credit calculation** — deterministic ladder:

   | Monthly uptime | Credit (% of monthly fee) |
   |---|---|
   | < 99.9% | 10% |
   | < 99.5% | 25% |
   | < 99.0% | 50% |
   | < 95.0% | 100% |

   Credits apply to next invoice. Never cash refund (unless contract requires). Cap = SLA tier credit cap.

4. **Customer claim flow**:
   - Customer files via support ticket within 30 days of incident
   - Support pulls SLO dashboard for the period
   - Auto-approve if measured uptime < SLA target
   - Issue credit in billing system within 5 business days
   - Notify customer with calculation breakdown

5. **Automation** — for scale:
   - Monthly job: per-tenant uptime calculated from SLI store
   - If tenant has SLA tier AND monthly uptime < SLA → file proactive credit
   - Email customer: "We missed our SLA in <month>. Applied <X>% credit to next invoice."
   - Proactive credits build trust; reactive credits feel grudging.

6. **Status page integration**:
   - Incidents tagged with start/end time + severity
   - Status page is the canonical incident record
   - Customer claims reference incident ID from status page
   - Auto-generate SLA impact report per incident: "<X> customers below SLA threshold"

7. **Contract language** — pin to specific clauses:
   ```
   "Service Credits" means a credit equal to a percentage of the monthly fee
   for the affected Service, calculated according to the table above. Service
   Credits are Customer's sole and exclusive remedy for any Service unavailability.
   Total Service Credits in any month shall not exceed <CAP>% of that month's fee.
   Credits apply to next billing cycle and are non-transferable.
   ```
   Lawyer reviews. Engineering owns the measurement.

8. **Internal review cadence**:
   - Weekly: SLO burn-rate dashboard (engineering)
   - Monthly: SLA compliance report (finance + CS + eng leadership)
   - Quarterly: credit exposure review — is SLA too aggressive?
   - Per-incident: postmortem references SLA impact (see `/incident-postmortem-template`)

9. **Anti-patterns**:
   - SLA tighter than SLO — guaranteed credits even when system is "healthy"
   - No measurement clause — customer and you argue what counted
   - Credit cap absent — single bad month = refund liability
   - Manual claims only — slow + biased; auto-credits build trust
   - SLA on free tier — gives away leverage with no revenue
   - "Best effort" written into paid contract — unenforceable; either commit or don't sell SLA

## Output

Write `docs/design/sla-credits.md`:

```markdown
# SLA + Credits — <project>
**Date:** <YYYY-MM-DD> | **Owner:** <finance + platform>

## Tier table
| Plan | Uptime SLA | Window | Cap |
|---|---|---|---|
| Free | none | — | — |
| Pro | 99.9% | monthly | 30% |
| Business | 99.95% | monthly | 50% |
| Enterprise | 99.99% + 4h MTTR | rolling 30d | 100% |

## What counts as down
- API 5xx rate > 5% for ≥5min
- Customer-facing p99 > 10× baseline for ≥10min
- Hard region outage

## Exclusions
- Scheduled maintenance ≤4h/mo with 72h notice
- Force majeure
- Customer-side misconfig
- Third-party IdP outage (if SSO)

## Credit ladder
| Uptime | Credit |
|---|---|
| <99.9% | 10% |
| <99.5% | 25% |
| <99.0% | 50% |
| <95.0% | 100% |

## Flow
- Auto-detect via monthly SLO job
- Proactive credit applied to next invoice
- Email customer with calculation
- Customer can file within 30d if missed

## Measurement source
- SLO dashboard (prometheus / DD)
- Per-tenant uptime from SLI store
- Status page incidents = canonical record

## Contract clause
[Paste reviewed legal text here]

## Review cadence
- Weekly: SLO burn rate
- Monthly: SLA compliance report
- Quarterly: credit exposure review
```

## Verification
- SLA strictly looser than SLO (room to operate).
- Credit ladder caps exposure per plan.
- Exclusions enumerated and unambiguous.
- Auto-credit job lives in monthly batch (or manual runbook if pre-scale).
- Status page is canonical incident record.
- Legal review checkbox.
