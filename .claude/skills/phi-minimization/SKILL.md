---
name: phi-minimization
description: Minimize PHI footprint via minimum-necessary RBAC, de-identification (Safe Harbor 18-identifier removal vs Expert Determination statistical method), data-flow inventory, redaction at log/telemetry layer, and segregation of identified vs. de-identified pipelines. Reads `docs/inception/hipaa-<project>.md`. Writes `docs/design/phi-minimization-<project>.md`. Trigger phrases "PHI minimization", "minimum necessary", "de-identification", "Safe Harbor", "Expert Determination", "redact PHI", "log scrubbing", "data flow inventory", "/phi-minimization", or before building any new feature that touches PHI.
output_size:
  XS: skip
  S: 30m
  M: 2h
  L: 4h
  XL: 6h
---

# /phi-minimization — PHI Minimization & De-identification

Invoke as `/phi-minimization`. Run during design phase per surface/feature that touches PHI. Re-run when adding analytics, ML, or new vendor.

## Why you'd care

Every byte of PHI you collect is a byte you have to defend, encrypt, audit, retain, and breach-notify on. Minimizing the footprint up-front cuts your HIPAA surface area and your insurance premium.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS/S → SKIP.
2. Read `docs/inception/hipaa-<project>.md` (role, PHI scope).
3. Read `docs/design/data-model-<project>.md` if exists.

## Inputs
- Surfaces touching PHI (UI screens, API endpoints, jobs, ML models, dashboards).
- Workforce roles and what each role needs to do their job.
- Sub-BAs receiving data (Datadog logs, Sentry errors, analytics, LLMs, email).
- Analytics / BI / ML use cases (do you need identified data, or will de-identified work?).
- Retention windows by data class.

## Process
1. **Data classification ladder** (most → least restricted):
   - **PHI-identified**: 18 HIPAA identifiers + clinical data. Highest restriction.
   - **PHI-limited dataset (LDS)**: 16/18 removed (keep dates + geo > town); permitted with Data Use Agreement (DUA) for research/public-health/operations.
   - **De-identified (Safe Harbor)**: all 18 identifiers removed (164.514(b)(2)); no actual knowledge that remaining info could re-identify. Not PHI; unrestricted.
   - **De-identified (Expert Determination)**: statistical/scientific method by qualified expert; "very small" re-id risk (164.514(b)(1)). Documented method + qualifications.
   - **Aggregate/anonymous**: counts, rates only. Lowest risk.
2. **Minimum-necessary** (164.502(b)) — for each workforce role and each surface:
   - What's the minimum PHI required to do this task?
   - Enforce via RBAC + attribute-based access (ABAC) on patient panel.
   - Break-glass: just-in-time access with audit + manager review.
   - Default deny.
3. **Safe Harbor 18-identifier checklist** (164.514(b)(2)(i)):
   1. Names
   2. Geographic subdivisions smaller than state (ZIP — keep first 3 digits if combined pop. >20,000; otherwise drop ZIP)
   3. All elements of dates (except year) for dates related to individual; ages >89 → "90+"
   4. Phone numbers
   5. Fax numbers
   6. Email addresses
   7. Social Security numbers
   8. Medical record numbers
   9. Health plan beneficiary numbers
   10. Account numbers
   11. Certificate/license numbers
   12. Vehicle identifiers (VIN, plates)
   13. Device identifiers and serial numbers
   14. Web URLs
   15. IP addresses
   16. Biometric identifiers (finger, voice prints)
   17. Full-face photographs and comparable images
   18. Any other unique identifying number, characteristic, or code (e.g., username, study ID linked to identity)
   - PLUS "no actual knowledge" the remaining info could re-identify.
4. **Expert Determination path** — when Safe Harbor too lossy for analytics:
   - Engage qualified statistician/CIPP-P (Privacy Analytics, Datavant, Mirador, internal PhD).
   - Apply k-anonymity (k≥5), l-diversity, t-closeness, or differential privacy.
   - Document method, parameters, residual risk, expert credentials.
   - Re-certify ≥ every 2 years or on material data change.
   - Cost: $20k–$80k initial; $5k–$20k recert.
5. **Data-flow inventory** — map every place PHI lives and moves:
   - Source → store → process → egress → retention → destruction.
   - Identify which flows are identified vs. LDS vs. de-id.
   - Identify each sub-BA touching each flow.
6. **Log/telemetry redaction** — most leaks happen here:
   - Application logs: scrub PHI before write (allowlist fields, not blocklist).
   - Error tracking (Sentry): scrub at SDK; configure `beforeSend`; never send request bodies wholesale.
   - APM (Datadog, New Relic): no PHI in span attributes, log lines, or trace tags. Use opaque IDs.
   - LLM prompts: review every prompt template; redact PHI or use de-identified data; pin model to BAA-covered provider (Azure OpenAI, OpenAI ZDR, Anthropic Enterprise).
   - Analytics (Mixpanel, Amplitude, PostHog): never send PHI as event properties. Use de-identified user_id + non-PHI behavioral properties only.
7. **Segregation pattern**:
   - Identified DB (Postgres, encrypted, narrow access).
   - De-id warehouse (BigQuery/Snowflake/Redshift) for analytics + ML.
   - One-way ETL: identified → de-id (Safe Harbor or Expert Determination). Never reverse.
   - Tokenization layer if re-id needed for narrow ops use (keep token vault separate, RBAC'd).
8. **LLM/AI considerations** (2024–2026):
   - Treat LLM API calls like sub-BA: requires BAA (Azure OpenAI, OpenAI Enterprise/ZDR, Anthropic Enterprise).
   - Default to de-id input; only send identified PHI when clinically necessary AND BAA in place AND model output retention controlled.
   - No training on PHI without explicit patient authorization (164.508) or de-id.
   - Document each LLM use case in this artifact.
9. **Retention & destruction**:
   - Set retention per data class. Identified PHI: shortest necessary (clinical varies — often 7–10 yrs adult, 21+ yrs minors per state law).
   - Automated purge jobs; verify with audit log; quarterly attestation.
10. **Break-glass + audit**:
    - Just-in-time elevation requires reason + manager approval + automatic audit log entry + scheduled review.
    - Patient-access audit: every PHI read logged with who/what/when/why.

## Output
Write `docs/design/phi-minimization-<project>.md`:

```markdown
# PHI Minimization — <project>
**Date:** <YYYY-MM-DD>
**Owner:** <Privacy Officer>

## Data classification ladder
| Class | Definition | Examples | Restrictions |
|---|---|---|---|
| PHI-identified | 18 IDs + clinical | EHR record, lab result, appt note | RBAC strict; encrypted; audit every access; min-necessary |
| LDS | 16/18 removed (keep dates + geo>town) | research extract | DUA required; restricted use |
| De-id (Safe Harbor) | 18 removed | aggregate dashboard, ML training set | not PHI; unrestricted |
| De-id (Expert Determination) | statistical method | k≥5 cohort export | not PHI; recert 2 yrs |
| Aggregate | counts/rates | exec dashboard | unrestricted |

## Minimum-necessary RBAC matrix
| Role | PHI scope | Justification | Break-glass? |
|---|---|---|---|
| Patient | own records only | individual access right | n/a |
| Provider (treating) | assigned panel + on-call escalation | treatment | yes — JIT + audit |
| Nurse / MA | assigned panel | treatment support | yes |
| Front-desk | demographics + appt; NO clinical notes | scheduling | yes (narrow) |
| Billing | demographics + dx codes + claims; NO clinical notes | billing | no |
| Care coordinator | assigned panel | care coordination (164.506) | yes |
| Engineer (prod) | NONE in normal ops | n/a | yes — JIT, 15-min TTL, dual control, audited |
| Engineer (staging/dev) | synthetic data only | dev | n/a |
| Analytics | de-id only | analytics | escalation = DUA + Expert Det |
| ML / Data Science | de-id only | model training | escalation = DUA |
| Customer Support | view assigned tickets only | support | yes — narrow |
| Workforce admin | none (no PHI in HR systems) | n/a | n/a |
| Sub-BA (AWS, Stripe, Twilio, Datadog) | scoped per BAA | service delivery | n/a |

## Safe Harbor 18-identifier removal — pipeline
| # | Identifier | Removal method |
|---|---|---|
| 1 | Names | drop |
| 2 | Geo < state | ZIP3 if pop>20k else drop ZIP |
| 3 | Dates (except year) | year only; age 90+ collapsed |
| 4 | Phone | drop |
| 5 | Fax | drop |
| 6 | Email | drop |
| 7 | SSN | drop |
| 8 | MRN | replaced with opaque token (token vault separate) |
| 9 | Health plan beneficiary # | drop |
| 10 | Account # | drop |
| 11 | Certificate/license # | drop |
| 12 | Vehicle ID | drop |
| 13 | Device ID/serial | drop |
| 14 | URLs | drop |
| 15 | IP | drop |
| 16 | Biometrics | drop |
| 17 | Full-face photos | drop |
| 18 | Other unique IDs | review case-by-case; opaque token |

Pipeline:
- Source: prod Postgres (identified) → nightly ETL → de-id Snowflake.
- ETL job: `etl/de_id_safe_harbor.py` runs the 18-identifier transform; unit-tested; output sampled + reviewed quarterly.
- Token vault (for MRN→token): separate KMS-encrypted store; access logged; key rotation 90 d.

## Expert Determination path (for cases Safe Harbor is too lossy)
- Use case: outcomes research requires admit/discharge dates.
- Expert: <name>, PhD biostatistics, CIPP/US.
- Method: k-anonymity k=5 + l-diversity on diagnosis; differential privacy ε=1.0 on aggregate counts.
- Residual risk: documented "very small"; report in `docs/legal/expert-determination-<YYYY>.pdf`.
- Recertification: <YYYY+2>-MM-DD.

## Data-flow inventory
| Flow | Source | Process | Destination | Class | Sub-BA |
|---|---|---|---|---|---|
| Patient registration | Web form | Auth API | Postgres `patient` | identified | AWS |
| Appointment booking | Mobile app | Booking API | Postgres `appointment` | identified | AWS, Twilio (SMS reminder) |
| SMS reminder | Job runner | Twilio API | Patient phone | identified (limited: first name + appt time + clinic name) | Twilio |
| Clinical note | Provider UI | EHR API | Postgres `note` | identified | AWS |
| Billing claim | Billing job | Clearinghouse SFTP | Payer | identified | Clearinghouse (Change Healthcare/Availity) |
| Email receipt | Job runner | SendGrid API | Patient email | limited (no clinical) | SendGrid |
| Error tracking | App | Sentry SDK (scrubbed) | Sentry | de-id (scrubbed) | Sentry (BAA) |
| App logs | App | Datadog agent (scrubbed) | Datadog | de-id (scrubbed) | Datadog (BAA) |
| Product analytics | App | Segment + Mixpanel | Mixpanel | de-id | Mixpanel (no PHI by policy) |
| ML training | Snowflake de-id | Notebook | Model registry | de-id | AWS |
| LLM clinical summarization | App | Azure OpenAI (BAA) | App response | identified | Azure OpenAI (BAA) |

## Log/telemetry redaction
- **App logs**: allowlist serializer (`safeLog({ patient_id_token, action, latency_ms })`). No request bodies, no headers w/ auth, no email/phone/name/MRN.
- **Sentry**: `beforeSend` hook scrubs `request.data`, `extra`, breadcrumbs; PII detection rules enabled in Sentry project.
- **Datadog**: agent-side scrubbing rules for SSN/email/phone regex; span attributes whitelisted; no `user.email` tag.
- **LLM prompts**: prompt templates reviewed quarterly; PHI flagged with `<PHI>` wrappers; redaction layer before send if non-BAA model.
- **Analytics**: Segment + Mixpanel never receive PHI; event schema enforced in code (typed event constructors); QA test confirms no PHI fields.

## LLM/AI use cases
| Use case | Identified or de-id? | Model | BAA? | Retention |
|---|---|---|---|---|
| Clinical note summarization | identified | Azure OpenAI gpt-4o | ✓ | 0d (ZDR) |
| Patient chatbot triage | identified | Anthropic Claude (Enterprise) | ✓ | 0d |
| Aggregate insights | de-id | OpenAI gpt-4o-mini | ✓ ZDR | 0d |
| ML readmission predictor | de-id | in-house XGBoost | n/a | n/a |

## Retention & destruction
| Class | Retention | Destruction method |
|---|---|---|
| Clinical record (adult) | 7 yrs (or per state) | crypto-shred (KMS key destruction) |
| Clinical record (minor) | until age 21+state | crypto-shred |
| Audit log | 6 yrs | crypto-shred |
| Backup (encrypted) | 90 d rolling | overwrite + KMS key roll |
| App log (de-id) | 30 d | TTL |
| Sentry / Datadog | per vendor | per vendor |
| Email (transactional) | 90 d | mailbox purge |

## Break-glass + audit
- JIT engineer access: 15-min TTL, dual approval, manager review weekly.
- Patient-access audit: every PHI read → audit log (who, what record, when, why).
- Anomaly detection: > N reads in M minutes, or off-hours, or unfamiliar IP → alert.
- Quarterly review of break-glass events by Privacy Officer.

## Verification gates
- [ ] Every surface ran through this skill.
- [ ] Every log/telemetry endpoint scrubbed (allowlist).
- [ ] Every LLM call: BAA in place OR de-id input.
- [ ] Min-necessary RBAC enforced and tested (denial test cases in CI).
- [ ] Safe Harbor pipeline tested with synthetic + sampled real data; output reviewed.
- [ ] Expert Determination recertification date on calendar.

## Risk if skip
- HHS OCR fines for impermissible disclosure: $137–$68,928 per violation; annual cap $2.07M.
- Most common breach root cause is over-disclosure / over-collection — minimization is the cheapest control.
- State law overlay (CA CMIA) — statutory damages even without HHS action.
- LLM/analytics leaks = particularly high-profile (post-2024 enforcement focus on AI vendors).
```

## Verification
- 18-identifier Safe Harbor checklist applied or Expert Determination documented.
- Data-flow inventory covers every surface.
- Min-necessary RBAC matrix per role.
- Log/Sentry/Datadog/LLM/analytics redaction rules concrete.
- Retention + destruction defined per class.
- Break-glass + audit defined.
- LLM use cases enumerated with BAA status.
