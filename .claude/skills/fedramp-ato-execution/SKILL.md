---
name: fedramp-ato-execution
description: FedRAMP ATO execution — past pre-scoping, into SSP authoring discipline, SAP/SAR/POA&M cadence, agency PMO engagement, ConMon monthly, 3PAO mid-audit comms, JAB vs Agency ATO. Outputs to `docs/inception/fedramp-ato-<project>.md`. Reads `/project-classify` to skip XS/S/M. Companion to `/fedramp-pre-scope`. Use when user says "FedRAMP ATO", "SSP", "POA&M", "ConMon", "3PAO audit", "OSCAL", "JAB P-ATO", "agency ATO", "fedramp execution", or "/fedramp-ato-execution".
output_size:
  XS: skip
  S: skip
  M: skip
  L: 4h
  XL: 12h
---

# /fedramp-ato-execution — FedRAMP ATO Execution Playbook

## Why you'd care

FedRAMP ATO execution drifts past the 12-month deadline more often than not, and every month of slip burns ~$50–100k in compliance staff plus the agency sponsor's patience. Disciplined SSP authoring + POA&M cadence is the difference between getting the authorization and losing the federal deal.

> **Why you'd care:** `/fedramp-pre-scope` got you the go/no-go. This is the 12-24 month execution playbook for actually getting authorized. Most FedRAMP attempts stall not at the audit but at SSP authoring (600+ pages), at agency PMO engagement (sponsor goes cold), or at the first ConMon cycle when the team realizes monthly vulnerability scanning means actually fixing things in 30 days. Without execution discipline, your $400k 3PAO contract burns while findings pile up.

> **Effort estimate caveat:** `XL: 12h` covers *execution-plan authoring* — SSP outline, control inheritance map, audit calendar, ConMon cadence, agency PMO comms plan. Actual FedRAMP Moderate ATO from `pre-scope` to "Authorized" listing on FedRAMP Marketplace is **12-24 months**, $250k–$2M, +1 to +3 FTE depending on starting posture. The 12h figure is the playbook, not the run.

Invoke as `/fedramp-ato-execution`. L+ only. Follows `/fedramp-pre-scope`.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS/S/M → SKIP.
2. Read `docs/inception/fedramp-<project>.md` (pre-scope) — MUST exist.
3. Read existing SOC 2 report if any (foundation for SSP).
4. Read `docs/inception/clearance-<project>.md` if defense/IC parallel.

## Inputs
- Pre-scope decision: pursue / defer / skip (must be "pursue").
- Sponsor agency status: identified + Letter of Intent or sponsored on marketplace.
- 3PAO selection: contracted or in RFP.
- Impact level: Low / Moderate / High.
- Authorization path: JAB P-ATO or Agency ATO.
- Existing posture: greenfield / SOC 2 Type II / ISO 27001 / FedRAMP Ready.

## Process
1. **Pick the authorization path firmly**:
   - **JAB P-ATO** — Joint Authorization Board (DoD CIO, GSA CIO, DHS CIO). ~12 slots/year via Connect process. Pre-requisites: 6+ federal agency interest, mature posture, FedRAMP Ready first. Best for products with multi-agency appeal. **Discontinued in 2023 — JAB transitioned to "agency-led with FedRAMP PMO support" model.** Verify current state at fedramp.gov before assuming JAB exists.
   - **Agency ATO** — sponsor agency authorizes; FedRAMP PMO reviews package. Most common 2024+ path. Reciprocity: other agencies can issue their own ATO on top.
   - **FedRAMP Ready** designation — pre-ATO marketplace listing showing readiness; signals to agencies. Earned via Readiness Assessment Report (RAR) from 3PAO.
2. **SSP authoring** (System Security Plan, 600+ pages):
   - Use FedRAMP template v3.x (per 800-53 Rev 5 baseline since 2023).
   - **Section 1-9 boilerplate** — system identification, ownership, system description, services + ports + protocols + applications.
   - **Section 10-13** — system environment + interconnections + applicable laws/regulations + roles & responsibilities.
   - **Section 14** — implementation status per control (THE bulk). Each control: implemented / partially / planned / inherited / hybrid; with "implementation description" 2-3 paragraphs per.
   - **Section 15** — assessment + monitoring.
   - **Appendices** — A: policies; B: agency-specific; C: privacy; D: roles; E: significant change; F: separation of duties matrix; G: encryption requirements; H: network/data flow diagrams.
   - Page count Moderate ~600; High ~900.
   - Tool: Word + reviewers, or **OSCAL** machine-readable migration (FedRAMP PMO target). OSCAL JSON/XML/YAML schema lets automated control authoring + drift detection. Slow adoption 2024-2026.
3. **Control inheritance map** — which controls do you inherit from CSP?
   - **AWS GovCloud FedRAMP High** — inherits ~150 of 325 Mod controls (physical, environmental, network boundary mostly).
   - **Azure Gov FedRAMP High** — similar inheritance map.
   - You author the residual ~175 (application-layer, identity, logical access, incident response, configuration management).
   - **Customer responsibility matrix (CRM)** — vendor doc; map every control to customer vs provider responsibility.
4. **3PAO engagement cadence** (Third-Party Assessment Organization):
   - **Kickoff** — month 0; scope of audit, schedule.
   - **Readiness assessment** — months 1-3 (if pursuing FedRAMP Ready first).
   - **Audit field work** — months 3-9; control testing, evidence collection, interviews.
   - **Mid-audit comms** — weekly stand-up with 3PAO lead assessor; do NOT go dark. Findings raised early are findings you can close before SAR.
   - **SAR (Security Assessment Report)** delivery — month 9-10; lists all findings classified High / Moderate / Low.
   - **POA&M (Plan of Action & Milestones)** drafted — month 10; for every non-low finding, plan + owner + due date.
   - 3PAO cost: $200k-$500k Moderate; $400k-$800k High. Top firms: Coalfire, A2, Schellman, EmergyNet, Kratos.
5. **Agency PMO engagement plan**:
   - **Monthly sync** with sponsor PMO during readiness + audit.
   - **Quarterly executive update** to sponsor agency CIO/CISO.
   - **Avoid sponsor cold** — #1 ATO failure mode. Sponsor turnover (avg federal IT exec tenure 2.5 yr) means you may onboard a new champion mid-cycle.
   - **Marketplace listing prep** — pre-write the FedRAMP Marketplace entry; agencies search it.
6. **ConMon (Continuous Monitoring)** — starts at "Authorized" and never ends:
   - **Monthly vulnerability scans** — authenticated, all in-scope hosts, against current CVE feed. Findings: 30 days High, 90 days Moderate, 180 days Low to remediate.
   - **Monthly POA&M update** to FedRAMP PMO + sponsor agency.
   - **Annual full reassessment** by 3PAO (recurring cost $150k-$400k).
   - **Significant change request (SCR)** for any architecture change crossing thresholds (new region, new service, new auth mechanism, new data flow).
   - **Incident reporting** — US-CERT within 1 hour for incidents involving federal data.
7. **POA&M discipline**:
   - Every finding → POA&M row: control ID, finding, severity, remediation plan, owner, due date, status.
   - Late POA&M items → "Operating with Risk" letter from sponsor or downgrade.
   - Carryover beyond two ConMon cycles → automatic escalation.
   - Tool: GovReady-Q, Anitian Compass, RegScale, or homegrown spreadsheet (don't).
8. **OSCAL migration** (FedRAMP PMO target state):
   - Open Security Controls Assessment Language — NIST machine-readable schema.
   - Replaces 600-page Word SSP with structured JSON/XML/YAML.
   - **catalog → profile → component-definition → SSP → AP → AR → POA&M** chain.
   - Adoption uneven 2024-2026; expect parallel Word + OSCAL for 2-3 years. Tools: Anitian, RegScale, Telos Xacta, FedRAMP's own oscal-cli.
9. **Headcount + roles**:
   - **ISSO** (Information System Security Officer) — required named role; 1.0 FTE.
   - **ISSM** (Manager) — 0.5 FTE for Moderate, 1.0 for High.
   - **Compliance lead** — manages 3PAO + PMO.
   - **DevSecOps** — ConMon automation; 0.5-1.0 FTE.
   - **Privacy officer** — if PII handled.
   - **US-persons** for any privileged access; HR + access controls enforce.
10. **Crypto + FIPS**:
    - **FIPS 140-2 validated** crypto mandatory at all encryption points (in-transit TLS, at-rest disk, key wrapping). FIPS 140-3 transitioning.
    - **FIPS-validated module** — not "FIPS-capable"; the specific module ID on NIST CMVP list.
    - Common gotcha: open-source TLS libs not FIPS-validated; need FIPS-validated build (OpenSSL FIPS module, AWS-LC, BoringSSL FIPS).
11. **Boundary diagram + data flow**:
    - **System Authorization Boundary** — every component in scope, every interconnection out.
    - **External services** that touch your boundary need their own ATO inherited (e.g., SendGrid for email — must use SendGrid FedRAMP-authorized version or move to AWS SES GovCloud).
    - **Interconnection Security Agreement (ISA)** for each external system.
12. **Failure / re-do scenarios**:
    - **3PAO fails the audit** — SAR has many Highs → fix + re-test (cost: $50k-$200k partial re-audit).
    - **Sponsor walks** — pre-ATO: restart with new sponsor (6-12 mo lost). Post-ATO: another agency picks up.
    - **Significant change rejected** — must modify scope or delay rollout.
    - **ConMon failure** — risk-based revocation by sponsor agency (rare but possible).

## Output
Write `docs/inception/fedramp-ato-<project>.md`:

```markdown
# FedRAMP ATO Execution Plan — <project>
**Date:** <YYYY-MM-DD>
**Owner:** <ISSO name>
**Sponsor agency:** <name + champion + title>
**Impact level:** Moderate / High
**Authorization path:** Agency ATO / FedRAMP Ready→Agency ATO

## Milestones (24-month plan)
| Milestone | Target | Owner | Cost | Status |
|---|---|---|--:|---|
| Pre-scope decision | M0 | exec | $20k | done |
| 3PAO contracted | M1 | compliance lead | $50k retainer | |
| FedRAMP Ready readiness assessment | M2-M4 | 3PAO | $100k | |
| FedRAMP Ready listing on Marketplace | M5 | FedRAMP PMO | included | |
| SSP draft v1 | M6 | ISSO | included | |
| Control inheritance map approved | M6 | architect | included | |
| Boundary diagram + ISA signed | M7 | architect | included | |
| 3PAO audit kickoff | M8 | 3PAO + ISSO | $400k | |
| SAR delivered | M14 | 3PAO | included | |
| POA&M v1 | M14 | ISSO | included | |
| Agency review (sponsor PMO) | M15-M18 | sponsor PMO | $50k | |
| Authorization letter (ATO) | M18-M20 | sponsor AO | $0 | |
| Marketplace "Authorized" listing | M20 | FedRAMP PMO | $0 | |
| ConMon cycle 1 | M21+ | DevSecOps + ISSO | $200k/yr | |
| Annual reassessment | Year 2 | 3PAO | $200k | |

## Headcount
| Role | FTE | Hire month | Citizen requirement |
|---|--:|---|---|
| ISSO | 1.0 | M0 | US person |
| ISSM | 0.5 | M3 | US person |
| Compliance lead | 1.0 | M1 | any |
| DevSecOps | 1.0 | M3 | US person (admin) |
| Privacy officer | 0.25 | M6 | any |

## Control inheritance
- AWS GovCloud inherited: <N> controls (PE family, parts of SC/SI families)
- Application-layer authored: <N>
- Hybrid: <N>
- Customer Responsibility Matrix link: <SharePoint / Confluence URL>

## SSP authoring plan
- Template: FedRAMP SSP v3.x (800-53 Rev 5)
- Tool: Word + OSCAL parallel from M6
- Section ownership:
  - Sections 1-13 boilerplate: compliance lead
  - Section 14 controls (the big one): ISSO + control owners
  - Appendices: privacy officer + architect
- Review cadence: weekly internal; biweekly with 3PAO once contracted

## Sponsor PMO engagement
- Monthly sync: <PM name> + ISSO
- Quarterly exec update: CISO ↔ <sponsor CIO>
- Champion succession plan: secondary champion identified
- Marketplace listing draft: <SharePoint URL>

## 3PAO engagement
- Selected: <vendor>
- Contract value: $<X>k Moderate / $<X>k High
- Engagement model: continuous (weekly stand-ups during field work)
- Mid-audit comms cadence: weekly
- Findings escalation path: 3PAO lead → ISSO → ISSM → CISO

## POA&M operating model
- Tool: <RegScale / Anitian / GovReady>
- Cadence: monthly update to FedRAMP PMO + sponsor PMO
- Remediation SLAs: 30d High / 90d Mod / 180d Low
- Escalation: >2 cycles overdue → CISO review
- Closure evidence: stored in audit-managed system

## ConMon plan (post-ATO)
- **Monthly:** authenticated vuln scan + POA&M update + access review
- **Quarterly:** config baseline review + tabletop IR exercise
- **Annually:** 3PAO reassessment + full pen test
- **Continuous:** SIEM monitoring; SOC 24/7 (insourced or MDR)
- **Significant change process:** SCR template + AO routing

## OSCAL adoption plan
- Phase 1 (M6-M12): catalog + profile JSON authored
- Phase 2 (M12-M18): SSP component-definition JSON parallel to Word
- Phase 3 (post-ATO Y2): primary system of record OSCAL; Word retired

## Crypto + FIPS verification
- TLS termination: <AWS ALB FIPS endpoint / nginx with OpenSSL FIPS module>
- At-rest: KMS GovCloud (CMVP cert <#>) or Azure Key Vault Premium HSM
- Key wrapping: HSM-backed
- Hash inventory: SHA-2 family; SHA-1 only legacy compat with deprecation date

## Boundary + interconnections
- Diagram link: <Visio / draw.io>
- External services: SendGrid Gov / Twilio Gov / Stripe (PCI-only, no Fed) / etc.
- Each external service: ISA signed + their authorization letter on file

## Cost forecast (24mo + ConMon Y2)
| Phase | Cost |
|---|--:|
| 3PAO Readiness + Audit | $500k |
| Internal FTE (24mo @ ~3.25 FTE × $200k loaded) | $1.3M |
| Tooling (OSCAL platform, SIEM, vuln scanner) | $150k |
| Sponsor agency review + ATO admin | $50k |
| Marketplace + listing | $0 (no fee) |
| **Total to ATO** | **~$2M** |
| Year 2 ConMon + reassessment | $400k/yr |

## Risk register
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Sponsor walks | M | H | secondary champion + marketplace listing |
| 3PAO finds many Highs | H | M | mid-audit weekly comms; pre-audit gap close |
| SSP page count overruns | H | M | OSCAL parallel; ghost-write contractors |
| FIPS module gap (e.g., crypto lib) | M | H | catalog every crypto touch point M3 |
| ConMon SLA miss | M | M | DevSecOps automation; SLA-bound to dev sprints |
| Agency CIO turnover | M | H | quarterly C-level relationship |

## 90-day plan
1. 3PAO RFP + selection (week 1-4)
2. SSP outline + control owner assignment (week 2-8)
3. Boundary diagram v1 (week 4-8)
4. Sponsor PMO weekly sync established (week 1)
5. OSCAL tooling decision (week 4-8)
6. POA&M tool selection (week 6-10)
7. Hiring plan: ISSO + compliance lead onboard (week 1-12)
8. Marketplace listing draft (week 10-12)
```

## Verification
- Authorization path declared (Agency ATO; JAB only if explicitly viable).
- Sponsor agency identified with primary + secondary champion.
- 3PAO selected with contract value and engagement cadence.
- SSP control ownership matrix assigned (each of ~325 Mod controls has an owner).
- Control inheritance map documented (CSP vs customer responsibility).
- ConMon cadence + tooling chosen.
- POA&M operating model defined with SLA enforcement.
- FIPS 140-2/3 validation verified for every crypto touchpoint.
