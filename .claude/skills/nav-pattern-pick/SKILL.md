---
name: nav-pattern-pick
description: Navigation pattern decision — top bar vs sidebar vs bottom tab vs hamburger vs cmd palette. Choose primary + secondary nav per surface, IA depth, breakpoint behavior. Outputs `docs/design/nav.md` with decision rationale + per-breakpoint pattern + a11y wiring. Use when user says "navigation", "nav pattern", "sidebar", "top nav", "bottom tab", "hamburger menu", "command palette", "IA", "/nav-pattern-pick", or before first screen lands.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 3h
---

# Nav Pattern Pick

## Why you'd care

Pick the wrong primary nav pattern and every screen pays the IA tax — users can't find features and analytics shows the dead clicks. The decision rationale + per-breakpoint pattern locks the architecture before component build.

Pick the navigation pattern once, before screens calcify. Wrong choice = expensive re-IA later. Decision rests on IA depth, surface count, viewport, and frequency of switching.

## When This Skill Applies

Activate when:
- User says "navigation", "nav pattern", "sidebar", "top nav", "bottom tab", "hamburger", "command palette", "IA", "/nav-pattern-pick"
- New product, before second screen
- Re-IA: nav becoming a junk drawer
- Adding a new top-level surface (admin, settings, billing)
- Mobile-first decision needed

## Prerequisites

- IA / surface inventory: list of top-level destinations.
- Target viewports (mobile / tablet / desktop / TV?).
- Auth model (does signed-out share nav with signed-in?).
- Decision: persistent vs disclosed nav (preference signal).

## Steps

1. **List destinations.** Top-level only. Group secondary under their parent.
2. **Count.** ≤5 top-level → bottom tab viable on mobile. 6–8 → top nav with overflow. 9+ → reconsider IA before picking pattern.
3. **Frequency analysis.** Which destinations are switched between hourly vs monthly? Hourly → persistent. Monthly → buried.
4. **Pick primary pattern per breakpoint.** Mobile / tablet / desktop. Often differs.
5. **Pick secondary pattern.** Sub-nav per section: tabs, sidebar, breadcrumb.
6. **Decide cmd palette?** Power-user shortcut (Cmd+K). Necessary if 20+ destinations or heavy keyboard users.
7. **Active state + indicator.** Underline, fill, dot.
8. **Overflow handling.** What happens when nav > available width? Hide-on-scroll? "More" menu?
9. **Auth-state divergence.** Signed-out vs signed-in nav: same chrome with different items, or different chrome entirely.
10. **A11y wiring.** Landmarks (`<nav aria-label>`), skip-link, focus order, current page (`aria-current="page"`).
11. **Write** `docs/design/nav.md`.
12. **Auto-chain.** New nav surface → `/ui-wireframe` for the destination if missing.

## Output Format — `docs/design/nav.md`

```markdown
---
last-updated: YYYY-MM-DD
status: draft | reviewed | implemented
---

# Navigation

## IA — Top-level destinations

| Slug | Label | Path | Auth | Frequency |
|------|-------|------|------|-----------|
| home | Home | / | signed-in | daily |
| browse | Browse | /browse | both | daily |
| bookings | Bookings | /bookings | signed-in | daily |
| messages | Messages | /messages | signed-in | hourly |
| profile | Profile | /profile | signed-in | weekly |

5 destinations → bottom tab viable mobile.

## Pattern Decision — per breakpoint

| Breakpoint | Primary | Secondary | Justification |
|------------|---------|-----------|---------------|
| Mobile (<768px) | Bottom tab (5 items) | Top sticky bar (back + page title + 1 action) | Thumb reach; persistent for hourly switching |
| Tablet (768–1024) | Top nav (5 items) | Tabs in-page | Hybrid: enough width for top, no need for bottom |
| Desktop (≥1024) | Top nav (5 items) + cmd palette (Cmd+K) | Sidebar in-page when sub-nav has ≥4 items | Pointer + keyboard users; cmd palette for power |

### Rejected: hamburger on desktop
- Hides primary nav behind a click.
- Bad discoverability for daily destinations.
- Acceptable only when nav has 9+ items and persistent visibility hurts more than disclosure.

### Rejected: sidebar on mobile
- Eats horizontal space.
- Off-canvas drawer is worse than bottom tab for ≤5 destinations.

## Active State

- Bottom tab: filled icon + label color = primary; inactive = muted.
- Top nav: 2px underline, color = primary.
- Sidebar: full-row tint + left-edge bar.
- All: `aria-current="page"`.

## Overflow

- Bottom tab fixed at 5; never overflow. If we add a 6th destination, re-IA (move to settings or split to two products).
- Top nav (desktop): items beyond viewport collapse into "More" menu (button + dropdown). Triggered when computed width > container.
- Cmd palette is the long-tail — anything not on visible nav is reachable via Cmd+K.

## Cmd Palette (Cmd+K / Ctrl+K)

- Triggered globally except inside text inputs.
- Searches: destinations + entity names (bookings by id, users by email if admin).
- Recent + frequent at top when query empty.
- Esc closes; Enter navigates.
- A11y: dialog with focus trap; result list as `<ul role="listbox">`.

## Auth-state Divergence

| Item | Signed-out | Signed-in |
|------|-----------|-----------|
| Top nav | Logo + "Sign in" + "Sign up" | Logo + 5-tab nav + avatar menu |
| Bottom tab | hidden | shown |
| Cmd palette | only "Sign in" | full |

Marketing pages share the signed-out chrome; product pages always require auth (redirect signed-out to /signin).

## A11y

- `<nav aria-label="Primary">` for top/bottom nav; `<nav aria-label="Section">` for sub-nav.
- Skip-to-main link first focusable element on every page.
- Focus order: skip → nav → main → footer.
- `aria-current="page"` on active item.
- Cmd palette dialog: `role="dialog" aria-modal="true" aria-labelledby="…"` + focus trap.

## Mobile Bottom Tab Detail

- Height 56px + safe-area-inset-bottom.
- 5 items, equal width.
- Icon (24px) + label (12px below).
- Hides on scroll-down, returns on scroll-up (optional; default: always visible).

## Out of Scope

- Marketing site nav (separate file if needed).
- Admin console nav (separate file).
- In-page anchors / TOC (per-screen wireframe concern).

## Open Questions

- Sticky vs scroll-away top nav on long pages? Default sticky; revisit per-screen.
- Cmd palette in mobile? Defer; users expect search field instead.
```

## Boundaries

- **One product nav per file.** Marketing + product + admin = separate files if they diverge.
- **Pick by destination count + frequency, not aesthetic.** "Sidebars look enterprise" is not a reason.
- **Mobile is the constraint.** If pattern doesn't fit mobile, redesign IA, don't fight viewport.
- **No screen-level layout.** Nav placement only; per-screen layout is wireframes' job.
- **No code.** Component implementation downstream.

## Re-run Behavior

- If file exists, read first; surface diff.
- Bump `last-updated`.
- Re-evaluate when destination count crosses 5 or 8.

## Auto-chain

- Each new top-level destination → `/ui-wireframe` for the surface.
- Cmd palette → `/api-contract` for search endpoint.
- Sub-nav patterns → `/design-system` to standardize tab + sidebar variants.

## Example Trigger

User: "pick the nav pattern for our app"
→ List destinations, count, pick per breakpoint with rationale, write `docs/design/nav.md`.
