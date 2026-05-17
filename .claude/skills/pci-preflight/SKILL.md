---
name: pci-preflight
description: PCI-DSS v4.0 scoping — SAQ type, merchant level, scope reduction via tokenization, QSA. Outputs to `docs/inception/pci-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "PCI", "card data", "Stripe", "/pci-preflight", or before accepting payments.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /pci-preflight — PCI-DSS Pre-scoping

> **Effort estimate caveat:** `XL: 8h` covers *pre-scoping only* (SAQ-type pick, merchant-level determination, scope-reduction plan, QSA shortlist). Full PCI-DSS v4.0 compliance (SAQ-D or Level 1) is **6–12 months + $50k–$500k** (tokenization rework, network segmentation, ASV scans, QSA fees, annual audit). The 8h figure is NOT total project effort — multiply by 3–5× when budgeting roadmap.

Invoke as `/pci-preflight`. Anyone touching cardholder data (CHD). Goal: minimize scope.

## Why you'd care

Wading into card data without scoping PCI first means accepting a SAQ-D-grade audit budget and a 1500-line questionnaire. Tokenization moves you to SAQ-A; the cost-of-not-knowing this in advance is six figures.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP (use Stripe Checkout, you're SAQ-A)
2. Read `docs/inception/regulatory-<project>.md`.

## Inputs
- Payment processor (Stripe, Adyen, Braintree, Square, custom).
- Card data flow (does CHD touch your servers?).
- Annual transaction volume (defines merchant level).
- Geo (PCI is global; regional supplements vary).

## Process
1. **Merchant levels**:
   - **L1**: >6M Visa/MC tx/yr → annual on-site QSA assessment
   - **L2**: 1M–6M tx/yr → annual SAQ + quarterly scans
   - **L3**: 20k–1M e-commerce tx/yr → SAQ + scans
   - **L4**: <20k e-commerce or <1M total → SAQ
2. **SAQ types** (Self-Assessment Questionnaire):
   - **SAQ-A**: fully outsourced (Stripe Checkout, hosted iframe) — ~22 questions
   - **SAQ-A-EP**: redirect/iframe but you control the page — ~191 questions
   - **SAQ-D**: you store/process/transmit CHD — ~329 questions (avoid)
   - **SAQ-B/B-IP**: terminals only
   - **SAQ-C/C-VT**: payment app or virtual terminal
3. **Scope reduction strategies** (cheapest path):
   - Stripe Checkout / Elements with hosted iframe → SAQ-A
   - Tokenization (replace PAN with token) → drop CHD storage
   - Network segmentation (PCI zone isolated from rest)
   - P2PE (point-to-point encryption) for terminals
4. **PCI-DSS v4.0 (mandatory March 2025)**:
   - 12 requirements, ~400 controls
   - New: customized approach option, MFA everywhere, anti-phishing, script integrity (req 6.4.3), continuous monitoring
5. **QSA / ASV**:
   - QSA (Qualified Security Assessor) — for L1 on-site
   - ASV (Approved Scanning Vendor) — quarterly external scans (Qualys, Rapid7, Trustwave)
6. **Quarterly + annual cadence**:
   - ASV scan: quarterly
   - SAQ: annual
   - Pen test: annual + after major change
   - Internal vulnerability scan: quarterly

## Output
Write `docs/inception/pci-<project>.md`:

```markdown
# PCI-DSS Pre-scope — <project>
**Date:** <YYYY-MM-DD>

## Merchant level
- Volume estimate: <X tx/yr>
- **Level:** L4
- Trigger to re-scope: cross 20k tx threshold

## Card data flow
- Capture: Stripe Checkout (hosted)
- Transmission: Stripe.js → Stripe servers (never our infra)
- Storage: NONE (token only via Stripe Customer)
- Refunds: Stripe Dashboard
- **CHD ever on our servers:** NO

## SAQ type
- **Selected:** SAQ-A
- Rationale: fully outsourced via Stripe Checkout
- Question count: ~22
- Annual self-attestation

## Scope reduction
- Tokenization: Stripe customer.id only stored
- No PAN, CVV, track data, or magnetic stripe data ever stored
- Iframe boundary: Stripe.js loads from js.stripe.com (out of scope)
- Logging: scrub any accidental card-like patterns (regex pre-log filter)

## v4.0 considerations (March 2025)
- [ ] Script integrity for payment page (req 6.4.3) — SRI on Stripe.js
- [ ] MFA on all admin (req 8.4.2)
- [ ] Anti-phishing controls (req 5.4.1)
- [ ] Annual targeted risk analysis

## ASV scanning
- Required if external-facing payment page
- Vendor: <Qualys / Trustwave / SecurityMetrics>
- Cost: ~$300/qtr per IP
- Cadence: quarterly + after material change

## Effort + cost
| Activity | Cost | Cadence |
|---|--:|---|
| Stripe Checkout integration | $0 | one-time |
| SAQ-A annual | $0 (self-attest) | annual |
| ASV scans | $1.2k/yr | quarterly |
| Annual pen test (recommended) | $5k | annual |
| **Total Y1** | **~$6k** | |

## Scope expansion triggers (re-scope if any)
- Decide to capture card form on own page → SAQ-A-EP (8x effort)
- Add subscription billing with custom flow → re-eval
- Cross 20k tx/yr → L3
- Cross 1M tx/yr → L2 + ASV mandatory
- Add card-present (in-person terminal) → SAQ-B
- Receive PAN via email/phone (orderable bad practice) → SAQ-D

## Adjacent paths
- **Stripe Tax** — handle sales tax, no extra PCI scope
- **Apple Pay / Google Pay** — same SAQ-A scope via Stripe
- **3-D Secure 2** — required EU PSD2; included in Stripe

## Risk if skip
- Card brand fines: $5k–$100k/mo
- Acquirer termination
- Breach: $50–$90 per record + class action
- Loss of merchant account

## 90-day plan
1. Confirm flow is hosted iframe (week 1)
2. Sign Stripe ToS confirming SAQ-A eligibility (week 1)
3. Engage ASV (week 2)
4. First quarterly scan (week 4)
5. Complete SAQ-A (week 8)
```

## Verification
- SAQ type chosen with explicit rationale.
- Card data flow drawn (capture → transmit → store).
- Scope reduction strategy named.
- v4.0 new-control checklist included.
- Re-scope triggers explicit.
