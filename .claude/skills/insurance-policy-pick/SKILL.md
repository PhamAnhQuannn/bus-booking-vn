---
name: insurance-policy-pick
description: Pre-launch overall insurance policy pick — GL, BOP, cyber, E&O, D&O, EPLI, workers comp, key-person, commercial auto. Maps risks to coverage tiers, broker vs InsurTech, premium budget. Outputs to `docs/inception/insurance-policy-pick-<project>.md`. Use when user says "insurance", "policy pick", "broker", "GL", "BOP", "EPLI", "workers comp", "/insurance-policy-pick", or before first contract / first hire.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /insurance-policy-pick — Insurance Bought Before The Incident, Not After. Map Risks, Match Policies, Pick Once.

## Why you'd care

One slip-and-fall, one wrongful termination, or one data breach without the right policy is enough to wipe a small company — and the right coverage usually costs less than founders fear. The pre-launch policy pick is the cheap insurance against bet-the-company tail risk.

Insurance ≠ optional overhead. Insurance = the difference between "lawsuit closes the company" and "lawsuit is annoying paperwork". Customer SLAs, first-hire EPLI exposure, cyber-breach litigation, founder personal-liability exposure — each maps to a policy. Pick the bundle pre-launch.

## Pre-flight
Run before signing first customer contract OR before hire #1 — whichever comes first. Pairs with `/d-and-o-insurance-pick`, `/e-and-o-insurance-pick`, `/cyber-insurance-pick`, `/payroll-stack-pick`, `/jurisdiction-pick`.

## Inputs
- Business activities (SaaS / fintech / health / hardware / services / scraping)
- Customer SLA commitments
- Worker types (W-2 / 1099 / international)
- Office vs remote-only
- Funding stage (D&O usually triggered at first VC round)
- Data sensitivity (PII / PHI / PCI / SOC2 / nothing)
- Customer requirements (enterprise often requires cyber + E&O proof)

## Process
1. **Risk inventory** — identify each material risk class.
2. **Map risks to policies** — GL / BOP / cyber / E&O / D&O / EPLI / WC / key-person / commercial auto.
3. **Pick broker model** — traditional broker vs InsurTech vs DIY hybrid.
4. **Get quotes** — 3+ carriers per material policy.
5. **Pick coverage limits + deductibles** — calibrate to risk + customer-required minimums.
6. **Stack the bundle** — BOP often combines GL + property; separate cyber/E&O/D&O usually needed.
7. **Schedule renewals + COI distribution** — annual + on-demand certs for customers.
8. **Document + lock policies** before incident-triggering activity (sign / hire / launch).

## Output
Write `docs/inception/insurance-policy-pick-<project>.md`:

```markdown
# Insurance Policy Pick (Pre-launch) — <project>
**Owner:** founder / Head of Ops / fractional COO
**Date:** <YYYY-MM-DD>
**Entity:** <C-corp DE / LLC / etc.>
**Activities:** <SaaS / fintech / health / etc.>
**Stage:** <pre-revenue / pre-Series-A / Series-A>

## Why this exists pre-launch
- First customer contract usually requires GL + cyber + E&O COIs
- First W-2 hire triggers workers comp (state-mandated) + EPLI exposure
- First VC round triggers D&O requirement (board seat = director liability)
- Cyber-breach claim averages $4.4M (IBM Cost of a Data Breach 2025) — uninsured = company-ending
- Lawyer fees alone for any meritless suit = $50k-200k

## Risk inventory

| Risk | Likelihood | Impact | Policy |
|------|-----------|--------|--------|
| Slip/fall in office or at customer site | Low (remote) / Med (office) | $10k-500k | GL |
| Property damage (laptop / server / office) | Med | $5k-100k | Property / BOP |
| Cyber breach / ransomware | Med-High | $500k-10M+ | Cyber |
| Customer SaaS bug → financial loss to customer | Med | $50k-5M | E&O / tech E&O |
| Investor / customer / employee suit against founder personally | Med (post-Series A) | $250k-5M | D&O |
| Employee discrimination / wrongful term / harassment suit | Med | $75k-500k | EPLI |
| Employee injury on the job | Med | varies | Workers comp |
| Founder death / disability | Low | company-ending | Key-person life |
| Company-owned vehicle / employee-on-the-clock driving | Low (most SaaS) | varies | Commercial auto |
| Crime / employee theft / wire fraud | Med (wire fraud!) | $50k-500k | Crime / Fidelity |
| IP infringement (someone sues us) | Low-Med | $100k-1M | E&O extension or media liability |
| Product recall (if hardware) | Low | varies | Product recall |

## Policy bundle picked

| Policy | Y1? | Limits | Deductible | Premium est | Carrier / broker |
|--------|-----|--------|------------|-------------|------------------|
| **General Liability (GL)** | ✅ | $1M occurrence / $2M aggregate | $500-1k | $400-800/yr | Hiscox / Next / Coalition |
| **BOP (GL + Property bundle)** | ✅ if office | $1M GL + property limit | $500-1k | $800-1500/yr | Hiscox / Next |
| **Cyber liability** | ✅ if customer data | $1M / $1M | $5-10k | $1500-5k/yr | Coalition / At-Bay / Cowbell / Corvus |
| **Tech E&O** | ✅ if SaaS | $1M / $1M | $5-10k | $2-5k/yr | Hiscox / Coalition / Vouch |
| **D&O** | After first VC round | $1M / $3M / $5M (per VC ask) | $25-50k | $5-15k/yr | Vouch / Embroker / Founder Shield |
| **EPLI** | ✅ after first hire | $1M | $5-25k | $1500-5k/yr | Embroker / Hiscox |
| **Workers comp** | ✅ after first W-2 | state-mandated | varies by state | $40-150/EE/mo | through Gusto / Next / Hartford |
| **Key-person life** | If founder = single point of failure | 5-10x annual comp | n/a | $500-2000/yr/founder | term life from any major carrier |
| **Commercial auto** | Only if vehicle | varies | varies | varies | Progressive / GEICO commercial |
| **Crime / Fidelity** | After payroll grows | $250k-1M | $5-25k | $500-2k/yr | bundled with D&O or BOP |
| **Umbrella** | After 10+ EE / customer asks | $5M-10M excess | n/a | $1-3k/yr | over all other liability |

**Year-1 bundle (pre-revenue SaaS, 1 founder, 0 hires):** GL ($500) + Cyber ($1500) + Tech E&O ($2000) = **~$4k/yr**
**After first hire + first customer:** add EPLI ($1500) + WC ($500-2000) = **~$7-9k/yr**
**After Series A:** add D&O ($5-15k) = **~$15-25k/yr**

## Broker model

| Model | Pros | Cons | Pick if |
|-------|------|------|---------|
| **Traditional broker (Marsh / Aon / Lockton)** | Best for complex / large limits | High minimums; slow | $50M+ revenue / IPO-track |
| **Tech-focused broker (Vouch / Embroker / Founder Shield)** | SaaS-savvy; fast quotes; bundle | Newer; some carriers gated | **Default seed-Series B.** |
| **InsurTech (Next / Hiscox / Coalition direct)** | Fastest online quotes; low minimums; cheap | Self-service; less hand-holding | Pre-seed / solo founder |
| **Hybrid (Vouch / Embroker + Coalition direct for cyber)** | Best-in-class per line | Multiple renewals to manage | Most mature seed-Series A pick |

**Our pick:** Vouch / Embroker for bundle + Coalition / At-Bay for cyber separately (most carriers specialize)

## Coverage limits guidance

### GL
- **$1M / $2M** = standard SaaS minimum; most customer COIs accept
- **$2M / $4M** = enterprise customers may require
- **Always bundle with Property as BOP if you have office**

### Cyber
- **$1M / $1M** = startup floor
- **$3M / $3M** = SaaS handling PII at scale
- **$5M / $5M** = enterprise SaaS / healthcare / fintech
- **Watch:** breach response retainer included; coverage extends to ransomware payment (with conditions); sub-limits on social engineering wire fraud (separately important)
- **See `/cyber-insurance-pick`**

### Tech E&O
- **$1M / $1M** = SaaS floor
- **$3M / $3M** = mid-market SaaS
- **$5M / $5M** = enterprise SaaS with SLA-tied damages
- **Watch:** consequential damages exclusion + IP infringement coverage scope
- **See `/e-and-o-insurance-pick`**

### D&O
- **$1M / $3M** = post-seed minimum (many SAFEs / safes don't require yet)
- **$3M / $5M** = post-Series A (most term sheets require)
- **$5M+** = Series B+
- **Watch:** Side A / Side B / Side C breakdown; entity vs personal coverage
- **See `/d-and-o-insurance-pick`**

### EPLI
- **$1M** = standard at <50 EE
- **$2-3M** = >50 EE or high-discrimination-risk industry
- **Watch:** wage-and-hour sub-limit (often capped low); 3rd-party coverage (customer harassment of staff)

### Workers comp
- State-mandated rate per $100 payroll × class code
- SaaS class codes: 8810 (clerical, ~$0.20-0.40/$100), 8742 (outside sales)
- Carrier through Gusto-broker / Next / Hartford / state fund / NEXT
- Workers comp class-code review reduces premium

## Customer-driven minimums
Common B2B SaaS contract minimums (from MSA template):

| Policy | Mid-market | Enterprise (Fortune 500) |
|--------|-----------|--------------------------|
| GL | $1M / $2M | $2M / $5M |
| Cyber | $1M | $3-10M |
| Tech E&O | $1M | $3-5M |
| Umbrella | not required | $5-10M |
| Workers comp | state-mandated | state-mandated |
| Commercial auto | not required | $1M if applicable |
| Additional insured endorsement | required | required |
| Waiver of subrogation | required | required |
| Primary + non-contributory | sometimes | required |

**Action:** review customer MSAs as they come in; bump policies + endorsements as needed.

## COI (Certificate of Insurance) workflow
- Broker generates COIs on demand within 24-48 hr
- Add customer as "additional insured" + provide waiver of subrogation per MSA
- Store COIs in data room
- COIs renewed annually; auto-distribute to active customers on renewal

## Premium budget Year 1

| Stage | Annual premium |
|-------|---------------|
| Solo founder pre-revenue | $4-5k |
| 1-3 employees + first paying customers | $7-12k |
| 5-15 EE post-seed | $12-20k |
| Post-Series A with D&O | $25-50k |
| Series B+ | $50-150k |

## Anti-patterns
- ❌ "We'll get insurance when a customer asks" → customer asks during contract = scramble + bad terms
- ❌ One mega-policy covers everything → no carrier writes that
- ❌ Coverage limits below customer-required minimum → contract delayed or lost
- ❌ Skip cyber because "we don't store credit cards" → ransomware doesn't care
- ❌ Skip E&O because "we have a disclaimer in ToS" → ToS doesn't stop a complaint, lawyer fees still apply
- ❌ Skip D&O because "no board yet" → first investor often requires; founder personally exposed
- ❌ Skip EPLI because "we're nice" → wrongful-term suit averages $200k+ in defense
- ❌ Skip key-person on solo founder → company dies with founder
- ❌ Cheapest broker → may miss endorsements customer requires
- ❌ Set-and-forget policies → annual review needed; activities change
- ❌ Personal car for business use without commercial auto → personal carrier denies claim

## Pre-launch checklist
- [ ] Risk inventory complete
- [ ] GL or BOP in force
- [ ] Cyber in force if any customer data
- [ ] Tech E&O in force if SaaS
- [ ] Workers comp in force per state of each W-2 (state-mandated)
- [ ] EPLI in force if any hire (or scheduled to bind on hire date)
- [ ] D&O scheduled (or bind trigger on first VC term sheet)
- [ ] Key-person if solo founder + meaningful revenue
- [ ] Broker locked + relationship established
- [ ] COI workflow tested
- [ ] All policies stored in data room

## Anti-patterns flagged
- ❌ No risk-to-policy map
- ❌ Limits below customer minimum
- ❌ Cyber missing
- ❌ E&O missing
- ❌ EPLI missing post-first-hire
- ❌ Workers comp missing in any state
- ❌ D&O missing post-board-formation
- ❌ Set-and-forget without annual review

## Annual review
- Activities change → bump policies
- Headcount grew → EPLI limit up + WC class-code review
- Revenue grew → all limits review
- Funding round → D&O limit per term sheet
- New jurisdiction → WC + GL per state
- Carrier history: claim count, rate trend

## Next
- D&O depth → `/d-and-o-insurance-pick`
- E&O depth → `/e-and-o-insurance-pick`
- Cyber depth → `/cyber-insurance-pick`
- Workers comp via payroll → `/payroll-stack-pick`
- Customer-required terms → `/msa-template`
```

## Verification
- Risk inventory complete with likelihood + impact.
- Risk-to-policy map.
- Broker model picked.
- Limits calibrated to customer-required minimums.
- Premium budget by stage.
- COI workflow.
- Pre-launch checklist.
- Annual review triggers.
