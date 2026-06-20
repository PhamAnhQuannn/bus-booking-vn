# DS-046 FD-029: Notification & Real-Time UX

## 1. Overview

This spec defines the in-app notification system, operator notification center, real-time update strategy, and the integration touchpoints with external notification channels (SMS, ZNS, email). The platform follows a cron-driven outbox pattern for all notifications --- no WebSocket or SSE in v1. Real-time feel is achieved through polling and optimistic UI where appropriate.

---

## 2. Toast Notification System

### 2.1 Toast Types

| Type | Color | Icon | Auto-Dismiss | ARIA Role |
|------|-------|------|--------------|-----------|
| Success | Green (`text-green-600`, `bg-green-50`) | `CheckCircle` | 4 seconds | `role="status"` |
| Error | Red (`text-red-600`, `bg-red-50`) | `XCircle` | 8 seconds | `role="alert"` |
| Warning | Amber (`text-amber-600`, `bg-amber-50`) | `AlertTriangle` | 8 seconds | `role="alert"` |
| Info | Blue (`text-blue-600`, `bg-blue-50`) | `Info` | 4 seconds | `role="status"` |
| Action Required | Orange (`text-orange-600`, `bg-orange-50`) | `Bell` | Persistent (manual dismiss) | `role="alert"` |

### 2.2 Positioning

| Viewport | Position | Width |
|----------|----------|-------|
| Desktop (>= 768px) | Top-right, 16px from edges | 360px fixed |
| Mobile (< 768px) | Top-center, 8px from top | Full width minus 16px padding |

### 2.3 Animation

| Transition | Desktop | Mobile |
|------------|---------|--------|
| Enter | Slide-in from right (200ms ease-out) | Slide-down from top (200ms ease-out) |
| Exit | Fade-out (150ms ease-in) | Fade-out (150ms ease-in) |
| Stacking | New toast pushes stack down | New toast pushes stack down |

### 2.4 Stack Management

| Rule | Value |
|------|-------|
| Max visible | 3 toasts simultaneously |
| Overflow behavior | Oldest toast auto-dismissed when 4th arrives |
| Dismiss interaction | Click X button or swipe right (mobile) |
| Pause on hover | Desktop: auto-dismiss timer pauses on hover |

### 2.5 Toast Content Structure

```
+------------------------------------------+
| [Icon]  Title text (bold)           [X]  |
|         Description text (optional)      |
|         [Action button] (optional)       |
+------------------------------------------+
```

- Title: `text-sm font-semibold`, max 1 line
- Description: `text-sm text-muted-foreground`, max 2 lines
- Action button: `text-sm font-medium text-primary`, optional CTA (e.g., "Xem chi tiet")

### 2.6 Common Toast Messages

| Trigger | Type | Title (VI) | Description (VI) |
|---------|------|-----------|-------------------|
| Booking created | Success | Dat ve thanh cong | Ma dat ve: {bookingRef} |
| Payment failed | Error | Thanh toan that bai | Vui long thu lai hoac chon phuong thuc khac |
| Hold expiring | Warning | Giu cho sap het han | Con {minutes} phut de hoan tat thanh toan |
| Trip cancelled | Error | Chuyen da bi huy | Tien se duoc hoan trong 3-5 ngay lam viec |
| Withdrawal requested | Success | Yeu cau rut tien da ghi nhan | Thoi gian xu ly: 1-3 ngay lam viec |
| Payout failed | Error | Chuyen tien that bai | Kiem tra thong tin tai khoan ngan hang |
| Check-in success | Success | Da xac nhan len xe | {passengerName} |
| Profile saved | Success | Da luu thong tin | --- |
| CSV exported | Info | Dang tai xuong | {filename} |

---

## 3. Operator Notification Center

### 3.1 Bell Icon & Badge

Located in the `ConsoleHeader` component (top-right, next to user avatar):

| Element | Spec |
|---------|------|
| Icon | `Bell` from lucide-react, 20px |
| Badge | Red circle with white count, `text-xs font-bold`. Hidden when count = 0 |
| Count source | Server query: `NotificationLog` rows where `recipientType = 'operator'` AND `readAt IS NULL` for this operator |
| Max display | "99+" when count > 99 |

### 3.2 Dropdown Panel

Click/tap on bell opens a dropdown panel:

```
+------------------------------------------+
|  Thong bao                    Danh dau da doc |
+------------------------------------------+
|  [BookingIcon] Dat ve moi #BB-2026-...   |
|  Tuyen HCM - Da Lat | 5 phut truoc      |
|  ----------------------------------------|
|  [AlertIcon] Chuyen da huy               |
|  HN - HP 14:00 | 2 gio truoc            |
|  ----------------------------------------|
|  [WalletIcon] Thanh toan da xu ly        |
|  450.000 d | Hom qua                     |
+------------------------------------------+
|  Xem tat ca thong bao ->                 |
+------------------------------------------+
```

### 3.3 Notification Item Structure

| Element | Spec |
|---------|------|
| Icon | Category-specific (see Section 3.4) |
| Title | `text-sm font-medium`. Bold if unread |
| Subtitle | Route or amount detail, `text-xs text-muted-foreground` |
| Timestamp | Relative: "5 phut truoc", "2 gio truoc", "Hom qua", then `dd/MM` |
| Read indicator | Blue dot (8px) on left edge for unread items |
| Tap action | Navigate to deep-link target (see Section 3.4) |

### 3.4 Notification Types

| Type | Icon | Title Template (VI) | Deep Link |
|------|------|-------------------|-----------|
| New booking | `Ticket` (green) | Dat ve moi #{bookingRef} | `/op/bookings/{id}` |
| Trip cancelled (by system/admin) | `XCircle` (red) | Chuyen da bi huy | `/op/trips/{id}` |
| Payout processed | `Wallet` (green) | Thanh toan da xu ly: {amount} d | `/op/money` |
| Payout failed | `Wallet` (red) | Chuyen tien that bai | `/op/money` |
| KYB status change | `ShieldCheck` (blue) | Cap nhat trang thai xac minh | `/op/settings` |
| System alert | `AlertTriangle` (amber) | Thong bao he thong | `/op/activity` |
| License expiry warning | `ShieldAlert` (amber) | Giay phep sap het han | `/op/settings` |

### 3.5 Full Notification Page (`/op/activity`)

Scrollable list of all notifications grouped by date:

```
Hom nay
  [notification items...]

Hom qua
  [notification items...]

15/06/2026
  [notification items...]
```

- Pagination: infinite scroll (load 20 per page)
- "Danh dau tat ca da doc" (Mark all as read) button at top
- Filter tabs: "Tat ca" / "Chua doc" (All / Unread)

---

## 4. Real-Time Update Strategy

### 4.1 No WebSocket/SSE in v1

The platform uses polling for real-time feel. Rationale: target users are on 3G/4G mobile connections where persistent connections are unreliable, and the operational benefit does not justify the infrastructure complexity in v1.

### 4.2 Polling Intervals

| Surface | Endpoint | Interval | Trigger |
|---------|----------|----------|---------|
| Operator dashboard | `/api/op/dashboard/stats` | 60 seconds | `setInterval` in client component |
| Notification badge count | `/api/op/notifications/count` | 60 seconds | Shared with dashboard poll |
| Payment status (customer) | `/api/payments/status/{id}` | 2 seconds | Active only during payment flow (see FD-016) |
| Manifest (conductor) | Manual refresh | On-demand | "Lam moi" button, not auto-poll |

### 4.3 Polling Implementation

```typescript
// Dashboard polling pattern
useEffect(() => {
  const interval = setInterval(async () => {
    const res = await fetch('/api/op/dashboard/stats', {
      headers: { 'X-CSRF-Token': readCsrfToken() ?? '' },
    });
    if (res.ok) {
      const data = await res.json();
      setStats(data);
    }
  }, 60_000);

  return () => clearInterval(interval);
}, []);
```

### 4.4 Polling Optimization

| Optimization | Implementation |
|-------------|---------------|
| Visibility-gated | Pause polling when `document.hidden === true` (tab not visible) |
| Network-aware | Reduce frequency to 120s when `navigator.connection?.effectiveType === '2g'` |
| Error backoff | On fetch error, double interval (max 300s). Reset on success |
| Conditional fetch | `If-None-Match` / `ETag` to avoid re-rendering unchanged data |

---

## 5. SMS / ZNS Notification Triggers

These notifications are dispatched server-side via the cron-driven outbox. The UI does not control delivery but references these for user expectation setting.

### 5.1 Customer-Facing Notifications

| Template | Trigger | Channel Priority | Timing |
|----------|---------|-----------------|--------|
| Booking confirmation | Payment webhook confirms `paid` | ZNS -> SMS fallback | Within 60s (via `after()`) |
| Departure reminder | Cron sweep | ZNS -> SMS fallback | 24 hours before departure |
| Trip delay/cancellation | Operator cancels trip | SMS (immediate via `after()`) | Within 60s |
| Refund processed | Refund completed | SMS | Within dispatch cycle |

### 5.2 Operator-Facing Notifications

| Template | Trigger | Channel | Timing |
|----------|---------|---------|--------|
| New booking | Payment confirms | SMS | Within 60s (via `after()`) |
| Payout scheduled | Trip marked completed | SMS | Within dispatch cycle |
| Payout processed | Payout `status = 'paid'` | SMS | Within dispatch cycle |
| KYB status change | Admin action | SMS + email | Within dispatch cycle |
| License expiry warning | Daily cron | SMS | 60 days before expiry |

### 5.3 Channel Waterfall

```
Attempt ZNS delivery
  |-- Success -> Done
  |-- Failure -> Wait 60 seconds
                  |-- Retry SMS
                      |-- Success -> Done
                      |-- Failure -> Retry with backoff (attemptCount + nextAttemptAt)
```

ZNS (Zalo Notification Service) reaches ~75M MAU in Vietnam. SMS via eSMS.vn is the fallback with 95-99% delivery rate for Vietnamese numbers. Foreign providers (Twilio, AWS SNS) achieve only 60-80% delivery to Vietnam.

---

## 6. Zalo OA Integration (Placeholder)

### 6.1 Post-Booking Prompt

After booking confirmation, show a non-blocking banner:

```
+--------------------------------------------------+
| [Zalo icon]  Theo doi chung toi tren Zalo         |
|              Nhan thong bao chuyen di qua Zalo    |
|              [Mo Zalo]                       [X]  |
+--------------------------------------------------+
```

- Position: below booking confirmation content
- Deep link: `https://zalo.me/{ZALO_OA_ID}`
- Dismiss: X button, remembered via `localStorage` (don't show again for 30 days)
- Not a toast --- inline content block

### 6.2 Zalo OA Capabilities (Future)

| Capability | Status | Notes |
|------------|--------|-------|
| ZNS transactional messages | Planned (v1 channel) | Requires Zalo OA verification |
| Zalo Mini App | Future | Low-data-footprint booking for students/budget users |
| Customer support chat | Future | Zalo OA as support channel per Consumer Protection Law |

---

## 7. Accessibility

### 7.1 Toast Accessibility

| Requirement | Implementation |
|------------|---------------|
| Screen reader announcement | `role="status"` (success/info), `role="alert"` (error/warning) |
| Focus management | Toast does not steal focus from current interaction |
| Keyboard dismiss | `Escape` key dismisses the topmost toast |
| Reduced motion | Disable slide/fade animations when `prefers-reduced-motion: reduce` |
| Color independence | Icon shape + text label distinguish types (not color alone) |

### 7.2 Notification Center Accessibility

| Requirement | Implementation |
|------------|---------------|
| Bell button | `aria-label="Thong bao"`, `aria-expanded` tracks dropdown state |
| Badge count | `aria-label="X thong bao chua doc"` on the badge |
| Dropdown | `role="menu"`, items are `role="menuitem"` with `aria-current` for unread |
| Mark all read | `aria-label="Danh dau tat ca da doc"` |

---

## 8. Responsive Behavior

| Component | Mobile (< 768px) | Desktop (>= 768px) |
|-----------|-----------------|---------------------|
| Toast stack | Top-center, full-width | Top-right, 360px |
| Bell dropdown | Full-screen overlay | 400px dropdown anchored to bell |
| Notification page | Full-width list, bottom nav | Sidebar layout, scrollable list |
| Zalo prompt | Full-width banner below content | Inline card, max 500px |

---

## 9. Cross-References

| Reference | Relevance |
|-----------|-----------|
| ADR-013 Notification Architecture | Cron outbox pattern, ZNS/SMS channel priority, PII handling (I9), retry strategy |
| Customer Personas | Channel preferences: ZNS primary, SMS secondary, email tertiary. Ba Hoa needs SMS with operator name |
| Operator Personas: Micro | Zalo-based support, zero tech literacy, SMS-first notifications |
| DS-018 FD-001 Design System | Color tokens for toast types, icon set, animation patterns |
| DS-024 FD-007 Responsive/Mobile | Toast positioning by viewport, dropdown overlay pattern |
| DS-044 FD-027 Performance Budget | Polling impact on battery/data; visibility-gated optimization |
| DS-045 FD-028 Portal Architecture | `'use client'` for polling; deep-import `csrfClient` for fetch headers |
| Bounded Contexts: Notification | `NotificationLog` model, `dispatchNotifications` cron, `attemptCount` retry |
| ADR-012 Background Jobs | `notificationDispatch` every 1 min, `after()` acceleration for latency-sensitive |
