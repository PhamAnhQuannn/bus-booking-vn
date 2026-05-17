---
name: ui-wireframe
description: Design low-fidelity wireframes per screen. Capture layout, components, states (loading/empty/error/success), responsive breakpoints. Use when user says "wireframe", "mockup", "screen design", "UI sketch", "/ui-wireframe", before writing JSX/TSX components, or when frontend lacks a layout reference. Writes docs/design/wireframes/<screen>.md.
version: 1.0.0
---

# UI Wireframe

Low-fidelity, text-first wireframes per screen. Output is human design doc — *not* a Figma file. ASCII layout + component breakdown + state list. Each screen = one file.

> **Worked example below: perishable-hold checkout** (resource reserved for N minutes pending payment). Same wireframe instantiates as event-ticket / appointment-slot / hotel-room / parking-spot / restaurant-table booking — substitute `<Resource>` + `<slot-id>` per vertical; layout, focus order, and component list stay identical. Payment radio shown as generic Card / Wallet / Bank — see `/payment-processor-pick` for region-specific brands (Momo/ZaloPay/GrabPay/Konbini/etc.).

## Why you'd care

Designing screens directly in JSX is how teams discover, on day four of implementation, that the layout doesn't fit the data. A wireframe with states is what surfaces the misalignment before the component is built.

## When This Skill Applies

Activate when:
- User says "wireframe", "mockup", "screen design", "UI sketch", "layout", "/ui-wireframe"
- Before writing a new page or major component
- Frontend lacks a layout reference and is improvising
- Acceptance criteria mention a screen with no design source
- Pre-implementation review of a UI-heavy feature

## Prerequisites

- PRD or issue describing the screen's purpose.
- User flow defined (run `/user-flow` first if multi-step).
- Design system tokens decided (run `/design-system` first if no token doc).

## Steps

1. **Identify screen scope.** One screen = one file. Don't combine modal + parent unless modal trivial.
2. **Confirm device targets.** Mobile-first? Tablet? Desktop max-width? Default: mobile + desktop, 768px breakpoint.
3. **List entry points.** What URL/route? What links here? What links away?
4. **Capture layout.** ASCII box-drawing for mobile + desktop. Top-down, left-right.
4.5. **Layout-composition check.** Before finalizing, the composition must be a CONSCIOUS choice — not an auto-reach for centered cards-in-a-grid. Force consideration of at least one non-default composition: asymmetric, editorial, full-bleed, or broken-grid. Record which composition was picked and why; "centered max-width cards in a grid" is allowed only when deliberately chosen over the alternatives (an unconsidered default trips tells T10 centered max-w everything, T13 no layout personality).
5. **List components used.** Reference `docs/design/design-system.md` if exists. Flag any new component needed.
6. **Enumerate states.** Always cover: loading, empty, error, success, disabled-action. Add per-screen states (e.g., `cart-timeout`, `seat-held-by-other`).
7. **Note interactions.** Click/tap targets, keyboard shortcuts, hover/focus behavior.
8. **Note data needs.** What server data must load before render? What's optimistic? What's deferred?
9. **Write** `docs/design/wireframes/<screen-slug>.md` (create dir if missing).
10. **Auto-chain.** Screens with forms/inputs → `/a11y-design`. Multi-step screens → `/user-flow`. New components → flag for design-system.

## Output Format — `docs/design/wireframes/<screen>.md`

```markdown
---
screen: checkout-payment
route: /checkout/[bookingId]/payment
last-updated: YYYY-MM-DD
status: draft | reviewed | implemented
---

# Wireframe: Checkout — Payment

## Purpose
User enters payment method and confirms booking. Final step before success.

## Entry Points
- From: `/checkout/[bookingId]/details` (Continue button)
- Direct link: deep link from email "complete your booking" CTA
- Redirects to: `/checkout/[bookingId]/success` (200) or `/checkout/[bookingId]/details` (timeout)

## Device Targets
- Mobile (375–767px) — primary
- Desktop (≥768px) — two-column layout

## Layout — Mobile (≤767px)

```
┌────────────────────────────────┐
│ [<- back]   Step 3 of 3        │  ← TopBar with progress
├────────────────────────────────┤
│                                │
│  Booking summary               │
│  ┌──────────────────────────┐  │
│  │ <Resource> 26-05-12 19:00│  │
│  │ Slot <slot-id>           │  │
│  │ Total: 290,000 ₫         │  │
│  └──────────────────────────┘  │
│                                │
│  Hold expires in 04:32         │  ← CountdownBadge
│                                │
│  Payment method                │
│  ◉ Credit card                 │  ← RadioGroup
│  ○ Wallet                      │
│  ○ Bank                        │
│                                │
│  [Stripe card iframe ........] │
│                                │
│  ┌──────────────────────────┐  │
│  │   Pay 290,000 ₫          │  │  ← Primary CTA, full width
│  └──────────────────────────┘  │
│                                │
│  By paying you agree to ToS    │  ← Disclaimer
└────────────────────────────────┘
```

## Layout — Desktop (≥768px)

```
┌──────────────────────────────────────────────────────────┐
│ [<- back]   Checkout — Payment        Step 3 of 3        │
├────────────────────────────────┬─────────────────────────┤
│                                │                         │
│  Payment method                │   Booking summary       │
│  ◉ Credit card                 │   ┌─────────────────┐   │
│  ○ Wallet                      │   │ <Resource> 19:00│   │
│  ○ Bank                        │   │ Slot <slot-id>  │   │
│                                │   │ 290,000 ₫       │   │
│  [Stripe card iframe ........] │   └─────────────────┘   │
│                                │                         │
│  ┌──────────────────────────┐  │   Hold expires 04:32    │
│  │   Pay 290,000 ₫          │  │                         │
│  └──────────────────────────┘  │                         │
│                                │                         │
└────────────────────────────────┴─────────────────────────┘
```

## Components

| Component | Source | New? |
|-----------|--------|------|
| TopBar (with back + progress) | design-system | no |
| BookingSummaryCard | feature-local | YES — propose for design-system |
| CountdownBadge | design-system | no |
| RadioGroup | shadcn/ui | no |
| StripeCardElement | @stripe/react-stripe-js | no (3rd party) |
| PrimaryButton | design-system | no |

## States

| State | Trigger | UI |
|-------|---------|----|
| loading | initial page load (fetching booking) | full-page skeleton matching layout |
| ready | data loaded | as drawn above |
| submitting | user clicked Pay | button → spinner, disable form |
| error-payment | Stripe declined | inline error above CTA, button re-enabled |
| error-network | fetch fail | toast + retry button |
| hold-expired | countdown hits 0 | full-page modal: "Hold expired, restart?" → redirects to details |
| hold-warn | countdown ≤ 60s | countdown badge turns red, pulses |

## Interactions

- Tab order: back → method radios → card iframe → Pay button.
- Enter on Pay button submits.
- Esc on hold-expired modal redirects (no dismiss).
- Sticky CTA on mobile (always visible at viewport bottom).

## Data Needs

| What | When | Source | Optimistic? |
|------|------|--------|-------------|
| Booking summary | on mount | GET /api/bookings/:id | no |
| Hold expiresAt | on mount | from booking response | no |
| Stripe publishable key | on mount | env var (NEXT_PUBLIC_STRIPE_PK) | no |
| Payment intent | on Pay click | POST /api/payments/intent | no |

## Open Questions

- Show saved cards (returning users)? Not in MVP.
- Apple Pay / Google Pay? Defer to post-launch.

## Out of Scope

- Confirmation screen (separate wireframe).
- Refund flow (separate wireframe).
```

## Boundaries

- **Low-fi only.** ASCII boxes, no pixel-perfect Figma. Goal = layout consensus, not visual polish.
- **One screen per file.** Tabbed or modal interactions: separate file linked from parent.
- **Always cover loading/empty/error.** Reject wireframes that show only the happy state.
- **No CSS, no Tailwind classes.** Component names only. Style decisions belong in design-system + component impl.
- **No copy-writing.** Placeholder labels OK; final copy is a separate concern.

## Re-run Behavior

- If file exists, read first. Surface diff vs proposed.
- Bump `last-updated`.
- Status field: draft → reviewed (after `/design-review`) → implemented (after first PR ships it).

## Auto-chain

- Screens with input/forms → `/a11y-design` (focus order, ARIA, keyboard).
- Multi-step screens → `/user-flow` (sequence diagram across screens).
- New components surfaced → flag for `/design-system` next pass.
- Screens touching money/PII → `/threat-model`.
- After the layout-composition check → `/anti-generic-design-check` (audits the wireframe against tells T5 rigid 12-col grid, T10 centered max-w everything, T13 no layout personality).

## Example Trigger

User: "wireframe the checkout payment screen before I build it"
→ Confirm scope (mobile + desktop), draw ASCII layouts, list components/states/data, write `docs/design/wireframes/checkout-payment.md`.
