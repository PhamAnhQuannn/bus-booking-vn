# UI/UX Design Review
Date: 2026-06-12
Scope: All 3 portals — patterns, architecture, interaction, mobile, localization

---

## Summary

The customer booking funnel is production-grade: the flow is linear, all error states are handled with localized copy, the HoldTimer + HoldExpiryModal form a coherent anxiety-reducing pair, and trust signals are well-placed. The operator console is operationally complete but suffers from one critical mobile regression — the trips and buses tables have no horizontal scroll wrapper, so they overflow on narrow screens. The admin console is intentionally utilitarian and functional for its small internal audience; its main UX gap is that financial forms require raw internal IDs (booking/operator IDs) with no search affordance, making error-prone typed inputs the only entry path. Localization is thorough across all three portals with no English leakage found in user-facing strings.

---

## P1 — Critical UX Issues (conversion/usability blockers)

**1. Operator trips table overflows on mobile without horizontal scroll**
- File: `app/op/(console)/trips/TripsClient.tsx` line 146
- Issue: `<Card className="overflow-hidden py-0"><Table>` — the `overflow-hidden` on the Card clips the table. The table has 6 columns (ID, Khởi hành, Giá, Trạng thái, Ghế còn, Hành động) and the action column has two buttons. On a 360px phone the action buttons are unreachable.
- Impact: Operators on phones (a realistic use case in Vietnam — operators check bookings on the road) cannot cancel or toggle sales on trips.
- Fix: Replace `overflow-hidden` with `overflow-x-auto` on the Card's inner container, or wrap the Table in `<div className="overflow-x-auto">`.

**2. Bus fleet table has the same overflow problem**
- File: `app/op/(console)/buses/BusesClient.tsx` line 308
- Issue: `<Card className="overflow-hidden py-0">` around a 4-column table with a per-row expanded maintenance sub-form. The "Hành động" cell contains three buttons (Chi tiết, Bảo trì, Vô hiệu hoá). No scroll wrapper.
- Impact: "Vô hiệu hoá" (deactivate bus) is the rightmost button and will be clipped on mobile. The deactivate action is destructive and already dialog-gated — but users cannot reach the trigger to begin that flow.
- Fix: Same as above — `overflow-x-auto` on the table wrapper.

**3. Finance admin page — raw ID entry with no autocomplete**
- File: `app/admin/(console)/finance/page.tsx` lines 165–183 (ledger picker), and `FinanceActions.tsx` refund-out / chargeback forms
- Issue: The ledger operator picker is a bare text input expecting an internal `op_…` CUID. The refund-out and chargeback forms expect an internal booking ID. No search, no autocomplete, no lookup. A mistaken ID silently reaches the server (which returns a 404 or BOOKING_NOT_FOUND error). Platform-fee changes and adjustments operate on operator-balance rows the admin cannot first preview.
- Impact: High error rate for financial operations; mistyped IDs on a chargeback means money goes to the wrong account or fails silently after the step-up gate.
- Fix (P1 for the refund/chargeback path): Add a booking-ref (human-readable `BB-YYYY-xxx-xxx`) lookup before the internal-ID form. The booking-ref is already exposed on the confirmation page and in the operator booking queue.

**4. BookingSteps label labels hidden on mobile**
- File: `components/booking/BookingSteps.tsx` line 31
- Issue: `className="hidden text-sm font-medium sm:inline"` — step labels (Thông tin, Xác nhận, Thanh toán) are hidden below `sm` (640px). On a 360–479px phone the user only sees numbered circles. This is below the shadcn breakpoint so all mid-range Vietnamese phones (360–390px) see only numbers with no labels.
- Impact: Users in the middle of the funnel cannot see which step they are on in plain language.
- Fix: Show abbreviated step labels at all widths, or make the `hidden` threshold `xs:inline` (or inline at all widths with shortened text: "Thông tin → Xác nhận → Thanh toán").

---

## P2 — Should Fix Before Launch

**5. Trips table shows truncated CUID, not a human-readable identifier**
- File: `app/op/(console)/trips/TripsClient.tsx` line 162–168
- Issue: The "ID" column shows `trip.id.slice(0, 8)…` — an internal CUID fragment. Operators have no meaningful identifier to reference when calling support or matching a trip to a booking. The departure time appears in the next column, so there is enough context — but a `YYYY-MM-DD HH:mm` prefix would make the row scannable without clicking through to the detail page.
- Fix: Remove the ID column entirely and make the departure time the clickable link to the detail page, or add a computed human-readable label like "HN→SG 08:30" as the first column.

**6. HoldTimer renders `null` (disappears) when expired, leaving a gap in BookingSummaryRail**
- File: `components/HoldTimer.tsx` line 21; `components/booking/BookingSummaryRail.tsx` line 69
- Issue: `if (isExpired) return null` causes the timer to vanish from the rail silently before the `HoldExpiryModal` fires (the modal fires after the state propagates, which may take one tick). This creates a brief layout shift where the timer disappears and then the modal appears.
- Fix: Instead of returning `null` on expiry, render a static "Đã hết hạn" label — the modal will override immediately and the visual gap is eliminated. The layout shift also hurts cumulative layout shift (CLS) metrics.

**7. Operator deactivate — irreversibility warning is correct but "reactivation_not_supported" error is user-hostile**
- File: `app/op/(console)/buses/BusesClient.tsx` line 73
- Issue: The `translateError` function returns "Không hỗ trợ kích hoạt lại" for `reactivation_not_supported`. A user who somehow attempts to reactivate gets a bare error message with no path forward (no link to create a new bus, no explanation of why). The ConfirmDialog (`components/op/ConfirmDialog.tsx`) does state the action is irreversible — so the error path should never be reached if the dialog is always shown — but the error string still lacks a recovery action.
- Fix: Add a support-contact link or a "Tạo xe mới" shortcut to the error message.

**8. Admin finance page payout queue shows internal operator IDs, not operator names**
- File: `app/admin/(console)/finance/page.tsx` line 135
- Issue: `<td className="py-1 font-mono text-xs">{p.operatorId}</td>` — the payout queue table column "Nhà xe" renders the raw CUID, not the `legalName`. An admin cannot identify which operator needs a payout approved without cross-referencing the operators tab.
- Fix: Join `operatorLegalName` in `getPayoutQueue()` and render it instead of (or alongside) the ID.

**9. Payment result page uses `<meta httpEquiv="refresh">` polling — no manual cancel affordance until limit reached**
- File: `app/(customer)/booking/result/[token]/page.tsx` line 80
- Issue: The page auto-refreshes every 5 seconds for up to 2 minutes (24 times). There is no "Stop polling" button — users who completed payment on MoMo but returned to a slow network cannot stop the refresh cycle and read the page. The "Tải lại trang" link appears only after 24 refreshes.
- Fix: Add a "Dừng tự động cập nhật" link that sets `?r=99` (exceeds the `MAX_AUTO_REFRESH` check) so the user can stop the cycle manually at any time.

**10. Customer form — email field has no helper text explaining its purpose before the user makes a mistake**
- File: `app/(customer)/booking/customer/CustomerForm.tsx` line 288–300
- Issue: The email input has `required` and the error message is "Vui lòng nhập email để nhận vé", but this text only appears after failed submission. Many Vietnamese travelers on feature phones may not understand why email is needed for a bus ticket. A sub-label or placeholder ("Để nhận vé điện tử") before submission would reduce abandonment.
- Fix: Add `<p className="text-xs text-muted-foreground mt-0.5">Dùng để nhận vé điện tử.</p>` under the email label.

---

## P3 — Polish / Enhancement

**11. Search filter rail is hidden at `md:hidden` but the mobile filter sheet requires a separate tap**
- File: `components/search/SearchFilters.tsx` line 197, 209
- Issue: On mobile the filter rail is completely absent and replaced by a bottom-sheet triggered by a "Bộ lọc" button. This is the correct OTA pattern, but the "Bộ lọc" button is rendered inside `<SearchToolbar>` which is inside `ResultsList` — so users must scroll past the date navigation bar and sort dropdown before reaching the filter button. The count badge on the filter button correctly shows active filters, but the button is not sticky.
- Fix: Make the toolbar row (`SearchToolbar`) sticky below the date bar so the filter button and sort selector are always accessible without scrolling.

**12. Booking steps indicator does not show completion on the confirmation page**
- File: `components/booking/BookingSteps.tsx`; `app/(customer)/booking/confirmation/[token]/page.tsx`
- Issue: The `<BookingSteps current={2}>` is mounted in `ReviewClient.tsx` (step 2), but the confirmation page does not mount BookingSteps at all — there is no visual "you completed all 3 steps" moment. The success header jumps straight to the booking reference.
- Fix: Mount `<BookingSteps current={3} />` (or a `done={true}` variant) at the top of the confirmation page to give users a satisfying completion signal.

**13. Admin console has no mobile nav — sidebar collapses but there is no hamburger or bottom nav on small screens**
- File: `app/admin/(console)/layout.tsx` line 32
- Issue: The admin sidebar is `md:sticky md:top-0 md:h-dvh md:w-60 md:border-r md:border-b-0` — below `md` it becomes a horizontal top bar with `border-b`. Unlike the operator console (which has `OperatorBottomNav` for mobile), the admin layout has no mobile nav affordance — the sidebar items become a scrollable horizontal strip with no overflow indicator. The admin console targets desktop-only users (SUPER_ADMIN, FINANCE), but any admin who opens the console on a phone sees a broken layout.
- Fix: Add `overflow-x-auto` to the horizontal strip and/or expose a hamburger that slides in the nav as a drawer (the operator console's `OperatorNav` pattern is directly reusable).

**14. TodayTripsStrip links to `/op/upcoming` which may not be a real route**
- File: `components/op/TodayTripsStrip.tsx` line 47
- Issue: The "Tất cả sắp tới" link points to `/op/upcoming`. The glob scan of `app/op/(console)/` shows no `upcoming/` directory. If this route does not exist, the link is a 404.
- Fix: Verify the route exists; if not, redirect to `/op/trips` (the existing trips list) until the upcoming view is built.

**15. TripsClient table "Hành động" buttons have no loading state per-row**
- File: `app/op/(console)/trips/TripsClient.tsx` line 188–205
- Issue: The `busy` flag is a single boolean that disables all action buttons across all rows when any operation is in flight. There is no per-row loading indicator. When an operator cancels trip A, all "Đóng bán" and "Hủy" buttons on trips B, C, D also become disabled with no explanation.
- Fix: Track `busyTripId` (string | null) instead of a single `busy` boolean, and show a spinner or "Đang xử lý" badge only on the affected row.

**16. Withdrawal form does not format the entered amount as VND while typing**
- File: `app/op/(console)/money/WithdrawButton.tsx` line 141
- Issue: The amount input strips non-digit characters but shows raw digits (e.g., `5000000`). There is no thousands separator while typing, so operators cannot quickly verify they haven't added an extra zero.
- Fix: Format the display value with `Intl.NumberFormat('vi-VN')` on input change while keeping the raw integer in state for submission.

---

## Customer Booking Flow Audit

### Flow Map

```
/ (Home)
  └─ SearchFormWrapper → /search?origin=&destination=&date=&ticketCount=
      └─ Search results list (TripCard × N)
          ├─ "Xem chi tiết" → /trips/[id] (TripBooking stepper)
          └─ BookButton → /booking/customer (CustomerForm)
              └─ POST /api/holds → /booking/review?holdId=
                  └─ ReviewClient (payment method + consent + BookingSummaryRail)
                      └─ POST /api/bookings/initiate → window.location payUrl (MoMo/ZaloPay/Card)
                          └─ MoMo return → /booking/result/[token] (polling)
                              └─ /booking/confirmation/[token] (final state)
```

Step-by-step notes:
- **Home**: Hero with inline search form. Trust strip (MoMo · ZaloPay · Thẻ / SMS confirm / multi-operator). Good LCP preload for hero image. Heading "Đặt vé xe khách trong 30 giây" sets accurate expectation.
- **Search**: Date navigation (±1 day chips), inline re-search form, sticky filter rail (desktop), mobile filter sheet. Result count with live `aria-live`. Seek pagination (cursor-based, URL-stable). Low-seat urgency badge (`Chỉ còn N chỗ`). Empty state with adjacent-date suggestions and "Xem tất cả tuyến" escape hatch. No dead end.
- **Trip detail → BookButton**: Stepper capped at `min(availableSeats, 10)`. BookButton navigates to `/booking/customer` with tripId/ticketCount in store.
- **Customer form**: Name, phone (pre-filled from localStorage/account), email, pickup area (grouped Select with typeahead for >6 options). Sold-out / rate-limit / field-error states all handled inline with `role="alert"`. Pre-fill reduces friction for repeat customers.
- **Review page**: `BookingSteps current={2}`, sticky summary rail (desktop), hold timer, payment method selector (MoMo / ZaloPay / Card as styled radio labels), read-only pickup summary, dual-consent checkboxes (required before payment button enables). Well-structured trust at this critical step.
- **Result / polling**: Auto-refresh via `<meta httpEquiv="refresh">` every 5 seconds, capped at 2 minutes. Pending / success / failed / generic fallback states all rendered. Support link exposed when polling times out.
- **Confirmation**: Booking reference in prominent dashed box (scannable), `.ics` calendar download, operator phone number with `tel:` link, forward CTAs (Về trang chủ / Tìm chuyến khác). No dead end.

### Dead Ends

- **After payment failure**: The result page shows "Tìm chuyến khác" → `/search` which is correct. However, there is no "Thử lại với phương thức khác" link — the user must re-enter the entire funnel. The hold has expired by this point, so re-entry is semantically correct, but consider a shortcut back to `/trips/[id]` with the original ticketCount pre-filled.
- **Booking layout guard**: `app/(customer)/booking/layout.tsx` redirects to `/search` if `bookingStore.tripId` is empty and the URL is not a token-landing. A user who shares the `/booking/customer` URL with a friend (or bookmarks it) lands on `/search` with no explanation. This is correct behavior for security but could have a friendlier redirect message.

### Trust Signals

Present:
- Hero trust strip: MoMo · ZaloPay · Thẻ icons; SMS confirmation; multi-operator
- `TrustStrip` component with real metric counts (threshold-gated)
- `BookingSummaryRail`: ShieldCheck icon with "Nhà xe gọi xác nhận giờ đón & chỗ ngồi qua SMS"
- Operator legal name visible on every TripCard and in the summary rail
- Confirmation page shows operator phone number with `tel:` link

Missing:
- No SSL/HTTPS padlock callout (assumed ambient)
- No total booking count or "X khách đã đặt chuyến này" social proof on the trip detail page
- No refund policy summary link from the review page (the consent checkbox text references the policy but there is no hyperlink to a full policy page)

---

## Operator Console Audit

### Navigation Structure

Desktop sidebar (`OperatorNav`): collapsible (icon-only mode), Cmd+K command palette, `min-h-11` touch targets for all items, unviewed-booking count badge. Role-scoped: `visibleNavItems(role)` filters the list by `owner` vs `staff`.

Mobile: Hamburger drawer (slide-in) + `OperatorBottomNav` (sticky bottom bar). Both show the unviewed badge. The bottom nav is a second navigation layer — operators on mobile have both the drawer and the bottom bar available, which is slightly redundant but not harmful.

Overall structure is clean. The separation of dashboard (operational: "what needs attention now?") from reports/overview (analytical: "how am I doing?") is well-considered.

### Information Density

- **Dashboard** (`/op/dashboard`): 4-tile summary row (Today / Fleet / Money / Alerts) + TodayTripsStrip horizontal scroll + InboxStream. About right. Not sparse, not overwhelming.
- **Trips list** (`/op/trips`): 6-column table with two action buttons per row. Dense but manageable on desktop. On mobile: see P1 issue #1.
- **Buses** (`/op/buses`): Add-form + 4-column table with per-row inline capacity editor + expandable maintenance panel. Information density escalates quickly in the maintenance expand state — the expanded row contains a 3-field form (start/end/reason) plus a list of existing windows, all inside a `<TableCell colSpan={4}>`. Dense on mobile.
- **Money** (`/op/money`): 3 balance cards + withdraw form + next-payout + ledger table (25 rows) + statements table. Long page but well-sectioned. Appropriate for a finance view.
- **Bookings** (`/op/bookings`): Separate page for the booking queue — good isolation from the trips list.

### Destructive Action Safeguards

| Action | Gated? | Method |
|--------|--------|--------|
| Cancel trip | Yes | `CancelTripDialog` — requires ≥10 char reason, shows consequence text |
| Deactivate bus | Yes | `ConfirmDialog` — lists 3 consequences, confirm button is destructive variant |
| Delete maintenance window | Yes | `ConfirmDialog` — simple confirmation |
| Toggle sales (open/close) | No | Immediate on button click — reversible, so acceptable |
| Withdraw funds | Partial | Inline form with confirm button; no "are you sure?" modal. The idempotency key prevents double-submit. Acceptable given withdraw can be cancelled at bank level |
| Patch bus capacity | No | "Lưu" button fires immediately — but server blocks reductions that would violate active bookings |

The gating pattern is consistent: irreversible / high-consequence actions use `ConfirmDialog` with a `consequences` bullet list; reversible or low-risk actions do not gate.

**Gap**: Sales toggle fires immediately without any confirmation even though closing sales on a trip with active holds mid-booking could confuse customers mid-flow. Low priority — the operation is fully reversible.

---

## Admin Console Audit

### Approval Workflow

The approval queue (`/admin/approvals`) is efficient for its purpose:
- Sorted oldest-first (maximizes throughput)
- Shows email, phone, submission date, prior rejection reason on each card
- KYB documents viewable via `KybDocLinks` (on-demand signed URL — audited)
- Payout account with name-match score and `suggestVerified` signal displayed inline
- Status transitions: PENDING_REVIEW → UNDER_REVIEW → APPROVED/REJECTED
- "Move to Review" is non-privileged (no TOTP step-up); "Approve" and "Confirm Payout Account" require TOTP step-up
- Reject requires a non-empty reason; Request Info requires a non-empty note

**Gap**: The approve and reject actions are on the same card simultaneously when status is `UNDER_REVIEW`. There is no visual separation between the "approve" button and the "reject reason + button" form — they are in adjacent `flex-wrap gap-2` siblings. On a wide screen this is readable; on a narrower admin screen the destructive (reject) and constructive (approve) actions are visually co-equal. A section divider or color differentiation would reduce mis-clicks.

**Gap**: There is no "undo reject" or "re-queue" path visible from the approval queue. Once rejected, an operator disappears from the queue. The operator can re-apply (per the `rejectionReason` shown on re-entry), but the admin has no "view rejected operators" list in the current flow.

### Financial Safeguards

All financial actions in `FinanceActions.tsx` go through the TOTP step-up gate (STEP_UP_REQUIRED → inline TOTP prompt → retry). This is a strong safeguard. Specific assessment:

- **Payout approve/retry**: Step-up gated. Button labels are clear (Phê duyệt / Thử lại). Status badge on each row.
- **Manual adjustment**: Step-up gated. Signed amount (positive = credit, negative = debit) with a helper text line. Requires a non-empty reason.
- **Refund-out**: Step-up gated. Requires booking ID + amount + reason.
- **Chargeback**: Step-up gated. Requires booking ID + amount. No reason field — chargeback is typically externally initiated so this is intentional.
- **Global fee**: Step-up gated. Validated 0–20% range.

**Gap**: There is no preview or confirmation step between filling in the form and the step-up gate. The admin enters a booking ID and amount, then is immediately prompted for TOTP. If they mistyped the amount, they must cancel the TOTP prompt, re-edit the form, and restart. A preview step ("You are about to refund 500.000đ for booking BB-2025-abc1-def2") before the TOTP prompt would eliminate this class of error.

**Gap**: The ledger operator picker is a free-text input for an internal CUID (`op_…`). This is a P1 issue (see #3 above).

---

## Component Architecture

### Hierarchy

```
Layout (public):       SiteHeader + SiteFooter
Layout (booking):      BookingLayout (client guard)
Layout (operator):     OperatorConsoleLayout (SSR auth gate)
Layout (admin):        AdminConsoleLayout (shell only, no auth)

Shared UI primitives:  components/ui/* (shadcn/base-nova)
Brand:                 components/brand/Logo
Customer-specific:     components/search/*, components/booking/*, components/home/*
Operator-specific:     components/op/*
Admin-specific:        components/admin/*
Ticket shared:         components/ticket/TripDetailCard (used on confirmation + board-check)
```

### Reuse Assessment

Good:
- `components/ui/*` is the correct single source for all atomic elements. No ad-hoc HTML buttons or inputs found in customer flow pages.
- `TripDetailCard` (`components/ticket/TripDetailCard.tsx`) is used on both the confirmation page and the charter status page — shared correctly.
- `BookingSummaryRail` correctly uses `HoldTimer` as a composable child.
- `ConfirmDialog` (`components/op/ConfirmDialog.tsx`) is reused for both bus deactivation and maintenance window deletion. Consequences array is a clean extension point.
- `EmptyState` (`components/op/EmptyState.tsx`) is a proper generic component used in TodayTripsStrip.

Duplication:
- `formatVND` / `formatVnd` / `fmtVndStr` / `fmtVndNum` / `fmt` appear as local utility functions in at least 6 files: `app/(customer)/booking/result/[token]/page.tsx`, `app/(customer)/booking/confirmation/[token]/page.tsx`, `app/op/(console)/dashboard/page.tsx`, `app/op/(console)/money/page.tsx`, `app/op/(console)/money/WithdrawButton.tsx`, `app/admin/(console)/finance/page.tsx`. The project already has `lib/format.ts` (imported in search/page.tsx as `formatVnd`), but it is not consistently used everywhere. Consolidating to `import { formatVnd } from '@/lib/format'` would eliminate ~6 local implementations.
- `formatDate` (ISO → `vi-VN` date string) duplicated in `app/admin/(console)/approvals/page.tsx` and `app/admin/(console)/operators/[id]/page.tsx`.

### Portal Component Isolation

Clean: operator components in `components/op/`, admin in `components/admin/`, customer-facing in `components/search/` and `components/booking/`. No cross-portal leakage found. The issue-092b barrel sweep rules are respected — client components that need `readCsrfToken` import from `@/lib/auth/csrfClient` rather than the `@/lib/auth` barrel.

---

## Mobile Responsiveness

### Customer Portal

- **Home page**: Fully responsive. Hero text `text-3xl sm:text-4xl`. Trust strip uses `flex justify-around divide-x` — renders as 3 equal-width columns on all widths including 360px. SearchFormWrapper is `w-full` in a `max-w-3xl` container. Good.
- **Search results**: At `md:grid md:grid-cols-[16rem_1fr]` — on mobile the filter rail is hidden (`hidden md:block`) and the results stack vertically. Filter sheet is available via toolbar button. Date nav bar is full-width. TripCards use `flex-col` with `flex-wrap` on badge row. Good.
- **Customer form**: Single column, `space-y-4`. Pickup select is full-width. All inputs use `w-full`. Good.
- **Review page**: `flex-col-reverse gap-6 md:grid md:grid-cols-[1fr_20rem]` — on mobile the summary rail appears ABOVE the forms (because of `flex-col-reverse`). This is intentional (summary first on mobile so the user sees what they're paying for before scrolling to the payment method). Payment method grid is `grid-cols-2` — renders as 2 columns on all widths. Consent checkboxes are `flex items-start` — accessible at 360px. Good.
- **Confirmation page**: `max-w-md` single column. CTA buttons `flex-col sm:flex-row` — stacked on mobile, side-by-side on sm. Good.

### Operator Console

- **Layout**: `flex-col md:flex-row`. Mobile header is `h-14` with hamburger. Bottom nav is `OperatorBottomNav`. Solid responsive shell.
- **Dashboard**: 4-tile grid is `grid-cols-2 gap-3 lg:grid-cols-4` — 2×2 grid on phone. Today trips strip uses `overflow-x-auto` horizontal scroll. Good.
- **Trips table**: CRITICAL — `overflow-hidden` clips the 6-column table. No horizontal scroll. See P1 issue #1.
- **Buses table**: CRITICAL — same problem. See P1 issue #2.
- **New trip form**: `grid max-w-md gap-4` — single column form, works on mobile. Good.
- **Money page**: 3-card grid `sm:grid-cols-3` (stacks to 1 column below `sm`). Ledger and statements tables lack `overflow-x-auto` wrappers — these are 3–5 column tables that will overflow at 360px. Medium severity (Finance is less commonly accessed on phones, but still a gap).

### Admin Console

- **Layout**: Top border-only bar on mobile (no hamburger, no drawer). Navigation items overflow horizontally without a scroll indicator. See P3 issue #13.
- **Approvals page**: Cards use `flex-row items-start justify-between` for the header — on 360px phones the badge overlaps the operator name. The DL items inside the cards use `flex gap-2` which can wrap acceptably.
- **Finance page**: Tables are bare `<table>` elements (not using the `components/ui/table` wrapper) with no `overflow-x-auto`. A 6-column payout queue table on a phone will overflow. Medium severity.

---

## Error/Empty/Loading States

### What exists

| State | Customer | Operator | Admin |
|-------|----------|----------|-------|
| Global error boundary | `app/error.tsx` — generic Vietnamese message + error digest + retry button | Same root error.tsx | Same |
| 404 | `app/not-found.tsx` — Vietnamese copy + home + search CTAs | — | — |
| Trip not found | `app/(customer)/trips/[id]/not-found.tsx` | — | — |
| Empty search results | `EmptyState` with ±1 day navigation chips + "Xem tất cả tuyến" | — | — |
| Filter-narrows-to-zero | Inline text "Không có chuyến nào khớp bộ lọc. Hãy bỏ bớt bộ lọc." | — | — |
| Empty trips list | Card with centered text "Chưa có chuyến nào." | — | — |
| Empty buses list | Text "Chưa có xe nào." | — | — |
| Empty ledger | Centered text "Chưa có giao dịch nào." | — | — |
| Empty approval queue | `Alert variant="success"` "Hàng đợi trống" | — | — |
| Sold out during hold | `role="alert"` destructive banner | — | — |
| Rate limited | `role="alert"` warning banner with retry-after seconds | — | — |
| Hold expired | `HoldExpiryModal` (non-dismissible dialog + auto-redirect) | — | — |
| Payment pending | Polling page with spinner + "tự động cập nhật sau 5 giây" | — | — |
| Payment failed | Full-page failure state + "Tìm chuyến khác" CTA | — | — |
| Missing prereqs (new trip) | Alert linking to routes and buses pages | — | — |
| Pickup fetch error | `role="alert"` warning with retry button | — | — |

### What is missing

- **Loading states**: No `loading.tsx` files found anywhere in the `app/` tree (Glob returned 0 results). Next.js uses these for streaming suspense boundaries during RSC fetches. Without them, navigating to `/op/dashboard` (which makes 6 parallel DB queries) shows a blank page until all data resolves. Adding `loading.tsx` skeletons per route would significantly improve perceived performance.
- **Operator dashboard — empty inbox**: `InboxStream` renders events but there is no explicit empty state when `activity.length === 0` visible in the code reviewed. (The `EmptyState` component exists but may not be wired here.)
- **Admin operators list**: No code reviewed for the `/admin/operators` list page — not a confirmed gap, just not audited.
- **Stale payment polling after 2 min**: The "Tải lại trang" link only appears after 24 refreshes. A manual "Check now" button should be visible from the start (see P2 issue #9).

---

## Vietnamese Localization

### Completeness

All user-facing strings found in the reviewed files are in Vietnamese. No English leakage found in:
- Customer booking flow (all form labels, error messages, status text)
- Operator console (nav items, table headers, action buttons, error translations)
- Admin console (page titles, action labels, error messages)

### Date/Time Formats

- Search results: `toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })` — correct full Vietnamese format
- Time display: `toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })` — timezone-correct
- Admin date cells: `d.toISOString().slice(0, 16).replace('T', ' ')` — renders as `2026-06-12 14:30` (ISO format, not Vietnamese locale). Functional but not localized to `vi-VN` conventions. Low severity for an internal admin tool.
- Operator money page: `new Date(row.createdAt).toLocaleString('vi-VN')` — correct

### Currency Formatting

- Customer flow: `Intl.NumberFormat('vi-VN').format(amount) + 'đ'` — correct pattern (no decimals, dots for thousands). Example: `150.000đ`
- Operator money page: Same pattern with BigInt safety (`fmtVndStr`)
- Admin finance page: `${vnd.format(n)} ₫` — uses the `₫` Unicode symbol instead of the `đ` suffix. Minor inconsistency — both are correct Vietnamese VND representations, but `đ` is more common in app UIs and `₫` is more formal. Should be unified.

### Potential Issues

- `BUS_TYPE_LABEL` in search (`page.tsx` line 33) and in filter (`SearchFilters.tsx` line 38) use different capitalizations: `'Ghế ngồi'` vs `'Ghế ngồi'` — actually identical, no issue.
- `busTypeLabel` in `BusesClient.tsx` is delegated to `lib/op/statusLabels.ts` — consistent with the canonical label map.
- The status badge enum values (`PENDING_REVIEW`, `UNDER_REVIEW`, `APPROVED`, `REJECTED`, `SUSPENDED`) are displayed as Vietnamese labels via `STATUS_BADGE` maps in every relevant file — no English enum values leak through.

---

## Recommendations

### Immediate (before soft launch)

1. **[P1] Fix overflow on trips and buses tables** — add `overflow-x-auto` wrapper. ~1 hour. File: `TripsClient.tsx` line 145, `BusesClient.tsx` line 300.
2. **[P1] Add booking-ref lookup to refund/chargeback forms** — replace raw internal ID entry with a booking-ref search input. ~2–3 hours. File: `FinanceActions.tsx`.
3. **[P1] Show step labels at all viewport widths in BookingSteps** — remove `hidden sm:inline`. ~15 minutes. File: `BookingSteps.tsx` line 31.
4. **[P2] Add operator legal name to payout queue table** — join `legalName` in `getPayoutQueue()`. ~1 hour. File: `finance/page.tsx` line 135, `lib/admin/`.
5. **[P2] Add a manual "Check now" option to the payment result polling page** — expose the reload link from the start. ~30 minutes. File: `booking/result/[token]/page.tsx`.

### Pre-launch polish

6. **[P2] Add email helper text to customer form** — one line. File: `CustomerForm.tsx` line 290.
7. **[P2] Show BookingSteps at step 3 on confirmation page** — mount `<BookingSteps current={3} />`. File: `booking/confirmation/[token]/page.tsx`.
8. **[P2] Add loading.tsx skeletons to key routes** — at minimum: `/op/dashboard`, `/search`, `/booking/review`. Each ~30 minutes.
9. **[P3] Consolidate VND formatters** — remove 6 local `formatVND` functions, import `formatVnd` from `@/lib/format` everywhere. ~1 hour.
10. **[P3] Unify VND suffix** — admin finance uses `₫`, customer/operator use `đ`. Pick one. File: `admin/finance/page.tsx` line 47.
11. **[P3] Verify `/op/upcoming` route exists** — if not, change the TodayTripsStrip link to `/op/trips`. File: `components/op/TodayTripsStrip.tsx` line 47.
12. **[P3] Admin mobile nav** — add `overflow-x-auto` to horizontal strip at minimum; consider reusing `OperatorNav` drawer pattern. File: `app/admin/(console)/layout.tsx`.
