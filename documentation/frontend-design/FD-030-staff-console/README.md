# DS-047 FD-030: Staff & Conductor Console

## 1. Overview

Staff and conductors are field-level operator personnel with the `OperatorRole = 'staff'` RBAC designation. They access the same `/op/` portal as operator admins but see a restricted view: today's assigned trips, passenger manifests, and trip status actions only. No financial data, fleet management, or settings are accessible. The UI is optimized for mobile field conditions --- large touch targets, offline resilience, and minimal data transfer.

---

## 2. Staff Role & Permissions

### 2.1 RBAC Model

| Capability | Operator Admin | Staff |
|------------|---------------|-------|
| View dashboard (today's trips) | Yes | Yes (restricted view) |
| View manifest | Yes (all trips) | Yes (assigned trips) |
| Check-in passengers | Yes | Yes |
| Mark no-show | Yes | Yes |
| Mark trip departed | Yes | Yes |
| Mark trip completed | Yes | Yes |
| Create/edit trips | Yes | No |
| Manage buses/routes | Yes | No |
| View revenue/reports | Yes | No |
| Request payouts | Yes | No |
| Manage staff | Yes | No |
| Change settings/profile | Yes | No |
| View payout history | Yes | No |
| Export data | Yes | No |

### 2.2 Assignment Model

In v1, each staff member (`OperatorUser` with `role = 'staff'`) has an `assignedTripId` field linking them to a single trip. This is the trip they are responsible for (conductor role). The assignment is set by the operator admin.

- `assignedTripId = null`: Staff sees all of today's trips for their operator (general staff)
- `assignedTripId = {tripId}`: Staff sees only the assigned trip (dedicated conductor)

---

## 3. Staff Login

### 3.1 Login Flow

Staff use the same `/op/login` flow as operator admins:
1. Phone number input (+84 format)
2. OTP verification (6-digit code via SMS)
3. First-login password change (if `requiresPasswordChange = true`)
4. Redirect to `/op/dashboard`

### 3.2 Role-Based Navigation Filtering

After login, the console shell calls `visibleNavItems(role)` to determine which navigation items to render:

| Nav Item | Label (VI) | Admin | Staff |
|----------|-----------|-------|-------|
| Dashboard | Tong quan | Visible | Visible |
| Buses | Xe khach | Visible | Hidden |
| Routes | Tuyen duong | Visible | Hidden |
| Trips | Chuyen di | Visible | Hidden |
| Bookings | Dat ve | Visible | Hidden |
| Money | Tai chinh | Visible | Hidden |
| Revenue | Doanh thu | Visible | Hidden |
| Activity | Thong bao | Visible | Visible |
| Settings | Cai dat | Visible | Hidden |
| Profile | Ho so | Visible | Hidden |
| Staff | Nhan vien | Visible | Hidden |

### 3.3 Visual Differentiation

Staff sees the same operator console shell (sidebar on desktop, bottom nav on mobile) but with hidden nav items. The remaining items are:

- **Mobile bottom nav**: 3 items only --- Tong quan (Dashboard), Thong bao (Activity), Dang xuat (Logout)
- **Desktop sidebar**: Same 3 items, with greyed-out section headers for hidden areas (not clickable, `text-muted-foreground/50 cursor-default`)

No "Staff mode" banner or visual label --- the restricted nav IS the differentiation.

---

## 4. Staff Dashboard (`/op/dashboard` --- Staff View)

### 4.1 Content Differences from Admin Dashboard

| Element | Admin View | Staff View |
|---------|-----------|------------|
| Stat cards | 4 cards (trips, bookings, unviewed, balance) | None |
| Revenue data | Shown | Hidden |
| Available balance | Shown | Hidden |
| Quick actions | Create trip, View bookings, Withdraw | None |
| Onboarding checklist | Shown (if new) | Never shown |
| Today's departures | All trips | Assigned trip only (or all if `assignedTripId` is null) |

### 4.2 Trip Cards (Staff View)

Each trip renders as a card optimized for field scanning:

```
+--------------------------------------------------+
|  HCM - Da Lat                                     |
|  [BusIcon] 51B-12345                              |
|  [ClockIcon] 14:00  |  [UsersIcon] 32/40 ghe     |
|  [StatusBadge] Len lich                           |
|  ------------------------------------------------|
|  [Tap to open manifest ->]                        |
+--------------------------------------------------+
```

| Field | Label (VI) | Source |
|-------|-----------|--------|
| Route | `{origin} - {destination}` | Trip -> Route |
| Bus plate | Bien so xe | Trip -> Bus.plateNumber |
| Departure time | Gio khoi hanh | `HH:mm` in `Asia/Ho_Chi_Minh` |
| Seats | Ghe | `{booked}/{total}` |
| Status | Trang thai | Badge: `Len lich` / `Da khoi hanh` / `Hoan thanh` / `Da huy` |

Tap on card navigates to `/op/manifest/{tripId}`.

---

## 5. Manifest View (`/op/manifest/[tripId]`)

### 5.1 Design Principles

The manifest is conductor-optimized for field conditions:
- **Large touch targets**: 56px minimum row height (for gloved operation or rough road conditions)
- **High contrast**: Black text on white background, no subtle grays
- **Minimal data per row**: Name + pickup + payment status only
- **Offline resilient**: Cached in `sessionStorage` after first fetch

### 5.2 Manifest Header

```
+--------------------------------------------------+
|  HCM - Da Lat | 14:00 | 51B-12345                |
|  [ProgressBar] 28/40 da len xe                    |
|  [Lam moi]                          [Tai PDF]    |
+--------------------------------------------------+
```

| Element | Spec |
|---------|------|
| Route + time + plate | Single-line header, `text-lg font-semibold` |
| Boarding counter | `{checkedIn}/{total} da len xe` with progress bar (green fill) |
| Refresh button | "Lam moi" --- manual refresh, no auto-poll (3G field conditions) |
| PDF download | "Tai PDF" --- generates A4 printable manifest |

### 5.3 Passenger List

| Column | Content | Width | Interaction |
|--------|---------|-------|-------------|
| Status | Check-in icon (see below) | 48px | Tap to check-in |
| Name | Passenger name | Flex | --- |
| Pickup | Pickup point name | 120px | Truncated with tooltip |
| Payment | Badge: paid/cash | 64px | --- |

### 5.4 Check-In Interaction

| State | Icon | Color | Interaction |
|-------|------|-------|-------------|
| Not checked in | `Circle` (empty) | Gray | Tap -> check-in |
| Checked in | `CheckCircle` (filled) | Green | No action (irreversible) |
| No-show | `XCircle` (filled) | Red | --- |

**Check-in tap flow**:
1. Tap empty circle
2. Immediate optimistic UI: circle turns green with `CheckCircle`
3. Background `POST /api/op/manifest/{tripId}/checkin` with `bookingId`
4. Atomic conditional update: `UPDATE ... SET checkedInAt = now() WHERE id = ? AND checkedInAt IS NULL`
5. If conflict (already checked in by another staff): no error, state already correct
6. If network error: revert to empty circle, show toast "Khong the xac nhan. Thu lai."

**No-show (long-press) flow**:
1. Long-press (500ms) on an unchecked passenger row
2. Confirmation dialog:
   > **Danh dau khach vang mat?**
   >
   > {passengerName} - {pickupPoint}
   >
   > [Xac nhan] [Huy]
3. On confirm: `POST /api/op/manifest/{tripId}/no-show` with `bookingId`
4. Row shows `XCircle` (red) with strikethrough on name

### 5.5 Payment Status Badges

| Status | Badge Text (VI) | Color | Meaning |
|--------|----------------|-------|---------|
| Paid (online) | Da TT | Green pill | MoMo/VNPay/bank transfer paid |
| Cash | Tien mat | Amber pill | Pay on board |

### 5.6 Boarding Counter

The counter at the top of the manifest updates in real-time as passengers are checked in:

```
28/40 da len xe
[========================================--------]
```

- Fraction: `{checkedInCount}/{totalBookings}`
- Progress bar: `w-full h-2 bg-muted` with `bg-green-500` fill
- Counter uses `aria-live="polite"` for screen reader updates

### 5.7 PDF Download

Button: "Tai PDF" generates a server-side A4 PDF manifest for no-connectivity scenarios.

PDF content:
- Header: route, date, time, bus plate
- Table: passenger name, phone (last 4 digits), pickup point, payment status, check-in column (empty boxes for manual marking)
- Footer: total passengers, boarding instructions

File name: `manifest_{route}_{date}_{time}.pdf`

### 5.8 Offline Resilience

| Strategy | Implementation |
|----------|---------------|
| Cache manifest data | `sessionStorage.setItem('manifest_{tripId}', JSON.stringify(data))` after first successful fetch |
| Serve from cache | On fetch failure (network error), read from `sessionStorage` and show banner: "Du lieu ngoai tuyen --- co the khong cap nhat" |
| Check-in queue | Failed check-in requests queued in `sessionStorage`, retried on next successful fetch |
| PDF fallback | Downloaded PDF works fully offline as printed document |

---

## 6. Trip Actions (Staff-Accessible)

### 6.1 Mark Departed

| Element | Spec |
|---------|------|
| Button | "Xe da khoi hanh" --- orange primary, full-width on mobile |
| Visibility | Only when `trip.status === 'scheduled'` |
| Confirmation dialog | "Xac nhan xe da khoi hanh? Hanh khach se khong the dat ve them." |
| Side effects | Sets `departedAt`, forces `salesClosed = true`, blocks further bookings |
| Success toast | "Da xac nhan khoi hanh" |

### 6.2 Mark Completed

| Element | Spec |
|---------|------|
| Button | "Hoan thanh chuyen" --- green, full-width on mobile |
| Visibility | Only when `trip.status === 'departed'` |
| Confirmation dialog | "Xac nhan chuyen da hoan thanh?" |
| Side effects | Sets `completedAt`, creates Payout row, enqueues `payout_scheduled` notification |
| Success toast | "Chuyen da hoan thanh" |

### 6.3 Action Button Placement

On the manifest page, trip action buttons appear at the bottom of the screen in a sticky footer:

```
+--------------------------------------------------+
| [Passenger list scrolls above]                    |
+--------------------------------------------------+
| [Xe da khoi hanh]  (or)  [Hoan thanh chuyen]     |
+--------------------------------------------------+
```

Only one action button is visible at a time, based on current trip status:
- `scheduled` -> "Xe da khoi hanh"
- `departed` -> "Hoan thanh chuyen"
- `completed` or `cancelled` -> No action button

---

## 7. Staff Restrictions --- Enforced at UI and API Level

### 7.1 Navigation Hiding

Staff-restricted routes return the console layout with no content and a redirect to `/op/dashboard` if accessed directly via URL. The middleware checks `role === 'staff'` and redirects.

Protected routes for staff:

| Route Pattern | Restriction |
|---------------|-------------|
| `/op/buses/**` | Redirect to dashboard |
| `/op/routes/**` | Redirect to dashboard |
| `/op/trips/new` | Redirect to dashboard |
| `/op/trips/[id]/edit` | Redirect to dashboard |
| `/op/money/**` | Redirect to dashboard |
| `/op/reports/**` | Redirect to dashboard |
| `/op/settings` | Redirect to dashboard |
| `/op/profile` | Redirect to dashboard |
| `/op/staff` | Redirect to dashboard |

### 7.2 API-Level Guards

All operator API routes check `role` from the JWT. Staff-restricted endpoints return `403 Forbidden`:

```json
{
  "error": "forbidden",
  "message": "Khong co quyen truy cap"
}
```

---

## 8. Responsive Behavior

The staff console is mobile-first --- conductors use personal phones in the field.

| Viewport | Dashboard | Manifest |
|----------|-----------|----------|
| Mobile (< 768px) | Full-width trip cards, bottom nav (3 items) | Full-width passenger list, sticky bottom action button, 56px rows |
| Tablet (768-1023px) | 2-column trip card grid, sidebar nav | Same as mobile but with wider rows |
| Desktop (1024px+) | 2-column grid, sidebar nav | Table layout with all columns visible, action button inline |

### 8.1 Touch Target Sizes

| Element | Minimum Size | Rationale |
|---------|-------------|-----------|
| Check-in circle | 48x48px | Tap accuracy on moving vehicle |
| Passenger row | Full-width x 56px height | Gloved operation, rough road |
| Action buttons | Full-width x 48px height | Primary CTA, bottom of screen |
| Refresh button | 44x44px | Standard touch target |

---

## 9. Accessibility

| Requirement | Implementation |
|------------|---------------|
| Check-in state | `aria-label="Xac nhan len xe cho {name}"` (unchecked) / `aria-label="{name} da len xe"` (checked) |
| No-show state | `aria-label="{name} vang mat"` |
| Boarding counter | `aria-live="polite"` announces count changes |
| Trip action buttons | `aria-describedby` linking to confirmation text |
| Offline banner | `role="alert"` with `aria-live="assertive"` |
| Payment badge | Color + text label (not color-only differentiation) |

---

## 10. Cross-References

| Reference | Relevance |
|-----------|-----------|
| Operator Personas: Micro | Paper manifests today; staff tech literacy is very low |
| Operator Personas: Cooperative | Paper manifests; transparent per-member payouts |
| Bounded Contexts: Auth | `OperatorRole` enum (`admin` / `staff`), `assignedTripId`, `requireOperatorAuth` guard |
| Bounded Contexts: Booking | `checkIn.ts` atomic conditional update, `bookingRef` format |
| Bounded Contexts: Fleet/Catalog | Trip state machine: `scheduled` -> `departed` -> `completed` |
| DS-041 FD-024 Operator Dashboard | Admin dashboard (staff sees restricted subset) |
| DS-044 FD-027 Performance Budget | Target device (Samsung A14), 4G connection, touch target 44px minimum |
| DS-045 FD-028 Portal Architecture | Role-based nav filtering, JWT claims (`role`, `assignedTripId`) |
| DS-046 FD-029 Notifications | Activity page shared between admin and staff roles |
| Stakeholder Map | Drivers as "last-mile trust point"; QR scanner must work offline/3G |
| ADR-012 Background Jobs | `autoCompleteTrips` cron as fallback for missed `markCompleted` |
