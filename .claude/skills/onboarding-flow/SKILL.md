---
name: onboarding-flow
description: First-run UX. Empty states, sample data, tooltips, activation event tracking. Tied to analytics-spec funnel. Triggers on "onboarding", "first run UX", "empty state", "activation", "/onboarding-flow", before launch or after activation drop-off. Writes docs/design/onboarding.md.
output_size:
  XS: skip
  S: 1h
  M: 2h
  L: 4h
  XL: 6h
---

## Why you'd care

First-run experience is where activation lives — a bad empty state or missing sample data and the user bounces before they ever see value. The activation event tracking + tooltips are what convert install into use.

First-run user experience. Designs the path from "signed up" to "got value". Activation is where most products lose users â€” empty states, jargon, no sample data, friction. This skill forces explicit design of the first 5 minutes.

## When This Skill Applies

- User says "onboarding flow", "first run UX", "empty state", "user activation", "/onboarding-flow"
- Before public launch
- When activation rate (signup â†’ core action) < 40%
- After adding new core feature that needs intro
- After persona change (B2B â†’ B2C, or new audience)

## Prerequisites

- Core "aha moment" identified â€” the action that makes the product valuable
- `docs/design/analytics-events.md` exists with activation event named
- Wireframes for main screens exist (`docs/design/wireframes/`)

## Steps

1. Define **activation event**: the single action that proves the user got value (e.g., "first reservation booked", "first game played", "first scrape run", "first message sent"). One event, not five.
2. Map current path from signup â†’ activation event. Count steps. Identify drop-off candidates.
3. Identify each empty state on the path. List them. Empty states are usually onboarding's worst enemy.
4. Decide approach per empty state:
   - **Sample data** â€” pre-populate plausible content user can interact with immediately
   - **Skeleton with CTA** â€” explicit "do this next" button
   - **Inline tutorial** â€” micro-step guidance
   - **Demo mode** â€” sandbox version without commitment
5. Decide tooltip / coach-mark strategy:
   - **None** (default â€” UI is self-explanatory)
   - **First-run only** â€” dismissible, never resurfaces
   - **Progressive disclosure** â€” tooltips appear on feature first-use only
6. Define checklist / progress UI if multi-step (e.g., "1/4: Add your menu"). Avoid for < 3 steps.
7. Wire activation analytics: `signup_completed`, `<step>_completed`, `activation_event`, `activated_within_24h`. Match `analytics-spec`.
8. Define re-engagement: if user signed up but didn't activate, what email / in-app nudge fires (and when).
9. Write `docs/design/onboarding.md` with flow diagram + state-by-state spec.
10. Plan A/B test for first measurable change (sample data vs empty state, e.g.).

## Output Format

```markdown
# Onboarding Flow Design

**Last updated:** YYYY-MM-DD
**Activation event:** <e.g., "first_reservation_completed">
**Current activation rate:** <X%> (or "unknown â€” to measure")
**Target:** <e.g., 60% within 24h of signup>

## Activation Event

A user is "activated" when they complete: <specific event>.

This event:
- Is logged via `analytics.track('first_reservation_completed', {...})` in `lib/analytics.ts`
- Fires once per user (idempotent)
- Triggers post-activation flow (e.g., "next steps" email)

## Current Path (Pre-Onboarding Improvements)

1. Land on /signup â†’ fill form â†’ submit
2. Land on dashboard (empty)
3. ??? (drop-off here)
4. ??? (eventual reservation if user persists)

## Designed Path

1. **Land on /signup** â€” minimal fields (email + password). Defer profile fields to later.
2. **Email verification** â€” magic-link or 6-digit code. (Magic-link friction lower.)
3. **Welcome screen (first-run only)** â€” 1 sentence value prop + primary CTA "Make your first reservation".
4. **Dashboard with sample reservation** â€” pre-seeded fake reservation user can edit/delete to learn UI.
5. **Inline coach-mark on key action** â€” single tooltip pointing to "Book new" button. Dismissible.
6. **First real reservation** â†’ activation event fires.
7. **Post-activation modal** â€” "Next: invite a friend / set up payment / explore X". Soft, dismissible.

## Empty States

| Screen | State | Treatment |
|---|---|---|
| /dashboard | No reservations | Sample reservation card + "Book your first" CTA |
| /reservations | No history | Empty illustration + 1-line copy + CTA |
| /payments | No payment method | "Add card to enable feature X" with single CTA |
| /settings/notifications | No preferences | Pre-toggled defaults; user adjusts |

## Tooltip Strategy

- First-run only. No persistent tooltips after dismiss.
- Single tooltip per page on first visit; never more than 1 active.
- Dismiss = forever (per user, per tooltip).
- Skip-all link visible.

## Progress Checklist

```
[ ] Sign up
[x] Verify email
[x] Make first reservation
[ ] Add payment method
[ ] Invite a friend
```

Visible on dashboard until 3/5 complete; then hidden.

## Re-Engagement

| Trigger | Channel | Timing | Content |
|---|---|---|---|
| Signed up, not activated | Email | T+24h | "You're 1 step from <value>. Here's a 2-min walkthrough." |
| Signed up, not activated | Email | T+72h | "Need help? Reply to this email." (Personal-feeling) |
| Activated, then quiet 7d | Email | T+7d | "Did <feature> help? Here's what other users do next." |
| Activated, then quiet 30d | In-app + email | T+30d | "We miss you. Here's what's new." |

## Funnel Tracking

| Step | Event | Drop-off Target |
|---|---|---|
| Land on signup | `signup_viewed` | n/a |
| Submit signup | `signup_completed` | < 30% from view |
| Verify email | `email_verified` | < 20% from signup |
| Welcome dismissed | `welcome_dismissed` | < 10% from verified |
| Activation event | `first_reservation_completed` | < 40% from welcome |

Funnel viz in PostHog/Mixpanel: <link to dashboard>

## A/B Tests Planned

1. **Sample data vs empty state on dashboard** â€” hypothesis: sample data lifts activation 10pp.
2. **Magic-link vs password signup** â€” hypothesis: magic-link lifts signup completion 15pp.
3. **Welcome screen on/off** â€” hypothesis: welcome screen friction loses more than it teaches.

## Related Skills

- `analytics-spec` â€” events list + naming conventions
- `transactional-email` â€” re-engagement email templates
- `ui-wireframe` â€” empty state mockups
- `a11y-design` â€” onboarding flows must be keyboard-navigable

## Re-evaluate

After 30 days post-launch, after activation rate moves > 5pp, or when adding new core feature.
```

## Boundaries

- Does NOT do landing-page / acquisition design â€” onboarding starts post-signup.
- Does NOT decide pricing / tier â€” see `cost-model` + `terms-of-service`.
- Does NOT cover B2B sales-led onboarding (demos, CSM hand-off) â€” self-serve only.
- Does NOT design tooltip animations â€” basic show/hide; pair with `design-system`.

## Re-run Behavior

Update file in place. Track activation rate over time at the bottom â€” pattern reveals whether changes worked.

## Auto-chain

- Activation event undefined â†’ push back to `analytics-spec` first
- Re-engagement emails defined â†’ trigger `transactional-email`
- Empty state design â†’ `ui-wireframe` for those screens
- Activation drop > 5pp â†’ `pivot-decision` data input

## Example Trigger

> "Design an onboarding flow for the chess app â€” first-game-played is the activation event."
