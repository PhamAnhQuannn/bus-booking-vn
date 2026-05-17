---
name: foci-cfis-screening
description: Foreign Ownership / Control / Influence + CFIUS pre-investment screening — DCSA FOCI mitigation ladder (Board Resolution → SCA → SSA → Proxy → Voting Trust), CFIUS short-form vs JVN, mandatory filing triggers, foreign-investor term-sheet disqualification clauses. Outputs to `docs/inception/foci-cfis-<project>.md`. Reads `/project-classify` to skip XS. Upstream: `/security-clearance-mapping`. Use when user says "FOCI", "CFIUS", "foreign investor", "DCSA", "covered transaction", "foreign ownership", "Joint Voluntary Notice", "JVN", "Treasury CFIUS", or "/foci-cfis-screening".
output_size:
  XS: skip
  S: 1h
  M: 2h
  L: 4h
  XL: 6h
---

# /foci-cfis-screening — FOCI + CFIUS Pre-investment Screening

## Why you'd care

Take a foreign investor without screening and you can trigger a mandatory CFIUS filing, lose your DCSA facility clearance, or get forced to unwind the round after close — at which point the cap table is broken. Screening at the term-sheet stage is the only cheap moment to catch this.

> **Why you'd care:** Defense, critical-tech, or critical-infrastructure startups that take a single dollar from the wrong foreign source can lose their FCL (Facility Clearance) overnight or have their funding round unwound by CFIUS 12 months after closing. The screen must happen *before* term sheet, not after. One Chinese LP in a US VC fund can blow up your DoD pursuit.

> **Effort estimate caveat:** This is term-sheet-gate scoping. Actual FOCI mitigation negotiation with DCSA takes **6-18 months** and adds $100k-$500k legal cost; CFIUS mitigation can add **30-90 days** to a funding round close (short-form declaration) or **75-200 days** (Joint Voluntary Notice with mitigation). Mandatory filings (CFIUS Part 800 critical tech) cannot be waived.

Invoke as `/foci-cfis-screening`. Fires on first foreign-capital signal regardless of project class (founder may not know the screen exists).

## Pre-flight
1. Read `docs/classify/<project>.md`.
2. Read `docs/inception/clearance-<project>.md` if defense/IC track.
3. Read cap table + term-sheet draft if available.
4. Read product description for critical-technology / critical-infrastructure / sensitive-data signals.

## Inputs
- Cap table (current investors + national origin of beneficial owners).
- Pending investors / term sheet under negotiation.
- Product type — critical tech? critical infrastructure? sensitive personal data?
- Customer base — DoD / IC / civilian / commercial.
- Cleared work intent — pursuing FCL? holding FCL?
- Foreign board members / advisors / employees with control influence.

## Process
1. **FOCI vs CFIUS — separate regimes, often co-fire**:
   - **FOCI** (Foreign Ownership / Control / Influence) — DCSA (Defense Counterintelligence and Security Agency) gates Facility Clearance eligibility. NISPOM 32 CFR Part 117. Triggered by any foreign equity / debt / control influence.
   - **CFIUS** (Committee on Foreign Investment in the United States) — Treasury-led inter-agency; reviews / blocks / unwinds foreign acquisitions of US businesses in defined sensitive sectors. FIRRMA (2018) expanded scope to non-controlling investments in TID businesses (Technology / Infrastructure / Data).
   - Both can hit one transaction. A foreign Series A round may trigger FOCI mitigation *and* CFIUS mandatory filing.
2. **FOCI trigger thresholds** (per NISPOM):
   - **≥5% foreign ownership** by single foreign person/entity (lower than CFIUS threshold)
   - **Foreign board representation** (any seat or observer)
   - **Foreign creditor** with material rights (covenants, conversion, veto)
   - **Contract dependency** on foreign supplier with leverage
   - **Foreign employee / consultant** with management authority
   - **Foreign LP in domestic VC fund** — pierces through to portfolio if substantial (case-by-case)
3. **FOCI mitigation ladder** (DCSA negotiates per case; lighter is cheaper + faster):
   - **Board Resolution** — affirms US-citizen control; lightest; for de minimis foreign ownership
   - **Security Control Agreement (SCA)** — restricts foreign owner from classified info access
   - **Special Security Agreement (SSA)** — foreign owner allowed equity; restricted from board control + classified ops; outside directors required; **most common for VC-backed**
   - **Proxy Agreement** — foreign owner full disenfranchisement; proxy holders run US operations independent
   - **Voting Trust Agreement** — most restrictive; voting rights held by trustee; equity divorced from control
   - Costs: Board Res $20k legal → Voting Trust $500k+ legal + ongoing $50-200k/yr DCSA-monitored compliance
   - Timeline: 6-18 months negotiation; FCL on hold until mitigation in place
4. **CFIUS jurisdiction** (FIRRMA + Part 800/802):
   - **Covered Control Transactions** (Part 800) — foreign person acquires control of US business
   - **Covered Investments** (Part 800, FIRRMA expansion) — non-controlling foreign investment in **TID US business**:
     - **T** — Critical Technology (export-controlled tech: ITAR, EAR 600-series, dual-use)
     - **I** — Critical Infrastructure (28 categories: telecom, energy, defense industrial base, financial services, etc.)
     - **D** — Sensitive Personal Data of US persons (biometric, health, financial, geolocation, ≥1M record threshold)
   - **Covered Real Estate Transactions** (Part 802) — proximity to military/IC sites
5. **Mandatory vs voluntary CFIUS filings**:
   - **Mandatory short-form Declaration** when:
     - Foreign government acquires substantial interest in TID US business
     - Critical technology US business + foreign person acquires covered investment
     - Filing: 5-page declaration; CFIUS responds in 30 days with action / no-action / request for full filing
   - **Joint Voluntary Notice (JVN)** — full filing:
     - 60-day review + 45-day investigation + 15-day presidential decision possible
     - 75-day base, can stretch to 200+ days with mitigation negotiation
     - Cost: $750k-$2M legal + diligence
   - **Failure to file mandatory** → civil penalty up to $250k OR transaction value (FIRRMA 2018)
6. **CFIUS critical-technology definition** (Part 800.215):
   - Items on US Munitions List (ITAR)
   - Commerce Control List 600-series (military-adjacent dual-use)
   - Nuclear (10 CFR Part 110)
   - Select agents / toxins (CDC)
   - **Emerging + Foundational Technologies** per Export Control Reform Act (ECRA) — list still maturing; includes AI/ML, quantum, autonomous, biotech, advanced surveillance
7. **CFIUS sensitive personal data thresholds** (Part 800.241):
   - Genetic test results of US persons (any volume)
   - Biometric IDs of US persons (any volume)
   - Geolocation / financial / health / SSN / payment-card / nonpublic email = ≥1M US-person records collected/maintained, OR business is targeted to US gov contractors / sensitive populations
8. **Foreign-government substantial-interest** definition (Part 800.244):
   - Foreign state owns ≥49% of foreign acquirer, OR
   - Foreign acquirer has rights via state-owned investor with ≥1 board seat / control over hiring
   - State-owned LP in VC → check if pierces
9. **Sovereign-wealth funds + state-owned enterprises**:
   - Mubadala, PIF (Saudi), CIC (China), GIC (Singapore), Temasek (Singapore), Qatar Investment Authority — all trigger foreign-government substantial-interest review
   - Some have negotiated standing CFIUS exempt status — verify per transaction
10. **DCSA + CFIUS staffing**:
    - Both agencies coordinate but operate independently
    - DCSA reviews FCL eligibility; CFIUS reviews transaction
    - Both can attach mitigation; mitigation often overlaps (separate boards, US-citizen ops, audit rights)
11. **Term-sheet disqualification clauses** (preventive):
    - "Investor represents it is not a foreign person under 31 CFR 800.224 (CFIUS) and not a Foreign Interest under NISPOM 32 CFR 117 (FOCI)"
    - "Cap table changes triggering FOCI/CFIUS thresholds require board approval + counsel review"
    - "Pre-emptive right reserved if investor sells secondary to foreign person"
    - "Information rights gated by US-person status of recipient"
    - Standard for defense-tech VCs (Shield Capital, America's Frontier Fund, In-Q-Tel, Lux defense vehicles, etc.)
12. **DCSA mitigation timeline + cost** (operational):
    - **Pre-mitigation (FCL on hold)** — 0-3 months disclosure + DCSA preliminary
    - **Mitigation negotiation** — 3-12 months legal + DCSA back-and-forth
    - **Mitigation execution** — outside directors recruited, training rolled out, monitor appointed
    - **Annual review** — DCSA monitor audit; SSA/Proxy companies pay ongoing monitor fees $50-200k/yr
13. **Adjacent regimes triggered by foreign capital**:
    - **ITAR** (22 CFR 120-130) — foreign person on technical data = deemed export; license required
    - **EAR** (15 CFR 730-774) — same for dual-use tech
    - **Export Control Reform Act (ECRA)** — Commerce list expansion
    - **OFAC sanctions** — block-listed party screening
    - **DDTC registration** for ITAR-controlled work
    - **Section 889** (NDAA 2019) — Huawei/ZTE/Hikvision/Dahua/Hytera ban for federal contractors

## Output
Write `docs/inception/foci-cfis-<project>.md`:

```markdown
# FOCI + CFIUS Screening — <project>
**Date:** <YYYY-MM-DD>
**Reviewer:** <general counsel + external CFIUS counsel>

## Snapshot
- Product category: <e.g., autonomous defense ISR>
- Critical tech under EAR/ITAR? <yes / no + ECCN>
- Critical infrastructure (CFIUS 28 categories)? <yes / no>
- Sensitive personal data of US persons? <yes / no + volume>
- US gov contracts current / pursued? <DoD / IC / civilian>
- FCL holder / applicant? <yes / no / planned Y2>

## Cap table foreign exposure
| Investor | Country | % equity | Board / observer | Rights | FOCI trigger | CFIUS trigger |
|---|---|--:|---|---|---|---|
| Founder | US | 60% | yes | yes | no | no |
| US VC (Lux) | US | 25% | yes | std prot | no | no |
| LP-in-US-fund (foreign) | <country> | 5% pass-through | no | no | watch | watch |
| Foreign angel | <country> | 3% | no | no | watch | screen |
| Pending: Series A lead | <country> | up to 18% | yes | board seat | yes | yes |

## FOCI assessment
- Current: **CLEAN** / **WATCH** / **TRIGGERED**
- Triggered by: <which holding(s)>
- Required mitigation: <Board Res / SCA / SSA / Proxy / Voting Trust>
- DCSA submission timing: <pre-FCL / post-FCL with change-condition report>
- Estimated cost: $<X>k legal + $<X>k/yr ongoing monitor

## CFIUS assessment
- Jurisdiction: **YES** / **NO**
  - TID determination: T <yes/no> | I <yes/no> | D <yes/no>
- Mandatory filing: **YES** / **NO**
  - Trigger: <foreign gov substantial interest / critical tech / sensitive data>
- Voluntary filing recommendation: <recommended / not recommended>
- Filing type: Declaration (short) / JVN (full)
- Estimated timeline impact on round close: <30d / 75d / 200d>
- Estimated legal cost: $<X>k

## Mitigation strategy
### If FOCI triggered
- Preferred instrument: <SSA / Proxy>
- Outside director slate plan
- Cleared-employee carve-out from foreign-controlled side
- Monitor appointment plan
- Ongoing compliance cadence: quarterly DCSA report

### If CFIUS jurisdiction
- File declaration first (cheaper, faster); upgrade to JVN if CFIUS requests
- Mitigation menu prepared: voting trust / passive investor rights / NSA review of board materials / data-segregation agreement
- Communications: do NOT close round before CFIUS clearance if mandatory

## Term-sheet protective clauses (recommended)
- [ ] Investor foreign-person rep + warranty
- [ ] FOCI/CFIUS threshold approval right
- [ ] Information rights gated on US-person status
- [ ] Pre-emptive right on secondary to foreign person
- [ ] CFIUS-out covenant (right to unwind if CFIUS blocks)
- [ ] Mandatory disclosure if investor's beneficial owners change

## Adjacent compliance
| Regime | Triggered by | Action required |
|---|---|---|
| ITAR | foreign person on tech data | DDTC registration + license |
| EAR | dual-use tech transfer | BIS license per export |
| OFAC | sanctioned-country investor | block + decline |
| Section 889 | China surveillance gear in supply | rip-and-replace |

## Timeline impact on funding round
| Scenario | Days added | Cost added |
|---|---:|---:|
| Clean / no foreign | 0 | $5k baseline screen |
| CFIUS Declaration only | +30-45 | $50-150k |
| CFIUS JVN base | +75 | $400-800k |
| CFIUS JVN with mitigation | +120-200 | $750k-$2M |
| FOCI SSA negotiation in parallel | +180-365 | $150-500k |

## Decision
- [ ] PROCEED with round as structured — investor clean
- [ ] PROCEED with mandatory CFIUS declaration filed pre-close
- [ ] PROCEED with FOCI mitigation plan in parallel; round closes; DCSA mitigation completes M+12
- [ ] RESTRUCTURE round — replace foreign investor before close
- [ ] DECLINE foreign investor — defense-tech path blocked otherwise
- [ ] KILL round — terms incompatible with cleared work

## 90-day plan
1. External CFIUS counsel retained (week 1) — Sheppard Mullin, Covington, Wilson Sonsini gov-tech practice
2. Cap table screen finalized + waterfall to beneficial owners (week 1-3)
3. Term-sheet protective clauses added (week 1)
4. CFIUS filing decision: declaration vs JVN (week 4-6)
5. DCSA FOCI preliminary (if FCL track) (week 4-12)
6. Mitigation instrument selected if triggered (week 8-12)
```

## Verification
- Every cap-table holder screened to beneficial-owner level (not just first-tier entity).
- FOCI trigger thresholds (≥5% foreign equity, board seat, creditor rights) checked.
- CFIUS TID determination explicit (T/I/D yes-no).
- Mandatory CFIUS filing assessed (failure to file = $250k+ penalty).
- Term-sheet protective clauses listed.
- Timeline impact on round close quantified.
- Adjacent regimes (ITAR/EAR/OFAC/Section 889) cross-checked.
