---
form: auth-reset-password
last-updated: 2026-05-20
status: draft
wireframe: docs/design/wireframes/auth-reset-password.md
endpoint: POST /api/auth/reset-password
---

# Form: Auth — Reset Password

Single screen. Consumes `otpProof` (purpose=reset_password) from forgot-password
verify (held in client state, NOT re-entered). Sets new password, revokes all
sessions, redirects to login. otpProof one-shot via jti; 5min TTL.

## Fields

| Name | Type | Required | Default | Notes |
|------|------|----------|---------|-------|
| password | password | yes | — | strength rules below; live meter |

(otpProof is a hidden carried-state value, not a user-entered field.)

## Validation Matrix

| Field | Rule | Timing | Error copy |
|-------|------|--------|------------|
| password | `min(8)` | on-change (live meter) | "Password must be at least 8 characters" |
| password | `max(128)` | on-change | "Password must be at most 128 characters" |
| password | `/[a-zA-Z]/` | on-blur | "Password must contain at least one letter" |
| password | `/[0-9]/` | on-blur | "Password must contain at least one digit" |

Server (banner): 400 WEAK_PASSWORD → "Mật khẩu chưa đủ mạnh."; 401 INVALID_PROOF
→ "Phiên xác thực đã hết hạn. Vui lòng thử lại." (bounce to forgot-password step1);
422 PASSWORD_REUSED → "Mật khẩu mới phải khác mật khẩu cũ."

## Error Placement

- Inline below password (format + strength meter).
- Banner (`role="alert"`) for server outcomes, above submit.
- INVALID_PROOF banner additionally bounces to `/auth/forgot-password?step=phone`.
- No toast.

## Submit States

```
idle ──submit──▶ submitting ──ok(204)──▶ success (redirect /auth/login)
                     │
                     └──err──▶ error (re-enable, announce banner, focus password)
```

| State | Button label | Enabled | Spinner | Announce |
|-------|--------------|---------|---------|----------|
| idle | "Đặt lại mật khẩu" | yes | no | — |
| submitting | "Đang đặt lại..." | no | yes | aria-live polite |
| success | "Đặt lại mật khẩu" | no | no | redirect → login |
| error | "Đặt lại mật khẩu" | yes | no | banner aria-live assertive |

## A11y Wiring

| Field | Pattern |
|-------|---------|
| password | `<label for>` + `aria-describedby="password-hint password-err"` + `aria-required` + `aria-invalid` |
| password meter | `aria-live="polite"` strength text, NOT only color |
| banner | `role="alert" aria-live="assertive"` |
| submit-fail | focus → password |

## Open Questions

- Confirm-password second field? Not in MVP (single field + strength meter).

## Out of Scope

- Forgot-password phone/OTP (separate file — produces otpProof).
- In-app change-password (separate file — account-password).
