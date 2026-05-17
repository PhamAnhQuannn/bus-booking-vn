---
name: a11y-runtime
description: Runtime accessibility scan via axe-core (CDN-injected) plus keyboard-only walkthrough using Playwright MCP. Validates the running app against WCAG 2.2 AA. Use when user says "a11y runtime", "axe scan", "WCAG runtime", "keyboard test", "screen reader smoke", "/a11y-runtime", or before merging consumer-facing UI. Writes docs/qa/a11y-runtime-YYYYMMDD.md. Pairs with /a11y-design (spec) â€” this skill verifies the spec actually shipped.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# A11y Runtime Scan

## Why you'd care

A spec that shipped isn't the same as a spec that works. Static review misses focus traps, dynamic ARIA bugs, and keyboard dead-ends that only surface against the real running app — and those are exactly what gets flagged in a complaint.

`/a11y-design` writes the contract. `/a11y-runtime` verifies the running build honors it. Two probes: **axe-core scan** (programmatic) + **keyboard-only walkthrough** (manual emulation via Playwright MCP).

## When This Skill Applies

Activate when:
- User says "a11y runtime", "axe scan", "WCAG runtime", "keyboard test", "screen reader smoke", "tab order check", "/a11y-runtime"
- Pre-merge of any consumer-facing UI change.
- Pre-launch readiness gate.
- After theme / token / design-system change (contrast may have shifted).
- Customer report of a11y issue.

## Prerequisites

- Dev server running (`http://localhost:3000` default).
- Playwright MCP available.
- `docs/design/a11y-*.md` exists for the feature being audited (cross-ref source).
- List of critical screens to scan (default: home, search-results, booking, success, login).

## Steps

1. **Navigate** to first screen via `browser_navigate`.
2. **Inject axe-core via CDN** through `browser_evaluate`:
   ```js
   browser_evaluate(`async () => {
     if (window.axe) return 'already-loaded';
     await new Promise((res, rej) => {
       const s = document.createElement('script');
       s.src = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.0/axe.min.js';
       s.onload = res; s.onerror = rej;
       document.head.appendChild(s);
     });
     return 'loaded';
   }`)
   ```
3. **Run axe.run()** with WCAG 2.2 AA tags:
   ```js
   browser_evaluate(`async () => {
     const r = await axe.run(document, {
       runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] }
     });
     return { violations: r.violations, incomplete: r.incomplete, passes: r.passes.length };
   }`)
   ```
4. **Group violations** by impact: `critical` / `serious` / `moderate` / `minor`. Each violation includes `id`, `help`, `helpUrl`, `nodes[]` with `target` selector + `failureSummary`.
5. **Keyboard-only walkthrough** per critical screen:
   - `browser_press_key("Tab")` repeatedly. After each Tab: `browser_evaluate("() => document.activeElement.outerHTML.slice(0,200)")`.
   - Build observed tab order. Compare to `docs/design/a11y-<feature>.md` keyboard map.
   - At every step: assert `:focus-visible` ring present (`browser_evaluate("() => getComputedStyle(document.activeElement).outline")`).
   - Activate primary CTA via Enter; confirm action fires.
   - Press Esc on modal â†’ confirm closes (where spec says it should).
6. **Screen-reader name check** (lightweight): for every interactive element on screen, read its accessible name via `browser_evaluate(el => el.ariaLabel || el.textContent || el.title)`. Empty name on any button/link â†’ flag.
7. **Reduced-motion probe**: `browser_evaluate("() => window.matchMedia('(prefers-reduced-motion: reduce)').matches")` after emulation set; verify animations honor it.
8. **Aggregate** per screen + global verdict.
9. **Write** `docs/qa/a11y-runtime-YYYYMMDD.md`.
10. **Auto-chain** per finding category.

## Output Format â€” `docs/qa/a11y-runtime-YYYYMMDD.md`

```markdown
---
audit-date: YYYY-MM-DD
target: http://localhost:3000
axe-core-version: 4.10.0
wcag-target: 2.2 AA
status: pass | fail
---

# A11y Runtime â€” YYYY-MM-DD

## Screens scanned

| Screen | axe violations | keyboard | unnamed elements | verdict |
|--------|----------------|----------|------------------|---------|
| / | 0 | âœ… | 0 | âœ… PASS |
| /search | 2 (1 serious, 1 moderate) | âœ… | 0 | âŒ FAIL |
| /booking/123 | 1 critical | âš ï¸ tab skips seat 4 | 1 | âŒ FAIL |
| /booking/success | 0 | âœ… | 0 | âœ… PASS |
| /login | 0 | âœ… | 0 | âœ… PASS |

## axe violations

### Critical

#### color-contrast â€” countdown badge
- **Page**: /booking/123
- **Selector**: `[data-testid="countdown-warn"]`
- **Help**: Elements must have sufficient color contrast
- **HelpUrl**: https://dequeuniversity.com/rules/axe/4.10/color-contrast
- **Failure**: foreground #F59E0B on #FFFFFF â€” 2.4:1, requires 4.5:1
- **Fix**: bump token `warn-text` to #B45309 in `tailwind.config.ts` per `/design-system`

### Serious

#### label â€” search filters
- **Page**: /search
- **Selector**: `input[name="depart-time"]`
- **Failure**: form input has no associated label
- **Fix**: wrap with shadcn `<Label htmlFor="depart-time">` per `/design-system`

### Moderate

#### landmark-one-main
- **Page**: /search
- **Failure**: page has no `<main>` landmark
- **Fix**: wrap results region in `<main>` in `app/(public)/search/page.tsx`

## Keyboard walkthrough findings

### /booking/123 â€” tab skips seat 4
- Observed order: seat-1 â†’ seat-2 â†’ seat-3 â†’ seat-5 â†’ ...
- Expected (per `docs/design/a11y-booking.md`): seat-1 â†’ seat-2 â†’ seat-3 â†’ seat-4 â†’ seat-5
- Likely cause: `tabIndex={-1}` on seat-4 (occupied) but spec says occupied seats announce "occupied" via `aria-disabled` and stay tabbable.

## Unnamed interactive elements

| Page | Selector | Element |
|------|----------|---------|
| /booking/123 | `button.icon-only-share` | `<button><svg /></button>` â€” no aria-label |

## Reduced-motion check

| Page | matchMedia returns | animations honor | verdict |
|------|--------------------|------------------|---------|
| / | true | yes | âœ… |
| /booking/success | true | confetti still plays | âŒ â€” needs `@media (prefers-reduced-motion: reduce)` guard |

## Verdict

**Status: âŒ FAIL.** 1 critical contrast, 1 serious label, 1 keyboard skip, 1 unnamed button, 1 motion ignore.

Top fixes:
1. Contrast token bump (design-system, blocking).
2. Label association on `input[name="depart-time"]`.
3. Tabindex fix on occupied seats.
4. aria-label on icon-only share button.
5. Confetti respects reduced-motion.

## Cross-ref to design

| Finding | Spec source | Drift? |
|---------|-------------|--------|
| countdown contrast | `docs/design/a11y-booking.md` | yes â€” design says 4.5:1, token shipped at 2.4:1 |
| seat tab order | `docs/design/a11y-booking.md` | yes â€” design says occupied stay tabbable |
| confetti motion | `docs/design/a11y-success.md` | yes â€” design says reduce â†’ fade-only |
```

## Boundaries

- **Read-only.** Skill never edits app code; only writes report.
- **WCAG 2.2 AA target.** Don't grade against AAA unless `docs/nfr.md` says so.
- **Cross-ref the spec.** Pure axe scan without `docs/design/a11y-*.md` comparison misses *intent* drift.
- **Skip incomplete violations** in the verdict (axe `incomplete[]` is noise) â€” list them in an appendix only.
- **No fix patches.** Skill writes the report and routes to the owning skill.
- **Single browser.** Chromium via Playwright MCP. Multi-browser a11y diff is out of scope.

## Re-run Behavior

- One report per date. Re-run = new file.
- Diff vs prior to confirm regressions resolved.

## Auto-chain

- Contrast violation â†’ `/design-system` token review.
- Label / structure violation â†’ fix in component, re-run.
- Tab-order drift vs design â†’ `/a11y-design` re-run if design wrong; component fix if design right.
- Reduced-motion ignore â†’ `/design-system` motion-token review.
- Repeat violations across screens â†’ likely shared component issue â†’ grep for the component, single fix.

## Example Trigger

User: "before we ship the booking page run a real a11y check"
â†’ Navigate critical screens, inject axe-core, run scan, do keyboard walkthrough, name-check interactive, check reduced-motion, write `docs/qa/a11y-runtime-YYYYMMDD.md`.
