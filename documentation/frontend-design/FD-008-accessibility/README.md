# DS-025 Accessibility

## ARIA Usage

### Form Controls

- `aria-invalid` — toggles destructive border/ring on validation errors
- `aria-required` — marks required fields (no visual asterisk by default)
- `aria-current="date"` — today marker in Calendar

### Navigation

- `aria-current="page"` — active nav links
- `aria-label` — icon-only buttons (e.g., "Mo menu dieu huong" on sidebar toggle)
- `aria-hidden="true"` — decorative icons, grain overlays, dividers

### Dynamic Content

- `role="alert"` — error messages (assertive)
- `role="status"` — info/success alerts (polite)
- `aria-live="polite"` — HoldTimer countdown updates
- `aria-live="assertive"` — form submission errors

### Tabs & Steps

- `role="tablist"` / `role="tab"` — booking history tabs
- `aria-selected` — active tab button
- `aria-current="step"` — active step in BookingSteps

### Lists

- `role="list"` / `role="listitem"` — custom list structures

## Focus Management

- **Focus ring:** `focus-visible:ring-3 focus-visible:ring-ring/50` on all interactive elements
- **Keyboard navigation:** all interactives reachable via Tab
- **Calendar keyboard:** Arrow keys (day navigation), PageUp/Down (month), Home/End (week bounds), Enter/Space (select)
- **Command palette:** `Cmd+K` / `Ctrl+K` global shortcut

## Reduced Motion

All animations guarded by `@media (prefers-reduced-motion: no-preference)` via Tailwind `motion-safe:` modifier:
- Ken-burns hero zoom
- Blob floating animation
- Scroll-reveal fade+rise
- Card hover lift

Users with `prefers-reduced-motion: reduce` get static rendering.

## Screen Reader Support

- `sr-only` class on labels when icons are visible (collapsed nav)
- `aria-label` on interactive elements without visible text
- Alert component auto-assigns `role`: `status` (info/success) or `alert` (warning/error)
- Semantic heading hierarchy for page structure

## Touch Targets

**44px minimum** (WCAG 2.5.5) on all interactive elements:
- Buttons: `min-h-11` (44px)
- Nav items: padded to meet target
- Form inputs: adequate height

## Color & Contrast

- OKLCH color system designed for perceptual uniformity
- Primary orange on white: ~3:1 (meets AA large text)
- Foreground on background: designed for 4.5:1+ (WCAG AA normal text)
- Status tokens (success/warning/info) maintain 4.5:1 minimum
- Dark theme tokens invert appropriately for contrast

## Label Association

- All inputs have `<Label htmlFor="...">` association (`components/ui/label.tsx`)
- Disabled state: `peer-disabled:opacity-50` on label
- No standalone unlabeled inputs

## Base-UI Foundation

All interactive primitives inherit Base-UI's built-in accessibility: proper ARIA roles, keyboard event handling, focus trapping in modals, roving tabindex in radio groups and calendars.
