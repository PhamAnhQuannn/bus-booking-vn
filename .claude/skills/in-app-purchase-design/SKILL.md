---
name: in-app-purchase-design
description: In-app purchase design across Apple App Store (StoreKit 2 + App Store Server API + ASSN v2 notifications) and Google Play (Billing Library v7+ + Real-time Developer Notifications). Covers product taxonomy (consumable / non-consumable / auto-renewing / non-renewing), receipt validation, restore-purchases, subscription state machine, refunds, promotional offers, family sharing, EU DMA / Reader / External Link entitlements, and middleware pick (RevenueCat / Glassfy / Adapty / DIY). Writes `docs/design/in-app-purchase-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "IAP", "StoreKit", "Play Billing", "subscriptions", "RevenueCat", "receipt validation", "auto-renew", "restore purchases", "promo offer", "/in-app-purchase-design", or before shipping any monetized mobile feature.
output_size:
  XS: skip
  S: 1h
  M: 3h
  L: 4h
  XL: 6h
---

# /in-app-purchase-design — In-app purchase design

## Why you'd care

Get StoreKit or Play Billing wrong and you ship a subscription product that silently drops renewals, fails to restore purchases, or rejects refunds — all of which trigger store review escalations and revenue loss. The state-machine spec catches the edges before they hit App Review.

Invoke as `/in-app-purchase-design`. IAP is the #1 mobile app rejection reason. Design before writing any paywall code or creating any product in App Store Connect / Play Console.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP
2. Read `docs/inception/pricing-model-<project>.md` if present.
3. Read `docs/release/app-store-review-prep-<project>.md` (rules 3.1.1 / 3.1.3 govern this).
4. Read `docs/design/data-model-design-<project>.md` (subscription state must integrate with user model).

## Inputs
- Pricing model: one-time, consumable (coins/credits), subscription (monthly/annual), freemium-with-upsell, free-trial, intro-pricing.
- Cross-platform expectation (does an iOS purchase need to unlock Android features?).
- Existing payment system (Stripe, etc.) on web — must coexist without violating store policy.
- Refund policy.
- Tax handling preference.
- Geographic scope (Apple/Google handle tax in most countries; some require self-collection).

## Process
1. **Product taxonomy (must match stores' types exactly)**:
   - **Consumable** (iOS) / **Consumable** (Android) — used up, repurchasable (coins, lives, boosts)
   - **Non-consumable** (iOS) / **Non-consumable** (Android) — permanent unlock (one-time pro upgrade); restorable
   - **Auto-renewable subscription** — recurring; Apple groups by Subscription Group (only one active at a time within group); Play groups by Base Plan
   - **Non-renewing subscription** (iOS only as type; Play uses recurring) — fixed-term, no auto-renew (rare; many use one-time)
2. **Pricing tiers**:
   - Apple uses "Price Points" (post-2023, no more tiers — any price); 1700+ currency-localized
   - Play uses "Default price" + per-country overrides
   - Match across stores within ±10% accounting for fee + tax variations
3. **Subscription mechanics (the hard part)**:
   - **Subscription Group / Base Plan**: bundle related SKUs (monthly + annual + trial = one group)
   - **Upgrade / Downgrade / Crossgrade** (within same group): Apple prorates immediately on upgrade; Play uses `ReplacementMode` (CHARGE_FULL_PRICE, CHARGE_PRORATED_PRICE, WITHOUT_PRORATION, DEFERRED)
   - **Free trial**: Apple "Introductory Offer" or "Promotional Offer"; Play "Free trial" base-plan offer; eligibility flagged via `eligibleForIntroOffer`
   - **Grace period**: 16 days iOS / configurable Play — billing retry while user retains access; tracked as `GRACE_PERIOD` state
   - **Billing retry**: Apple retries up to 60 days, Play up to 30 days
   - **Refunds**: Apple via App Store; Play user-self-service first 48h then via Console request; both can revoke entitlement via webhook
4. **State machine** (server-side source of truth):
   ```
   purchased → active → (renewing → active) | (in_grace → active|expired) | (billing_retry → active|expired) | (canceled → active until period end → expired) | refunded
   ```
5. **Receipt / token validation — server-side, always**:
   - **Apple App Store Server API** (replaces deprecated `verifyReceipt`) — JWS signed by Apple; verify with App Store Server Library (Swift/Java/Python/Node/Go available); JWT auth via App Store Connect key
   - **Apple ASSN v2** (App Store Server Notifications) — webhook events: `SUBSCRIBED`, `DID_RENEW`, `DID_FAIL_TO_RENEW`, `EXPIRED`, `GRACE_PERIOD_EXPIRED`, `REFUND`, `PRICE_INCREASE`, `REVOKE`, `CONSUMPTION_REQUEST`
   - **Google Play Developer API** — `purchases.subscriptionsv2.get` / `purchases.products.get`; OAuth 2.0 service account
   - **Play RTDN** (Real-time Developer Notifications) via Pub/Sub — `SUBSCRIPTION_PURCHASED`, `SUBSCRIPTION_RENEWED`, `SUBSCRIPTION_IN_GRACE_PERIOD`, `SUBSCRIPTION_PAUSED`, `SUBSCRIPTION_EXPIRED`, `SUBSCRIPTION_REVOKED`
   - **NEVER trust the client receipt alone** — always re-validate server-side and never grant entitlement based on `purchase.success` callback
6. **Idempotency**:
   - Server side, store `(platform, original_transaction_id|purchase_token, latest_transaction_id)` and reject duplicate processing
   - Webhook can fire multiple times; acknowledge then dedupe
7. **Restore Purchases (required by Apple 3.1.1)**:
   - Button "Restore Purchases" — calls `Transaction.currentEntitlements` (StoreKit 2) / `BillingClient.queryPurchasesAsync`
   - Cross-platform restore via user-account binding: tie purchase to user ID at purchase time; future device of same user sees entitlement
8. **Cross-platform entitlement**:
   - DO bind purchase to user account (post-auth, not anon)
   - User account has `entitlements[]` derived from union(iOS purchases, Android purchases, web purchases)
   - DO NOT trick the store by letting users pay on web and consume on iOS without the iOS purchase — that's 3.1.1 violation (except under External Link Account / EU DMA entitlements)
9. **External payment exceptions (2024+)**:
   - **Reader App** entitlement: media reader apps may link out (audiobooks, magazines)
   - **External Link Account** entitlement: link to website for sign-up/management (US, EU, others); requires entitlement + format compliance + 27% (US) or 17% (EU DMA) commission still owed on linked purchases (Apple changed terms post-Epic ruling)
   - **EU DMA**: alternative app stores + payment service providers permitted in EU; reduced commission tiers
   - **South Korea / Netherlands**: third-party billing under user-choice flows
   - **Play user-choice billing** (EEA, India, Indonesia, Brazil, Japan, S. Korea, Australia): allows alt billing with 4% Play fee reduction
10. **Middleware pick** — DIY is hard; middleware is the default:
    | Vendor | Cost | Best for |
    |---|--:|---|
    | **RevenueCat** | free <$2.5k MRR; 1% revenue above | most apps; gold-standard |
    | **Glassfy** | free <$10k MRR; 1.2% above | EU-friendly alt |
    | **Adapty** | free <$10k MRR; 1.2% above | strong A/B paywall tooling |
    | **Qonversion** | free <$10k MRR; 0.5–1% | analytics-first |
    | **Direct (StoreKit2 + Play Billing v7)** | $0 | only at scale + dedicated team |
    Middleware gives: unified API, webhook normalization, receipt validation, paywall A/B, cohort analytics, charts, churn analysis.
11. **Promotional offers**:
    - **Win-back offer** (Apple): targeted discount to lapsed subscribers
    - **Subscription offer codes**: redeemable codes for free/discounted access (great for influencer + customer support)
    - **Promo codes** (one-time): App Store Connect → Offers → Promotional Codes (up to 100/quarter per app)
12. **Family sharing**:
    - Apple Family Sharing for non-consumable + auto-renewable (opt-in per product)
    - Play does not currently have an equivalent — design your entitlement model to not rely on it

## Output
Write `docs/design/in-app-purchase-<project>.md`:

```markdown
# In-App Purchase Design — <project>
**Date:** <YYYY-MM-DD>

## Catalog
| Product | Type | iOS productId | Android productId | Price (USD) | Free trial |
|---|---|---|---|--:|---|
| Pro Monthly | auto-renewable | `pro.monthly` | `pro_monthly` | $9.99 | 7 days |
| Pro Annual | auto-renewable | `pro.annual` | `pro_annual` | $79.99 | 14 days |
| Pro Lifetime | non-consumable | `pro.lifetime` | `pro_lifetime` | $199.00 | — |
| 100 Coins | consumable | `coins.100` | `coins_100` | $0.99 | — |
| 500 Coins | consumable | `coins.500` | `coins_500` | $4.99 | — |
- Subscription group (iOS): `pro_tier` containing monthly + annual
- Base plan (Android): `pro_tier` with monthly + annual offers

## Subscription state machine
```
INACTIVE → PURCHASED → ACTIVE
ACTIVE → RENEWING → ACTIVE (loop)
ACTIVE → CANCELED (auto-renew off) → ACTIVE until period_end → EXPIRED
ACTIVE → BILLING_RETRY → ACTIVE | EXPIRED
ACTIVE → GRACE_PERIOD → ACTIVE | EXPIRED
ACTIVE → REFUNDED → REVOKED
ACTIVE → UPGRADED (to annual) → ACTIVE (new sku)
```
Entitlement boolean `pro_active = state ∈ {ACTIVE, BILLING_RETRY, GRACE_PERIOD}`.

## Source of truth
- DB table `subscriptions(userId, platform, productId, originalTxnId, latestTxnId, state, periodStart, periodEnd, autoRenewing, environment, lastEvent, raw)`
- DB table `purchases(userId, platform, productId, txnId, purchasedAt, refundedAt, raw)` — for consumables + non-consumables
- DB table `entitlements(userId, key, expiresAt)` — computed from above; queried by app via `/me/entitlements`

## Validation flow
1. Client `Transaction.updates` (iOS) / `purchasesUpdatedListener` (Android) fires
2. Client sends signed payload + userId to backend `POST /iap/verify`
3. Backend calls Apple App Store Server API / Play Developer API
4. Backend writes `subscriptions` / `purchases` row + `entitlements` recompute
5. Backend returns canonical entitlement to client
6. Client refreshes UI; never grants entitlement on its own
7. Webhook ASSN v2 / RTDN updates state asynchronously (renewals, grace, refunds)

## Webhook events handled
| Event | Apple | Play | Action |
|---|---|---|---|
| Initial purchase | SUBSCRIBED / ONE_TIME_CHARGE | SUBSCRIPTION_PURCHASED | create row, grant entitlement |
| Renewal | DID_RENEW | SUBSCRIPTION_RENEWED | extend periodEnd |
| Grace start | GRACE_PERIOD | SUBSCRIPTION_IN_GRACE_PERIOD | state=GRACE_PERIOD, keep entitlement |
| Billing retry | DID_FAIL_TO_RENEW | SUBSCRIPTION_ON_HOLD | state=BILLING_RETRY |
| Cancel (auto-renew off) | DID_CHANGE_RENEWAL_STATUS | SUBSCRIPTION_CANCELED | state=CANCELED, keep entitlement to periodEnd |
| Refund | REFUND | SUBSCRIPTION_REVOKED | state=REFUNDED, revoke entitlement, notify support |
| Price increase | PRICE_INCREASE | SUBSCRIPTION_PRICE_CHANGE_CONFIRMED | log, surface in app |
| Consumption | CONSUMPTION_REQUEST | — | reply with consumption status within 12h |

## Server-side validation libs
- iOS: `app-store-server-library-node` (official Apple Node)
- Android: `googleapis` Node SDK `androidpublisher_v3`
- Time skew: tolerate ±5 min on receipt-time validation
- Sandbox vs production: distinguish by `environment` field, never cross-grant

## Restore Purchases
- UI: Settings → "Restore Purchases" button (required by 3.1.1)
- iOS impl: `Transaction.currentEntitlements`
- Android impl: `BillingClient.queryPurchasesAsync(SUBS)` + `queryPurchasesAsync(INAPP)`
- After client gathers, POST to `/iap/restore` → backend re-validates → entitlement
- Cross-device: also fetch entitlements from `/me/entitlements` on every cold start for signed-in user

## Cross-platform entitlement
- Bind every purchase to authed userId via `appAccountToken` (iOS UUID, passed in `Product.PurchaseOption.appAccountToken`) and `obfuscatedAccountId` (Android)
- Anonymous purchase: store device-scoped entitlement; merge on sign-in
- Web purchase (Stripe) → same `entitlements` table; user logs in on mobile and entitlement applies
- Conflict resolution: if user buys on both iOS and web, both stay paid until one is canceled; do not double-charge intentionally

## Refund policy
- Apple: user-self via App Store; we honor `REFUND` webhook → revoke + email
- Play: user-self first 48h; later via Console; we honor `SUBSCRIPTION_REVOKED` webhook
- In-app "Help with this purchase" → link to Apple/Play refund flow (NOT a custom flow)
- Track refund rate; if >2% by SKU, audit paywall + delivery

## Promotional offers
- New customer intro offer: 7-day free trial on monthly; 14-day on annual
- Win-back offer (Apple): 50% off first 3 months — targeted at lapsed users via Customer.io trigger
- Promo codes for support: 1-month free; 50 codes/quarter reserve

## Paywall A/B
- Surface: post-onboarding, post-free-action-limit, settings
- Variants: monthly-first / annual-first, with/without testimonials, with/without price-strike
- Tool: RevenueCat Paywalls + PostHog cohort; minimum 7-day cohort to read signal

## Cross-platform pricing parity
| Tier | iOS price | Android price | Web price |
|---|--:|--:|--:|
| Monthly | $9.99 | $9.99 | $9.99 |
| Annual | $79.99 | $79.99 | $79.99 |
| Lifetime | $199.00 | $199.00 | $199.00 |
- Note: Apple takes 30% (or 15% small-biz / post-Y1); Play 15-30% similarly; web is full revenue. Net margins differ.

## Middleware decision
- Pick: **RevenueCat** — free tier <$2.5k MTR, 1% above
- Why: unified API, ASSN+RTDN normalized, paywall component, churn analytics, A/B testing built-in
- Alternative if cost-sensitive at scale: direct StoreKit 2 + Play Billing v7 — re-evaluate at $50k MRR

## Reviewer-notes for store submission
- Sandbox test user (App Store Connect → Users and Access → Sandbox Testers): `iap-sandbox+may2026@<project>.com`
- Play license-test account configured at Play Console → Setup → License testing
- Demo: how to reach paywall — see `app-store-review-prep-<project>.md`

## EU DMA / External Link decision
- v1.0: standard StoreKit / Play Billing only — no External Link Account entitlement
- Re-evaluate post-launch: in EU, savings of ~10–13 points per transaction worth the engineering + accounting overhead
- Hard rule: no in-app prompts to "subscribe on our website" except under entitlement (3.1.3) — will trigger rejection

## Observability
| Event | Source |
|---|---|
| `iap.paywall.view` | client |
| `iap.purchase.intent` | client (tap buy) |
| `iap.purchase.success` | client |
| `iap.purchase.cancel` | client |
| `iap.purchase.error` | client |
| `iap.server.validated` | server |
| `iap.subscription.renewed` | server (webhook) |
| `iap.subscription.canceled` | server (webhook) |
| `iap.subscription.refunded` | server (webhook) |
| `iap.entitlement.granted` | server |
| `iap.entitlement.revoked` | server |

## KPIs to track
- Free → paid conversion (24h, 7d, 30d window)
- Trial start → paid conversion (post-trial 7d)
- D1/D30/D90 retention by SKU
- MRR, ARR, ARPU, churn (gross + net)
- Refund rate per SKU
- Renewal rate by cohort

## Cost
| Item | Cost |
|---|--:|
| Apple commission | 30% std, 15% small business + post-Y1 |
| Play commission | 30% std, 15% first $1M/yr, 15% post-Y1 |
| RevenueCat | free <$2.5k MTR; 1% rev above |
| Tax handling | Apple/Play handle most jurisdictions |
| App Store Server Library | $0 OSS |

## Risk if skip / mis-implement
- 3.1.1 rejection cycle adds 1–2 weeks
- Client-only validation → trivial entitlement bypass via Jailbreak / objection / Lucky Patcher
- No restore-purchases button → guaranteed rejection
- Linking out to web payment without entitlement → app removed
- Misusing trial eligibility check → trial-abuse via account churn
- Webhook idempotency bug → double-grant entitlement on retried delivery
- Sandbox vs production env mix → granting prod entitlement on sandbox purchase = revenue leak
- Apple/Play price changes without RTDN handling → user kicked out unexpectedly
- Ignoring `CONSUMPTION_REQUEST` (Apple) → loss of refund disputes by default

## Verification
- Product catalog matches App Store Connect + Play Console exactly
- Subscription state machine drawn
- Webhook handlers exist for every event in the table
- Server-side validation never trusts client receipt alone
- Idempotency key (originalTransactionId / purchaseToken) enforced
- Restore Purchases button exists in Settings
- Cross-platform entitlement model documented
- Reviewer notes contain working sandbox account
- Middleware picked + cost line item
```

## Verification
- Product catalog table includes both iOS + Android IDs.
- Subscription state machine includes grace, billing-retry, refund states.
- Server-side validation flow described with both Apple and Google APIs.
- Webhook event table maps Apple ↔ Play ↔ action.
- Restore Purchases UX described.
- Cross-platform entitlement (web + iOS + Android) strategy documented.
- Promo / trial mechanics covered.
- Middleware vendor picked with cost.
- KPIs and observability events enumerated.
