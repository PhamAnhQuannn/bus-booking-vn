# DS-043 FD-026: Admin Operations Console

## 1. Overview

The admin console (`/admin/`) is the internal operations portal for platform staff. It serves four admin roles: Operations Manager, Finance/Accounting Manager, Compliance Officer, and Customer Support Agent. Access requires admin authentication with TOTP step-up for finance actions. The console is designed for desktop-first usage (no strict performance budget --- internal tool) but remains functional on tablet viewports.

Admin roles: `SUPER_ADMIN` (all access), `FINANCE` (payouts, ledger, refunds), `SUPPORT` (customer lookup, booking management, refunds). Role-based visibility filters nav items and action buttons.

---

## 2. Admin Dashboard (`/admin/`)

### 2.1 KPI Cards

Top-level stat cards in a `grid-cols-4` layout:

| Card | Label | Value Source | Drill-down |
|------|-------|-------------|------------|
| Total Bookings | Tong dat ve | Count by period (today / week / month toggle) | `/admin/bookings` |
| GMV | Tong giao dich | `SUM(booking_credit)` by period | `/admin/finance` |
| Active Operators | Nha xe hoat dong | Count where `status = 'active'` | `/admin/operators` |
| Active Customers | Khach hang | Count of customers with booking in last 90 days | `/admin/users` |

Period toggle: tabs for "Hom nay" / "Tuan nay" / "Thang nay". Default: today.

### 2.2 System Alerts Panel

Severity-ordered list of active alerts below the KPI cards:

| Alert Type | Severity | Source | Example Message |
|------------|----------|--------|----------------|
| Failed cron job | Critical (red) | `JobRunLog` where `errorMessage IS NOT NULL` | "notificationDispatch failed at 14:32 --- 12 pending messages" |
| Payout failure | High (orange) | `Payout` where `status = 'failed'` | "3 payouts that bai --- tong 4.500.000 d" |
| E-invoice rejection | High (orange) | MISA push status | "2 hoa don bi tu choi boi MISA" |
| High refund rate | Warning (amber) | Refund as % of GMV > 2% | "Ty le hoan tien: 3.2% (muc tieu: < 2%)" |
| License expiry | Warning (amber) | KYB documents expiring < 60 days | "Nha xe ABC: giay phep het han trong 45 ngay" |

Each alert is a clickable row that navigates to the relevant management page.

### 2.3 Cron Health Panel

Table showing all registered cron jobs with execution status:

| Column | Content |
|--------|---------|
| Job Name | Cron job identifier (e.g., `expireHolds`, `settlePayout`) |
| Schedule | Cron expression in human-readable form (e.g., "Moi 1 phut", "Moi 5 phut") |
| Last Run | Timestamp of most recent `JobRunLog` entry |
| Status | Green dot (ran within expected interval) / Red dot (missed or errored) |
| Processed | Count from last run |
| Errors | Error count from last run, red if > 0 |

**Missed-cron detection**: A job is "missed" if `now - lastRun > 2 * expectedInterval`. Red dot + "Tre X phut" label.

Reference job catalog (from ADR-012):

| Job | Expected Interval |
|-----|-------------------|
| `expireHolds` | 1 min |
| `notificationDispatch` | 1 min |
| `settlePayout` | 5 min |
| `autoCompleteTrips` | 15 min |
| `charterExpirySweeper` | 15 min |
| `einvoiceSubmission` | 5 min |
| `ticketPdfGeneration` | 5 min |
| `generateFromTemplate` | Daily |
| `operatorLicenseAlert` | Daily |
| `piiAnonymization` | Daily |

---

## 3. KYB Approval Queue (`/admin/approvals`)

### 3.1 Queue List

| Column | Content |
|--------|---------|
| Submission Date | `dd/MM/yyyy HH:mm` |
| Application Ref | `applicationRef` from Onboarding context |
| Operator Name | Submitted company name |
| Entity Type | "Cong ty" / "Ho kinh doanh" / "Ca nhan" |
| Status | Badge: `Cho duyet` (amber) / `Can bo sung` (blue) / `Da duyet` (green) / `Tu choi` (red) |
| Actions | Review button |

Default filter: `Cho duyet` (pending). Sortable by submission date (oldest first --- FIFO processing).

### 3.2 Document Review

Clicking "Review" opens a split-pane detail view:

| Left Pane | Right Pane |
|-----------|------------|
| Operator info: name, phone, email, entity type, tax code (MST) | Document viewer |
| Submitted documents list (clickable) | Inline PDF/image preview (`<iframe>` for PDF, `<img>` for JPG/PNG) |
| Approval action buttons | Zoom controls for documents |

### 3.3 Approval Actions

| Action | Label (VI) | Behavior |
|--------|-----------|----------|
| Approve | Phe duyet | Transitions operator to `ACTIVE`. Triggers SMS + email notification |
| Request More Info | Yeu cau bo sung | Sets status to `NEEDS_INFO`. Free-text field for specific request. Notifies operator |
| Reject | Tu choi | Reason dropdown + free-text. Triggers rejection notification |

**Rejection reason dropdown**:
- `invalid_license` --- "Giay phep khong hop le"
- `expired_documents` --- "Tai lieu het han"
- `incomplete_info` --- "Thong tin khong day du"
- `fraud_suspected` --- "Nghi ngo gian lan"
- `other` --- "Ly do khac" (requires free-text)

All actions write to `AdminAuditLog`.

---

## 4. Operator Lifecycle (`/admin/operators`)

### 4.1 Operator List

| Column | Content |
|--------|---------|
| Name | Operator company name (link to detail) |
| Status | Badge: `ACTIVE` (green) / `SUSPENDED` (red) / `PENDING_REVIEW` (amber) / `DISABLED` (gray) |
| Bookings | Total booking count (all-time) |
| Registration Date | `dd/MM/yyyy` |
| Fee Rate | Current effective rate (e.g., "6%") |

Filters: status dropdown, search by name. Pagination: 25 per page.

### 4.2 Operator Detail (`/admin/operators/[id]`)

Tabbed detail view:

| Tab | Content |
|-----|---------|
| Overview | Company info, contact details, tax classification, KYB status, current fee rate |
| Documents | KYB document list with inline preview |
| Bookings | Booking history table (date, ref, route, amount, status) |
| Payouts | Payout history (date, amount, status, bank account) |
| Complaints | Customer complaints linked to this operator |
| Audit Log | Filtered `AdminAuditLog` entries for this operator |

### 4.3 Operator Actions

| Action | Label (VI) | Guard | Notes |
|--------|-----------|-------|-------|
| Approve | Phe duyet | Only when `PENDING_REVIEW` | Same as KYB approval |
| Suspend | Tam ngung | Only when `ACTIVE` | Requires reason (dropdown + free-text). Blocks new bookings, existing trips unaffected |
| Reinstate | Khoi phuc | Only when `SUSPENDED` | Returns to `ACTIVE` |
| Adjust Fee | Dieu chinh phi | Any active operator | Slider/input: 5-20% range. Creates new `FeeConfig` row with `effectiveFrom = now` |
| Deactivate | Ngung hoat dong | Only when no future paid bookings | Permanent deactivation |

**Deactivation guard**: Before allowing deactivation, check for future bookings with `status IN ('confirmed', 'paid')` and `departureAt > now()`. If any exist:

> **Khong the ngung hoat dong**
>
> Co {X} dat ve da thanh toan trong tuong lai. Huy hoac hoan tat cac chuyen truoc khi ngung.

Fee adjustment creates a new effective-dated `FeeConfig` row. Admin sees a confirmation:

> Phi nen tang moi cho {Operator}: {newRate}%. Ap dung tu bay gio.

### 4.4 TOTP Step-Up

Fee adjustment and deactivation require TOTP step-up verification. Modal: "Nhap ma xac thuc (OTP) tu ung dung xac thuc cua ban" with 6-digit input.

---

## 5. Customer Management (`/admin/users`)

### 5.1 Search

| Search Field | Type | Example |
|-------------|------|---------|
| Phone | Phone input with +84 prefix | `+84901234567` |
| Booking Reference | Text input | `BB-2026-a1b2-c3d4` |

Search is exact-match on phone, prefix-match on booking reference.

### 5.2 Customer Detail

| Section | Content |
|---------|---------|
| Identity | Phone (masked to last 4 in audit log), name, registration date |
| Booking Timeline | Chronological list: hold -> payment -> confirmed -> departed -> completed. Visual timeline component |
| Account Status | `ACTIVE` / `SUSPENDED` / `ANONYMIZED` badge |

### 5.3 Customer Actions

| Action | Label (VI) | Notes |
|--------|-----------|-------|
| Suspend | Tam ngung tai khoan | Blocks new bookings. Requires reason |
| Manual Refund | Hoan tien thu cong | Initiates refund for a specific booking. See Section 6 |
| Anonymize (DSAR) | Xoa du lieu ca nhan | PDPL Article 15 deletion. Replaces PII with anonymized values. Irreversible confirmation dialog |

**Anonymize confirmation dialog**:

> **Xoa du lieu ca nhan (PDPL)**
>
> Hanh dong nay se xoa vinh vien tat ca thong tin ca nhan cua khach hang. Khong the hoan tac.
>
> Nhap "XOA" de xac nhan: [________]
>
> [Xac nhan xoa] [Huy]

---

## 6. Refund Queue (`/admin/finance`)

### 6.1 Refund List

| Column | Content |
|--------|---------|
| Booking Ref | `BB-YYYY-xxxx-xxxx` (link to booking detail) |
| Amount | VND formatted |
| PSP | Payment method: "MoMo" / "Chuyen khoan" / "Tien mat" |
| Status | `Cho xu ly` (amber) / `That bai` (red) / `Hoan thanh` (green) |
| Failure Reason | PSP error message (if failed) |
| Created | Timestamp |

Filters: status tabs (Pending / Failed / Completed). Default: Pending.

### 6.2 Refund Actions

| Action | Label (VI) | Applicability |
|--------|-----------|---------------|
| Retry | Thu lai | Failed MoMo/VNPay refunds |
| Manual Complete | Hoan thanh thu cong | Bank transfer refunds. Requires bank transfer reference input |

**Ledger impact preview**: Before confirming any refund action, show a read-only preview of the ledger entries that will be created:

```
Xem truoc tac dong:
  + refund_debit:   -350.000 d  (tru so du nha xe)
  + refund_out:     +350.000 d  (hoan tien khach hang)
  + payout_reversal: +21.000 d  (hoan phi nen tang)
```

Confirm button: "Xac nhan hoan tien". All actions write to `AdminAuditLog`.

---

## 7. Payout Settlement (`/admin/finance` --- Payouts tab)

### 7.1 Payout Queue

| Column | Content |
|--------|---------|
| Operator | Name (link to operator detail) |
| Amount | VND formatted |
| Status | Badge: `Da yeu cau` (blue) / `Dang xu ly` (amber) / `Da thanh toan` (green) / `That bai` (red) |
| Requested At | Timestamp |
| Bank Account | Bank name + masked number |

Filters: status tabs. Default: `Da yeu cau` (requested).

### 7.2 Payout Actions

| Action | Label (VI) | Notes |
|--------|-----------|-------|
| Bulk Process | Xu ly hang loat | Select multiple requested payouts, transition to `processing`. TOTP step-up required |
| Retry Failed | Thu lai | Individual failed payout -> back to `requested` |
| View Ledger | Xem so cai | Opens per-operator ledger view |

### 7.3 Per-Operator Ledger View

Modal or side panel showing chronological ledger entries for a specific operator:

| Column | Content |
|--------|---------|
| Date | `dd/MM/yyyy HH:mm` |
| Type | Entry type badge (see below) |
| Description | Human-readable: "Dat ve BB-2026-a1b2" / "Phi nen tang" / "Hoan tien" |
| Amount | Signed VND: green for credits, red for debits |
| Running Balance | Cumulative balance after this entry |

**Entry type badges**:

| Type | Label (VI) | Color |
|------|-----------|-------|
| `booking_credit` | Doanh thu | Green |
| `platform_fee` | Phi NTT | Gray |
| `refund_debit` | Hoan tien | Red |
| `refund_out` | Chi hoan | Red |
| `payout_debit` | Rut tien | Blue |
| `payout_reversal` | Hoan phi | Amber |
| `chargeback` | Tranh chap | Red |
| `adjustment` | Dieu chinh | Purple |
| `tax_withheld` | Khau tru thue | Gray |

---

## 8. Audit Log (`/admin/system`)

### 8.1 Log Display

Chronological list (newest first) of all admin actions:

| Column | Content |
|--------|---------|
| Timestamp | `dd/MM/yyyy HH:mm:ss` |
| Actor | Admin user email |
| Action | Action type (e.g., `operator.approve`, `payout.process`, `customer.suspend`) |
| Target | Entity affected (operator name, booking ref, customer phone masked) |
| Details | JSON-expandable detail (click to expand) |

### 8.2 Filters

| Filter | Type |
|--------|------|
| Actor | Dropdown of admin users |
| Action Type | Multi-select of action categories |
| Date Range | Date picker pair |
| Search | Free-text search across target field |

### 8.3 Immutability

The `AdminAuditLog` table is append-only, enforced by a PostgreSQL trigger that prevents `UPDATE` and `DELETE` operations. No delete button exists in the UI. Phone numbers in the audit log are masked to last 4 digits via `lib/audit/redactPhone.ts`.

---

## 9. Navigation Structure

```
/admin/
  |-- Dashboard (home)
  |-- /approvals          KYB Approval Queue
  |-- /operators          Operator Management
  |   |-- /[id]           Operator Detail
  |-- /users              Customer Management
  |-- /finance            Finance (tabs: Refunds | Payouts | Ledger)
  |-- /system             System (tabs: Audit Log | Cron Health)
```

Nav items are filtered by admin role:

| Nav Item | SUPER_ADMIN | FINANCE | SUPPORT |
|----------|-------------|---------|---------|
| Dashboard | Yes | Yes | Yes |
| Approvals | Yes | No | No |
| Operators | Yes | No | No |
| Customers | Yes | No | Yes |
| Finance | Yes | Yes | No |
| System | Yes | No | No |

---

## 10. Responsive Behavior

The admin console is desktop-optimized (1024px+ primary). Tablet (768px+) is supported with horizontal scroll on data tables. Mobile access is not a design target --- admins use desktop/laptop.

| Viewport | Behavior |
|----------|----------|
| Desktop (1024px+) | Full sidebar nav, multi-column layouts, split-pane document review |
| Tablet (768-1023px) | Collapsible sidebar, single-column layouts, stacked document review |
| Mobile (< 768px) | Functional but not optimized. Banner: "De co trai nghiem tot nhat, vui long su dung may tinh" |

---

## 11. Cross-References

| Reference | Relevance |
|-----------|-----------|
| Admin Personas | Four admin roles, daily workflows, KPIs, pain points |
| ADR-012 Background Jobs | Cron job catalog, payout settlement pipeline, failure handling |
| Bounded Contexts: Admin/Moderation | `AdminAuditLog` immutability, moderation actions, phone masking |
| Bounded Contexts: Finance/Ledger | Ledger entry types, append-only pattern, balance derivation |
| Bounded Contexts: Onboarding/KYB | Application workflow, document types, payout account verification |
| ADR-006 Pricing & Currency | Fee rate encoding (ratePpm), 5-20% range, effective-dating |
| DS-041 FD-024 Operator Dashboard | Operator-facing payout/revenue views (admin sees the platform side) |
| DS-045 FD-028 Portal Architecture | Admin auth requires TOTP step-up; `SUPER_ADMIN`/`FINANCE`/`SUPPORT` roles |
