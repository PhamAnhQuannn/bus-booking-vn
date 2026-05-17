---
name: lawful-basis-mapping
description: Per-processing-activity GDPR Article 6 + Article 9 lawful basis map with LIA balancing tests. Outputs to `docs/inception/lawful-basis-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "lawful basis", "Article 6", "LIA", "legitimate interest", "/lawful-basis-mapping", or before ROPA build.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /lawful-basis-mapping — GDPR Lawful Basis per Processing Activity

## Why you'd care

Without a per-activity lawful-basis map, your ROPA is fiction and any DPA negotiation with a German DPO will collapse. The map is what makes the legal foundation auditable, not just declared.

Invoke as `/lawful-basis-mapping`. Required precursor to Article 30 ROPA. Each processing activity must have one Article 6 basis (and Article 9 extra basis if special category).

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP
2. Read `docs/inception/gdpr-<project>.md`.
3. Read `docs/inception/regulatory-<project>.md`.

## Inputs
- Processing activity inventory (signup, marketing, analytics, support, payment, etc.).
- Data categories per activity (regular vs special vs criminal).
- Data subjects (customers, employees, prospects, children).
- Whether basis is contract-necessary or just convenient.

## Process
1. **Six Article 6 lawful bases**:
   - **6(1)(a) Consent** — freely given, specific, informed, unambiguous, withdrawable; record proof
   - **6(1)(b) Contract** — necessary for contract performance OR pre-contract steps at data subject's request
   - **6(1)(c) Legal obligation** — required by EU/MS law (tax retention, AML, court orders)
   - **6(1)(d) Vital interests** — life/death of data subject or another natural person; rare
   - **6(1)(e) Public task** — public authority or official function
   - **6(1)(f) Legitimate interests** — pursued by controller or third party, balanced against subject rights
2. **Consent rules** (Article 7 + EDPB guidelines):
   - Pre-ticked boxes invalid
   - Bundled consent invalid (must be separable per purpose)
   - Withdrawal as easy as giving
   - Children: parental consent <16 (MS can lower to 13)
   - Re-consent if purpose materially changes
3. **Contract necessity test** (EDPB 2/2019):
   - Strictly necessary for delivery, not just useful
   - Marketing emails ≠ contract necessity (use consent/LI)
   - Profiling for service improvement ≠ contract (use LI + LIA)
4. **Legitimate Interests Assessment (LIA)** — three-part test:
   - **Purpose test** — legitimate interest pursued?
   - **Necessity test** — processing necessary to achieve? Less intrusive alternative?
   - **Balancing test** — interest vs subject's rights/freedoms (consider reasonable expectations, sensitivity, opt-out availability)
   - Document each LIA; subject has right to object (Article 21)
5. **Article 9 special category** (extra basis required):
   - **9(2)(a) Explicit consent**
   - **9(2)(b) Employment law obligations**
   - **9(2)(c) Vital interests** (subject incapable of consent)
   - **9(2)(d) Non-profit body legitimate activities**
   - **9(2)(e) Manifestly made public** by subject
   - **9(2)(f) Legal claims**
   - **9(2)(g) Substantial public interest** (MS law)
   - **9(2)(h) Health/social care** (with secrecy obligations)
   - **9(2)(i) Public health**
   - **9(2)(j) Archiving/research**
6. **Article 10 criminal data** — only under controller of official authority OR specifically authorised by EU/MS law
7. **Children (Article 8)** — information society services to <16 (MS-set, min 13) need parental consent
8. **Basis change procedure**:
   - Article 13/14 transparency: disclose new basis
   - Re-consent if changing FROM consent (cannot switch to LI to avoid withdrawal)
   - Compatibility test (Article 6(4)) for further processing
9. **Tooling**:
   - LIA template: ICO LIA, CNIL grille
   - Consent management: OneTrust, Cookiebot, Iubenda, Didomi, Usercentrics
   - Re-consent campaigns at material change

## Output
Write `docs/inception/lawful-basis-<project>.md`:

```markdown
# GDPR Lawful Basis Map — <project>
**Date:** <YYYY-MM-DD>

## Scope
- Controller for: customer accounts, marketing, product analytics
- Processor for: customer-uploaded content (separate basis = customer's)
- Subjects: prospects, customers, employees, contractors, applicants

## Article 6 basis per processing activity
| Activity | Subjects | Basis | Documentation | Notes |
|---|---|---|---|---|
| Account signup | customer | 6(1)(b) Contract | ToS clause 3 | strictly necessary |
| Email/password storage | customer | 6(1)(b) Contract | — | for auth |
| Marketing newsletter | customer + prospect | 6(1)(a) Consent | opt-in checkbox + record | granular per channel |
| Product analytics (PostHog) | customer | 6(1)(f) LI | LIA-001 | service improvement |
| Crash telemetry (Sentry) | customer | 6(1)(f) LI | LIA-002 | reliability |
| Support ticketing | customer | 6(1)(b) Contract | — | service delivery |
| Support call recording | customer | 6(1)(a) Consent | banner pre-call | quality + training |
| Payment processing | customer | 6(1)(b) Contract + 6(1)(c) Legal | tax law 7yr | invoice retention |
| Sanctions screening | customer | 6(1)(c) Legal | EU/UN/UK sanctions regs | required pre-onboarding |
| Fraud detection | customer | 6(1)(f) LI | LIA-003 | platform integrity |
| Cookie analytics | visitor | 6(1)(a) Consent | CMP record | ePrivacy overlay |
| Cookie strictly necessary | visitor | 6(1)(f) LI | — | session/CSRF |
| Account closure / erasure log | former customer | 6(1)(c) Legal | Art 17 obligation | proof of compliance |
| Employee payroll | employee | 6(1)(b) Contract + 6(1)(c) Legal | employment law | |
| Job applicant CV | applicant | 6(1)(b) pre-contract | — | retention 6mo post-decision |
| CCTV at office | employees + visitors | 6(1)(f) LI | LIA-004 | security; signage required |

## Article 9 special category (if applicable)
| Activity | Category | 9(2) basis | Notes |
|---|---|---|---|
| Health-feature opt-in | health | 9(2)(a) Explicit consent | separate from regular consent |
| Workplace health record | employee health | 9(2)(b) Employment | locked to HR; minimum necessary |
| Diversity monitoring (anon) | racial/ethnic | 9(2)(g) Public interest | aggregated; opt-out |

## Article 10 criminal data
- Sanctions/PEP screening hits: derived from public lists; processed under 6(1)(c); special handling
- No criminal background checks unless required for role + lawful

## LIA log
| LIA ID | Activity | Purpose | Necessity | Balance verdict | Mitigation | Reviewed |
|---|---|---|---|---|---|---|
| LIA-001 | Product analytics | improve service quality | necessary, no less intrusive (anon insufficient) | passes | opt-out toggle, no profiling | annual |
| LIA-002 | Crash telemetry | reliability/SLA | minimal alternatives; aggregate | passes | scrub PII, opt-out | annual |
| LIA-003 | Fraud detection | platform integrity, user protection | necessary | passes | clear notice; right to object honored | annual |
| LIA-004 | CCTV | security of premises | proportionate; signage | passes | 30-day retention; controlled access | annual |

## Consent architecture
- Capture: granular checkboxes (separate purposes), version-stamped record
- Storage: consent log table (user_id, purpose, version, timestamp, withdrawal_ts)
- Withdrawal: account/preferences page + 1-click email unsubscribe
- Re-consent triggers: purpose change, processor change (material), 24mo dormant
- Children: age gate + parental consent flow (if <16 service)

## Change procedure
- Material new purpose → re-consent OR Art 6(4) compatibility test
- Switching FROM consent → not allowed to LI for same purpose
- Switching TO stricter basis (e.g., consent) → notify + re-capture
- Privacy notice update (Art 13) within reasonable time

## Right-to-object workflow (Art 21)
- Direct marketing: absolute right; honor immediately
- LI processing: object → re-balance, stop unless compelling override
- Profiling: object honored; documented decision
- Tooling: support tag in CRM; SLA 30 days

## Effort + cost
| Activity | Cost |
|---|--:|
| LIA drafting (initial) | $5k legal |
| CMP setup + cookie audit | $3k/yr |
| Consent log build | dev time |
| Re-consent campaign tooling | included in CMP |
| Annual LIA review | $2k legal |
| **Total Y1** | **~$10k + dev** |

## Risk if skipped
- Wrong basis = unlawful processing = €20M / 4% fine
- Marketing without consent = ePrivacy + GDPR double hit
- LI without LIA = unable to defend at audit
- Consent without granularity = invalid → reset to no-basis

## Verification
- Every processing activity has exactly one Art 6 basis named
- Special category activities have additional Art 9 basis
- Consent activities have evidence-of-consent mechanism
- Every LI activity has documented LIA
- Withdrawal/object workflow tested

## 90-day plan
1. Inventory all processing activities (week 1–2)
2. Assign Art 6 basis per activity (week 2)
3. Draft LIA per LI activity (week 3–4)
4. Consent capture architecture review (week 4–5)
5. Update privacy notice with bases (week 5–6)
6. Re-consent campaign for legacy users (week 6–8)
7. ROPA build using this map (week 8–10)
8. Annual LIA review calendar (week 12)
```

## Verification
- Every processing activity assigned one Art 6 basis.
- Special-category activities double-based (Art 6 + Art 9).
- LIAs documented for every legitimate-interest activity.
- Consent mechanism + withdrawal mechanism described.
- Right-to-object workflow named.
