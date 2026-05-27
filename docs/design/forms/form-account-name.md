---
form: account-name
last-updated: 2026-05-20
status: draft
wireframe: docs/design/wireframes/account-settings.md
endpoint: PATCH /api/account/name
---

# Form: Account — Name Edit

Inline section on `/account/settings`. Bearer auth. Single field, single PATCH.

## Fields

| Name | Type | Required | Default | Notes |
|------|------|----------|---------|-------|
| name | text | yes | current name | 4–100 graphemes |

## Validation Matrix

| Field | Rule | Timing | Error copy |
|-------|------|--------|------------|
| name | `min(4)` (graphemes) | on-blur | "Tên hiển thị phải có ít nhất 4 ký tự" |
| name | `max(100)` (graphemes) | on-blur | "Tên hiển thị không được vượt quá 100 ký tự" |

Server: 422 DISPLAY_NAME_TOO_SHORT / DISPLAY_NAME_TOO_LONG map to the same inline
copy above (client mirrors the server bound). Generic failure banner: "Có lỗi
xảy ra. Vui lòng thử lại."

## Error Placement

- Inline below name (format).
- Banner (`role="alert"`) for generic/network server error only.
- Success: inline confirmation "Đã lưu" (aria-live polite), no toast.

## Submit States

```
idle ──submit──▶ submitting ──ok(200)──▶ saved (inline "Đã lưu", section collapses)
                     │
                     └──err──▶ error (re-enable, announce, focus name)
```

| State | Button label | Enabled | Spinner | Announce |
|-------|--------------|---------|---------|----------|
| idle | "Lưu" | yes | no | — |
| submitting | "Đang lưu..." | no | yes | aria-live polite |
| saved | "Lưu" | yes | no | "Đã lưu" aria-live polite |
| error | "Lưu" | yes | no | banner / inline assertive |

## A11y Wiring

| Field | Pattern |
|-------|---------|
| name | `<label for="name">` + `aria-describedby="name-err"` + `aria-required` + `aria-invalid` |
| saved indicator | `<span aria-live="polite">Đã lưu</span>` |
| submit-fail | focus → name |

## Open Questions

- Grapheme counting client-side (`Intl.Segmenter`) to match server bound — confirm
  server uses grapheme not code-unit length (account name PATCH spec: graphemes).

## Out of Scope

- Password / phone / delete (separate files; same settings screen).
