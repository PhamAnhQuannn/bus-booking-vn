---
name: records-retention-pre
description: Pre-build records retention schedule per data category — GDPR Article 5(1)(e), tax, AML, employment, sector. Outputs to `docs/inception/retention-pre-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "retention", "records retention", "data deletion schedule", "/records-retention-pre", or before ROPA / before any retention build.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /records-retention-pre — Records Retention Pre-scope

Invoke as `/records-retention-pre`. Storage limitation principle (GDPR Art 5(1)(e)) + sector minimums (tax, AML, employment, health). Maps each data category to retention period, deletion mechanism, and legal hold exceptions.

## Why you'd care

"We keep everything forever" violates GDPR Article 5(1)(e), inflates your breach blast radius, and turns subpoenas into year-long discovery exercises. A retention schedule per data category is non-negotiable for any data-handling product.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP
2. Read `docs/inception/gdpr-<project>.md`.
3. Read `docs/inception/lawful-basis-<project>.md`.
4. Read `docs/inception/regulatory-<project>.md`.

## Inputs
- Data categories per processing activity (PII, financial, health, employment, security, marketing).
- Customer geography (jurisdictional minimums vary).
- Sector (financial, health, public sector — sector-specific minimums).
- Backup retention window (often longer than primary).

## Process
1. **Storage limitation principle (Art 5(1)(e))**:
   - Keep no longer than necessary for purpose
   - Anonymize when no longer needed but useful for stats
   - Document retention rationale per category
2. **Statutory minimums (EU/UK examples)**:
   - **Tax (invoices, receipts)** — 6 yr UK / 10 yr DE / 7 yr FR / 5 yr IE
   - **AML (KYC records)** — 5 yr post-relationship-end (6th AML Directive)
   - **Employment** — varies; payroll 6 yr UK/3 yr DE; pensions 75 yr; H&S 40 yr
   - **Medical (UK NHS)** — adult records 8 yr post-discharge / minor until age 25 / mental health 20 yr
   - **Health (HIPAA US)** — 6 yr; some states extend
   - **Telco metadata** — varies by MS; ePrivacy + national security
   - **CCTV** — 30 days typical; case-by-case justified
3. **Statutory maximums (delete-by deadlines)**:
   - **Job applicant rejected** — typically 6 mo (consent for longer talent pool)
   - **Marketing consent** — re-confirm 24 mo if dormant (ICO guidance)
   - **Cookies** — session vs persistent; document each
4. **Active vs archive vs backup**:
   - **Active** — primary DB, accessible
   - **Archive** — cold storage, restricted access, still retrievable for SAR
   - **Backup** — disaster recovery only; NOT for SAR/erasure (document this)
   - Backup rotation must purge expired data eventually (e.g., 35-day rolling)
5. **Erasure mechanisms**:
   - **Hard delete** — row purged
   - **Soft delete + scheduled hard delete** — typical 30-day grace
   - **Anonymization** — strip identifiers, keep aggregate
   - **Pseudonymization** — reversible only with separate key
   - **Cryptographic erasure** — destroy key (for encrypted backup tape)
6. **Legal hold exception**:
   - Litigation hold suspends retention deletion
   - Tax audit hold (until audit closed)
   - Regulatory investigation hold
   - Document hold trigger + release procedure
7. **Per-category schedule design**:
   - Category → purpose → basis → trigger event → retention period → mechanism → owner
   - Trigger event examples: account closed, last login, contract end, transaction date, application rejection
8. **Automated deletion**:
   - Cron / scheduled job with idempotent purge
   - Audit log of what was deleted (proof of compliance)
   - Test in staging quarterly
9. **Backup retention statement** (privacy notice):
   - "Data may persist in encrypted backups for up to 35 days post-deletion request"
   - GDPR-acceptable per EDPB if documented + non-restorable

## Output
Write `docs/inception/retention-pre-<project>.md`:

```markdown
# Records Retention Pre-scope — <project>
**Date:** <YYYY-MM-DD>

## Principles
- Storage limitation: GDPR Art 5(1)(e) — minimum necessary
- Sector minimums applied: tax, AML, employment
- Backup window: 35-day rolling encrypted; cryptographic erasure on expiry
- Legal hold: suspend deletion when litigation/audit triggered

## Per-category schedule
| Category | Purpose | Trigger event | Retention | Mechanism | Statutory basis | Owner |
|---|---|---|---|---|---|---|
| Account profile | service delivery | account closed | 30 d soft + hard delete | scheduled job | none | Eng |
| Email/password | auth | account closed | 30 d soft + hard delete | scheduled job | none | Eng |
| Marketing consent log | proof of consent | consent withdrawn | withdrawal + 6 yr | append-only log | proof under GDPR | DPO |
| Marketing email content | nurture | last open / 24 mo dormant | 24 mo | scheduled job | ICO guidance | Marketing |
| Product analytics events | service improvement | event timestamp | 14 mo | rollup + raw delete | GA4 default | Eng |
| Crash telemetry | reliability | event timestamp | 90 d | Sentry default | none | Eng |
| Support ticket | service delivery | resolution + 3 yr | 3 yr | scheduled job | limitation period | Support |
| Support call recording | quality + training | recording date | 6 mo | scheduled job | proportionate | Support |
| Invoice / receipt | tax compliance | transaction date | 7 yr (10 yr DE) | archive immutable | tax law | Finance |
| Payment metadata | fraud + tax | transaction date | 7 yr | archive immutable | tax + AML | Finance |
| KYC / sanctions screening | AML compliance | relationship end + 5 yr | 5 yr | archive | 6th AML Directive | Compliance |
| Job applicant CV (rejected) | hire decision | rejection + 6 mo | 6 mo | scheduled job | Art 5(1)(c) | HR |
| Job applicant CV (talent pool) | future hire | consent + 24 mo | 24 mo | re-consent flow | consent | HR |
| Employee payroll | tax + employment | termination + 6 yr | 6 yr | archive | employment law | HR |
| Employee H&S | regulatory | end of employment + 40 yr | 40 yr | archive | UK COSHH | HR |
| Audit log (security) | breach detection + forensic | event date | 12 mo hot / 7 yr cold | SIEM + archive | varies | Security |
| CCTV | premises security | recording date | 30 d | overwrite ring | proportionate | Facilities |
| Cookies (analytics) | analytics consent | session / 13 mo | per-cookie table | CMP + browser | ePrivacy | Eng |
| Backup snapshots | DR | snapshot date | 35 d rolling | KMS key destroy on expiry | DR policy | Eng |

## Erasure mechanisms
| Mechanism | Use case | SAR-honored? |
|---|---|:--:|
| Hard delete | active DB rows | ✓ |
| Soft delete + 30 d hard | account closure | ✓ after 30 d |
| Anonymization | analytics rollup | ✓ |
| Pseudonymization | research dataset | ⚠ key must be destroyed for true erasure |
| Cryptographic erasure | encrypted backups | ✓ on key destroy |

## Legal hold procedure
- Trigger: litigation notice / regulator subpoena / tax audit
- Log: who set, when, scope (categories + accounts), expected end
- Effect: suspend automated deletion for in-scope data; flag in DB
- Release: legal sign-off → resume deletion + log release
- Tooling: hold table; cron checks before delete

## Privacy notice statements
- "We retain account data for the duration of your account and for up to 30 days after account closure to allow recovery."
- "Invoices and tax records are retained for 7 years per UK tax law / 10 years per DE GoBD."
- "Backup copies may persist for up to 35 days after deletion request; backups are encrypted and not used for restoration of individual records."
- "Marketing consent records are retained for 6 years to evidence valid consent."

## Automated deletion job
- Path: `scripts/retention-prune.ts`
- Schedule: nightly 02:00 UTC
- Idempotent: checks legal-hold table per row pre-delete
- Audit: writes count + category to deletion log
- Alert on failure: PagerDuty
- Quarterly test in staging

## Backup compliance statement
- Backup retention: 35-day rolling
- Storage: S3 with KMS-encrypted key per snapshot
- Erasure: KMS key destroyed on snapshot expiry → cryptographic erasure
- DR-only access: documented; no SAR fulfillment from backup
- GDPR acceptable per EDPB Guidelines 02/2021

## Effort + cost
| Activity | Cost |
|---|--:|
| Schedule design + legal review | $5k legal |
| Retention job build | dev time (~1 wk) |
| Audit log + legal hold table | dev time (~3 d) |
| Quarterly test | included |
| Privacy notice update | $1k legal |
| **Total Y1** | **~$6k + dev** |

## Risk if skipped
- Over-retention = breach of Art 5(1)(e) = €20M / 4% fine
- Under-retention vs tax/AML = sector fines + criminal in some MS
- No legal hold = spoliation in litigation
- SAR cannot be fulfilled = €20M / 4% fine
- Insurance deny on breach if no retention discipline

## Verification
- Every PII category has a row in schedule
- Trigger event named per row
- Retention period justified (statutory or proportionate)
- Erasure mechanism named
- Legal hold procedure documented
- Backup statement aligned with privacy notice

## 90-day plan
1. Inventory categories from PII inventory + ROPA (week 1–2)
2. Apply statutory minimums per jurisdiction (week 2–3)
3. Design erasure mechanism per category (week 3–4)
4. Build retention job + legal hold table (week 4–6)
5. Privacy notice update + legal review (week 6–7)
6. Staging dry-run + audit log test (week 8)
7. Production rollout with monitoring (week 9)
8. Quarterly review calendar (week 12)
```

## Verification
- Per-category schedule complete with statutory bases.
- Backup retention statement + cryptographic erasure documented.
- Legal hold procedure named.
- Automated deletion job specified.
- Privacy notice statements drafted.
