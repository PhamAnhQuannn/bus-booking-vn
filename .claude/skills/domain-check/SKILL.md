---
name: domain-check
description: Domain availability + TM clearance + brand-ability per name candidate. Outputs to `docs/inception/domain-<project>.md`. Reads `/project-classify` to skip XS/L/XL. Use when user says "domain check", "is this domain free", "/domain-check", or after `/naming-decision`.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /domain-check — Domain Clearance

## Why you'd care

The .com squatter holding the name you spent two days picking will quote $18,000 the day after you tweet the launch — and the .io fallback dies in a single sentence the first time an enterprise procurement team Googles for typo-squatting risk. Twenty minutes of WHOIS + trademark search + brandability check before naming gets committed is what stops the launch-week scramble to rename half the codebase, the email templates, the app-store listings, and the legal entity.

Invoke as `/domain-check`. Solo/M-class — get .com cheap. L+ — domain less critical (sales-led).

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP
   - L/XL → SKIP (sales-led, brand secondary)
2. Read `docs/inception/naming-<project>.md` if exists.

## Inputs
- 1–5 brand name candidates.
- Geo: which TLDs matter.

## Process
1. **Primary check (.com)** — must-have for solo/SMB:
   - Direct registration: $10–$15/yr (Cloudflare, Porkbun, Namecheap)
   - Aftermarket: $X (often $1k–$100k+)
   - Squatter check: parked? for sale? 
2. **Alternate TLDs**:
   - .io ($35/yr) — dev/tech default
   - .ai ($80/yr) — AI products
   - .co ($25/yr) — when .com taken
   - .app ($14/yr) — apps
   - .dev ($12/yr) — dev tools
   - country: .uk, .de, .ca, .au, .jp etc.
3. **Avoid hyphens, numbers** — verbal handoff harder.
4. **Avoid trademark-similar** — even if domain free, TM may block.
5. **Squatter response** — if parked .com, options:
   - Brokered offer via Sedo / Afternic / GoDaddy (anonymous)
   - Direct email if listed
   - Walk away if ask too high (domain + brand value < $X)
6. **Defensive registrations** — typo variants, plurals, common-misspell, .net/.org, country-relevant.
7. **Subdomain strategy** — if .com unavailable but acceptable: brand.app, app.brand, get.brand.

## Output
Write `docs/inception/domain-<project>.md`:

```markdown
# Domain Check — <project>
**Date:** <YYYY-MM-DD>

## Primary candidates
| Brand | .com | .io | .ai | .co | .app | Other |
|---|---|---|---|---|---|---|
| <A> | available $10 ✓ | $35 | $80 | $25 | $14 | — |
| <B> | $5000 aftermarket | $35 | taken | $25 | $14 | — |
| <C> | parked, asking $50k | $35 | $80 | $25 | $14 | — |

## Decision
**Primary:** <A> with .com
**Cost:** $10 first yr + $10/yr renewal

## Defensive registrations (Q1)
| Domain | Cost | Reason |
|---|--:|---|
| <A>.app | $14 | typo variant |
| <A>.io | $35 | dev community catch |
| get<A>.com | $10 | landing page variant |
| <A>app.com | $10 | typo defense |
| <A>.net | $12 | TM defense |
| <A>s.com (plural) | $10 | typo |

**Total defensive:** ~$100/yr

## Aftermarket / squatter approach (if primary not available)
| Action | When | Cost cap |
|---|---|--:|
| Anonymous Sedo offer | round 1 | $1000 |
| Direct email if listed | round 2 | $5000 |
| Walk away → use alternate TLD | round 3 | $0 |

## Brand-ability check
- ✓ Easy to say "<A>.com"
- ✓ Easy to spell after hearing
- ✓ Reads in URL bar without ambiguity
- ✓ Email "<x>@<A>.com" looks professional

## Subdomain alternatives (if .com truly impossible)
- get<brand>.com
- use<brand>.com
- <brand>app.com
- try<brand>.com
- <brand>.<TLD>

## Anti-patterns
- ✗ Settling for .net or .org when .com available aftermarket cheap
- ✗ Picking memorable name without checking TLD coverage
- ✗ Hyphenated domain (verbal share = pain)
- ✗ Long domain (>15 char without compelling brand reason)

## Verdict
**DOMAIN-SECURED / DEFENSIVE-REG-DONE / WAITING-ON-AFTERMARKET / NEED-NEW-NAME**
```

## Verification
- Each candidate checked across primary TLDs.
- Aftermarket budget set.
- Defensive registrations listed.
- Brand-ability sanity test applied.
- Anti-patterns called out.
