---
name: upgrade-prompt-ux
description: In-product upgrade nudge UX. Contextual upsell, banner, badge, modal, post-action prompt. Frequency cap, dismissibility, anti-spam floor, no-dark-patterns. Outputs `docs/design/upgrade-prompts.md` with prompt catalog + trigger map + frequency rules + copy + a11y. Use when user says "upgrade prompt", "upsell nudge", "in-product upsell", "promotion banner", "upgrade CTA", "/upgrade-prompt-ux", or when adding revenue-driving prompts to a free tier.
output_size:
  XS: skip
  S: 1h
  M: 2h
  L: 3h
  XL: 4h
---

# Upgrade Prompt UX

The line between "helpful nudge" and "harassment" is frequency × relevance × dismissibility. This skill defines the prompt catalog, when each fires, how often a user sees them, what counts as dismissed, and the anti-pattern floor (no fake-Xs, no auto-reappearance).

## Why you'd care

Upgrade prompts done wrong train users to bounce on the free tier and complain about dark patterns. Done right, with a frequency cap and contextual triggers, they convert without poisoning the relationship.

## When This Skill Applies

Activate when:
- User says "upgrade prompt", "upsell", "in-product upsell", "nudge", "promotion banner", "/upgrade-prompt-ux"
- Free tier exists and we want conversion
- Existing prompts feel spammy → audit
- Adding new gated feature
- Post-paywall design (paywall is the destination; this is the road)

## Prerequisites

- `docs/design/paywall.md` exists (we're sending users there).
- Tier x feature matrix.
- Analytics in place (`docs/design/analytics-events.md`) — frequency cap depends on event tracking.
- Decision: cap rule (default: max 1 prompt / surface / day; max 3 prompts / session).

## Steps

1. **Catalog prompt types.** Banner / inline badge / modal / post-action toast / contextual tooltip.
2. **Trigger map.** Per prompt: what user behavior triggers it.
3. **Relevance rule per trigger.** Tie to the user's just-completed action; never random.
4. **Frequency cap.** Per-prompt + global per-user-per-day + per-session.
5. **Dismissal semantics.** "Maybe later" vs "Don't show again" vs "Snooze 7 days".
6. **Copy.** Specific value prop, no FOMO unless real, no manipulative defaults.
7. **A11y.** Banners use `role="region"` with label; modals trap focus.
8. **Write** `docs/design/upgrade-prompts.md`.
9. **Auto-chain.** Each prompt's events → `/analytics-spec`. Modal patterns → `/state-pattern-catalog`.

## Output Format — `docs/design/upgrade-prompts.md`

```markdown
---
last-updated: YYYY-MM-DD
status: draft | reviewed | implemented
paywall: docs/design/paywall.md
analytics: docs/design/analytics-events.md
---

# Upgrade Prompts

## Prompt Catalog

| ID | Type | Where | Dismissible | Re-show |
|----|------|-------|-------------|---------|
| quota-near-banner | banner (top of screen) | feed when ≥80% quota | yes (×) | next session if still ≥80% |
| quota-hit-modal | modal (full-screen takeover) | after action that hit quota | yes (×) | only when user attempts gated action again |
| feature-locked-inline | inline badge on disabled control | settings, advanced filter | n/a (passive) | always shown to free users |
| post-success-toast | toast w/ "Upgrade for unlimited" | after a free-tier successful action | yes (auto-dismiss 5s OR ×) | max 1 / day |
| onboarding-tour-step | tour card mentioning Pro features | last step of onboarding only | yes ("Skip") | once ever |
| anniversary-modal | modal on 7-day mark of free use | session start | yes ("Maybe later") | once ever |
| empty-state-cta | tertiary link in empty state | empty workspace, empty feed | n/a (passive) | always |
| dunning-banner | banner (top of every screen) | active payment-failure | NOT dismissible | until payment resolves |

## Trigger Map (event → prompt)

| Event | Prompt fired | Conditions |
|-------|--------------|------------|
| `quota.usage_changed` ≥80% | quota-near-banner | once per session, free tier only |
| `quota.exceeded` | quota-hit-modal | every attempt that exceeds, until resolved |
| `feature.locked_tap` | inline preview if available, else paywall modal | every tap |
| `action.completed` (free tier) | post-success-toast | max 1 / day, max 3 / session globally |
| `onboarding.last_step` | onboarding-tour-step (Pro mention) | once |
| `account.age_days` == 7 | anniversary-modal | once |
| `payment.failed` | dunning-banner | until resolved |

## Frequency Caps

Global rules:
- Max 3 upgrade prompts per session (any type).
- Max 1 modal-type per day per user.
- Banners cap at 1 visible at a time (priority: dunning > quota-hit > quota-near).
- Toasts cap at 1 / day per type.

Per-prompt-type cap takes precedence over global if stricter.

## Dismissal Semantics

| Action | Effect |
|--------|--------|
| Click `×` on banner | hide for current session; re-eligible next session if trigger still true |
| Click `×` on modal | hide for current trigger; re-eligible on different trigger |
| Click "Maybe later" | snooze 7 days for that prompt id |
| Click "Don't show again" (only on anniversary modal) | permanent suppression for that id |
| Toast auto-dismiss (5s) | not counted as dismissal — re-eligible per cap |

Track `prompt.dismissed { id, method, snooze_until }` in analytics.

## Copy Catalog

### quota-near-banner
- Title: "You've used 8 of 10 free items this month"
- Body: "Upgrade to Pro for unlimited."
- CTA: "See plans" (secondary button)
- Dismiss: × icon

### quota-hit-modal
- Title: "Free limit reached"
- Body: "You've created 10 items this month — your limit on the Free plan. Upgrade to Pro to keep going."
- Primary CTA: "Choose Pro" (→ /upgrade)
- Tertiary: "Wait until next month" (closes modal)
- Footer: "Limit resets on <date>"

### post-success-toast
- "Item created. Pro plan removes monthly limits — see plans"
- Auto-dismiss 5s
- "see plans" is a link inside the toast

### feature-locked-inline
- Inline badge next to disabled control: "Pro" with lock icon
- Hover/focus tooltip: "Upgrade to use this feature"
- Click → upsell modal

### anniversary-modal
- Title: "You've been here 7 days. Welcome 👋" (only emoji if user-style allows; default no)
- Body: "If our Free plan is working — keep going. If you're hitting limits often, Pro starts at $9/mo with unlimited items + AI suggestions."
- Primary: "See Pro" (→ /upgrade)
- Tertiary: "No thanks" + checkbox "Don't show again"

### dunning-banner
- "Payment failed. Update your card to keep Pro."
- CTA: "Update card" (→ /settings/billing)
- Not dismissible

## Anti-Patterns (forbidden)

- Fake close button that opens upsell instead.
- Auto-reopening dismissed modal in same session.
- Misleading "Free for 30 days" if trial isn't real.
- Dark-pattern defaults (pre-checked "Subscribe to Pro" on signup).
- Blocking critical user actions behind dismissable upsell ("first close this ad to save your work").
- Implying loss of data if user doesn't upgrade unless literally true.
- Countdown timers on upgrade offer that don't actually expire.

## A11y

- Banners: `role="region" aria-label="Promotional message"` + dismiss button has `aria-label="Dismiss promotion"`.
- Modals: focus trap; Esc closes; first focusable = primary CTA.
- Toasts: `role="status" aria-live="polite"`; not for critical info (uses banner instead).
- Inline badge: `aria-label="Pro feature"` on the badge; disabled control has `aria-disabled="true"` + describedby pointing to upsell tooltip text.
- Reduced motion: no slide-in animation; instant appearance.

## Per-Prompt KPI Tracking

Per analytics-events.md, track:
- `prompt.shown { id, trigger, surface }`
- `prompt.cta_clicked { id }`
- `prompt.dismissed { id, method }`
- `prompt.converted { id, plan }` (within 24h of CTA click)

Conversion rate = `converted / shown` per id. Kill prompts with <0.5% CR after 30 days + 1k impressions (likely just noise).

## Anti-Spam Audit Cadence

Quarterly:
- Review user-segment "shown ≥10 prompts last 30d" — if conversion <2%, reduce frequency.
- Review NPS detractors for "ad spam" / "annoying" mentions.
- Confirm no prompt has bypassed the global cap due to a bug.

## Out of Scope

- Marketing emails (separate transactional-email + lifecycle-email skills).
- Push notifications for upgrade (push-notification-design).
- Pricing page itself (paywall.md).

## Open Questions

- A/B which prompts to enable per cohort? Defer until stable baseline.
- Fire post-success-toast only on Nth success or every? Default Nth (3rd onward) — first 2 are noise.
```

## Boundaries

- **Relevance is mandatory.** Random "upgrade!" interstitials = forbidden.
- **One blocking modal per trigger.** Quota-hit fires once per quota-hit, not on every screen mount.
- **All prompts dismissible** EXCEPT compliance/dunning (failed payment, account warning).
- **No fake urgency.** Countdowns must be real; copy must be true.
- **No code.** Trigger plumbing downstream.

## Re-run Behavior

- Read existing first; surface diff.
- Bump `last-updated`.
- Re-evaluate quarterly per anti-spam audit.

## Auto-chain

- Each prompt's events → `/analytics-spec`.
- Modal / banner / toast patterns → `/state-pattern-catalog`.
- Copy review → brand-voice-charter if exists.
- Conversion tracking → `/analytics-spec` funnel.

## Example Trigger

User: "design the upgrade prompts for our free tier"
→ Catalog prompt types, map triggers, set frequency caps, write copy + a11y, write `docs/design/upgrade-prompts.md`.
