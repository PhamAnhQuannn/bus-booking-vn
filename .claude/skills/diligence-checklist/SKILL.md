---
name: diligence-checklist
description: Diligence checklist — investor due-diligence question bank with answers + doc pointers. Outputs to `docs/inception/diligence-checklist-<project>.md`. Use when user says "diligence", "DD", "due diligence", "investor questions", "/diligence-checklist", or post-term-sheet.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /diligence-checklist — Diligence Is A Test. Pre-Study The Answer Key.

## Why you'd care

The diligence question bank for a Series A is roughly 120 items spanning finance, legal, IP, customer, security, and HR — and 80% of the answers are knowable in advance. Founders who improvise the answers in real-time slip the close from 2 weeks to 6, and every additional week is one more chance for the market, the partnership, or the founder's own narrative to drift in a way that triggers a re-trade. Pre-studying with the answer key in hand collapses the diligence calendar and signals operational competence at the same time.

Post-term-sheet diligence = 100+ questions across 2-4 weeks. Pre-answered = sign in 2 weeks. Improvised = slip to 6 weeks.

## Pre-flight
Run after `/data-room-bootstrap`. Pairs with `/reference-call-prep`, `/term-sheet-literacy`.

## Inputs
- Term sheet signed or pending.
- Built data room.
- Cap table + financials current.
- Customer list + traction data.

## Process
1. **Map question to data-room folder** — every Q points to a doc.
2. **Pre-write hard answers** — risk, churn, founder dynamic, competition.
3. **Stress-test with mock DD** — advisor or ex-VC runs you through it.
4. **Track ask + response** — log who asked what, when answered.
5. **Tier questions:** must-answer-perfectly / standard / ignore.
6. **Honest disclosures** — bad news up front beats found-later.

## Output
Write `docs/inception/diligence-checklist-<project>.md`:

```markdown
# Diligence Checklist — <project>
**Lead investor:** <firm>
**Closing target:** <date>
**Data room:** <link>

## Question categories
1. Corporate
2. Cap table + securities
3. Financials
4. Customer + revenue
5. Product + tech
6. Team
7. IP
8. Legal + compliance
9. Market + competition
10. Founder + character

## Master Q&A bank (pre-write all)

### 1. Corporate
- [ ] Where incorporated? Why? → DE C-Corp / Cert of Inc in `01-corporate/`
- [ ] Board composition? Voting? → board minutes
- [ ] All stockholder consents on file? → `01-corporate/stockholder-consents/`
- [ ] Any litigation history? → litigation disclosure
- [ ] State qualifications? → `01-corporate/state-quals/`

### 2. Cap table
- [ ] Fully-diluted cap table? → Carta export
- [ ] All SAFEs pre or post-money? → `02-cap-table/SAFE-agreements/`
- [ ] Option pool size + remaining? → cap table
- [ ] 83(b) elections filed within 30 days? → `01-corporate/83b-elections/`
- [ ] Vesting cliffs hit / unhit? → grant table
- [ ] 409A age? → `02-cap-table/409A-valuation-latest.pdf`

### 3. Financials
- [ ] Monthly P&L last 12 mo? → `03-financials/`
- [ ] Burn rate trend? → cash flow statement
- [ ] Runway months at current burn? → runway calc
- [ ] Top 3 cost lines? → P&L breakdown
- [ ] Revenue recognition policy? → accounting memo
- [ ] AR aging? → balance sheet
- [ ] Bank balances reconciled? → bank statements
- [ ] Tax returns filed? → `03-financials/tax-returns/`

### 4. Customer + revenue
- [ ] ARR / MRR current? → KPI dashboard
- [ ] Top 10 customers + % of ARR? → customer concentration table
- [ ] Logo + dollar churn last 12 mo? → cohort table
- [ ] Net dollar retention? → cohort
- [ ] CAC payback? → unit econ
- [ ] LTV / CAC? → unit econ
- [ ] Sales cycle length? → CRM data
- [ ] Reference customers willing to talk? → 5 ready

### 5. Product + tech
- [ ] Architecture diagram? → `04-product/architecture-diagram.pdf`
- [ ] Tech stack? → `04-product/tech-stack.md`
- [ ] Open-source license audit? → `07-IP/open-source-license-audit.pdf`
- [ ] Security posture / SOC 2 status? → security overview
- [ ] Uptime last 90 days? → status page export
- [ ] Disaster recovery plan? → DR runbook
- [ ] Single points of failure? → architecture review

### 6. Team
- [ ] Org chart + headcount? → org chart
- [ ] All employment agreements signed? → `06-team/employment-agreements/`
- [ ] IP assignment from every contributor? → `07-IP/ip-assignment-master-list.xlsx`
- [ ] Key-person risk — what if founder leaves? → succession note
- [ ] Open reqs + hiring plan? → 18-mo hiring plan
- [ ] Comp benchmarks? → comp band table
- [ ] Any non-competes from prior employers? → founder disclosures

### 7. IP
- [ ] Trademark filed? → `07-IP/trademarks/`
- [ ] Patents filed / granted? → `07-IP/patents/`
- [ ] Domain portfolio? → domain spreadsheet
- [ ] OSS compliance audit clean? → audit report
- [ ] Prior-art conflicts? → IP search memo
- [ ] Any IP encumbrances from prior employers? → founder disclosure

### 8. Legal + compliance
- [ ] Top 10 customer contracts → `08-legal/customer-contracts/`
- [ ] Material vendor contracts (>$25k/yr) → `08-legal/vendor-contracts/`
- [ ] MSA / DPA templates → `08-legal/`
- [ ] GDPR / CCPA posture → privacy memo
- [ ] Insurance policies → E&O, D&O, cyber, GL
- [ ] Regulatory licenses (if any) → `08-legal/regulatory-licenses/`
- [ ] Pending litigation / threatened? → disclosure
- [ ] Compliance certifications (SOC 2, HIPAA, PCI)? → audit status

### 9. Market + competition
- [ ] Competitive matrix → `09-market/competitive-analysis.pdf`
- [ ] Win/loss rates vs top 3 competitors? → CRM analytics
- [ ] Why customers chose you? → win-reason analysis
- [ ] What would Loop/AfterShip have to do to kill us? → moat memo
- [ ] Market size — bottom-up? → TAM memo

### 10. Founder + character
- [ ] Reference list (5+)? → `06-team/references.md`
- [ ] Prior ventures / outcomes? → founder bio
- [ ] Why this problem, why now, why you? → founding story
- [ ] Any past disputes with co-founders / employers? → disclosure
- [ ] Personal credit / bankruptcy disclosures? → if asked
- [ ] Conflicts of interest? → disclosure

## Hard-question prep (rehearse out loud)
| Question | Honest answer | Spin (only if honest answer needs framing) |
|----------|--------------|--------------------------------------------|
| Why did <ex-founder> leave? | <factual reason> | <what it taught us> |
| Worst month of burn vs plan? | <delta + cause> | <how we adjusted> |
| Customer that churned + why? | <name, reason> | <pattern fix> |
| Worst NPS feedback verbatim? | <quote> | <change in roadmap> |
| Biggest risk to plan? | <real risk> | <mitigation> |
| Why won't Shopify build this? | <strategic answer> | — |

## Disclosure-up-front items
Anything investor will find = disclose first. Examples:
- Co-founder departure
- Customer concentration > 25% in one logo
- Pending lawsuit / threat
- Past failed venture
- Regulatory inquiry
- Pivot history

## Tracking
| Date asked | Investor | Question | Doc pointer | Answered | Date |
|-----------|----------|----------|-------------|---------|------|
| 2026-05-10 | <lead> | NRR last 12 mo | cohort.xlsx | yes | 2026-05-10 |
| 2026-05-11 | <lead counsel> | All 83(b) filed? | 83b-folder | yes | 2026-05-11 |

## Velocity benchmarks
- Standard Q answered < 24 hr = signals "they're ready"
- > 48 hr lag = signals "they're hiding"
- Stay ahead of the asks. Offer answers before asked.

## Pitfalls flagged
- [ ] Hard questions rehearsed
- [ ] Disclosure-up-front list reviewed
- [ ] Every category answered against data room
- [ ] Reference list ready
- [ ] Mock DD done with advisor
- [ ] Tracking sheet live

## Anti-patterns
- ❌ "Let me get back to you" on basics
- ❌ Hiding bad news (always found)
- ❌ Defensive tone on hard questions
- ❌ Stale financials in data room
- ❌ Customer reference not pre-warmed
- ❌ Missing IP assignments

## Next
- Reference call prep → `/reference-call-prep`
- Term sheet review → `/term-sheet-literacy`
- Investor updates → `/investor-update-cadence`
```

## Verification
- 10 categories pre-answered.
- Each Q mapped to data-room doc.
- Hard-question rehearsal table.
- Disclosure-up-front list.
- Mock DD scheduled.
- Tracking sheet live.
