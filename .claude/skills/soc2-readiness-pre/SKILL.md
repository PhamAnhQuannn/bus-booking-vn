---
name: soc2-readiness-pre
description: SOC 2 Type I/II readiness pre-scoping — TSC scope, auditor selection, control library, evidence pipeline, cost. Outputs to `docs/inception/soc2-<project>.md`. Reads `/project-classify` to skip XS/S. Use when user says "SOC 2", "Type II", "/soc2-readiness-pre", or before enterprise sales push.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /soc2-readiness-pre — SOC 2 Pre-readiness

> **Effort estimate caveat:** `XL: 8h` covers *pre-scoping only* (TSC pick, auditor shortlist, control gap, evidence pipeline plan). Full SOC 2 Type II is **9–15 months + $30k–$150k** (6 mo observation window minimum, control implementation, auditor fees, Drata/Vanta tooling). The 8h figure is NOT total project effort — multiply by 3–5× when budgeting roadmap.

Invoke as `/soc2-readiness-pre`. M+ when first enterprise asks. Type I = point-in-time. Type II = 6+ mo audit window.

## Why you'd care

Walking into SOC 2 cold is a 9-month, six-figure surprise. Pre-scoping TSC, auditor, and evidence pipeline turns it into a planned project instead of an existential one.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS/S → SKIP (premature)
2. Read `docs/inception/regulatory-<project>.md`.

## Inputs
- Enterprise pipeline (deals blocked on SOC 2?).
- Existing security posture.
- Headcount available for audit prep.

## Process
1. **Trust Service Criteria scope**:
   - **Security** — required (default; only mandatory TSC)
   - **Availability** — uptime commitments to customers
   - **Confidentiality** — handle confidential data per contract
   - **Processing Integrity** — financial/compute correctness
   - **Privacy** — PII subject to privacy laws
   - Pick minimum needed (Security alone = cheapest)
2. **Type I vs Type II**:
   - **Type I** — design only; ~3 mo prep + audit; $15k–$30k. Weak signal but gets started.
   - **Type II** — operating effectiveness over 6+ mo window; $30k–$60k audit. Real signal.
   - Standard path: Type I → Type II 6 mo later
3. **Auditor selection**:
   - Big 4 (Deloitte, EY, KPMG, PwC) — $80k+; brand premium
   - Mid-market (BDO, Crowe, Schellman) — $40k–$60k; standard
   - Boutique CPA (Prescient, Insight Assurance, A-LIGN) — $20k–$40k; startup-friendly
4. **Compliance platform**:
   - **Vanta** (~$15k/yr) — most popular for startups
   - **Drata** (~$15k/yr) — close competitor
   - **Secureframe** (~$10k/yr) — leaner
   - **Sprinto** (~$8k/yr) — cost-leader
   - Manual (spreadsheets) — only viable solo with <5 controls
5. **Control library** (Common Criteria + chosen TSC):
   - ~125 controls for Security alone
   - +20–40 per additional TSC
6. **Evidence pipeline**:
   - Auto-collected via integrations (AWS, GitHub, Okta, Linear)
   - Manual evidence: policies, board minutes, risk assessments
7. **Policy pack** (~25 docs):
   - Information Security Policy
   - Acceptable Use Policy
   - Access Control Policy
   - Data Classification Policy
   - Incident Response Policy
   - BCP / DR Policy
   - Change Management Policy
   - Vendor Management Policy
   - … templates from Vanta / Drata
8. **Headcount + time**:
   - Type I: ~0.5 FTE × 3 mo
   - Type II: ~0.3 FTE ongoing + 0.5 FTE audit window

## Output
Write `docs/inception/soc2-<project>.md`:

```markdown
# SOC 2 Readiness Pre-scope — <project>
**Date:** <YYYY-MM-DD>

## Trigger
- Enterprise deals blocked: <list, ARR if known>
- Customer asks: <count>
- Strategic: ICP requires SOC 2

## TSC scope
- **Required:** Security
- **Optional add:** Availability (we commit 99.9% uptime SLA)
- Skip: Confidentiality, Processing Integrity, Privacy (defer)

## Type
- **Year 1:** Type I (Q3) — fastest signal
- **Year 2:** Type II (Q3 audit window Q1–Q2) — full signal

## Auditor
- **Selected:** <A-LIGN / Schellman / Prescient>
- Cost: $25k Type I + $40k Type II Y2
- Engagement letter: Q1

## Platform
- **Selected:** Vanta
- Cost: $15k/yr
- Integrations: AWS, GitHub, Okta, Linear, Notion
- Auto-evidence coverage: 80%

## Control coverage gap
| Control area | Status | Action |
|---|---|---|
| Access mgmt (SSO, MFA) | green (Okta) | none |
| Asset inventory | yellow | Vanta to enumerate |
| Encryption at rest | green | RDS + S3 SSE |
| Encryption in transit | green | TLS everywhere |
| Logging + monitoring | yellow | add CloudTrail + Datadog SIEM |
| Vulnerability mgmt | red | adopt Snyk + monthly scan |
| Vendor mgmt | red | build vendor list + DPAs |
| Incident response | red | runbook needed |
| BCP / DR | red | annual table-top + DR drill |
| Background checks | yellow | Checkr for hires |
| Security training | red | Vanta module |
| Change mgmt | green | PR + CI gate |

## Policy pack status
- 0/25 written (start from Vanta templates)
- Owner: <founder / sec eng>
- Target: complete by <date>

## Effort + cost
| Phase | Duration | Cost | Headcount |
|---|---|--:|---|
| Platform setup + integrations | 4 wk | $15k Vanta Y1 | 0.5 FTE × 1 mo |
| Policy adoption | 4 wk | $0 (templates) | 0.3 FTE × 1 mo |
| Control gap close | 8 wk | $5k tools | 0.5 FTE × 2 mo |
| Type I audit | 4 wk | $25k | 0.3 FTE × 1 mo |
| Continuous monitoring | ongoing | included | 0.1 FTE |
| Type II audit Y2 | 6 mo window | $40k | 0.3 FTE × 6 mo |
| **Y1 total** | **5 mo** | **$45k** | **~0.5 FTE peak** |

## Pipeline justification
- Deals waiting: $<X> ARR
- Cost-per-deal-unblocked: $45k / N deals
- Expected close-rate lift: <Y>%

## Risk if skip
- Enterprise pipeline blocked
- RFPs auto-rejected without report
- Competitors win SOC 2-required deals

## Adjacent paths
- **ISO 27001** — global; longer (12 mo); $80k. Overlap ~70% with SOC 2.
- **HITRUST** — required for HIPAA-heavy. $200k+. Skip unless health.
- **CSA STAR** — cloud-specific; cheap add-on to SOC 2.

## 90-day plan
1. Pick TSC + Type (week 1)
2. Engage auditor + platform (week 2–3)
3. Connect integrations (week 3–4)
4. Adopt policies (week 4–8)
5. Close control gaps (week 8–16)
6. Type I audit fieldwork (week 16–20)
7. Letter received (~week 22)
```

## Verification
- TSC scope explicit (not "all 5").
- Type chosen with rationale.
- Auditor + platform selected with cost.
- Control gap table actionable.
- Pipeline ROI quantified.
