---
name: pen-test-procurement-plan
description: Pre-launch pen-test procurement — vendor RFP, scope, methodology (PTES/OWASP/NIST), retest, fix SLA. Outputs to `docs/inception/pen-test-<project>.md`. Reads `/project-classify` to skip XS/S. Use when user says "pen test", "penetration test", "red team", "PTES", "/pen-test-procurement-plan", or before SOC 2 / ISO 27001 / launch.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /pen-test-procurement-plan — Pen-test Procurement Plan

Invoke as `/pen-test-procurement-plan`. Pre-launch / pre-audit pen-test scoping, vendor RFP, contract terms, retest cadence.

## Why you'd care

Pen-test vendors are wildly variable in rigor and price for the same SOW. Without a planned RFP, you either overpay an audit-mill or buy a check-the-box report that won't survive a SOC 2 auditor.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS/S → SKIP
2. Read `docs/inception/threat-model-pre-<project>.md`.
3. Read `docs/inception/attack-surface-<project>.md`.
4. Read `docs/inception/regulatory-<project>.md`.

## Inputs
- Surface scope (web, mobile, API, infrastructure, social engineering).
- Compliance trigger (SOC 2, ISO 27001, PCI DSS 4.0 §11.4, HIPAA, FedRAMP).
- Budget tier ($15k–$200k+).
- Timeline (pre-launch milestone).

## Process
1. **Pen-test types**:
   - **Web app** — OWASP-style; authenticated + unauthenticated
   - **API** — REST/GraphQL/gRPC; authz, rate-limit, biz-logic
   - **Mobile** — iOS + Android; OWASP MASVS
   - **Infrastructure** — external + internal network
   - **Cloud config** — AWS/GCP/Azure misconfig hunt
   - **Social engineering** — phishing campaign + vishing
   - **Physical** — premises (rare)
   - **Red team** — full chain, multi-month, high cost
2. **Methodology standards**:
   - **PTES** (Penetration Testing Execution Standard)
   - **OWASP WSTG** (Web Security Testing Guide)
   - **OWASP MSTG/MASVS** (mobile)
   - **NIST SP 800-115** (technical guide)
   - **OSSTMM** (Open Source Security Testing Methodology Manual)
   - **PCI DSS 4.0 §11.4** prescribes scope + methodology for cardholder env
3. **Vendor selection**:
   - **Tier 1**: NCC Group, Bishop Fox, Trail of Bits, Synopsys, Mandiant — $50–200k engagements
   - **Tier 2**: Bugcrowd Pen-Test, Cobalt.io, HackerOne Pentest — $15–50k, faster
   - **Tier 3**: Boutique / regional — $10–30k
   - **Specialist**: Trail of Bits (crypto, blockchain), Doyensec (web), NowSecure (mobile)
4. **RFP contents**:
   - Scope (URLs, IPs, accounts, OOS list)
   - Test environment (prod, staging, isolated)
   - Test window (hrs, blackout)
   - Methodology required
   - Deliverables (exec summary, technical report, retest)
   - Retest included? (yes — should be)
   - Reporting format (CVSS v3.1 + CWE + reproduction steps)
   - NDA + data handling
   - Insurance ($5M+ E&O typical)
   - Payment milestones
5. **Scope boundaries**:
   - In-scope: hostnames, IPs, accounts provided
   - Out-of-scope: third-party (Stripe, Auth0), DoS, social eng (separate engagement)
   - Authorization letter (Rules of Engagement / RoE)
   - Emergency contacts both sides
   - Stop-test triggers (prod outage, real customer impact)
6. **Test environment**:
   - **Staging mirror** — preferred (no customer data, full feature parity)
   - **Prod read-only** — for some classes (config audit)
   - **Prod write with seed accounts** — risky but realistic
   - Pre-pop test data (seed + known weak fixtures only as bait)
7. **Reporting + remediation**:
   - **Severity rubric**: critical / high / medium / low / info (CVSS + biz)
   - **Fix SLA**: critical 7d, high 30d, medium 90d, low best
   - **Retest**: included in engagement; verify fix per finding
   - **Customer-shareable summary**: 1-page no-detail; full report under NDA
8. **Compliance alignment**:
   - **SOC 2 Type 2**: annual pen-test evidence
   - **ISO 27001 A.8.8** vuln mgmt
   - **PCI DSS 4.0 §11.4** annual external + internal + after significant change
   - **HIPAA**: not mandated but expected
   - **FedRAMP**: annual + significant-change retests required
9. **Cadence**:
   - **Initial**: pre-launch
   - **Annual**: minimum; biannual for regulated
   - **Significant change**: new major feature, infra topology change
   - **Continuous**: bug bounty (separate skill)
10. **Internal prep checklist**:
    - Threat model finalized
    - SBOM available
    - Logs centralized + accessible to testers (read-only)
    - Test accounts pre-provisioned
    - Stakeholders briefed (don't tip ops to alert-suppression bias)
    - PoC / demo data sanitized

## Output
Write `docs/inception/pen-test-<project>.md`:

```markdown
# Pen-test Procurement Plan — <project>
**Date:** <YYYY-MM-DD>

## Trigger
- SOC 2 Type 2 audit Q3
- Pre-launch milestone Y1
- Customer contract clause in 3 enterprise MSAs

## Scope (initial engagement)
| Component | In-scope | Methodology |
|---|:--:|---|
| Web app (app.<domain>) | ✓ | OWASP WSTG |
| Public REST API | ✓ | OWASP API Top 10 |
| Admin console | ✓ | OWASP WSTG + authz fuzz |
| Stripe webhook handler | ✓ | API auth + signature verify |
| Mobile iOS | Y2 | OWASP MASVS L1 |
| Mobile Android | Y2 | OWASP MASVS L1 |
| Cloud config (AWS) | ✓ | CIS Benchmark + Prowler |
| External network | ✓ | NIST 800-115 |
| Internal network | ✓ (assume-breach) | NIST 800-115 |
| Social engineering | separate | targeted phishing Y2 |
| DoS | OOS | n/a |

## Vendor shortlist + scoring
| Vendor | Tier | Cost est | Strength | Score |
|---|---|--:|---|---|
| Bishop Fox | 1 | $90k | web + cloud | 9 |
| Trail of Bits | 1 | $120k | crypto + complex | 9 |
| NCC Group | 1 | $100k | broad | 8 |
| Cobalt.io | 2 | $35k | fast turnaround | 7 |
| Bugcrowd Pen-Test | 2 | $40k | crowd-pool | 7 |
| HackerOne Pentest | 2 | $35k | reporting platform | 7 |

**Pick (Y1):** Cobalt.io for breadth + budget; reserve Bishop Fox for Y2 deep dive.

## RFP key terms
- Scope: above
- Window: 3 weeks test + 1 week report + 1 week retest
- Test env: staging mirror with seed data
- Methodology: PTES + OWASP WSTG + OWASP API Top 10
- Deliverables: exec summary (1 page) + technical report + retest report + CVSS-rated findings
- Retest: included up to 30d post-report
- Reporting: PDF + CSV + reproduction steps + CWE + CVSS v3.1
- NDA: mutual
- Insurance: $5M E&O minimum
- IP: client owns report; vendor retains methodology
- Payment: 50% kickoff, 40% report, 10% retest
- Emergency contacts: both sides

## Authorization (RoE)
- Authorized by CTO + CEO sign
- Window: <date> 09:00 UTC – <date+3wk> 17:00 UTC
- Stop triggers: prod outage, real customer impact, data exfil suspect
- Out-of-scope hard stops: third-party SaaS, customer accounts, employee personal accounts

## Reporting + remediation SLA
| Severity | Fix SLA | Owner |
|---|--:|---|
| Critical | 7 d | CTO escalation |
| High | 30 d | Eng lead |
| Medium | 90 d | Eng lead |
| Low | next sprint | Eng IC |
| Info | discretionary | — |

## Internal prep checklist
- [ ] Threat model frozen 1 wk pre-test
- [ ] SBOM + dep list available
- [ ] Read-only log access for testers
- [ ] Test accounts pre-provisioned (admin, customer, support)
- [ ] Seed data scrubbed of real PII
- [ ] On-call team briefed (no alert-suppression)
- [ ] Communication plan to test team (Slack channel)

## Cadence (post-Y1)
- Annual baseline pen-test
- Significant-change re-test (new major feature, infra change)
- Quarterly internal red-team exercises (in-house)
- Continuous bug bounty (see /bug-bounty-pre)

## Effort + cost
| Engagement | Cost | Cadence |
|---|--:|---|
| Y1 web + API + cloud | $35k (Cobalt) | one-time |
| Y2 + mobile + deep | $90k (Bishop Fox) | annual |
| Phishing campaign | $10k | annual |
| Quarterly internal | included | quarterly |
| **Y1 total** | **$35k** | |
| **Y2 total** | **~$100k** | |

## Standards alignment
- SOC 2 CC4.1 monitoring evidence
- ISO 27001 A.8.8 (technical vuln mgmt)
- PCI DSS 4.0 §11.4
- NIST CSF DE.CM-8

## Risk if skipped
- SOC 2 / ISO 27001 audit fail
- PCI scope unverified
- Customer contract clause breach
- Insurance coverage gap

## 90-day plan
1. Vendor RFP (week 1)
2. Vendor selection (week 2–3)
3. Pre-test prep (week 3–4)
4. Test execution (week 4–7)
5. Remediation sprint (week 7–10)
6. Retest (week 10–11)
7. Report sharing with auditor (week 12)
```

## Verification
- Scope explicit (in + out).
- Vendor selected with rationale.
- RoE drafted.
- Fix SLA per severity.
- Cadence + budget agreed.
