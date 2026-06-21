# Manual Refund Runbook — Phase 1

Scope: family operator, single Agribank account, VietQR bank transfer + cash.
Automated PSP refund deferred to Phase 2+ (Issue 094).

---

## 1. When is a refund needed?

| Trigger | How you know | Refund to customer? |
|---------|-------------|---------------------|
| **Operator cancels trip** | Admin/operator clicks Cancel Trip in console | YES — only for `paid` bookings (not cash) |
| **Oversold race** | System auto-detects at payment confirmation | YES — booking auto-transitions to `refunded` |
| **Admin dispute/goodwill** | Customer contacts support | YES — admin decides amount |
| **Cash booking cancelled** | Operator verbal communication | NO — no funds were collected |
| **Unpaid booking expires** | Hold timer (12 min) expires | NO — no payment received |

Key: if `LedgerEntry` rows with type `refund_debit` + `refund_out` exist for the booking,
a refund is owed.

---

## 2. Operator trip cancellation refund

This is the most common Phase 1 refund trigger.

### What happens automatically

1. Operator cancels trip via POST `/api/op/trips/[id]/cancel`
2. System transitions affected bookings to `trip_cancelled`
3. For each **paid** booking, system writes two ledger entries:
   - `refund_debit` (negative) — claws back operator booking credit
   - `refund_out` (negative) — records platform owes customer
4. SMS notification sent to affected customers (template: `trip_cancelled`)

### What you do manually

1. **Identify affected customers**:
   - Admin dashboard → Bookings → filter by trip ID + status `trip_cancelled`
   - Note: customer phone, booking ref, amount paid

2. **Transfer refund via bank**:
   - Log into Agribank online banking
   - For each customer: initiate transfer of exact booking amount
   - Transfer memo: `Hoan tien ve [booking-ref]` (Refund ticket [ref])
   - Save transfer confirmation receipt

3. **Notify customer**:
   - SMS or call customer to confirm refund sent
   - Provide bank transfer reference number
   - Estimated arrival: same-day for Agribank-to-Agribank, 1-2 business days cross-bank

4. **Record in reconciliation log**:
   - Date, booking ref, customer phone, amount, bank txn reference
   - Keep for monthly reconciliation (see section 5)

---

## 3. Admin manual refund (dispute/goodwill)

For cases not triggered by trip cancellation (complaints, service issues, partial refunds).

### Endpoint

```
POST /api/admin/finance/refund-out
Authorization: Bearer <admin-jwt>
X-CSRF-Token: <csrf>
X-Step-Up-Token: <totp-step-up>

{
  "bookingId": "<booking-cuid>",
  "amountMinor": 150000,
  "reason": "Customer complaint: wrong pickup point communicated"
}
```

### Steps

1. **Verify the claim**: check booking details, trip status, payment history
2. **Determine refund amount**: full or partial (amountMinor in VND minor units)
3. **Call the endpoint**: creates `refund_debit` + `refund_out` ledger entries
4. **Manual bank transfer**: same as section 2 step 2
5. **Audit trail**: endpoint auto-logs to admin audit log (actor, action, target, reason)

### Important

- Requires TOTP step-up verification (finance action)
- Each call creates a NEW refund (not idempotent by bookingId — each call gets fresh UUID)
- Can refund same booking multiple times (partial refunds) — total should not exceed paid amount
- Admin is responsible for verifying amount does not exceed original payment

---

## 4. Oversold race refund

Happens automatically when payment confirms but capacity is already full.

### What happens automatically

1. Payment webhook confirms payment
2. Capacity recheck finds trip full
3. Booking transitions to `refunded`
4. Ledger entries created: `refund_debit` + `refund_out` with key `oversold_race:<bookingId>`

### What you do manually

Same as section 2 steps 2-4. Customer already received a notification that their booking
was cancelled due to capacity.

---

## 5. Monthly reconciliation

Run on the 1st business day of each month for the prior month.

### Checklist

1. **Export ledger entries**:
   - Admin dashboard → Finance → Export CSV
   - Filter: type = `refund_out`, date range = prior month

2. **Match against bank statement**:
   - Each `refund_out` ledger entry should have a matching outbound bank transfer
   - Flag any mismatches:
     - Ledger entry exists but no bank transfer → refund not yet sent
     - Bank transfer exists but no ledger entry → unauthorized transfer (investigate)

3. **Verify amounts**:
   - Sum of `refund_out` ledger amounts = sum of outbound refund bank transfers
   - Tolerance: 0 VND (exact match required — no rounding in VND)

4. **Outstanding refunds**:
   - Any `refund_out` entries without matching bank transfer older than 3 business days
   - Action: process immediately, contact customer

---

## 6. Edge cases

### Customer bank account unknown

- Customer paid via VietQR (bank transfer) — SePay records source bank + account
- Check SePay transaction history for the booking's payment to find source account
- Refund to same account that paid

### Duplicate refund sent

- Compare ledger `refund_out` entries against bank transfers
- If bank transfer exceeds ledger amount: contact customer to arrange return
- Log incident for monthly reconciliation

### Customer unreachable

- Attempt contact 3 times over 5 business days (phone + SMS)
- If unreachable: hold refund amount as liability
- Re-attempt monthly for 3 months
- After 3 months: escalate to legal/compliance

### Partial refund

- Use admin endpoint (section 3) with partial `amountMinor`
- Document reason clearly in the `reason` field
- Customer must acknowledge partial amount if disputed

---

## 7. Escalation path

| Severity | Condition | Action |
|----------|-----------|--------|
| Normal | Standard trip-cancel refund | Operator handles within 3 business days |
| Elevated | Customer complaint, refund delayed > 5 days | Admin reviews + processes via endpoint |
| Critical | Duplicate/unauthorized refund, amount mismatch | Freeze account, investigate, report |

---

## Phase 2 migration

When Issue 094 ships (production payment keys + PSP integration):

1. Real PSP refund APIs replace manual bank transfers
2. Automated retry cron handles failed PSP refunds (5 attempts, exponential backoff)
3. Customer self-cancel endpoint goes live (DS-007 T1)
4. This runbook becomes the fallback procedure for PSP failures only
