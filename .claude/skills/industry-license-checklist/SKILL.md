---
name: industry-license-checklist
description: Industry-specific license / permit / registration checklist (food, finance, health, legal, education, transport). Outputs to `docs/inception/industry-license-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "industry license", "permit", "regulated industry", "/industry-license-checklist", or before serving regulated vertical.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /industry-license-checklist — Industry Permits

## Why you'd care

Operating in a regulated vertical without the right state license is unauthorized practice and can void contracts, freeze revenue, and trigger personal liability for officers. The checklist catches the missing permit before the first customer.

Invoke as `/industry-license-checklist`. Wrong industry, no license = closed.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP

## Inputs
- Industry served.
- Geo (state/country).
- Activity type (advice / processing / handling regulated material).

## Process
1. **Per-industry license map** (US-focused; adapt for geo):

   **Financial (FinTech)**
   - Money transmitter license (MTL) — per state
   - MSB registration (FinCEN)
   - Lending license — per state
   - SEC/FINRA registration if securities
   - Crypto: state BitLicense (NY), federal MSB
   - Mitigation: partner with bank-as-a-service (Unit, Synapse) to inherit licenses

   **Healthcare (HealthTech)**
   - HIPAA Business Associate Agreement
   - State medical board if connecting to providers
   - DEA if controlled substances
   - FDA if device/diagnostic (510(k), De Novo, PMA)
   - Telehealth state-by-state licensing

   **Legal (LegalTech)**
   - Unauthorized Practice of Law (UPL) risk per state
   - Bar associations vary — most prohibit non-lawyer legal advice
   - Mitigation: tool not advice; lawyer-in-the-loop

   **Food**
   - State food handler permits
   - FDA food facility registration if interstate
   - Cottage food laws (state-by-state for home prep)
   - Liquor license (state) if alcohol
   - Health dept inspection

   **Education**
   - State approval if accredited credentials
   - SARA (state authorization reciprocity) if multi-state online
   - FERPA if K-12 student data
   - GLBA if financial aid info

   **Transport / Mobility**
   - DOT registration
   - State motor carrier license
   - Insurance requirements (commercial auto, cargo)
   - Local TNC (TNC = transport network company) per city
   - Drone: FAA Part 107

   **Cannabis**
   - State license (where legal)
   - Local zoning + permit
   - Federal banking restrictions
   - Mitigation: ancillary services legal federally

   **Insurance**
   - State producer license
   - Carrier vs MGA distinction
   - Excess & surplus lines if non-admitted

   **Real Estate**
   - State broker / salesperson license
   - Property management license per state
   - MLS access

2. **Per geo, regulators**:
   - US: federal (CFPB, FDA, SEC, etc.) + state (varies) + local
   - EU: by country + EU directives (MiFID, GDPR, AI Act)
   - UK: FCA (finance), MHRA (health), CAA (transport)
3. **Cost + timeline per license** — some take 9 mo + $50k.
4. **Compliance ongoing** — annual filing, exams, audits.

## Output
Write `docs/inception/industry-license-<project>.md`:

```markdown
# Industry License Checklist — <project>
**Date:** <YYYY-MM-DD> | **Industry:** <X> | **Geo:** <Y>

## Industry classification
- Primary: <e.g. FinTech>
- Sub-vertical: <e.g. payments>
- Regulated activities: <list>

## Required licenses / registrations
| License | Required by | Geo | Cost | Timeline | Status |
|---|---|---|--:|---|---|
| MSB registration | FinCEN | US federal | $0 | 1 wk | done |
| MTL (state-by-state) | each state | 49 states | $5k–$50k each | 6–24 mo | partner BaaS instead |
| ... | | | | | |

## Mitigation strategies
- BaaS partner (Unit / Synapse / Treasury Prime) — inherit MTL via partnership
- Sponsorship from licensed entity
- Geographic limit (start in 1 state, expand)
- Activity limit (don't custody funds → no MTL)

## Compliance ongoing
| Item | Frequency | Cost |
|---|---|--:|
| AML training | annual | $500 |
| BSA officer | continuous | included in role |
| FinCEN SAR filing | as needed | $0 |
| State exams | every 2 yr | $5k |
| Annual report | per state | $200/state |

## Counsel engagement
- Industry-specialist counsel needed (not general): <firm>
- Estimated cost: $X for initial setup
- Ongoing retainer: $Y/mo

## Risk if unlicensed
- Cease-and-desist orders
- Fines (per state, can be material)
- Criminal liability for officers
- Customer trust loss
- Funding rounds blocked (DD will surface)

## Insurance
- E&O / professional liability
- Cyber (if PII/financial)
- D&O for officers

## Verdict
**LICENSE-PATH-CLEAR / NEEDS-SCOPING / BLOCKED (must change biz model)**

## 90-day plan
1. Engage industry counsel (week 1)
2. License application package (weeks 2–6)
3. File primary license (week 7)
4. Implement compliance program (weeks 8–12)
```

## Verification
- Industry classified specifically.
- All required licenses listed (not just one).
- Mitigation strategies explored.
- Ongoing compliance costs budgeted.
- Industry-specialist counsel identified.
