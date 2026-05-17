---
name: responsive-test
description: Viewport Ã— prefers-reduced-motion Ã— prefers-color-scheme matrix runner via Playwright MCP. Per matrix cell, navigate critical screens, set viewport, screenshot, console-error check, verify media queries honored. Use when user says "responsive test", "mobile test", "tablet test", "dark mode test", "reduced motion", "viewport matrix", "/responsive-test", or before mobile rollout / marketing event. Writes docs/qa/responsive-YYYYMMDD.md.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# Responsive Test

Environment matrix runner. Smoke walks one viewport. This walks the cross-product of `viewport Ã— motion Ã— scheme` so mobile-only or dark-only bugs surface before launch.

## Why you'd care

A site that ships broken on mobile or in dark mode is shipping broken to >50% of traffic. A viewport + preference matrix run catches the layout collapse before the marketing event, not after.

## When This Skill Applies

Activate when:
- User says "responsive test", "mobile test", "tablet test", "viewport matrix", "dark mode", "reduced motion", "prefers-color-scheme", "prefers-reduced-motion", "/responsive-test"
- Before mobile rollout / marketing campaign / launch.
- After theme / token / design-system change (dark mode + motion likely affected).
- After viewport-affecting CSS change (Tailwind breakpoints, layout container).
- Periodic (monthly) drift check.

## Prerequisites

- Dev server running (`pnpm build && pnpm start` preferred â€” `pnpm dev` HMR overlay distorts screenshots).
- Playwright MCP available.
- List of critical screens (default: home, search-results, booking, success, login).
- Repo path `tests/responsive/` for screenshot output (gitignore preferred).
- `docs/design/wireframes-*.md` for mobile-variant cross-ref (if exists).

## Matrix

Default cells (15 per screen â€” adjust if screen count is high):

| Axis | Variants |
|------|----------|
| Viewport | `375Ã—667` mobile, `768Ã—1024` tablet, `1440Ã—900` desktop |
| Motion | default, `prefers-reduced-motion: reduce` |
| Scheme | default (light), `prefers-color-scheme: dark` |

Per `(screen Ã— viewport Ã— motion Ã— scheme)` cell â€” 5 screens Ã— 3 viewports Ã— (motion ON/OFF) Ã— (scheme light/dark) = 60 cells. Trim to high-signal subset if budget tight: all viewports default+default; mobile + reduce-motion; mobile + dark; desktop + dark.

## Steps

1. **Per cell**:
   - `browser_navigate(<url>)`.
   - **Set viewport** via Playwright MCP viewport API:
     ```js
     // via browser_resize or equivalent; fallback browser_evaluate
     browser_evaluate(`() => { window.resizeTo(${w}, ${h}); }`)
     ```
   - **Emulate media** (Playwright MCP `browser_emulate_media` if exposed; else inject CSS hint):
     ```js
     browser_evaluate(`() => {
       // Verify the page picks up the emulated value
       return {
         motion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
         scheme: window.matchMedia('(prefers-color-scheme: dark)').matches,
       };
     }`)
     ```
   - `browser_evaluate("() => document.fonts.ready")` â€” wait fonts.
   - `browser_take_screenshot(fullPage: true)` â†’ save to `tests/responsive/<screen>-<viewport>-<motion>-<scheme>.png`.
2. **Per cell assertions**:
   - `browser_console_messages` â†’ any non-allowlisted `error` â†’ FAIL cell.
   - `browser_evaluate("() => window.__pageErrors || []")` â†’ must be `[]`.
   - **Media-query honored**: `matchMedia` returns must match the emulated value.
   - **No horizontal scroll on mobile**: `browser_evaluate("() => document.documentElement.scrollWidth > window.innerWidth")` â†’ must be `false` for `375Ã—667`.
   - **Tap target â‰¥ 44px on mobile**: `browser_evaluate` measures `getBoundingClientRect()` for all `button, a` â€” flag any < 44Ã—44 (WCAG 2.5.5).
3. **Reduced-motion behavior probe**:
   - Pages with animation (booking-success confetti, search-result fade-in) must skip / shorten animation when `motion=reduce`.
   - `browser_evaluate` snapshot of running animations: `() => document.getAnimations().map(a => ({name: a.animationName, dur: a.effect?.getTiming().duration}))` â€” non-empty under reduce-motion â†’ flag.
4. **Dark-scheme behavior probe**:
   - Background tokens shifted: sample `getComputedStyle(document.body).backgroundColor` light vs dark â€” must differ.
   - Image contrast: any `<img>` with no `class` containing `dark:` and visible delta in dark mode â†’ flag.
5. **Aggregate** per screen Ã— variant grid.
6. **Write** `docs/qa/responsive-YYYYMMDD.md`.
7. **Auto-chain** per finding category.

## Output Format â€” `docs/qa/responsive-YYYYMMDD.md`

```markdown
---
audit-date: YYYY-MM-DD
target: http://localhost:3000
build-target: production | dev (warn)
viewports: [375x667, 768x1024, 1440x900]
motion-variants: [default, reduce]
scheme-variants: [light, dark]
status: pass | fail
---

# Responsive Test â€” YYYY-MM-DD

## Coverage grid

Legend: âœ… pass Â· âŒ fail Â· âš ï¸ warn Â· â€” not run

### / (home)

| viewport | light/default | light/reduce | dark/default | dark/reduce |
|----------|---------------|--------------|--------------|-------------|
| 375Ã—667 | âœ… | âœ… | âŒ | âš ï¸ |
| 768Ã—1024 | âœ… | âœ… | âœ… | âœ… |
| 1440Ã—900 | âœ… | âœ… | âœ… | âœ… |

### /search

| viewport | light/default | light/reduce | dark/default | dark/reduce |
|----------|---------------|--------------|--------------|-------------|
| 375Ã—667 | âŒ | âŒ | âŒ | âŒ |
| 768Ã—1024 | âœ… | âœ… | âœ… | âœ… |
| 1440Ã—900 | âœ… | âœ… | âœ… | âœ… |

### /booking/123

| viewport | light/default | light/reduce | dark/default | dark/reduce |
|----------|---------------|--------------|--------------|-------------|
| 375Ã—667 | âš ï¸ | âš ï¸ | âš ï¸ | âš ï¸ |
| 768Ã—1024 | âœ… | âœ… | âœ… | âœ… |
| 1440Ã—900 | âœ… | âœ… | âœ… | âœ… |

### /booking/success

| viewport | light/default | light/reduce | dark/default | dark/reduce |
|----------|---------------|--------------|--------------|-------------|
| 375Ã—667 | âœ… | âŒ | âœ… | âŒ |
| 768Ã—1024 | âœ… | âŒ | âœ… | âŒ |
| 1440Ã—900 | âœ… | âŒ | âœ… | âŒ |

## âŒ Failures

### / (home) â€” dark/default @ 375Ã—667
- **Issue**: `bg-white` on hero CTA not overridden by `dark:bg-zinc-900` â€” CTA invisible in dark mode.
- **Selector**: `[data-testid="hero-cta"]`.
- **Likely cause**: missing `dark:` variant on Tailwind class in `app/(public)/page.tsx`.
- **Screenshot**: `tests/responsive/home-375x667-default-dark.png`.

### /search â€” all variants @ 375Ã—667
- **Issue**: horizontal scroll present (`scrollWidth 412 > innerWidth 375`).
- **Selector**: `.results-table` overflow.
- **Likely cause**: table not wrapped in `overflow-x-auto` container; design-system tokens assume desktop width.
- **Cross-ref**: `docs/design/wireframes-search.md` â€” mobile variant says "stack as cards", but DOM still renders table.
- **Action**: introduce mobile card layout per wireframe.

### /booking/success â€” all viewports under `motion=reduce`
- **Issue**: confetti animation still plays â€” `document.getAnimations()` length 12 under reduce-motion.
- **Selector**: `.confetti-canvas`.
- **Likely cause**: confetti library not gated on `prefers-reduced-motion` media query.
- **Action**: wrap confetti init in `if (!matchMedia('(prefers-reduced-motion: reduce)').matches)`.

## âš ï¸ Warnings

### /booking/123 @ 375Ã—667 (all variants)
- **Tap targets < 44px**: 6 seat buttons measured 32Ã—32. WCAG 2.5.5 minimum is 44Ã—44.
- **Action**: bump seat button hit-area to 44Ã—44 (visual stays 32Ã—32 with padding) per `/design-system`.

## Sanity checks

| Check | Result |
|-------|--------|
| matchMedia honored across all cells | âœ… |
| No horizontal scroll @ 375Ã—667 | âŒ â€” /search fails |
| Tap target â‰¥ 44Ã—44 @ 375Ã—667 | âš ï¸ â€” /booking seat grid |
| Animations honor reduce-motion | âŒ â€” /booking/success confetti |
| Background differs light vs dark | âœ… |

## Verdict

**Status: âŒ FAIL gate.** 1 dark-mode regression (home CTA), 1 mobile-layout regression (search horizontal scroll), 1 motion regression (confetti).

Pre-launch fixes:
1. Add `dark:` variants on hero CTA â€” `app/(public)/page.tsx`.
2. Implement mobile card layout for search results per wireframe.
3. Gate confetti on `prefers-reduced-motion` query.

Non-blocking:
4. Bump seat-button hit-area to 44Ã—44.
```

## Boundaries

- **Read-only on app code.** Skill writes screenshots + report; never edits app source.
- **Production build preferred.** Dev mode HMR overlay distorts screenshots and dark-mode tokens.
- **Trim matrix when budget tight.** 60 cells Ã— 5 screens is heavy. High-signal subset: all viewports light/default; mobile light/reduce; mobile + desktop dark/default.
- **Wait for fonts.** `document.fonts.ready` before screenshot â€” same flake source as `/visual-regression`.
- **No fix patches.** Skill writes the report and routes to design-system / wireframe / component fix.
- **Single browser.** Chromium via Playwright MCP. Cross-browser responsive diff is out of scope.
- **Distinct from `/visual-regression`.** Visual-regression diffs vs baseline at fixed viewport. Responsive verifies the matrix functions at all â€” no baseline diff here.

## Re-run Behavior

- One report per date.
- Re-run after fix lands; cells flip green.
- Trim or expand matrix per launch risk.

## Auto-chain

- Mobile-only failure â†’ check `docs/design/wireframes-*.md` for mobile variant; if missing, run `/ui-wireframe`.
- Dark-mode regression â†’ `/design-system` token review (dark variant on tokens).
- Reduce-motion regression â†’ `/design-system` motion-token review; component animation gating.
- Tap-target failure â†’ `/design-system` button hit-area tokens; `/a11y-runtime` cross-ref WCAG 2.5.5.
- Horizontal-scroll failure â†’ component overflow fix; consider responsive table â†’ card pattern.
- Repeated mobile failure across screens â†’ likely shared layout container; single-source fix.

## Example Trigger

User: "we ship to mobile next week â€” check everything looks right on phone and dark mode"
â†’ For each (screen Ã— viewport Ã— motion Ã— scheme), navigate, set viewport + emulate media, screenshot, console-error check, media-query verify, tap-target check, write `docs/qa/responsive-YYYYMMDD.md`.
