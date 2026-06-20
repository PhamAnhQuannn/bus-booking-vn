# DS-031 Hold Timer & Seat Selection

Frontend UX specification for the 10-minute hold countdown, seat reservation feedback, hold creation errors, and expiry handling.

---

## 1. Hold Creation

### 1.1 API Call

| Property | Value |
|----------|-------|
| Endpoint | `POST /api/holds` |
| Auth | Phone number (guest) or authenticated customer session |
| CSRF | `X-CSRF-Token` header from `bb_csrf` cookie (via `readCsrfToken()` from `@/lib/auth/csrfClient`) |
| Request body | `{ tripId, ticketCount, phone, pickupKind, pickupPlaceId?, pickupDetail? }` |
| Response | `{ holdId, expiresAt, tripSummary }` + `bb_hold` cookie set |

### 1.2 Hold Creation UX Flow

```
Trip card [Dat ve] click
  |
  +-> Phone entry (if guest, no session)
  |     |-> Validate phone format
  |     |-> Submit phone with hold request
  |
  +-> POST /api/holds
  |     |-> Success: redirect to /booking/review with hold cookie
  |     |-> Error: display error (see section 4)
  |
  +-> Hold Timer starts (derived from expiresAt)
```

### 1.3 Pickup Selection (Pre-Hold)

| `PickupKind` | Vietnamese Label | UI |
|--------------|------------------|-----|
| `station` | "Ben xe" | Default option. No additional input required |
| `point` | "Diem don" | Select from `OperatorPickupArea` dropdown for the route |
| `custom` | "Dia chi khac" | Free-text input, min 5 chars. "Nha xe se lien he xac nhan dia chi don." |

---

## 2. Countdown Component

### 2.1 Component: `HoldTimer`

| Property | Specification |
|----------|---------------|
| Source file | `components/HoldTimer.tsx` |
| Time source | `expiresAt` from `bb_hold` cookie or hold API response |
| Format | `MM:SS` (e.g., `09:47`) |
| Update frequency | Every 1 second via `setInterval` |
| Position | Fixed/sticky at top of booking review page |

### 2.2 Color Transitions

| Time remaining | Color | Tailwind class | Behavior |
|----------------|-------|----------------|----------|
| > 5 min | Green | `text-green-600` | Normal display |
| 2-5 min | Amber | `text-amber-500` | Subtle pulse animation (CSS only, `motion-safe:`) |
| < 2 min | Red | `text-destructive` | Persistent red, no pulse |
| 0 | Red | `text-destructive` | Timer stops at `00:00`, expiry modal triggers |

### 2.3 Visual Layout

```
+-----------------------------------------------+
|  [Clock icon]  Thoi gian giu cho: 08:42       |
+-----------------------------------------------+
```

| Element | Detail |
|---------|--------|
| Icon | Clock icon, color matches timer text |
| Label | "Thoi gian giu cho:" (Hold time remaining:) |
| Font | Tabular numbers (`font-variant-numeric: tabular-nums`) for stable width |
| Background | Light surface color, subtle border |

### 2.4 Accessibility

| Concern | Implementation |
|---------|----------------|
| Screen reader | `aria-live="polite"` on timer container |
| Announcements | Spoken at 5 min, 2 min, 1 min, 30 sec thresholds |
| 5 min | "Con 5 phut de hoan tat thanh toan" |
| 2 min | "Con 2 phut. Vui long hoan tat thanh toan." |
| 1 min | "Con 1 phut. Cho ngoi sap het han." |
| 30 sec | "Con 30 giay. Cho ngoi se duoc nha neu khong thanh toan." |
| `role` | `role="timer"` on the countdown element |
| `aria-label` | "Thoi gian giu cho con lai" (Hold time remaining) |

---

## 3. Timer State Management

### 3.1 Store: `useHoldTimerStore` (Zustand)

| Property | Type | Detail |
|----------|------|--------|
| `expiresAt` | `number \| null` | Unix timestamp from hold API response |
| `isExpired` | `boolean` | Derived: `Date.now() >= expiresAt` |
| `remainingMs` | `number` | Derived: `Math.max(0, expiresAt - Date.now())` |
| Persistence | None | Derived from `expiresAt` cookie value on mount. No `localStorage` |

### 3.2 Hydration

| Step | Detail |
|------|--------|
| 1 | Component mounts, reads `bb_hold` cookie for `expiresAt` |
| 2 | Sets `expiresAt` in store |
| 3 | `setInterval(1000)` updates derived `remainingMs` |
| 4 | On `remainingMs === 0`, sets `isExpired = true` |

### 3.3 Page Navigation During Hold

| Scenario | Behavior |
|----------|----------|
| User navigates back from review | Timer continues (cookie persists). Warning: "Cho cua ban van dang duoc giu. Quay lai de hoan tat dat ve." |
| User closes tab | Hold lives server-side until TTL expires. No client-side cleanup |
| User refreshes page | Timer re-derives from `bb_hold` cookie (no state loss) |
| `bb_hold` cookie missing | Timer shows expired state, redirect to search |

---

## 4. Hold Creation Errors

### 4.1 Error Handling

| Error Code | HTTP | Vietnamese Message | UX |
|------------|------|--------------------|----|
| `insufficient_capacity` | 422 | "Xin loi, khong du cho cho {n} ve. Chi con {available} cho." | Toast notification, stay on search page |
| `sales_closed` | 422 | "Chuyen xe nay da ngung ban ve." | Toast, disable CTA on card |
| `trip_cancelled` | 422 | "Chuyen xe nay da bi huy." | Toast, remove card from results or grey out |
| `operator_suspended` | 422 | "Nha xe tam ngung hoat dong." | Toast, hide card |
| `hold_cap_exceeded` | 422 | "Ban da giu qua so cho cho phep. Vui long hoan tat hoac huy dat cho hien tai." | Modal with link to current holds |
| `rate_limited` | 429 | "Vui long thu lai sau {n} giay." | Toast with countdown |
| `maintenance_conflict` | 422 | "Xe dang bao tri. Vui long chon chuyen khac." | Toast, grey out card |

### 4.2 Per-Phone Hold Cap

| Element | Detail |
|---------|--------|
| Cap | `CONCURRENT_HOLD_CAP` (3-5 simultaneous active holds per phone) |
| Error display | Modal: "Ban da giu qua so cho cho phep" |
| Explanation | "Ban dang giu {n} cho tren cac chuyen khac. Hoan tat thanh toan hoac huy dat cho de giu them." |
| Actions | "Xem cac dat cho hien tai" (View current holds), "Dong" (Close) |

---

## 5. Expiry Handling

### 5.1 Component: `HoldExpiryModal`

| Property | Specification |
|----------|---------------|
| Source file | `components/HoldExpiryModal.tsx` |
| Trigger | `useHoldTimerStore.isExpired === true` |
| Dismissibility | Non-dismissible -- no close button, no click-outside, no Escape key |
| Display | Immediate show (no animation transition) |
| z-index | Above all other content |

### 5.2 Modal Content

```
+--------------------------------------------------+
|                                                  |
|     [Clock icon - red]                           |
|                                                  |
|     Thoi gian giu cho da het                     |
|                                                  |
|     Cho ngoi cua ban da duoc nha.                |
|     Vui long tim chuyen xe khac.                 |
|                                                  |
|     [Tim chuyen khac]                            |
|                                                  |
+--------------------------------------------------+
```

| Element | Detail |
|---------|--------|
| Heading | "Thoi gian giu cho da het" (Hold time has expired) |
| Body text | "Cho ngoi cua ban da duoc nha. Vui long tim chuyen xe khac." (Your seat has been released. Please search for another trip.) |
| CTA | "Tim chuyen khac" (Search for another trip) -- navigates to search page with previous search params pre-filled |
| Icon | Red clock icon |

### 5.3 Hold Cancelled by Trip Cancellation

| Trigger | Operator cancels trip while customer has active hold |
|---------|------|
| Detection | Hold status changes to `cancelled_trip` (detected on next API call or via polling) |
| UX | Toast notification: "Chuyen xe da bi huy boi nha xe. Cho ngoi cua ban da duoc huy." |
| Action | Auto-redirect to search page after 5 seconds |
| Toast variant | Destructive (red) |

---

## 6. UI State During Active Hold

### 6.1 Booking Review Page

| Element | State |
|---------|-------|
| Back button | Visible but shows confirmation dialog: "Ban co chac muon roi khoi trang nay? Cho ngoi van duoc giu trong {MM:SS}." |
| Browser back | `beforeunload` event shows browser confirmation (best-effort, not guaranteed) |
| Timer | Always visible at top of page |
| Seat reservation indicator | "Cho ngoi cua ban dang duoc giu" (Your seat is being held) with green lock icon |

### 6.2 Abandonment Prevention

| Method | Detail |
|--------|--------|
| Navigation warning | Confirmation dialog on route change during active hold |
| Visual emphasis | Timer uses attention-grabbing color transitions |
| Clear messaging | "Cho ngoi se duoc nha neu khong thanh toan truoc khi het han" (Seat will be released if not paid before expiry) |

---

## 7. Timing Constants

| Constant | Value | Rationale |
|----------|-------|-----------|
| `HOLD_TTL_MINUTES` | 10 | Calibrated against MoMo payment flow (worst case 3-4 min) + 6 min slack |
| Timer update interval | 1 second | Human-readable countdown precision |
| Announcement thresholds | 5m, 2m, 1m, 30s | Progressive urgency for screen readers |
| Color: green -> amber | 5 min remaining | Early warning without causing panic |
| Color: amber -> red | 2 min remaining | Urgency signal aligned with `text-destructive` |
| Post-expiry redirect delay | Immediate (on CTA click) | User-initiated navigation only |

---

## 8. Performance

| Concern | Implementation |
|---------|----------------|
| Timer rendering | `setInterval(1000)` -- minimal DOM updates (text content only) |
| No animation library | CSS-only pulse for amber state (`motion-safe:` guard) |
| No persistence | Timer state derived from cookie, not synced to `localStorage` |
| Cleanup | `clearInterval` on unmount |
| No polling | Hold status not polled from server during countdown (server-side expiry handles cleanup) |

---

## Cross-References

| Document | Relevance |
|----------|-----------|
| [ADR-009 Concurrency & Seat Holding](../../architecture-decisions/ADR-009-concurrency-seat-holding/) | Advisory locks, conditional INSERT, hold TTL, three-layer capacity guard |
| [ADR-002 NFR Targets](../../architecture-decisions/ADR-002-nfr-targets/) | Hold creation p95 <= 200ms, 10-min TTL rationale, PSP_WINDOW_MINUTES |
| [FD-005 Motion & Interaction](../FD-005-motion-interaction/) | HoldTimer color shift, HoldExpiryModal non-dismissible pattern, CSS-only animation |
| [FD-009 State Management](../FD-009-state-management/) | `useHoldTimerStore` Zustand store, no persistence strategy |
| [FD-010 Error & Loading States](../FD-010-error-loading-states/) | Toast notifications, error boundaries |
| [Business: Ubiquitous Language](../../business/domain-model/ubiquitous-language.md) | Hold, CONCURRENT_HOLD_CAP, PSP Window definitions |
| [Business: State Machines](../../business/domain-model/state-machines.md) | Hold lifecycle: active -> consumed / expired / cancelled_trip |
