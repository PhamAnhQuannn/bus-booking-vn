---
name: dispute-resolution-design
description: Refund SOP, chargeback flow, mediation runbook, supplier-side appeals, abuse-pattern detection for two-sided marketplaces. Outputs to `docs/ops/dispute-resolution-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "marketplace", "two-sided", "platform", "supply-side", "demand-side", "disputes", "refund SOP", "chargeback", "mediation", "appeals", "/dispute-resolution-design", or before serving paid transactions at scale.
output_size:
  XS: skip
  S: 1h
  M: 3h
  L: 4h
  XL: 6h
---

# /dispute-resolution-design — Dispute, Refund, Chargeback & Appeal SOP

## Why you'd care

Without a written dispute SOP, every refund request becomes a same-day judgment call by whoever's on support — and the inconsistency creates the dataset adversaries pattern-match to game refunds (and the legitimate user who got "no" while the next one got "yes" leaves a 1-star review with screenshots). A locked SOP plus chargeback workflow plus supplier appeal path is what keeps dispute cost-per-resolution under 5% of GMV and stops your Stripe risk score from drifting toward shutdown territory.

Invoke as `/dispute-resolution-design`. Operationalizes what the trust system promised: when something goes wrong, how do we resolve it cheaply, fairly, and within SLA. Pairs with `/two-sided-trust-design` (spec) — this skill is the runbook side. Anchored on Airbnb Resolution Center practices, eBay Money Back Guarantee + VeRO, DoorDash refund SOPs, and card-network chargeback rules (Visa VCR, Mastercard MCOP).

## Pre-flight
1. Read `docs/classify/<project>.md`. XS → SKIP.
2. Read `docs/design/trust-<project>.md` (badges, escrow window, escalation tiers).
3. Read `docs/design/api-contract.md` (dispute endpoints).
4. Read `docs/ops/payment-reconciliation.md` if exists.

## Inputs
- Payment processor (Stripe Connect, Adyen, PayPal Commerce — affects chargeback flow).
- Geographies served (chargeback rules vary; EU PSD2 strong customer authentication shifts liability).
- Per-transaction value distribution (long-tail small claims vs concentrated large claims).
- Support team size + tooling (Zendesk, Intercom, Front, custom case manager).
- Existing dispute volume baseline if any.

## Process
1. **Dispute taxonomy** — classify before designing flow:
   | Type | Example | Initial owner | Escrow status |
   |---|---|---|---|
   | Quality | "host's apartment was dirty" | mediation | held |
   | Non-delivery | "tasker never showed" | mediation, often instant refund | held |
   | Damage | "guest broke the TV" | mediation + insurance | held + claim |
   | Safety incident | injury, harassment | T&S + Legal | frozen indefinitely |
   | Fraud (buyer-side) | stolen card, friendly fraud | Risk + chargeback team | freeze + investigate |
   | Fraud (supplier-side) | fake listing, bait-and-switch | T&S + Legal | freeze + ban |
   | Counterfeit / IP | brand owner complaint | T&S + IP | takedown |
   | Pricing/billing | charged wrong amount | support | held |
   | Cancellation | one party cancels late | rules engine | partial refund |
2. **Refund SOP** — decision rubric per type:
   - **Auto-refund** thresholds: non-delivery < $X within 24h, system-error duplicate charges, app crash mid-purchase.
   - **Mediator authority**: refund up to $500 without escalation, freeze funds, request evidence, propose split.
   - **Arbitrator authority**: refund full + ban, lift ban on appeal, override mediator.
   - **Evidence schema**: photos, timestamps, chat log, GPS trail, receipt, communication metadata.
   - **SLA per tier**: Tier 1 self-resolve 3 days, Tier 2 mediated 5 days, Tier 3 arbitrated 14 days.
3. **Chargeback flow** (card network):
   - Detection: Stripe webhook `charge.dispute.created` (Visa VCR / Mastercard MCOP / Amex / Discover networks)
   - First-line response: representment with evidence (Stripe Dashboard, 14-day window typical; varies by reason code)
   - Reason codes (Visa): 10.4 fraud, 13.1 service not provided, 13.2 cancelled service, 13.5 misrepresentation
   - Win rate target: ≥50% representment success (industry median 30–40%)
   - Cost per chargeback: $15–25 processor fee + lost funds + reputation
   - 1% chargeback ratio threshold → Visa Dispute Monitoring Program; >2% → enrollment fees; persistent >2% → loss of processing
4. **Mediation runbook**:
   - Auto-pull evidence package (chat, GPS, ratings, photos)
   - Initial response in 24h ("We've received your dispute…")
   - Both parties given 48h to submit evidence
   - Mediator decision in 5 days
   - Decision communication: in-app + email + reasoning
   - Refund execution: Stripe refund / Connect transfer reversal
   - Post-mortem: tag root cause, feed into product/policy iteration
5. **Supplier-side appeals** (critical for fairness + PR):
   - Trigger: any de-platforming, badge demotion, dispute decision against supplier
   - Window: 14 days from action
   - Reviewer: must be different person from original decision; for de-platforming, senior agent or appeal panel
   - Evidence allowed: full case file + supplier rebuttal
   - SLA: 14 days for written decision with reasoning
   - Final-appeal option: external arbitrator (AAA, JAMS) per ToS; rare; costly
   - Reference: Airbnb arbitration backlash (2021) — pendulum has swung toward more transparent appeals
6. **Abuse-pattern detection** (ML / rules — protects platform from gaming):
   - Buyer-side: serial complainer (>3 disputes in 90d), stolen-card pattern, friendly fraud (high chargeback velocity)
   - Supplier-side: cancellation chains, fake listings, ID/photo recycling, review ring-buying
   - Cross-side: collusion (same device, same payment method on both sides — laundering)
   - Detection signals: device fingerprint, IP reputation (Stripe Radar, Sift, Sardine), graph analysis, NLP on chat
   - Action thresholds: friction (manual review) → restrict (no new listings) → suspend → ban
   - False-positive review path: appeal in 7 days, restored if clean
7. **Insurance integration** (in-home, vehicle, real-estate marketplaces):
   - Airbnb Host Protection ($1M); Turo physical-damage policies; TaskRabbit Happiness Pledge ($1M)
   - Vendors: Vouch, Vouch for Insurance, Slice Labs, embedded carriers (Cover Genius)
   - Trigger: damage dispute beyond mediator authority
   - Coverage carveouts: pre-existing damage, intentional acts, war/pandemic, sub-let violations
   - SLA: 30 days for insurance decision
8. **KPIs to dashboard**:
   - Dispute rate (% transactions): aim <1.5%
   - Median resolution time: aim <7 days
   - % auto-resolved: aim ≥30%
   - Chargeback rate: aim <0.5%
   - Chargeback representment win rate: aim ≥50%
   - Repeat-disputer rate: aim <5%
   - Appeal overturn rate: track; if very high → original decisions are bad; if zero → appeals are theater
   - Support cost per dispute: aim <$15 (mediation), <$80 (arbitration)
9. **Communication templates**:
   - Acknowledgment: "We received your dispute"
   - Evidence request: "Please share these specific items"
   - Decision: "Here's our decision and why"
   - Refund executed: "Refund of $X sent; expect 5–7 business days"
   - Appeal denial: "Your appeal was reviewed by a different agent. Decision stands. Reasoning: ..."
10. **Anti-patterns**:
    - Auto-side with buyer always (suppliers churn — Etsy historical issue)
    - Manual every case (collapses; DoorDash early support meltdown)
    - No supplier appeal (regulatory + PR risk; Airbnb arbitration controversy)
    - Hiding decision reasoning (looks arbitrary, generates lawyer letters)
    - Mediator refund authority too low (everything escalates)
    - Treating chargeback as same as dispute (different networks, different rules)
    - Banning without warning ladder (PR + lawsuit risk)

## Output
Write `docs/ops/dispute-resolution-<project>.md`:

```markdown
# Dispute Resolution Design — <project>
**Date:** 2026-05-13

## Dispute taxonomy (with first-touch SLA)
| Type | Channel | First-touch SLA | Auto-refund eligible? | Owner |
|---|---|---|:--:|---|
| Quality | in-app dispute | 24h | no | mediator |
| Non-delivery (no-show <24h) | in-app | 4h | YES if proof of no-show | rules engine |
| Damage | in-app + insurance form | 24h | no | mediator + insurance |
| Safety incident | priority intake (911 if active) | 1h | n/a | Trust & Safety |
| Fraud (card) | Stripe webhook | auto-acknowledge instant | no | Risk |
| Fraud (supplier) | T&S report queue | 24h | no | T&S |
| Counterfeit | brand-complaint inbox | 48h | no | T&S + IP |
| Pricing/billing | support form | 24h | YES if obvious duplicate | support |
| Cancellation | automated by rules | instant | per cancellation policy | rules engine |

## Refund authority matrix
| Role | Authority | Trigger to escalate |
|---|---|---|
| Rules engine | up to $50 auto | any disputed >$50 |
| Tier 1 support | up to $100 | quality complaint, customer ask |
| Mediator | up to $500 | repeat dispute, >$500, safety, ban request |
| Arbitrator | full + ban authority | de-platform, lawsuit threat, regulator notice |
| Risk team | freeze + ban for fraud | confirmed fraud signals |
| Legal | full + structural action | subpoena, regulator, class-action signal |

## Mediation runbook (Tier 2)
1. Trigger: parties cannot self-resolve within 3 days OR auto-escalated.
2. Auto-pull evidence package within 1h: chat history, GPS, ratings, photos, payment trail.
3. Send acknowledgment to both parties (template ACK-01) in 4h.
4. Request evidence from both, 48h response window (template EVD-01).
5. Mediator review in case-manager UI within 24h of evidence close.
6. Decision in 5 days from open; rationale written, archived.
7. Refund or transfer reversal executed via Stripe; confirm via webhook.
8. Communication to both parties (template DEC-01) including appeal path.
9. Tag root cause (taxonomy + secondary tag); export weekly into product backlog.

## Chargeback flow (card-network)
| Step | Action | SLA | Tool |
|---|---|---|---|
| 1. Detect | Stripe webhook `charge.dispute.created` | instant | webhook handler |
| 2. Triage | classify reason code | 1h | dispute dashboard |
| 3. Decide representment | accept loss vs fight | 24h | risk team rubric |
| 4. Gather evidence | proof of service, comms, GPS, ID | 48h | Stripe evidence form |
| 5. Submit representment | upload to Stripe | within 7 days of notice | Stripe Dashboard |
| 6. Network decision | wait | 30–75 days | n/a |
| 7. Post-decision | update CRM, ban repeat-offender buyer | 24h after notice | case manager |

- Representment win-rate target: ≥50%
- Chargeback ratio target: <0.5%
- Visa Dispute Monitoring Program threshold: 1.0% (early warning)
- Stripe Radar rules tuned weekly

## Supplier-side appeal process
| Step | Owner | SLA | Outcome |
|---|---|---|---|
| 1. Appeal submitted in-app | supplier | within 14d of action | case opened |
| 2. Reviewer assignment (different agent) | appeals coordinator | 24h | case routed |
| 3. Evidence review (case file + rebuttal) | senior agent | 7 days | preliminary view |
| 4. Decision + written reasoning | senior agent | 14 days total | upheld / partially / overturned |
| 5. Refund or restoration | rules engine | 24h after decision | executed |
| 6. Final external arbitration option | per ToS (AAA/JAMS) | per arbitrator | binding |

## Abuse-pattern detection
| Signal | Trigger | Action |
|---|---|---|
| Buyer with >3 disputes in 90d | velocity rule | manual review on next dispute |
| Buyer device fingerprint matches known fraud ring | Sift score >90 | freeze, manual review |
| Supplier cancellation chain (≥5 in 30d) | velocity rule | suspend listings, T&S review |
| Supplier ID/photo matches existing banned account | image hash | reject onboarding |
| Cross-side same-device pattern | graph rule | flag for laundering investigation |
| Review-ring pattern | graph clustering | quarantine reviews, audit |
| NLP "let's go off-platform" in chat | model >0.85 | warning to user, log to T&S |

## Comparator playbook
| Co. | Buyer-side protection | Supplier appeal | Insurance | Chargeback handling |
|---|---|---|---|---|
| Airbnb | Resolution Center + Refund Policy | yes, post-2021 reform | AirCover ($3M) | strong representment team |
| Uber | refund within minutes for issues | driver pulse + arbitration | $1M liability | high-volume team |
| DoorDash | Top Dasher protection, refund SLA <10min | yes, post-class-action | $1M liability | improving |
| eBay | Money Back Guarantee 30-day | yes, Seller Protection | n/a | networked with payment partners |
| Etsy | Purchase Protection up to $250 | yes, Star Seller path | n/a | Etsy Payments handles |
| TaskRabbit | Happiness Pledge $1M | yes | $1M liability | small claims escalation |
| Fiverr | refund + dispute via Resolution Center | yes, Level penalties + appeal | n/a | small-ticket high-volume |
| OfferUp | local pickup = limited | limited (low-value) | n/a | low chargeback exposure |

## Communication templates (snippets)
- **ACK-01**: "We've received your dispute about <booking-id>. Both parties have 48h to share evidence. Decision in 5 days."
- **EVD-01**: "Please share: <list>. Reply by <deadline> — missing evidence may affect outcome."
- **DEC-01**: "We reviewed evidence from both sides. Decision: <outcome>. Reasoning: <2-3 sentences>. You may appeal within 14 days."
- **APP-DENY**: "Your appeal was reviewed by a different senior agent. Decision stands. Reasoning: <reason>. Final option: external arbitration per Section X of ToS."

## KPI dashboard
| KPI | Target | Alert if |
|---|--:|--:|
| Dispute rate (% txns) | <1.5% | >2.5% |
| Median resolution time | <7 days | >10 days |
| % auto-resolved | ≥30% | <15% |
| Chargeback rate | <0.5% | >1.0% |
| Representment win-rate | ≥50% | <30% |
| Repeat-disputer rate | <5% | >10% |
| Appeal overturn rate | 10–25% | <5% (theater) or >40% (bad orig decisions) |
| Support cost per mediated dispute | <$15 | >$30 |
| First-touch SLA met | ≥95% | <85% |

## Anti-patterns we will NOT do
- Always side with buyer (suppliers churn, Etsy lesson)
- Manual every case (DoorDash early scale meltdown)
- No supplier appeal path
- Hide decision reasoning
- Treat chargeback like a normal dispute (different rules, different SLAs)
- Ban without warning ladder
- Mediator authority too low (everything escalates needlessly)

## References
- Airbnb Resolution Center + AirCover policy docs (public-facing terms)
- eBay Money Back Guarantee + VeRO program docs
- DoorDash Trust & Safety policies (public)
- Visa Chargeback Management Guidelines (VCR)
- Mastercard Chargeback Guide (MCOP)
- Stripe Dispute Documentation (representment workflow)
- Sangeet Choudary — *Platform Scale*, governance chapter
- AAA / JAMS — consumer arbitration provider docs

## 90-day build plan
- Week 1–2: Dispute taxonomy + intake forms
- Week 3–4: Case-manager UI for mediators
- Week 5–6: Auto-evidence package builder
- Week 7–8: Chargeback webhook + representment workflow
- Week 9–10: Appeal process + reviewer queue
- Week 11–12: Abuse-pattern detection rules + Sift integration
```

## Verification
- Dispute taxonomy ≥7 types with SLA.
- Refund authority matrix per role.
- Mediation runbook step-by-step.
- Chargeback flow with network-specific rules.
- Supplier appeal process documented with different-reviewer rule.
- Abuse-pattern detection ≥5 rules.
- Comparator playbook ≥6 marketplaces.
- KPI dashboard with targets + alerts.
- Anti-pattern section present.
