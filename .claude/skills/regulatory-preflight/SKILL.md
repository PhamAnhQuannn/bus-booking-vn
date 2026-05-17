---
name: regulatory-preflight
description: Top-level regulatory scoping orchestrator — routes to GDPR/HIPAA/PCI/FedRAMP/AI Act/etc. sub-skills. Outputs to `docs/inception/regulatory-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "regulatory", "compliance scoping", "/regulatory-preflight", or before serving regulated customer.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /regulatory-preflight — Regulatory Orchestrator

Invoke as `/regulatory-preflight`. Identify which regimes apply. Then route to sub-skill.

## Why you'd care

Discovering you needed a HIPAA BAA after launching to a health system is how products get pulled from production. The preflight routes you to the right sub-skill before architecture commits.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP
2. **Front-load mode**: if class=M AND domain in {scrape, PII, payments}, this runs WITH `/problem-validation` (not after). Both feed `/inception-gate-review` in parallel — regulatory deal-killers must surface BEFORE customer-validation effort sinks.

## Inputs
- Geo of customers + data (US states, EU, UK, AU, CA, BR, JP, etc.).
- Industry vertical.
- Data types collected (PII, PHI, financial, biometric, child).
- Customer types (consumer / SMB / enterprise / government / regulated industry).

## Process
1. **Geographic regimes**:
   - EU/EEA: **GDPR** (always if EU person data) → `/gdpr-preflight`
   - UK: **UK GDPR + DPA 2018** → similar to GDPR
   - California: **CCPA / CPRA** if >$25M rev or 100k consumers
   - Other US states: VA, CO, CT, UT, etc. (~14 state privacy laws)
   - Brazil: **LGPD**
   - Canada: **PIPEDA**
   - Japan: **APPI**
   - Australia: **Privacy Act**
   - China: **PIPL** (extra-territorial like GDPR)
2. **Industry regimes**:
   - Health (US): **HIPAA** → `/hipaa-preflight`
   - Health (EU): **MDR/IVDR** if device
   - Finance (US): **SOX** if public, **GLBA**, **PCI-DSS**, **BSA/AML**
   - Finance (EU): **MiFID II**, **PSD2**, **DORA**
   - Education (US): **FERPA**, **COPPA** if <13
   - Children: **COPPA** US, **GDPR-K** EU
   - Government: **FedRAMP** US fed → `/fedramp-pre-scope`, **StateRAMP**, **CMMC** for DoD
3. **Tech regimes**:
   - AI: **EU AI Act** → `/ai-act-classifier`, **NIST AI RMF**
   - Accessibility: **ADA**, **EAA** (EU 2025), **AODA** (Ontario)
   - Export controls: **EAR**, **ITAR**, **OFAC** sanctions → `/export-control-screen`
   - IoT: **EU CRA**, sector specific
4. **Sector certifications (B2B-needed)**:
   - **SOC 2** Type I/II → `/soc2-readiness-pre`
   - **ISO 27001** → `/iso27001-pre-scope`
   - **HITRUST** for HIPAA-heavy
5. **Per regime route to sub-skill**:
   - GDPR → `/gdpr-preflight` + `/lawful-basis-mapping` + `/dsar-process-pre`
   - HIPAA → `/hipaa-preflight`
   - PCI → `/pci-preflight`
   - FedRAMP → `/fedramp-pre-scope`
   - AI Act → `/ai-act-classifier`
   - SOC 2 → `/soc2-readiness-pre`
   - Accessibility → `/accessibility-statement-precommit`
   - Records retention → `/records-retention-pre`
   - AML/KYC → `/aml-kyc-design`
6. **Effort estimate** per regime (small/med/large/blocking).
7. **Sequencing** — what comes first (usually privacy + sector + B2B cert).

## Output
Write `docs/inception/regulatory-<project>.md`:

```markdown
# Regulatory Preflight — <project>
**Date:** <YYYY-MM-DD>

## Customer / data scope
- Geo: <US, EU, UK>
- Industry: <X>
- Data types: <PII, PHI, financial?>
- Customer types: <SMB, enterprise>

## Applicable regimes (triage)
| Regime | Applies? | Reason | Sub-skill | Priority | Effort |
|---|:--:|---|---|:--:|---|
| GDPR | ✓ | EU customers | `/gdpr-preflight` | P0 | M |
| UK GDPR | ✓ | UK customers | (covered by GDPR work) | P0 | S |
| CCPA/CPRA | ✓ | CA users >100k forecast | (privacy program) | P1 | S |
| HIPAA | ✗ | no PHI | — | — | — |
| PCI-DSS | partial | use Stripe (offload most) | `/pci-preflight` | P1 | S |
| SOC 2 | ✓ Type II target Y2 | enterprise sales | `/soc2-readiness-pre` | P2 | L |
| ISO 27001 | optional | EU enterprise | `/iso27001-pre-scope` | P3 | L |
| FedRAMP | ✗ | no fed customers | — | — | — |
| AI Act (EU) | ✓ | high-risk AI? need classifier | `/ai-act-classifier` | P1 | M |
| EAA accessibility | ✓ | EU consumer 2025 | `/accessibility-statement-precommit` | P1 | M |
| Records retention | ✓ | privacy-driven | `/records-retention-pre` | P2 | S |
| AML/KYC | ✗ | no money handling | — | — | — |
| Export control | ✓ | check sanctions list customer | `/export-control-screen` | P2 | S |

## Sequencing plan
| Quarter | Regime work |
|---|---|
| Q1 | GDPR + UK GDPR + CCPA program; PCI scope reduction; export control screen |
| Q2 | AI Act classification + accessibility audit |
| Q3 | SOC 2 Type I prep + records retention |
| Q4 | SOC 2 Type II audit |
| Y2 | ISO 27001 if needed |

## Counsel + advisor pool
- Privacy: <firm>
- AI Act: <firm or specialist>
- Cyber/SOC 2: <auditor>

## Investment estimate
| Regime | Year 1 cost |
|---|--:|
| GDPR + privacy program | $10k (DPO consultant + tooling) |
| PCI scope reduction | $0 (Stripe offload) |
| SOC 2 Type I | $25k (audit + tools) |
| AI Act prep | $5k (legal advice) |
| Accessibility audit + remediation | $10k |
| **Total Y1** | **$50k** |

## Risk if defer
| Regime | Defer risk |
|---|---|
| GDPR | €20M or 4% rev fine |
| CCPA | $7500/violation × users affected |
| AI Act | retroactive fines from 2025 |
| Accessibility | lawsuit + class action |
| SOC 2 | enterprise deals lost |

## Verdict
**REGULATORY-MAPPED / NEEDS-DEEPER-SCOPING / TOO-EARLY**
```

## Verification
- All 5 regime categories scoped (geo, industry, tech, sector cert, B2B).
- Each ✓ regime routed to sub-skill.
- Sequencing per quarter.
- Investment estimate.
- Defer risk explicit per regime.
