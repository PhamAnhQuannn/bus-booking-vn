---
screen: customer-home
route: /
last-updated: 2026-05-20
status: draft
---

# Wireframe: Home (Search entry)

## Purpose
Landing page for guest users to start a trip search. Renders a single search form (origin, destination, date, ticket count) seeded from the persisted searchStore.

## Entry Points
- From: direct visit / brand link.
- Redirects to: `/search?origin=…&destination=…&date=…&ticketCount=…` on submit (client `router.push`).

## Device Targets
- Mobile (375–767px) — primary
- Desktop (≥768px)

## Layout — Mobile (≤767px)
```
+--------------------------------------+
| Đặt vé xe khách            (h1)      | ← page title (text-2xl font-bold)
| Tìm chuyến xe phù hợp ...   (sub)    | ← text-sm text-muted-foreground
|                                      |
| Điểm xuất phát            (label)    | ← <label>
| [ Ví dụ: Hà Nội               ]      | ← Input (min-h-11)
|                                      |
| Điểm đến                  (label)    |
| [ Ví dụ: TP.HCM               ]      | ← Input
|                                      |
| Ngày đi                   (label)    |
| [ yyyy-mm-dd            (date)]      | ← Input type=date
|                                      |
| Số vé                     (label)    |
| [ 1                  (number)  ]      | ← Input type=number (1–10)
|                                      |
| [      Tìm chuyến xe          ]      | ← Button (w-full, disabled until filled)
+--------------------------------------+
   container max-w-md, centered
```

## Layout — Desktop (≥768px)
```
+----------------------------------------------------------+
|                                                          |
|           +--------------------------------+             |
|           | Đặt vé xe khách        (h1)    |             | ← max-w-md
|           | Tìm chuyến xe phù hợp ...      |             |   stays centered
|           |                                |             |   (no wide layout)
|           | Điểm xuất phát   [__________]  |             |
|           | Điểm đến         [__________]  |             |
|           | Ngày đi          [__date____]  |             |
|           | Số vé            [__number__]  |             |
|           | [      Tìm chuyến xe        ]  |             |
|           +--------------------------------+             |
+----------------------------------------------------------+
```

## Components
| Component | Source | New? |
|-----------|--------|------|
| Input (text/date/number) | `components/ui/input.tsx` | No |
| Button (default) | `components/ui/button.tsx` | No |
| SearchFormWrapper → SearchForm | `components/search/SearchFormWrapper.tsx`, `SearchForm.tsx` | No |
| Field label | inline `<label>` | Yes — Label primitive MISSING |

## States
| State | Trigger | UI |
|-------|---------|----|
| loading | n/a (static RSC + client form) | no skeleton; form renders immediately |
| empty | first visit, no stored query | empty inputs (placeholders only) |
| prefilled | searchStore has prior query | inputs hydrated from Zustand/localStorage |
| disabled-action | origin/destination/date blank | "Tìm chuyến xe" Button disabled |
| error | client form has no inline validation here | none on submit (validation deferred to `/search` Zod) |
| success | valid submit | `router.push('/search?…')` navigates away |

## Interactions
- Tab order: origin → destination → date → ticket count → submit.
- Each Input ≥44px tap target (`min-h-11`).
- Submit Button disabled until origin+destination+date present (trimmed).
- Enter in any field submits the form.
- No sticky CTA — short form fits viewport.

## Data Needs
| What | When | Source | Optimistic? |
|------|------|--------|-------------|
| origin/destination/date/ticketCount | render | searchStore (Zustand + localStorage) | n/a |
| — | submit | navigates to `/search`; no fetch here | n/a |

## Open Questions
- Promote inline `<label>` to a Label primitive (design-system flags it MISSING).
- City inputs are free-text (no autocomplete/typeahead) — acceptable for Phase A?

## Out of Scope
- Trip results (rendered on `/search`).
- Auth/login entry (guest booking).
- Recent-search history UI beyond store hydration.
