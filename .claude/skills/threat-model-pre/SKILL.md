---
name: threat-model-pre
description: Pre-build product-level STRIDE threat model — adversary classes, attack surfaces, mitigation budget. Outputs to `docs/inception/threat-model-pre-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "threat model", "STRIDE", "attack surface", "adversary", "/threat-model-pre", or before architecture commit.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /threat-model-pre — Pre-build Threat Model

Invoke as `/threat-model-pre`. Product-level STRIDE before architecture commits. Distinct from per-feature `threat-model` (Design phase).

## Why you'd care

Architecture committed without a STRIDE pass embeds adversary assumptions you didn't realize you were making. Modeling threats before code is how mitigations land as features instead of patches.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP
2. Read `docs/inception/regulatory-<project>.md`.
3. Read `docs/inception/gdpr-<project>.md` if EU.
4. Read `docs/inception/aml-kyc-<project>.md` if financial.

## Inputs
- Product surface (web, mobile, API, admin, public-facing).
- Asset value (PII volume, payment flow, IP, user trust).
- Adversary realism (consumer app vs fintech vs govtech).
- Compliance overlay (PCI, HIPAA, SOC 2, ISO 27001).

## Process
1. **Adversary classes**:
   - **Script kiddie** — automated scanners, credential-stuffing, low skill/budget
   - **Organized criminal** — ransomware, BEC, account takeover, fraud rings
   - **Insider (malicious)** — disgruntled employee, contractor, exfil
   - **Insider (negligent)** — accidental disclosure, misconfiguration
   - **Nation-state / APT** — only relevant if govtech/defense/critical infra
   - **Hacktivist** — politically motivated DDoS, defacement
   - **Competitor** — IP theft, scraping, market intel
2. **Attack surface inventory**:
   - Auth (signup, login, password reset, MFA enrollment, SSO)
   - Session (cookies, tokens, JWT, refresh, logout)
   - Public API (rate limit, auth, input validation)
   - Admin / internal tools (privileged ops, audit log)
   - Payment flow (PCI scope, fraud)
   - File upload (malware, path traversal, XXE, ZIP-slip)
   - Third-party integration (OAuth, webhook, callback)
   - Email / SMS (spoofing, bombing, OTP intercept)
   - Mobile app (jailbreak detect, cert pin, secrets)
   - Infra (cloud console, CI/CD, secrets store)
3. **STRIDE per surface**:
   - **S**poofing — identity forgery (creds, tokens, signatures)
   - **T**ampering — data modification in transit/rest
   - **R**epudiation — deny action without log
   - **I**nformation disclosure — read what shouldn't
   - **D**enial of service — exhaust resources
   - **E**levation of privilege — gain higher role
4. **Likelihood × impact rubric**:
   - Likelihood: Rare / Possible / Likely / Almost certain
   - Impact: Minor / Moderate / Major / Catastrophic
   - Risk = L × I; cap at top-N for budget
5. **Mitigation tiers**:
   - **Preventive** — input validation, parameterized query, CSP, MFA
   - **Detective** — logging, SIEM, anomaly detection, alerting
   - **Responsive** — incident runbook, kill-switch, rate-limit auto-trip
   - **Recovery** — backup, DR, communication plan
6. **Mitigation budget**:
   - Estimate engineering hr per high-risk threat
   - Sum vs total security budget
   - Defer / accept / transfer (insurance) low-priority
7. **Pre-build deliverable** vs design-phase deep-dive:
   - This skill: product-level surface map + top-20 threats + budget envelope
   - Design phase `threat-model`: per-feature data-flow + control specifics
8. **Standards alignment**:
   - OWASP Top 10 (web), Mobile Top 10, API Top 10
   - CWE Top 25
   - NIST 800-30 (risk assessment), 800-154 (data-centric threat modeling)
   - Microsoft STRIDE / DREAD legacy
9. **Tooling**:
   - Threat dragon (free), IriusRisk, ThreatModeler, SD Elements
   - Drawio + spreadsheet at small scale
   - Linear / Jira tag `threat-id` linkage to backlog

## Output
Write `docs/inception/threat-model-pre-<project>.md`:

```markdown
# Pre-build Threat Model — <project>
**Date:** <YYYY-MM-DD>

## Scope
- Product: B2C SaaS with payment flow + EU/US customers
- Stage: pre-architecture
- Standard: STRIDE + OWASP Top 10 + NIST 800-30

## Adversary realism
| Class | In-scope? | Why |
|---|:--:|---|
| Script kiddie | ✓ | always |
| Criminal | ✓ | payment + PII |
| Insider malicious | ✓ | small team but admin access |
| Insider negligent | ✓ | training gap likely |
| Nation-state | ✗ | not govtech / critical infra |
| Hacktivist | ✗ | apolitical product |
| Competitor scraping | ✓ | public catalog |

## Attack surface map
| Surface | Exposure | Adversary fit | Priority |
|---|---|---|:--:|
| Auth (signup/login) | public | criminal credential-stuff | P0 |
| Session / JWT | public | criminal session-hijack | P0 |
| Payment flow | PCI SAQ A | criminal fraud | P0 |
| Admin console | internal IP / VPN | insider | P1 |
| Public API | public | criminal scrape + DoS | P1 |
| File upload | auth-required | criminal malware | P1 |
| OAuth callback | public | criminal token-leak | P1 |
| Email OTP | public | criminal SIM-swap | P2 |
| Mobile app | distributed | reverse-eng + cert-pin | P2 |
| CI/CD | internal | insider supply-chain | P1 |
| Cloud console | internal | insider exfil | P0 |

## Top-20 threat catalog (STRIDE)
| ID | Surface | Threat | STRIDE | L | I | Risk | Mitigation tier |
|---|---|---|:--:|:--:|:--:|:--:|---|
| T01 | Auth | credential stuffing | S | likely | major | high | rate-limit + MFA + breach-list check |
| T02 | Auth | password spray | S | likely | moderate | med | rate-limit + lockout |
| T03 | Session | JWT signing-key leak | S | possible | catastrophic | high | KMS-backed signing + rotation |
| T04 | Session | XSS → token exfil | I | likely | major | high | CSP + httpOnly cookie + sameSite |
| T05 | Payment | card data through our servers | I | possible | catastrophic | high | tokenize via Stripe Elements; SAQ A |
| T06 | Payment | fraud (stolen card) | T | likely | major | high | Stripe Radar + 3DS + velocity rules |
| T07 | Admin | priv esc via IDOR | E | possible | major | med | authz check per object; audit log |
| T08 | Admin | insider exfil customer table | I | possible | catastrophic | high | row-level audit log + DLP egress |
| T09 | API | scraping public endpoint | I | likely | moderate | med | rate-limit + Cloudflare bot-mgmt |
| T10 | API | mass enum (user IDs) | I | possible | major | med | UUID + 404 for not-yours |
| T11 | API | DoS via expensive query | D | possible | moderate | med | query timeout + per-user concurrency |
| T12 | Upload | malware embedded in file | T | likely | moderate | med | ClamAV scan + content-type validation |
| T13 | Upload | XXE in XML | T | possible | major | med | disable XXE in parser; whitelist |
| T14 | Upload | path traversal | T | possible | major | med | normalize + chroot + UUID filenames |
| T15 | OAuth | callback URL spoofing | S | possible | major | med | exact-match redirect URI whitelist |
| T16 | Email | SIM-swap → OTP | S | possible | major | med | TOTP / hardware key as MFA upgrade |
| T17 | Mobile | reverse-eng API key | I | likely | moderate | med | obfuscation + cert-pin + server-side authz |
| T18 | CI/CD | supply-chain (npm typosquat) | T | possible | catastrophic | high | lockfile + signed deps + SCA tool |
| T19 | Cloud | misconfig public S3 | I | likely | catastrophic | high | IaC + tfsec + public-access-block |
| T20 | Cloud | leaked AWS key in repo | I | likely | catastrophic | high | gitleaks pre-commit + rotation |

## Mitigation budget envelope
| Tier | Effort estimate | Annual ops |
|---|--:|--:|
| P0 mitigations | ~6 wk dev | $40k tools |
| P1 mitigations | ~4 wk dev | $20k tools |
| P2 mitigations | ~2 wk dev | $10k tools |
| Detective (SIEM, log) | ~2 wk dev | $24k SaaS |
| Responsive (runbooks, on-call) | ~1 wk | $12k PagerDuty |
| Recovery (DR, backup) | covered in DR plan | $15k |
| **Total Y1** | ~15 wk dev | ~$120k |

## Standards mapping
- OWASP Top 10 (2021) — coverage matrix linked
- OWASP API Top 10 (2023)
- OWASP Mobile Top 10 (2024)
- CWE Top 25 — use SCA tool
- NIST 800-30 risk-assessment cadence: annual
- ISO 27001 A.5/A.8 control alignment

## Tooling pick
| Layer | Pick | Cost |
|---|---|--:|
| SAST | Semgrep | free OSS / $40/dev/mo |
| DAST | OWASP ZAP | free |
| SCA | Snyk / Dependabot | free–$40/dev |
| Secrets scan | gitleaks | free |
| Cloud config | Wiz / Prisma | $30k/yr (M+) |
| SIEM | Datadog Cloud SIEM / Elastic | $20–50k/yr |
| Bug bounty | HackerOne / Intigriti | $20k/yr from M+ |

## Open questions
- Will we accept nation-state risk? (No — out of scope)
- Insurance coverage gap vs residual risk?
- Pen test cadence: annual minimum

## Effort + cost
| Activity | Cost |
|---|--:|
| Threat model build | 1 wk eng + $5k consultant review |
| Annual refresh | 3 d eng |
| Per-feature design-phase models | included in design |
| **Y1 total** | **$5k + ~15 wk dev mitigations** |

## Risk if skipped
- OWASP-known vulns shipped → breach
- No insurance defense ("no due care")
- SOC 2 / ISO 27001 audit fail
- Customer-trust collapse

## 90-day plan
1. Surface inventory (week 1)
2. Adversary class agreement (week 1)
3. STRIDE per surface (week 2–3)
4. Top-20 risk-rank (week 3)
5. Mitigation budget approval (week 4)
6. Tool procurement (week 4–6)
7. Per-feature handoff to design phase (week 6+)
8. Annual refresh calendar (week 12)
```

## Verification
- Adversary classes named + scoped.
- Attack surface inventory complete.
- STRIDE applied per surface.
- Top-N threats risk-ranked.
- Mitigation budget envelope set.
