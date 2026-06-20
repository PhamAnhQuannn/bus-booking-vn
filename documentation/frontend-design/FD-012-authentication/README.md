# DS-029 Authentication & Account Security

Frontend UX specification for authentication across the three platform realms (customer, operator, admin), session management, and security feedback patterns.

---

## 1. Three Auth Realms

| Realm | Identity | Credential | MFA | Session TTL (Access) | Session TTL (Refresh) |
|-------|----------|------------|-----|---------------------|-----------------------|
| **Customer** | Phone number | 6-digit OTP (passwordless) | None | 15 min | Long-lived (weeks) |
| **Operator** | Email + username | Password + OTP step-up | OTP for sensitive ops | 15 min | Work-shift scoped |
| **Admin** | Email | Password + TOTP | Authenticator app (mandatory) | 15 min | Short-lived |

---

## 2. Customer OTP Flow

### 2.1 Phone Entry Screen

| Element | Specification |
|---------|---------------|
| Route | `/login` |
| Layout | `AuthSplitLayout` -- orange gradient left panel (desktop), centered form right |
| Phone input | `+84` prefix pre-filled, `type="tel"`, `inputMode="numeric"`, max 10 digits after prefix |
| Validation | Client-side: Vietnamese mobile format (`/^(3[2-9]|5[2689]|7[0-9]|8[1-9]|9[0-9])\d{7}$/`). Server: Zod schema |
| CTA | "Nhan ma OTP" (Receive OTP code) |
| Loading state | Button shows spinner + "Dang gui..." (Sending...) |
| Error: invalid phone | `<p role="alert">` -- "So dien thoai khong hop le" |
| Error: rate limited | "Vui long thu lai sau X giay" with countdown derived from `retryAfter` response header |
| Error: locked out | "Tai khoan bi tam khoa. Vui long thu lai sau 15 phut." |

### 2.2 OTP Entry Screen

| Element | Specification |
|---------|---------------|
| Input | 6 individual digit boxes, auto-advance on keystroke, `inputMode="numeric"`, `autocomplete="one-time-code"` |
| Phone display | Masked: `****1234` (last 4 digits visible) |
| Timer | Resend countdown: 60s initial, displayed as "Gui lai ma sau XX giay" |
| Resend CTA | Disabled during countdown, then "Gui lai ma OTP". Max 3 resends per 15-min window |
| Auto-submit | Fires verify request after 6th digit entered |
| Success | Receives `otpProof` JWT in response body. Redirect to home or pre-hold return URL |
| Error: wrong code | "Ma OTP khong dung. Con X lan thu." with remaining attempts from server |
| Error: expired | "Ma OTP da het han. Vui long yeu cau ma moi." with resend CTA |
| Error: lockout | "Ban da nhap sai qua nhieu lan. Vui long thu lai sau 15 phut." Hide input, show countdown to lockout expiry |

### 2.3 OTP Delivery Hierarchy

| Priority | Channel | Timing | Persona coverage |
|----------|---------|--------|-----------------|
| 1 | Zalo ZNS | Instant | "Em Quan" (student, Zalo-native), "Chi Lan" (worker) |
| 2 | SMS (eSMS brandname) | 5-60s delivery P99 | "Ba Hoa" (elderly), "Marco" (tourist), fallback for all |

OTP TTL: 5 minutes. Auth max attempts: 5. Account management max attempts: 3.

---

## 3. Operator Login

### 3.1 Standard Login (`/op/login`)

| Element | Specification |
|---------|---------------|
| Layout | `AuthSplitLayout` -- dark gradient left panel |
| Fields | Username (`BRAND_ACRONYM-last4phone` format), Password |
| Validation | Both required; password min length enforced server-side |
| CTA | "Dang nhap" (Log in) |
| Error: bad credentials | "Ten dang nhap hoac mat khau khong dung" (no credential-specific leak) |
| Error: account suspended | "Tai khoan da bi tam ngung. Lien he quan tri vien." |
| Rate limiting | After 5 failed attempts: "Vui long thu lai sau X giay" |

### 3.2 First-Login Password Change Gate

| Trigger | `requiresPasswordChange` claim is `true` in operator JWT |
|---------|------|
| Behavior | Edge middleware redirects ALL `/op/*` routes to `/op/first-login` |
| Allowlist | Exact-match `Set`: `{'/op/first-login', '/op/login', '/api/op/auth/refresh'}` |
| Page | `/op/first-login` -- forced password change form |
| Fields | Current password (temp), New password, Confirm new password |
| Password rules | Min 8 chars, at least 1 uppercase, 1 digit, 1 special character |
| Strength meter | Visual bar: weak (red) / fair (amber) / strong (green) |
| CTA | "Doi mat khau" (Change password) |
| On success | Mints fresh JWT with `requiresPasswordChange: false`, redirect to `/op/dashboard` |
| Vietnamese text | "Ban can doi mat khau truoc khi tiep tuc su dung he thong." |

### 3.3 OTP Step-Up for Sensitive Operations

| Operations requiring step-up | Payout withdrawal, Staff role changes, Payout account edit |
|------------------------------|------|
| UX flow | Modal overlay with OTP entry (same 6-digit pattern as customer), sent to operator's `notificationPhone` |
| Timeout | 5-minute OTP TTL |
| Cancellation | Close modal returns to previous screen without executing operation |
| Vietnamese text | "Xac minh OTP de tiep tuc thao tac nay." |

---

## 4. Admin Login

### 4.1 Login Flow (`/admin/login`)

| Step | Element | Specification |
|------|---------|---------------|
| 1 | Email + Password | Standard form, no username format constraint |
| 2 | TOTP | 6-digit authenticator code (Google Authenticator, Authy) |
| | Input | Single 6-digit field, `inputMode="numeric"`, `autocomplete="one-time-code"` |
| | Error | "Ma xac thuc khong dung" (Invalid authenticator code) |
| | No fallback | No SMS fallback, no "forgot TOTP" self-service. Device loss requires Operations Manager intervention |

### 4.2 TOTP Setup (First-Time)

| Element | Specification |
|---------|---------------|
| QR code | Display TOTP provisioning URI as scannable QR |
| Manual entry | Show secret key as base32 string for manual entry |
| Verification | Require entering a valid TOTP code before completing setup |
| Vietnamese text | "Quet ma QR bang ung dung xac thuc (Google Authenticator, Authy)" |

---

## 5. Guest Booking Path

### 5.1 Flow Without Account

```
Search -> Select trip -> Enter phone for hold -> Hold created (phone = identity)
  -> Review booking -> Initiate payment -> Payment completes -> Booking confirmed
  -> Post-confirmation: "Dang ky tai khoan de xem lich su dat ve?"
```

| Element | Specification |
|---------|---------------|
| Phone entry | During hold creation, phone number is the sole identity requirement |
| No registration gate | Booking completes without account creation |
| Post-booking prompt | Non-blocking CTA: "Tao tai khoan" with explanation "Xem lai cac ve da dat, nhan thong bao chuyen di" |
| Guest-to-registered merge | `attachGuestBookingByPhone` -- registering with the same phone links all prior guest bookings |
| Consent capture | `no_refund` + `pii_storage` ConsentRecord created at booking initiation. No pre-ticked checkboxes (PDPL 2025) |

---

## 6. Session Expiry UX

### 6.1 JWT Access Token Expiry (15 minutes)

| Scenario | Behavior |
|----------|----------|
| Background refresh | Client-side fetch clients call `POST /api/{realm}/auth/refresh` transparently before access token expires |
| Refresh success | New access token minted, user unaware |
| Refresh failure (expired refresh token) | Redirect to login with return URL preserved in query param |
| Mid-form expiry | Form data preserved in Zustand store; after re-login, user returns to the same page with state intact |

### 6.2 Operator Token Refresh

Operator fetch clients must periodically refresh the access token (15-min TTL) by POSTing to `/api/op/auth/refresh` with the `X-CSRF-Token` header from the `bb_csrf` cookie. Failure to refresh causes 401 on subsequent mutations.

### 6.3 Session Expiry Message

| Vietnamese text | Context |
|-----------------|---------|
| "Phien lam viec da het han. Vui long dang nhap lai." | Generic session expired |
| "Ban da bi dang xuat do khong hoat dong." | Inactivity-based expiry |

---

## 7. Rate Limit Feedback

### 7.1 HTTP 429 Handling

| Element | Specification |
|---------|---------------|
| Detection | Response status `429` |
| Display | Toast notification (non-blocking) |
| Message | "Vui long thu lai sau X giay" where X = `Retry-After` header value |
| Countdown | Live countdown in toast until retry is allowed |
| Auto-retry | No automatic retry -- user must re-initiate action |

### 7.2 Rate Limits by Endpoint Class

| Endpoint | Limit | Lockout |
|----------|-------|---------|
| OTP send | 3 per 15 min per phone | 15-min lockout sentinel |
| OTP verify | 5 attempts per code (auth), 3 (account mgmt) | 15-min lockout after threshold |
| Login (operator/admin) | 5 attempts per account | Progressive delay |
| Hold creation | Per-phone cap (`CONCURRENT_HOLD_CAP`) | Immediate rejection with message |

---

## 8. CSRF Protection

### 8.1 Double-Submit Cookie Pattern

| Component | Detail |
|-----------|--------|
| Cookie | `bb_csrf` (non-HttpOnly, readable by JS) |
| Header | `X-CSRF-Token` |
| Required on | All `POST`, `PUT`, `DELETE` requests to `/api/*` |
| Exempt | HMAC-authenticated webhook endpoints (`/api/payments/momo/webhook`, `/api/payments/vnpay/webhook`) |

### 8.2 Client Integration

| Rule | Detail |
|------|--------|
| Import path | `import { readCsrfToken } from '@/lib/auth/csrfClient'` |
| NEVER import from | `@/lib/auth` barrel (pulls server-only modules, breaks `'use client'` components) |
| Fetch wrapper | Every state-changing fetch includes `headers: { 'X-CSRF-Token': readCsrfToken() }` |
| Missing token | If `bb_csrf` cookie absent, fetch proceeds without header; server returns 403 |
| 403 response | Toast: "Phien khong hop le. Vui long tai lai trang." with page reload CTA |

### 8.3 E2E Test Pattern

Playwright tests extract CSRF token via `request.storageState()` and include `X-CSRF-Token` header on all POST/PUT/DELETE calls. Helper: `e2e/helpers/csrf.ts` `primeCsrf()`.

---

## 9. Auth State Indicators

### 9.1 Customer Portal

| State | Header display |
|-------|---------------|
| Guest | "Dang nhap" link |
| Authenticated | Phone (masked `****1234`) + "Tai khoan" dropdown (My bookings, Log out) |

### 9.2 Operator Portal

| State | Sidebar display |
|-------|----------------|
| Logged in | Operator brand name, role badge (`Quan ly` / `Nhan vien`), user display name |
| `requiresPasswordChange` | Full-screen redirect to `/op/first-login` -- no sidebar access |

### 9.3 Admin Portal

| State | Header display |
|-------|---------------|
| Logged in | Admin name, role badge, "Dang xuat" (Log out) |

---

## 10. Error Message Table

| Code | HTTP | Vietnamese Message |
|------|------|--------------------|
| `invalid_phone` | 422 | "So dien thoai khong hop le" |
| `otp_mismatch` | 422 | "Ma OTP khong dung. Con {n} lan thu." |
| `otp_expired` | 422 | "Ma OTP da het han. Vui long yeu cau ma moi." |
| `locked_out` | 429 | "Tai khoan bi tam khoa. Vui long thu lai sau 15 phut." |
| `rate_limited` | 429 | "Vui long thu lai sau {n} giay" |
| `invalid_credentials` | 401 | "Ten dang nhap hoac mat khau khong dung" |
| `session_expired` | 401 | "Phien lam viec da het han. Vui long dang nhap lai." |
| `csrf_invalid` | 403 | "Phien khong hop le. Vui long tai lai trang." |
| `account_suspended` | 403 | "Tai khoan da bi tam ngung. Lien he quan tri vien." |
| `totp_invalid` | 422 | "Ma xac thuc khong dung" |
| `password_too_weak` | 422 | "Mat khau chua du manh. Can it nhat 8 ky tu, bao gom chu hoa, so va ky tu dac biet." |

---

## Cross-References

| Document | Relevance |
|----------|-----------|
| [ADR-003 Auth Architecture](../../architecture-decisions/ADR-003-auth-architecture/) | Three-realm auth decisions, OTP-only customer, password+OTP operator, password+TOTP admin |
| [ADR-008 Security Posture](../../architecture-decisions/ADR-008-security-posture/) | CSRF double-submit, rate limiting, Edge middleware security layers |
| [FD-004 Form Design](../FD-004-form-design/) | `AuthSplitLayout`, input validation patterns, CSRF deep-import rule |
| [FD-010 Error & Loading States](../FD-010-error-loading-states/) | Toast notifications, error boundary patterns |
| [Business: Customer Personas](../../business/personas/customer-personas.md) | Phone-first population, "Ba Hoa" elderly, "Marco" tourist |
| [Business: Operator Personas](../../business/personas/operator-personas.md) | Micro operator low-tech literacy, operator auth needs |
| [Business: State Machines -- OTP Lifecycle](../../business/domain-model/state-machines.md) | OTP states, lockout sentinel, attempt caps |
