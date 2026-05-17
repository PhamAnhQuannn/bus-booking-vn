---
name: cta-hierarchy
description: Call-to-action hierarchy rules. Primary / secondary / tertiary visual weight, one-primary-per-view rule, destructive-as-tertiary, link vs button, position conventions. Outputs `docs/design/cta-hierarchy.md` with token mapping + per-surface decision table + anti-patterns. Use when user says "CTA", "button hierarchy", "primary button", "action priority", "button placement", "/cta-hierarchy", or when buttons are competing for attention on a screen.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 3h
---

# CTA Hierarchy

## Why you'd care

Two filled buttons of equal weight in the same viewport means the user picks neither, or worse — they pick the destructive one because it looked just as official as Save. One-primary-per-view discipline plus a clear secondary/tertiary tier mapping is what stops the slow drift where every quarter a designer ships "just one more filled button" and the product becomes visually unparseable inside a year.

When two buttons claim "primary", neither wins. This skill locks the rules: one primary per view, destructive never primary, secondary/tertiary tier mapping, position conventions per platform. Stops the "every button is filled" drift.

## When This Skill Applies

Activate when:
- User says "CTA", "button hierarchy", "primary button", "action priority", "button placement", "/cta-hierarchy"
- Multiple buttons on a screen competing visually
- New surface with ≥2 actions
- Audit existing screens for hierarchy violations
- Design system bump that changes button variants

## Prerequisites

- Design system tokens for button variants (`docs/design/design-system.md`).
- Wireframe placement (`docs/design/wireframes/<screen>.md`).
- Decision: one-primary-per-view rule (default ON).

## Steps

1. **Inventory actions per surface.** List every action user can take on the screen.
2. **Rank by user goal.** Primary = the action that moves the user's task forward. Secondary = supporting. Tertiary = escape / minor.
3. **Map to button variant.** Primary → filled; Secondary → outline / soft; Tertiary → ghost / link.
3.5. **Button personality.** Choose a button personality for the product — pill / sharp / ghost-led / high-contrast-solid — rather than defaulting to one mid-rounded filled style. Tie the pick to the product type and the captured corpus / `/design-trend-compare` auto-picked direction (fintech leans sharp + high-contrast; mobile-consumer leans pill; devtools leans sharp or ghost-led; marketplace leans high-contrast-solid). An unjustified default radius/fill trips tells T6 (uniform radius) and T3 (single safe accent).
4. **Destructive handling.** Destructive primary visual = NO. Destructive uses outline-danger or ghost-danger; confirmation modal carries the filled-danger.
5. **Position conventions.** Per-platform (web/mobile) and per-pattern (form, modal, toolbar).
6. **Link vs button decision.** Navigates → link. Performs action → button.
7. **Disabled vs hidden.** Disabled when contextual unavailability + reason discoverable; hidden when permission-gated.
8. **A11y check.** All actions reachable by keyboard; disabled state has accessible explanation.
9. **Write** `docs/design/cta-hierarchy.md`.
10. **Auto-chain.** New variant → `/design-system`. Destructive → `/threat-model` for confirm + audit.

## Output Format — `docs/design/cta-hierarchy.md`

```markdown
---
last-updated: YYYY-MM-DD
status: draft | reviewed | implemented
ds-source: docs/design/design-system.md
---

# CTA Hierarchy

## Tier Definitions

| Tier | Visual | Variant | Use |
|------|--------|---------|-----|
| Primary | Filled, brand-color, high contrast | `<Button variant="primary">` | The one action that moves the user's task forward |
| Secondary | Outlined, brand-color border, transparent fill | `<Button variant="secondary">` | Supporting action (alternate path, "view details") |
| Tertiary | Ghost (no border, color text only) | `<Button variant="ghost">` OR `<Link>` | Minor / escape (cancel, dismiss, back) |
| Destructive (primary) | Filled red — used ONLY in confirmation modal | `<Button variant="destructive">` | Final destructive confirm |
| Destructive (action) | Ghost-red text or outline-red | `<Button variant="ghost" tone="danger">` | Trigger that opens confirm modal |

## Button Personality

Pick ONE personality for the product — do not default to a generic mid-rounded filled button.

| Personality | Shape / fill | Fits product type |
|-------------|--------------|-------------------|
| Pill | fully-rounded (`radius-full`), solid fill | mobile-consumer, content |
| Sharp | small/zero radius, crisp edges, often high-contrast | fintech, devtools, internal-admin |
| Ghost-led | most actions ghost/outline; filled reserved for the single primary | devtools, internal-admin |
| High-contrast-solid | bold solid fill, strong contrast, mid radius | marketplace, ecommerce, saas |

- Picked personality: `<one of the above>` — justified against product type + corpus / `/design-trend-compare` direction.
- The picked personality sets the default radius + fill for every tier; tier *weight* still follows the rules below.

## Core Rules

1. **One primary per view.** A view is a logical screen state (a modal counts; a sheet counts).
2. **Destructive is never primary on the trigger surface.** It opens a confirm modal where the *modal's* primary is the destructive confirm.
3. **No more than 4 visible actions per surface region.** Overflow into "More" / kebab menu.
4. **Secondary action sits next to primary, not stacked, unless mobile narrow.**
5. **Cancel / close is tertiary or icon-only, never visually equal to primary.**
6. **No primary-styled button performs no-op or navigation-only ("Learn more" stays as link).**
7. **Loading replaces label, not added.** "Save" → "Saving…" + spinner; not "Save Saving…".

## Per-Surface Decision Table

| Surface | Primary | Secondary | Tertiary |
|---------|---------|-----------|----------|
| Signup form | "Create account" | (none) | "Sign in instead" (link) |
| Signin form | "Sign in" | OAuth buttons (each as secondary) | "Forgot password?" (link), "Sign up" (link) |
| Booking detail | "Modify booking" | "Print receipt" | "Cancel booking" (ghost-danger) |
| Cancel booking modal | "Cancel booking" (destructive-filled) | (none) | "Keep booking" (ghost) |
| Settings page | (no single primary; section-scoped) | "Save changes" per section | "Discard" |
| Empty state | "Create your first item" | (none) | "Browse templates" (link) |
| Error state | "Retry" | "Contact support" (link) | (none) |
| Toolbar (data table) | "New booking" | "Export" | filter chips, density toggle |
| Confirm-destructive modal | destructive action label | (none) | "Cancel" (ghost) |
| Paywall | "Choose Pro" | "Restore purchase" (link) | close (icon, top-right) |

## Position Conventions

### Web

- Form submit: primary right, secondary left of primary, tertiary far-left or above. RTL mirror.
- Modal footer: primary right, cancel left.
- Toolbar: primary left (or right of search), filters mid, settings right.
- Empty state: primary centered below text.

### Mobile (iOS)

- Modal action: primary in nav bar trailing position OR full-width at bottom (sheet).
- Action sheets: destructive at top, cancel at bottom.
- Bottom of screen: full-width sticky primary; secondary stacks below or as icon.

### Mobile (Android M3)

- App bar trailing icon for primary action when contextual.
- FAB for global primary on a list/feed screen (one per screen).
- Modal bottom sheet: actions stacked or row depending on length; primary on right.

## Disabled vs Hidden

| Reason | Treatment |
|--------|-----------|
| Form invalid | Disabled (with `aria-describedby` pointing to first invalid field) |
| Action unavailable contextually (e.g., already cancelled) | Disabled + tooltip explaining why |
| Permission-gated | Hidden (don't tease unauthorized actions) |
| Server-side rate-limited | Disabled + countdown / retry-after copy |

Disabled buttons: `disabled` HTML attr + visually muted + `aria-disabled="true"` (when interactivity needed for tooltip).

## Link vs Button

| Use | Element |
|-----|---------|
| Navigate to URL | `<a href>` (or `<Link>`) — looks like link |
| Trigger JS action | `<button>` |
| Open external | `<a target="_blank" rel="noopener">` + icon |
| Submit form | `<button type="submit">` |

Anti-pattern: button styled as link AND link styled as button — both disorient. Pick the underlying element first, style after.

## Loading + Disabled States

| State | Label | Spinner | Enabled | Aria |
|-------|-------|---------|---------|------|
| idle | "Save" | no | yes | — |
| submitting | "Saving…" | yes | no | `aria-busy="true"` |
| success | "Saved" (200ms then revert) | no | no | announce "Saved" via aria-live |
| error | "Save" | no | yes | error announced separately |

## Anti-Patterns (don't do)

- Two filled brand-color buttons side-by-side (which is primary?).
- Destructive as filled-red button outside confirm modal.
- "Cancel" styled as filled secondary equally weighted to "Save".
- Ghost button for the most important action ("buried CTA").
- Primary button performing navigation only (use link).
- Button label is the verb of the result, not the user's intent: write "Send invite" not "Submit".

## Tokens (reference design-system)

| Token | Usage |
|-------|-------|
| `bg-primary` / `text-on-primary` | filled primary |
| `border-primary` / `text-primary` | outline secondary |
| `text-primary` (no bg, no border) | ghost / link |
| `bg-destructive` / `text-on-destructive` | confirm-destructive in modal |
| `text-destructive` (ghost) | destructive trigger |

## A11y

- All buttons reachable by Tab in logical order.
- `aria-label` on icon-only buttons ("Close dialog", "More actions").
- Loading state announced via `aria-live="polite"` on a status node, not the button label.
- Disabled state explained: prefer `aria-describedby` over silence.

## Out of Scope

- Specific button styling (covered by `design-system`).
- Form validation timing (covered by `form-design`).
- Per-feature CTA copy (per-feature wireframe / spec).

## Open Questions

- FAB on all mobile list screens or only some? Default: only when single dominant action (Home feed yes; Settings no).
- Allow second primary on long marketing pages (top + bottom of page repeating)? Yes — same CTA repeated, not different actions.
```

## Boundaries

- **One primary per view, every view.** No exceptions inside the same logical scope.
- **Destructive never primary on trigger surface.** Always opens confirm modal.
- **Pick element first (button vs link), style second.** Element follows behavior, not aesthetic.
- **No new variants in this file.** New variant → `/design-system` first.
- **No code.** Wiring downstream.

## Re-run Behavior

- Read existing first; surface diff.
- Bump `last-updated`.
- Re-run when design-system adds/removes button variant.

## Auto-chain

- Consumes `/design-trend-compare` — the auto-picked direction supplies the per-product-type button personality (pill / sharp / ghost-led / high-contrast-solid).
- New variant needed → `/design-system`.
- Destructive trigger → `/threat-model` for confirm + audit log.
- Per-screen action audit → existing `/ui-wireframe` updates.
- Empty / error / loading variants → `/state-pattern-catalog`.

## Example Trigger

User: "the booking page has too many buttons fighting for attention"
→ Inventory actions, rank by user goal, map to tier, decide position, write `docs/design/cta-hierarchy.md`.
