# DS-024 Responsive & Mobile Design

## Strategy

Mobile-first. Default styles target 390px+ (mobile). Desktop enhancements via Tailwind breakpoint prefixes.

## Breakpoints

| Prefix | Width | Primary Use |
|--------|-------|-------------|
| `sm:` | 640px | Font size, spacing tweaks, label visibility |
| `md:` | 768px | Major layout shifts — nav sidebar, grid columns, hero layout |
| `lg:` | 1024px | Bento grid asymmetry, content max-width |

## Viewport Units

- `min-h-svh` (100svh) for full viewport height (avoids mobile address bar issues)
- `h-dvh` (100dvh) for dynamic viewport height on scrollable regions

## Touch Targets

**44px minimum** on all interactive elements (WCAG 2.5.5):
- Buttons: `h-9` (36px visual height) with `min-h-11` (44px) touch area via padding — visual size and touch target are distinct
- Mobile form inputs: `h-11` (44px) explicit height
- Nav items: padded to meet 44px
- Small icon buttons (e.g. close, collapse): use `p-2` around 20px icon = 36px visual, but hit area extended to 44px via negative margin or padding

## Layout Patterns

### Grid Shifts

```
grid-cols-1              → mobile (stacked)
md:grid-cols-2           → tablet (2-column)
lg:grid-cols-3           → desktop (3-column)
```

Used in: FeatureHighlights bento grid, route listings, booking lists.

### Typography Scaling

```
text-3xl                 → mobile
sm:text-4xl              → tablet
md:text-5xl              → desktop hero
```

### Spacing Scaling

```
px-4 py-8                → mobile
sm:px-6 sm:py-12         → tablet+
```

## Navigation by Viewport

### Customer

SiteHeader: same across viewports (horizontal link bar).

### Operator

| Viewport | Nav Component |
|----------|---------------|
| < 768px | `OperatorBottomNav` — fixed bottom, 5 slots (4 primary + "Them" more) |
| >= 768px | `OperatorNav` sidebar — collapsible `w-60` → `w-14` icon-only |

Bottom nav: `fixed inset-x-0 bottom-0 md:hidden`. Sidebar hidden on mobile.

Breadcrumbs and Cmd+K trigger hidden on mobile via `ConsoleHeader`.

## Mobile-Specific Patterns

### Horizontal Scroll Strip

`TodayTripsStrip` (`components/op/TodayTripsStrip.tsx`): `overflow-x-auto snap-x` for swipeable trip cards.

### Auth Split Layout

Brand panel hidden on mobile. Form panel goes full-width.

### Search Form

`flex-col` stacked on mobile → `md:flex-row` horizontal on desktop.

### Image Loading

Hero banner uses two image sizes. `react-dom` `preload()` with media queries loads device-appropriate size.

Images: `loading="lazy" decoding="async"` throughout.
