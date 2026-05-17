---
name: pii-inventory-pre
description: Pre-build PII / personal data inventory — categories, sensitivity tier, lawful basis, retention, processors, cross-border. Outputs to `docs/inception/pii-inventory-<project>.md`. Reads `/project-classify` to skip XS. For M-class PII-heavy data-SaaS, run in PARALLEL with `/problem-validation`, not after — privacy deal-killers should fire BEFORE customer-validation effort. Use when user says "PII", "personal data", "ROPA", "GDPR Article 30", "data inventory", "/pii-inventory-pre", or before any data collection design.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /pii-inventory-pre — Pre-build PII Inventory

Invoke as `/pii-inventory-pre`. Anticipate every personal-data field before schema lands. Distinct from runtime `pii-inventory` (which audits live code). Feeds ROPA, privacy policy, retention policy, DPIA.

## Why you'd care

GDPR Article 30 says you must maintain a record of processing activities — not eventually, but on day one of collection. Building the inventory after launch means retrofitting it into a system that already leaks data through nine integrations.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP (no PII expected)
2. Read `docs/inception/regulatory-<project>.md` for jurisdiction triggers.
3. Read `docs/inception/jtbd-<project>.md` + `docs/inception/write-a-prd-<project>.md` for use-case context.

## Inputs
- Product use cases (signup, profile, payment, support, analytics).
- Customer geographies (EU / UK / US-state / APAC / LATAM).
- B2C vs B2B (B2B reduces PII surface).
- Sensitive categories (health, biometric, kids, financial).

## Process
1. **PII categories** (GDPR Art 4 + CCPA + LGPD):
   - **Identifiers**: name, email, phone, address, IP, cookie ID, device ID, account ID
   - **Government IDs**: SSN, passport, driver's license, NIN, TIN
   - **Financial**: card PAN, IBAN, bank account, tax ID
   - **Sensitive (special category)**: health, biometric, genetic, race, religion, union, political, sex life, sexual orientation
   - **Children's data** (under-13 US COPPA / under-16 EU)
   - **Behavioral**: clickstream, location, search history, communications content
   - **Inferred / derived**: scores, segments, predictions
2. **Sensitivity tier** (per `/data-classification-scheme`):
   - **Public** — name in directory
   - **Internal** — username, account ID
   - **Confidential** — email, phone, address
   - **Restricted** — SSN, payment, health, biometric, kids
3. **Lawful basis (GDPR Art 6)** per field:
   - Consent / Contract / Legal obligation / Vital interest / Public task / Legitimate interest
   - Special category requires Art 9 basis (explicit consent / employment / vital / public health / etc.)
4. **Collection point** (where field enters system):
   - Signup form / profile edit / OAuth provider / payment / support ticket / API import / cookie / device
5. **Storage location**:
   - Primary DB (table.column) / cache / search index / data warehouse / object store / backup / log
6. **Processors / sub-processors**:
   - Auth (Auth0 / Clerk / Cognito) / payment (Stripe) / email (Resend) / analytics (PostHog) / support (Zendesk) / observability (Datadog)
   - Each sub-processor needs DPA + cross-border review
7. **Cross-border transfer**:
   - SCCs (EU 2021/914) / UK IDTA / Adequacy decision / BCRs
   - Schrems II transfer impact assessment per US processor
8. **Retention** (per `/records-retention-pre`):
   - Active / Archived / Anonymized / Deleted
   - Per-field retention beats blanket policy
9. **DPIA trigger** (GDPR Art 35):
   - Large-scale special category / systematic monitoring / automated decisions / kids
   - Trigger → run DPIA pre-build
10. **Subject rights mapping** (per `/dsar-process-pre`):
    - Access / Rectification / Erasure / Portability / Restriction / Object / Automated decision review
    - Per-field deletability flag

## Output
Write `docs/inception/pii-inventory-<project>.md`:

```markdown
# PII Inventory (Pre-build) — <project>
**Date:** <YYYY-MM-DD>

## Scope
- Product: B2C SaaS, EU + US users
- Lawful basis dominant: Contract (service delivery) + Consent (marketing)
- DPIA required: yes (behavioral profiling at scale)

## PII inventory
| Field | Category | Tier | Source | Storage | Processor | Lawful basis | Retention | Subject rights | Cross-border |
|---|---|---|---|---|---|---|---|---|---|
| email | Identifier | Confidential | signup form | users.email | Auth0, Resend | Contract | account+30d post-delete | A/R/E/P | EU→US SCC |
| name | Identifier | Confidential | signup | users.name | Auth0 | Contract | account+30d | A/R/E/P | EU→US SCC |
| phone | Identifier | Confidential | profile | users.phone | Twilio | Consent | until withdrawn | A/R/E/P | EU→US SCC |
| address | Identifier | Confidential | checkout | orders.ship_addr | Stripe, ShipBob | Contract | 7yr tax | A/R/E | EU→US SCC |
| card PAN | Financial | Restricted (PCI) | checkout | (tokenized via Stripe) | Stripe | Contract | per Stripe | A only | EU→US SCC |
| IP | Identifier | Confidential | every request | logs (90d) | Datadog | Legitimate interest (security) | 90d | E (after 90d auto) | EU→US SCC |
| cookie ID | Identifier | Internal | landing | analytics_events | PostHog | Consent (analytics cookie) | 13mo | A/E | EU→US SCC |
| location (coarse) | Behavioral | Confidential | IP geo | events.country | PostHog | Legitimate interest | 13mo | A/E | EU→US SCC |
| support ticket body | Communication | Confidential (may contain anything) | support form | Zendesk | Zendesk | Contract | 3yr | A/R/E | EU→US SCC |
| profile photo | Identifier | Confidential | profile | S3 + signed URL | AWS | Consent | account+30d | A/E | EU→US SCC |
| date of birth | Identifier (age-gate) | Confidential | signup (if asked) | users.dob | — | Legitimate interest (age 16+ check) | account life | A/R/E | n/a |

## Special category (Art 9) — none in v1
- v1: NO health, biometric, genetic, race, religion, sex-life data
- v2 plan: if telemed feature → trigger DPIA + HIPAA preflight

## Children's data
- Age-gate at 16+ (EU GDPR Art 8 default)
- Under-16 → block account creation
- COPPA (US under-13) screened by same gate
- No marketing to <16

## Sub-processor list (DPA required)
| Processor | Purpose | Region | DPA signed | SCCs | Schrems II TIA |
|---|---|---|---|---|---|
| Auth0 (Okta) | identity | US | ✓ | ✓ | ✓ |
| Stripe | payment | US | ✓ | ✓ | ✓ |
| Resend | transactional email | US | ✓ | ✓ | ✓ |
| Twilio | SMS | US | ✓ | ✓ | ✓ |
| PostHog | analytics (EU instance) | EU | ✓ | n/a | n/a |
| Zendesk | support | US | ✓ | ✓ | ✓ |
| Datadog | observability | US | ✓ | ✓ | ✓ |
| AWS | infra | EU (eu-west-1) primary | ✓ | for US support staff | ✓ |
| ShipBob | fulfillment | US | ✓ | ✓ | ✓ |

## Cross-border posture
- Primary residence: EU (eu-west-1)
- US sub-processors: SCCs 2021/914 module 2 (controller-to-processor)
- Schrems II TIA per US processor (FISA 702 risk)
- UK users: UK IDTA addendum

## Retention summary (feeds /records-retention-pre)
| Class | Period | Destruction method |
|---|---|---|
| Active account data | account life + 30d | hard-delete + Stripe tokenize remains |
| Order / tax | 7 yr | archive cold S3, then hard-delete |
| Support tickets | 3 yr | Zendesk auto-purge |
| Analytics events | 13 mo | PostHog rolling window |
| Logs (IP, request) | 90 d | Datadog rolling |
| Backups | 35 d | encrypted snapshots, auto-expire |

## Subject rights matrix (feeds /dsar-process-pre)
| Right | Coverage | Mechanism |
|---|---|---|
| Access | all fields | self-serve export + admin tool |
| Rectification | profile editable + admin tool | self-serve |
| Erasure | account delete (30d grace) | hard-delete + processor cascade |
| Portability | JSON export of profile + orders | self-serve |
| Restriction | flag suspending processing | admin tool |
| Object | marketing opt-out, profiling opt-out | settings page |
| Automated decision review | none in v1 (no automated decisions affecting users) | n/a |

## DPIA trigger assessment
- Large-scale processing: ~50k EU users planned → MEDIUM
- Special category: NO
- Systematic monitoring: behavioral analytics → YES
- Kids: NO (16+ gate)
- Automated decisions with legal effect: NO
- **Verdict**: DPIA required (behavioral profiling threshold)
- Schedule DPIA before launch

## Effort + cost
| Item | Cost |
|---|--:|
| Inventory build | 1 wk eng + privacy counsel review |
| DPIA (Y1) | $5k legal |
| Processor DPAs (mostly free templates) | $0–2k legal |
| ROPA tooling (OneTrust / Osano / spreadsheet) | $0–10k/yr |
| Annual review | 3 d |
| **Y1 total** | **~$10k–$20k** |

## Standards alignment
- GDPR Art 30 (ROPA) ✓
- GDPR Art 35 (DPIA) ✓
- CCPA / CPRA inventory ✓
- LGPD Art 37 ✓
- ISO 27701 (PIMS) ✓

## Risk if skipped
- Schema lands with no lawful-basis tag → retroactive remediation
- Unknown sub-processor surfaces post-launch → DPA scramble
- Schrems II gap → EU enforcement
- DPIA missed → GDPR Art 35 fine exposure
- Retention undefined → indefinite storage default

## 90-day plan
1. Field-by-field walkthrough with PM + eng (week 1)
2. Sub-processor list + DPA sign chase (week 2–4)
3. Cross-border SCCs + TIA (week 4–6)
4. Retention table with eng + legal (week 6)
5. DPIA draft (week 8)
6. ROPA system seeded (week 10)
7. Review with DPO / counsel (week 12)
```

## Verification
- Every PII field mapped to category + tier + basis + retention + processor + transfer.
- Sub-processor DPA list complete.
- Cross-border posture declared.
- DPIA trigger assessed.
- Subject-rights mechanism per right.
