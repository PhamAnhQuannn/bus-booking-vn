---
name: dashboard-layout
description: Dashboard layout + KPI hierarchy. Headline metrics, secondary tiles, drill-down, period comparison, refresh strategy, density modes, empty/loading/error per tile. Outputs `docs/design/dashboard-<surface>.md` with grid + tile catalog + interaction map + a11y. Use when user says "dashboard", "KPI", "metrics page", "analytics view", "reporting layout", "drill-down", "/dashboard-layout", or before adding a data-heavy view.
output_size:
  XS: skip
  S: 1h
  M: 2h
  L: 4h
  XL: 6h
---

# Dashboard Layout

## Why you'd care

A dashboard with 18 equally-weighted tiles is a wall of numbers nobody acts on — and the exec who asked for it stops opening the page by week two because finding "is the business healthy this week?" takes five minutes of scanning. Strict hierarchy with 3-5 headline KPIs above the fold plus drill-down on click is what turns the dashboard from a vanity artifact into a daily decision tool, and the skill of saying no to the 19th tile is what keeps it that way.

Most dashboards drown the reader. The fix is a strict hierarchy: 3-5 headline KPIs above the fold, supporting tiles below, drill-down on click. This skill picks the grid, ranks the metrics, defines refresh + comparison + per-tile state.

## When This Skill Applies

Activate when:
- User says "dashboard", "KPI", "metrics page", "analytics view", "reporting", "drill-down", "/dashboard-layout"
- New data-heavy view (admin, analytics, ops, finance)
- Existing dashboard cited as "cluttered" / "can't find anything"
- Adding a new metric to existing dashboard (forces hierarchy re-eval)

## Prerequisites

- KPI list with definition + source query per metric.
- User-of-dashboard persona (operator vs exec vs analyst — drives density).
- Refresh budget (real-time / 5min / hourly / daily).
- Chart type decisions per tile (`docs/design/chart-types.md`).
- Wireframe shell (`docs/design/wireframes/dashboard.md`).

## Steps

1. **Rank KPIs.** Top 3-5 = headline (above fold, large). Next 6-10 = secondary tiles. Rest = drill-down only. *Conditional on Step 1.5:* the headline-KPI ranking is the full method only if the KPI-grid personality was picked.
1.5. **Layout-personality menu.** The "3-5 headline KPIs + 12-column symmetric grid" pattern is ONE option, not the default. Consciously pick a layout personality from:
   - **KPI-grid** — 3-5 headline big-numbers above a symmetric tile grid (the classic — pick it deliberately, not by reflex).
   - **Editorial / asymmetric** — a lead metric or narrative panel given disproportionate space; tiles flow around it.
   - **Dense data-table-led** — the table *is* the dashboard; KPIs are a thin summary strip.
   - **Spacious card-led** — few large cards, generous whitespace, one idea per card.
   - **Sidebar-driven** — persistent filter/nav rail; content area re-renders per selection.
   Pick one and record it. Defaulting to KPI-grid without considering the others trips tells T4 (KPI-grid headline) and T13 (no layout personality).
2. **Pick grid.** If the KPI-grid personality was picked in 1.5: 12-col responsive (web), tab-per-section (mobile), or single-column (narrow). For other personalities, pick the grid the personality implies (editorial = asymmetric span; data-table-led = full-width table + summary strip; etc.).
3. **Tile catalog.** Per tile: metric, viz type, comparison (vs prior period / vs target), drill target.
4. **Period control.** Global date range picker + per-tile override only if needed.
5. **Comparison rules.** Default: vs prior equivalent period (this week vs last week). Sparkline + delta % + arrow.
6. **Refresh strategy.** Live-tick / polled / on-load / manual; per-tile timestamp visible.
7. **Drill-down map.** Click tile → detail page or in-place expand; breadcrumb back.
8. **Per-tile state.** Loading skeleton, empty ("no data this period"), error ("failed to load — retry"), stale.
9. **Density modes.** Compact / comfortable; respect user preference.
10. **A11y.** Tile = labeled region; chart has data-table fallback; color-blind safe palette.
11. **Write** `docs/design/dashboard-<surface>.md`.
12. **Auto-chain.** Per chart → `/chart-type-pick`. Per tile state → `/state-pattern-catalog`. Events → `/analytics-spec`.

## Output Format — `docs/design/dashboard-<surface>.md`

```markdown
---
last-updated: YYYY-MM-DD
status: draft | reviewed | implemented
audience: ops-manager (primary), exec (read-only)
layout-personality: kpi-grid | editorial-asymmetric | data-table-led | spacious-card-led | sidebar-driven
refresh: hourly via cache; manual refresh button always available
---

# Dashboard — Operations

## Headline KPIs (above fold)

| # | Metric | Viz | Comparison | Drill |
|---|--------|-----|-----------|-------|
| 1 | Active bookings (now) | Big-number | vs same hour last week | /bookings?status=active |
| 2 | Completed today | Big-number + sparkline | vs yesterday | /bookings?status=done&date=today |
| 3 | Cancellation rate (7d) | Big-number + delta% | vs prior 7d | /bookings?status=cancelled&period=7d |
| 4 | Avg response time | Big-number (ms) | vs prior 7d, color-coded threshold | /metrics/response-time |

## Secondary Tiles

| Tile | Metric | Viz | Refresh |
|------|--------|-----|---------|
| Bookings by hour | volume distribution | bar | hourly |
| Top 10 venues | bookings count | horizontal-bar | hourly |
| Cancellation reasons | breakdown | donut (≤6 slices, else bar) | hourly |
| Conversion funnel | view→cart→book | funnel | hourly |
| Revenue (this month) | $ amount + sparkline | big-number | daily |
| Active users (DAU/WAU/MAU) | counts | line, 30d | daily |

## Drill-Down Only (not on dashboard)

- Per-venue detail
- Per-user activity log
- Cohort retention table

Reachable from secondary tile click → dedicated detail page.

## Grid

- Desktop ≥1280px: 12-col grid; headline tiles span 3 cols each (4 across); secondary span 4 or 6.
- Tablet 768-1279px: 8-col; headline 2-across, secondary 1-2 across.
- Mobile <768px: tab-per-section ("Today" / "This Week" / "Trends"); single-column tiles within tab.

## Period Control

- Global date-range picker top-right: Today / Yesterday / 7d / 30d / 90d / Custom.
- Default: 7d.
- Per-tile period override only on tiles where it adds value (e.g., MTD revenue card always shows month-to-date regardless of global period).

## Comparison Rules

- Headline tiles always show comparison: prior equivalent period.
- Delta format: `+12% ↑` (green) / `-8% ↓` (red) / `0%` (neutral grey).
- Color does NOT carry meaning alone (also uses arrow + sign per a11y).
- Threshold tiles (e.g., response time): color crosses threshold (green<200ms, amber<500ms, red≥500ms) — threshold visible in tooltip.

## Refresh Strategy

| Tile | Refresh | Visible timestamp |
|------|---------|-------------------|
| Active bookings | poll 60s | "Updated 12s ago" |
| Completed today | hourly cache | "Updated at 14:00" |
| Cancellation rate (7d) | hourly cache | "Updated at 14:00" |
| Revenue (month) | daily | "Updated 03:00 UTC" |

Manual refresh button top-right re-fetches all tiles. Per-tile refresh icon for slow ones.

## Per-Tile State

| State | UI |
|-------|----|
| Loading | skeleton matching tile shape; no spinner overlap |
| Empty | "No data for this period" + small icon |
| Error | "Couldn't load — Retry" inline button; tile keeps its label |
| Stale | timestamp turns amber; tooltip "Last updated >1h ago" |

## Density Modes

- Compact: tiles 80% height, 1 line title, no sparkline on secondary.
- Comfortable (default): full size with sparklines.
- User preference saved per dashboard in localStorage + server.

## Drill-Down

- Click tile → dedicated detail route OR in-place expand (decide per tile).
- Detail route uses breadcrumb back to dashboard preserving period filter.
- In-place expand: replaces tile with full chart + filter panel; collapse button restores grid.

## A11y

- Each tile: `role="region" aria-labelledby="tile-<id>-title"`.
- Chart has `<table>` data-table fallback (visually-hidden, screen-reader-only) OR linked "View as table" link.
- Color-blind safe palette (not red/green only — also uses shape, label, arrow).
- Keyboard: Tab through tiles in reading order; Enter on tile = drill-down.
- Live regions only for headline KPIs that auto-update; rate-limit announcements (not on every poll).

## i18n

- Number formatting per locale (1,000.00 vs 1.000,00).
- Currency symbol + ISO code on first paint.
- Date in user's timezone with UTC label on hover.

## Out of Scope

- Custom dashboard builder (post-MVP).
- Embedded BI tool (e.g., Metabase iframe) — separate spec.
- Per-user widget pinning — post-MVP.

## Open Questions

- Real-time push (websocket) for headline tiles? Defer; polling 60s is good enough for ops.
- Export dashboard to PDF? Defer — link to per-tile CSV export instead.
```

## Boundaries

- **One dashboard surface per file.** Ops dashboard ≠ exec dashboard ≠ finance dashboard.
- **Headline cap = 5.** More than 5 = nothing is the headline.
- **No chart picking here.** Chart type decisions live in `/chart-type-pick`.
- **No SQL.** Definitions reference upstream metric catalog.
- **No code.** Wiring downstream.

## Re-run Behavior

- Read existing first; surface diff (new/dropped tiles).
- Bump `last-updated`.
- Re-run when adding KPI or audience changes.

## Auto-chain

- Per chart → `/chart-type-pick`.
- Per tile state → `/state-pattern-catalog`.
- Per drill-down events → `/analytics-spec`.
- Filter / period picker pattern → `/form-design` if complex.
- After the layout-personality pick + grid are set → `/anti-generic-design-check` (audits the dashboard against tells T4 KPI-grid headline, T5 rigid 12-col grid, T13 no layout personality).

## Example Trigger

User: "design the operations dashboard with headline KPIs and drill-down"
→ Rank KPIs, pick grid, define tiles + comparison + refresh + drill, write `docs/design/dashboard-ops.md`.
