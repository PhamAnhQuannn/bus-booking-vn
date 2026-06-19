> ← [Previous](../07-api-design/) | [Index](../README.md) | [Next →](../08-auth/)

### 7.7 Form Validation & Multi-Step Flows

Sections 7.5–7.6 describe the API error format and server-side Zod validation. This section covers the **client-side** validation architecture — how users see and fix errors before (and after) hitting the server.

#### Two-Layer Validation

Every form is validated in two places:

| Layer | When | What it catches | How |
|-------|------|----------------|-----|
| **Client** | On blur (field loses focus) | Format errors (invalid phone, short password, empty required field) | Zod schema in the browser — same schemas as server where possible (`lib/core/validation/`) |
| **Server** | On submit | Uniqueness violations, DB constraints, business rules (sold out, rate-limited, OTP expired) | Zod schema in route handler + domain logic |

**Why both?** Client-side validation gives instant feedback ("Số điện thoại không hợp lệ" appears as soon as the user tabs out — no round-trip). Server-side validation is the real gate (client-side can be bypassed). Using the same Zod schema in both layers prevents drift.

#### Error Display Pattern

```
┌──────────────────────────────────────────┐
│  Số điện thoại                           │
│  ┌────────────────────────────────────┐  │
│  │ 091234                             │  │  ← aria-invalid="true"
│  └────────────────────────────────────┘  │
│  ⚠ Số điện thoại không hợp lệ           │  ← role="alert", aria-describedby
│                                          │
│  ┌─ Server error banner ──────────────┐  │
│  │ Số điện thoại hoặc mật khẩu       │  │  ← role="alert" (assertive)
│  │ không đúng.                        │  │
│  └────────────────────────────────────┘  │
│                                          │
│  [ Đăng nhập ]                           │
└──────────────────────────────────────────┘
```

- **Inline errors**: Red text below the field. Linked via `aria-describedby` so screen readers announce the error when the field is focused. Field marked `aria-invalid="true"`.
- **Banner errors**: Above the submit button. For server-returned errors that don't map to a specific field (e.g., generic credential failure, rate-limit hit, network error).
- **Focus on error**: After submit failure, focus moves to the **first** errored field. Priority: fields in DOM order.

#### Non-Enumerating Error Messages

Auth endpoints **never reveal which field is wrong**. This prevents **account enumeration** — an attacker probing "does phone 0912345678 have an account?" Soft-deleted accounts are excluded via `findFirst({phone, deletedAt: null})` (NOT `findUnique` — which can't filter on the non-unique `deletedAt` column) so deleted accounts are silently invisible.

| Scenario | What the server returns | What the user sees |
|----------|------------------------|-------------------|
| Login: phone not found | `401 INVALID_CREDENTIALS` | "Số điện thoại hoặc mật khẩu không đúng" |
| Login: wrong password | `401 INVALID_CREDENTIALS` | Same message — indistinguishable |
| Forgot password: phone not registered | `200 OK` (always) | "Nếu số điện thoại tồn tại, chúng tôi đã gửi mã xác thực" |
| Phone change: init (send OTP to new phone) | `200 OK` (always) | "Chúng tôi đã gửi mã xác thực" — non-enumerating even at send step (does not reveal if target phone is taken) |
| Phone change: new phone taken (at confirm) | `422 PHONE_TAKEN` | Generic "Số điện thoại không khả dụng" — collision revealed only at confirm, never at init |
| Rate-limited request | `429` with `retryAfter` (seconds) in body | "Vui lòng thử lại sau X giây" — countdown timer in banner |

#### Multi-Step Wizard Pattern (OTP Flows)

Registration is a **3-step wizard** (the most complex client form):

```
  ●───────●───────○
  Phone    OTP     Profile
  Step 1   Step 2  Step 3
```

| Step | Fields | Validation | Success action |
|------|--------|-----------|---------------|
| 1. Phone | Phone number | VN mobile format on blur | Server sends OTP via SMS, advance to step 2 |
| 2. OTP | 6-digit code | `inputmode="numeric"`, `autocomplete="one-time-code"` | Server verifies → mints `otpProof` JWT (Section 8), advance to step 3 |
| 3. Profile | Password + optional display name | Password ≥8 chars, letter+digit required, live strength meter | Server creates account, stores token, redirects |

**Step state in URL**: The current step index is also carried in the URL parameter `?step=phone|code|profile` so that browser back-button and hard-refresh preserve the correct step — not just in React state.

**State between steps**: Carried via `otpProof` JWT (HS256, 5-minute TTL, single-use via jti) — not server-side sessions. This avoids cross-route table coupling (see Mistake Log Issue 007).

**OTP expiry mid-wizard**: If the user navigates from step 2 to step 3 after the 5-minute `otpProof` TTL has elapsed, the server rejects the expired proof → the UI bounces back to step 1 with a banner message ("Mã xác thực đã hết hạn, vui lòng thử lại").

**OTP safety mechanisms**:
- **Resend cooldown**: 60 seconds between resends, max 3 resends per 15 minutes per phone (server-enforced, separate counter from the lockout below)
- **Lockout sentinel**: 3 failed OTP **verifications** (wrong code) → 15-minute lockout. This is a distinct counter from the resend cap — the lockout counts mismatches, the resend cap counts new-OTP requests. (The OTP row is repurposed as a lockout marker — see Section 8)
- **Replay prevention**: `otpProof` JWT consumed via Redis SETNX (jti claim); second use returns null

#### Password Strength

Password fields show a **live strength meter**:
- Requirements: 8–128 characters, must contain at least one letter and one digit
- Meter updates on every keystroke — `aria-live="polite"` announces strength level as text (not color-only, since color-only violates WCAG 1.4.1)
- Server enforces **reuse prohibition** — new password cannot equal the previous password (`422 PASSWORD_REUSED`)

#### Idempotent Destructive Actions

Destructive operations use a **confirmation pattern** (not a bare "are you sure?" prompt):

| Action | Confirmation UX | Server behavior on repeat |
|--------|----------------|--------------------------|
| Delete account | Dialog with checkbox "Tôi hiểu hành động này không thể hoàn tác" — button disabled until checked | 200 `{ alreadyDeleted: true }` (idempotent, discriminated result) |
| Cancel trip | Reason text required (≥10 chars) in destructive Dialog | 200 `{ alreadyCancelled: true }` (idempotent — see Section 13.6) |
| Disable staff | Confirmation Dialog (no extra fields) | Revokes all sessions; already-disabled → no-op |

**Why discriminated results instead of thrown errors?** When the AC specifies "return 200 with a discriminator", throwing a sentinel error forces the route handler to fabricate the response from the error path — losing the entity DTO. The service layer returns `{ ok: true, alreadyApplied: boolean, ... }` and the route always returns 200.

#### Form State Management

- **Per-form state**: React's `useState` or `useActionState` (React 19). No form library — `useActionState` handles submit, pending state, and server error propagation.
- **Cross-page state**: **Zustand** store (`bookingStore`) carries search context (origin, destination, date, ticket count) between the search page and booking flow. Persists in memory, not URL.
- **Local persistence**: `localStorage` stores the buyer's last-used phone number (`busbooking_last_phone`) for form prefill convenience.

Full per-form specs (fields, validation rules, error copy, states) were consolidated into this section from the former `docs/design/forms/` directory.
