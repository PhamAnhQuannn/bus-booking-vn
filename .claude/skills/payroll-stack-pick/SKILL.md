---
name: payroll-stack-pick
description: Pre-launch payroll stack pick — Gusto vs Rippling vs Justworks vs Deel vs ADP, US-vs-global, contractor vs W-2, multi-state nexus, benefits broker, payroll tax cadence. Outputs to `docs/inception/payroll-stack-pick-<project>.md`. Use when user says "payroll", "Gusto", "Rippling", "Deel", "PEO", "EOR", "W-2", "/payroll-stack-pick", or before first employee.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /payroll-stack-pick — Payroll Stack Decided Once, Lived With For Years. Wrong Pick Costs 6 Months Of Migration Pain.

Payroll = highest-friction system to swap once live. Tax filings tied to provider, employee bank accounts mapped, benefits brokered, multi-state nexus registered. Pick deliberately before first hire.

## Why you'd care

The wrong payroll stack means manual W-2 corrections, missed multi-state nexus, surprise back-taxes, and a CFO spending Fridays in a spreadsheet. Pick the right one before the first hire, not the tenth.

## Pre-flight
Run before hire #1 (employee or international contractor). Pairs with `/contractor-vs-employee-decision`, `/first-hire-plan`, `/jurisdiction-pick`, `/equity-comp-philosophy`, `/insurance-policy-pick`, `/accounting-stack-pick`.

## Inputs
- Worker types planned year 1: W-2 employees / 1099 contractors / international contractors / international employees
- Headcount target year 1 + year 2
- States / countries of workers
- Benefits ambition: none / minimum / competitive / premium
- Founder bandwidth for HR ops
- Funding stage (PEO too expensive seed; affordable Series A+)

## Process
1. **Classify worker mix** — W-2 US / 1099 US / international contractor / international employee.
2. **Map jurisdictions** — states + countries with worker presence.
3. **Pick model** — direct payroll / PEO / EOR / contractor-only platform.
4. **Pick provider** — Gusto / Rippling / Justworks / Deel / ADP / Paychex / Patriot.
5. **Benefits strategy** — through provider / external broker / none year 1.
6. **State nexus registration** — register employer accounts per state with employees.
7. **Payroll tax cadence** — semi-weekly / monthly / quarterly per IRS rules.
8. **Integration plan** — to accounting stack (Gusto-QBO / Rippling-NetSuite / Deel-Xero / etc.).
9. **Onboarding flow** — I-9 / W-4 / direct deposit / state forms / benefits election.
10. **Document + lock** before first hire start date.

## Output
Write `docs/inception/payroll-stack-pick-<project>.md`:

```markdown
# Payroll Stack Pick (Pre-launch) — <project>
**Owner:** founder / Head of People / fractional CFO
**Date:** <YYYY-MM-DD>
**Entity:** <C-corp DE / LLC / LTD UK / etc.>
**Funding stage:** <pre-seed / seed / Series A>

## Why this exists pre-hire
- Payroll provider holds tax filings + employee bank routing — switching costs are real
- Misclassification of W-2 vs 1099 → IRS Form SS-8 audit + back-payroll-tax + penalties
- Multi-state nexus: each state with employee = register as employer + file quarterly
- International workers: contractor-via-Deel is fine, but international employees need EOR or local entity
- PEO vs direct payroll has structural tax + benefits implications

## Worker classification (year 1 plan)

| Type | Count Y1 | Count Y2 | Locations |
|------|----------|----------|-----------|
| W-2 employees (US) | <N> | <N> | <states> |
| 1099 contractors (US) | <N> | <N> | <states> |
| International contractors | <N> | <N> | <countries> |
| International employees | <N> | <N> | <countries — via EOR or local entity> |

## Model pick

| Model | What | Pros | Cons | Pick if |
|-------|------|------|------|---------|
| **Direct payroll (Gusto / Rippling / ADP / Patriot)** | You're employer of record; provider runs payroll + tax | Cheapest; full control | You handle benefits broker; nexus reg per state | <5 states, seed/Series A |
| **PEO (Justworks / TriNet / Insperity)** | Co-employment; PEO is admin employer; you direct work | Big-co benefits at small-co price; admin offload | Expensive ($100-200/EE/mo); locked benefits | Need premium benefits + admin offload pre-Series A |
| **EOR (Deel / Remote / Velocity Global)** | Provider is legal employer in country X; you direct work | Hire in countries without entity | Expensive ($600/EE/mo); not for US-only | International employees without local entity |
| **Contractor platform (Deel / Remote / Oyster)** | Compliant contractor pay + agreements globally | Cheap ($49/contractor/mo); no entity needed in country | Contractors only, not employees | International contractors year 1 |

**Our pick:** <pick + reason>

## Provider decision table (US W-2)

| Provider | Price/EE/mo | Multi-state | Benefits | 401k | International | Best for |
|----------|------------|-------------|----------|------|---------------|----------|
| **Gusto** | $40 base + $6/EE (Simple) to $12/EE (Plus) | ✅ all 50 | ✅ broker built-in (Guideline / Vestwell) | ✅ Guideline integration | Contractors only (no employees) | **Default seed/Series A US.** Polished UX. |
| **Rippling** | $8/EE base + $X modules | ✅ all 50 | ✅ broker + Rippling Insurance | ✅ Guideline / Human Interest | ✅ EOR add-on | Mid-stage SaaS scaling fast |
| **Justworks (PEO)** | $59-99/EE/mo | ✅ all 50 via PEO | ✅ premium PEO plans (Aetna / Kaiser) | ✅ Slavic401k | Contractor only | Premium benefits pre-Series A |
| **ADP (Run / Workforce Now)** | $40-100/EE/mo | ✅ all 50 | ✅ broker | ✅ ADP 401k | ✅ ADP Streamline | Established cos; gov contracts |
| **Paychex** | $40-100/EE/mo | ✅ all 50 | ✅ | ✅ | Limited | Traditional industries |
| **Patriot Software** | $17 base + $4/EE | ✅ all 50 | ❌ (DIY broker) | ❌ | ❌ | Solo / smallest founders, DIY mindset |
| **Deel** | $19/contractor (1099) + $599/EOR/mo | US payroll via Deel US Payroll | ✅ EOR includes | ✅ via Deel 401k | ✅ 150+ countries | International-first cos |

## Detailed comparison (top 3 for SaaS seed/Series A)

### Gusto — recommended default
- **Why:** Cleanest UX, full multi-state, benefits broker baked in, Guideline 401k integration, contractor + employee + R&D credit help
- **Watch:** International limited to contractors; "Simple" plan locks features behind upsell to Plus
- **Pricing:** $40/mo + $6/EE (Simple) / +$12/EE (Plus) / +$20/EE (Premium with HR support)
- **Multi-state:** all 50, registers employer ID for you in most states (some require self-reg)
- **Tax filing:** all federal + state + local; W-2 + 1099 by Jan 31
- **Benefits:** health via Gusto-broker; dental, vision, life, FSA, HSA, commuter
- **401k:** Guideline native integration ($39/mo + $8/EE); Vestwell also supported
- **Integrations:** QBO, Xero, NetSuite, Sage Intacct, Carta, Slack
- **R&D credit:** built-in claim ($500/mo for 5 yr offset to FICA)
- **Best for:** Default seed/Series A US-only

### Rippling — modular scale-up
- **Why:** Modular (Payroll / HR / IT / Spend), great for ops-heavy scale-ups
- **Watch:** Quote-based (expensive at scale); UI feature-bloated; modules nickel-and-dime
- **Pricing:** $8/EE base + add-ons; payroll module ~$8/EE; HR ~$8/EE; IT ~$8/EE
- **Multi-state:** all 50, faster onboarding than Gusto multi-state
- **Tax filing:** all federal + state + local
- **Benefits:** Rippling-broker plans; flexible benefits admin
- **401k:** Guideline / Human Interest / Vestwell integrations
- **EOR add-on:** Rippling EOR for international employees (newer, fewer countries than Deel)
- **R&D credit:** supported
- **Best for:** Scaling Series A+ with HR/IT/Spend bundling appeal

### Deel — international-first
- **Why:** Best-in-class contractor + EOR globally; weak for US-only employees
- **Watch:** US Payroll product newer than Gusto/Rippling; pricier for US-only than alternatives
- **Pricing:** $49/contractor/mo flat; $599/mo per EOR employee; US Payroll ~$19/EE
- **Coverage:** 150+ countries contractors; 100+ countries EOR
- **Compliance:** localized contracts + IP assignment per country
- **Equity:** equity grants for EOR employees (with caveats)
- **Best for:** Remote-first / international-first; founders in country X hiring globally

## Benefits strategy

| Stage | Posture |
|-------|---------|
| **Pre-seed / first hire** | Health stipend ($300-500/mo via Take Command / Thatch) OR ICHRA — no formal benefits |
| **Seed (3-10 EE)** | Group health via Gusto-broker; basic dental + vision; no 401k |
| **Series A (10-30 EE)** | Group health (mid-tier plan); dental; vision; 401k with 4% match; basic life; STD |
| **Series B (30+ EE)** | Multiple plan tiers; 401k with match + auto-enroll; LTD; ESPP; mental health (Modern Health / Lyra); commuter |

**Our pick:** <stage-appropriate benefits>
**Broker:** through provider (Gusto / Rippling / Justworks) OR external (Mployer / Aetna direct / Newfront / Sequoia Benefits)

## State nexus registration
Each state with W-2 employee → register for:
- State income tax withholding account
- State unemployment insurance (SUI) account
- Workers comp (state fund or carrier)
- New hire reporting

Provider handles most registrations; some states (e.g. CA, NY) require founder action.

**Year 1 states:** <list>
**Workers comp carrier:** <Hartford / NEXT / Coterie / through Gusto-broker / state fund>

## Federal compliance baseline
- EIN obtained (for entity)
- Form SS-4 filed (EIN application)
- 940 (FUTA) annual
- 941 (quarterly federal payroll tax)
- 944 (annual if small employer)
- W-2 + W-3 by Jan 31
- 1099-NEC + 1096 by Jan 31 (for contractors paid $600+)
- I-9 within 3 days of hire (E-Verify if federal contractor or required state)
- W-4 + state withholding form on hire
- New hire reporting within 20 days

Provider auto-files everything except I-9 retention (you keep).

## Pay cadence
- **Bi-weekly (every 2 weeks, 26 pay periods)** — default US tech
- **Semi-monthly (15th + last day, 24 periods)** — common for salaried
- **Monthly** — common international
- **Weekly** — hourly / retail / hospitality (not us)

**Our pick:** <bi-weekly default>
**Pay day:** Friday following pay period end (run payroll 2-3 business days prior)

## Payroll tax deposit cadence (IRS-determined)
- New employer: monthly deposit schedule first year
- After year 1, IRS reassigns: semi-weekly OR monthly based on prior-year liability
- Provider handles all deposits; founder confirms via 941

## Integration plan
- [ ] Payroll provider → accounting stack (Gusto-QBO / Rippling-NetSuite / Deel-Xero)
- [ ] 401k provider → payroll provider (Guideline-Gusto native)
- [ ] Health benefits → payroll provider for deductions
- [ ] HRIS (if separate from payroll) → payroll for headcount sync
- [ ] Equity (Carta / Pulley) → payroll for ISO/NSO/RSU tax withholding

## Onboarding flow per new hire
1. Offer accepted → trigger HRIS / payroll onboarding link
2. Employee completes:
   - I-9 (Section 1) + Section 2 in person or via authorized rep
   - W-4 + state withholding form
   - Direct deposit form
   - Benefits election (within enrollment window)
   - 401k enrollment (if eligible)
   - Equity grant acceptance (separate flow via Carta / Pulley)
3. Manager / founder completes:
   - I-9 Section 2 (verify docs)
   - Equipment provisioning
   - Access provisioning (SSO / tools)
   - First-week schedule
4. Year 1 milestones tracked: 90-day check / first review

## Cost projection year 1

| Item | Monthly | Annual |
|------|---------|--------|
| Payroll provider (3 EE × $X) | $58-100 | $700-1200 |
| 401k provider (3 EE × $X) | $63-90 | $760-1080 |
| Workers comp | $40-150 | $480-1800 |
| Health benefits broker (or stipend) | $900-1500 (stipend) | $10800-18000 |
| State unemployment (SUI) | varies (~$200-500 per EE/yr) | $600-1500 |
| **Year 1 total (3 EE)** | **$1.1k-1.9k** | **$13k-23k** |

## Anti-patterns
- ❌ 1099 a worker who's actually W-2 (control + tools + schedule = employee) → IRS audit + back tax
- ❌ Hire in state X without registering as employer there → state penalty + back tax
- ❌ Skip workers comp → state fine + uninsured liability if injury
- ❌ International employee on 1099 → permanent establishment risk + local labor law violation
- ❌ Pay-via-personal-Venmo → unreported wages, no tax withholding, IRS nightmare
- ❌ DIY payroll spreadsheet → guaranteed tax error year 1
- ❌ PEO at pre-seed when no benefits desired → $100/EE/mo wasted
- ❌ Switch providers mid-year → 2x W-2s, employee confusion, tax-filing mess
- ❌ Forget I-9 verification → $250-$2700 per violation
- ❌ Equity grants without proper tax withholding (NSO exercise / RSU vest) → employee owes IRS quarterly

## Pre-hire-#1 checklist
- [ ] Worker mix classified (W-2 / 1099 / international)
- [ ] Jurisdictions mapped
- [ ] Model picked (direct / PEO / EOR / contractor platform)
- [ ] Provider picked
- [ ] Benefits strategy stage-appropriate
- [ ] State nexus registered for hire-state(s)
- [ ] Workers comp in place
- [ ] Pay cadence set
- [ ] Integration to accounting stack live
- [ ] Onboarding flow documented
- [ ] I-9 / W-4 / direct-deposit collection process ready
- [ ] First payroll dry run with provider before hire date

## Anti-patterns flagged
- ❌ Misclassification (1099 vs W-2)
- ❌ Multi-state nexus unregistered
- ❌ Workers comp missing
- ❌ International employee on 1099
- ❌ No I-9 retention
- ❌ DIY payroll
- ❌ PEO premature

## Annual review
- Provider cost as % of payroll trending?
- Benefits competitiveness vs market
- Multi-state nexus list current?
- Provider features outgrown (need Rippling / ADP / Workday)?
- Switch trigger: founder spends >X hr/mo on payroll admin

## Next
- Insurance → `/insurance-policy-pick`
- D&O → `/d-and-o-insurance-pick`
- Hire planning → `/first-hire-plan`
- Equity → `/equity-comp-philosophy`
- Contractor vs employee → `/contractor-vs-employee-decision`
- Handbook → `/employee-handbook-skeleton`
```

## Verification
- Worker mix classified.
- Model picked with reason.
- Provider picked with cost.
- Benefits strategy stage-appropriate.
- State nexus + workers comp posture.
- Integration to accounting stack.
- Onboarding flow documented.
- Pre-hire-#1 checklist complete.
