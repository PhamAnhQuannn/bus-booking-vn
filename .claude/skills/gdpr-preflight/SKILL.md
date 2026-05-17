---
name: gdpr-preflight
description: GDPR + UK GDPR scoping — controller vs processor, lawful basis, DPO, DPIA, transfers, fines. Outputs to `docs/inception/gdpr-<project>.md`. Reads `/project-classify` to skip XS. For M-class PII-heavy data-SaaS, run in PARALLEL with `/problem-validation`, not after — GDPR deal-killers should fire BEFORE customer-validation effort. Use when user says "GDPR", "EU privacy", "DPO", "DPA", "/gdpr-preflight", or before serving EU/UK person data.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /gdpr-preflight — GDPR Pre-scoping

## Why you'd care

GDPR fines are 4% of global turnover and the regulator doesn't care that you're a startup; missing the controller/processor split or the lawful basis is enough to blow up an EU launch. The pre-flight catches the deal-killers before you commit to the market.

Invoke as `/gdpr-preflight`. Triggered by ANY EU/UK person data, regardless of company location.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP (no users yet)
2. Read `docs/inception/regulatory-<project>.md`.

## Inputs
- EU/EEA/UK customers or users (any).
- Controller (you decide purpose) or Processor (you process for a controller)?
- Data categories (regular, special, criminal).
- Transfers to non-adequate countries (US, India, etc.).
- Headcount (DPO trigger at 250 employees or core monitoring).

## Process
1. **Territorial scope (Article 3)**:
   - Established in EU → applies
   - Offering goods/services to EU persons → applies
   - Monitoring EU persons (analytics, profiling) → applies
   - **No EU office is no exemption**
2. **Role classification**:
   - **Controller** — decides purposes + means
   - **Processor** — processes on controller instructions
   - **Joint controllers** — must have arrangement
3. **6 lawful bases (Article 6)**:
   - Consent
   - Contract necessity
   - Legal obligation
   - Vital interests
   - Public interest / official authority
   - Legitimate interests (need balancing test)
4. **Special category data (Article 9)** — health, race, religion, biometrics, sexual orientation, union membership, political — needs additional Article 9(2) basis (explicit consent typical)
5. **Data subject rights** (must support all):
   - Access (DSAR — 1 month, extendable +2)
   - Rectification
   - Erasure ("right to be forgotten")
   - Restriction
   - Portability
   - Object
   - Not subject to automated decision-making
6. **DPO requirement** (Article 37):
   - Public authority → required
   - Core large-scale monitoring → required
   - Core large-scale special category processing → required
   - Otherwise voluntary; can be external (fractional DPO ~$10-30k/yr)
7. **DPIA** (Article 35) when:
   - Systematic + extensive evaluation including profiling
   - Large-scale special category data
   - Systematic monitoring of public area
   - List of mandatory DPIA cases per supervisory authority
8. **International transfers** (Chapter V):
   - **Adequacy decision** — UK, Switzerland, Canada (commercial), Japan, NZ, etc.
   - **SCCs** (2021 modules) — for non-adequate; needs TIA (Transfer Impact Assessment)
   - **EU-US Data Privacy Framework** (2023) — replaces Privacy Shield; Schrems III risk lurking
   - **BCRs** — for intra-group
9. **Records of Processing** (Article 30) — required if ≥250 employees or non-occasional processing
10. **Breach notification** — 72hr to supervisory authority; without undue delay to affected
11. **Fines** — up to €20M or 4% global revenue (greater)
12. **DPF / DPA / SCCs paperwork** required with each processor

## Output
Write `docs/inception/gdpr-<project>.md`:

```markdown
# GDPR Pre-scope — <project>
**Date:** <YYYY-MM-DD>

## Territorial scope
- EU/EEA users: yes (DE, FR, IT, ES priority markets)
- UK users: yes (UK GDPR + DPA 2018 mirrors)
- Switzerland: revFADP (similar to GDPR)
- Verdict: **GDPR applies**

## Role
- **Controller** for: customer accounts, marketing data
- **Processor** for: data clients upload to platform on their behalf
- Joint controller relationships: none

## Lawful basis per processing
| Processing | Basis | Documentation |
|---|---|---|
| Account creation | Contract | ToS Art 6(1)(b) |
| Marketing emails | Consent | opt-in checkbox + record |
| Product analytics | Legitimate interest | LIA documented |
| Crash telemetry | Legitimate interest | LIA documented |
| Customer payment | Contract + legal obligation | tax retention |
| Support recordings | Consent | banner pre-call |

## Special category data
- Collected: NONE (planned)
- If health features added: explicit consent + additional safeguards

## Subject rights workflow
| Right | SLA | Owner | Tooling |
|---|---|---|---|
| Access (DSAR) | 30 d | DPO | self-serve `/account/export` |
| Rectification | 30 d | Support | account settings |
| Erasure | 30 d | DPO | `/account/delete` + soft-delete + 30d hard-delete cron |
| Portability | 30 d | DPO | JSON export endpoint |
| Object | 30 d | DPO | unsubscribe link + email queue |
| Auto-decision | n/a | — | no auto-decisioning |

## DPO
- **Required?** No (no large-scale monitoring or special category)
- **Voluntary?** Yes — appoint fractional external DPO once EU pipeline >$500k ARR
- Vendor: <Aphaia / GRCI Law / DPO Centre>
- Cost: $15k/yr

## DPIA candidates
- Behavior tracking + profiling — DPIA required (drafted: yes/no)
- New AI feature — re-DPIA per system
- Public-area monitoring — n/a
- Template: ICO/CNIL DPIA template

## Transfers
| Destination | Mechanism | Notes |
|---|---|---|
| US (AWS us-east-1) | DPF (Vercel/AWS DPF-listed) + SCCs fallback | TIA done |
| India (support vendor) | SCCs + supplementary measures | review annually |
| UK | adequacy | covered |

## Records of Processing (Article 30)
- Build ROPA spreadsheet (or Vanta/Drata module)
- Per-processing-activity row: purpose, basis, categories, recipients, transfers, retention, security
- Owner: DPO / founder

## Breach plan
- Detection: SIEM + audit log alerts
- 72hr clock starts at awareness
- Notification template: drafted → ICO/CNIL/Garante portals
- Affected user notification: drafted

## Effort + cost (Y1)
| Activity | Cost |
|---|--:|
| Privacy program build (consultant) | $15k |
| Cookie banner + CMP (OneTrust/Cookiebot) | $3k/yr |
| ROPA + DPIA tooling | included in Vanta |
| External DPO (fractional) | $15k/yr |
| Legal review (DPA, ToS) | $5k |
| **Total Y1** | **~$38k** |

## Cookie + tracking compliance
- Banner: required per ePrivacy Directive (cookies = consent before set)
- CMP vendor: <Cookiebot / OneTrust / Iubenda>
- Categories: strictly necessary (no opt) / preferences / analytics / marketing
- Granular toggles + reject-all = OK with French / German / Italian DPAs

## Adjacent regimes (companion skills)
- `/lawful-basis-mapping` — per-processing detailed map
- `/dsar-process-pre` — DSAR runbook design
- `/records-retention-pre` — Article 5(1)(e) storage limitation
- `/consent-architecture-pre` — consent capture architecture

## Risk if skip
- €20M or 4% global revenue fine
- Class action under collective-redress directive (2023)
- noyb / consumer org complaints
- Customer churn (B2B EU-led RFPs require GDPR posture)

## 90-day plan
1. Lawful basis per processing inventory (week 1–2)
2. ROPA build (week 2–4)
3. DSAR/erasure runbook + endpoints (week 4–6)
4. Cookie CMP rollout (week 5–6)
5. DPA + SCC papering with subprocessors (week 6–8)
6. Breach runbook + tabletop (week 9)
7. DPIA on profiling features (week 10–12)
8. External DPO appointed (week 12)
```

## Verification
- Territorial scope decided.
- Lawful basis per processing.
- Subject rights workflow named with SLA.
- Transfer mechanism per destination.
- Breach plan referenced.
- DPO decision made.
