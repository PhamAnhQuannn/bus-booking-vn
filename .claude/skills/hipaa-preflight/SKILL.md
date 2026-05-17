---
name: hipaa-preflight
description: HIPAA scoping for US health data — covered entity vs business associate, BAA, Privacy + Security Rule, breach notification. Outputs to `docs/inception/hipaa-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "HIPAA", "PHI", "health data", "BAA", "/hipaa-preflight", or before serving US healthcare customer.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /hipaa-preflight — HIPAA Pre-scoping

## Why you'd care

HIPAA non-compliance is not a fine — it's a per-record penalty that can reach $1.5M per violation type per year, plus criminal exposure for willful neglect. The pre-flight catches the BAA and covered-entity questions before you handle the first PHI record.

> **Effort estimate caveat:** `XL: 8h` covers *pre-scoping only* (covered-entity scoping, BAA inventory, gap analysis, risk-assessment plan). Full HIPAA implementation is **3–9 months + $30k–$200k** (controls, policies, training, audit, ongoing oversight). The 8h figure is NOT total project effort — multiply by 3–5× when budgeting roadmap.

Invoke as `/hipaa-preflight`. Required for any system touching PHI of US patients.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP (don't touch PHI at XS)
2. Read `docs/inception/regulatory-<project>.md`.

## Inputs
- Do you handle PHI (Protected Health Information)?
- Are you a Covered Entity (CE) or Business Associate (BA)?
- Customers (which CEs you serve).
- Subcontractors (which BAs you use; need BAAs from them).

## Process
1. **Role classification**:
   - **Covered Entity**: providers, health plans, clearinghouses (rare for SaaS)
   - **Business Associate**: SaaS serving CEs that touches PHI (most common)
   - **Conduit exception**: pure pipe (postal, telecom) — NOT BA. Cloud hosting (AWS, GCP) requires BAA, NOT conduit
2. **PHI definition** — 18 identifiers when combined with health info: name, geo <3 ZIP digits, dates, phone, email, SSN, MRN, account #, IP, biometrics, photos, etc.
3. **Three rules**:
   - **Privacy Rule**: minimum necessary; patient rights (access, amendment, accounting of disclosures)
   - **Security Rule**: admin/physical/technical safeguards (encryption, access control, audit logs)
   - **Breach Notification Rule**: 60 days to notify; HHS + media if >500 affected
4. **BAA requirements**:
   - Sign BAA with each CE customer (template from each customer or your own)
   - Sign BAA with each subprocessor that touches PHI (AWS BAA, Stripe BAA add-on, Twilio BAA)
   - HHS provides sample BAA language
5. **Security Rule safeguards** (~50 controls):
   - Admin: workforce training, sanctions, contingency plan
   - Physical: facility access, workstation security, device controls
   - Technical: access control (unique user, auto-logoff), audit logs, integrity, transmission security (encrypt in transit)
   - Encryption is "addressable" not "required" — but de facto required (safe harbor for breach)
6. **HHS OCR enforcement**:
   - Tiered fines: $137–$68,928 per violation; annual max $2.07M (2024 figures, indexed)
   - Audit trigger: complaint, breach >500, random
7. **State law preemption**: HIPAA = floor; state laws can be stricter (CA CMIA, TX HB 300, NY SHIELD, WA My Health My Data 2024)
8. **HITRUST CSF** (optional certification):
   - Bundles HIPAA + ISO + NIST + SOC 2
   - i1 (entry): $50k
   - r2 (full): $200k+
   - 2-year cert; required by some large health customers

## Output
Write `docs/inception/hipaa-<project>.md`:

```markdown
# HIPAA Pre-scope — <project>
**Date:** <YYYY-MM-DD>

## Role
- **Type:** Business Associate
- Rationale: SaaS for clinics/hospitals/practitioners; PHI flows through us
- Subcontractors that touch PHI: AWS, Stripe (limited), Twilio (SMS appointment reminders), Datadog (logs scrubbed)

## PHI scope
- Data types: name, DOB, email, phone, appointment data, clinical notes
- 18-identifier check: 12 of 18 collected
- De-identification opportunity: analytics pipeline → Safe Harbor de-id

## BAA inventory
| Party | Role | BAA status | Notes |
|---|---|:--:|---|
| AWS | hosting | ✓ signed | AWS BAA covers eligible services only |
| Stripe | payment | ✓ signed | Stripe BAA add-on (Health beta) |
| Twilio | SMS | ✓ signed | enable HIPAA-eligible features |
| Datadog | observability | ⚠ pending | scrub PHI from logs pre-send |
| Slack | internal comms | ✗ | no PHI in Slack — train workforce |
| <CE customer A> | customer | ✓ signed | their template |
| <CE customer B> | customer | ⚠ negotiation | their template |

## Security Rule control coverage
| Safeguard | Status |
|---|---|
| Unique user IDs | ✓ Auth.js + UUID |
| Auto-logoff | ✓ 15-min idle session |
| Encryption at rest | ✓ RDS + S3 SSE + KMS |
| Encryption in transit | ✓ TLS 1.3 enforced |
| Audit logs (PHI access) | ⚠ build out — required |
| Backup + recovery | ✓ daily snapshot + cross-region |
| Workforce training | ✗ build curriculum |
| Sanction policy | ✗ draft |
| Risk assessment | ⚠ schedule annual |
| Contingency plan | ✗ draft DR |
| Integrity controls | ✓ tamper-evident logs (planned) |

## Privacy Rule readiness
- [ ] Notice of Privacy Practices (CE responsibility, not BA — but document our role)
- [ ] Access request workflow (BAA passes through to CE; we facilitate)
- [ ] Amendment workflow
- [ ] Accounting of disclosures (6 yrs retained)
- [ ] Minimum-necessary access (RBAC enforced)

## Breach Notification
- Detection: SIEM + tamper-evident audit log
- Investigation runbook: `docs/ops/runbooks/phi-breach.md` (build)
- Notification template (to CE): drafted
- 60-day clock starts at discovery
- HHS reporting if >500 records: required
- Media notification if >500 in one state/jurisdiction: required

## Effort + cost (Y1)
| Activity | Cost | Time |
|---|--:|---|
| Risk assessment (annual) | $10k | 4 wk |
| BAA papering | $5k legal | 2 wk |
| Workforce training (KnowBe4 / SaaS) | $2k/yr | quarterly |
| Audit log buildout | dev time | 4 wk |
| Encryption hardening | dev time | 2 wk |
| Penetration test | $15k | annual |
| Cyber insurance with HIPAA rider | $10k/yr | annual |
| **Total Y1** | **~$45k + dev** | |

## HITRUST decision
- Pursue HITRUST CSF? **No (not yet)** — pursue if customer demand >2 enterprise
- Defer to Y2; foundation = SOC 2 Type II first

## State overlay
- CA CMIA — stricter; consent for many disclosures
- TX HB 300 — broader covered entity definition
- WA MHMD (2024) — non-HIPAA health data; expansive
- NY SHIELD — breach notification + safeguards

## Risk if skip
- HHS fines $137 – $68,928 per violation
- Class action under state laws
- CE customers walk
- Reputational catastrophic

## 90-day plan
1. BAA inventory + close gaps (week 1–4)
2. Risk assessment (week 2–6)
3. Audit log buildout (week 4–10)
4. Workforce training rollout (week 6–8)
5. Breach runbook + tabletop (week 10–12)
6. Schedule annual pen test (week 12)
```

## Verification
- CE vs BA decided.
- BAA inventory complete (upstream + downstream).
- Security Rule control table filled.
- Breach notification runbook referenced.
- State overlay considered.
