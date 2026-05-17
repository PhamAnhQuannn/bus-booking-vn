---
name: contract-template-pack
description: Build template pack — MSA, SOW, NDA, MOU, employment, contractor, ToS, PP, DPA. Outputs to `docs/inception/contract-pack-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "contract templates", "MSA", "NDA template", "/contract-template-pack", or before signing first deal.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /contract-template-pack — Contract Templates

## Why you'd care

The first customer that asks for an MSA on a Friday is the one that walks if your answer is "let me get back to you next week with my lawyer". Standardized templates with pre-set fallback positions per clause is what lets a solo founder close enterprise paperwork without paying $400/hr for boilerplate they could have generated from Bonterms in an afternoon.

Invoke as `/contract-template-pack`. Never sign one-off lawyer contracts when templates suffice.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP

## Inputs
- Sales motion (self-serve / sales-led / hybrid).
- Geo (US / EU / global).
- B2B vs B2C.
- Data sensitivity (PII, PHI, financial).

## Process
1. **Template inventory** — must have:
   - **ToS / EULA** — for self-serve users
   - **Privacy Policy** — required by GDPR/CCPA
   - **Cookie Policy** + **Cookie Consent** banner — required by EU
   - **MSA (Master Service Agreement)** — for B2B sales
   - **Order Form** — references MSA, per deal
   - **SOW (Statement of Work)** — for project work
   - **NDA (mutual)** — for sales/partner conversations
   - **DPA (Data Processing Addendum)** — GDPR + processor clients
   - **Employment offer + IP assignment** — for hires
   - **Contractor agreement** — for 1099/freelance
   - **Founder agreement / shareholder agreement**
   - **Advisor agreement** + FAST template (Founder Institute)
   - **Mutual referral agreement** — for partners
   - **Beta / Design Partner MOU**
2. **Template sources**:
   - Stripe Atlas docs (free for users)
   - Termly / iubenda — generated ToS/PP
   - Bonterms — open SaaS standard contracts
   - Y Combinator SAFE — investment doc
   - Common Paper — open commercial contracts
   - Cooley GO — startup law forms
   - Lawyer-customized for high-value (≥$50k contracts)
3. **Critical clauses to standardize**:
   - Liability cap (typical: 12-mo fees)
   - Indemnity (mutual or limited)
   - IP ownership (customer owns customer-data; vendor owns product)
   - Term + termination (notice period, refund policy)
   - Governing law + venue
   - Force majeure
   - SLAs (uptime + credits)
   - Data residency (if applicable)
4. **Negotiation playbook** — pre-set fall-back positions per clause:
   - Liability cap: try 12mo, accept 24mo, walk at unlimited
   - Indemnity: mutual default; one-sided customer = walk
   - Auto-renewal: opt-out possible; some EU jurisdictions require explicit
5. **Signing infrastructure** — DocuSign / HelloSign / native Stripe.

## Output
Write `docs/inception/contract-pack-<project>.md`:

```markdown
# Contract Template Pack — <project>
**Date:** <YYYY-MM-DD>

## Template inventory
| Template | Source | Status | Owner | Path |
|---|---|---|---|---|
| ToS / EULA | Termly generated | live | founder | /legal/tos |
| Privacy Policy | Termly | live | founder | /legal/privacy |
| Cookie Policy | Termly + Cookiebot | live | founder | /legal/cookies |
| MSA | Bonterms standard | drafted | founder | /docs/legal/MSA.docx |
| Order Form | derived from MSA | drafted | founder | /docs/legal/order-form.docx |
| SOW | Cooley GO | draft | founder | /docs/legal/sow.docx |
| Mutual NDA | Common Paper | live | founder | /docs/legal/mnda.docx |
| DPA | EU SCC + processor | drafted | counsel | /docs/legal/dpa.docx |
| Employment offer | Stripe Atlas | template | counsel | /docs/legal/employment.docx |
| IP assignment (PIIA) | Stripe Atlas | template | counsel | /docs/legal/piia.docx |
| Contractor | Stripe Atlas | template | counsel | /docs/legal/contractor.docx |
| Founder shareholders' agreement | Cooley | done | counsel | /docs/legal/sha.docx |
| Advisor (FAST) | Founder Institute | template | founder | /docs/legal/fast.docx |
| Beta / Design Partner MOU | custom | drafted | founder | /docs/legal/dp-mou.docx |

## Critical clause defaults
| Clause | Our default | Negotiation floor |
|---|---|---|
| Liability cap | 12-mo fees | 24-mo fees |
| Indemnity | mutual | mutual only |
| IP — product | vendor owns | non-negotiable |
| IP — customer data | customer owns | non-negotiable |
| Term | 12 mo, auto-renew | 12 mo |
| Notice period | 60 days | 90 days |
| Governing law | DE | customer's state OK if US |
| SLA | 99.5% uptime, 10% credit | 99.9% / 25% credit |
| Data residency | US default | EU available for €X uplift |

## Negotiation playbook
- Liability unlimited request → walk
- Customer-MSA only → use ours unless deal >$50k (then engage counsel)
- Indemnity one-sided customer → walk
- Custom DPA → start from ours, allow markups
- Custom SLA → cap at 99.9% / 25% credit

## Signing infra
- E-signature: DocuSign ($X/mo)
- Storage: Notion / DocSend
- Audit log: signed-version history kept 7 yr

## Counsel engagement triggers
- Deal >$50k ACV
- Custom MSA from customer
- New jurisdiction first deal
- Acquisition / financing
- IP dispute received

## Anti-patterns
- ✗ No ToS/PP at launch
- ✗ Signing customer's MSA without redline
- ✗ Indemnity unlimited
- ✗ Forgot DPA (GDPR fine risk)
- ✗ Lawyer per contract under $25k (cost > value)
```

## Verification
- All 14 template types listed with source + status.
- Critical clause defaults set.
- Negotiation floors named.
- Counsel-engagement triggers explicit.
- Anti-patterns called out.
