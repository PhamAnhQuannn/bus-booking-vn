---
name: fedramp-pre-scope
description: FedRAMP authorization scoping (Low/Moderate/High) — sponsor, control count, ATO timeline, cost. Outputs to `docs/inception/fedramp-<project>.md`. Reads `/project-classify` to skip XS/S/M. Use when user says "FedRAMP", "federal customer", "ATO", "/fedramp-pre-scope", or before pursuing US fed deal.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /fedramp-pre-scope — FedRAMP Pre-scoping

## Why you'd care

Founders chase federal customers without realizing FedRAMP is an 18-month, $1–2M project — by the time they learn, they've already promised the agency a delivery date. Pre-scoping kills or commits the path before the sponsor conversation, not after.

> **Effort estimate caveat:** `XL: 8h` covers *pre-scoping only* (impact-level pick, sponsor strategy, 3PAO shortlist, control gap delta). Full FedRAMP Moderate ATO is **12–24 months + $250k–$2M** (3PAO assessment, JAB or Agency authorization, ConMon ongoing). The 8h figure is NOT total project effort — multiply by ~50× (months not hours) when budgeting roadmap.

Invoke as `/fedramp-pre-scope`. L+ only. FedRAMP = 12–24 mo + $250k–$2M.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS/S/M → SKIP (FedRAMP overhead crushes)
2. Read `docs/inception/regulatory-<project>.md`.

## Inputs
- US federal customer pipeline (existing or sponsor identified).
- Data sensitivity (CUI? PII? PHI?).
- Deployment model (SaaS / IaaS / PaaS).
- Existing security posture (SOC 2? ISO 27001?).

## Process
1. **Authorization path**:
   - **JAB P-ATO** — Joint Authorization Board (highest bar; only ~12/yr)
   - **Agency ATO** — sponsor agency authorizes (most common path)
   - **FedRAMP Tailored** — for low-risk SaaS only (deprecated 2024; use Low)
2. **Impact level**:
   - **Low** — public data, ~125 controls (NIST 800-53)
   - **Moderate** — CUI, ~325 controls (most enterprise SaaS)
   - **High** — sensitive (law enforcement, emergency, financial), ~425 controls
3. **Sponsor required** — agency must sponsor agency-ATO path. No sponsor = no path. Identify via:
   - Existing customer relationship
   - Marketplace listing (FedRAMP Marketplace shows agency interest)
   - Outreach via partner / system integrator
4. **3PAO selection** — Third Party Assessment Org. ~30 accredited. Cost $200k–$500k for Moderate audit.
5. **Pre-work prereqs**:
   - SSP (System Security Plan) — 600+ pages
   - SAP (Security Assessment Plan)
   - SAR (Security Assessment Report)
   - POA&M (Plan of Action & Milestones)
   - Continuous monitoring (ConMon) plan
6. **Infrastructure**:
   - **GovCloud** required for most (AWS GovCloud, Azure Gov, Google Gov)
   - US persons only for admin access
   - FIPS 140-2 validated crypto
   - Boundary diagram
7. **Headcount**:
   - Dedicated security engineer (1 FTE)
   - Compliance lead
   - DevSecOps for ConMon
8. **Timeline**:
   - Pre-readiness: 6–12 mo
   - Audit: 6 mo
   - Authorization: 3–6 mo
   - **Total: 15–24 mo from start to ATO**

## Output
Write `docs/inception/fedramp-<project>.md`:

```markdown
# FedRAMP Pre-scope — <project>
**Date:** <YYYY-MM-DD>

## Decision
**PURSUE / DEFER / SKIP**

## Sponsor
- Agency: <DoD / VA / GSA / etc.>
- Status: <identified / engaged / signed sponsor letter>
- Champion: <name + title>

## Impact level
- **Chosen:** Moderate
- Rationale: handle CUI, PII; not classified or LE
- Control count: ~325
- Deployment: AWS GovCloud us-gov-west-1

## Path
- Agency ATO via <sponsor agency>
- 3PAO: <vendor; quoted cost>
- Marketplace listing post-ATO: yes

## Effort + cost
| Phase | Duration | Cost | Headcount |
|---|---|--:|---|
| Readiness (gap close) | 12 mo | $300k | +1 sec eng FTE |
| 3PAO audit | 6 mo | $400k | existing |
| Agency review + ATO | 6 mo | $50k | existing |
| ConMon Y1 | ongoing | $200k/yr | +0.5 FTE |
| **Total Y1** | **24 mo** | **~$1M** | **+1.5 FTE** |

## Prereqs (must close before audit)
- [ ] SOC 2 Type II achieved (foundation; reduces FedRAMP gap)
- [ ] FIPS 140-2 crypto everywhere
- [ ] GovCloud deployment proven
- [ ] All admins US persons (HR + access controls)
- [ ] Boundary diagram approved
- [ ] SSP drafted (600+ pages)
- [ ] Vulnerability scanning automated
- [ ] Incident response runbook tested
- [ ] Background-checked personnel for admin

## Mitigation alternatives
- **StateRAMP** — for state/local; cheaper (~$200k); separate skill
- **Inherit from CSP** — AWS GovCloud + their FedRAMP authorization (you authorize the SaaS layer only)
- **TX-RAMP / AZ-RAMP** — state alternatives if state-only customers
- **Defer** — pursue commercial customers first; revisit at $5M ARR

## Revenue justification
- Pipeline value if authorized: $X
- Avg federal ACV: $Y
- Break-even at: <N> federal customers
- TAM if marketplace-listed: $Z

## Risk if skip
- Federal pipeline blocked (~$X/yr)
- Cannot sell to most agencies without ATO
- Competitors with ATO win deals automatically

## 90-day decision plan
1. Confirm sponsor (week 1–2)
2. Engage advisor (week 2–4)
3. Gap analysis vs NIST 800-53 Moderate (week 4–10)
4. Build/buy decision: A2 / Carahsoft / Stackarmor (week 10–12)
5. **Go/no-go** (end of Q1)
```

## Verification
- Sponsor identified or path-to-sponsor explicit.
- Impact level chosen with rationale.
- Cost + headcount + timeline realistic.
- Prereqs checklist actionable.
- Mitigation alternatives explored.
