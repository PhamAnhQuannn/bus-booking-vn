---
name: accessibility-statement-precommit
description: Pre-commit accessibility statement scoping — EN 301 549, ADA, EAA 2025, AODA. Outputs to `docs/inception/a11y-statement-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "accessibility statement", "EAA", "EN 301 549", "ADA", "Section 508", "/accessibility-statement-precommit", or before public launch.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /accessibility-statement-precommit — Accessibility Statement Pre-commit

## Why you'd care

EAA enforcement started 28 June 2025 — a missing or false accessibility statement is now a fineable offense in EU, and the same exposure exists under ADA, AODA, and Section 508. Scoping the statement before launch is cheaper than writing it under a complaint deadline.

Invoke as `/accessibility-statement-precommit`. Required in EU (EAA from 28 June 2025), US public sector (Section 508), Canada (AODA Ontario), Australia (DDA), Israel (IS 5568).

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP
2. Read `docs/inception/regulatory-<project>.md`.
3. Read `docs/inception/gdpr-<project>.md` if EU customers.

## Inputs
- Customer geo (EU = EAA, US = ADA + 508 if .gov, CA = AODA, AU = DDA).
- Sector (public, banking, transport, e-commerce, telecom — EAA covers).
- Target conformance level (WCAG 2.1 AA standard; 2.2 AA preferred 2026+).
- Assistive tech support promised.

## Process
1. **Standards by jurisdiction**:
   - **EU EAA (Directive 2019/882)** — June 28 2025 enforcement; e-commerce, banking, e-readers, transport ticketing, smartphones, computers
   - **EN 301 549 v3.2.1** — EU harmonised standard; references WCAG 2.1 AA + extras (hardware, ICT)
   - **US ADA Title III** — DOJ April 2024 rule for state/local gov requires WCAG 2.1 AA; private = case law (Robles v Domino's)
   - **Section 508 (US federal)** — Revised 508 = WCAG 2.0 AA via 2017 refresh
   - **Canada AODA (Ontario)** — WCAG 2.0 AA all public-facing sites since 2021
   - **Canada ACA (federal)** — Accessible Canada Act applies federally regulated entities
   - **UK PSBAR 2018** — public sector + statement required
   - **Israel IS 5568** — WCAG 2.0 AA + statement
   - **Australia DDA** — WCAG 2.0 AA per Disability Discrimination Act guidance
2. **WCAG levels**:
   - **A** = baseline; rarely sufficient
   - **AA** = standard target; what regulators expect
   - **AAA** = aspirational; rarely site-wide
   - **2.1** (2018) — mobile + cognitive
   - **2.2** (Oct 2023) — focus appearance, drag movements, target size 24px, accessible auth
3. **EAA scope check** (Annex I products + services):
   - Consumer banking
   - E-commerce
   - E-readers, e-books
   - Smartphones, computers, OS
   - Self-service terminals (ATM, ticketing)
   - Transport ticketing + check-in
   - Audiovisual access services
   - Telecom + 112 emergency
   - Microenterprise exemption: <10 employees AND <€2M turnover (services only)
   - Disproportionate burden assessment allowed but documented
4. **Statement contents** (per WAI-ATAG):
   - Conformance level claimed + standard
   - Scope (which URLs/apps)
   - Known limitations + workarounds
   - Date of last review
   - Test methods (manual + automated)
   - Contact for accessibility issues
   - Enforcement procedure (jurisdiction-specific)
5. **Testing approach**:
   - Automated: axe-core, WAVE, Lighthouse (catches ~30%)
   - Manual: keyboard, screen reader (NVDA, JAWS, VoiceOver, TalkBack)
   - User testing with disabled people
   - Audit by VPAT preparer (US) or accessibility consultancy (EU)
6. **VPAT** (US — Voluntary Product Accessibility Template):
   - Vendor declaration of WCAG / 508 conformance per criterion
   - Required for federal procurement
   - Format: VPAT 2.5 INT (international) or per-rule (508/EN 301 549/WCAG)
7. **Enforcement**:
   - EU: each Member State designates authority + fines (DE BFIT-V; FR DINUM)
   - US: DOJ ADA + private litigation (large class actions)
   - UK: EHRC + service complaint
   - CA: AODA fines up to $100k/day org
8. **Procurement linkage**:
   - EU public bodies: GPP requires conformance
   - US federal: Section 508 mandatory in solicitations
   - Enterprise B2B RFPs increasingly require VPAT

## Output
Write `docs/inception/a11y-statement-<project>.md`:

```markdown
# Accessibility Statement Pre-commit — <project>
**Date:** <YYYY-MM-DD>

## Jurisdictional scope
| Region | Standard | Trigger | Deadline |
|---|---|---|---|
| EU | EN 301 549 / WCAG 2.1 AA | EAA — e-commerce | 2025-06-28 |
| US | WCAG 2.1 AA | ADA Title III | active (case law) |
| US fed | Section 508 / WCAG 2.0 AA | gov customer | per RFP |
| Canada (ON) | WCAG 2.0 AA | AODA | active |
| UK | WCAG 2.2 AA | PSBAR / Equality Act | active |

## Target
- **Standard:** WCAG 2.2 AA
- **Scope:** marketing site + app + mobile apps
- **Excluded:** legacy admin console (sunset Q4)
- **Disproportionate burden:** none claimed

## EAA applicability check (June 2025)
- E-commerce: **YES** — applies in full
- Microenterprise exemption: **NO** (we have 12 FTE)
- Annex I scope: consumer-facing checkout flow, account, support
- B2B-only platform exception: **NO** (we serve consumers)

## Conformance audit baseline (pre-launch)
| Method | Cadence | Tool |
|---|---|---|
| Automated CI | per PR | axe-core via Playwright |
| Manual keyboard pass | per release | internal tester |
| Screen reader smoke | per release | NVDA + VoiceOver |
| Full external audit | annual | <Deque / TPGi / Level Access> |
| User testing (disabled) | annual | <Fable / AccessWorks> |

## Known issues (drafted ahead of launch)
- PDF documents from 2020 archive — non-compliant; replacement HTML by Q3
- Embedded video player — captions yes, audio description no (workaround: transcript)
- Date picker — keyboard yes, screen reader announce flaky on JAWS 2024 (fix in v2)

## VPAT preparation
- **Required?** Yes — first US fed customer requested 2024-12
- Format: VPAT 2.5 INT
- Preparer: <internal a11y lead / external consultancy>
- Cost: $8k external prep
- Review cadence: annual

## Statement template (drafted)
- URL: /accessibility
- Sections: scope, conformance, known issues, contact, enforcement
- Languages: EN, DE, FR (Y1)
- Last review date: dynamic
- Contact: accessibility@<domain> + form

## Effort + cost (Y1)
| Activity | Cost |
|---|--:|
| External audit | $20k |
| Remediation dev time | 2 sprints |
| VPAT prep | $8k |
| User testing | $5k |
| CI tooling (axe) | $0 |
| Statement page | dev time |
| **Total Y1** | **~$35k + dev** |

## Enforcement risk
- EU EAA fines per MS (DE up to €100k per case)
- US: ADA private suit (~$25k–$200k typical settlement)
- UK: county court compensation; EHRC investigation
- Brand: 1B disabled users worldwide; $13T spending power

## 90-day plan
1. Baseline audit + scoring (week 1–4)
2. Top-5 critical fixes (week 4–8)
3. Statement draft + legal review (week 6–8)
4. VPAT prep (week 8–10)
5. Publish statement page (week 10)
6. Quarterly review schedule (week 12)
```

## Verification
- Standard + level chosen per jurisdiction.
- EAA scope check explicit (microenterprise / disproportionate burden documented if claimed).
- Test method named (automated + manual + external).
- VPAT decision made if US fed in pipeline.
- Statement template drafted.
