---
name: hipaa-risk-assessment
description: Annual HIPAA Security Rule risk analysis per 45 CFR 164.308(a)(1)(ii)(A), aligned to NIST 800-30 r1 + NIST 800-66 r2 (Feb 2024) + HHS SRA Tool. Build asset inventory, threat catalog, vulnerability + likelihood + impact rating, residual-risk register, mitigation tracker, and 12-month remediation roadmap. Reads `docs/inception/hipaa-<project>.md`. Writes `docs/compliance/hipaa-risk-assessment-<YYYY>-<project>.md`. Trigger phrases "risk assessment", "HIPAA SRA", "Security Risk Analysis", "NIST 800-30", "NIST 800-66", "annual risk assessment", "SRA tool", "/hipaa-risk-assessment", or required annually + after material change.
output_size:
  XS: skip
  S: skip
  M: 4h
  L: 8h
  XL: 16h
---

# /hipaa-risk-assessment — HIPAA Security Risk Analysis

## Why you'd care

OCR's first request after a breach is your annual SRA — not having one is itself a separate violation that compounds the original fine. The annual cadence is non-negotiable; this skill makes it auditable.

Invoke as `/hipaa-risk-assessment`. **Required annually** under HIPAA Security Rule (45 CFR 164.308(a)(1)(ii)(A)). Re-run on material change (new system, vendor, breach, acquisition).

## Pre-flight
1. Read `docs/classify/<project>.md`. XS/S → SKIP.
2. Read `docs/inception/hipaa-<project>.md`.
3. Read `docs/design/phi-minimization-<project>.md` (data-flow inventory).
4. Read prior year's risk assessment if exists — compare deltas.

## Inputs
- All systems, services, devices that create/receive/store/transmit ePHI.
- Workforce roles + access patterns.
- Sub-BAs + their BAAs.
- Prior incidents / breaches / near-misses (12 mo).
- Audit log of PHI access.
- Vulnerability scan + pen-test results (last 12 mo).
- Insurance carrier requirements (cyber policy).
- 2024 HHS proposed Security Rule update (NPRM Dec 2024) — anticipate tightening if finalized.

## Process
1. **Scope statement** — explicit. What's in vs. out. ePHI environments only; corporate IT only-in-scope where it touches PHI.
2. **Asset inventory** — every system handling ePHI:
   - Apps (web, mobile, backend services).
   - Databases (Postgres, Redis, S3 buckets).
   - Network (VPC, VPN, load balancers).
   - Endpoints (workforce laptops if PHI touched).
   - Sub-BA services (AWS, Stripe, Twilio, Datadog, Sentry, OpenAI/Azure).
   - Backups + DR.
   - Email / messaging (Gmail/M365 if PHI touched).
   - Devices (workforce mobile + medical/IoT if applicable).
3. **Threat catalog** (per NIST 800-30 r1 + 800-66 r2):
   - Adversarial (insider, external, nation-state, organized crime, hacktivist).
   - Accidental (workforce error, misconfiguration, lost device).
   - Structural (hardware failure, software bug, network).
   - Environmental (fire, flood, power, pandemic).
4. **Vulnerability identification**:
   - Pen-test findings (annual external + internal).
   - Vulnerability scans (weekly authenticated; Nessus/Qualys/AWS Inspector/Snyk).
   - SBOM review (`/sbom-generate`).
   - Misconfiguration audit (CIS benchmarks, AWS Config, Prowler).
   - Workforce phishing-test results.
   - Audit-log analytics (anomaly).
5. **Likelihood × Impact rating** — 5×5 matrix:
   - Likelihood: 1 Very Low → 5 Very High (frequency)
   - Impact: 1 Negligible → 5 Catastrophic (PHI records exposed, fine exposure, business continuity)
   - Risk = L × I → 1–25 scale → bucket: Low (1–5) / Med (6–12) / High (13–18) / Critical (19–25)
6. **Map to HIPAA Security Rule controls** (164.308 admin, 164.310 physical, 164.312 technical):
   - Each risk → which safeguards mitigate.
   - "Addressable" vs. "Required" — addressable still needs justification doc if not implemented.
7. **Determine residual risk** after controls:
   - Inherent risk → controls → residual.
   - Document accepted residual risks (executive sign-off).
8. **Mitigation roadmap**:
   - Per gap: action + owner + due date + cost.
   - Prioritize Critical > High > Med.
9. **Documentation requirements** (HHS expects on audit):
   - Method statement (cite NIST 800-30 + 800-66 r2 + SRA Tool).
   - Asset inventory.
   - Threat + vulnerability list.
   - Risk register with L × I.
   - Mitigation plan with dates.
   - Executive sign-off.
   - Retention 6 yrs.
10. **HHS SRA Tool** — free, downloadable from HealthIT.gov; produces compliance-ready PDF; suitable for small/medium BAs. Use as starting frame; supplement with our richer artifact.
11. **2024–2026 vintage signals**:
    - NIST 800-66 r2 (Feb 2024) — full rewrite aligning HIPAA Security Rule to NIST CSF + 800-53. Map your controls to NIST CSF subcategories.
    - HHS proposed Security Rule update (Dec 2024 NPRM): if finalized 2025, removes "addressable" distinction (all controls become required); mandates encryption; mandates MFA; tighter audit; ePHI inventory + technology asset register required by rule. Treat as near-term floor.
    - Change Healthcare (Feb 2024) breach lessons: MFA on internet-facing systems (Citrix was attacked without MFA); segmentation; out-of-band auth for critical workflows.
    - HHS OCR 2024 enforcement: "Right of Access" cases stacking ($30–80k each).
12. **Penetration test + scan cadence** (HHS expects):
    - External pen-test annually ($15–40k).
    - Internal pen-test annually ($10–30k).
    - Authenticated vulnerability scan weekly.
    - Web app DAST monthly.
    - Phishing simulation quarterly.

## Output
Write `docs/compliance/hipaa-risk-assessment-<YYYY>-<project>.md`:

```markdown
# HIPAA Security Risk Analysis — <project>
**Assessment year:** <YYYY>
**Date completed:** <YYYY-MM-DD>
**Next due:** <YYYY+1>-<MM>-<DD>
**Method:** NIST SP 800-30 r1 + 800-66 r2 (Feb 2024) + HHS SRA Tool v3.x
**Owner:** <Privacy Officer / Security Officer>
**Executive sign-off:** <CEO / CISO> on <YYYY-MM-DD>

## 1. Scope
In scope: all systems creating, receiving, storing, or transmitting ePHI; workforce with PHI access; sub-BAs.
Out of scope: corporate marketing site, blog, public APIs without PHI.

## 2. Method
- Asset inventory + data flow per `/phi-minimization`.
- Threat catalog from NIST 800-30 r1 Appendix D + healthcare-sector additions.
- Vulnerability sources: pen-test (<vendor>, <date>), Qualys scans, AWS Inspector, Snyk, phishing-sim, audit log analytics.
- Rating: 5×5 L×I matrix.
- Mapped to HIPAA 164.308/.310/.312 + NIST CSF v2.0 subcategories (post-NIST 800-66 r2 alignment).

## 3. Asset inventory (excerpt; full list `assets/asset-inventory-<YYYY>.csv`)
| ID | Asset | Type | ePHI? | Owner | Sensitivity |
|---|---|---|:--:|---|---|
| A001 | App: patient-web | web | yes | Eng | High |
| A002 | App: clinician-mobile | mobile | yes | Eng | High |
| A003 | DB: prod-postgres | DB | yes | Eng | Critical |
| A004 | DB: prod-redis (cache) | cache | yes (transient) | Eng | High |
| A005 | Storage: s3-phi (attachments) | object | yes | Eng | Critical |
| A006 | AWS account: prod | cloud | yes | Eng | Critical |
| A007 | Sub-BA: AWS | service | yes | Vendor mgmt | High |
| A008 | Sub-BA: Stripe | service | limited | Vendor mgmt | Med |
| A009 | Sub-BA: Twilio | service | yes (msg) | Vendor mgmt | Med |
| A010 | Sub-BA: Datadog | service | scrubbed | Vendor mgmt | Med |
| A011 | Sub-BA: Sentry | service | scrubbed | Vendor mgmt | Med |
| A012 | Sub-BA: Azure OpenAI | service | yes | Vendor mgmt | High |
| A013 | Endpoint: workforce laptops (40) | endpoint | yes | IT | High |
| A014 | Email: Google Workspace | service | possible | IT | Med |
| A015 | Backup: cross-region snapshot | backup | yes | Eng | Critical |

## 4. Threat catalog
| ID | Threat source | Threat event |
|---|---|---|
| T01 | Adversarial – external (organized crime) | Ransomware via phishing → ePHI encryption + exfil |
| T02 | Adversarial – external | Credential stuffing on patient portal |
| T03 | Adversarial – external | API abuse via stolen OAuth token |
| T04 | Adversarial – external | SQL injection / IDOR exposing PHI |
| T05 | Adversarial – insider (malicious) | Workforce exfiltration of patient list |
| T06 | Adversarial – insider (compromised) | Spear-phish → cred theft → admin console |
| T07 | Accidental – workforce | Email to wrong recipient with PHI |
| T08 | Accidental – workforce | Lost / stolen unencrypted laptop |
| T09 | Accidental – workforce | Misconfigured S3 bucket public |
| T10 | Accidental – dev | PHI in non-prod (logs, tests, screenshots) |
| T11 | Structural | Cloud-provider outage (AWS region) |
| T12 | Structural | DB corruption / data loss |
| T13 | Structural | Software vuln (Log4j-class) |
| T14 | Environmental | Datacenter fire/flood |
| T15 | Supply chain | Sub-BA breach (Change-Healthcare-class) |
| T16 | Supply chain | Open-source dependency compromised |

## 5. Risk register
| Risk ID | Threat × Asset | Vulnerability | Likelihood | Impact | Inherent | Controls | Residual | Owner | Mitigation due |
|---|---|---|:--:|:--:|:--:|---|:--:|---|---|
| R001 | T01 × A003 | MFA not enforced on bastion | 4 | 5 | 20 Crit | 164.308(a)(5)(ii)(D), MFA rollout | 8 Med | Sec | 2026-07-31 |
| R002 | T02 × A001 | rate limit absent on /login | 4 | 3 | 12 Med | rate limit + WAF + breach-cred-check | 4 Low | Eng | 2026-06-15 |
| R003 | T03 × A001 | refresh token rotation absent | 3 | 4 | 12 Med | rotate-on-use + JWT short TTL | 4 Low | Eng | 2026-08-31 |
| R004 | T04 × A001 | DAST gap on /search | 3 | 5 | 15 High | DAST monthly + Snyk SCA + pen test | 6 Med | Eng | 2026-07-31 |
| R005 | T05 × A003 | bulk export endpoint not audited | 2 | 5 | 10 Med | audit + DLP + quarterly review | 4 Low | Sec | 2026-09-30 |
| R006 | T06 × A006 | console MFA optional for some IAM users | 3 | 5 | 15 High | enforce MFA + SCP + IdP | 6 Med | Sec | 2026-06-30 |
| R007 | T07 × A014 | DLP not enabled on outbound email | 3 | 3 | 9 Med | Google DLP + training | 4 Low | IT | 2026-08-31 |
| R008 | T08 × A013 | full-disk encryption not enforced (5 endpoints) | 3 | 4 | 12 Med | MDM enforce FileVault/BitLocker | 4 Low | IT | 2026-06-15 |
| R009 | T09 × A005 | bucket public-access block missing on legacy | 2 | 5 | 10 Med | AWS Config rule + remediation | 4 Low | Eng | 2026-07-15 |
| R010 | T10 × A003 | seed scripts may copy prod | 3 | 4 | 12 Med | de-id-only seed; CI guard | 4 Low | Eng | 2026-08-31 |
| R011 | T11 × A006 | single-region | 2 | 4 | 8 Med | accept residual (cost); DR plan covers 12h RTO | 8 Med (accepted) | Exec | 2026-12-31 |
| R012 | T12 × A003 | backups untested | 3 | 5 | 15 High | quarterly DR drill via `/dr-drill` | 5 Med | Eng | 2026-Q2 |
| R013 | T13 × A001 | dep updates ad-hoc | 4 | 4 | 16 High | weekly Dependabot + monthly `/dependency-update` | 6 Med | Eng | ongoing |
| R014 | T15 × A007–A012 | sub-BA breach exposure | 3 | 5 | 15 High | vendor SOC 2 review annual + breach-clause in BAA | 8 Med (accepted) | Vendor mgmt | annual |
| R015 | T16 × A001 | supply chain attack on npm dep | 3 | 4 | 12 Med | SBOM + signed artifacts + Sigstore + npm audit | 6 Med | Eng | 2026-Q3 |

## 6. HIPAA Security Rule control mapping
| § | Standard | Status | Evidence |
|---|---|:--:|---|
| 164.308(a)(1) | Risk analysis | ✓ | this artifact |
| 164.308(a)(1) | Risk management | ✓ | mitigation roadmap below |
| 164.308(a)(3) | Workforce security | ✓ | RBAC, onboarding/offboarding SOPs |
| 164.308(a)(4) | Access management | ✓ | IdP + SCIM + JIT |
| 164.308(a)(5) | Security awareness training | ✓ | KnowBe4 quarterly + new-hire |
| 164.308(a)(5)(ii)(D) | Password mgmt | ✓ | SSO + MFA enforced (R001 remediating last 5%) |
| 164.308(a)(6) | Security incident procedures | ✓ | `/breach-notification-runbook` |
| 164.308(a)(7) | Contingency plan | ⚠ | DR drill due Q2; backups untested (R012) |
| 164.308(a)(8) | Evaluation | ✓ | this annual SRA |
| 164.308(b)(1) | BA contracts | ✓ | `/baa-template` |
| 164.310(a)(1) | Facility access | n/a (cloud-only) | AWS SOC 2 |
| 164.310(b–d) | Workstation + device | ✓ | MDM (R008 remediating) |
| 164.312(a)(1) | Access control | ✓ | RBAC + ABAC |
| 164.312(a)(2)(iv) | Encryption at rest | ✓ | KMS-managed; addressable→implemented |
| 164.312(b) | Audit controls | ✓ | tamper-evident audit log |
| 164.312(c)(1) | Integrity | ✓ | hash + signed |
| 164.312(d) | Person/entity authentication | ✓ | MFA + IdP |
| 164.312(e)(1) | Transmission security | ✓ | TLS 1.3 enforced |

## 7. NIST CSF v2.0 alignment (per 800-66 r2)
| Function | Posture |
|---|---|
| Govern | Privacy Officer + Security Officer named; policies current |
| Identify | asset inventory + data flow current |
| Protect | encryption + MFA + access control + training |
| Detect | SIEM + audit log + DLP + EDR |
| Respond | `/breach-notification-runbook` + tabletop |
| Recover | backup + DR drill + cyber insurance |

## 8. Pen-test + scan log
| Activity | Last run | Vendor | Findings |
|---|---|---|---|
| External pen-test | 2026-02 | <vendor> | 1 High (patched), 4 Med, 6 Low — all in remediation log |
| Internal pen-test | 2026-03 | <vendor> | 0 High, 3 Med — closed |
| Authenticated vuln scan | weekly | Qualys | tracked in Jira |
| DAST | monthly | StackHawk | tracked in Jira |
| Phishing-sim | 2026-Q1 | KnowBe4 | 4% click rate (target <5%) |
| Cloud config (Prowler) | continuous | AWS Config + Prowler | 3 Med open |

## 9. Mitigation roadmap (top 10)
| # | Action | Owner | Due | Cost |
|---|---|---|---|--:|
| 1 | Enforce MFA on all IAM users + bastion (R001, R006) | Sec | 2026-06-30 | dev time |
| 2 | Rate-limit + WAF on /login (R002) | Eng | 2026-06-15 | dev time |
| 3 | MDM enforce FDE + posture (R008) | IT | 2026-06-15 | $3k/yr |
| 4 | Quarterly DR drill (R012) | Eng | 2026-Q2 + ongoing | dev time |
| 5 | DAST monthly + remediation cycle (R004) | Eng | ongoing | $6k/yr |
| 6 | AWS Config rule for bucket public-access (R009) | Eng | 2026-07-15 | dev time |
| 7 | Refresh token rotate-on-use (R003) | Eng | 2026-08-31 | dev time |
| 8 | De-id-only seed scripts + CI guard (R010) | Eng | 2026-08-31 | dev time |
| 9 | Google DLP outbound (R007) | IT | 2026-08-31 | $4k/yr |
| 10 | Audit + DLP on bulk export (R005) | Sec | 2026-09-30 | dev time |

## 10. Accepted residual risks (exec sign-off)
- R011 single-region (cost vs. RTO trade-off; 12h RTO acceptable for now).
- R014 sub-BA breach exposure (BAA + insurance; cannot eliminate).

## 11. Anticipated regulatory change (2025–2026)
HHS Security Rule NPRM (Dec 2024). If finalized:
- "Addressable" controls become required.
- MFA required.
- Encryption (at rest + in transit) required.
- Annual technology + ePHI asset register required.
- Specific audit + log retention floors.
We are largely compliant; tracking final rule for any new floors.

## 12. Insurance + budget
- Cyber policy: $5M limit, $50k deductible; HIPAA rider; carrier: <name>.
- Compliance budget Y1: $120k (pen-test $30k, DAST $6k, DLP $4k, MDM $3k, training $5k, consulting $30k, internal time remaining).
- HITRUST consideration: defer to Y2 unless 2 enterprise customers demand.

## 13. Documentation retention
- This artifact + supporting evidence: retained **6 years** per 164.530(j).
- Stored: `compliance-vault/<YYYY>/` with access log.

## 14. Sign-off
| Role | Name | Date |
|---|---|---|
| Security Officer | <name> | <date> |
| Privacy Officer | <name> | <date> |
| CEO | <name> | <date> |
| External assessor (if any) | <name> | <date> |

## Risk if skip / weak
- HHS OCR fines $137 – $68,928 per violation; annual cap $2.07M (2024 indexed).
- Audit trigger: complaint, breach >500, random. OCR opens with "show me your risk analysis".
- Cyber insurance denies claim if SRA missing.
- CE customer terminates BAA / MSA.
- Class action exposure under state laws.
```

## Verification
- Asset inventory complete (apps, DBs, sub-BAs, endpoints).
- Threat catalog covers adversarial + accidental + structural + environmental + supply chain.
- Risk register has L × I → inherent → controls → residual for each risk.
- Mapped to 164.308 / .310 / .312 + NIST CSF v2.0.
- Pen-test + scan log current.
- Mitigation roadmap with owners + due dates.
- Accepted residuals signed off by exec.
- Anticipated 2025 Security Rule update tracked.
- 6-year retention noted; storage location set.
- Sign-off section filled.
