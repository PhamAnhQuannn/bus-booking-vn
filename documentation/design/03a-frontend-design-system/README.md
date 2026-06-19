> ← [Previous](../03-architecture/) | [Index](../README.md) | [Next →](../03b-accessibility/)

### 3.6 Frontend Architecture & Design System

The backend architecture (Sections 3.1–3.5) describes how the server is built. This section describes how the **user-facing layer** is built — the CSS strategy, component library, design tokens, responsive approach, and visual identity that make three separate portals (customer, operator, admin) feel like one product.

#### CSS Strategy — Tailwind CSS v4

**Tailwind CSS** is a utility-first CSS framework: instead of writing custom CSS classes, you compose styles directly in JSX using pre-defined utility classes like `bg-primary text-sm rounded-lg p-4`.

We use **Tailwind v4** in CSS-first mode — all design tokens are declared in `app/globals.css` as CSS custom properties (not in a `tailwind.config.ts` file). This is a breaking change from Tailwind v3.

**Why Tailwind over CSS Modules or styled-components?**

| | |
|---|---|
| **Context** | Need consistent design tokens across 30+ pages, rapid iteration for a 1–2 person team, and zero runtime CSS cost (every kilobyte matters on Vietnamese 4G). |
| **Options** | (a) Tailwind CSS v4, (b) CSS Modules, (c) styled-components / Emotion |
| **Decision** | Tailwind CSS v4 |
| **Consequences** | (+) Zero-runtime (all CSS generated at build time, tree-shaken), tokens in one CSS file, responsive via `md:` prefix, colocated with JSX (no separate `.module.css` files). (−) Long class strings in JSX can be hard to read; utility-first is unfamiliar to some developers. |

#### Component Library — 14 UI Primitives

The UI is built on **@base-ui/react** — a headless (unstyled) component library that provides behavior, keyboard navigation, and ARIA attributes without any visual styling. We add our own styling on top via Tailwind classes in `components/ui/`.

**14 UI primitives** form the building blocks for every page:

| Primitive | What it does |
|-----------|-------------|
| Button | Primary (orange pill), secondary (outline), tertiary (ghost/link), destructive (soft red tint — `bg-destructive/10`, NOT solid fill) |
| Input | Text field with label, error state, `aria-describedby` linking |
| Label | Paired with Input; visible label required for every field (a11y) |
| Card | Content container with optional header/footer; warm-shadow elevation |
| Badge | Status indicator (neutral/success/danger/pending/count); maps status enums to colors |
| Alert | Banner for success/warning/error messages; `role="alert"` for screen readers |
| Select | Dropdown picker; base-ui `Select` with styled listbox |
| Dialog | Modal overlay; focus-trapped, Esc closes, `aria-modal="true"` |
| Tabs | Tab panel switcher; cross-fade transition, `role="tablist"` |
| RadioGroup | Mutually exclusive options (e.g., payment method picker) |
| Checkbox | Boolean toggle (e.g., consent checkboxes at checkout) |
| Skeleton | Loading placeholder; pulsing animation during data fetch |
| Toast | Ephemeral notification; `role="status"`, auto-dismiss, slide-up entrance |
| Table | Data table with sortable headers, row expanders, mobile card-stack fallback |

**Why custom-styled over a pre-built design system (like shadcn/ui)?** Bundle control (tree-shake unused primitives), Vietnamese locale defaults (date/currency formatting baked in), and a warm brand identity that off-the-shelf gray themes can't deliver. The headless base-ui layer handles the hard parts (keyboard nav, ARIA, focus trap) while we control every visual pixel.

#### Component Authoring Constraints

All 14 primitives follow a shared authoring pattern:

- **`cva` + `cn`**: Variant logic uses **Class Variance Authority** (`cva`) for defining variants (size, intent), composed via a `cn()` merge utility. New primitives must follow this pattern — no raw ternaries or ad-hoc `clsx` usage.
- **`Button.asChild` not supported**: base-ui's `asChild` prop is NOT wired on the Button primitive. To style a `<Link>` as a button, use `buttonVariants({variant, size})` on the Link's `className`.
- **Primitive text-size ownership**: Primitives own their `text-*` class. Do NOT override with external scale classes (e.g., `text-lg` on `<Button>`). The primitive manages its own font size per variant.
- **No `tailwind.config.ts`**: Hard constraint. Tailwind v4's CSS-first mode is incompatible with a config file. Creating one silently breaks token resolution. All token edits happen in `globals.css` only.
- **No inline styles**: `grep "style={{" app/` must return zero matches. Exception: data-driven `style={{ width: computedValue }}` for progress/funnel bars where the value is computed from data at runtime.
- **`tw-animate-css`**: Animation utility layer imported in `globals.css`. No hand-rolled `@keyframes` definitions.
- **Dark mode**: Out of scope this phase. `.dark` tokens exist in CSS (the variable declarations are written) but no UI toggle ships. Do not design or test dark variants until the toggle is implemented.

#### Design Tokens — Color, Typography, Spacing

**Design tokens** are named variables that define the visual language — colors, fonts, spacing, shadows. Changing one token propagates everywhere. All tokens live in `app/globals.css` and are referenced via Tailwind classes.

**Color system** (oklch — a perceptually uniform color space):

| Token | Value | Usage |
|-------|-------|-------|
| `--color-primary` | Orange `#EA580C` | CTAs, brand surfaces, active states |
| `--color-secondary` | Teal | Info badges, secondary actions |
| `--color-background` | Warm white | Page backgrounds (NOT pure `#fff` — warm-tinted) |
| `--color-foreground` | Near-black ink | Body text |
| `--color-muted` | Warm gray | Borders, dividers, disabled states |
| `--color-destructive` | Red | Delete buttons, error states |
| `--color-success` | Green | Success banners, "paid" badges |
| `--color-warning` | Amber | Attention banners, "pending" badges |

Additional token namespaces:

| Token group | Tokens | Usage |
|-------------|--------|-------|
| `sidebar*` | `--sidebar`, `--sidebar-foreground`, `--sidebar-primary`, `--sidebar-accent`, `--sidebar-border`, `--sidebar-ring` | Operator console navigation surfaces (distinct from page-level tokens) |

The palette is deliberately **warm** (not cold slate gray). Vietnamese OTA benchmarking (Vexere, 12Go, Grab, Be) showed that warm tones convey trust and local familiarity in this market.

**Contrast note**: Brand orange `#EA580C` fails WCAG 4.5:1 on white for normal-weight text. For links and inline text, use the deeper `#C2410C` (`oklch(0.566 0.20 38)`) as the `text-primary` value — this achieves 4.5:1. The orange `#EA580C` is only AA-safe on filled surfaces (buttons, badges) where it appears as background, not text.

**Typography**: **Be Vietnam Pro** (400/500/600/700 weights) — a humanist sans-serif designed for Vietnamese diacritics (tonal marks like ạ, ẻ, ữ render correctly without fallback issues). Loaded via **`next/font/google`** (self-hosted, FOUT-free, preloaded — not CDN `<link>` tags). Only 4 weights to minimize network requests on Vietnamese 4G. **Geist Mono** for prices, booking refs, timestamps, and code. No custom type scale — Tailwind defaults only (`text-xs` through `text-2xl`).

**Spacing**: 4px base grid. All padding/margin use multiples of 4px via Tailwind's default scale (`p-1` = 4px, `p-2` = 8px, etc.).

**Elevation**: Warm-tinted box shadows (not pure gray) in 4 levels — `shadow-e1` (subtle card), `shadow-e2` (raised), `shadow-e3` (dropdown), `shadow-e4` (dialog overlay). The warm tint matches the background color, preventing shadows from looking "pasted on".

**Radius scale**: `rounded-sm` (6px) for inputs → `rounded-4xl` (32px) for pill buttons. Soft, approachable — never sharp-cornered.

**Icon system**: **`lucide-react`** is the canonical icon library. Standard sizes: `size-4` (16px) and `size-5` (20px). Decorative icons carry `aria-hidden="true"`. Standalone icons (action buttons without visible text) require `aria-label`. No alternative icon libraries — one library for visual consistency and bundle control.

#### Responsive Strategy

**Mobile-first** with a single breakpoint at **768px** (`md:` in Tailwind).

| Portal | Mobile (<768px) | Desktop (≥768px) |
|--------|----------------|-------------------|
| Customer | Single-column, full-width cards, stacked layout | Same column with max-width constraint, optional sticky filter rail on search |
| Operator | Top bar + hamburger → left drawer | Persistent left sidebar (240px) + main content area |
| Admin | Same as operator pattern | Same as operator pattern |

**Why one breakpoint?** Vietnamese travelers are mobile-dominant (mid-range Android, 4G). The customer portal is designed for phone-in-hand use. Operators access their console from office desktops or tablets. Two layouts (phone vs. not-phone) cover both cases without the complexity of 3–4 breakpoint tiers.

#### App Shells

**Customer app shell**: `SiteHeader` (logo + nav links) at top + `SiteFooter` (legal links + copyright) at bottom. Content renders between them. Hero-led home page with search form, trust signals, popular trips. Results page optionally adds a sticky left filter rail (desktop only).

**Customer route inventory** (~17 routes):

| Route | Purpose | Rendering |
|-------|---------|-----------|
| `/` | Home — search form, popular trips, trust signals | RSC |
| `/search` | Trip results + filter/sort | RSC (client filter state in URL) |
| `/routes` | SEO browse — all routes directory | RSC |
| `/trips/[id]` | Trip detail — facts grid + sticky CTA | RSC |
| `/booking/customer` | Buyer info entry | Client (form state) |
| `/booking/review` | Hold timer + payment selection | Client (countdown, form) |
| `/booking/result/[token]` | Payment polling | Client (auto-refresh loop) |
| `/booking/confirmation/[token]` | Booking confirmed | RSC |
| `/auth/login`, `/register`, `/forgot-password`, `/reset-password` | Auth flows | Client (multi-step wizards) |
| `/account/bookings`, `/account/bookings/[id]`, `/account/settings` | Account management | Mixed |
| `/terms`, `/privacy` | Legal | RSC (static) |
| `/dev/stub-pay` | Dev-only payment stub (gated) | Client |

**Operator route inventory** (~16 routes):

| Route | Purpose |
|-------|---------|
| `/op/login` | Operator auth |
| `/op/first-login` | Password change (first-login gate) |
| `/op/(console)/dashboard` | **Booking call queue** — paid bookings awaiting operator contact (NOT a KPI dashboard) |
| `/op/(console)/dashboard/[id]` | Booking contact-tracking detail |
| `/op/(console)/upcoming` | Today's + tomorrow's departures |
| `/op/(console)/buses` | Fleet management (CRUD) |
| `/op/(console)/routes` | Route management |
| `/op/(console)/trips` | Trip management |
| `/op/(console)/trips/[id]` | Trip detail + manifest |
| `/op/(console)/trip-templates` | Recurring trip templates |
| `/op/(console)/reports/revenue` | Revenue report |
| `/op/(console)/reports/payouts` | Payout report |
| `/op/(console)/staff` | Staff management |
| `/op/(console)/manifest/[tripId]` | Print-ready boarding manifest |
| `/op/(console)/profile` | Operator profile + settings |
| `/op/staff/dashboard` | Staff-scoped view (minimal shell, no sidebar) |

Note: "Dashboard" (`/op/(console)/dashboard`) is a **work queue** (operator calls customers about paid bookings). KPI metrics live at `/op/(console)/reports/*`.

**Operator console shell**: Persistent left sidebar with **9 navigation items** in canonical order:

```
┌──────────────┬──────────────────────────────┐
│  🏠 Dashboard │                              │
│  📅 Upcoming  │                              │
│  🚌 Fleet     │       Main Content Area      │
│  🗺  Routes   │                              │
│  🎫 Trips     │       (table / form /        │
│  📋 Templates │        detail view)           │
│  📊 Reports   │                              │
│  👥 Staff     │                              │
│  👤 Profile   │                              │
│ ─────────────│                              │
│  🚪 Logout    │                              │
└──────────────┴──────────────────────────────┘
```

Mobile (<768px): sidebar collapses to a hamburger menu. Tapping opens a left-sliding drawer overlay (focus-trapped, Esc/outside-click closes). Active link highlighted with `aria-current="page"`.

**Navigation architecture constraints**:
- **One component, two render modes**: `<OperatorNav>` is a single component. CSS `md:` breakpoint toggles sidebar-mode vs drawer-mode — NOT two separate component trees (duplicated nav items would drift).
- **DOM position**: Sidebar `<nav>` is a **sibling** of `<main>`, never a child — `<nav>` inside `<main>` is a landmark violation.
- **Background isolation**: When the mobile drawer is open, `<main>` receives the `inert` HTML attribute (removes from tab order AND accessibility tree — not just `pointer-events: none`).
- **Staff dashboard exception**: `/op/staff/dashboard` renders **without** the `<OperatorNav>` shell — a separate minimal layout for staff-scoped views.

#### Pattern Library — 14 Cross-Page Patterns

Recurring UI patterns are codified in a shared library so every page composes from the same building blocks. New pages must use existing patterns (or define a new one first).

| ID | Pattern | Where used |
|----|---------|-----------|
| PTN-01 | App Shell | Every page (customer header/footer, operator sidebar) |
| PTN-02 | Hero Search | Customer home (search form + inspiration) |
| PTN-03 | Results + Filter Rail | `/search` (sticky filters + sort + chips + count) |
| PTN-04 | Entity Card | Trip cards in search results (price-forward) |
| PTN-05 | Fare/Tier Cards | Coach/sleeper/limousine comparison (future) |
| PTN-06 | Detail Layout | Trip detail (facts grid + sticky CTA bar) |
| PTN-07 | Checkout + Summary Rail | Booking flow (multi-step form + sticky order summary) |
| PTN-08 | Step Indicator | Registration wizard (3 dots showing progress) |
| PTN-09 | Data Table | Operator lists (sortable, expandable, mobile card-stack) |
| PTN-10 | Dashboard Tiles | KPI cards + sparklines + comparison metrics |
| PTN-11 | Forms | Field grouping, validation, error display, submit states |
| PTN-12 | States | Loading skeleton / empty / error / success per-page |
| PTN-13 | Breadcrumbs | Operator console wayfinding |
| PTN-14 | Trust Signals | Price breakdown, cancellation policy, operator logos, countdown timer |

Full pattern specs (anatomy, variants, responsive behavior, a11y) were consolidated into this section from the former `docs/design/patterns/` directory.

#### Key Pattern Architecture Decisions

**Data tables (PTN-09)**: Must use semantic `<table>` markup (NOT div-grid — div-based tables fail screen readers). Mobile swap is **CSS-only**: both the `<table>` and the `<Card>` stack are in the DOM, toggled by `md:` breakpoint. NOT a `useMediaQuery` JS swap (breaks SSR hydration and causes flash on first load). Dashboard booking queue uses **cursor pagination** with "Tải thêm" (load more) append — never offset-based or page-number pagination. Status labels for badges are centralized in `lib/op/statusLabels.ts` (single source of truth for status → variant + Vietnamese label mapping).

**Filter rail (PTN-03)**: On mobile, the filter rail becomes a **bottom-sheet** (focus-trapped overlay), not a collapsed panel or hidden element. Competitive rationale: Google Flights showed that a full left rail is too heavy for mobile bus search — filter chips + bottom-sheet are the mobile-first pattern.

**Checkout summary (PTN-07)**: On mobile, the summary rail collapses to a **sticky bottom bar** showing total + CTA, with an expand gesture to reveal the full price breakdown.

**Filter architecture**: Operator filter bands use `<form method=get>` with native form submission → RSC re-render. Filter state lives in URL searchParams (server-readable), NOT in React state. CSV export ("Tải CSV") is a native `<a download>` (GET request, no CSRF token needed) — not a JS `fetch()` + Blob URL.

**Auth layout**: `AuthSplitLayout` is shared by `/auth/*` and `/op/auth/*`. Split-panel on ≥768px. On mobile, the brand panel is CSS-hidden (`hidden md:flex`) but **DOM-present** — no CLS from late JS mount, and brand content is crawlable. The register flow is a single-route 3-step state machine (not 3 separate URLs).

**Layout personality**: Different customer surfaces have architecturally different layouts — NOT uniform centered-column. Results page = 2-column grid (filter rail + scrollable list). Checkout = content + sticky summary rail. Home = full-bleed hero + content bands.

#### Motion — Functional Only

Animation is restrained and functional — never decorative. Every transition serves a purpose (indicating state change, guiding attention, showing spatial relationships).

| Duration | Use | Examples |
|----------|-----|---------|
| 150ms (fast) | Hover, focus, tab cross-fade | Button hover, focus ring, Tabs panel switch |
| 200ms (base) | Overlays, reveals | Dialog fade+scale, Drawer slide-left, Toast slide-up |

**Easing**: `ease-out` for enter (fast start, gentle stop — feels responsive), `ease-in` for exit (gentle start, fast end — gets out of the way).

**Reduced motion**: ALL non-essential animation is gated by `@media (prefers-reduced-motion: reduce)`. Components use Tailwind's `motion-safe:` and `motion-reduce:` variants. This is a hard requirement (WCAG 2.3.3), not optional.

**Animation implementation**: Transitions are driven by base-ui's `data-open`/`data-closed`/`data-starting-style`/`data-ending-style` attributes via `tw-animate-css` CSS classes — never via `setTimeout`-gated mount/unmount (which causes focus races and flash-of-unstyled-content on unmount). Only **GPU-composited properties** animate: `opacity` and `transform`. Animating layout properties (`height`, `width`, `top`) forces per-frame reflow on mid-range Android. Exception: disclosure rows use `grid-template-rows: 0fr→1fr` (cheap reflow).

#### Competitive Context — Vietnamese OTA Benchmarking

Visual and interaction patterns were benchmarked against 7 OTA leaders serving the Vietnamese market:

| Platform | Key takeaway for our design |
|----------|---------------------------|
| **Vexere** | Orange accent + dense results + sticky filter rail — domain-exact template |
| **12Go** | Clear multimodal route cards, strong information hierarchy |
| **Grab** | Confident CTAs, large geometry, smooth motion, brand fills |
| **Be** | Local warmth, rounded forms, yellow/black brand personality |
| **Expedia** | Sticky left filter, sortable dense list, expandable price summary |
| **Booking.com** | Gold-standard dense list + sticky rail, urgency cues |
| **Google Flights** | Cleanest sort+filter+chips, minimal price-forward cards |

Convergent patterns adopted: orange primary (energy, action), humanist sans typography, warm elevation, pill CTAs, sticky filter rail on results, price-forward entity cards, multi-step checkout with summary rail.

Full benchmark data was consolidated into this section from the former `docs/design/benchmarks/` directory.
