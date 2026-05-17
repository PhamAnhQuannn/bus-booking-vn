---
name: data-table-design
description: Data table UX — columns, sort, filter, pagination, sticky headers, row selection, bulk actions, density toggle, empty/loading states, mobile collapse. Outputs `docs/design/table-<surface>.md` with column spec + interaction matrix + a11y wiring. Use when user says "data table", "table design", "grid", "list view", "sort filter", "bulk actions", "infinite scroll vs pagination", "/data-table-design", or before building a table with ≥3 columns or any interaction.
output_size:
  XS: skip
  S: 1h
  M: 2h
  L: 4h
  XL: 6h
---

# Data Table Design

## Why you'd care

The data table ships without an empty state, without keyboard nav, and silently truncates on mobile — and the support queue fills with "I sorted by date but nothing changed" tickets because the sort-direction caret was never specced. Specifying every column behavior plus all six tile states (loading / empty / error / partial / full / overflow) before any code lands is the difference between a table users trust and a table the eng team rebuilds twice in the first year.

Tables fail in predictable ways: no empty state, broken on mobile, no keyboard nav, sort with hidden direction. This skill specs every column + every interaction before code touches the page.

## When This Skill Applies

Activate when:
- User says "data table", "table design", "grid", "list view", "sort", "filter", "pagination", "bulk actions", "infinite scroll", "/data-table-design"
- Table with ≥3 columns OR any sort/filter/select/bulk interaction
- Existing table failing: laggy, can't find rows, mobile broken
- Admin / dashboard / inventory surface

## Prerequisites

- Data source contract (column types + cardinality known).
- Wireframe placement (`docs/design/wireframes/<screen>.md`).
- Decision: pagination vs infinite scroll vs load-more (preference signal).
- Permissions: who can see column X, who can perform bulk action Y.

## Steps

1. **Column inventory.** Name, key, type, sortable?, filterable?, default visible?, alignment, width policy.
2. **Default sort + secondary sort.** What user sees on first load.
3. **Filter design.** Per-column inline vs faceted sidebar vs search bar. Keep ≤4 active filters visible.
4. **Pagination model.** Page-numbered (admin), load-more (feed), infinite scroll (browse), cursor (large dataset). One per table.
5. **Row selection.** Checkbox column? Bulk action bar appears on selection.
6. **Bulk actions.** List actions, confirm destructive.
7. **Density toggle.** Compact / normal / comfortable. Remember per-user.
8. **Empty / loading / error states.** Per `state-pattern-catalog`.
9. **Sticky headers + first column** for wide tables.
10. **Mobile collapse strategy.** Cards (default), horizontal scroll (admin), priority columns + expand.
11. **Row actions.** Inline icon buttons, kebab menu, click-row-to-detail.
12. **A11y wiring.** `<table>` semantics, scope, sort indicators with `aria-sort`, selection announcements.
13. **Write** `docs/design/table-<surface>.md`.
14. **Auto-chain.** Bulk delete → `/threat-model`. Filters touching backend → `/api-contract`.

## Output Format — `docs/design/table-<surface>.md`

```markdown
---
surface: bookings-admin
last-updated: YYYY-MM-DD
status: draft | reviewed | implemented
data: GET /api/admin/bookings
---

# Table: Bookings Admin

## Columns

| Key | Label | Type | Sort | Filter | Visible by default | Align | Width |
|-----|-------|------|------|--------|---------------------|-------|-------|
| id | ID | string | yes | exact | no | left | 100px fixed |
| customer | Customer | string | yes | search | yes | left | flex |
| trip | Trip | string | no | facet | yes | left | flex |
| seats | Seats | string[] | no | none | yes | left | 120px |
| total | Total | money | yes | range | yes | right | 120px |
| status | Status | enum | yes | facet | yes | left | 120px |
| createdAt | Created | datetime | yes (default desc) | range | yes | right | 160px |
| actions | — | — | no | — | yes | right | 80px |

## Sort

- Default: `createdAt desc`.
- Header click: cycle asc → desc → unset (back to default).
- Indicator: arrow icon next to label; `aria-sort="ascending|descending|none"`.
- Multi-sort: hold Shift on header click; indicator shows priority badge "1", "2".

## Filter

- Top filter bar: search (matches customer name + booking id) + facet pills (status, trip date range).
- Active filter pills show with × to remove.
- "Clear all" button visible when ≥1 filter active.
- Filter state mirrors URL query (`?status=paid&from=2026-05-01`).

## Pagination

- Cursor-based (`?cursor=…&limit=50`).
- Footer: "Showing 50 of 1,234" + "Load more" button (admin context — predictable).
- Not infinite scroll (admin needs to know total + come back to position).

## Selection + Bulk Actions

- Leading checkbox column.
- Header checkbox: select page (not all). "Select all 1,234 across pages?" banner appears if header checked.
- Selection persists across pagination (cursor list of ids).
- Bulk action bar slides in from top when ≥1 selected:
  - Export CSV (instant, no confirm)
  - Cancel bookings (destructive, confirm modal: "Cancel 12 bookings? This refunds payment to customer.")
  - Send email (opens compose modal)
- Selection cleared on filter change (warn first).

## Density

- Compact (32px row), Normal (44px row, default), Comfortable (56px row).
- Toggle in table toolbar; saved to user pref.

## States

| State | Trigger | UI |
|-------|---------|-----|
| empty | data.length=0 + no filters | empty state: "No bookings yet" + illustration |
| empty-filtered | data.length=0 + ≥1 filter | "No bookings match these filters" + "Clear filters" button |
| loading-initial | fetching + data null | skeleton rows × 8 |
| loading-more | fetching after load-more | spinner in footer |
| error | fetch failed | error row spanning columns + "Retry" |
| stale | data fetched ≥30s ago | small "Refresh" link in toolbar |

## Sticky

- Header row sticky on vertical scroll.
- ID + Customer columns sticky on horizontal scroll (desktop only).

## Mobile (<768px)

- Strategy: card view per row.
- Card layout: top line = Customer + Status badge; second = Trip + Seats; third = Total + Created (small).
- Tap card → detail page.
- Actions: kebab menu in card top-right.
- Filter: drawer triggered by "Filter" button (count badge).
- Sort: dropdown (single sort only on mobile).

## Row Actions

| Action | Trigger | Destructive? |
|--------|---------|--------------|
| View | click row OR "View" in kebab | no |
| Edit | "Edit" in kebab | no |
| Cancel | "Cancel" in kebab | yes — confirm modal |
| Refund | "Refund" in kebab (only if paid) | yes — confirm modal |

## A11y

- `<table>`, `<thead>`, `<tbody>`, `<th scope="col">`.
- Sort header: `<button>` inside `<th>` with `aria-sort`.
- Selection: `<input type="checkbox" aria-label="Select booking 12345">`.
- Bulk action bar: `aria-live="polite"` announces "12 selected".
- Row link wrap (mobile cards): `<a>` around card surface; nested kebab uses `event.stopPropagation`.
- Keyboard: Tab through interactive (sort headers, checkboxes, kebab menus). Arrow keys NOT used (table is not a grid widget).

## Performance

- Virtualize at >500 visible rows (TanStack Virtual or shadcn data-table).
- Skeleton during initial fetch.
- Avoid re-rendering full table on selection state change (memoize row).

## Out of Scope

- Inline edit (separate flow).
- Drag-to-reorder columns (post-MVP).
- Saved filter presets (post-MVP).

## Open Questions

- Persist column visibility per-user? Yes; store in user prefs.
- Export limit? Cap at 10,000 rows; over → background job + email link.
```

## Boundaries

- **One table per file.** Different surfaces (admin vs user) get separate files even if data overlaps.
- **No grid widgets.** Tables are reading surfaces; arrow-key cell nav is editor territory.
- **Mobile is mandatory.** A table with no mobile strategy is incomplete.
- **Bulk destructive needs confirm.** No exceptions.
- **No code.** Component impl downstream (TanStack / shadcn / custom).

## Re-run Behavior

- Read existing first; surface diff.
- Bump `last-updated`.
- Status: draft → reviewed → implemented.

## Auto-chain

- Bulk destructive → `/threat-model` (auth, audit log).
- Filter / sort going to backend → `/api-contract`.
- Empty / loading / error states → `/state-pattern-catalog` cross-ref.
- New action button → `/design-system` to confirm Button variant.

## Example Trigger

User: "design the bookings admin table"
→ Inventory columns, define sort/filter/pagination, bulk actions, mobile strategy, write `docs/design/table-bookings-admin.md`.
