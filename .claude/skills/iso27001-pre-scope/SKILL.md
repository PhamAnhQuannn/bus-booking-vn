---
name: iso27001-pre-scope
description: ISO 27001:2022 readiness pre-scoping — ISMS scope, Annex A controls, certification body, cost. Outputs to `docs/inception/iso27001-<project>.md`. Reads `/project-classify` to skip XS/S. Use when user says "ISO 27001", "ISMS", "/iso27001-pre-scope", or before EU enterprise sales.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /iso27001-pre-scope — ISO 27001 Pre-readiness

## Why you'd care

EU enterprise buyers gate on ISO 27001 and a 9–12 month certification timeline kills the deal cycle if you didn't start early. The pre-scope tells you whether to commit to it now or accept the lost segment.

> **Effort estimate caveat:** `XL: 8h` covers *pre-scoping only* (ISMS scope, Annex A control gap, certification body shortlist, SoA draft). Full ISO 27001:2022 certification is **6–12 months + $25k–$100k** (ISMS implementation, internal audit, Stage 1 + Stage 2 external audit, surveillance audits). The 8h figure is NOT total project effort — multiply by 3–5× when budgeting roadmap.

Invoke as `/iso27001-pre-scope`. M+ for international/EU enterprise. ISO 27001:2022 (latest revision).

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS/S → SKIP
2. Read `docs/inception/regulatory-<project>.md`.
3. Read `docs/inception/soc2-<project>.md` if exists (~70% control overlap).

## Inputs
- Geo of customers (EU = ISO favored; US = SOC 2 favored).
- Existing SOC 2? (faster path).
- Headcount.

## Process
1. **ISO 27001 vs SOC 2**:
   - ISO 27001 = international standard; ISMS-based; certification (yes/no)
   - SOC 2 = US attestation; risk-based; report (graded)
   - EU customers prefer ISO; US prefer SOC 2; both = best
2. **ISMS scope definition**:
   - Boundary (which products, services, locations, data centers, employees)
   - Smaller scope = cheaper audit, less control burden
   - Common: SaaS product + supporting infra + corporate IT
3. **Annex A controls (2022 revision)**:
   - 93 controls in 4 themes: Organizational (37), People (8), Physical (14), Technological (34)
   - Statement of Applicability (SoA) — pick which controls apply + justify exclusions
4. **Mandatory clauses (4–10)**:
   - Context of organization
   - Leadership
   - Planning (incl. risk assessment)
   - Support (resources, competence)
   - Operation
   - Performance evaluation
   - Improvement
5. **Certification body**:
   - **BSI** (UK) — most prestigious; expensive
   - **TÜV** (DE) — German rigor; expensive
   - **Schellman** (US) — accredited; mid-priced
   - **A-LIGN** (US) — startup-friendly
   - **DEKRA, DNV** — alternates
6. **Stage 1 + Stage 2 audit**:
   - Stage 1: documentation review (~2 days)
   - Stage 2: implementation review (~5 days)
   - Surveillance audits annually
   - Recertification every 3 years
7. **Headcount + time**:
   - 12 mo first cert (vs 5–6 mo SOC 2 Type I)
   - 0.5 FTE through prep
   - Internal audit required (independent of operation)

## Output
Write `docs/inception/iso27001-<project>.md`:

```markdown
# ISO 27001:2022 Pre-scope — <project>
**Date:** <YYYY-MM-DD>

## Trigger
- EU enterprise pipeline: $<X>
- Customer asks: <count>
- Vs SOC 2: complement or alternative

## ISMS scope statement
"The ISMS covers the development, operation, and support of the <Product> SaaS platform, including supporting cloud infrastructure (AWS eu-west-1), corporate IT, and personnel handling customer data. Headquarters: <City>. Production data centers: AWS eu-west-1, eu-central-1."

## SoA (Statement of Applicability) preview
- Total Annex A controls: 93
- Applicable: ~85
- Excluded: 8 (e.g. physical data center — inherited from AWS; legacy media — n/a)
- Justification doc: required

## Certification body
- **Selected:** Schellman
- Cost: ~$50k Stage 1+2 first year
- Surveillance Y2: $20k
- Surveillance Y3: $20k
- Recertification Y4: $50k
- **3-yr cost: ~$140k**

## Platform leverage
- Vanta / Drata also support ISO 27001 module (~$5k/yr add-on)
- Reuse 70% of SOC 2 evidence

## Effort + cost
| Phase | Duration | Cost | Headcount |
|---|---|--:|---|
| Gap analysis vs Annex A | 4 wk | $10k consultant | 0.3 FTE |
| ISMS docs (policies, SoA, RA) | 8 wk | $0 (templates) | 0.5 FTE × 2 mo |
| Control implementation | 12 wk | $20k tools | 0.5 FTE × 3 mo |
| Internal audit | 2 wk | $5k | external auditor |
| Mgmt review | 1 wk | $0 | leadership |
| Stage 1 audit | 1 wk | $15k | 0.3 FTE |
| Remediation | 4 wk | varies | 0.3 FTE |
| Stage 2 audit | 1 wk | $35k | 0.3 FTE |
| Cert issued | — | — | — |
| **Y1 total** | **~12 mo** | **~$80k** | **~0.5 FTE peak** |

## Geo justification
- EU customers ask: ISO 27001 > SOC 2
- ISO 27017 (cloud) + ISO 27018 (PII) — add-ons cheap once 27001 done
- ISO 27701 (privacy mgmt) — add-on for GDPR alignment

## Risk if skip
- EU enterprise deals lost
- Tender exclusions
- Reputational gap vs competitors

## Adjacent paths
- **ISO 27017** — cloud-specific add-on
- **ISO 27018** — PII in cloud add-on
- **ISO 27701** — PIMS for GDPR
- **TISAX** — automotive-sector
- **C5** (DE) — German cloud cert

## 90-day plan
1. Pick scope + cert body (week 1–2)
2. Engage consultant for gap (week 2–6)
3. Draft ISMS policies + SoA (week 6–14)
4. Implement controls + tooling (week 14–30)
5. Internal audit (week 30–32)
6. Stage 1 (~week 36)
7. Stage 2 (~week 50)
```

## Verification
- ISMS scope statement explicit.
- SoA preview drafted.
- Cert body selected with 3-yr cost.
- Overlap with SOC 2 noted if applicable.
- Geo justification quantified.
