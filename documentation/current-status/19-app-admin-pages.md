# 19 - Admin Portal Pages

Filesystem root: `app/admin/`
URL root: `/admin`

## Architecture Overview

The admin portal uses a two-layer layout structure:

| Layer | File | Purpose |
|---|---|---|
| Segment root layout | `app/admin/layout.tsx` | Minimal pass-through wrapper (`min-h-screen bg-background`). No chrome, no auth gate. Isolates admin from public site chrome. |
| Console route-group layout | `app/admin/(console)/layout.tsx` | Authenticated shell with sidebar + `<AdminNav />`. Pure presentational -- does NOT gate auth (each page calls `requireAdminPage()` itself). Skip-to-content link included. |

Login (`/admin/login`) sits OUTSIDE the `(console)` route group and renders without the sidebar chrome.

## AdminNav and navConfig

| File | Type | Purpose |
|---|---|---|
| `components/admin/AdminNav.tsx` | Client component (`'use client'`) | Renders the sidebar navigation. Uses `usePathname()` for active-tab highlighting via `aria-current="page"`. Shows all 8 tabs to every role (role enforcement is per-page). |
| `components/admin/navConfig.ts` | Shared module | Single source of truth for nav items. Exports `ADMIN_NAV_ITEMS` array and `isAdminNavItemActive()` helper. Overview (`/admin`) uses exact-match; all others use prefix-match. |

### Nav Items (8 tabs)

| ID | Label | URL | Icon |
|---|---|---|---|
| overview | Tong quan | `/admin` | LayoutDashboard |
| approvals | Phe duyet | `/admin/approvals` | ClipboardCheck |
| charter | Thue xe | `/admin/charter` | Bus |
| users | Nguoi dung | `/admin/users` | Users |
| operators | Nha xe | `/admin/operators` | Building2 |
| finance | Tai chinh | `/admin/finance` | Wallet |
| moderation | Kiem duyet | `/admin/moderation` | ShieldAlert |
| system | He thong | `/admin/system` | Settings |

---

## Page Inventory

### 1. Login Page

| Attribute | Value |
|---|---|
| Filesystem | `app/admin/login/page.tsx` |
| URL | `/admin/login` |
| Component type | Client (`'use client'`) |
| Auth guard | None (this IS the auth entry point; middleware free-list exempts it) |
| Issue | 056 |

**What it renders:** Two-step login form. Step 1: email + password (POST `/api/admin/auth/login`). Step 2: TOTP 6-digit code (POST `/api/admin/auth/totp/verify`). On success, redirects to `/admin`. CSRF token sent on every POST via `readCsrfToken()` from `@/lib/auth/csrfClient`.

**Co-located components:** None.

---

### 2. Overview (Dashboard)

| Attribute | Value |
|---|---|
| Filesystem | `app/admin/(console)/page.tsx` |
| URL | `/admin` |
| Component type | RSC (React Server Component) |
| Auth guard | `requireAdminPage()` from `@/lib/auth` |
| Issue | 064 |

**Data fetching:** Three concurrent in-process calls:
- `getAdminMetrics({ dateFrom, dateTo })` from `@/lib/analytics`
- `getActionQueue()` from `@/lib/admin`
- `getFailureAlerts(5)` from `@/lib/admin`
- `getDefaultDateRange(30)` from `@/lib/op` (module-scope helper, RSC purity)

**Role matrix:**

| Section | SUPER_ADMIN | FINANCE | SUPPORT |
|---|---|---|---|
| Operational cards (customers, operators, bookings) | Yes | Yes | Yes |
| Finance cards (GMV, platform revenue) | Yes | Yes | No |
| Action queue: approvals | Yes | Yes | Yes |
| Action queue: charter dispatch | Yes | Yes | Yes |
| Action queue: disputes + failed payouts | Yes | Yes | No |
| Failure alerts | Yes | Yes | Yes |
| Infra health (Sentry/Datadog links) | Yes | Yes | Yes |

**What it renders:** Metric cards (customers, operators, bookings, GMV, revenue), action queue cards linking to `/admin/approvals`, `/admin/charter`, `/admin/finance`, failure alert counts, recent failed notifications list, and external monitoring links (Sentry/Datadog via env vars).

**Co-located components:** None (uses shared UI components only).

---

### 3. Approvals

| Attribute | Value |
|---|---|
| Filesystem | `app/admin/(console)/approvals/page.tsx` |
| URL | `/admin/approvals` |
| Component type | RSC |
| Auth guard | `requireAdminPage()` -- only SUPER_ADMIN sees queue; others get "insufficient role" notice |
| Issue | 065 |

**Data fetching:**
- `getApprovalQueue()` from `@/lib/admin`

**What it renders:** Operator approval queue sorted oldest-first. Each row shows: legal name (links to `/admin/operators/[id]`), contact email, phone, submission date, rejection reason (if any), status badge, KYB documents, payout account details (bank, masked account number, holder name, name-match score, verification status), and action buttons.

**Co-located components:**

| File | Type | Purpose |
|---|---|---|
| `ApprovalActions.tsx` | Client (`'use client'`) | Action buttons per operator row: "Move to Review" (PENDING_REVIEW), "Approve" + "Confirm Payout Account" (UNDER_REVIEW, step-up gated), "Reject" (with reason input), "Request Info" (with note input). Implements TOTP step-up flow for privileged actions (Approve, Confirm-Payout). POSTs to `/api/admin/operators/[id]/{under-review,approve,confirm-payout-account,reject,request-info}`. |
| `KybDocLinks.tsx` | Client (`'use client'`) | Renders KYB document list per operator. Each doc has a "View" button that fetches a fresh signed URL on demand (GET `/api/admin/operators/[id]/kyb/[docId]/url`) and opens it in a new tab. Doc types: business_license, identity, payout_account. Access is audit-logged server-side. |

---

### 4. Charter Dispatch

| Attribute | Value |
|---|---|
| Filesystem | `app/admin/(console)/charter/page.tsx` |
| URL | `/admin/charter` |
| Component type | RSC |
| Auth guard | `requireAdminPage()` -- SUPER_ADMIN + SUPPORT can dispatch; others get notice |
| Issue | 085 |

**Data fetching:**
- `getCharterDispatchQueue(prisma, { limit: 20 })` from `@/lib/admin`
- `getApprovedOperatorsForAssign(prisma)` from `@/lib/admin`

**What it renders:** Charter request queue (FIFO). Each row shows: reference code, contact info (name, phone, email), route (origin + destinations), dates, passenger count + vehicle type, budget, notes, submission date, prior assignee (for reassigned requests). No step-up required (ops action, not money movement).

**Co-located components:**

| File | Type | Purpose |
|---|---|---|
| `CharterDispatchActions.tsx` | Client (`'use client'`) | Three actions per charter row: (1) "Assign direct" -- operator picker dropdown + POST `assign-direct` with operatorId; (2) "Publish pool" -- POST `publish` to enter public pool; (3) "Reject" -- reason input + POST `reject`. POSTs to `/api/admin/charter/[id]/{assign-direct,publish,reject}`. CSRF-protected, no step-up. |

---

### 5. Users List

| Attribute | Value |
|---|---|
| Filesystem | `app/admin/(console)/users/page.tsx` |
| URL | `/admin/users` |
| Component type | RSC |
| Auth guard | `requireAdminPage()` -- SUPER_ADMIN + SUPPORT; others get notice |
| Issue | 066 |

**Data fetching:**
- `searchUsers({ q, kind, cursor })` from `@/lib/admin`

**Query params:** `?kind=customer|operator` (tab selector), `?q=` (search by name/phone/email), `?cursor=` (seek pagination).

**What it renders:** Two-tab view (customer / operator) with search box. Each row shows name, masked contact, kind badge, and status badge. Customer rows link to `/admin/users/customer/[id]`; operator rows link to `/admin/operators/[id]`. Cursor-based "next page" pagination.

**Co-located components:** None.

---

### 6. User Detail (Customer)

| Attribute | Value |
|---|---|
| Filesystem | `app/admin/(console)/users/[kind]/[id]/page.tsx` |
| URL | `/admin/users/customer/[id]` |
| Component type | RSC |
| Auth guard | `requireAdminPage()` -- SUPER_ADMIN + SUPPORT |
| Issue | 066 |

**Routing behavior:** If `kind=operator`, redirects to `/admin/operators/[id]`. If `kind` is not `customer`, returns 404.

**Data fetching:**
- `getCustomerDetail(id)` from `@/lib/admin`

**What it renders:** Customer profile card (phone masked, email, join date, last login, booking count), status badge, and moderation section. Deleted accounts show a warning notice with no action buttons.

**Co-located components:**

| File | Type | Purpose |
|---|---|---|
| `UserActions.tsx` | Client (`'use client'`) | Suspend/Reinstate toggle for a customer. POSTs to `/api/admin/customers/[id]/{suspend,reinstate}`. CSRF-protected. No step-up (moderate-privilege, already behind TOTP-verified session). |

---

### 7. Operators List

| Attribute | Value |
|---|---|
| Filesystem | `app/admin/(console)/operators/page.tsx` |
| URL | `/admin/operators` |
| Component type | RSC |
| Auth guard | `requireAdminPage()` -- SUPER_ADMIN + FINANCE; others get notice |
| Issue | 067 |

**Data fetching:**
- `listAllOperators({ status, cursor })` from `@/lib/admin`

**Query params:** `?status=PENDING_REVIEW|UNDER_REVIEW|APPROVED|REJECTED|SUSPENDED` (filter), `?cursor=` (seek pagination).

**What it renders:** Filterable operator list with status-filter nav (All, plus each OperatorStatus). Each row shows legal name, masked contact, status badge, links to `/admin/operators/[id]`. Cursor-based "next page" pagination.

**Co-located components:** None.

---

### 8. Operator Detail

| Attribute | Value |
|---|---|
| Filesystem | `app/admin/(console)/operators/[id]/page.tsx` |
| URL | `/admin/operators/[id]` |
| Component type | RSC |
| Auth guard | `requireAdminPage()` -- SUPER_ADMIN + FINANCE |
| Issue | 067 |

**Data fetching:**
- `getOperatorDetail(id)` from `@/lib/admin`

**What it renders:** Back-link to operators list, operator header (legal name + status badge), rejection reason alert (if any). Five cards:
1. **Profile** -- brand name, contact name/email/phone, address, routes summary, join date, current platform fee %
2. **Activity** -- fleet count, total trips, upcoming trips, GMV
3. **Balance** -- pending / available / paid-out amounts (VND)
4. **Operator Account** -- `<CreateAccountAction>` for provisioning login credentials
5. **Actions** -- `<OperatorActions>` for suspend/reinstate + fee override
6. **Payout History** -- table of payouts with amount, status, scheduled/settled dates

**Co-located components:**

| File | Type | Purpose |
|---|---|---|
| `OperatorActions.tsx` | Client (`'use client'`) | Two privileged action surfaces, both step-up gated: (1) Suspend (APPROVED operators) / Reinstate (SUSPENDED operators) -- POST to `/api/admin/operators/[id]/{suspend,reinstate}`; (2) Fee override -- percentage input (0-20%) converted to ppm, POST to `/api/admin/operators/[id]/fee-override`. Full TOTP step-up flow. |
| `CreateAccountAction.tsx` | Client (`'use client'`) | Provisions operator login account. POST `/api/admin/operators/[id]/create-account`, step-up gated. On 201: displays generated username + one-time temp password (shown once). On 409: reports account already exists. Shows existing username if account is already provisioned. |

---

### 9. Finance

| Attribute | Value |
|---|---|
| Filesystem | `app/admin/(console)/finance/page.tsx` |
| URL | `/admin/finance` |
| Component type | RSC |
| Auth guard | `requireAdminPage()` -- SUPER_ADMIN + FINANCE only |
| Issue | 068 |

**Data fetching:**
- `getPayoutQueue({ status: 'requested' })` from `@/lib/admin`
- `getPayoutQueue({ status: 'failed' })` from `@/lib/admin`
- `getEffectiveFeeRate(null, now)` from `@/lib/ledger`
- `getLedgerView({ operatorId })` from `@/lib/admin` (conditional on `?operatorId=` param)

**Query params:** `?operatorId=` (ledger view picker).

**What it renders:** Five sections:
1. **Payout queue** -- table of requested + failed payouts with operator ID, amount, status, scheduled date, failure reason, and per-row action buttons
2. **Ledger view** -- operator ID picker (GET form), then balance summary (pending/available/paid-out) + ledger entry table (type, amount, source, created) + manual adjustment form
3. **Refund-out** -- form (booking ID + amount + reason)
4. **Chargeback** -- form (booking ID + amount)
5. **Global fee config** -- current rate display + percentage input form. Links to Operators tab for per-operator overrides.

**Co-located components:**

| File | Type | Purpose |
|---|---|---|
| `FinanceActions.tsx` | Client (`'use client'`) | Multi-kind action component mounted per section. `kind` variants: (1) `payout-row` -- Retry (failed) / Approve (requested) buttons per payout row; (2) `adjustment` -- signed VND amount + reason form for manual ledger adjustments; (3) `refund-out` -- booking ID + amount + reason form; (4) `chargeback` -- booking ID + amount form; (5) `global-fee` -- percentage input (0-20%) for global platform fee. All actions step-up gated with TOTP flow. POSTs to `/api/admin/finance/{payouts/[id]/retry, payouts/[id]/approve, ledger/adjustment, refund-out, chargeback, fee/global}`. |

---

### 10. Moderation

| Attribute | Value |
|---|---|
| Filesystem | `app/admin/(console)/moderation/page.tsx` |
| URL | `/admin/moderation` |
| Component type | RSC |
| Auth guard | `requireAdminPage()` -- SUPER_ADMIN + SUPPORT; others get notice |
| Issue | 069 |

**Data fetching:**
- `getOpenReports({ cursor })` from `@/lib/admin`
- `getModeratedItems()` from `@/lib/admin`

**Query params:** `?cursor=` (reports pagination).

**What it renders:** Three sections:
1. **Reports queue** -- open reports with reason, target type:id, creation date, and Resolve button. Cursor-paginated.
2. **Disable by ID** -- form with kind selector (trips/routes) + ID input + optional reason
3. **Currently disabled** -- two lists (disabled trips + disabled routes) each with Enable button

**Co-located components:**

| File | Type | Purpose |
|---|---|---|
| `ModerationActions.tsx` | Client (`'use client'`) | Three exported components: (1) `ResolveReportButton` -- POST `/api/admin/moderation/reports/[id]/resolve`; (2) `DisableByIdForm` -- kind (trips/routes) + ID + reason, POST `/api/admin/moderation/{trips,routes}/[id]/disable`; (3) `EnableButton` -- POST `/api/admin/moderation/{trips,routes}/[id]/enable`. CSRF-protected, NO step-up (lower-privilege ops actions). |

---

### 11. System

| Attribute | Value |
|---|---|
| Filesystem | `app/admin/(console)/system/page.tsx` |
| URL | `/admin/system` |
| Component type | RSC |
| Auth guard | `requireAdminPage()` |
| Issue | 070 |

**Data fetching:**
- `getFlag(key, undefined, prisma)` for each key in `FLAG_KEYS` from `@/lib/flags`
- `listAdmins(prisma)` from `@/lib/admin` (SUPER_ADMIN only)
- `getAuditLog({ limit: 50 }, prisma)` from `@/lib/admin`

**Role matrix:**

| Section | SUPER_ADMIN | FINANCE | SUPPORT |
|---|---|---|---|
| Feature flags (toggle) | Yes | Yes | No (read-only badge) |
| Admin accounts (CRUD) | Yes | No (notice) | No (notice) |
| Audit log (view) | Yes | Yes | Yes |
| Audit CSV export | Yes | Yes | No |

**What it renders:** Three cards:
1. **Feature flags** -- table with flag key, enabled/disabled badge, and toggle button (or "read-only" for non-privileged roles)
2. **Admin accounts** -- invite form (email + role selector: SUPER_ADMIN/FINANCE/SUPPORT), admin table (email, role, status, TOTP enabled date, created date, change-role dropdown + revoke button)
3. **Audit log** -- table of recent entries (timestamp, actor, action, target) with CSV export link for privileged roles

**Co-located components:**

| File | Type | Purpose |
|---|---|---|
| `SystemActions.tsx` | Client (`'use client'`) | Four exported components, all step-up gated: (1) `FlagToggle` -- POST `/api/admin/system/flags` with key + enabled toggle; (2) `InviteAdminForm` -- POST `/api/admin/admins` with email + role, displays temp password ONCE on success; (3) `RevokeAdminButton` -- POST `/api/admin/system/admins/[id]/revoke`; (4) `ChangeRoleControl` -- role dropdown + POST `/api/admin/system/admins/[id]/role`. Shared `useStepUpAction` hook for step-up TOTP flow. |

---

## Cross-Cutting Patterns

### Auth Guard

Every console page calls `requireAdminPage()` from `@/lib/auth` which returns a context object with `ctx.role` (AdminRole: `SUPER_ADMIN | FINANCE | SUPPORT`). Pages check the role to determine what to show. The Layer 1.5 middleware (proxy.ts) blocks unauthenticated/non-TOTP access before any `/admin` page renders.

### CSRF Protection

Every client component uses `readCsrfToken()` from `@/lib/auth/csrfClient` (deep import, never the `@/lib/auth` barrel) to read the `bb_csrf` cookie and send it as `X-CSRF-Token` header on every non-safe API call.

### Step-Up Authentication

Privileged actions (approvals, finance operations, system changes, operator management) implement a TOTP step-up flow:
1. POST the action
2. If 403 with `STEP_UP_REQUIRED`, show TOTP input
3. POST `/api/admin/auth/step-up` with the TOTP code
4. On 200, `bb_admin_stepup` cookie is set
5. Re-POST the original action

Exceptions: Moderation actions (resolve/disable/enable) and user suspend/reinstate do NOT require step-up. Charter dispatch actions also skip step-up.

### RSC Purity

All server component pages avoid `Date.now()` / `Math.random()` in render bodies per AGENTS.md Issue 016. Time-derived defaults are computed in module-scope helpers or come from DB columns.

### Data Fetching

All pages fetch data in-process via lib functions (never self-fetch own API routes, per AGENTS.md Issue 002/003). Concurrent fetches use `Promise.all()`.

---

## Complete File Index

| File | Type | Role |
|---|---|---|
| `app/admin/layout.tsx` | RSC | Segment root layout (minimal wrapper) |
| `app/admin/login/page.tsx` | Client | Login page (email+password, then TOTP) |
| `app/admin/(console)/layout.tsx` | RSC | Console shell (sidebar + AdminNav) |
| `app/admin/(console)/page.tsx` | RSC | Overview dashboard |
| `app/admin/(console)/approvals/page.tsx` | RSC | Approval queue |
| `app/admin/(console)/approvals/ApprovalActions.tsx` | Client | Approval action buttons (step-up) |
| `app/admin/(console)/approvals/KybDocLinks.tsx` | Client | KYB document viewer links |
| `app/admin/(console)/charter/page.tsx` | RSC | Charter dispatch queue |
| `app/admin/(console)/charter/CharterDispatchActions.tsx` | Client | Charter dispatch actions |
| `app/admin/(console)/users/page.tsx` | RSC | Users list (customer+operator) |
| `app/admin/(console)/users/[kind]/[id]/page.tsx` | RSC | Customer detail (operator redirects) |
| `app/admin/(console)/users/[kind]/[id]/UserActions.tsx` | Client | Customer suspend/reinstate |
| `app/admin/(console)/operators/page.tsx` | RSC | Operators list |
| `app/admin/(console)/operators/[id]/page.tsx` | RSC | Operator detail |
| `app/admin/(console)/operators/[id]/OperatorActions.tsx` | Client | Operator suspend/reinstate + fee override (step-up) |
| `app/admin/(console)/operators/[id]/CreateAccountAction.tsx` | Client | Operator account provisioning (step-up) |
| `app/admin/(console)/finance/page.tsx` | RSC | Finance tab (payouts, ledger, refunds, fees) |
| `app/admin/(console)/finance/FinanceActions.tsx` | Client | Finance multi-kind actions (step-up) |
| `app/admin/(console)/moderation/page.tsx` | RSC | Moderation tab (reports, disable, enable) |
| `app/admin/(console)/moderation/ModerationActions.tsx` | Client | Moderation actions (no step-up) |
| `app/admin/(console)/system/page.tsx` | RSC | System tab (flags, admins, audit) |
| `app/admin/(console)/system/SystemActions.tsx` | Client | System actions (flags, invite, revoke, role change; step-up) |
| `components/admin/AdminNav.tsx` | Client | Sidebar navigation component |
| `components/admin/navConfig.ts` | Shared | Nav items array + active-tab logic |
