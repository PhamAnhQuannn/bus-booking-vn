---
name: a11y-design
description: Accessibility design pass per screen or feature. Capture keyboard map, ARIA roles, focus order, color contrast, screen-reader script, motion/reduced-motion. WCAG 2.2 AA target. Use when user says "accessibility", "a11y", "WCAG", "screen reader", "keyboard nav", "/a11y-design", or before shipping any consumer-facing UI. Writes docs/design/a11y-<feature>.md.
output_size:
  XS: skip
  S: 1h
  M: 2h
  L: 4h
  XL: 6h
---

# A11y Design

## Why you'd care

A11y bugs caught after launch turn into refactors, legal letters, and re-shoots — not patches. Designing keyboard order, ARIA, and contrast before code costs hours; bolting them on after costs sprints and a public statement.

Accessibility design before code. WCAG 2.2 Level AA target. Output is a design contract â€” *not* an audit. Audit comes later via axe-core/Lighthouse.

## When This Skill Applies

Activate when:
- User says "accessibility", "a11y", "WCAG", "screen reader", "keyboard nav", "ARIA", "/a11y-design"
- Wireframe done, before component implementation
- Form-heavy or interactive screens (checkout, sign-up, search)
- Custom components (not stock shadcn primitives)
- Pre-launch consumer-facing review
- Legal / compliance ask (ADA, EAA, AODA)

## Prerequisites

- Wireframe exists for the screen (`docs/design/wireframes/<screen>.md`).
- Design system tokens decided (run `/design-system` first if no token doc).
- Decision: target = WCAG 2.2 AA (default) or AAA. Confirm if unclear.

## Steps

1. **Identify scope.** One feature or screen per file. Compose by linking from parent feature doc.
2. **Map keyboard interaction.** Tab order, shortcuts, escape behavior, trap zones (modals).
3. **Assign ARIA roles + landmarks.** Use native HTML first (`<button>`, `<nav>`, `<main>`); ARIA only when no native equivalent.
4. **Define focus management.** What gets focus on mount? On modal open? On error? On route change?
5. **Verify contrast.** All text vs background â‰¥ 4.5:1 (normal) or 3:1 (large/bold â‰¥18px). Reference design-system tokens; flag violators.
6. **Write screen-reader script.** What does VoiceOver/NVDA announce when traversing? Catches missing labels.
7. **Define motion behavior.** Honor `prefers-reduced-motion`. List animations + their reduced-motion fallbacks.
8. **Specify error UX.** Where does focus go on validation fail? How are errors associated with fields (`aria-describedby`)?
9. **Touch targets.** Minimum 44Ã—44 CSS pixels per WCAG 2.5.5.
10. **Write** `docs/design/a11y-<feature>.md` (create dir if missing).
11. **Auto-chain.** New ARIA pattern â†’ flag for design-system. Custom widget â†’ suggest `/edge-case-enum` for keyboard edge cases.

## Output Format â€” `docs/design/a11y-<feature>.md`

```markdown
---
feature: checkout-payment
target: WCAG 2.2 AA
last-updated: YYYY-MM-DD
status: draft | reviewed | implemented
---

# A11y Design: Checkout Payment

Wireframe: docs/design/wireframes/checkout-payment.md

## Landmarks

| Element | Role / Tag |
|---------|-----------|
| Page header | `<header>` |
| Main content | `<main>` |
| Booking summary aside | `<aside aria-label="Booking summary">` |
| Form region | `<form aria-labelledby="payment-heading">` |

## Keyboard Map

| Key | Context | Action |
|-----|---------|--------|
| Tab | global | Move focus forward through interactive elements |
| Shift+Tab | global | Move focus backward |
| Enter | on Pay button | Submit form |
| Enter | on radio | Select method |
| Arrow Up/Down | on radio group | Move between methods |
| Esc | hold-expired modal | (no dismiss â€” modal forces redirect) |
| Esc | error toast | Dismiss toast |

## Tab Order

1. "Back" link
2. Payment method radio group (single tab stop, arrow keys to navigate)
3. Stripe card iframe (delegates internal tab order to Stripe)
4. "Pay" button
5. ToS link

## Focus Management

| Trigger | Focus moves to |
|---------|----------------|
| Page mount (loading done) | First radio in payment method group |
| Validation error | First field with error, announced via aria-live |
| Hold-expired modal opens | Modal heading (focus trap inside modal) |
| Modal closes (timeout, redirect) | N/A â€” page navigates away |
| Stripe iframe error | Inline error text below iframe, focus moves to error |

## ARIA Pattern Reuse

| Pattern | Source | Notes |
|---------|--------|-------|
| Radio group | shadcn RadioGroup (Radix) | already a11y-correct |
| Modal | shadcn Dialog (Radix) | focus trap built-in |
| Toast | shadcn Sonner | role="status" + aria-live="polite" |
| Countdown | custom | role="timer", aria-live="off" until â‰¤60s, then polite |

## Screen Reader Script (VoiceOver, expected announcement order)

Worked example uses a **perishable-hold checkout** (resource reserved for N minutes pending payment). Same mechanic instantiates as event-ticket / appointment-slot / hotel-room / parking-spot / restaurant-table — substitute `<Resource>` per vertical; ARIA, focus, and timer logic stay identical.

1. "Checkout Payment, heading level 1"
2. "Order summary, complementary"
3. "1× <Resource> — 2026-05-12 19:00, total $29.00"
4. "Hold expires in 4 minutes 32 seconds, timer"
5. "Payment method, radio group"
6. "Credit card, selected, 1 of 3"
7. "Stripe card input frame" (Stripe's internal a11y handles inner)
8. "Pay $29.00, button"
9. "By paying you agree to terms of service"

## Color Contrast Check

| Foreground | Background | Ratio | Pass AA? |
|------------|------------|-------|----------|
| text-default (#1A1A1A) | bg-default (#FFFFFF) | 17.8:1 | âœ… |
| text-muted (#6B7280) | bg-default (#FFFFFF) | 4.83:1 | âœ… normal text |
| text-error (#DC2626) | bg-default (#FFFFFF) | 4.50:1 | âœ… exactly at threshold |
| text-on-primary (#FFFFFF) | bg-primary (#0F172A) | 17.4:1 | âœ… |
| countdown-warn (#F59E0B) | bg-default (#FFFFFF) | 2.1:1 | âŒ â€” fails AA, change to #B45309 |

Action: bump countdown-warn token from #F59E0B to #B45309 in design-system.

## Motion

| Animation | Default | prefers-reduced-motion |
|-----------|---------|-------------------------|
| Spinner on Pay | rotate 1s loop | static spinner icon, no rotate |
| Modal open | fade+scale 200ms | fade only |
| Countdown pulse (â‰¤60s) | pulse 1s loop | no pulse, color change only |
| Toast slide-in | slide 250ms | fade only |

## Touch Targets

All interactive elements verified â‰¥ 44Ã—44 CSS px:

| Element | Width Ã— Height | OK? |
|---------|----------------|-----|
| Back link | 44 Ã— 44 (padded hit area) | âœ… |
| Method radio | 24 Ã— 24 visual + 44 Ã— 44 hit area | âœ… |
| Pay button (mobile) | 100% Ã— 48 | âœ… |
| ToS link | 44 Ã— 44 hit area | âœ… |

## Forms & Errors

- Each input has visible label (no placeholder-as-label).
- Errors via `aria-describedby` pointing to error element with `role="alert"`.
- Error summary at top of form on submit fail (links to fields).
- `aria-invalid="true"` on failed field until fixed.
- Required fields marked with `aria-required="true"` AND visible "*" or "(required)".

## Internationalization

- Lang attribute set on <html lang="vi"> or "en" per user pref.
- No text in images.
- Currency announced as locale-currency name (e.g. "dollars", "euros", "yen", "dong") via aria-label keyed off `<html lang>` — see `/i18n-design`.

## Out of Scope

- Color-blind simulation (separate audit step).
- Cognitive accessibility (clear language) â€” covered by content design.
- Dyslexia font option (post-launch).

## Open Questions

- Skip-to-main-content link site-wide? Add to layout, not per screen.
- High-contrast mode support? Defer; stock shadcn handles via system pref.
```

## Boundaries

- **Design contract, not audit.** Pre-implementation spec. Post-implementation use axe-core / Lighthouse.
- **Native HTML first.** ARIA only when no semantic HTML fits. Bad ARIA worse than no ARIA.
- **Don't redesign visuals here.** If contrast fails, flag the token; don't pick new color in this skill.
- **One target level per file.** AA default. AAA only when explicitly asked.
- **No code.** Component impl is downstream.

## Re-run Behavior

- If file exists, read first. Surface diff vs proposed.
- Bump `last-updated`.
- Status: draft â†’ reviewed â†’ implemented (after axe scan passes).

## Auto-chain

- Contrast fails â†’ flag token in design-system, suggest `/design-system` re-run.
- Custom widget pattern â†’ flag for design-system reuse pattern entry.
- Forms â†’ suggest `/edge-case-enum` (keyboard-only user, screen-reader user, color-blind user).
- Pre-launch â†’ run axe-core via Playwright (manual, not yet a skill).

## Example Trigger

User: "do the a11y pass for the checkout payment screen"
â†’ Read wireframe + design-system, map keyboard + ARIA + focus + contrast + screen-reader script, write `docs/design/a11y-checkout-payment.md`.
