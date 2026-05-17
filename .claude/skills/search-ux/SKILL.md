---
name: search-ux
description: Search UX. Input affordance, autocomplete, facets, zero-results, sort, recent/saved, debounce, keyboard nav, results layout, scoped vs global. Outputs `docs/design/search.md` with surface map + interaction spec + a11y. Use when user says "search", "autocomplete", "typeahead", "facets", "filter", "search results", "zero results", "/search-ux", or before adding any search input.
output_size:
  XS: skip
  S: 1h
  M: 2h
  L: 4h
  XL: 6h
---

# Search UX

Search lives or dies on three things: speed of feedback, quality of zero-results, and keyboard ergonomics. This skill sets the input pattern, debounce, suggestion ranking, facets, empty state, and the no-pageload-on-keystroke contract.

## Why you'd care

A search input without zero-results UX, debounce, and keyboard nav is a feature that signals "this team doesn't care." Search is the most-used surface on most products — designing it deliberately compounds across every session.

## When This Skill Applies

Activate when:
- User says "search", "autocomplete", "typeahead", "facets", "filter", "search results", "zero results", "/search-ux"
- Adding any search input, command palette, or filter UI
- Existing search criticised as "no recent searches", "can't find anything", "too slow", "results irrelevant"
- Adding a new content type that needs to be findable

## Prerequisites

- Searchable entity inventory (what users search for: orders, projects, users, docs).
- Index source decided (DB LIKE, Postgres FTS, Meilisearch, Algolia, Typesense, Elasticsearch).
- Decision: scoped (per-page) vs global (cmd+k palette).
- Keyboard map (`docs/design/keyboard-map.md` if exists).
- Analytics events registry (`docs/design/analytics-events.md`).

## Steps

1. **Pick scope.** Per-surface scoped search vs global cmd+k palette vs both.
2. **Input affordance.** Always-visible input vs icon-toggle vs cmd+k modal.
3. **Suggestion strategy.** Recent searches → saved → autocomplete from index → "Search for: <query>".
4. **Debounce.** 150-300ms typical; 0ms for in-memory; SSR/server: 250ms default.
5. **Result rendering.** List + highlighted match + entity-type badge + meta (date, owner).
6. **Facets / filters.** Per result-type chips OR sidebar filters; URL-synced for shareable searches.
7. **Sort.** Default = relevance; toggle to recency / alphabetical / custom.
8. **Pagination.** Infinite scroll (feed-like) vs page numbers (data-like) vs "load more".
9. **Zero-results.** Suggest fix (typo correction), broaden scope, or convert to "create" action.
10. **Recent / saved.** Personal search history (last 5); explicit save for repeated queries.
11. **Keyboard.** Arrow keys nav results; Enter open; Esc close; cmd+k toggle global; / focus inline.
12. **A11y.** Live region announces N results; combobox role; aria-activedescendant on highlighted item.
13. **Analytics.** `search.submitted`, `search.result_clicked { rank }`, `search.zero_results { query }`.
14. **Write** `docs/design/search.md`.
15. **Auto-chain.** Per state → `/state-pattern-catalog`. Events → `/analytics-spec`. Cmd+k modal → `/cta-hierarchy`.

## Output Format — `docs/design/search.md`

```markdown
---
last-updated: YYYY-MM-DD
status: draft | reviewed | implemented
index: Meilisearch (server-side); fallback to Postgres FTS
scope: global (cmd+k) + scoped (per-page filter input)
---

# Search

## Surface Map

| Surface | Type | Input | Trigger |
|---------|------|-------|---------|
| Global cmd+k palette | global | modal w/ input | `Cmd+K` / `Ctrl+K` from anywhere; click in nav |
| Orders list | scoped | inline input above table | always visible |
| Projects list | scoped | inline input + facets sidebar | always visible |
| Help docs | scoped | input + autocomplete | always visible on /help |
| Settings → users | scoped | input above table | always visible |

## Cmd+K Global Palette

- Trigger: `Cmd+K` (mac), `Ctrl+K` (win/linux), or click search icon in top nav.
- Modal centered, max-width 640px, input auto-focused, listbox below.
- Suggestions before typing: 5 recent searches + 3 saved + "Quick actions" (New booking, Settings).
- After typing 2+ chars: federated results across entity types (orders, projects, users, docs).
- Esc closes; click outside closes; route navigation closes.

## Scoped (per-page) Search

- Inline input above the list/table, full-width.
- Filters as chips or sidebar (responsive: chips on mobile, sidebar on desktop).
- URL-synced: `?q=foo&status=active&date=7d` — share-friendly.
- Result count visible: "12 results for 'foo'".

## Suggestion Strategy

Order in dropdown when input is focused:
1. Recent searches (last 5, persisted per user) — only on focus, before typing.
2. Saved searches (named queries) — same trigger.
3. Autocomplete from index — after 2+ chars typed; debounced.
4. Fallback: "Search for: <query>" — always last item; pressing Enter on it does full search.

After typing:
- Hide recent/saved.
- Show top 8 suggestions, grouped by entity type.
- Each suggestion: highlighted match + entity badge + meta (e.g., "Acme Booking · 2 days ago").

## Debounce

| Source | Debounce |
|--------|---------|
| In-memory list filter | 0ms (immediate) |
| Server autocomplete | 250ms |
| Full-text server search | 300ms |
| Per-keystroke analytics | 1000ms (don't fire per char) |

## Result Rendering

Each result row:
- Title (highlighted match in bold or background).
- Subtitle / meta (date, owner, type badge).
- Optional: small action button on hover ("Open", "Edit") — kebab for more.
- Click row → navigate; Cmd+click → new tab; Enter on focused row → navigate.

## Facets / Filters

- Per result type, surface relevant filter chips: status, date range, owner, tag.
- Multi-select: chips show "Status: Active, Pending"; clear-individual + clear-all.
- Sidebar (desktop): collapsible groups; counts per facet value.
- Mobile: filter chips horizontal scroll OR dedicated filter sheet.
- All filters URL-synced; back button restores prior filter state.

## Sort

- Default: relevance (server-determined).
- User toggle: relevance / newest / oldest / A-Z / custom (per surface).
- Sort persisted in URL.

## Pagination

| Surface | Pattern |
|---------|---------|
| Cmd+k results | Top 8 + "See all results" link → dedicated /search?q=<query> |
| Orders list | page numbers + page-size selector (25/50/100) |
| Projects list | infinite scroll w/ "Load more" button at end |
| Help docs | page numbers (10 per page) |
| Settings → users | page numbers |

Infinite scroll: always include "Load more" button as a11y fallback (don't auto-load on scroll alone).

## Zero-Results

- Headline: "No results for '<query>'".
- Suggestions:
  - Did-you-mean for typos (server-side fuzzy match if available).
  - "Try removing filters: [Clear all]" if facets active.
  - "Search broadened scope" link if scoped search → offer global search.
  - "Create new <entity>" CTA when relevant (e.g., empty bookings search → "Create booking").
- Recent searches still visible below for context.

Track `search.zero_results { query }` for query-improvement loop.

## Recent / Saved

- Recent: auto-stored last 5 distinct queries per user, server-persisted (cross-device).
- Saved: explicit user action ("Save this search") with custom name; appear in dropdown above recent.
- Clear-recent action available in palette settings.
- No tracking of recent for incognito / privacy-mode users (respect signal).

## Keyboard

| Key | Action |
|-----|--------|
| `Cmd+K` / `Ctrl+K` | toggle global palette |
| `/` | focus inline scoped search input |
| `Esc` | close palette OR clear input + blur |
| `↑` / `↓` | move highlight in results listbox |
| `Enter` | activate highlighted result |
| `Cmd+Enter` | open in new tab |
| `Tab` | move focus to filter chips / sort / pagination |

Keyboard shortcuts visible in palette footer (e.g., "↵ to open · Esc to close").

## A11y

- Input: `role="combobox" aria-expanded aria-controls="search-listbox" aria-autocomplete="list"`.
- Listbox: `role="listbox" id="search-listbox"`.
- Each option: `role="option" aria-selected` (only the highlighted one true).
- `aria-activedescendant` on input points to highlighted option's id.
- Live region (`aria-live="polite"`) announces "N results" after debounced settle (not per keystroke).
- Zero-results announced.
- Loading state announced ("Searching…") if response >500ms.
- Esc/close behavior consistent.

## Analytics Events

| Event | When | Props |
|-------|------|-------|
| `search.opened` | palette opened or input focused | surface, source (kbd / click) |
| `search.submitted` | Enter pressed or 1s settle after typing stops | query, surface, scope |
| `search.result_clicked` | result clicked | query, rank, entity_type, surface |
| `search.zero_results` | zero results shown | query, surface, filters |
| `search.filter_applied` | facet toggled | surface, filter, value |
| `search.saved` | search saved | name |

## Performance

| Metric | Budget |
|--------|--------|
| Suggestion P95 latency | ≤200ms |
| Full search P95 latency | ≤500ms |
| First suggestion paint | ≤100ms (skeleton OK) |
| Cancel-on-keystroke | yes (abort prior request) |

## Out of Scope

- Voice search (post-MVP).
- Semantic / vector search (post-MVP unless approved).
- Search-result personalisation beyond recent.

## Open Questions

- Per-tenant index isolation strategy (Meilisearch multi-index vs filter)? Defer to backend spec.
- Promote / pin certain results admin-side? Defer.
- Spell-correction strength (Damerau-Levenshtein distance)? Default ≤2 per word.
```

## Boundaries

- **One search spec per app** unless surfaces diverge dramatically.
- **No page reload on keystroke.** Always XHR/fetch.
- **URL-sync filters.** Shareable + back-button restorable.
- **Debounce server calls.** 250ms default.
- **Zero-results always offers a path forward** (correction, clear-filters, or create).
- **No code beyond library names.**

## Re-run Behavior

- Read existing first; surface diff (new entity types added).
- Bump `last-updated`.
- Re-run when adding new searchable entity OR changing index backend.

## Auto-chain

- Per state → `/state-pattern-catalog`.
- Events → `/analytics-spec`.
- Cmd+k modal patterns → `/cta-hierarchy`.
- Server search → `/api-contract` for endpoint shape.
- Index choice → `/cache-strategy` for query cache.

## Example Trigger

User: "design the global cmd+k search palette"
→ Pick scope, input pattern, suggestion order, debounce, results layout, zero-results, keyboard map, a11y, write `docs/design/search.md`.
