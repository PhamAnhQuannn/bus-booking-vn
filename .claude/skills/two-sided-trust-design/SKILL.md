---
name: two-sided-trust-design
description: Identity verification, two-sided ratings + reviews, escrow / payment-hold, badge / verification tiers, dispute escalation tiers for two-sided marketplaces. Outputs to `docs/design/trust-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "marketplace", "two-sided", "platform", "trust", "ratings", "reviews", "verification", "escrow", "/two-sided-trust-design", or before any peer-to-peer transaction goes live.
output_size:
  XS: skip
  S: 1h
  M: 4h
  L: 6h
  XL: 8h
---

# /two-sided-trust-design — Two-Sided Trust System

Invoke as `/two-sided-trust-design`. Designs the trust primitives that make strangers willing to transact: identity, ratings, escrow, badges, dispute escalation. Anchored on Airbnb's "Building Trust Between Strangers" (Joe Gebbia, TED 2016), eBay's pioneering feedback-score work, and Sangeet Choudary on "trust scaffolding" in *Platform Scale*.

## Why you'd care

Marketplaces fail when one bad actor poisons the perception of the platform — peer-to-peer transactions amplify every trust failure. Identity verification, ratings, escrow, and dispute tiers are what make the platform feel safe enough to transact.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS → SKIP.
2. Read `docs/inception/cold-start-<project>.md` and `docs/design/data-model.md`.
3. Read `docs/inception/pii-inventory-<project>.md` if exists (for KYC scope).
4. Read `docs/design/api-contract.md` if exists.

## Inputs
- Transaction stakes: low (<$20 gig), medium ($20–$500), high ($500+), very high (real estate, vehicle).
- Locality: in-person service (driver, host, tasker) vs digital-only (Fiverr, Substack).
- Existing trust signals from external systems (Google account age, LinkedIn, government ID).
- Vulnerable user groups (minors, elderly, disabled — extra protection needed).
- Regulatory: KYC (financial), AML, child safety (if minors), licensing (real estate, healthcare).

## Process
1. **Risk tier the transaction** to pick proportionate trust:
   | Tier | Stakes | Trust budget |
   |---|---|---|
   | Low | <$20, no physical contact, digital | self-asserted profile, lightweight reviews |
   | Medium | $20–$500, may be in-person | + government-ID match, escrow, two-sided reviews |
   | High | $500–$10k, in-person/in-home | + selfie liveness, background check (Checkr/Sterling), insurance |
   | Very high | $10k+ | + accreditation, full KYC/AML, attorney-style review |
2. **Identity verification layers** (compose, don't pick one):
   - Email + phone (table-stakes; SMS friction via Twilio/Vonage)
   - Social/OAuth tie-in (Google, Apple, LinkedIn)
   - Government-ID document upload + OCR (Persona, Stripe Identity, Onfido, Jumio)
   - Selfie liveness match to ID (Persona Govt ID + Selfie)
   - Background check (Checkr — drivers, Sterling — taskers, GoodHire — gig)
   - Address verification (utility bill or shipping confirmation)
   - SSN tail / tax-ID (1099 issuance, Stripe Connect KYC)
   - Watchlist/sanctions screen (Stripe Radar, ComplyAdvantage)
3. **Rating system design**:
   - **Two-sided**: both buyer and seller rate. Airbnb pattern.
   - **Simultaneous reveal** (Airbnb 14-day double-blind): submit by deadline; both reveal together or after window. Reduces retaliation bias.
   - **Scale**: 5-star is industry default; consider augmenting with structured tags ("clean", "communicative") to reduce noise.
   - **Score display**: average + count threshold (e.g., hide rating below 3 reviews). Reduces newcomer death-spiral.
   - **Decay**: weight recent reviews more (eBay, Etsy use 12-month rolling average for badges).
   - **Anti-gaming**: detect ring-buying (graph analysis), incentivized reviews, review manipulation (Amazon's annual cleanup).
4. **Reviews (free-text)**:
   - Moderation: auto-flag for profanity, threats, PII, off-platform contact info, false claims.
   - Right-of-reply: rated party can publish 1 response per review.
   - Edit window: 48h to edit after submit.
   - Defamation policy: documented removal criteria; legal review path.
5. **Escrow / payment-hold**:
   - **Hold period**: book → service-complete → 24–72h hold → payout.
   - **Release triggers**: buyer marks complete, time-out (auto-release), arbitrator decision.
   - **Vendor options**: Stripe Connect (separate, delayed, manual payouts), Adyen MarketPay, PayPal Commerce, custom on Stripe.
   - **Funds management**: regulated as money-transmitter in some states; usually solved via Stripe Connect.
   - **Dispute window**: 14–30 days post-service-complete for buyer to dispute.
6. **Badge / verification tiers** (motivating supplier upgrade):
   | Badge | Requirement | Benefit |
   |---|---|---|
   | Verified ID | ID upload + selfie | listing visible to all |
   | Trusted | 10 completed + 4.7★ avg + 90d retention | search rank boost |
   | Top Rated | 100 completed + 4.85★ + low cancel | rank + lower fee + featured |
   | Pro / Plus | paid subscription + above | analytics + priority support |
7. **Dispute escalation tiers**:
   1. **Self-resolve** (3–5 days): in-app messaging with both parties. ~70% resolve here.
   2. **Mediated** (5–10 days): support agent reviews evidence, proposes resolution.
   3. **Arbitrated** (10–21 days): senior agent or panel; binding decision per ToS.
   4. **Chargeback / external** (60+ days): card-network dispute, small-claims, or insurance claim.
   - Each tier needs SLA, decision rubric, evidence schema, escalation criteria.
8. **Vulnerable users + child safety**:
   - Minors: COPPA (US <13), age gates, parental consent
   - In-home services: enhanced background checks, photo-of-tasker, location tracking
   - Vulnerable elderly/disabled: report/block tooling, account-recovery
9. **Trust-damage events** to plan for:
   - Discrimination complaint (Airbnb #AirbnbWhileBlack policy response)
   - Death / serious injury (Uber driver/rider deaths → insurance, in-app emergency button)
   - Stolen goods (eBay VeRO program)
   - Counterfeit goods (Etsy, Mercari)
   - Romance / advance-fee scam (Craigslist, peer-to-peer)
   - Platform liability under Section 230 (US) / DSA (EU)
10. **Anti-patterns**:
    - One-sided ratings only (suppliers terrified of buyer retaliation; Uber added rider rating for this)
    - Manual-only dispute resolution at scale (collapses under volume)
    - Escrow with no clear release rules (lawsuits)
    - Allowing direct contact pre-booking (disintermediation + safety risk)
    - Hiding bad reviews (Yelp lawsuit history)
    - No appeal process for de-platformed suppliers (Airbnb arbitration backlash)

## Output
Write `docs/design/trust-<project>.md`:

```markdown
# Two-Sided Trust System — <project>
**Date:** 2026-05-13

## Risk tier
- **Transaction stakes:** medium ($40–$300 per booking)
- **Locality:** in-person service in buyer's home
- **Trust tier:** Medium-High
- **Vulnerable groups:** elderly buyers common; in-home risk

## Identity verification stack
| Layer | Vendor | Required for | Cost / unit |
|---|---|---|---|
| Email + phone | Twilio Verify | all users | $0.05 |
| OAuth (Google/Apple) | Auth.js | optional, lowers friction | $0 |
| Government ID + selfie | Persona | suppliers before listing | $1.50 |
| Background check | Checkr Basic | suppliers before listing | $30 |
| SSN tail (Stripe Connect) | Stripe Identity | suppliers before payout | included |
| Sanctions screen | ComplyAdvantage | suppliers before payout | $0.30 |
| Address verification | shipping confirmation | suppliers post-onboard | $0 |

## Rating system
- **Scale:** 5-star
- **Two-sided:** both buyer and supplier rate
- **Reveal:** Airbnb-style 14-day double-blind, simultaneous reveal
- **Display threshold:** hide aggregate until ≥3 reviews
- **Decay:** 12-month rolling for badge calculations; lifetime for archive
- **Structured tags:** "punctual", "communicative", "quality", "clean", "safe" (suppliers); "respectful", "clear instructions" (buyers)
- **Anti-gaming:** graph analysis weekly, IP/device fingerprint, removed-review log
- **Free-text moderation:** Perspective API auto-flag + manual review queue, SLA 24h

## Escrow / payment-hold
- **Holder:** Stripe Connect (Express accounts), separate-charges-and-transfers
- **Hold window:** booking → service-complete + 24h auto-release
- **Buyer dispute window:** 14 days post-service-complete
- **Refund authority:** mediation agent up to $500; arbitrator up to full
- **Currency:** USD initially; multi-currency later via Stripe FX

## Badge tiers
| Badge | Requirement | Visible benefit |
|---|---|---|
| Verified | ID + background check passed | listing publishable |
| Trusted | 10 bookings + 4.7★ + 95% on-time | search rank +20% |
| Top Pro | 100 bookings + 4.85★ + <2% cancel + 12mo tenure | rank +40%, "Top Pro" ribbon, fee discount 2pp |
| Elite | 500 bookings + 4.9★ + invite-only | dedicated CSM, featured carousel |

## Comparator playbook
| Co. | Identity | Rating | Escrow | Badge tiers | Key learning |
|---|---|---|---|---|---|
| Airbnb | ID + selfie + Govt ID | 2-sided, double-blind | 24h post-checkin | Superhost | reveal-window invented |
| Uber | Govt ID + selfie + Checkr | 2-sided (started 1-sided) | passenger card hold | Diamond, Platinum | added rider ratings after driver pushback |
| TaskRabbit | Govt ID + Checkr + interview | 2-sided | tasker paid post-completion | Elite Tasker | in-person trust tier |
| Etsy | email + payment | 1-sided (buyer rates seller) | 24h post-delivery | Star Seller | reputation = funnel |
| eBay | email + PayPal verified | 2-sided since 2008 | 14-day buyer protection | PowerSeller, Top Rated | pioneered feedback score |
| Fiverr | email + Govt ID for $1k+ | 2-sided | escrow until "complete" | Level 1/2/Top Rated | tiered seller progression |
| Substack | email + Stripe Connect KYC | n/a (no peer transactions) | Stripe Connect | n/a | publisher = single side |
| Patreon | email + Stripe Connect KYC | n/a | Stripe Connect | n/a | similar to Substack |
| OfferUp | phone + ID | 2-sided star | post-pickup | TruYou | local-pickup-specific |

## Dispute escalation tiers
| Tier | SLA | Owner | Authority | % resolved here |
|---|---|---|---|--:|
| Self-resolve in-app | 3 days | parties | mutual | 65% |
| Mediated (Tier 1) | 5 days | support agent | refund <$500 | 25% |
| Arbitrated (Tier 2) | 14 days | senior agent | full refund + ban | 8% |
| Chargeback / external | 60+ days | risk team + counsel | per network/law | 2% |

## Vulnerable-user safeguards
- In-home services: photo-of-tasker sent to buyer pre-arrival
- Emergency button (911 + share trip status to emergency contact)
- Elderly buyer: large-text mode + voice-first option (a11y)
- Minor protection: age gate at signup; COPPA — no <13 buyers

## Trust-damage event playbook
| Event | Detection | Response | Owner |
|---|---|---|---|
| Discrimination report | report button + review NLP flag | suspend supplier; investigate 7-day SLA | Trust & Safety |
| Death / serious injury | police/news/lawsuit notice | suspend; insurance claim; PR | T&S + Legal + Insurance |
| Counterfeit / IP | brand complaint, NLP scan | takedown 24h, repeat-offender ban | T&S + IP team |
| Scam / fraud | payment anomaly + report | freeze funds, investigate 48h | Risk + Fraud |
| Section 230 / DSA notice | legal request inbox | counsel triage 48h | Legal |

## Privacy + retention
- ID documents stored encrypted at rest (KMS), retained 7 years (regulatory)
- Background-check reports stored under Checkr's data residency; not duplicated
- Selfie/biometrics retained per state law (IL BIPA, TX CUBI consent)
- Reviews retained indefinitely; supplier may request removal via Trust & Safety appeal

## KPIs
| KPI | Target |
|---|--:|
| % suppliers fully verified | ≥98% |
| Median dispute resolution time | <7 days |
| Dispute rate (% bookings) | <1.5% |
| Chargeback rate | <0.5% |
| Repeat dispute by same party | <5% |
| Time-to-first-rating after service | <72h median |
| % bookings rated by both sides | ≥60% |

## Anti-patterns we will NOT do
- One-sided ratings only
- Hide bad reviews
- Allow direct supplier-buyer phone/email pre-booking
- Manual-only dispute resolution at scale
- Skip background checks for in-home suppliers
- De-platform without an appeal path

## References
- Joe Gebbia — "How Airbnb designs for trust" (TED 2016)
- Airbnb engineering — double-blind review reveal
- eBay feedback-score history (Resnick + Zeckhauser academic study)
- Sangeet Choudary — *Platform Scale*, trust scaffolding chapter
- Section 230 / DSA / DMCA — platform liability statutes
- COPPA + IL BIPA + TX CUBI — vulnerable-data laws

## 90-day build plan
- Week 1–2: Persona integration for ID + selfie
- Week 3–4: Checkr integration + supplier onboarding gate
- Week 5–6: Stripe Connect escrow + hold logic
- Week 7–8: Two-sided rating system + double-blind reveal
- Week 9–10: Dispute UX + mediation queue
- Week 11–12: Badge tier engine + display
```

## Verification
- Risk tier determined.
- Identity verification stack table.
- Rating system: scale, two-sidedness, reveal, decay, anti-gaming.
- Escrow vendor + hold window + dispute window.
- Badge tier table.
- Dispute escalation table with SLA + authority + % resolved.
- Comparator playbook ≥6 marketplaces.
- Trust-damage event playbook.
- Anti-pattern section present.
