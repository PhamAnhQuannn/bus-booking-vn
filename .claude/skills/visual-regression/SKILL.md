---
name: visual-regression
description: Per-screen screenshot baseline + pixel diff via pixelmatch (CDN-loaded through browser_evaluate). First run creates baselines under tests/visual/__baselines__/. Subsequent runs diff and write delta images under tests/visual/__diffs__/. Use when user says "visual regression", "screenshot diff", "baseline", "snapshot test", "pixel diff", "/visual-regression", or before merging UI changes. Writes docs/qa/visual-regression-YYYYMMDD.md.
output_size:
  XS: skip
  S: 1h
  M: 2h
  L: 4h
  XL: 6h
---

# Visual Regression

`/smoke-test` takes screenshots but never diffs them. This skill diffs against a committed baseline. Surfaces unintended UI drift (token change rippling, broken flex layout, leaked padding) before merge.

## Why you'd care

UI changes routinely break screens far from the one being edited — and human reviewers don't catch it. Pixel-diff baselines are what surface the unintended drift before it ships to users.

## When This Skill Applies

Activate when:
- User says "visual regression", "snapshot test", "screenshot diff", "pixel diff", "baseline", "VRT", "/visual-regression"
- Pre-merge of UI changes.
- After design-system / token / theme change.
- After dep upgrade that touches CSS (Tailwind, shadcn, fonts).
- Periodic (weekly) drift check.

## Prerequisites

- Dev server running (preferred: `pnpm build && pnpm start` for stable rendering).
- Playwright MCP available.
- Repo path `tests/visual/__baselines__/` for baselines (commit these).
- Repo path `tests/visual/__diffs__/` for diff output (gitignore preferred).
- List of screens Ã— viewports to capture.

## Steps

1. **Inventory targets**. For each `(screen, viewport)` pair, expected baseline at `tests/visual/__baselines__/<screen>-<viewport>.png`.
2. **Per target**:
   - `browser_navigate(<url>)`.
   - `browser_evaluate("() => document.fonts.ready")` â€” wait for fonts so anti-aliasing matches.
   - Disable animations:
     ```js
     browser_evaluate(`() => {
       const s = document.createElement('style');
       s.textContent = '*,*::before,*::after { transition: none !important; animation: none !important; caret-color: transparent !important; }';
       document.head.appendChild(s);
     }`)
     ```
   - Set viewport via Playwright MCP viewport API or `browser_evaluate` resize.
   - `browser_take_screenshot(fullPage: true)` â†’ returns image bytes / saves to path.
3. **Baseline mode** (no existing baseline OR `--baseline` flag): save current image as baseline, mark target NEW. Note in report: "BASELINE â€” review and commit".
4. **Diff mode** (baseline exists):
   - Inject pixelmatch + pngjs via CDN through `browser_evaluate`. (pixelmatch needs raw RGBA buffers. Easier: do diff in Node via Bash â€” see Diff implementation below.)
   - Compute pixel diff with threshold 0.1 (per-pixel sensitivity), aa-tolerance true.
   - Output total `mismatchedPixels`. Compute `mismatchPercent = mismatched / (w*h)`.
   - **Threshold**: `mismatchPercent > 0.1%` â†’ FAIL. `â‰¤ 0.1%` â†’ PASS (anti-aliasing noise tolerated).
   - Save diff image to `tests/visual/__diffs__/<screen>-<viewport>.png`.
5. **Aggregate** results.
6. **Write** `docs/qa/visual-regression-YYYYMMDD.md`.
7. **Auto-chain** per finding category.

## Diff implementation

Two routes. Pick whichever is available without permanent dep:

**Route A â€” npx pixelmatch (preferred, no install):**
```bash
npx -y pixelmatch \
  tests/visual/__baselines__/<screen>-<viewport>.png \
  .tmp/current-<screen>-<viewport>.png \
  tests/visual/__diffs__/<screen>-<viewport>.png \
  0.1
# stdout reports mismatched pixels
```

**Route B â€” browser-side via CDN** (when Bash not available):
```js
// Load pixelmatch + pngjs from esm.sh, decode both PNGs in browser, compare.
// Heavier; use only if Bash route unavailable.
```

Default to Route A unless flagged.

## Output Format â€” `docs/qa/visual-regression-YYYYMMDD.md`

```markdown
---
audit-date: YYYY-MM-DD
target: http://localhost:3000
build-target: production | dev (warn)
viewports: [375x667, 768x1024, 1440x900]
threshold: 0.1% pixel mismatch
status: pass | fail | needs-baseline-review
---

# Visual Regression â€” YYYY-MM-DD

## Targets

| Screen | Viewport | Status | Mismatch | Diff |
|--------|----------|--------|----------|------|
| home | 1440x900 | âœ… PASS | 0.02% | â€” |
| home | 375x667 | âŒ FAIL | 4.10% | `tests/visual/__diffs__/home-375x667.png` |
| search | 1440x900 | âœ… PASS | 0.05% | â€” |
| search | 375x667 | âœ… PASS | 0.08% | â€” |
| booking | 1440x900 | âŒ FAIL | 1.20% | `tests/visual/__diffs__/booking-1440x900.png` |
| booking | 375x667 | ðŸ†• BASELINE | â€” | created baseline |
| success | 1440x900 | âœ… PASS | 0.0% | â€” |
| login | 1440x900 | âœ… PASS | 0.0% | â€” |

## âŒ Regressions

### home @ 375x667 â€” 4.10%
- Diff: `tests/visual/__diffs__/home-375x667.png`
- Visible delta: header padding shrunk by ~12px; CTA button radius changed.
- Likely cause: `tailwind.config.ts` token edit touched `spacing.4` and `radius.md`.
- Action: confirm intentional â†’ re-baseline. Unintentional â†’ revert token.

### booking @ 1440x900 â€” 1.20%
- Diff: `tests/visual/__diffs__/booking-1440x900.png`
- Visible delta: seat-grid border color changed from `#E5E7EB` to `#D4D4D8`.
- Likely cause: shadcn upgrade swapped border token.
- Action: review against `/design-system` color tokens.

## ðŸ†• New baselines (review before commit)

| Screen | Viewport | File |
|--------|----------|------|
| booking | 375x667 | `tests/visual/__baselines__/booking-375x667.png` |

These were created this run because no baseline existed. **Human-review the screenshot, then `git add`** to commit them.

## Verdict

**Status: âŒ FAIL gate.** 2 regressions, 1 new baseline pending review.

Pre-merge actions:
1. Decide if home padding/radius change is intentional. If yes â†’ re-baseline + commit. If no â†’ revert.
2. Confirm seat-grid border color matches `/design-system`.
3. Review new `booking-375x667` baseline + commit.

## Re-baseline

To re-baseline (after confirming change is intentional):
```
rm tests/visual/__baselines__/<screen>-<viewport>.png
# re-run /visual-regression â€” it will re-create as baseline
git add tests/visual/__baselines__/<screen>-<viewport>.png
```
```

## Boundaries

- **Read-only on app code.** Skill writes baselines + diffs + report; never edits app source.
- **Production build preferred.** Dev mode renders differ (HMR overlay, source maps); flag if running against dev.
- **Disable animations.** Otherwise diffs become flaky.
- **Wait for fonts.** `document.fonts.ready` before screenshot â€” font swap is the #1 flake source.
- **Threshold tight.** 0.1% is generous for anti-aliasing; do not raise to "make tests pass" â€” re-baseline instead.
- **Baselines committed**, diffs gitignored. Easy PR review of intentional changes.
- **Single browser.** Chromium via Playwright MCP. Cross-browser visual diff is out of scope.
- **No fix patches.** Skill writes the report and routes to design-system / component fix.

## Re-run Behavior

- One report per date.
- Re-baseline by deleting the stale baseline file and re-running.
- Diffs cleared per run (overwritten).

## Auto-chain

- Token-driven regression (color/spacing/radius) â†’ `/design-system` token review.
- Component-shape regression â†’ check the component file's recent diff.
- Multiple screens regress same way â†’ likely shared component or token; single-source fix.
- Mobile-only regression â†’ `/responsive-test` for full env coverage.
- Repeated flakes on a screen â†’ tighten font-load wait or animation disable.

## Example Trigger

User: "I touched tailwind.config â€” make sure nothing else moved"
â†’ For each (screen Ã— viewport), capture, diff against baseline, save diff images, write `docs/qa/visual-regression-YYYYMMDD.md`.
