---
screen: operator-login
route: /op/login
last-updated: 2026-05-20
status: draft
---

# Wireframe: Operator Login

## Purpose
Authenticate an operator user (staff/admin of one Operator company) via phone +
password. Login is UNIFIED into the customer route `POST /api/auth/login` with
`{ scope: 'operator' }` — there is NO separate `/api/op/auth/login`. On success
the server sets two HttpOnly cookies (`bb_op_access` 15m, `bb_op_refresh` 30d)
and the client branches on `requiresPasswordChange`.

## Entry Points
- Direct navigation to `/op/login`.
- Proxy / server-component redirect when no `bb_op_access` cookie (any `/op/*`
  page → `redirect('/op/login')`).
- Post-logout (`OpProfileClient.handleLogout` → `window.location.href = '/op/login'`).

## Device Targets
- Mobile (375–767px)
- Desktop (≥768px) — primary for operator (data-dense). Login itself is a narrow
  centered card on both.

## Layout — Mobile (≤767px)
```
+--------------------------------+
|                                |
|   Đăng nhập — Quản trị viên    | ← page title (h1)
|                                |
|   Số điện thoại                | ← Label
|  [ 0901234567              ]   | ← Input (type=tel, name=phone, required)
|                                |
|   Mật khẩu                     | ← Label
|  [ ........................ ]   | ← Input (type=password, name=password)
|                                |
|  [ !! invalid-cred banner !! ] | ← error region (conditional)
|                                |
|  [        Đăng nhập        ]   | ← Button (default, full-width, submit)
|                                |
|   Quên mật khẩu?               | ← link → /op/forgot-password (B5)
+--------------------------------+
```

## Layout — Desktop (≥768px)
```
+------------------------------------------------------------+
|                                                            |
|                +----------------------------+              |
|                |  Đăng nhập — Quản trị viên |              | ← centered card, max ~400px
|                |                            |              |
|                |  Số điện thoại             | ← Label      |
|                |  [ 0901234567          ]   | ← Input      |
|                |                            |              |
|                |  Mật khẩu                  | ← Label      |
|                |  [ .................... ]  | ← Input      |
|                |                            |              |
|                |  [ error banner (cond) ]   |              |
|                |                            |              |
|                |  [      Đăng nhập      ]   | ← Button     |
|                |                            |              |
|                |  Quên mật khẩu?            | ← link       |
|                +----------------------------+              |
|                                                            |
+------------------------------------------------------------+
```
No operator nav shell here — login is pre-auth, rendered standalone.

## Components
| Component | Source | New? |
|-----------|--------|------|
| Page title (h1) | inline `<h1>` | existing markup |
| Label ("Số điện thoại", "Mật khẩu") | inline `<label>` today | New — promote to `Label` primitive (missing) |
| Phone Input | inline `<input type=tel>` today | Migrate to `Input` primitive |
| Password Input | inline `<input type=password>` today | Migrate to `Input` primitive |
| Submit Button ("Đăng nhập") | inline `<button>` today | Migrate to `Button` (variant=default) |
| Error banner | inline `<p style=color:red>` today | Use destructive token (`text-destructive`) |
| Forgot-password link | inline `<a>` | Migrate to `Button` (variant=link) |

## States
| State | Trigger | UI |
|-------|---------|-----|
| Default | Page load | Empty phone + password, Button enabled, no error |
| Loading | Submit in flight (`loading=true`) | Button disabled, label → "Đang đăng nhập..." |
| Invalid-credentials | `!res.ok` (server returns INVALID_CREDENTIALS, anti-enum) | Error banner "Số điện thoại hoặc mật khẩu không đúng." — same copy for unknown phone, wrong password, AND disabled account (no enumeration leak) |
| Connection error | fetch throws | Error banner "Lỗi kết nối. Vui lòng thử lại." |
| Success → first-login | 200 + `requiresPasswordChange:true` | `router.push('/op/first-login')` (no UI flash; cookies already set) |
| Success → active | 200 + `requiresPasswordChange:false` | `router.push('/op/profile')` (NOTE: source lands on profile, NOT dashboard — see Open Questions) |
| Disabled (Button) | While `loading` | Button `disabled`, pointer-events off |
| Empty (n/a) | — | Login form has no list/empty state |

## Interactions
- Submit posts JSON `{ scope:'operator', phone, password }` to `/api/auth/login`
  with `X-CSRF-Token` header read from non-HttpOnly `bb_csrf` cookie (`getCsrf()`).
  `/api/auth/login` is NOT in `CSRF_EXEMPT_PREFIXES`, so the token is mandatory.
- Enter key in either field submits the form.
- On success the server `Set-Cookie`s `bb_op_access` + `bb_op_refresh`; client only
  reads the `requiresPasswordChange` flag from the JSON body to route.
- "Quên mật khẩu?" navigates to `/op/forgot-password` (OTP flow, branch B5).

## Data Needs
| What | When | Source | Optimistic? |
|------|------|--------|-------------|
| CSRF token | Before submit | `bb_csrf` cookie (`getCsrf()`) | n/a |
| Auth result `{accessToken, operator, requiresPasswordChange}` | On submit | `POST /api/auth/login` (UNIFIED route, `scope:'operator'`) | No |
| Session cookies | On 200 | server `Set-Cookie` (HttpOnly) | No |

## Open Questions
- Source redirects success → `/op/profile`, but the flow doc sequence says
  `requiresPasswordChange ? /op/first-login : /op/dashboard`. Reconcile landing
  page (dashboard is the booking-queue home; profile is account settings).
- No explicit lockout-sentinel UI (B5 lockout shares OTP lockout). Should a
  rate-limit / locked-account banner be distinguishable from invalid-credentials?
- Adopt `Label` primitive (currently missing) for the two fields.

## Out of Scope
- Operator self-signup (provisioned via platform-admin CLI — Issue 020).
- Forgot-password / OTP reset screens (branch B5 — separate wireframes).
