---
form: account-delete
last-updated: 2026-05-20
status: draft
wireframe: docs/design/wireframes/account-settings.md
endpoint: DELETE /api/account
---

# Form: Account — Soft-Delete Confirm

Destructive section on `/account/settings`. Bearer auth. Single-confirm modal.
Soft-delete: phone NULL, deletedAt=now, revoke all sessions; Bookings retained.
Idempotent: 2nd call → 200 `{alreadyDeleted:true}`.

## Fields

| Name | Type | Required | Default | Notes |
|------|------|----------|---------|-------|
| confirmAck | checkbox | yes | unchecked | "Tôi hiểu hành động này không thể hoàn tác" — must be true |

(No text-to-confirm in MVP — single checkbox ack inside a Dialog.)

## Validation Matrix

| Field | Rule | Timing | Error copy |
|-------|------|--------|------------|
| confirmAck | `=== true` | on-submit | "Vui lòng xác nhận để tiếp tục" |

Server: 401 (unauth) → redirect login; generic failure banner → "Có lỗi xảy ra.
Vui lòng thử lại."

## Error Placement

- Inline below checkbox (ack required).
- Banner (`role="alert"`) inside Dialog for server error.
- No toast.

## Submit States

```
idle ──"Xóa tài khoản"──▶ confirm Dialog (ack checkbox + destructive confirm)
Dialog ──confirm──▶ submitting ──ok(200)──▶ success (drop token, redirect home)
                        │
                        └──err──▶ error (re-enable in Dialog, announce banner)
```

| State | Button label | Enabled | Spinner | Announce |
|-------|--------------|---------|---------|----------|
| idle | "Xóa tài khoản" (destructive) | yes | no | — |
| dialog | "Xác nhận xóa" (destructive) | only when ack | no | — |
| submitting | "Đang xóa..." | no | yes | aria-live polite |
| success | — | no | no | drop token → redirect `/` |
| error | "Xác nhận xóa" | yes | no | banner assertive |

`alreadyDeleted:true` (idempotent 2nd call) treated same as success → drop token,
redirect home (no error surfaced).

## A11y Wiring

| Field | Pattern |
|-------|---------|
| trigger | destructive Button opens Dialog (`aria-haspopup="dialog"`) |
| Dialog | focus trap, Esc closes, focus → first focusable; `role="dialog" aria-modal="true" aria-labelledby` |
| confirmAck | `<label for>` + `aria-describedby="ack-err"` + `aria-invalid` |
| confirm button | disabled until ack=true; destructive variant |
| banner | `role="alert" aria-live="assertive"` |

## Open Questions

- Re-auth (password / OTP) before delete? Currently single-confirm checkbox only
  (flow doc open question — defer).

## Out of Scope

- Hard-delete / GDPR data export (out of scope per flow doc).
- Name / password / phone (separate files; same settings screen).
