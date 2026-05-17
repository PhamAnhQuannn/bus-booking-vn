---
name: privacy-by-design-charter
description: Pre-build privacy-by-design charter — Cavoukian 7 principles, default-private settings, data minimization, purpose limitation. Outputs to `docs/inception/pbd-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "privacy by design", "PbD", "Cavoukian", "data minimization", "/privacy-by-design-charter", or before any data-handling design.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /privacy-by-design-charter — Privacy by Design Charter

Invoke as `/privacy-by-design-charter`. Privacy as default + embedded into architecture, not bolted on.

## Why you'd care

Bolted-on privacy is always more expensive than designed-in privacy — and regulators increasingly treat "we'll fix it later" as evidence of intent. A charter front-loads the constraint into architecture decisions, not patch cycles.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP
2. Read `docs/inception/pii-inventory-<project>.md`.
3. Read `docs/inception/regulatory-<project>.md`.

## Inputs
- Product use cases.
- PII inventory.
- Jurisdiction (GDPR Art 25 mandates PbD).

## Process
1. **Cavoukian 7 Principles** (Foundational):
   1. Proactive not reactive (anticipate breaches before they occur)
   2. Privacy as the default setting (no action required from user)
   3. Privacy embedded into design (not add-on)
   4. Full functionality — positive-sum (not zero-sum trade-off)
   5. End-to-end security (lifecycle protection)
   6. Visibility + transparency
   7. Respect for user privacy (user-centric)
2. **Data minimization** (GDPR Art 5(1)(c)):
   - Collect only what's needed for stated purpose
   - Per-field justification required
   - "Nice to have" fields → DROP
   - Optional vs required clearly marked
3. **Purpose limitation** (GDPR Art 5(1)(b)):
   - Each PII field tagged with purpose(s)
   - New purpose = new lawful basis check
   - Compatibility test for secondary use
4. **Storage limitation** (GDPR Art 5(1)(e)):
   - Per-field retention (per `/records-retention-pre`)
   - Auto-delete jobs scheduled
   - Anonymization preferred over deletion where stats needed
5. **Default-private settings**:
   - Profile visibility = private by default
   - Marketing opt-in (not opt-out) in EU
   - Analytics consent gate (not implicit)
   - Sharing permissions explicit
6. **Pseudonymization + anonymization** (GDPR Art 4(5), Recital 26):
   - Pseudonymize where possible (hash, tokenize, separate keys)
   - Anonymize for analytics (k-anonymity, differential privacy)
   - Re-identification risk assessed
7. **Encryption + access controls**:
   - At-rest + in-transit (per `/crypto-policy-pre`)
   - Field-level encryption for restricted tier
   - Least-privilege access (RBAC + ABAC)
8. **Transparency artifacts**:
   - Privacy policy (plain language)
   - Just-in-time notices (at point of collection)
   - Data dashboard (what we have, why, how to delete)
9. **User control surfaces**:
   - Self-serve access / export (per `/dsar-process-pre`)
   - Self-serve delete
   - Granular consent toggles
   - Communication preferences
10. **Embedded review process**:
    - PbD checklist in PR template
    - Privacy review for any new PII field
    - Quarterly PbD audit
    - DPIA trigger threshold tracked

## Output
Write `docs/inception/pbd-<project>.md`:

```markdown
# Privacy by Design Charter — <project>
**Date:** <YYYY-MM-DD>

## Mission
Privacy is a feature, not a tax. We design for privacy from sketch to ship; we do not bolt it on after launch.

## Cavoukian 7 Principles — our application
| # | Principle | Our commitment |
|---|---|---|
| 1 | Proactive | Threat model + DPIA before code; pre-mortem for privacy breach |
| 2 | Default | All sharing OFF; analytics ASKS first; profile PRIVATE on creation |
| 3 | Embedded | PbD checklist in every PR; privacy review for PII schema change |
| 4 | Positive-sum | Reject "we need PII to build feature" without alternative-explored |
| 5 | End-to-end | TLS in, encryption at rest, scrubbed in logs, hard-deleted on erasure |
| 6 | Transparency | Plain-English policy; live data dashboard at /me/data; quarterly transparency report |
| 7 | User-centric | Self-serve export + delete; granular consent; no dark patterns |

## Data minimization commitments
| Field | Justification | Required? |
|---|---|:--:|
| email | account identity + transactional | ✓ |
| name | personalization, support recognition | ✓ |
| phone | 2FA + critical alerts | optional |
| date of birth | 16+ age-gate (EU) | ✓ at signup, not stored if 16+ |
| address | shipping only | only at checkout |
| profile photo | optional vanity | optional |
| referral source | conversion analytics | optional |
| job title | B2B segmentation | optional |
| ~~marketing preferences ‒ pre-checked~~ | ❌ NEVER pre-check |
| ~~tracking ID across devices~~ | ❌ no cross-device fingerprint |
| ~~precise GPS at signup~~ | ❌ coarse country only, derived from IP |

## Purpose limitation
| Field | Allowed purpose | Forbidden |
|---|---|---|
| email | tx mail, account recovery, opt-in marketing | sold/shared with 3p marketers |
| analytics events | product improvement, funnel analysis | individual targeting in ads |
| order history | service delivery, tax compliance | profiling for risk score without notice |
| support tickets | issue resolution | training AI without consent |

## Default-private settings
- New account profile: visibility = private (only you)
- Marketing emails: opt-in checkbox UNCHECKED
- Analytics cookies: gated by consent banner (Reject = no fire)
- Third-party sharing: OFF
- Public posts (if applicable): private by default
- Search engine indexing of profile: NO

## Pseudonymization + anonymization
- Analytics: hashed user_id (HMAC with rotating salt), no email in event
- Logs: user_id only; PII scrubbed by middleware before transit to Datadog
- BI warehouse: pseudonymized dataset; raw PII stays in app DB
- ML training (if any): k≥50 anonymization + DP noise where individual-level signal needed
- Re-identification risk assessed quarterly

## Encryption + access
- TLS 1.3 in (HSTS, no fallback)
- AES-256-GCM at rest (KMS in-region)
- Field-level encryption for SSN-equivalents (none in v1)
- RBAC: customer ↔ admin separation
- Customer support sees masked email + last-4 phone unless full-access JIT approved

## Transparency artifacts
| Artifact | URL | Owner |
|---|---|---|
| Privacy policy | /legal/privacy | counsel + DPO |
| Cookie notice | inline banner | eng + counsel |
| Sub-processor list | /legal/sub-processors | eng + counsel |
| Data dashboard | /me/data | eng |
| Transparency report | /transparency-2026 (quarterly) | DPO |
| Just-in-time notice | at field collection | UX |

## User control surfaces
| Right | Surface | SLA |
|---|---|---|
| Access | self-serve export at /me/export | <72h |
| Rectification | profile edit + admin tool | instant |
| Erasure | /me/delete (30d grace) | <30d |
| Portability | JSON bundle in export | <72h |
| Object (marketing) | settings page toggle | instant |
| Object (profiling) | settings page toggle | instant |
| Restriction | flag suspending processing | <24h |
| Auto-decision review | n/a v1 (no auto decisions w/ legal effect) | – |

## Anti-patterns we reject
- Pre-checked consent boxes
- Bundled consent ("agree to all")
- Consent required to access basic feature
- Dark patterns ("Are you sure you want to leave?" with manipulation)
- Hidden data sharing with affiliates
- Tracking pixels without consent
- Indefinite retention "just in case"
- Vague purpose ("to improve services")
- Auto-enrollment in research

## Embedded review process
- PR template: "Does this PR add/change PII fields? If yes, link PbD review issue."
- New PII field → mandatory privacy review (counsel + eng lead)
- DPIA threshold tracker (per `/pii-inventory-pre` + GDPR Art 35)
- Quarterly PbD audit (DPO + eng lead)
- Annual external privacy assessment (Y2+)

## DPIA triggers (GDPR Art 35)
We DPIA when ANY of:
- Large-scale processing of special category data
- Systematic monitoring of public area
- Profiling with significant effects
- Children's data systematic processing
- Innovative tech (e.g. ML on PII)
- Combining datasets from different controllers
- Cross-border transfer to non-adequate country at scale
- Public-availability data scraping at scale

## Effort + cost
| Item | Cost |
|---|--:|
| PbD checklist + PR template | 1 d |
| Default-private audit of v1 | 3 d |
| Data dashboard build | 1 wk eng |
| Quarterly review | 2 d/quarter |
| External assessment Y2 | $15k |
| **Y1 total** | **~$5k internal + 2 wk eng** |

## Standards alignment
- GDPR Art 25 (Data Protection by Design and by Default) ✓
- ISO 27701 (PIMS) ✓
- ISO 31700 (Privacy by design for consumer products) ✓
- NIST Privacy Framework ✓
- Cavoukian 7 Foundational Principles ✓

## Risk if skipped
- GDPR Art 25 fine exposure (4% global revenue)
- Retrofit cost 5-10× build-in cost
- Reputation hit on privacy incident
- Sales-disqualifying for privacy-conscious customers
- Forces opt-out marketing → spam complaints

## 90-day plan
1. Charter ratified by founders + counsel (week 1)
2. PR template + privacy-review issue type (week 2)
3. Default-private audit on v1 features (week 3)
4. Data dashboard MVP (week 4-6)
5. Quarterly review calendar (week 8)
6. Anti-pattern review of any vendor-default UX (week 10)
7. PbD champion designated per pod (week 12)
```

## Verification
- Cavoukian 7 mapped to our commitments.
- Data minimization + purpose limitation tables filled.
- Default-private settings declared.
- Anti-patterns explicitly rejected.
- Review process embedded in PR + cadence.
