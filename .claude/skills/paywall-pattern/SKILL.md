---
name: paywall-pattern
description: Paywall pattern + placement design. Free / freemium / metered / soft / hard / contextual. Where, when, what to gate, copy, retry path, downgrade flow. Outputs `docs/design/paywall.md` with model + placement matrix + screen specs + no-dark-patterns floor. Use when user says "paywall", "monetization gate", "freemium", "free trial", "subscription gate", "upgrade gate", "/paywall-pattern", or before adding any paid tier UI.
output_size:
  XS: skip
  S: 1h
  M: 2h
  L: 3h
  XL: 4h
---

# Paywall Pattern

Paywall is monetization made visible. Wrong model leaks revenue; wrong placement kills activation. This skill picks the model, decides which features are gated, designs the screens, and locks the no-dark-patterns floor (no fake free, no surprise charges, no hostile cancellation).

## Why you'd care

A paywall in the wrong spot loses both the conversion and the goodwill. Designed deliberately, it captures revenue without training users to bounce — and stays clear of dark-pattern complaints that draw regulator attention.

## When This Skill Applies

Activate when:
- User says "paywall", "monetization gate", "freemium", "free trial", "subscription gate", "upgrade gate", "/paywall-pattern"
- First time adding paid tiers
- Re-design after low conversion or high churn
- Adding a new gated feature
- App store review prep (iOS / Play paywall guidelines)

## Prerequisites

- Pricing model decided (`docs/inception/pricing-model.md` or equivalent).
- Tier definition (Free / Pro / Team / Enterprise).
- Decision: trial type (no trial / time-trial / metered-trial / freemium-forever).
- Feature inventory + tier mapping.
- A11y + i18n requirements (price formatting per locale).

## Steps

1. **Pick gate model.** Hard wall (auth+pay before any value) / Soft wall (some value, then gate) / Metered (n free uses then gate) / Freemium (free tier forever, paid for advanced) / Time trial.
2. **Map gated features.** Per feature: tier required, gate type (hide / disable / preview-only), upsell trigger.
3. **Pick placement.** Where the paywall appears: post-onboarding, on-feature-tap, after-quota, in-context modal, dedicated /upgrade page, settings.
4. **Design the paywall screen.** Plan cards, value props, social proof, CTA, secondary action (close / "not now").
5. **Restore-purchase path.** Mandatory on iOS App Store; standard for cross-device.
6. **Cancellation / downgrade UX.** Self-serve, no dark patterns, immediate or end-of-period.
7. **Failed-payment recovery.** Dunning UI, retry CTA, grace period, lock-out.
8. **Copy.** No bait ("Free!" then surprise), no FOMO timers if not real, no manipulative defaults.
9. **A11y + i18n.** Price localization, currency announcement, modal focus trap.
10. **Write** `docs/design/paywall.md`.
11. **Auto-chain.** Subscription endpoint → `/api-contract`. Per-screen → `/ui-wireframe`. Iap → app-store-review-prep.

## Output Format — `docs/design/paywall.md`

```markdown
---
last-updated: YYYY-MM-DD
status: draft | reviewed | implemented
model: freemium + metered (3 free actions/month, then upgrade)
tiers: Free, Pro ($9/mo), Team ($29/mo)
billing: Stripe (web), App Store IAP (iOS), Play Billing (Android)
---

# Paywall

## Gate Model

**Freemium with metered cap on premium actions.**

Rationale:
- Free tier provides ongoing value (read, browse, create up to 3 items/month) → activation path stays open.
- Metered cap on premium action (export, AI-assist, advanced filter) → natural upgrade trigger when user gets value.
- No hard wall pre-value: kills SEO + word-of-mouth signups.
- No time-trial: users forget, billed unexpectedly = chargebacks + reviews.

## Tier x Feature Matrix

| Feature | Free | Pro | Team |
|---------|------|-----|------|
| Browse, search | ✓ | ✓ | ✓ |
| Create up to 3 items/month | ✓ | unlimited | unlimited |
| Export to CSV | gated | ✓ | ✓ |
| AI-assist suggestions | preview-only (1 free demo) | ✓ | ✓ |
| Advanced filters | gated | ✓ | ✓ |
| Team workspace | gated | gated | ✓ |
| Audit log | gated | gated | ✓ |
| Priority support | — | ✓ | ✓ |
| SSO | gated | gated | upsell to Enterprise |

Gate types:
- **gated**: feature button visible but tap → upgrade modal.
- **preview-only**: full UI shown with "Upgrade to Pro to use" overlay; primary CTA disabled.
- **hidden**: feature absent from UI on free tier (avoid — discoverability of paid value drops).

## Placement Map

| Trigger | Placement | Type |
|---------|-----------|------|
| Tap "Export CSV" on Free | inline modal | contextual upsell |
| 3 free items reached this month | full-screen takeover after attempting 4th | quota gate |
| Tap "AI suggest" first time on Free | inline preview modal showing 1 free demo + upgrade CTA | tease + upsell |
| Settings → Plan | dedicated `/settings/plan` screen | self-serve upgrade |
| Onboarding (post-signup) | NO paywall | (anti-pattern: pre-value walls) |
| Failed payment | banner on every screen | dunning |
| Trial expiring (n/a — no trial) | n/a | n/a |

## Paywall Screen Spec

`/upgrade` (dedicated) AND inline modal variant.

### Layout

- Header: "Unlock Pro" + close button (top-right, always available)
- Value props (3 max, scannable):
  - "Unlimited items"
  - "AI suggestions"
  - "Export anywhere"
- Plan cards (Pro, Team) — Pro highlighted as "Most popular"
- Each card: name, price (with billing period), 3-5 feature bullets, CTA "Choose Pro"
- Toggle: Monthly / Yearly (yearly shown with savings badge)
- Below cards: "Restore purchase" link (always visible)
- Footer: terms link, privacy link, "Manage subscription anytime"

### CTA

- Primary: "Choose Pro" → checkout (Stripe / IAP).
- Secondary: "Maybe later" (closes modal; sends to last screen).
- No "Continue with limited features" deceptively styled as primary.

### Copy Rules

- Real prices, real currency, real billing period — no "/year" hidden after "/month".
- No countdown timers unless the offer actually expires.
- No "27 people upgraded today" unless tracked + true + per locale.
- No pre-checked boxes for upsell add-ons.
- Cancellation policy 1 click away; phrased neutrally.

## Restore Purchase

- iOS: mandatory per App Store guideline 3.1.1 — link visible on paywall + settings.
- Cross-device: triggered by sign-in; entitlement re-fetched from server.
- Web: re-auth → reconciliation runs.
- Failure copy: "Couldn't restore — try again or contact support."

## Cancellation / Downgrade

- Self-serve from `/settings/plan`.
- Cancel reduces tier at end of current period (no immediate revoke).
- Confirm modal once: "Cancel Pro? You'll keep access until <date>." → "Confirm cancel" / "Keep Pro".
- No retention dark patterns: no "Are you really sure" loops, no forced survey, no hidden close button.
- Receipt of cancellation sent by email.
- Downgrade Pro → Free immediately on cancel-end-of-period; data preserved (read-only beyond Free quota).

## Failed Payment / Dunning

- 1st fail: in-app banner "Payment failed — update card" + email. Retry in 3d.
- 2nd fail: same + grace period started (7d full access).
- 3rd fail: lock down to Free tier; entitlement revoked; data preserved; banner persists with "Reactivate" CTA.
- No surprise charges: changes to billing always require user-initiated checkout.

## Quota Gate UX

When user hits cap (3rd item created on Free):

- Allow the action that hit the cap (don't yank mid-flow).
- Immediately after: full-screen overlay "You've reached your monthly limit. Upgrade to Pro for unlimited."
- Close button → returns to last screen with cap badge in header.
- Cap resets first of month UTC; show next reset date in upgrade modal.

## Per-Tier Empty States

| Tier | "no items" | "feature locked" |
|------|-----------|------------------|
| Free | "No items yet — create one (3 free/month)" | "AI suggestions are a Pro feature. [Try a free demo]" |
| Pro | "No items yet — create one" | n/a |

## A11y

- Modal: `role="dialog" aria-modal="true" aria-labelledby="paywall-heading"` + focus trap.
- Plan cards: each is a `<button>` or radio in a labelled group.
- Price: text + `aria-label="9 dollars per month"` (no symbol-only announcement).
- Restore + close always reachable by Tab in 2 stops.
- Reduced motion: no card-flip animation; instant select.

## i18n

- Price + currency from server (locale-aware).
- Currency code shown next to symbol on first paint (€9 EUR / $9 USD).
- Region-locked plans hidden if not eligible.
- "/month" / "/year" localized.

## Out of Scope

- Coupon codes (post-MVP).
- Referral discounts (separate flow).
- Enterprise sales (sales-led, not paywall).

## Open Questions

- Yearly default toggle on or off? Default OFF (per non-deception); A/B post-launch.
- Show monthly cost on yearly card? Yes — "$90/yr ($7.50/mo)" reduces sticker shock honestly.
- iOS price-tier mapping for non-USD regions? Use App Store auto-conversion tier.
```

## Boundaries

- **No dark patterns.** Hidden close, fake countdowns, pre-checked upsells, hostile cancel = automatic reject.
- **One paywall per file** unless tiers diverge dramatically (consumer vs enterprise = separate files).
- **Price is final from server.** Don't hardcode in UI; locale + region affect.
- **Restore-purchase always visible.** Required on iOS, expected everywhere.
- **No code.** Pricing logic + entitlement check downstream.

## Re-run Behavior

- Read existing first; surface diff.
- Bump `last-updated`.
- Re-evaluate when adding tier or gated feature.

## Auto-chain

- Subscription / entitlement endpoint → `/api-contract`.
- Per-screen → `/ui-wireframe`.
- iOS / Android IAP → `app-store-review-prep`.
- New copy → `/cta-hierarchy` if button weight competes.

## Example Trigger

User: "design the paywall for our freemium product"
→ Pick model, map features × tiers, design paywall + cancellation + dunning, write `docs/design/paywall.md`.
