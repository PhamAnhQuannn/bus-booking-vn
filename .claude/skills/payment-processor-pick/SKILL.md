---
name: payment-processor-pick
description: Pre-launch payment processor pick — Stripe vs Adyen vs Braintree vs PayPal vs regional, fee structure, PCI scope, payout cadence, dispute/chargeback handling, fraud tooling, sub-merchant vs platform, MOR vs MoR, tax engine, payout bank link. Outputs to `docs/inception/payment-processor-pick-<project>.md`. Use when user says "payment processor", "Stripe vs Adyen", "merchant account", "chargebacks", "MoR", "/payment-processor-pick", or before first paid customer.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /payment-processor-pick — First Charge Decides Three Years. Processor Choice = Fee Drag + PCI Scope + Failure Mode.

Processor pick is not "Stripe by default" anymore. 2026 stack = MoR vs platform vs sub-merchant, regional rails, PCI scope, dispute infrastructure, tax-engine fit, payout reliability. Wrong pick = 2-3% fee leak forever + PCI nightmare + payout outage on day-1 launch.

## Why you'd care

Switching payment processors after launch means re-tokenizing cards, re-mapping webhooks, re-passing PCI scope, and renegotiating fees from a position of weakness. Pick once, picking right.

## Pre-flight
Run before first paid customer, before Stripe Connect / Adyen MarketPay / PayPal Marketplace integration, and before signing any pricing-page commitments. Pairs with `/bank-account-setup`, `/accounting-stack-pick`, `/pricing-model`, `/payment-reconciliation`.

## Inputs
- Business model (SaaS subscription / one-time / marketplace / platform / usage-based / IAP).
- Customer geography (US-only / NA / EU / global / LATAM / APAC).
- Currency support needed.
- B2B vs B2C (invoicing + ACH vs card).
- Average transaction value (impacts fee impact).
- Volume estimate year-1 (drives negotiation leverage).
- Industry (regulated / high-risk / standard).
- Subscription vs one-shot.
- In-app purchases via mobile stores (Apple/Google forced 15-30% fee).

## Process
1. **Classify business model** — direct-merchant / marketplace / platform / MoR-friendly. Drives processor type.
2. **Map geography → rails** — US: card + ACH. EU: card + SEPA + iDEAL + Bancontact. LATAM: PIX + Boleto + OXXO. APAC: Alipay + WeChat Pay + UPI. Coverage gap = lost revenue.
3. **Pick processor** — Stripe / Adyen / Braintree / PayPal / regional. Decision table.
4. **MoR vs direct merchant** — Merchant-of-Record (Paddle / Lemon Squeezy / FastSpring) eats tax + PCI burden but takes 5-8% vs Stripe's 2.9% + 30¢.
5. **PCI scope strategy** — SAQ A (hosted iframe / Stripe Elements) vs SAQ A-EP vs SAQ D. Decide before integrating.
6. **Subscription engine choice** — Stripe Billing vs Recurly vs Chargebee vs in-house (don't build in-house).
7. **Tax handling** — Stripe Tax / Avalara / Vertex / Anrok / MoR-handled. US sales tax + EU VAT + UK VAT + Quebec QST + India GST + Aus GST.
8. **Fraud tooling** — Radar / Sift / Signifyd / Adyen RevenueProtect. Tradeoff: false-positive rate vs chargeback rate.
9. **Dispute + chargeback flow** — auto-respond config, evidence templates, chargeback rate alerts (>0.65% = Visa flag, >0.9% = MasterCard flag).
10. **Payout cadence + bank wiring** — daily / weekly / monthly. Reserve held by processor for high-risk.
11. **Webhook reliability + reconciliation** — idempotency, signature verify, replay, daily ledger reconciliation (see `/payment-reconciliation`).
12. **Backup processor** — fail-over if primary down. Real outages happen (Stripe 2024-Q1 ~30 min, Adyen periodic).

## Output
Write `docs/inception/payment-processor-pick-<project>.md`:

```markdown
# Payment Processor Pick (Pre-launch) — <project>
**Owner:** founder / Head of Finance / Head of Eng
**Date:** <YYYY-MM-DD>
**Business model:** <SaaS sub / one-time / marketplace / platform / IAP / hybrid>
**Geography:** <US / NA / EU / global>
**Avg transaction value:** <$X>
**Expected year-1 volume:** <$Y>

## Why this exists pre-revenue
- Fee structure is forever — processor switch post-launch = revenue at-risk migration
- PCI scope picked wrong = $X compliance cost + audit annually
- Geographic rails missed = lost conversion (SEPA absent in EU = 30%+ drop)
- MoR vs direct decides who collects VAT/sales-tax — getting it wrong = back-tax exposure
- Chargeback infrastructure unbuilt = Visa/MC penalty + processor termination

## Business model classification

| Model | Processor type | Examples |
|-------|---------------|----------|
| **Direct SaaS subscription** | Direct merchant (Stripe / Braintree / Adyen) | Linear, Notion |
| **One-time digital sale** | Direct merchant OR MoR for tax simplicity | Tinybird credits, Gumroad creators |
| **Marketplace (multi-seller)** | Marketplace platform (Stripe Connect / Adyen MarketPay) | Shopify, Etsy, Airbnb |
| **Platform (sub-merchants)** | Sub-merchant (Stripe Connect Standard/Express) | Lyft drivers, Shopify Payments |
| **Usage-based / metered** | Direct merchant + metering engine (Stripe Billing meters / Orb / Metronome) | Twilio, Cloudflare Workers paid |
| **Mobile IAP** | Apple App Store + Google Play Billing (forced 15-30%) | Most mobile apps |
| **High-risk / regulated** | Specialty (Authorize.net + merchant acct, NMI) | Cannabis, adult, firearms |

**Our model:** <pick>

## Geography → payment method coverage

| Region | Must-have methods | Nice-to-have |
|--------|-------------------|--------------|
| **US** | Visa / MC / Amex / Discover, ACH (B2B) | Apple Pay / Google Pay / Cash App / Affirm |
| **EU** | Cards, SEPA Direct Debit, iDEAL (NL), Bancontact (BE), Sofort / Klarna, Giropay (DE) | Klarna Pay Later |
| **UK** | Cards, BACS, Faster Payments | Open Banking (Trustly) |
| **LATAM** | Cards, PIX (BR), Boleto (BR), OXXO (MX), Mercado Pago | — |
| **APAC** | Cards, Alipay, WeChat Pay (CN), UPI (IN), GrabPay, PayNow (SG) | Konbini (JP) |
| **AU/NZ** | Cards, POLi, BPay | — |
| **Africa** | Cards, M-Pesa (KE), Flutterwave | Paystack rails |

**Conversion gap rule:** missing dominant local rail = 20-40% conversion loss in that region.

## Processor pick — decision table

| Dimension | Stripe | Adyen | Braintree (PayPal) | PayPal | Checkout.com | Paddle (MoR) | Lemon Squeezy (MoR) | FastSpring (MoR) |
|-----------|--------|-------|--------------------|--------|----|--------------|--------------------|------------------|
| **Base fee (US, online)** | 2.9% + 30¢ | Interchange++ ~$0.13 + IC | 2.9% + 30¢ | 2.89%-3.49% + fixed | Interchange++ | 5% + 50¢ | 5% + 50¢ | 5.9% + 95¢ |
| **Best for** | Anything default | Enterprise + global | PayPal native | Consumer | Enterprise EU | EU/UK SaaS | Indie SaaS | Indie SaaS |
| **VAT/sales-tax handled?** | Stripe Tax add-on | Customer | Customer | Customer | Customer | Yes (MoR) | Yes (MoR) | Yes (MoR) |
| **PCI scope** | SAQ A / A-EP | SAQ A | SAQ A | SAQ A | SAQ A | SAQ A | SAQ A | SAQ A |
| **Subscription engine** | Stripe Billing | Adyen Subs | Braintree Subs | PayPal Subs | Checkout Billing | Built-in | Built-in | Built-in |
| **Marketplace** | Connect (excellent) | MarketPay | Marketplace | Marketplace | Connect-equiv | No | No | No |
| **Global coverage** | 135+ countries | 200+ countries | 130+ | 200+ | 150+ | EU/US/UK strong | US/EU | US/EU |
| **Reserve / rolling reserve** | Some industries | Some | Some | Frequent | Some | None (MoR handles) | None | None |
| **Dispute infra** | Radar + chargeback API | RevenueProtect | Native | Native | Native | MoR absorbs | MoR absorbs | MoR absorbs |
| **Payout speed** | T+2 default, faster $ | T+2 | T+2 | T+1 (manual) | T+2 | Monthly net | Monthly net | Monthly net |
| **DX (docs + SDK)** | Best-in-class | Strong | Strong | Aging | Strong | Strong | Strong | OK |
| **API stability** | Versioned, strong | Versioned | Stable | Mixed | Strong | Strong | Strong | OK |
| **Embedded UX** | Elements / Payment Element | Drop-in / Components | Drop-in | Smart Buttons | Frames | Overlay / hosted | Hosted / overlay | Hosted |

**Our pick:** <primary processor + justification>
**Backup processor:** <secondary for fail-over>

## MoR vs direct merchant

**Merchant-of-Record (Paddle / Lemon Squeezy / FastSpring) collects sales-tax/VAT/GST globally and remits — you bill them, they bill customer.**

| Dimension | MoR (Paddle/LS/FastSpring) | Direct (Stripe + Stripe Tax) |
|-----------|---------------------------|-----------------------------|
| Fee | 5-7% | 2.9% + 30¢ + Tax add-on (~0.5%) |
| Tax registrations | Zero | You register in every taxing jurisdiction |
| Tax filings | Zero | You file (or Anrok / Avalara files) |
| Subscription engine | Included | Stripe Billing add-on |
| Refunds + disputes | MoR handles | You handle |
| Pricing flexibility | Limited (MoR holds payment) | Full |
| Cash flow | Monthly net-X | Daily/weekly |
| **Right for** | Indie founders, EU sellers, < $5M ARR | $5M+ ARR or US-heavy |

**Crossover:** ~$2-3M ARR is where MoR's tax-burden saving stops outweighing the 2-3% fee delta.

**Our pick:** <MoR / direct + reasoning>

## PCI scope strategy

| Scope | Description | Integration |
|-------|------------|------------|
| **SAQ A** | Card data never touches your servers — hosted iframe/redirect | Stripe Checkout, Stripe Elements (Payment Element), Adyen Hosted, PayPal Smart Buttons |
| **SAQ A-EP** | Card field on your page but tokenized via JS direct-to-processor | Stripe Elements (custom), Adyen Components |
| **SAQ D** | Card data hits your server | Required if you store / transmit raw PAN. **AVOID unless absolutely needed** |

**Default:** SAQ A via Payment Element / hosted page.
**Audit cost:** SAQ A self-assessed annually; SAQ D = $20k-100k+ QSA audit + ASV scans + annual pen-test.

## Subscription engine

**Build vs buy:**

| Option | Notes |
|--------|-------|
| **Stripe Billing** | Default for Stripe shop. Plans + invoices + dunning + tax + portal. |
| **Recurly** | Higher-volume; stronger revenue-recognition |
| **Chargebee** | Best for complex pricing (proration, ramp deals, multi-currency entitlements) |
| **Orb / Metronome** | Usage-based metering specialists; pair with Stripe |
| **MoR built-in** | Paddle / Lemon Squeezy / FastSpring include sub engine |
| **DIY** | Don't. Dunning + proration + 3DS + SCA + tax = 6 months to rebuild Stripe Billing badly |

**Our pick:** <engine>

## Tax engine

| Tax type | Where | Threshold | Engine |
|----------|-------|-----------|--------|
| US sales tax | State-by-state | Economic nexus typically $100k or 200 transactions per state | Stripe Tax / Avalara / Anrok |
| EU VAT (digital) | All EU MS | €10k EU-wide threshold (then OSS) | Stripe Tax / Avalara / MoR |
| UK VAT | UK | £85k threshold | Stripe Tax |
| GST (Aus / NZ / India / Singapore / Canada) | Country | Varies | Stripe Tax / Avalara |
| Quebec QST | Canada | $30k threshold | Avalara / specialist |
| State digital-goods tax | State-by-state | Varies | Anrok specialty |

**Decision:** MoR (Paddle / LS / FastSpring) absorbs all. Direct = pick engine + register where required.

## Fraud tooling

| Tool | Pros | Cons | Cost |
|------|------|------|------|
| **Stripe Radar** | Tight integration, ML | Locked to Stripe | Included or $0.05/txn for Radar for Fraud Teams |
| **Adyen RevenueProtect** | Multi-acquirer ML | Locked to Adyen | Included |
| **Sift** | Industry-standard | Pricey | $0.05-0.10/txn |
| **Signifyd** | Chargeback guarantee | Pricey, slow approval | 0.5-1.5% of revenue |
| **Kount** | Enterprise | Heavy setup | Custom |
| **Forter** | Real-time decisions | Enterprise | Custom |

**Default:** Stripe Radar / Adyen RevenueProtect included with processor.

**Chargeback threshold thresholds to monitor:**
- Visa: >0.65% chargeback rate → flagged; >0.9% → VAMP / VFP placed
- MasterCard: >1% → ECP program
- Processor termination risk: >2% sustained

## Dispute + chargeback flow
- Auto-evidence template uploaded per dispute (Stripe / Adyen support this)
- Required evidence: invoice, IP+UA, delivery proof, support history, terms acceptance log (from `/terms-of-service-pre` evidentiary record)
- Win rate target: > 25% with templates; > 50% with attentive ops
- Chargeback-rate alert: weekly review; immediate alert if monthly rate > 0.5%
- Friendly fraud (chargeback abuse): named-customer block list

## Payout cadence + bank
- **Default cadence:** T+2 daily rolling (Stripe default)
- **Holdback / reserve:** processor may hold 5-20% of revenue for high-risk industries
- **Payout bank:** linked to `/bank-account-setup` ops account
- **Currency:** payout in business currency; FX conversion if mixed (Stripe Charge in EUR → payout in USD = 2% FX margin unless you have local payout currency account)
- **Multi-currency payout:** Stripe / Adyen support; needs local IBAN/account

## Webhook reliability + reconciliation
- Verify signature on every webhook (`Stripe-Signature` header / Adyen HMAC)
- Idempotency key on every charge / subscription event
- Retry handling — webhook may fire 2-3x; dedupe by event ID
- Daily reconciliation cron — see `/payment-reconciliation`
- Outage protocol — if processor down, queue payments + retry; do not fail user silently

## Backup processor strategy
- Primary outage = revenue stop. Mitigation:
  - Single processor + accept outage risk (most early-stage)
  - Dual-processor (Stripe primary + Braintree fallback) — adds complexity, fraud-rule duplication
  - MoR (Paddle) → outage = MoR's problem
- **Our posture:** <single / dual / MoR>

## Negotiation leverage
- Year-1 volume < $1M: published rates, no negotiation
- $1M - $10M: ~10-30 bps discount possible, ask
- $10M+: interchange++ + custom; pit Stripe vs Adyen vs Checkout
- Add-ons (Tax / Billing / Radar) often negotiable separately

## Integration plan
- SDK: TypeScript-first (Stripe-node, adyen-node-api-library)
- Webhook endpoint: `/api/webhooks/stripe` with signature verify + idempotency
- Customer portal: hosted (Stripe Customer Portal) or built-in (MoR)
- Test mode: every flow tested in test mode + live-mode smoke with $1 charge before launch
- 3DS / SCA: required EU; enable challenge_only mode
- Strong Customer Authentication: in-app for EU sub-renewals

## Compliance + legal
- PCI-DSS self-assessment annually (SAQ A) + signed AOC
- Sales-tax registrations per jurisdiction (or rely on MoR)
- Privacy notice updates — processor as sub-processor in DPA (see `/dpa-template`)
- Refund policy in ToS — see `/terms-of-service-pre` clause #7

## Anti-patterns
- ❌ Building subscription engine in-house ("just a cron job") — proration + dunning + SCA = 6mo
- ❌ Storing card data on your server (SAQ D unless you're a processor)
- ❌ No fraud tooling → first BIN attack drains your balance
- ❌ No webhook signature verify → spoofed events
- ❌ No idempotency key → double-charges
- ❌ No daily reconciliation → silent payment losses
- ❌ Single processor with no backup for high-availability product
- ❌ Missing local rail in target geo (EU without SEPA, BR without PIX)
- ❌ "We'll figure out tax later" — back-VAT in EU = 5-yr lookback
- ❌ Using PayPal alone for B2B SaaS (B2B customers want invoice + ACH)

## Pre-launch checklist
- [ ] Business model classified
- [ ] Geography → rail coverage mapped
- [ ] Processor picked + backup named
- [ ] MoR vs direct decision documented
- [ ] PCI scope = SAQ A (or justified higher)
- [ ] Subscription engine integrated (if applicable)
- [ ] Tax engine wired or MoR handling confirmed
- [ ] Fraud tool enabled + rules tuned
- [ ] Webhook endpoint with signature verify + idempotency
- [ ] Reconciliation job scheduled
- [ ] Dispute template uploaded
- [ ] Chargeback alerts configured
- [ ] Test-mode smoke + $1 live-mode smoke before launch
- [ ] 3DS / SCA enabled for EU
- [ ] DPA signed with processor
- [ ] Refund + cancellation flow in product

## Next
- Bank wiring → `/bank-account-setup`
- Reconciliation → `/payment-reconciliation`
- Tax + invoicing → `/accounting-stack-pick`
- Pricing → `/pricing-model`
- Subscription comms → `/transactional-email`
- DPA → `/dpa-template`
- Refund policy → `/terms-of-service-pre`
```

## Verification
- Business model classified.
- Geography rail coverage mapped.
- Processor + backup picked.
- MoR vs direct decided.
- PCI scope = SAQ A.
- Subscription engine + tax engine wired.
- Fraud + dispute infra named.
- Webhook + reconciliation plan.
- Chargeback thresholds monitored.
- DPA signed with processor.
