# DS-022 Motion & Interaction

## Approach

CSS-only animations. No JS animation library (no framer-motion). All animations guarded by `@media (prefers-reduced-motion: no-preference)`.

## CSS Keyframe Animations

Defined in `app/globals.css`:

### Ken-Burns (`@keyframes kenburns`)

Hero cover image slow zoom + pan.

- Transform: `scale(1) → scale(1.08)`, `translateY(0 → -1.2%)`
- Duration: 28s ease-in-out infinite alternate
- Guard: `motion-safe:` + `will-change-transform`
- Used on: home hero banner layers

### Floating Blobs (`@keyframes blob`)

Animated glow orbs on IntroBanner (closing CTA section).

- 3-keyframe movement with scale variance (0.94 → 1.12)
- Duration: 22s ease-in-out infinite
- Guard: `motion-safe:`

### Scroll Reveal (`@keyframes reveal-rise`)

Fade + rise on section viewport entry. Pure CSS scroll-driven timeline.

- Uses `animation-timeline: view()` (CSS Scroll-Driven Animations)
- Range: `entry 0% entry 35%`
- Stagger via `--i` custom property: `animation-delay: calc(var(--i, 0) * 60ms)`
- Applied via `.reveal` class on section/grid wrappers
- Progressive enhancement: browsers without scroll-timeline render content normally

## Tailwind Transitions

| Element | Effect |
|---------|--------|
| Cards | `hover:-translate-y-0.5` (subtle lift, motion-safe) |
| Interactive | `transition-all` on hover/focus |
| Focus | `focus-visible:ring-3 focus-visible:ring-ring/50` |
| Nav items | Background transition on hover/active |

## State-Driven Interactions

### HoldTimer (`components/HoldTimer.tsx`)

- Countdown display for seat hold expiry
- Color shifts to `text-destructive` at T-2min
- `aria-live="polite"` for screen reader updates
- State: `useHoldTimerStore` Zustand store

### HoldExpiryModal (`components/HoldExpiryModal.tsx`)

- Non-dismissible modal on hold expiry
- State-driven display (no animation, immediate show)
- Auto-redirects on expiry

### BookingSteps (`components/booking/BookingSteps.tsx`)

- Step indicator for booking flow
- `aria-current="step"` on active step
- Visual: completed/active/pending states

## Performance

- `will-change-transform` on animated elements
- Scroll-driven animations offloaded to compositor (no JS)
- No `requestAnimationFrame` usage
- `tw-animate-css` imported for additional Tailwind animation utilities

## Grain Texture

SVG fractal noise at low opacity on sections. Not animated — static depth effect.
