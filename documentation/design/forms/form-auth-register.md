---
form: auth-register
last-updated: 2026-05-20
status: draft
wireframe: docs/design/wireframes/auth-register.md
endpoint: POST /api/auth/otp/send → /api/auth/otp/verify → /api/auth/register
---

# Form: Auth — Register (3-step OTP wizard)

Multi-step. Step state in URL `?step=phone|code|profile`. Verified-phone state
crosses steps via `otpProof` JWT (5min TTL), NOT form re-entry of phone.

## Steps

| Step | URL | Endpoint | Carries forward |
|------|-----|----------|-----------------|
| 1 phone | `?step=phone` | POST /api/auth/otp/send | phone (display only) |
| 2 code | `?step=code` | POST /api/auth/otp/verify | otpProof (purpose=register) |
| 3 profile | `?step=profile` | POST /api/auth/register | otpProof + name + password |

## Fields

| Step | Name | Type | Required | Default | Notes |
|------|------|------|----------|---------|-------|
| 1 | phone | tel | yes | — | VN mobile |
| 2 | code | text inputmode=numeric | yes | — | 6 digits |
| 3 | displayName | text | no | — | 2–100 chars if present |
| 3 | password | password | yes | — | strength rules below |

## Validation Matrix

| Field | Rule | Timing | Error copy |
|-------|------|--------|------------|
| phone | `/^(0|\+84)[35789][0-9]{8}$/` | on-blur | "Số điện thoại không hợp lệ" |
| code | `length(6)` | on-submit | "OTP code must be exactly 6 digits" |
| code | `/^[0-9]{6}$/` | on-submit | "OTP code must be numeric" |
| displayName | `min(2)` (when non-empty) | on-blur | "Tên hiển thị phải có ít nhất 2 ký tự" |
| displayName | `max(100)` | on-blur | "Tên hiển thị không được vượt quá 100 ký tự" |
| password | `min(8)` | on-change (live meter) | "Password must be at least 8 characters" |
| password | `max(128)` | on-change | "Password must be at most 128 characters" |
| password | `/[a-zA-Z]/` | on-blur | "Password must contain at least one letter" |
| password | `/[0-9]/` | on-blur | "Password must contain at least one digit" |

Server (verify outcomes, banner): expired→400 "Mã OTP đã hết hạn. Gửi lại mã.";
invalid→400 "Mã OTP không đúng."; attempt_cap→429 "Quá nhiều lần thử. Vui lòng
thử lại sau."; lockout-sentinel (3 mismatch / 15min) → same 429 banner.

## Error Placement

- Inline below each field (format).
- Banner on OTP server outcomes (step 2) — `role="alert"`, above resend control.
- No toast.

## Submit States (per step)

```
step ──submit──▶ submitting ──ok──▶ advance step (push ?step=)
                     │
                     └──err──▶ error (re-enable, announce, focus first error)
final(register) ──ok──▶ store token, redirect /account
```

| Step | Button label | submitting label |
|------|--------------|------------------|
| 1 | "Gửi mã" | "Đang gửi..." |
| 2 | "Xác nhận" | "Đang kiểm tra..." |
| 3 | "Tạo tài khoản" | "Đang tạo..." |

Resend (step 2): "Gửi lại mã" — disabled during 60s cooldown, label
"Gửi lại sau {n}s". Max 3 resends / 15min (server-enforced).

## A11y Wiring

| Field | Pattern |
|-------|---------|
| each input | `<label for>` + `aria-describedby="X-hint X-err"` + `aria-required` + `aria-invalid` |
| code | `inputmode="numeric"` `autocomplete="one-time-code"` |
| password meter | `aria-live="polite"` strength text, NOT only color |
| progress | `<ol>` step indicator, `aria-current="step"` on current |
| step advance | focus moves to first field of new step |
| banner | `role="alert" aria-live="assertive"` |

## Open Questions

- Back from step 3 → step 2: otpProof may have expired (5min). On expiry, bounce
  to step 1 with banner "Phiên xác thực đã hết hạn. Vui lòng thử lại." (verify copy).
- displayName optional confirmed (registerInput `.optional()`).

## Out of Scope

- Login (separate file).
- Social/OAuth signup.
