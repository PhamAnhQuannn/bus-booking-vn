---
name: chart-type-pick
description: Chart type decision tree. Line / bar / area / pie / scatter / heatmap / funnel / sparkline / big-number. Picks per data shape + question. Includes a11y for charts (data-table fallback, color-blind palette, aria-label). Outputs `docs/design/chart-types.md` with picker matrix + per-chart spec + anti-patterns. Use when user says "chart type", "which chart", "data viz", "graph picker", "visualization", "/chart-type-pick", or before adding any chart to a screen.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# Chart Type Pick

## Why you'd care

A pie chart hiding a trend or a line chart connecting categorical points isn't just ugly — it actively lies to the user making the decision. Picking the chart type from the question (not the data shape) is what makes the dashboard load-bearing instead of decorative.

The chart should answer the user's question, not show off the data. Pie charts hide trends; bars hide proportion; line on categorical data lies. This skill maps "what is the user asking?" → "which chart" → "how to make it accessible".

## When This Skill Applies

Activate when:
- User says "chart", "which chart type", "data viz", "graph", "visualization", "/chart-type-pick"
- New dashboard tile needs a chart
- Existing chart misreads (user complains "I can't tell what's growing")
- Adding a comparison or trend view

## Prerequisites

- Data shape (categorical / continuous / time-series / part-to-whole / correlation / distribution).
- The question the user asks of this data.
- Tile size + density mode.
- Color palette from design-system + color-blind safe variant.

## Steps

1. **State the question.** "Is X growing?" / "How does X compare to Y?" / "What's the breakdown of X?" — one sentence.
2. **Classify data.** Time-series / categorical / part-to-whole / correlation / distribution / single value / geographic.
3. **Pick chart type** via the picker matrix below.
4. **Reject if better alternative.** Pie → bar if >5 slices. Line → bar if categorical. 3D → flat always.
5. **Spec axes + scale.** Linear vs log, zero-baseline (yes for bars; optional for line), units, formatting.
6. **Spec interaction.** Hover tooltip, click for drill, brush/zoom for time-series.
7. **A11y.** Data-table fallback, aria-label summary, color-blind safe (also use shape/pattern/label).
8. **Spec empty / loading / error.**
9. **Write** `docs/design/chart-types.md`.
10. **Auto-chain.** Per-chart in dashboard → `/dashboard-layout`. Each chart's tile state → `/state-pattern-catalog`.

## Output Format — `docs/design/chart-types.md`

```markdown
---
last-updated: YYYY-MM-DD
status: draft | reviewed | implemented
charting-lib: recharts (web) / Victory Native (mobile)
---

# Chart Types

## Picker Matrix

| Question | Data shape | Chart |
|----------|-----------|-------|
| Single number "right now" | scalar | Big-number |
| Single number with recent trend | scalar + tiny series | Big-number + sparkline |
| "Is X growing over time?" | time-series, 1-3 series | Line |
| "How does X compare across categories?" | categorical, 1 metric | Bar (vertical if labels short, horizontal if long) |
| "Is X growing per category over time?" | time-series × category | Multi-line (max 4-5 series) OR small-multiples |
| "What's the breakdown / share?" | part-to-whole, 2-5 parts | Donut (one) OR stacked bar (compare) |
| "What's the breakdown?" | part-to-whole, >5 parts | Horizontal bar (sorted desc) — NOT pie |
| "Cumulative over time" | time-series cumulative | Area chart |
| "Stacked composition over time" | time-series stacked | Stacked area (≤5 series) |
| "Where do drop-offs happen?" | sequential funnel | Funnel chart |
| "Distribution / spread?" | one variable | Histogram |
| "Distribution comparison?" | one variable × group | Box plot OR violin |
| "Correlation between two variables?" | two continuous | Scatter |
| "Density / heat across two dims?" | matrix | Heatmap |
| "Geographic distribution?" | location data | Choropleth (region color) OR pin map |
| "Hierarchy / nested parts?" | tree | Treemap (use sparingly) |

## Per-Chart Spec

### Line chart
- Use: 1-5 series, time-series, looking for trend.
- X axis: time, evenly spaced, formatted to relevant granularity (hour / day / month).
- Y axis: linear default; log only when range spans >2 orders of magnitude (label "log scale").
- Zero baseline: optional — small ranges allowed to truncate iff axis range labelled.
- Series limit: ≤5; more = small-multiples.
- Data points marked at hover; line stays continuous.

### Bar chart
- Use: categorical comparison.
- Vertical (column) when ≤8 categories AND labels short.
- Horizontal when >8 categories OR long labels.
- Sort by value desc unless category has natural order (months, severity).
- Zero baseline mandatory (truncating misleads).
- Group OR stack for second dim; never both.

### Donut / Pie
- Use: 2-5 parts, sums to 100%.
- Reject: >5 slices → bar. Multiple comparisons → stacked bar.
- Donut over pie: center can hold total label.
- Always show % labels (don't make user estimate slice angle).

### Stacked bar / area
- Use: composition over time or category.
- ≤5 stacks max; rest aggregated to "Other".
- Stacked area only when total trend matters AND stacks <5.

### Sparkline
- Use: tiny inline trend next to a number.
- No axes, no labels. Just shape.
- Same color as parent number; thinner stroke.
- Hover reveals min/max/last.

### Big-number
- Use: single critical KPI.
- Number large (≥3rem); label small below; comparison delta inline (+12% ↑).
- Format per locale; abbreviate (1.2M not 1,200,000).

### Funnel
- Use: sequential step drop-off.
- Each step labeled with absolute count + % of prior step + % of top.

### Scatter
- Use: correlation, ≤500 points (else density / heatmap).
- Axes labelled with units.
- Trend line optional; if shown, label with R²; never extrapolate.

### Heatmap
- Use: 2D distribution / density / matrix.
- Sequential color scale (single hue, light→dark) for magnitude; diverging (red↔blue) for centered scale.
- Always include a color legend with values.

### Geographic
- Choropleth: color-code regions; legend with bins.
- Pin map: use clusters at zoom-out; individual pins at zoom-in.

## Anti-Patterns (don't do)

- 3D bar / pie chart (distorts perception).
- Pie with >5 slices.
- Line on categorical x-axis (implies false continuity).
- Truncated y-axis on bar chart (misleads magnitude).
- Two y-axes ("dual-axis") — separate small-multiples instead.
- Rainbow-only palette for sequential data (use single-hue gradient).
- Red-green only for diverging (color-blind unsafe — also use shape/label).
- Donut with no % labels ("guess the slice").
- Animation on data change that obscures comparison.

## Chart Visual Identity

Picking the correct chart TYPE is only half the job. Specify the chart's visual personality so it matches the product's design language instead of looking like default library output:

| Aspect | Decide |
|--------|--------|
| Grid treatment | none / horizontal-only / faint full grid — most product types do NOT want the library-default full grid |
| Axis styling | tick density, label rotation, baseline weight, whether axes are drawn at all (sparkline = none) |
| Color application | solid vs gradient fill, single accent vs full qualitative ramp, opacity on area fills — from the corpus, not the library default |
| Label density | direct labels on series vs legend-only; value labels on bars vs axis-only; round vs precise |
| Line / bar weight | stroke width, bar gap ratio, corner radius on bars — tie to the design-system radius + the picked design direction |

- Source the above from `/design-trend-compare` (the auto-picked per-product-type direction) + `docs/design/design-system.md`.
- A chart left at recharts/Victory defaults trips tell T8 (no/generic motion) and reads as "unstyled library output".

## Color

- Default qualitative palette: 6-8 perceptually-distinct hues from design-system.
- Sequential (magnitude): single-hue light→dark.
- Diverging (centered): two hues with neutral middle.
- All palettes verified color-blind safe (sim with deuteranopia/protanopia).
- Color is never the only encoding — also label, shape, or position.

## A11y

- Each chart has accessible name + summary via `aria-label` ("Line chart, weekly revenue, 30 days, trending up 12%").
- Data table fallback: visually-hidden `<table>` OR linked "View data as table" toggle.
- Tooltips also announced on focus (keyboard nav across data points).
- Patterns / textures available as alternative to color (e.g., for stacked bars in print).
- Reduced motion: no animation on data load; instant render.
- Focusable data points (Tab through, Enter to drill).

## Tile States

| State | Chart UI |
|-------|---------|
| Loading | skeleton matching chart shape (no spinner over chart) |
| Empty | "No data for this period" centered icon + text; axes still drawn |
| Error | "Couldn't load chart — Retry"; chart area greyed |
| Stale | small "Updated 2h ago" caption; data still shown |

## i18n

- Number + date formatting per locale.
- Currency: symbol + ISO on first paint.
- RTL: flip horizontal-bar direction; mirror axis labels.

## Per-Chart Library Mapping

| Chart | recharts (web) | Victory Native (RN) |
|-------|---------------|---------------------|
| Line | `<LineChart>` | `<VictoryLine>` |
| Bar | `<BarChart>` | `<VictoryBar>` |
| Area | `<AreaChart>` | `<VictoryArea>` |
| Donut | `<PieChart>` w/ inner radius | `<VictoryPie>` w/ innerRadius |
| Sparkline | `<LineChart>` minimal | `<VictoryLine>` minimal |
| Heatmap | custom (no recharts) — use Visx | custom |
| Funnel | custom (no recharts) — use d3 | custom |

## Out of Scope

- Custom data viz (interactive 3D, network graphs) — needs separate spec.
- Real-time streaming charts — separate spec; needs throttle policy.

## Open Questions

- Should heatmap use Visx (more flexible) or roll our own with SVG? Defer until first heatmap need.
- Per-chart export (CSV, PNG)? Default: link to underlying data export only.
```

## Boundaries

- **Chart serves the question.** If it doesn't make the answer obvious, switch chart.
- **No 3D, no dual-axis, no rainbow-on-sequential.**
- **Color never the only encoding.**
- **Data-table fallback is mandatory** for non-trivial charts.
- **No code beyond library names.**

## Re-run Behavior

- Read existing first; surface diff.
- Bump `last-updated`.
- Re-run when adding new chart kind to the app.

## Auto-chain

- Consumes `/design-trend-compare` — the auto-picked direction supplies the per-product-type chart visual personality (grid treatment, axis styling, color application, label density).
- Per chart in dashboard → `/dashboard-layout`.
- Per chart state → `/state-pattern-catalog`.
- Color palette → `/design-system`.
- Chart a11y → `/a11y-design`.

## Example Trigger

User: "what chart should I use for cancellation rate over time vs target?"
→ Classify (time-series + target line), pick (line with reference line), spec axes + a11y, write `docs/design/chart-types.md`.
