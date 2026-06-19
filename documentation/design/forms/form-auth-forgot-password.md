---
form: auth-forgot-password
last-updated: 2026-05-20
status: draft
wireframe: docs/design/wireframes/auth-forgot-password.md
endpoint: POST /api/auth/forgot-password → /api/auth/forgot-password/verify
---

# Form: Auth — Forgot Password (phone → OTP)

2-step. Non-enumerating: send always returns generic success regardless of phone
existence. Verify mints `otpProof` (purpose=reset_password) carried into reset.

## Steps

| Step | URL | Endpoint | Carries forward |
|------|-----|----------|-----------------|
| 1 phone | `?step=phone` | POST /api/auth/forgot-password | phone (display only) |
| 2 code | `?step=code` | POST /api/auth/forgot-password/verify | otpProof (purpose=reset_password) → reset-password form |

## Fields

| Step | Name | Type | Required | Default | Notes |
|------|------|------|----------|---------|-------|
| 1 | phone | tel | yes | — | VN mobile |
| 2 | code | text inputmode=numeric | yes | — | 6 digits |

## Validation Matrix

| Field | Rule | Timing | Error copy |
|-------|------|--------|------------|
| phone | `/^(0|\+84)[35789][0-9]{8}$/` | on-blur | "Số điện thoại không hợp lệ" |
| code | `length(6)` | on-submit | "OTP code must be exactly 6 digits" |
| code | `/^[0-9]{6}$/` | on-submit | "OTP code must be numeric" |

Send (step 1) ALWAYS 200 (non-enumerating) — advance to step 2 regardless.
Verify outcomes (step 2 banner): expired→400 "Mã OTP đã hết hạn. Gửi lại mã.";
invalid→400 "Mã OTP không đúng."; attempt_cap→429 "Quá nhiều lần thử. Vui lòng
thử lại sau."; lockout-sentinel (3 mismatch / 15min) → same 429 banner.

## Error Placement

- Inline below field (format).
- Banner on verify server outcomes (step 2) — `role="alert"`, above resend.
- No toast.

## Submit States (per step)

```
step ──submit──▶ submitting ──ok──▶ advance step (push ?step=)
                     │
                     └──err──▶ error (re-enable, announce, focus first error)
verify ──ok──▶ store otpProof, redirect /auth/reset-password
```

| Step | Button label | submitting label |
|------|--------------|------------------|
| 1 | "Gửi mã" | "Đang gửi..." |
| 2 | "Xác nhận" | "Đang kiểm tra..." |

Resend (step 2): "Gửi lại mã" — disabled during 60s cooldown, label
"Gửi lại sau {n}s". Max 3 resends / 15min (server-enforced).

## A11y Wiring

| Field | Pattern |
|-------|---------|
| each input | `<label for>` + `aria-describedby="X-hint X-err"` + `aria-required` + `aria-invalid` |
| code | `inputmode="numeric"` `autocomplete="one-time-code"` |
| progress | `<ol>` step indicator, `aria-current="step"` on current |
| step advance | focus moves to first field of new step |
| banner | `role="alert" aria-live="assertive"` |

## Open Questions

- Step-1 generic-success copy on screen: "Nếu số điện thoại tồn tại, chúng tôi đã
  gửi mã xác thực." (non-enumerating — shown regardless of phone existence).

## Out of Scope

- Reset-password (separate file — consumes otpProof).
- Register / login (separate files).
