> ← [Previous](../00-problem-statement/) | [Index](../README.md) | [Next →](../02-requirements-nonfunctional/)

## 1. Functional Requirements

Functional requirements define **what the system does** — the capabilities each user type needs.

### 1.1 Three Actor Groups

| Actor | Role | Key Actions |
|-------|------|-------------|
| **Customer** | Traveler buying tickets | Search trips, hold seats, pay online, receive ticket (QR + PDF), check booking status |
| **Operator** | Bus company selling trips | Register/apply, manage fleet (buses), create trips, view bookings/manifest, manage money (balance/payout), scan tickets at boarding |
| **Admin** | Platform staff | Approve/reject operators, oversee finance (payouts, refunds, disputes), moderate content, manage system config |

### 1.2 Customer Capabilities

- **Search**: Enter origin, destination, date, ticket count → see matching trips with operator name, departure/arrival time, duration, bus type, price, seats remaining. Filter by operator, bus type, departure window, price range. Sort by departure, price, or duration.
- **Book (Guest Checkout)**: Select a trip → seats are held with a countdown timer → enter buyer info (name, phone, email) → review → pay online → receive booking reference + ticket QR via SMS and email PDF.
- **Payment**: Online only (no cash). Supported rails: VietQR bank transfer, MoMo wallet, domestic debit card, Visa/Mastercard, PayPal. All payments in VND (Vietnamese Dong).
- **Ticket Verification**: A public page (accessible via QR scan) shows the booking as paid, with trip details and bus plate — the source of truth.
- **Account (future)**: Register/login via phone + OTP (One-Time Password — a temporary code sent to your phone to prove ownership). Past guest bookings auto-linked when registering with the same phone. Currently paused — guest-only.

> **Trade-off**: Guest checkout means no user account data — we can't build purchase history, loyalty programs, or personalized recommendations. But in Vietnam's inter-city bus market, most travelers book infrequently and on impulse. Forcing account creation before booking would kill conversion. The design choice: optimize for conversion now, add optional accounts later (and backfill past bookings by phone match).

- **Charter Request**: Request a private vehicle for a custom trip (tourism/visiting). Fill a form with pickup, destination(s), dates, passenger count, budget. An operator is matched by the admin.

### 1.3 Operator Capabilities

- **Onboarding**: Submit an application form (NOT instant account creation). Admin reviews, approves, and creates the operator's login credentials (generated username + temporary password).
- **Fleet Management**: Add/edit buses (plate number, type, capacity). Set maintenance windows (bus auto-hidden from search during maintenance).
- **Trip Management**: Create trips (route + bus + departure time + price). System blocks overlapping trips on the same bus. Cancel trips (triggers customer refund). Close sales, mark departed, mark completed.
- **Booking & Manifest**: View bookings per trip/date. See passenger manifest for each departure. Scan ticket QR at boarding to verify + check in. Mark no-shows.
- **Money**: View balance (pending / available / paid out). View ledger of all financial entries. Request payouts to registered bank account. Download payout statements.
- **Charter**: View charter requests assigned by admin. Accept/decline. Claim open public-pool requests (first-come-first-served).

### 1.4 Admin Capabilities

- **Operator Approval**: Review applications, verify documents, create operator accounts (step-up authenticated — requires re-entering 2FA), approve/reject with reason.
- **Finance** (step-up authenticated): Oversee payouts (approve/retry), view any operator's ledger, make manual adjustments (with reason), execute refunds, handle chargebacks/disputes.
- **User Management**: Search customers + operators, view details, suspend/reinstate.
- **Moderation**: Disable bad trips/routes (not edit — moderate means disable).
- **System**: Manage feature flags, payment rail toggles, admin accounts (invite-only), view audit log.
- **Charter Dispatch**: Triage incoming charter requests. Assign directly to an operator OR publish to the open pool. Reject spam. Reassign on decline/expiry.
