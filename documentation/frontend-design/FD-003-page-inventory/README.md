# DS-020 Page Inventory

## Customer Pages (`app/(customer)/`)

| Route | Description |
|-------|-------------|
| `/` | Home — hero, search card, features, popular routes, trust strip |
| `/routes` | Route browser — all active routes with bookable trips |
| `/search` | Search results with filters |
| `/trips/[id]` | Trip detail + booking action |
| `/booking/customer` | Booking flow: passenger info entry |
| `/booking/review` | Booking flow: order review (hold verification) |
| `/booking/confirmation/[token]` | Post-payment success (reachable via SMS/email) |
| `/booking/result/[token]` | MoMo return landing (success/failure) |
| `/account/bookings` | My bookings — tabs: upcoming / past |
| `/account/bookings/[id]` | Single booking detail |
| `/account/settings` | Account settings |
| `/auth/login` | Login (phone + password) |
| `/auth/register` | Register (OTP-verified) |
| `/auth/forgot-password` | Reset initiation |
| `/auth/reset-password` | New password entry |
| `/lien-he-dat-xe` | Charter inquiry form |
| `/lien-he-dat-xe/confirmation` | Charter request received |
| `/charter/status/[ref]` | Public charter status tracker |

**Booking layout** (`app/(customer)/booking/layout.tsx`): guards on `bookingStore.tripId`, redirects to `/search` if empty. Token pages (`confirmation`, `result`) bypass guard.

## Operator Pages (`app/op/`)

### Auth

`/op/login` · `/op/register` · `/op/forgot-password` · `/op/first-login` (password change gate)

### Console (`app/op/(console)/`)

| Route | Description |
|-------|-------------|
| `/op/dashboard` | Today's trips, unviewed bookings, balance |
| `/op/trips` | Trip list |
| `/op/trips/new` | Create trip |
| `/op/trips/[id]` | Trip detail/edit |
| `/op/routes` | Route management |
| `/op/buses` | Fleet management |
| `/op/buses/[id]` | Bus detail/edit |
| `/op/bookings` | Booking history |
| `/op/bookings/[id]` | Booking detail |
| `/op/manifest` | Manifest list |
| `/op/manifest/[tripId]` | Passenger checklist |
| `/op/money` | Wallet/payouts |
| `/op/charter` | Charter requests |
| `/op/staff` | Staff provisioning |
| `/op/profile` | Operator profile |
| `/op/settings` | Settings |
| `/op/kyb` | KYB verification |
| `/op/activity` | Activity feed |
| `/op/pickup-areas` | Pickup/dropoff points |
<!-- Phase 2 (deferred): trigger = 4 operators onboarded -->
| `/op/trip-templates` | Trip template library |
| `/op/upcoming` | All upcoming trips |
| `/op/status` | Operator status |
| `/op/reports` | Reports hub |
| `/op/reports/overview` | KPI dashboard |
| `/op/reports/revenue` | Revenue report |
| `/op/reports/payouts` | Payout report |

## Admin Pages (`app/admin/`)

| Route | Description |
|-------|-------------|
| `/admin/login` | Admin login (TOTP-gated) |
| `/admin/` | Dashboard |
| `/admin/users` | User management |
| `/admin/users/[kind]/[id]` | User detail (customer/operator/admin) |
| `/admin/operators` | Operator list |
| `/admin/operators/[id]` | Operator detail |
| `/admin/approvals` | KYB approvals |
| `/admin/charter` | Charter moderation |
| `/admin/finance` | Financial controls |
| `/admin/moderation` | Content moderation |
| `/admin/system` | System settings |

## Utility Pages

| Route | Description |
|-------|-------------|
| `/dev/stub-pay` | Dev payment stub gateway |
| `/verify/[token]` | Email verification |
| `/privacy` | Privacy policy |
| `/terms` | Terms of service |

## Error Pages

`app/not-found.tsx` (404) · `app/error.tsx` (runtime) · `app/global-error.tsx` (root boundary)
