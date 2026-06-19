---
feature: motion-direction
decision: minimal functional motion (150/200ms), tw-animate-css utilities, full prefers-reduced-motion honor
last-updated: 2026-05-20
status: ready-to-build
inherits: docs/design/design-system.md
resolves: design-system.md "No custom motion tokens defined … Formalize later if needed"
---

# Motion Direction Spec — Bus-Booking VN

Resolves the deferred motion flag in `design-system.md`. Gates ONLY the components that animate:
Dialog, Drawer (operator nav mobile), Toast, Tabs panel, and disclosure/expander rows. Static
surfaces (tables, forms, cards) do not animate. `tw-animate-css` is already imported in
`globals.css` — reuse its utilities; do NOT hand-roll keyframes.

## Principles

1. **Functional, not decorative.** Motion communicates state change (enter/exit, open/close) and
   spatial origin (where a panel comes from). No attention-seeking or looping animation except the
   Skeleton pulse and an in-flight spinner.
2. **Fast.** This is an operator tool used repeatedly — short durations, no easing that overshoots.
3. **Reduced-motion is a hard requirement**, not a nice-to-have (WCAG 2.3.3 / project a11y minimums).

## Duration & Easing Scale

| Token (conceptual) | Value | Used for |
|--------------------|-------|----------|
| fast | `150ms` (`duration-150`) | small state: Tabs panel cross-fade, disclosure expand, toast exit, hover/focus tints |
| base | `200ms` (`duration-200`) | overlays: Dialog/Drawer enter, Toast enter, scrim fade |
| ease | `ease-out` enter / `ease-in` exit | enter decelerates in, exit accelerates out |

No durations >200ms in Phase A. Transforms use GPU-friendly properties only (`opacity`,
`transform`) — never animate layout (`width`/`height`/`top`) except the disclosure row, which uses
`grid-template-rows 0fr→1fr` (or simple show/hide) to stay reflow-cheap.

## Per-Component Motion

| Component | Enter | Exit | Origin |
|-----------|-------|------|--------|
| Dialog (P7) | fade + scale `0.96→1`, `200ms ease-out` | reverse `150ms ease-in` | center; scrim fades `bg-black/50` |
| Drawer (mobile nav) | **slide-from-left** `-100%→0` + scrim fade, `200ms ease-out` | reverse `150ms ease-in` | left edge (matches sidebar position) |
| Toast (P12) | slide-up + fade `200ms ease-out` | fade `150ms ease-in` | bottom (or top-right per provider) |
| Tabs panel (P8) | cross-fade `150ms` | — | in place; no layout shift (panels same box) |
| Disclosure row | expand height `150ms ease-out` | collapse `150ms ease-in` | from trigger row |
| Skeleton (P11) | `animate-pulse` (continuous) | — | loading only; stops on content |

base-ui primitives expose data-attributes (`data-open`, `data-closed`, `data-starting-style`,
`data-ending-style`) — drive enter/exit via `tw-animate-css` classes keyed on those, the standard
shadcn/base-ui approach. Do NOT mount/unmount with manual `setTimeout`.

## prefers-reduced-motion

Wrap all non-essential transition/animation so it collapses under the query. `tw-animate-css`
respects it, but verify per component:

```css
@media (prefers-reduced-motion: reduce) {
  /* transforms → instant; opacity-only fade (≤1 frame) is acceptable as an alternative */
}
```

Rules under reduced motion:
- Drawer/Dialog: NO slide/scale — appear/disappear instantly (or ≤instant opacity). Scrim still
  shows (it's state, not motion).
- Toast: no slide — instant or opacity-only. Auto-dismiss timing UNCHANGED (timing ≠ motion).
- Skeleton: `animate-pulse` disabled → static muted block (still conveys loading via shape).
- Tabs: instant panel swap.

Reduced motion must never remove a STATE cue (scrim, focus ring, disabled styling) — only the
movement.

## A11y Coupling

- Motion never blocks interaction: overlays are operable before/while animating (focus moves to
  the dialog on open regardless of animation completion).
- Focus management (trap, restore-to-trigger) is owned by the base-ui primitive and is independent
  of motion duration — Esc closes immediately even mid-animation.
- No motion on focus traversal itself (no animated focus-ring travel).

## Out of Scope
- Page-transition / route-change animation (none Phase A).
- Scroll-linked, parallax, or gesture-driven motion.
- Custom spring/physics curves — `ease-out`/`ease-in` only.
- Chart enter animations (charts deferred per `dashboard-layout.md`).
