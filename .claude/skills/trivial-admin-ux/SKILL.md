---
name: trivial-admin-ux
description: Admin UX design for low-tech operators (clinic front-desk, indie landlord, salon owner, café manager, restaurant owner). Big tap targets, phone-first, one-handed, default actions visible, dangerous actions guarded, no settings forests, no jargon. Outputs `docs/design/trivial-admin-ux-<project>.md`. Use when admin user is not a power-user and not full-time at desktop. Triggers on "trivial admin", "owner UI", "low-tech admin", "single-operator UI", "/trivial-admin-ux". XS skip; S+ fires.
output_size:
  XS: skip
  S: 1h
  M: 2h
  L: 4h
  XL: 6h
---

# /trivial-admin-ux — Low-tech-operator Admin UX

Invoke as `/trivial-admin-ux`. Use when the admin user is a non-IT operator running their own business on a phone between tasks — not a SaaS power-user with a 27" monitor.

## Why you'd care

Front-desk staff at a salon aren't going to read documentation, master keyboard shortcuts, or recover from a misclick. Phone-first, big-tap-target, guarded-dangerous-action UX is the difference between adoption and rejection.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP.
2. Read `docs/inception/buyer-persona-deep-<project>.md` if present.
3. Read `docs/design/ui-wireframe-<project>.md` if exists — this skill refines, not replaces.

## Inputs
- Top 5 admin actions by frequency.
- Top 3 admin actions by stakes (dangerous, expensive, irreversible).
- Operator device split (phone / tablet / desktop).
- Network profile (kitchen Wi-Fi vs LTE on the floor).

## Process
1. **Hierarchy by frequency × stakes**:
   - High freq + low stakes → primary screen, big button, one tap. (Mark order ready.)
   - High freq + high stakes → primary screen, big button, confirmation step. (Refund.)
   - Low freq + high stakes → not on primary; behind "More" or settings; double-confirm. (Delete menu category.)
   - Low freq + low stakes → settings; no special treatment.
2. **Phone-first layout** (assume 375px iOS Safari + Android Chrome):
   - Top: revenue/status. Single number, large.
   - Middle: 3–6 primary actions as cards, each ≥56px tall.
   - Bottom: nav bar with ≤4 tabs (Today / Orders / Reservations / More).
   - Avoid: side-drawers (hard one-handed), nested tabs, mega-menus.
3. **Tap targets**: ≥44×44 pt (iOS HIG) or ≥48×48 dp (Material). Space siblings ≥8 pt apart. Test with adult thumb, not mouse.
4. **One-handed reachability**: critical primary actions in bottom-half of screen. Top-bar reserved for non-frequent items (notifications, profile).
5. **Default-action visibility**: the *expected next action* per state is the largest button. Examples:
   - New order arrived → "Mark received" is the big button.
   - Order received → "Mark ready" is the big button.
   - Reservation pending → "Confirm" is the big button.
   - Don't bury the next step in a hamburger menu.
6. **Dangerous action guards**:
   - Refund > $X → confirm modal "Refund $XX to <customer>? This can't be undone."
   - Delete (category, item, customer) → confirm + show what'll be affected.
   - Bulk action → require typing the count ("Type 12 to confirm 12 deletes").
7. **Vocabulary** (use customer/owner words, not engineering):
   - "Refund" not "reverse transaction".
   - "Out of stock" not "inventory deplete".
   - "Set unavailable" not "soft-delete".
   - "Save changes" not "commit".
8. **States that matter**:
   - **Loading**: skeleton, not spinner (skeleton communicates layout).
   - **Empty**: friendly + actionable ("No orders yet today. Here's how to share your link →").
   - **Error**: plain language + one fix ("Couldn't save — try again? [Try again]").
   - **Stale**: pull-to-refresh + last-updated time.
9. **Settings hierarchy**:
   - Avoid >2 levels of nesting.
   - Group by user goal ("Hours", "Menu", "Payments"), not by feature.
   - "Advanced" is a separate page, not collapsed.
10. **Forms**:
   - One field per row on phone.
   - Big labels above inputs, never placeholder-only.
   - Native pickers for date/time/phone (don't custom-build).
   - Save on blur or with sticky bottom "Save" — don't lose the input on accidental back.
11. **Notifications**:
   - One notification per real event, not per technical state change.
   - Quiet hours configurable (default 22:00–07:00 local).
   - Critical-only mode for off-hours.
12. **Accessibility (free uplift)**:
   - Minimum body text 16px.
   - Contrast ≥ 4.5:1 (WCAG AA).
   - Large-text mode (iOS Dynamic Type) supported.
   - No interactions gated on hover.

## Output
Write `docs/design/trivial-admin-ux-<project>.md`:

```markdown
# Trivial-admin UX — <project>
**Date:** <YYYY-MM-DD>

## Top actions (frequency × stakes matrix)
| Action | Frequency | Stakes | Placement | Pattern |
|---|---|---|---|---|
| Mark order ready | 30+/day | low | Today screen, big button per row | one-tap |
| Confirm reservation | 5/day | med | Today screen, "Confirm/Decline" pair | tap + tap |
| Refund order | 1/wk | high | Order detail, secondary action | tap + confirm modal |
| Mark item out-of-stock | 1/day | med | Menu screen, toggle per item | toggle + toast |
| Delete menu category | 1/qtr | high | Menu > category > More > Delete | confirm + type-to-confirm |

## Phone-first layout (375px)
```
┌────────────────────────┐
│ Yesterday $1,240 ▲12%  │  ← single big number
├────────────────────────┤
│ 🔴 3 actions pending   │  ← pending card
│  [Open]                │
├────────────────────────┤
│ ░░░ Today: 4 orders    │
│ ░░░ 2 reservations     │
│ ░░░ Online: 12         │
├────────────────────────┤
│ Today | Orders | More  │  ← bottom tab
└────────────────────────┘
```

## Tap-target spec
- Min size 48×48 dp.
- Min spacing 8 dp.
- Test pass: thumb-reach to all primary actions when phone held in dominant hand.

## Default-action examples
| Screen state | Default action | Visual weight |
|---|---|---|
| Order: new | "Mark received" | primary, full-width |
| Order: received | "Mark ready" | primary |
| Order: ready | "Mark fulfilled" | primary |
| Reservation: pending | "Confirm" | primary; "Decline" secondary |

## Dangerous-action guards
- Refund > $50 → modal "Refund $X to <name>? Can't be undone." + [Cancel] [Refund]
- Delete menu category → modal showing affected items + [Cancel] [Delete N items]
- Bulk delete → type-to-confirm input

## Vocabulary table
| Don't | Do |
|---|---|
| Reverse transaction | Refund |
| Soft-delete | Set unavailable |
| Commit | Save |
| Entity | Item |
| Idempotency error | Already submitted — nothing changed |

## Empty + error states
- Empty (no orders today): illustration + "Quiet day. Share your menu link → "
- Error: "Couldn't save. Check your connection and try again. [Try again]"
- Network offline: persistent banner "Offline — changes will sync when you're back".

## Notifications
- Quiet hours default 22:00–07:00 local; configurable.
- Critical-only mode toggleable.
- One notif per real event.

## Settings hierarchy
- Top: Hours / Menu / Payments / Staff / Notifications / Account.
- ≤2 levels deep.
- Advanced moved to "Advanced" page, never collapsed in main settings.

## Forms
- Native pickers (date, time, phone, photo).
- Labels above inputs.
- Sticky Save bar on long forms.
- Auto-save draft on blur for long descriptions.

## Accessibility baseline
- Body 16px min.
- Contrast ≥4.5:1.
- iOS Dynamic Type honored.
- No hover-only affordances.

## Test plan
- 5-user task test with non-IT operators (e.g. real café owners): can each complete "mark order ready" without instruction in <15s?
- Thumb-reach test on iPhone SE (smallest current iOS).
- Slow-network test: 3G throttling; primary actions must respond <2s.
- Accidental-tap test: undo within 5s for non-destructive actions.
```

## Verification
- Top 5 actions placed per frequency × stakes matrix.
- Phone-first wireframe at 375px.
- Tap-target sizes spec'd (≥48dp).
- Default-action per screen state listed.
- Dangerous actions have guards.
- Vocabulary table swaps engineering jargon for user words.
- Empty + error + offline states designed.
- Accessibility baseline met.
- 5-user task test planned.
