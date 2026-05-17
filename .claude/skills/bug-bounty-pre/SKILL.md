---
name: bug-bounty-pre
description: Pre-launch bug bounty / VDP design — platform choice, scope, payout table, safe-harbor, triage SLA. Outputs to `docs/inception/bug-bounty-<project>.md`. Reads `/project-classify` to skip XS/S. Use when user says "bug bounty", "VDP", "vulnerability disclosure", "HackerOne", "Bugcrowd", "/bug-bounty-pre", or before public launch.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /bug-bounty-pre — Bug Bounty / VDP Design

## Why you'd care

Researchers find bugs in your public surface whether or not you have a program — without a VDP they post to Twitter, and without a bounty they sell to whoever pays. A pre-launch program gives you a legal channel, a triage SLA, and continuous coverage between annual pen-tests.

Invoke as `/bug-bounty-pre`. VDP (free) vs Public Bounty (paid). Continuous coverage between annual pen-tests.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS/S → SKIP (start with security.txt + email)
2. Read `docs/inception/pen-test-<project>.md`.
3. Read `docs/inception/threat-model-pre-<project>.md`.

## Inputs
- Maturity (greenfield = VDP only; mature = bounty).
- Customer expectation (B2B enterprise often expects).
- Triage capacity (engineering hours per week).
- Budget envelope.

## Process
1. **Program ladder**:
   - **L0 — security.txt + email** — RFC 9116, 0 cost, anyone can report
   - **L1 — VDP** (Vulnerability Disclosure Program) — public, no payout, safe-harbor
   - **L2 — Private bounty** — invite-only, paid
   - **L3 — Public bounty** — open, paid, scaled triage
   - **L4 — Crowdsourced pen-test** — paid, time-boxed, deeper
2. **Platforms**:
   - **HackerOne** — largest pool, premium
   - **Bugcrowd** — second-largest, similar scope
   - **Intigriti** — EU-strong
   - **YesWeHack** — EU + Asia
   - **Self-hosted** — security.txt + form (cost: time)
3. **Scope definition**:
   - In-scope assets (hostnames, mobile bundle IDs, IP ranges)
   - Out-of-scope (third-party, marketing site if static, social eng)
   - In-scope vuln classes (web, API, mobile, infra)
   - Out-of-scope vuln classes (DoS, brute force, missing best practice)
4. **Payout table** (per severity, public bounty):
   - **Critical**: $5k–$30k (RCE, full account takeover, mass PII exposure)
   - **High**: $1k–$5k (auth bypass, IDOR, sensitive XSS)
   - **Medium**: $250–$1k (CSRF, info leak, business-logic)
   - **Low**: $50–$250 (rate-limit, missing header)
   - **Info**: 0 (acknowledged in HoF)
   - Adjust for traffic / ARR / risk profile
5. **Safe-harbor language** (Disclose.io legal template):
   - Authorize good-faith research
   - DMCA / CFAA waiver
   - Privacy commitment
   - Coordinated disclosure (typical 90d)
   - Encourage but don't require pre-fix disclosure
6. **Triage SLA**:
   - Acknowledge: 2 business days
   - Initial assessment: 5 business days
   - Fix critical: 7 days; high: 30 days
   - Pay on validation
   - Public disclosure: post-fix or 90 days max
7. **Noise filtering**:
   - Reproduction required
   - CVSS / severity self-rated by reporter (re-rated by triage)
   - Duplicate handling (first-valid-report wins)
   - "N/A" reasons published (auto-vuln-scanner output, theoretical)
8. **Internal triage workflow**:
   - Inbox → triage L1 (security eng) → assign severity → owner → fix → retest → reward
   - Tooling: HackerOne or Bugcrowd dashboard; mirror to Linear/Jira
   - Backlog protected: bounty findings have SLA priority
9. **Disclosure policy**:
   - Coordinated 90-day default
   - Public CVE for severity ≥ medium with customer-impact
   - Hall of Fame page
   - Optional thank-you swag
10. **Standards alignment**:
    - **ISO 29147** vulnerability disclosure
    - **ISO 30111** vulnerability handling
    - **NIST SP 800-216** federal coordinated disclosure
    - **CISA Binding Operational Directive 20-01** (federal must run VDP)
    - **EU CRA** (2027) — disclosure mandatory for digital products

## Output
Write `docs/inception/bug-bounty-<project>.md`:

```markdown
# Bug Bounty / VDP Plan — <project>
**Date:** <YYYY-MM-DD>

## Maturity ladder
- **Y0–Y1**: L0 + L1 (security.txt + VDP, no payout)
- **Y2**: L2 private bounty (invite 50 researchers)
- **Y3**: L3 public bounty
- **Periodic L4**: HackerOne crowdsourced pen-test before major release

## Y1 program: VDP (no payout)
- Platform: HackerOne (free VDP plan) — sets up disclosure mailbox + safe-harbor terms
- security.txt at https://<domain>/.well-known/security.txt (RFC 9116)
- Contact: security@<domain> + HackerOne form
- PGP key published

## Scope (Y1 VDP)
| Asset | In-scope |
|---|:--:|
| app.<domain> | ✓ |
| api.<domain> | ✓ |
| www.<domain> (marketing) | ✓ static + forms |
| Mobile iOS | ✓ |
| Mobile Android | ✓ |
| Third-party (Stripe, Auth0) | ✗ report to them |
| Infra cloud config | ✓ low-tier |

## In-scope vuln classes
- All OWASP Top 10
- API Top 10
- Mobile Top 10
- Auth / authz / session
- Sensitive data exposure
- Business logic bypass

## Out-of-scope
- DoS / volumetric
- Rate-limit by itself (must show impact)
- Self-XSS without exfil
- Missing security headers without exploit
- Best-practice opinions
- Theoretical (no PoC)
- Spam / SPF/DKIM by themselves

## Y2 payout table (when graduating to bounty)
| Severity | Min | Max |
|---|--:|--:|
| Critical | $5,000 | $20,000 |
| High | $1,000 | $5,000 |
| Medium | $250 | $1,000 |
| Low | $50 | $250 |
| Info | $0 (HoF) | — |

Critical-payout examples: account takeover at scale, RCE, raw PII export, payment manipulation.

## Safe-harbor (Disclose.io template)
- Good-faith research authorized within scope
- No DMCA / CFAA / equivalent action
- Privacy: minimize data accessed; report immediately if customer data touched
- Coordinated disclosure 90d default
- Thank-you for clear, reproducible reports

## Triage SLA
| Stage | Target |
|---|---|
| Acknowledge | 2 business days |
| Severity classified | 5 business days |
| Fix critical | 7 days |
| Fix high | 30 days |
| Fix medium | 90 days |
| Fix low | next sprint |
| Reward paid (post-graduation) | within 14 days of validation |
| Public disclosure | post-fix or 90 days |

## Internal triage workflow
1. HackerOne inbox monitored daily
2. L1 triage (security eng) re-rates severity
3. Bug created in Linear, severity-tagged, owner assigned
4. Fix → retest by reporter → close → reward
5. Quarterly metrics report to leadership

## Disclosure policy
- Default: coordinated 90 days
- CVE issued for medium+ with customer-impact
- Hall of Fame: /security/hall-of-fame
- Optional swag: t-shirt for first valid report

## Effort + cost
| Item | Cost (Y1) | Cost (Y2) |
|---|--:|--:|
| HackerOne VDP plan | $0 | $5k mgr |
| HackerOne Bounty plan | n/a | $25k mgr fee |
| Bounty payouts pool | $0 | $50k–$150k |
| Triage time | ~3 hr/wk eng | ~10 hr/wk eng |
| security.txt + page | 1 d | maintain |
| **Y1 total** | **~$0 + 3 hr/wk** | |
| **Y2 total** | **~$80k–$180k** | |

## Standards alignment
- ISO 29147 + 30111 ✓
- NIST SP 800-216 aligned
- CISA BOD 20-01 (if fed customer)
- EU CRA (2027) prep ✓

## Risk if skipped
- Researcher has no legal channel → public 0day or sells to broker
- SOC 2 Type 2 expects VDP minimum
- Customer enterprise contract often clause for VDP
- CVE published without fix coordination

## 90-day plan
1. Choose platform, sign up VDP plan (week 1)
2. security.txt + PGP key publish (week 1)
3. Safe-harbor + scope page (week 2)
4. Triage workflow doc + Linear integration (week 2–3)
5. Internal red-team test report intake (week 4)
6. First disclosure handled end-to-end (week 6)
7. Quarterly metrics dashboard (week 12)
```

## Verification
- Maturity ladder declared (VDP first; bounty later).
- Platform chosen.
- Scope (in + out) explicit.
- Safe-harbor language adopted.
- Triage SLA published.
- Payout table set (or "VDP-only Y1").
