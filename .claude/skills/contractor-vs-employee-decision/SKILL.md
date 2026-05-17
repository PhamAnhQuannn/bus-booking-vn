---
name: contractor-vs-employee-decision
description: Classify each worker as W-2 employee vs 1099 contractor vs IR35 inside/outside vs EU equivalent. IRS 20-factor + ABC test + IR35 SDS + EU permanent-establishment risk. Misclassification penalties run 6-7 figures. Outputs to `docs/inception/contractor-vs-employee-<project>.md`. Use when user says "1099 vs W-2", "contractor or employee", "IR35", "misclassification", "AB5", "/contractor-vs-employee-decision", or before signing first contract.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /contractor-vs-employee-decision — Wrong Classification Is A Six-Figure Mistake. Decide Before The Contract.

## Why you'd care

The "1099 to keep it simple" engineer in California is an AB5 reclassification waiting to happen, and the resulting back-taxes plus benefits plus penalties plus invalidated IP assignment turn into a Series A diligence killer or a federal criminal exposure in Germany. Documenting the right classification up front, per worker, with a written rationale is what makes the cap table survive contact with the IRS, DOL, and HMRC.

W-2 vs 1099 ≠ "what's cheaper". Misclassification = IRS / DOL / state-AG penalties + back-taxes + benefits + interest + lawyer fees + reputation. The cost of getting this wrong dwarfs any cash saved up front. Decide per-worker, document the reasoning, and re-test annually.

## Pre-flight
Run before signing any contractor agreement, before posting any 1099/W-2 hybrid role, before re-engaging a former employee as a contractor, before hiring across jurisdictions. Pairs with `/first-hire-plan`, `/jurisdiction-pick`, `/ip-assignment-agreement`, `/payroll-stack-pick`, `/equity-comp-philosophy`.

## Inputs
- Role description + scope of work.
- Duration (project / ongoing / open-ended).
- Worker location(s) (state-specific + country-specific tests).
- Will worker have set hours / set tools / set workplace?
- Will worker take direction from company employees daily?
- Worker has other clients? Established business?
- Project-based deliverable or time-and-materials?
- Existing team — is anyone doing similar work as W-2?

## Process
1. **Apply jurisdiction tests** — IRS 20-factor (US fed), ABC test (CA/NJ/MA/IL state), IR35 SDS (UK), EU permanent establishment + local equivalents.
2. **Score each factor** — behavioral control / financial control / relationship.
3. **Default conservatively** — borderline = W-2.
4. **Pick worker type per role** — W-2 / 1099 / EOR (Employer-of-Record) / agency-of-record.
5. **Document Statement of Determination** — written rationale for each classification.
6. **Wire contract template** — different language for each type.
7. **Set up payment + tax + insurance** — payroll / 1099 / EOR provider / international.
8. **Annual re-test** — relationships drift; what started 1099 ends up W-2 in fact.

## Output
Write `docs/inception/contractor-vs-employee-<project>.md`:

```markdown
# Contractor vs Employee Decision — <project>
**Owner:** founder / Head of People / counsel
**Date:** <YYYY-MM-DD>
**Jurisdictions:** <US-CA / US-NY / UK / EU-DE / remote-global>

## Why this exists
- Misclassification penalty = back-employment-taxes (FICA, FUTA, SUTA) + interest + 100% of unpaid amounts + state penalties
- DOL Wage & Hour: overtime back-pay + liquidated damages 100%
- IRS Section 530 safe harbor narrow; many states deny safe harbor entirely
- Class action exposure (PAGA in CA, individual + collective elsewhere)
- Equity grants to misclassified contractors retroactively void or reclassified
- IP assignment may be invalid if relationship was actually employment
- Workers' compensation gap = uninsured medical liability
- VC diligence: misclassification = material risk = price-cut or deal-kill

## Default posture
**When in doubt → W-2.** Cost of misclassification > cost of payroll overhead.

| Worker situation | Default |
|------------------|---------|
| Full-time, one client (you), set hours, your tools, indefinite | W-2 (forced) |
| Part-time, your only client, ongoing, your tools | W-2 |
| Project-based, fixed deliverable, multi-client, own tools | 1099 |
| International (you have no entity there) | EOR or B2B contractor |
| Specialized advisor (lawyer, accountant, consultant) | 1099 |
| Marketing / design freelancer, multi-client, < 30 hrs/wk | 1099 |
| Former employee returning to "consult" same role | W-2 (highest IRS scrutiny) |
| Student / intern | W-2 with intern wage rules; check DOL 7-factor test |

## US: IRS 20-factor (now distilled to 3 categories)

### Category 1: Behavioral control (more control = employee)
| Factor | W-2 lean | 1099 lean | Our case |
|--------|----------|-----------|----------|
| Worker follows instructions when/where/how | ✅ | ❌ | <Y/N> |
| Training provided by company | ✅ | ❌ | <Y/N> |
| Services integrated into core business | ✅ | ❌ | <Y/N> |
| Personal service required (no sub) | ✅ | ❌ | <Y/N> |
| Company sets work hours | ✅ | ❌ | <Y/N> |
| Continuous relationship | ✅ | ❌ | <Y/N> |
| Worker on company premises | ✅ | ❌ | <Y/N> |
| Tasks performed in set order | ✅ | ❌ | <Y/N> |
| Oral or written reports required | ✅ | ❌ | <Y/N> |

### Category 2: Financial control (more company-provided = employee)
| Factor | W-2 lean | 1099 lean | Our case |
|--------|----------|-----------|----------|
| Tools / equipment provided by company | ✅ | ❌ | <Y/N> |
| Significant investment by worker | ❌ | ✅ | <Y/N> |
| Worker has unreimbursed business expenses | ❌ | ✅ | <Y/N> |
| Worker can realize profit OR loss | ❌ | ✅ | <Y/N> |
| Worker has multiple clients | ❌ | ✅ | <Y/N> |
| Paid by hour/week/month vs by-job | ✅ | ❌ | <Y/N> |
| Expenses reimbursed | ✅ | ❌ | <Y/N> |

### Category 3: Relationship of parties
| Factor | W-2 lean | 1099 lean | Our case |
|--------|----------|-----------|----------|
| Written contract describes employment | ✅ | ❌ | <Y/N> |
| Worker receives benefits (PTO, health, 401k) | ✅ | ❌ | <Y/N> |
| Permanent or indefinite duration | ✅ | ❌ | <Y/N> |
| Worker integral to core business | ✅ | ❌ | <Y/N> |

**Scoring:** count factor-by-factor; tilt of total + judgment of "control reality". Single factor can sometimes determine outcome.

**Form SS-8:** if uncertain, can file with IRS for binding determination. Most companies don't — too slow + risks adverse finding. Document own determination in writing instead.

## US state tests — stricter than federal

### ABC test (CA, MA, NJ, IL, CT, VT, NH + others)
Worker is W-2 **unless ALL three are true:**
- **A** — free from company control and direction
- **B** — performs work outside the usual course of company business
- **C** — customarily engaged in an independently established trade

**California AB5 / AB2257 implications:**
- "Outside usual course of business" (B-prong) is the killer — if you're a SaaS co hiring a software engineer as 1099, B-prong fails
- Limited statutory exemptions (Borello test, business-to-business, professional services, etc.)
- Penalty per violation: $5,000 - $25,000 + back wages + benefits + insurance
- Prop 22 covers app-based platforms ONLY (Uber/Lyft/DoorDash); doesn't help SaaS

### Other state notable rules
| State | Rule | Penalty range |
|-------|------|---------------|
| **NY** | DOL strict control test + Construction Industry Fair Play Act | $1k-$2.5k per worker per misclassification |
| **WA** | Strict 6-prong test for professional services exemption | Class action + treble damages |
| **MA** | ABC test, no exemptions even for licensed professionals | Mandatory treble damages |
| **NJ** | ABC test, joint employer liability for staffing agencies | Treble damages + attorney fees |
| **CO** | Similar to ABC; HB22-1361 expanded | $5k-$25k per violation |

## UK: IR35 (off-payroll working rules)

Since April 2021 (private sector), client determines status — not contractor — via SDS (Status Determination Statement).

**Inside IR35** (treated as deemed employee for tax):
- Operates under direction/control of client
- Mutuality of obligation (must accept work offered, client must offer)
- Personal service (no substitute)
- Integrated into client team
- Single client typically
- → Client deducts PAYE + NIC + apprenticeship levy

**Outside IR35:**
- Genuine business-to-business contract
- Worker has substitution right (and could exercise it)
- No mutuality of obligation
- Multiple clients
- Own equipment, own risk
- → Contractor invoices via Ltd; net of corp tax + dividends

**Penalties for wrong SDS:**
- Unpaid PAYE/NIC + interest
- Penalty 30% (careless) to 100% (deliberate)
- Director liability if Ltd misrepresented
- Up to 4-yr lookback (6-yr if careless, 20-yr if deliberate)

**CEST tool** = HMRC's online assessment. Use as input; HMRC has lost cases where CEST was followed but reality contradicted it. Reality-test, not just-CEST.

## EU + global: permanent establishment risk

Hiring an employee or long-term contractor in a country creates **permanent establishment** (PE) for your company there → corporate tax filings, payroll registration, possibly VAT.

| Country | Risk threshold | Common pitfall |
|---------|----------------|----------------|
| **Germany** | Hiring W-2 OR long-term contractor (Scheinselbstständigkeit) | Misclassification → 6 mo - 4 yr criminal liability for founder |
| **France** | 1 W-2 = full payroll registration (URSSAF) | "Faux indépendant" → back-charges + penal |
| **Spain** | "Falso autónomo" rules tightened 2021-2024 (Glovo case) | Auto-conversion to W-2 + back-pay |
| **Italy** | Co-co-co rules, project contracts strict | Auto-conversion + INPS back-pay |
| **Netherlands** | DBA + Wet DBA reform 2026 | VAR replacement, model agreements mandatory |
| **Ireland** | RCT + PAYE; revenue audits aggressive | Reclassification + 100% penalty |

**Solution for global hires without entity:** EOR (Employer-of-Record).

### EOR providers (2025-2026)
| Provider | Strength | Pricing |
|----------|----------|---------|
| **Deel** | Largest network, contractor + EOR + global payroll | $599/mo W-2 EOR, $49/mo contractor |
| **Remote** | Strong compliance focus, IP protection | $599/mo W-2 EOR, $29/mo contractor |
| **Rippling Global** | Integrated US payroll + global EOR | Custom; bundled with US payroll |
| **Oyster** | Mid-market, fixed-pricing | $499/mo W-2 EOR |
| **Multiplier** | Asia/APAC strength | $400/mo W-2 EOR |
| **Velocity Global** | Enterprise + complex jurisdictions | Custom |
| **Papaya Global** | Strong payroll + immigration | Custom |
| **Justworks** | US PEO; intl through partners | $59-99/employee/mo US |

**EOR pros:** legal employer-of-record handles tax, benefits, termination per local law. You direct work, they handle compliance.
**EOR cons:** 8-15% markup on salary; IP assignment language sometimes weaker; can't grant ISOs to non-employees of your own entity (NSO via parent OK).

## Decision matrix (per-worker)

For each worker, score:

| Question | Lean W-2 | Lean 1099 |
|----------|----------|-----------|
| 1. Will you set their work hours? | ✅ | ❌ |
| 2. Will you provide laptop/tools? | ✅ | ❌ |
| 3. Will work last >6 months? | ✅ | ❌ |
| 4. Is work core to your business? | ✅ | ❌ |
| 5. Do you train them? | ✅ | ❌ |
| 6. Are they working only for you? | ✅ | ❌ |
| 7. Do they invoice for time, not deliverables? | ✅ | ❌ |
| 8. Could you fire them for being late? | ✅ | ❌ |
| 9. Do they have their own LLC/Ltd? | ❌ | ✅ |
| 10. Do they advertise services publicly? | ❌ | ✅ |
| 11. Have they served 3+ other clients in past 2 yr? | ❌ | ✅ |
| 12. Do they bring own equipment + license? | ❌ | ✅ |

**5+ W-2 leans → W-2 (do not 1099).**
**Mostly 1099 leans + clean separation → 1099 may be OK.**
**Borderline → W-2.**

## Statement of Determination (per worker)

```
**Worker:** <name>
**Role:** <title>
**Classification:** W-2 / 1099 / EOR / B2B contractor
**Jurisdiction:** <state / country>
**Date:** <YYYY-MM-DD>
**Determining factors (cited):**
- <factor 1 — e.g. "Project-based deliverable, fixed-fee $X for completion of Y by Z date">
- <factor 2 — e.g. "Worker provides services to 4 other clients per attestation">
- <factor 3 — e.g. "Worker uses own equipment; no company laptop issued">
- ...
**Tests applied:** IRS 20-factor / CA ABC / UK IR35 SDS / EU PE-risk
**Re-test scheduled:** <YYYY-MM-DD, annual>
**Signed:** founder + worker
```

Store in HR system. Pull in any audit.

## Contract template differences

### W-2 employment offer letter (per `/first-hire-plan`)
- At-will employment (US)
- Job description with title + reporting
- Compensation (base + equity + benefits)
- IP assignment + confidentiality (`/ip-assignment-agreement` + `/nda-template`)
- Non-compete only where enforceable (post-FTC ban 2024 contested)
- Non-solicit if jurisdiction allows
- Arbitration clause optional + jurisdiction-specific

### 1099 contractor agreement
- Independent contractor relationship — explicitly stated, not just titled
- Scope of work — fixed deliverables + acceptance criteria
- Fixed fee OR milestone payment (NOT hourly — hourly is W-2 signal)
- No benefits clause
- Worker provides own equipment + sets own hours
- Substitution allowed (key IR35 prong)
- IP assignment (work-made-for-hire + assignment of any non-WFH)
- Tax representation: contractor responsible for self-employment tax
- W-9 collected (US); 1099-NEC issued for >$600/yr
- No exclusivity (or narrow + project-scoped only)
- Mutual termination right

### EOR employment agreement
- EOR is legal employer-of-record per local law
- Your company is "client" or "principal"
- Work direction by your company per local rules
- IP assignment via EOR contract — REVIEW carefully, often weaker than direct
- Benefits per local statutory minimum + your top-up
- Termination per local law (notice periods 1-3 months common in EU)
- Equity grant to non-employee = NSO via parent, not ISO

### B2B contractor (UK Ltd / EU autónomo / etc)
- Company-to-company contract
- VAT terms specified
- Substitution clause active (IR35 outside)
- Mutuality of obligation explicitly absent
- Defined deliverables, not time
- Insurance requirement on contractor (professional indemnity)
- No employment-style benefits or perks
- Clear cessation of relationship at project end

## Payment + tax setup

### W-2 stack
- Payroll provider (see `/payroll-stack-pick`)
- Federal + state withholding registration
- Workers' comp policy
- Unemployment insurance registration
- Benefits administration

### 1099 stack
- W-9 collected before first payment
- 1099-NEC issued by Jan 31 for >$600 prior-year
- 1042-S for non-US contractors with US-source income (withholding rules)
- Payment via Wise / Deel / Mercury / Bill / direct ACH
- Track via accounting (see `/accounting-stack-pick`)

### International 1099 equivalent
- W-8BEN-E from contractor (not W-9)
- No US 1099 issued if no US-source income
- Pay via Wise / Deel Contractor / Remote / Mercury
- VAT considerations if contractor charges VAT
- Watch for permanent establishment risk if relationship is long-term + integrated

## Common misclassification scenarios — AVOID

| Scenario | Risk |
|----------|------|
| Hire same-role person 1099 to "try out" before W-2 | Full IRS exposure — same role = same classification needed |
| Convert W-2 to 1099 to "save money" | Massive red flag — IRS auto-audits this pattern |
| Hire CA-based engineer as 1099 | AB5 makes this nearly impossible for SaaS |
| Hire 1099 with set 9-5 hours + Slack required | IRS will reclassify on inspection |
| 1099 lasts > 1 year on same project | Continuous relationship = employee lean |
| Pay 1099 hourly with timesheets | Hourly+timesheet = employee pattern |
| 1099 has only you as client | "Multiple clients" prong fails |
| 1099 uses company laptop + company Slack + company office | Tools + premises = employee |
| Issue equity to 1099 without RSA / NSO clarity | Tax shock + potential reclassification |
| Hire intern unpaid in for-profit company | DOL 7-factor likely fails → W-2 minimum wage owed |
| Hire EU contractor for indefinite "ongoing support" | PE risk → corporate tax + misclassification |

## Annual re-test
Relationships drift. Annual review:
- Did 1099 stay multi-client?
- Did 1099 keep substitution right?
- Did duration extend past project scope?
- Did W-2 boundary blur (e.g. consultant doing core eng work)?
- Did jurisdiction change (worker moved state/country)?
- Are statements of determination still accurate?

Update statements; reclassify proactively if drift detected.

## Equity grant interaction

| Grant type | Worker type | Notes |
|------------|-------------|-------|
| **ISO (Incentive Stock Option)** | W-2 only (US) | Strict statutory rules; non-employees ineligible |
| **NSO (Non-qualified Stock Option)** | W-2 or 1099 or advisor | Ordinary income at exercise; reportable |
| **RSA (Restricted Stock Award)** | W-2 or advisor (rare 1099) | 83(b) within 30 days mandatory |
| **RSU (Restricted Stock Unit)** | W-2 (typically) | Vests = ordinary income event |
| **Phantom stock / SAR** | Any | Cash settlement; no equity issued |

**See `/equity-comp-philosophy` + `/vesting-schedule`.**

## Anti-patterns
- ❌ Default 1099 for "speed and savings" — speed is shorter than the audit
- ❌ Verbal contractor agreements
- ❌ Same role mixed W-2 + 1099 across team (red flag)
- ❌ 1099 paid hourly with timesheets and set hours
- ❌ No statement of determination
- ❌ No annual re-test
- ❌ Convert W-2 to 1099 to cut costs ("re-engagement as consultant")
- ❌ Use 1099 for CA software eng without legal review post-AB5
- ❌ Hire EU worker as long-term 1099 without EOR — PE landmine
- ❌ EOR contract IP language unreviewed
- ❌ Issue ISO to 1099 → invalid grant
- ❌ Pay international worker via PayPal "to keep simple" — tax + AML risk

## Founder mistakes to anticipate
1. "It's a contractor agreement so it's fine" — substance > form, IRS will reclassify regardless of paper
2. Save 7.65% FICA → pay 100% back-taxes + 100% penalty + interest
3. Issue equity to 1099 without RSA/NSO clarity → tax shock + reclassification cascade
4. International "contractor" + indefinite role + sole client = textbook misclassification
5. Skip W-9 / W-8BEN collection → 1099 reporting failure penalties
6. Hire former W-2 employee as 1099 for same role → highest IRS audit trigger
7. CA-based engineer as 1099 → AB5 = automatic reclassification
8. No annual re-test → 3-yr drift = 3 years of exposure
9. EOR contract IP weaker than direct hire → IP gap in cap-table diligence
10. Skip workers' comp because "we have no W-2s" → uninsured medical liability if 1099 reclassified

## Pre-launch checklist
- [ ] Per-role classification analyzed (IRS 20-factor / ABC / IR35 / PE risk)
- [ ] Statement of Determination written for each worker
- [ ] Contract templates by type (W-2 offer / 1099 / EOR / B2B)
- [ ] W-9 / W-8BEN / W-8BEN-E collection workflow
- [ ] Payroll provider selected (`/payroll-stack-pick`)
- [ ] EOR provider if international (Deel / Remote / Rippling)
- [ ] Workers' comp policy bound
- [ ] Equity grant compatible with worker type (ISO vs NSO)
- [ ] IP assignment in every contract
- [ ] Annual re-test cadence scheduled

## Hand-off
- First hire planning → `/first-hire-plan`
- Equity philosophy + grid → `/equity-comp-philosophy`
- Vesting schedule → `/vesting-schedule`
- IP assignment → `/ip-assignment-agreement`
- NDA → `/nda-template`
- Payroll stack → `/payroll-stack-pick`
- Founders agreement → `/founders-agreement`
- Insurance (incl. WC) → `/insurance-policy-pick`
- Jurisdiction picks → `/jurisdiction-pick`
- Founder time → `/founder-time-allocation`
```

## Verification
- Per-worker classification documented with cited factors.
- Tests applied: IRS 20-factor + state ABC + IR35 SDS + EU PE-risk.
- Statement of Determination on file for each worker.
- Contract template matched to classification (W-2 / 1099 / EOR / B2B).
- W-9 / W-8BEN collection in place.
- EOR provider chosen if international without entity.
- Annual re-test scheduled.
- Equity grant type matches worker type.
