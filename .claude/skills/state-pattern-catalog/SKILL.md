---
name: state-pattern-catalog
description: Catalog of UI state patterns per surface — empty / loading / skeleton / partial / error / success / optimistic / stale / offline. Decides which states each screen + component must implement and how. Outputs `docs/design/state-patterns.md` with state matrix per component + screen-level state map. Reads `/project-classify` to skip XS. Use when user says "state patterns", "loading state", "empty state", "skeleton", "error state", "optimistic UI", "stale data", "offline state", "/state-pattern-catalog", or before `/ui-wireframe` finalize / before component build.
output_size:
  XS: skip
  S: 1h
  M: 2h
  L: 3h
  XL: 4h
---

# /state-pattern-catalog — UI State Patterns

Invoke as `/state-pattern-catalog`. Every screen has more than the happy path. Empty list, slow load, partial fail, network drop, stale cache, optimistic edit reverted — each is a real state real users see. Without a catalog every developer reinvents the loading spinner and the error toast, and half the surfaces ship missing one. Pick patterns once, reuse everywhere.

## Why you'd care

Empty / loading / error / partial / offline states are where 80% of UI bugs live, and they're invisible until a user hits them in production. Cataloging per component is what makes them designed instead of discovered.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS → SKIP.
2. Read `docs/design/design-system.md` for token + component baseline.
3. Read `docs/design/wireframes/` if exists — each screen needs a state row.
4. Read `docs/design/failure-*.md` if exists — runtime failure modes inform error states.

## Inputs
- Surface list: which screens / components in scope.
- Network reality: always-on / flaky / offline-capable.
- Data source: server-rendered / client-fetched / streamed / local-first.
- Cache strategy: per `/cache-strategy` if exists.
- A11y target: WCAG 2.2 AA per `/a11y-design`.

## Process
1. **Enumerate the 9 canonical states**. Each component must answer "what shows here?" for every applicable state:

   | State | When | Visible to user |
   |---|---|---|
   | empty (zero) | data loaded, count = 0 | "No items yet" + CTA to create |
   | empty (filtered) | filter excludes all | "No matches" + clear-filter |
   | loading (initial) | first fetch in flight | skeleton or spinner |
   | loading (refetch) | background refresh | inline indicator, content stays |
   | skeleton | loading > 200ms, layout known | gray placeholders matching real layout |
   | partial | some data loaded, some failed | rendered partial + per-item error |
   | error (recoverable) | fetch fail with retry | inline error + retry button |
   | error (fatal) | unrecoverable | error page + escape hatch |
   | success (transient) | action complete | toast / inline confirm; auto-dismiss |
   | optimistic | mutation in flight, UI ahead | show predicted result + subtle pending |
   | reverted | optimistic mutation failed | snap back + error toast |
   | stale | data older than freshness budget | content + "updated 12m ago" + refresh |
   | offline | no network | cached data + "offline" banner; queue mutations |

2. **Pick triggers per state**:
   - **Loading**: spinner only if expected < 200ms; skeleton if 200ms–2s; progress bar if > 2s; full-page loader only on initial app boot.
   - **Empty**: distinguish zero-data vs filtered-zero — different copy + CTA.
   - **Error**: inline for recoverable (form field), banner for surface-level, full-page only when surface is dead.
   - **Optimistic**: only when mutation is idempotent + reversible + > 100ms server roundtrip. Skip for destructive (delete) — confirm first.
   - **Stale**: define freshness budget per data type (e.g., menu = 5m, order status = 30s, profile = 1h).
   - **Offline**: read-only fallback + queue writes if local-first; else block + show banner.

3. **Per-component spec** (Button, Form, List, Table, Card, Modal, Toast):
   - Which states apply.
   - Which token drives each state (e.g., `bg.skeleton.shimmer` for skeleton).
   - A11y: `aria-busy="true"` during loading, `role="status"` for success toast, `role="alert"` for fatal error, `aria-live="polite"` for stale notice.

4. **Per-screen spec** — the screen-level state map:
   - List which of the 9+ states this screen can enter.
   - Which state combinations are reachable (e.g., partial + offline + stale).
   - Transition matrix: from state X, what triggers state Y.

5. **Skeleton library**:
   - One skeleton variant per layout primitive (list-row, card, table-row, hero, avatar+text).
   - Reuse across screens — never per-screen bespoke.
   - Shimmer animation: `prefers-reduced-motion` falls back to static gray.

6. **Empty-state copy + illustration rules**:
   - Verb-led CTA ("Add your first item" not "No items").
   - Illustration optional, max one per app surface; never on every empty state.
   - Distinguish "never had any" from "all done" (todo cleared) from "filtered to zero".

7. **Error copy rules**:
   - Plain language, no error code in primary copy (code in expandable detail).
   - Explain what user can do next (retry, contact support, go back).
   - Never blame the user for system failures.
   - Map HTTP status → message: 401 = "Session expired, sign in again"; 403 = "Not allowed"; 404 = "Not found"; 5xx = "Something went wrong, retrying…"; network = "You're offline".

8. **Optimistic UI gate**:
   - Save the pre-mutation state for rollback.
   - Show subtle pending mark (50% opacity, spinner badge).
   - On failure: revert + error toast naming the failed action.
   - On success: remove pending mark; toast only if action was destructive.

9. **Stale-data UX**:
   - Per data type, set `staleAfter` (TanStack Query / SWR). At threshold, show "Updated Xm ago · Refresh".
   - Never silently serve stale data without indicator if older than budget.

10. **Offline UX** (if local-first or PWA):
    - Cached reads continue.
    - Mutations queued + retry on reconnect.
    - Banner: "You're offline · 3 changes will sync when you're back".
    - Conflict resolution policy on reconnect (last-write-wins / merge / prompt).

## Output
Write `docs/design/state-patterns.md`:

```markdown
# State patterns — <project>
**Date:** <YYYY-MM-DD>
**Surfaces in scope:** menu, cart, checkout, order-tracking, profile

## State catalog (canonical)
| State | Trigger | Visual | A11y | Token |
|---|---|---|---|---|
| empty (zero) | count=0, never had data | illustration + verb CTA | role="region", labelled | bg.surface, text.muted |
| empty (filtered) | count=0 after filter | text + clear-filter button | role="status" | text.muted |
| loading (initial) | first fetch | skeleton matching layout | aria-busy="true" | bg.skeleton.shimmer |
| loading (refetch) | background refresh | inline spinner top-right | aria-live="polite" | text.muted |
| skeleton | 200ms–2s wait | gray placeholders, shimmer | aria-busy="true" | bg.skeleton + motion.shimmer |
| partial | some items failed | partial render + per-item retry | role="alert" per failed item | text.error inline |
| error (recoverable) | fetch fail, retry possible | inline error + retry button | role="alert" | text.error, bg.error.subtle |
| error (fatal) | unrecoverable | full-page error + back/home | role="alert" | bg.error |
| success (transient) | mutation complete | toast top-right, auto-dismiss 3s | role="status", aria-live="polite" | bg.success.subtle |
| optimistic | mutation in flight | result shown 50% opacity + spinner | aria-busy="true" on item | text.muted |
| reverted | optimistic failed | snap back + error toast | role="alert" | bg.error.subtle |
| stale | data > freshness budget | content + "updated Xm ago · refresh" | aria-live="polite" | text.muted |
| offline | navigator.onLine=false | banner + queued-action count | role="alert" persistent | bg.warning |

## Per-component state matrix

### Button
| State | Pattern |
|---|---|
| default / hover / active / focus / disabled | per design-system Button spec |
| loading | spinner replaces label, button width preserved, aria-busy="true", disabled |
| success (transient) | checkmark icon 1s then revert |

### List / Table
| State | Pattern |
|---|---|
| loading initial | 5-row skeleton |
| loading refetch | inline spinner in header |
| empty zero | full-area empty pattern with CTA |
| empty filtered | row-area "No matches" + clear-filter |
| partial | render returned rows + footer "X items failed · retry" |
| error fatal | full-area error pattern |
| stale | header tag "Updated 12m ago · refresh" |
| offline | full data + banner above table |

### Form
| State | Pattern |
|---|---|
| pristine | default |
| validating (async) | per-field spinner, submit disabled |
| field error | inline below field, aria-describedby |
| submit error | banner above form, role="alert", focus to banner |
| submitting | submit btn loading state, all fields disabled |
| success | toast + redirect or inline confirm |
| optimistic | (rare for forms) — only for autosave |

### Modal
| State | Pattern |
|---|---|
| loading | skeleton in modal body, primary action disabled |
| error | inline in modal, primary action disabled until fixed |
| success | close + toast (don't double-confirm in modal) |

## Per-screen state map

### Screen: /menu (browse)
| State | Reachable | Notes |
|---|---|---|
| loading initial | yes | 8-card skeleton |
| empty zero | yes | "No menu items yet" (admin onboarding only — public users never hit this) |
| empty filtered | yes | "No items match your search · clear filters" |
| partial | yes | category fetched, item images failed → render text + placeholder image |
| error recoverable | yes | "Couldn't load menu · retry" |
| error fatal | no | always recoverable |
| stale | yes | menu cached 5m; show "updated Xm ago · refresh" past 5m |
| offline | yes | last cached menu + offline banner; checkout disabled |

**Transitions:**
- loading → empty / partial / error / success
- success → stale (after 5m) → loading (on refresh) → success
- any → offline (network drop) → any (on reconnect)

### Screen: /cart
[similar block per screen]

## Skeleton library
| Variant | Use | Dimensions |
|---|---|---|
| list-row | search results, settings | h-16, full-width, 70% bar + 40% bar |
| card | grid layouts | h-48, image area + 2 text bars |
| table-row | dashboards | per column width |
| hero | landing | h-64, full-width |
| avatar+text | comments, user lists | 40px circle + 50% bar |

## Empty-state copy
| Surface | Headline | CTA | Illustration |
|---|---|---|---|
| /menu (admin first time) | "Add your first item" | "Create item" | yes (one-time) |
| /cart | "Your cart is empty" | "Browse menu" | no |
| /orders | "No orders yet · order history shows here" | none | no |

## Error copy map
| Error class | Primary copy | Action |
|---|---|---|
| 401 | "Sign in to continue" | redirect to /login |
| 403 | "You don't have access to this" | back |
| 404 | "We couldn't find that" | go home |
| 409 (conflict) | "Someone else just changed this · refresh to see latest" | refresh |
| 422 (validation) | per-field inline | fix and retry |
| 429 (rate limit) | "Too many requests · try again in Xs" | wait |
| 5xx | "Something went wrong on our side · we're retrying" | auto-retry 3x then manual retry |
| network offline | "You're offline" | banner persistent |
| timeout | "This is taking longer than usual" | offer retry at 5s |

## Optimistic UI inventory
| Mutation | Optimistic? | Pre-state saved? | Rollback UX |
|---|---|---|---|
| add to cart | yes | yes | item removed + toast "Couldn't add" |
| remove from cart | yes | yes | item restored + toast |
| update quantity | yes | yes | quantity restored + toast |
| place order | NO | n/a | submit pattern with full loading state |
| cancel order | NO | n/a | confirm modal, then submit pattern |
| favorite item | yes | yes | star toggles back + toast |

## Stale freshness budgets
| Data | staleAfter | refresh trigger |
|---|---|---|
| menu | 5m | manual + on refocus |
| cart | 30s | manual + on action |
| order status | 15s | poll while on screen |
| profile | 1h | manual |
| session | 5m | silent on refocus |

## Offline policy
- Reads: serve from cache.
- Writes: queue in IndexedDB; show count in banner; auto-sync on reconnect.
- Conflict policy: last-write-wins for cart; prompt for orders.

## Verification
- 9 canonical states defined with trigger + visual + a11y + token.
- Each in-scope component has a state matrix.
- Each in-scope screen has reachable-state list + transition notes.
- Skeleton library covers all layout primitives in use.
- Empty-state copy distinguishes zero / filtered / done.
- Error copy maps HTTP class → message.
- Optimistic UI inventory is per-mutation explicit (no implicit decisions).
- Stale freshness budget per data type.
- Offline policy named even if "n/a — always-online app".
```

## Verification
- 9+ canonical states catalogued with trigger + visual + a11y + token mapping.
- Per-component state matrix for at least Button, Form, List/Table, Modal.
- Per-screen state map for every in-scope surface.
- Skeleton library reused across screens (not bespoke per surface).
- Empty / filtered / done are distinct copy patterns.
- Error copy map covers 401/403/404/409/422/429/5xx/network/timeout.
- Optimistic UI is explicit per mutation (yes/no, with rollback plan).
- Stale freshness budget per data type, not global.
- Offline policy declared (even if "always-online — no offline").
