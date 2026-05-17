---
name: refund-queue-runbook
description: Runbook for processing the refund queue fast, fair, and audit-clean so finance, support, and customers all stay sane. Outputs to `docs/ops/refund-runbook.md`. Reads `/project-classify` to skip XS. Use when user says "refund queue", "refund policy", "chargeback flow", "refund SLA", "/refund-queue-runbook", or after first chargeback.
output_size:
  XS: skip
  S: 1h
  M: 2h
  L: 4h
  XL: 4h
---

# /refund-queue-runbook — Clear the Queue Cleanly

Invoke as `/refund-queue-runbook`. Slow refunds breed chargebacks; chargebacks breed processor fines. Tight runbook + clear policy = fewer disputes, happier customers, clean books.

## Why you'd care

Refund queues that don't have an SLA become customer-support black holes — and the chargeback rate that follows triggers processor scrutiny. A runbook keeps refunds fast, fair, and auditable.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS → SKIP.
2. Payment processor admin access (Stripe / Paddle / Braintree).
3. Refund policy approved by founder + legal-sense check.

## Inputs
- Product type (SaaS subscription / one-time / usage-based / marketplace)
- Refund policy (full N-day, prorated, none, case-by-case)
- Chargeback rate baseline (target < 0.5%; > 1% triggers processor review)
- Approval thresholds (auto-approve under $X; manual above)

## Process

1. **Policy first** — written + public:

   | Product type | Default policy |
   |---|---|
   | Monthly SaaS | full refund within 14d; prorated after |
   | Annual SaaS | full within 30d; prorated after |
   | One-time digital | 7d no-questions; case-by-case after |
   | Usage-based | refund unused credits; no refund for consumed |
   | Marketplace | hold + investigate; refund if seller breach |

   Publish on `/refunds` page. Link from receipt email + footer.

2. **Auto vs manual triage** — speed where safe:

   | Refund request | Path |
   |---|---|
   | < $50, within policy window | auto-approve, refund within 1h |
   | $50-$500, within policy | support tier-1 approve, < 24h |
   | > $500 or out of policy | tier-2 + finance review, < 72h |
   | Fraud-flagged account | hold + security review |
   | Chargeback already filed | dispute path, not refund path |

3. **Queue SLA**:
   - First response < 4 business hours
   - Decision < 24h for in-policy, < 72h for edge
   - Refund landed in customer account: 5-10 business days (processor dependent; tell them)
   - Chargeback response: within processor deadline minus 2 days buffer

4. **Refund execution** — exact steps:
   1. Verify identity (email match + last-4 of card if doubt)
   2. Check for active subscription → cancel first if relevant
   3. Issue refund via processor dashboard or API (`stripe refunds create`)
   4. Log in CRM: amount, reason, approver, refund ID
   5. Email customer with confirmation + expected timing
   6. Tag account: `refunded:<reason>` for cohort analysis
   7. Update revenue reporting (today's refund reduces today's MRR, not month-ago)

5. **Reason taxonomy** — fixed categories:

   | Reason code | Meaning |
   |---|---|
   | `bug` | product broke; we owe them |
   | `mistake` | duplicate, wrong plan, wrong account |
   | `not-fit` | tried, didn't work for use case |
   | `forgot-cancel` | subscription they didn't intend |
   | `goodwill` | edge case, retain relationship |
   | `fraud` | likely fraudulent purchase |
   | `chargeback` | already disputed |

   Track monthly: top reason drives roadmap (bug → fix; forgot-cancel → cancel-reminder email).

6. **Chargeback handling** — separate flow:
   - Auto-detect chargeback webhook (Stripe `charge.dispute.created`)
   - Decide: accept (refund + lose) or contest (submit evidence)
   - Evidence to submit: signup IP/UA, login history, usage logs, ToS acceptance timestamp, receipt, refund-policy URL + screenshot
   - Track win rate; under 30% = improve evidence; over 70% = consider stricter signup verification
   - Chargeback rate > 1% of transactions = processor review; > 1.5% = account at risk

7. **Fraud-pattern detection**:
   - Same card, multiple accounts → flag
   - Refund request within hours of purchase from new account → flag
   - Country mismatch (IP vs card BIN) → flag
   - Velocity: > 3 refunds requested in 30d from one customer → review
   - Don't auto-refund flagged; route to security

8. **Comms templates** — pre-baked:

   | Template | When |
   |---|---|
   | `refund-approved.md` | refund issued, expect 5-10 days |
   | `refund-denied-policy.md` | outside window; explain + offer alt |
   | `refund-partial.md` | prorated; show math |
   | `refund-bug-credit.md` | bug refund + credit + sorry |
   | `chargeback-contested.md` | internal note only |

   Tone: brief, apologetic when ours-fault, neutral when theirs.

9. **Metrics dashboard**:
   - Queue depth (target < 10)
   - First-response time p50 / p90
   - Decision time p50 / p90
   - Refund volume $ / week
   - Refund rate (refunds / charges)
   - Chargeback rate
   - Top reasons (top 3 monthly)
   - Time-to-cash-back-in-customer-account

10. **Anti-patterns**:
    - No published policy — every case a negotiation
    - "Email support" with no SLA — drives chargebacks
    - Refund without subscription cancel — refunds the past, charges the future, loops
    - One reason code: "customer service" — no learning
    - Manual approval on $5 refunds — cost > refund
    - Contesting every chargeback — lose anyway + irritate processor

## Output

Write `docs/ops/refund-runbook.md`:

```markdown
# Refund Queue Runbook
**Date:** <YYYY-MM-DD> | **Owner:** <support lead>

## Policy
- Monthly: full 14d, prorated after
- Annual: full 30d, prorated after
- One-time: 7d no-questions

## Triage
| Request | Path | SLA |
|---|---|---|
| < $50 in-policy | auto-approve | 1h |
| $50-$500 in-policy | tier-1 approve | 24h |
| > $500 / out of policy | tier-2 + finance | 72h |
| Fraud flag | security hold | n/a |
| Chargeback | dispute path | processor deadline |

## Execution checklist
- [ ] Verify identity
- [ ] Cancel active sub
- [ ] Issue refund (processor)
- [ ] Log CRM (amount, reason, approver, refund ID)
- [ ] Email customer (confirm + 5-10d timing)
- [ ] Tag account `refunded:<reason>`
- [ ] Update revenue report

## Reason codes
bug / mistake / not-fit / forgot-cancel / goodwill / fraud / chargeback

## Chargeback evidence pack
- Signup IP/UA
- Login history
- Usage logs
- ToS timestamp
- Receipt
- Refund policy URL + screenshot

## Metrics (weekly)
- Queue depth, first-response p50/p90, refund $, refund rate, chargeback rate, top 3 reasons

## Templates
- lib/email/refund-*.md
```

## Verification
- Public refund policy page live + linked from receipts.
- Triage table approved by finance + support.
- SLAs tracked on dashboard.
- Reason taxonomy enforced (no free-text only).
- Chargeback evidence pack pre-built.
- Top monthly reason fed into roadmap.
