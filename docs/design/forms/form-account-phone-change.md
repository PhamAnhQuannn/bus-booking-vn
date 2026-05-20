---
form: account-phone-change
last-updated: 2026-05-20
status: draft
wireframe: docs/design/wireframes/account-settings.md
endpoint: POST /api/account/phone/init → /api/account/phone/confirm
---

# Form: Account — Phone Change (OTP init → confirm)

Inline 2-step section on `/account/settings`. Bearer auth. OTP sent to the NEW
phone; confirm swaps `Customer.phone`. P2002 collision → generic PHONE_TAKEN.

## Steps

| Step | Endpoint | Carries forward |
|------|----------|-----------------|
| 1 init | POST /api/account/phone/init | newPhone (display only) |
| 2 confirm | POST /api/account/phone/confirm | newPhone + code |

## Fields

| Step | Name | Type | Required | Default | Notes |
|------|------|------|----------|---------|-------|
| 1 | newPhone | tel | yes | — | VN mobile |
| 2 | code | text inputmode=numeric | yes | — | 6 digits |

## Validation Matrix

| Field | Rule | Timing | Error copy |
|-------|------|--------|------------|
| newPhone | `/^(0|\+84)[35789][0-9]{8}$/` | on-blur | "Số điện thoại không hợp lệ" |
| code | `length(6)` | on-submit | "OTP code must be exactly 6 digits" |
| code | `/^[0-9]{6}$/` | on-submit | "OTP code must be numeric" |

init (step 1) ALWAYS 200; 429 LOCKED_OUT / RATE_LIMITED → "Quá nhiều yêu cầu.
Vui lòng thử lại sau." confirm (step 2): 400 OTP_EXPIRED → "Mã OTP đã hết hạn.
Gửi lại mã."; 400 OTP_INVALID → "Mã OTP không đúng."; 429 OTP_LOCKED_OUT → "Quá
nhiều lần thử. Vui lòng thử lại sau."; 422 PHONE_TAKEN → "Số điện thoại này đã
được sử dụng." (generic, non-enumerating).

## Error Placement

- Inline below field (format).
- Banner (`role="alert"`) on init/confirm server outcomes, above resend.
- PHONE_TAKEN renders inline under newPhone on return to step 1 (or as banner if
  surfaced at confirm) — generic copy, never reveals which account holds it.
- Success: inline "Đã đổi số điện thoại" + display updated phone.
- No toast.

## Submit States (per step)

```
step ──submit──▶ submitting ──ok──▶ advance / success
                     │
                     └──err──▶ error (re-enable, announce, focus first error)
confirm ──ok(200 {phone})──▶ success (update display, collapse section)
```

| Step | Button label | submitting label |
|------|--------------|------------------|
| 1 | "Gửi mã" | "Đang gửi..." |
| 2 | "Xác nhận" | "Đang kiểm tra..." |

Resend (step 2): "Gửi lại mã" — 60s cooldown "Gửi lại sau {n}s".

## A11y Wiring

| Field | Pattern |
|-------|---------|
| each input | `<label for>` + `aria-describedby="X-hint X-err"` + `aria-required` + `aria-invalid` |
| code | `inputmode="numeric"` `autocomplete="one-time-code"` |
| progress | step indicator, `aria-current="step"` |
| banner | `role="alert" aria-live="assertive"` |
| success | `<span aria-live="polite">Đã đổi số điện thoại</span>` |

## Open Questions

- Re-auth (password) before phone-change init? Currently OTP-only.

## Out of Scope

- Register-time phone entry (separate file).
- Name / password / delete (separate files; same settings screen).
