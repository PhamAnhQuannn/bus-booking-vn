---
name: enterprise-buying-cycle-map
description: Multi-stakeholder enterprise deal map — economic buyer, champion, IT-sec, legal, procurement, end-user — with deal-stage cadence and legal-review timelines (MSA, DPA, BAA). Captures the 6-9 month enterprise cycle. Outputs to `docs/sales/buying-cycle-<account>.md`. Reads `/project-classify` to skip XS/S. Use when user says "enterprise deal", "complex sale", "stakeholder map", "MEDDIC", "buying committee", "deal map", "champion", "economic buyer", "/enterprise-buying-cycle-map", or any time the deal has ≥3 distinct roles touching it.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 3h
  XL: 4h
---

# /enterprise-buying-cycle-map — Enterprise Buying Cycle Stakeholder Map

## Why you'd care

Enterprise deals fail not because the product is wrong but because one of six stakeholder roles wasn't identified, wasn't influenced, or vetoed in week 14. A 6-9 month cycle has 4-8 decision points where a single "no" kills the deal; an explicit stakeholder map turns those from surprises into managed checkpoints.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS/S → SKIP (founder-led sales with ≤2 stakeholders doesn't need a map).
2. Confirm deal characteristics that warrant this skill:
   - ACV ≥$25K, OR
   - ≥3 distinct buyer roles touching the deal, OR
   - Legal redlines exchanged, OR
   - Security questionnaire issued
3. Identify primary AE/founder running the deal + which qualification framework you use (MEDDIC, MEDDPICC, BANT, CHAMP, SPICED).

## Inputs
- Account name, industry, employee count, est. revenue.
- Inbound or outbound? Source touch?
- Known contacts to date (names, titles, LinkedIn).
- Deal-stage today (discovery / demo / eval / proposal / negotiation / contract / closed).
- Competitor context (incumbent if any, evaluating which alternatives).

## Process

1. **Map the six classic roles** — every enterprise B2B deal has these six. Identify a person (or "unknown — gap") for each:

   | Role | What they care about | Who they typically are | Veto power? |
   |---|---|---|---|
   | **Economic Buyer (EB)** | ROI, budget impact, strategic fit, signs the PO | VP/SVP/C-level | YES — final yes |
   | **Champion** | Career win, internal political capital, problem they own | Director / Sr Manager in target function | NO — but blocks if they walk |
   | **End-User(s)** | Daily workflow, learning curve, day-1 productivity | IC team or team lead | INFLUENCE — usability/adoption signal |
   | **IT / Security / InfoSec** | Risk, compliance, integration with stack, SSO/SCIM | CISO / IT Director / Security Architect | YES — security veto |
   | **Legal** | MSA terms, liability, data, IP, indemnification | GC, contracts manager | YES — contract veto |
   | **Procurement / Vendor Mgmt** | Price benchmarking, vendor consolidation, payment terms, vendor onboarding | Procurement manager, sourcing analyst | YES — pricing/onboarding veto |

   Plus two situational roles:
   - **Coach** — insider who shares intel but doesn't have power. Useful, distinct from champion.
   - **Anti-champion / Blocker** — actively against the deal (incumbent vendor loyalist, "not invented here" engineer, threatened middle manager). Name them.

2. **Score each role** on three dimensions (1-5 each): access, influence, alignment. Multiply for a per-role priority score (max 125).
   - Access = how easily you can get on a call this week
   - Influence = how much weight their voice carries in the decision
   - Alignment = how positively they currently view your solution
   - Priority = Access × Influence × Alignment

   Highest priority + lowest alignment = where to spend next week's energy.

3. **Apply MEDDPICC** (extension of MEDDIC) — for each deal:
   - **M**etrics: quantified pain ("we lose $400K/year to manual reconciliation")
   - **E**conomic Buyer: identified + met?
   - **D**ecision Criteria: 5-12 ranked criteria written down by buyer or you
   - **D**ecision Process: who signs off, in what order, by when
   - **P**aper Process: procurement steps, time-from-verbal-yes to PO
   - **I**dentified Pain: champion's verbatim pain language
   - **C**hampion: identified + active + has internal political capital
   - **C**ompetition: incumbent + alternatives + status quo

   Each letter scored 0/1/2 (unknown / known / validated). MEDDPICC score below 12/16 = deal will slip.

4. **Plot deal stages with stakeholder activation per stage** — typical 6-9 month enterprise cycle:

   | Stage | Weeks | Primary stakeholder | Secondary | Artifact produced |
   |---|---|---|---|---|
   | Discovery | 1-3 | Champion | End-user | Discovery call notes, problem statement |
   | Solution validation | 3-6 | Champion + End-user | EB intro | Demo, technical fit doc |
   | Economic case | 6-10 | EB | Champion | Business case, ROI model |
   | Technical eval / POC | 8-14 | IT/Sec, End-user | Champion | POC success criteria + outcome |
   | Security review | 10-16 | IT/Sec | Legal | `/vendor-security-questionnaire` response |
   | Pricing / proposal | 14-18 | EB, Procurement | Champion | Proposal, pricing approval |
   | Legal redlines | 16-22 | Legal | Procurement | MSA, DPA redlines |
   | Procurement / PO | 20-26 | Procurement | EB | Vendor onboarding forms, PO |
   | Signed / closed-won | 24-36 | EB signature | All | Counter-signed MSA + PO |

   Healthcare / government / financial services skew to the long end (28-52 weeks). Mid-market commercial can compress to 12-20 weeks.

5. **Legal-review timeline + paper set** — three core docs almost always, plus situational addenda:

   | Doc | Who drives | Typical turnaround | Common stuck points |
   |---|---|---|---|
   | **MSA** (Master Services Agreement) | Vendor first draft preferred; buyer redlines | 3-8 weeks | liability cap, indemnification, IP ownership, termination for convenience, source-code escrow |
   | **Order Form / SOW** | Vendor | 1-2 weeks | scope, term, auto-renewal language, price-increase cap |
   | **DPA** (Data Processing Addendum) | Vendor template under GDPR Art. 28 | 2-4 weeks | sub-processor list, SCCs Module 2, breach notification SLA, audit rights |
   | **BAA** (Business Associate Agreement) | Required for HIPAA-covered data | 2-4 weeks | breach SLA (60d HHS), satisfactory assurances clause, return/destroy on termination |
   | **SCCs** (Standard Contractual Clauses) | EU data exporter | rolled into DPA | TIA (transfer impact assessment), supplementary measures |
   | **NDA** | Mutual; often first artifact | 1-3 days | residuals clause, term length, governing law |
   | **Security Exhibit** | Vendor; sometimes annex to MSA | 1-2 weeks | uptime SLA, credit schedule, audit rights, breach notification, encryption mandates |
   | **Insurance certs** | Vendor produces Acord 25 | 1 week | minimum limits ($5M cyber, $5M E&O, $2M GL) |

   Total legal-review wall time for an enterprise deal: 6-12 weeks if both sides healthy, 12-20 weeks if redlines escalate or in-house counsel is slammed.

6. **Buying-committee size scaling** — Gartner's research: average B2B buying committee is 6-10 people; enterprise tech deals trend 11-20. Multi-thread:
   - 1 stakeholder mapped + 1 contact = founder-led-sales territory; not really enterprise yet
   - 3 stakeholders mapped + 2 contacts each = healthy mid-market deal
   - 6 stakeholders mapped + 2-3 contacts each = healthy enterprise deal
   - 10+ stakeholders mapped, only 1 contact = single-thread risk; deal will die if your contact leaves

   **Rule of two**: every critical role (EB, Champion, IT/Sec, Legal) should have ≥2 named contacts. Single-thread = at-risk flag.

7. **Champion-building moves** — your champion is the deal's load-bearing wall. Specific moves:
   - **Pain articulation**: get them to say back to you, in their own words, what problem you solve. Record verbatim.
   - **Business case co-authoring**: send a Google Doc ROI template; let them fill the numbers. They will defend numbers they wrote.
   - **Internal selling kit**: provide a 1-pager + 5-slide deck the champion can forward without your touch.
   - **Reference call**: matched-industry reference customer, 30 min, with EB on the line.
   - **Pre-mortem**: ask champion, "If this fails to get budget, what's the most likely reason?" Mitigate the named reason.
   - **Career win framing**: name the win for the champion ("you'll be the person who shipped X").

   Lose the champion (departure, reorg, lateral move) = deal restarts. Build at least one bench champion early.

8. **EB access patterns** — economic buyers rarely take cold meetings; they get pulled in. Three legitimate access paths:
   - **Champion-driven**: champion books the meeting and joins it. Highest success.
   - **Exec-to-exec**: your founder/CEO emails their EB peer with a specific business outcome and a specific ask (30-min meeting). 5-10% reply rate is normal.
   - **Mutual investor / board / advisor intro**: warmest possible path. Use sparingly.

   First EB meeting agenda: 5 min framing problem, 10 min business case + metrics, 10 min Q&A, 5 min next step + named follow-up. Never demo the product to an EB unless they ask.

9. **Procurement playbook** — procurement enters late (week 14-20) and can re-open everything. Pre-empt:
   - Send your **W-9** (US) + **vendor onboarding form** request in week 12.
   - Ask: "What is your vendor onboarding checklist?" — you want the list of forms (banking info, insurance certs, COI, MSAs, OFAC screen, modern-slavery statement, conflict-minerals attestation).
   - **Net terms**: standard enterprise = Net 30 or Net 45; large enterprise = Net 60 or Net 90. Negotiate this early; once procurement sets Net 90 it sticks.
   - **Price benchmarking**: procurement WILL benchmark against published list prices and against incumbent. Have a defensible discount story.
   - **Vendor consolidation**: procurement loves "one fewer vendor"; if buyer already has your category's incumbent, your pricing must overcome migration cost.

10. **Risk register per deal** — six standard enterprise-deal risks to track weekly:

    | Risk | Signal | Mitigation |
    |---|---|---|
    | Champion departure | Reorg news, LinkedIn update | Build bench champion in week 6 |
    | Budget reallocation | Fiscal year change, exec turnover | Confirm budget approval before stage 5 |
    | Security veto | Questionnaire returned with 20+ blockers | Engage IT/Sec by stage 2 |
    | Legal stall | >3 redline rounds without convergence | Escalate to GC-to-GC call |
    | Incumbent fights back | Buyer mentions "checking what current vendor offers" | Pre-empt with switching-cost framing |
    | Procurement squeeze | Surprise demand for 30% discount in stage 7 | Hold pricing line in MSA exhibit, not order form |

11. **Deal-stage cadence** — minimum touchpoints per role per month:
    - Champion: weekly call or async (Slack/email)
    - EB: monthly, with business-impact update
    - IT/Sec: as gated (questionnaire, POC review)
    - End-user: every 2-3 weeks during eval; monthly otherwise
    - Legal: as redlines move; never "ping for status" weekly (they hate it)
    - Procurement: response within 24h, no proactive nagging

12. **Close + handoff to ProServ/CS** — when MSA + Order Form counter-signed:
    - 5-business-day kickoff call window
    - ProServ/CS on the kickoff (warm handoff, not cold)
    - Champion stays on for first 90 days
    - EB gets a quarterly business review (QBR) on the calendar before signing — sets expansion expectation early
    - Document everything in the account record: stakeholders, pain language, success criteria, contract terms, renewal date

## Output

Write `docs/sales/buying-cycle-<account>.md`:

```markdown
# Enterprise Buying Cycle Map — <Account>
**Industry:** | **Employee count:** | **Est. revenue:**
**ACV target:** $ | **Deal stage:** <discovery/eval/proposal/legal/procurement/close>
**Started:** <YYYY-MM-DD> | **Target close:** <YYYY-MM-DD>
**Owner (AE/founder):**

## Stakeholder map
| Role | Name | Title | Contacted? | Access | Influence | Alignment | Priority |
|---|---|---|---|---:|---:|---:|---:|
| Economic Buyer | | | | | | | |
| Champion | | | | | | | |
| End-user(s) | | | | | | | |
| IT/Security | | | | | | | |
| Legal | | | | | | | |
| Procurement | | | | | | | |
| Coach (optional) | | | | | | | |
| Blocker (if any) | | | | | | | |

## MEDDPICC score (0/1/2 per letter, /16 total)
- M (Metrics):
- E (Econ Buyer):
- D (Decision Criteria):
- D (Decision Process):
- P (Paper Process):
- I (Pain):
- C (Champion):
- C (Competition):
- **Total: __/16** (<12 = deal will slip)

## Deal stages + projected dates
| Stage | Target week | Status | Stakeholder lead | Artifact |
|---|---|---|---|---|
| Discovery | | | Champion | |
| Solution validation | | | Champion + End-user | |
| Economic case | | | EB | |
| Technical eval / POC | | | IT/Sec | |
| Security review | | | IT/Sec | |
| Pricing / proposal | | | EB + Procurement | |
| Legal redlines | | | Legal | |
| Procurement / PO | | | Procurement | |
| Signed | | | EB | |

## Paper set + status
| Doc | Status | Owner | Stuck on |
|---|---|---|---|
| NDA | | | |
| MSA | | | |
| Order Form / SOW | | | |
| DPA | | | |
| BAA (if PHI) | | | |
| SCCs (if EU) | | | |
| Security exhibit | | | |
| Insurance certs | | | |

## Champion file
- Verbatim pain quote:
- Career win framing:
- Reference customer matched + scheduled?
- Bench champion identified?

## EB file
- First meeting date:
- Business case authored: Y/N
- ROI numbers (their numbers):
- Sponsor relationship to champion:

## Procurement file
- Vendor onboarding checklist received?
- Net terms target: <Net 30/45/60/90>
- Discount tier landed:

## Risk register (weekly review)
| Risk | Signal | Status | Mitigation owner |
|---|---|---|---|
| Champion departure | | | |
| Budget reallocation | | | |
| Security veto | | | |
| Legal stall | | | |
| Incumbent fightback | | | |
| Procurement squeeze | | | |

## Single-thread audit
- Roles with 1 contact (at-risk): <list>
- Action: build 2nd contact by <date>

## Cadence
- Champion: weekly
- EB: monthly
- IT/Sec: gated
- End-user: bi-weekly
- Legal: as redlines move
- Procurement: 24h response

## Post-close handoff
- [ ] Kickoff scheduled within 5 BD
- [ ] ProServ/CS on kickoff
- [ ] QBR scheduled
- [ ] Account record updated with stakeholders + success criteria
```

## Verification
- All 6 standard roles named or explicitly marked unknown-gap.
- MEDDPICC scored; if <12, plan to close gaps before advancing stage.
- Every critical role (EB, Champion, IT/Sec, Legal) has ≥2 contacts or a flagged single-thread risk.
- Paper-set timeline starts ≥6 weeks before target close.
- Champion has verbatim pain quote captured + career win framed.
- Risk register reviewed weekly for at least the first 12 weeks.
