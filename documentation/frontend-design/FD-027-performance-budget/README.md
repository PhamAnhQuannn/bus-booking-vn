# DS-044 FD-027: Performance Budget & Loading Strategy

## 1. Overview

This spec defines the performance targets, bundle budgets, and loading strategies for the Vietnamese bus booking platform. The target user is on a mid-range Android device over a 4G mobile connection --- the dominant access pattern for Vietnamese intercity bus travelers. All targets are derived from ADR-002 (NFR Targets) and calibrated against the design system (FD-001) and responsive strategy (FD-007).

---

## 2. Target Device Profile

| Parameter | Target Value | Rationale |
|-----------|-------------|-----------|
| Device class | Samsung Galaxy A14 equivalent | Mid-range Android, ~65% of Vietnam smartphone market |
| CPU | MediaTek Helio G80 (2x Cortex-A75 + 6x Cortex-A55) | Representative of sub-$200 Android devices |
| RAM | 4 GB | Minimum for smooth multi-tab browsing |
| Screen | 6.6" 1080x2408 (PPI 401) | Standard mid-range display |
| Connection | 4G LTE (~10 Mbps down, ~3 Mbps up, 50ms RTT) | Urban/suburban Vietnam mobile coverage |
| Browser | Chrome mobile (latest - 2 versions) | 85%+ Vietnam mobile browser share |
| Test profile | Chrome DevTools "Mid-tier mobile" throttling | 4x CPU slowdown + "Fast 3G" network preset |

---

## 3. Core Web Vitals Targets

| Metric | Target (p75) | Alert Threshold | Measurement |
|--------|-------------|-----------------|-------------|
| LCP (Largest Contentful Paint) | < 2.5s | > 4.0s | Real User Monitoring via `web-vitals` |
| CLS (Cumulative Layout Shift) | < 0.1 | > 0.25 | Real User Monitoring via `web-vitals` |
| INP (Interaction to Next Paint) | < 200ms | > 500ms | Real User Monitoring via `web-vitals` |

### 3.1 LCP Budget Breakdown

Target: 2.5s total on 4G.

| Phase | Budget | Strategy |
|-------|--------|----------|
| DNS + TCP + TLS | ~150ms | Connection reuse, HTTP/2 multiplexing |
| TTFB (server response) | ~400ms | Streaming SSR, edge middleware for auth |
| Resource download | ~800ms | Gzipped bundle < 150KB, font preload |
| Render + hydration | ~600ms | Partial hydration via RSC, deferred client JS |
| Buffer | ~550ms | Absorbs variance in 4G conditions |

### 3.2 CLS Prevention Rules

| Rule | Implementation |
|------|---------------|
| Reserve space for images | `width` + `height` attributes on all `<img>` / `next/image` |
| Reserve space for async content | Skeleton fallbacks with matching dimensions inside `<Suspense>` |
| No layout-shifting font load | `font-display: swap` with sized fallback stack |
| No injected banners above fold | Consent/cookie banners fixed-position, not in document flow |
| No late-loading nav elements | Nav rendered server-side in initial HTML |

### 3.3 INP Optimization

| Technique | Application |
|-----------|-------------|
| `startTransition` for non-urgent updates | Search filter changes, pagination |
| `useOptimistic` for instant feedback | Booking actions, check-in toggles |
| Debounce expensive handlers | Search input (300ms), date picker (150ms) |
| Avoid main-thread blocking | Heavy computation (seat count, price calc) in `requestIdleCallback` |

---

## 4. Bundle Size Budgets

### 4.1 Per-Route Group Limits

| Route Group | Max JS (gzipped) | Max CSS (gzipped) | Rationale |
|-------------|------------------|-------------------|-----------|
| Customer pages `app/(customer)/` | 150 KB | 30 KB | Price-sensitive users on data plans; every KB costs money |
| Operator console `app/op/` | 200 KB | 40 KB | Data tables + forms are heavier; operators on WiFi/broadband |
| Admin `app/admin/` | No strict budget | No strict budget | Internal tool, desktop-only, corporate network |

### 4.2 Shared Chunks

| Chunk | Expected Size (gzipped) | Notes |
|-------|------------------------|-------|
| React + React DOM | ~45 KB | Framework baseline, unavoidable |
| Next.js runtime | ~30 KB | App Router runtime |
| Design system (Tailwind CSS output) | ~15 KB | Purged to used classes only |
| `@base-ui/react` primitives | ~8 KB | Tree-shaken to used components |
| `lucide-react` icons | ~3 KB | Only imported icons bundled |

### 4.3 Budget Enforcement

- `next build` output analyzed per route in CI
- Alert when any customer route exceeds 150 KB gzipped JS
- Block merge when any customer route exceeds 200 KB gzipped JS (hard ceiling with 33% buffer)

---

## 5. Font Loading Strategy

### 5.1 Be Vietnam Pro

| Property | Value |
|----------|-------|
| Font family | Be Vietnam Pro |
| Weights loaded | 400 (regular), 600 (semibold) only |
| Format | WOFF2 (variable or static) |
| Subset | Vietnamese + Latin glyphs |
| `font-display` | `swap` |
| Preload | Yes --- `<link rel="preload" as="font" type="font/woff2" crossorigin>` in `<head>` |
| CSS variable | `--font-be-vietnam` |

### 5.2 Fallback Stack

```css
font-family: var(--font-be-vietnam), system-ui, -apple-system, sans-serif;
```

The fallback stack renders immediately while WOFF2 loads. `system-ui` on Android resolves to Roboto, which has reasonable Vietnamese glyph coverage for the swap period.

### 5.3 Geist Mono (Code/Data)

| Property | Value |
|----------|-------|
| Font family | Geist Mono |
| Weights loaded | 400 only |
| Usage | Booking references, ledger amounts, technical data |
| Preload | No (not critical path) |
| CSS variable | `--font-geist-mono` |

### 5.4 Font File Size Budget

| Font | Subset | Expected Size |
|------|--------|--------------|
| Be Vietnam Pro 400 (WOFF2) | Vietnamese + Latin | ~25 KB |
| Be Vietnam Pro 600 (WOFF2) | Vietnamese + Latin | ~25 KB |
| Geist Mono 400 (WOFF2) | Latin | ~15 KB |
| **Total** | | **~65 KB** |

---

## 6. Image Optimization

### 6.1 `next/image` Configuration

All images use the `next/image` component with automatic format negotiation:

| Property | Value |
|----------|-------|
| Formats | WebP (primary), AVIF (when supported) |
| Quality | 75 (default), 85 (hero/marketing) |
| Placeholder | `blur` for above-fold images, none for lazy-loaded |
| Sizes | Responsive `sizes` attribute matching breakpoints |

### 6.2 Responsive `srcset`

| Breakpoint | Image Width | Use Case |
|------------|------------|----------|
| Mobile | 640w | Full-width cards, operator logos |
| Tablet | 1024w | Split layouts, route cards |
| Desktop | 1440w | Hero banners, marketing pages |

### 6.3 Hero Image Loading

```html
<link rel="preload" as="image" href="/hero-mobile.webp"
      media="(max-width: 767px)" fetchpriority="high">
<link rel="preload" as="image" href="/hero-desktop.webp"
      media="(min-width: 768px)" fetchpriority="high">
```

Hero images are preloaded with `fetchpriority="high"` and media queries to avoid downloading both sizes. This is the only image category that uses preload --- all others use native lazy loading.

### 6.4 Lazy Loading

All non-hero images:

```html
<img loading="lazy" decoding="async" ... />
```

Via `next/image`, which applies these attributes automatically for images below the fold (`priority={false}`, the default).

---

## 7. Code Splitting

### 7.1 Route-Level Splitting

Next.js App Router provides automatic code splitting per route segment. Each `page.tsx` and `layout.tsx` is a separate chunk. Shared layouts (e.g., operator console shell) are loaded once and reused across child routes.

### 7.2 Heavy Component Lazy Loading

Components that exceed 30 KB gzipped or are not visible on initial render are lazy-loaded via `next/dynamic`:

| Component | Estimated Size | Lazy Pattern |
|-----------|---------------|--------------|
| Calendar / Date Picker | ~35 KB | `dynamic(() => import('./Calendar'), { ssr: false })` |
| DataTable (operator/admin) | ~40 KB | `dynamic(() => import('./DataTable'))` with skeleton |
| CommandPalette (admin) | ~25 KB | `dynamic(() => import('./CommandPalette'), { ssr: false })` |
| PDF Viewer (KYB documents) | ~50 KB | `dynamic(() => import('./PdfViewer'), { ssr: false })` |
| Chart components (revenue) | ~45 KB | `dynamic(() => import('./RevenueChart'), { ssr: false })` |

### 7.3 Third-Party Tree Shaking

| Library | Strategy |
|---------|----------|
| `date-fns` | Import only used functions: `import { format } from 'date-fns/format'`. Locale: `import { vi } from 'date-fns/locale/vi'` |
| `lucide-react` | Import individual icons: `import { Bus } from 'lucide-react'` (not `import * as Icons`) |
| `@base-ui/react` | Import specific primitives: `import { Dialog } from '@base-ui-components/react/dialog'` |

---

## 8. Streaming SSR & Suspense

### 8.1 Streaming Strategy

Every page with data fetches uses React `<Suspense>` boundaries to enable streaming SSR. The HTML shell (nav, layout, skeleton placeholders) is sent immediately; data-dependent sections stream in as they resolve.

### 8.2 Suspense Boundary Placement

| Level | When | Example |
|-------|------|---------|
| Page-level | Single data dependency | Search results page |
| Section-level | Multiple independent data sources | Dashboard: stats card + departures list as separate boundaries |
| Component-level | Heavy interactive widget | Revenue chart within reports page |

### 8.3 Skeleton Design Rules

| Rule | Rationale |
|------|-----------|
| Skeleton dimensions MUST match final layout | Prevents CLS when content loads |
| Use `animate-pulse` on `bg-muted` rectangles | Consistent loading indicator from design system |
| Skeleton count matches expected row count (or max 5) | Communicates expected content density |
| Never show spinner instead of skeleton | Skeletons preserve spatial context; spinners don't |

---

## 9. Grain Texture Performance

The design system (FD-001) specifies an SVG noise overlay for brand texture:

| Property | Value |
|----------|-------|
| Implementation | Inline SVG `<filter>` with `feTurbulence` + `feColorMatrix` |
| Opacity | `opacity-[0.04]` (light mode), `opacity-[0.06]` (dark mode) |
| CSS | `position: fixed; inset: 0; pointer-events: none; z-index: 50` |
| GPU compositing | `will-change: opacity` forces GPU layer, zero paint cost |
| Performance impact | Negligible --- single composited layer, no repaints on scroll |

The overlay is applied once at the root layout level, not per-component.

---

## 10. Monitoring & Reporting

### 10.1 Real User Monitoring

Core Web Vitals reported via the `web-vitals` library:

```typescript
import { onLCP, onCLS, onINP } from 'web-vitals';

function reportMetric(metric: Metric) {
  // POST to analytics endpoint
  fetch('/api/analytics/vitals', {
    method: 'POST',
    body: JSON.stringify({
      name: metric.name,
      value: metric.value,
      rating: metric.rating,  // 'good' | 'needs-improvement' | 'poor'
      navigationType: metric.navigationType,
      url: location.pathname,
    }),
  });
}

onLCP(reportMetric);
onCLS(reportMetric);
onINP(reportMetric);
```

### 10.2 Build-Time Analysis

| Check | Tool | Threshold |
|-------|------|-----------|
| Route JS size | `next build` output parser | 150 KB warn, 200 KB error (customer routes) |
| Total bundle | `@next/bundle-analyzer` | Dashboard review, no hard gate |
| Unused CSS | Tailwind purge report | Should be < 5% of total CSS |

---

## 11. Network Resilience

| Scenario | Behavior |
|----------|----------|
| Slow 3G (< 1 Mbps) | Streaming SSR delivers readable content in < 5s. Skeleton fallbacks prevent blank screen |
| Offline | Service worker not in v1 scope. Show browser-native offline page. Manifest PDF is sessionStorage-cached (FD-030) |
| Intermittent connection | `fetch` retries with exponential backoff (max 3 attempts) for mutation endpoints |
| High latency (> 200ms RTT) | Optimistic UI for check-in actions; deferred analytics reporting |

---

## 12. Cross-References

| Reference | Relevance |
|-----------|-----------|
| ADR-002 NFR Targets | Source of LCP, API latency, throughput, and availability targets |
| DS-018 FD-001 Design System | Typography (Be Vietnam Pro), grain texture, color system, component primitives |
| DS-024 FD-007 Responsive/Mobile | Breakpoints, touch targets, operator nav patterns, image preload strategy |
| DS-028 FD-011 Data Fetching | Streaming SSR, Suspense boundaries, cache/revalidation strategy |
| DS-045 FD-028 Portal Architecture | Route groups, RSC/client boundaries affecting bundle composition |
| ADR-001 Stack Pick | Next.js App Router, SSR streaming, edge middleware architecture |
| Operator Personas | Micro operators on phone/3G; students on prepaid data plans |
| Customer Personas | Samsung Galaxy A-series as reference device; data-cost sensitivity |
