# DS-016 -- Promotions & Voucher System

## 1. Overview

This document defines the promotion and voucher system for the BusBooking platform — a key customer acquisition and retention tool. Business research identifies promotional codes as a primary conversion mechanism: "20K–50K VND cashback converts first-time users" (market-research/business-model.md). Competitors offer flash sales up to 50% (VeXeRe) and 30% (redBus). The system must preserve the I7 invariant (no client-originated price) — all discounts are computed and applied server-side.

**Source ADRs.** ADR-006 (Pricing/Currency — VND integer, BigInt arithmetic, ratePpm encoding), ADR-010 (Booking Lifecycle — hold-then-book, I7 invariant), ADR-015 (Error Contract — discriminated results).

**Cross-references.** DS-001 for Booking, Trip, Route, Operator entity schemas. DS-003 for API endpoint conventions and auth realms. DS-005 for ledger entry patterns. DS-006 for cron patterns. DS-007 for refund interaction with promotional bookings.

**Business context.** market-research/business-model.md (acquisition channels, unit economics), personas/customer-personas.md (Chi Lan: hunts promo codes; Em Quan: hunts student discounts), competitor-benchmark/feature-parity-matrix.md (VeXeRe flash sales, redBus discounts).

---

## 2. Promotion Types

| Type | Code Example | Value Encoding | Discount Calculation | Use Case |
|------|-------------|---------------|---------------------|----------|
| Percentage | `TET2026` | `value` = ratePpm (e.g., 100000 = 10%) | `min(totalVnd * value / 1_000_000, maxDiscount)` — BigInt | Seasonal campaigns |
| Fixed amount | `WELCOME20K` | `value` = VND amount (e.g., 20000) | `min(value, totalVnd)` — cannot exceed booking total | First-booking acquisition |
| Cashback | `CASHBACK50K` | `value` = VND credit amount (e.g., 50000) | No immediate discount; credit applied to future booking | Retention / repeat purchase |

All calculations use BigInt arithmetic per ADR-006 D5. No IEEE 754 floating point for money.

**Source:** ADR-006 (BigInt, ratePpm encoding).

---

## 3. Data Model

### 3.1 Promotion Entity

```prisma
model Promotion {
  id               String      @id @default(cuid())
  code             String      @unique    // uppercase, alphanumeric, 6-12 chars
  type             PromoType              // PERCENTAGE, FIXED_AMOUNT, CASHBACK
  value            Int                    // ratePpm for percentage, VND for fixed/cashback
  minOrderAmount   Int?                   // minimum booking totalVnd to qualify (VND)
  maxDiscount      Int?                   // cap for percentage discounts (VND), required when type=PERCENTAGE
  validFrom        DateTime
  validTo          DateTime
  usageLimit       Int?                   // total redemptions allowed (null = unlimited)
  usageCount       Int         @default(0)
  perCustomerLimit Int         @default(1) // max uses per customer
  operatorId       String?               // null = platform-wide, set = operator-specific
  routeId          String?               // null = all routes, set = route-specific
  isActive         Boolean     @default(true)
  description      String?               // internal description for admin
  createdBy        String                // admin or operator user ID
  createdAt        DateTime    @default(now())
  updatedAt        DateTime    @updatedAt

  operator         Operator?   @relation(fields: [operatorId], references: [id])
  route            Route?      @relation(fields: [routeId], references: [id])

  @@index([code])
  @@index([operatorId, isActive])
  @@index([validFrom, validTo, isActive])
}
```

### 3.2 PromoType Enum

```prisma
enum PromoType {
  PERCENTAGE
  FIXED_AMOUNT
  CASHBACK
}
```

### 3.3 BookingPromotion Junction

```prisma
model BookingPromotion {
  id             String    @id @default(cuid())
  bookingId      String    @unique    // one promo per booking (no stacking)
  promotionId    String
  discountAmount Int                  // actual VND discount applied
  createdAt      DateTime  @default(now())

  booking        Booking   @relation(fields: [bookingId], references: [id])
  promotion      Promotion @relation(fields: [promotionId], references: [id])

  @@index([promotionId])
}
```

### 3.4 Booking Entity Extension

Add field to existing Booking model:

```prisma
// In existing Booking model:
discountAmount   Int       @default(0)   // VND discount from promotion (0 if no promo)
```

`Booking.totalVnd` remains the final amount customer pays: `Trip.price * ticketCount - discountAmount`.

---

## 4. Promo Code Validation — `POST /api/promos/validate`

### 4.1 Request / Response

```
Auth: Customer JWT or guest session
Body: { code: string, tripId: string, ticketCount: number }

Success 200: {
  valid: true,
  promotion: { code, type, description },
  discountAmount: number,  // VND
  originalPrice: number,   // Trip.price * ticketCount
  finalPrice: number       // originalPrice - discountAmount
}

Failure 200: {
  valid: false,
  reason: 'expired' | 'usage_limit_reached' | 'already_used' | 'min_order_not_met' |
          'invalid_code' | 'wrong_operator' | 'wrong_route' | 'inactive'
}
```

Returns 200 for both valid and invalid (validation is not an error — it's a query).

### 4.2 Validation Steps

```
1. Lookup: Promotion WHERE code = input.code.toUpperCase()
   └─ NOT FOUND → { valid: false, reason: 'invalid_code' }

2. Check isActive = true
   └─ FAIL → { valid: false, reason: 'inactive' }

3. Check NOW() between validFrom and validTo
   └─ FAIL → { valid: false, reason: 'expired' }

4. Check usageLimit: usageCount < usageLimit (if usageLimit not null)
   └─ FAIL → { valid: false, reason: 'usage_limit_reached' }

5. Check per-customer: COUNT(BookingPromotion) for this customer + promotion < perCustomerLimit
   └─ FAIL → { valid: false, reason: 'already_used' }

6. Resolve Trip: Trip WHERE id = tripId (with Route + Operator joins)
   └─ NOT FOUND → 404

7. Check operatorId scope: if promo.operatorId set, must match Trip's operatorId
   └─ FAIL → { valid: false, reason: 'wrong_operator' }

8. Check routeId scope: if promo.routeId set, must match Trip's routeId
   └─ FAIL → { valid: false, reason: 'wrong_route' }

9. Calculate orderTotal = Trip.price * ticketCount
   Check minOrderAmount: orderTotal >= promo.minOrderAmount (if set)
   └─ FAIL → { valid: false, reason: 'min_order_not_met' }

10. Calculate discountAmount (BigInt):
    - PERCENTAGE: min(BigInt(orderTotal) * BigInt(value) / BigInt(1_000_000), BigInt(maxDiscount))
    - FIXED_AMOUNT: min(BigInt(value), BigInt(orderTotal))
    - CASHBACK: BigInt(0) (no immediate discount, credit applied later)

11. Return { valid: true, discountAmount: Number(discountAmount), finalPrice: orderTotal - Number(discountAmount) }
```

**Source:** ADR-006 D5 (BigInt arithmetic), ADR-010 D7 (I7 invariant — server-derived price).

---

## 5. Application at Booking Creation

### 5.1 Integration Point

Promo is applied during the hold → booking transition inside `initiateBooking` service function.

### 5.2 Flow (inside $transaction)

```
1. Caller passes optional promoCode in booking initiation request
2. If promoCode provided:
   a. Re-validate promo (FULL validation — may have expired/hit limit since validate call)
   b. If re-validation fails: proceed WITHOUT discount (promo is best-effort, not blocking)
      Log warning: "Promo {code} no longer valid at booking time"
   c. If valid:
      - Atomic INCREMENT Promotion.usageCount (+1)
      - Calculate discountAmount (same BigInt math as validation)
      - Create BookingPromotion row { bookingId, promotionId, discountAmount }
      - Set Booking.totalVnd = Trip.price * ticketCount - discountAmount
      - Set Booking.discountAmount = discountAmount
3. If no promoCode: Booking.totalVnd = Trip.price * ticketCount, discountAmount = 0
```

### 5.3 I7 Invariant Compliance

- Client sends `promoCode: string` (not a price or discount amount)
- Server resolves code → Promotion entity → computes discount via BigInt math
- Client NEVER sends `discountAmount` or `finalPrice`
- `Booking.totalVnd` is always server-computed

**Source:** ADR-010 D7 (I7: no client-originated price), DS-005 §6 (transaction patterns).

---

## 6. Ledger Integration

### 6.1 Platform-Funded Promotions (operatorId = null)

Platform absorbs the discount. Operator receives full commission on original price.

```
LedgerEntry rows on booking paid:
  booking_credit:  amount = Booking.totalVnd (discounted amount customer actually paid)
  platform_fee:    amount = -(originalPrice * platformFeeRate)  // fee on ORIGINAL, not discounted
  promo_subsidy:   amount = -discountAmount  // platform cost of the promo

Net to operator: originalPrice - platformFee  (unaffected by promo)
Net to platform: platformFee - promoSubsidy   (platform eats the discount)
```

### 6.2 Operator-Funded Promotions (operatorId set)

Operator absorbs the discount. Platform fee calculated on original price.

```
LedgerEntry rows on booking paid:
  booking_credit:  amount = Booking.totalVnd (discounted amount)
  platform_fee:    amount = -(originalPrice * platformFeeRate)  // fee on ORIGINAL
  operator_promo:  amount = -discountAmount  // deducted from operator share

Net to operator: originalPrice - platformFee - discountAmount
Net to platform: platformFee (unaffected)
```

### 6.3 Source Event ID

`sourceEventId` pattern: `promo:<bookingId>:<promotionId>` — prevents duplicate ledger writes.

**Source:** ADR-006 D3 (platform fee calculation), DS-005 §7 (ledger entry patterns).

---

## 7. Anti-Fraud Controls

| Control | Implementation | Rationale |
|---------|---------------|-----------|
| Per-customer limit | `perCustomerLimit` checked via `COUNT(BookingPromotion)` for customer | Prevents multi-use abuse |
| Per-phone limit | Join `BookingPromotion → Booking → Customer WHERE phone` | Prevents re-registration abuse |
| Global usage cap | `usageLimit` field, atomic `INCREMENT` in `$transaction` | Budget control |
| Time window | `validFrom` / `validTo` server-side check (not client clock) | Prevents clock manipulation |
| Minimum order | `minOrderAmount` threshold | Prevents gaming with tiny bookings |
| Code generation | Admin/operator-only creation. Not sequential (CUID-derived or random alphanumeric) | Prevents brute-force guessing |
| Validation rate limit | Max 5 `POST /api/promos/validate` per phone per 10 minutes | Prevents code enumeration |
| No stacking | `BookingPromotion.bookingId @unique` — one promo per booking | Simplifies accounting |

---

## 8. API Endpoints

### 8.1 Customer

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/api/promos/validate` | Customer JWT or guest | Validate promo code against trip (§4) |

Promo code is submitted as part of booking initiation — no separate "apply" endpoint.

### 8.2 Operator

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/api/op/promos` | Operator JWT | Create operator-scoped promotion |
| `GET` | `/api/op/promos` | Operator JWT | List operator's promotions with usage stats |
| `PATCH` | `/api/op/promos/{id}` | Operator JWT | Update (cannot change code or type after creation) |
| `PATCH` | `/api/op/promos/{id}/deactivate` | Operator JWT | Set `isActive = false` |

Operator promos auto-set `operatorId` from JWT (tenant-scoped, no cross-tenant access).

### 8.3 Admin

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/api/admin/promos` | Admin JWT | Create platform-wide promotion |
| `GET` | `/api/admin/promos` | Admin JWT | List all promotions across operators |
| `PATCH` | `/api/admin/promos/{id}` | Admin JWT | Update any promotion |
| `GET` | `/api/admin/promos/{id}/usage` | Admin JWT | Usage report: bookings using this promo, total discount given |

**Source:** DS-003 §2 (auth realms, endpoint conventions).

---

## 9. Refund Interaction (DS-007)

| Scenario | Behavior |
|----------|----------|
| Booking with promo refunded | Refund `Booking.totalVnd` (the discounted amount customer paid) |
| Promo usage count | NOT decremented on refund (prevents abuse: book→refund→reuse cycle) |
| Cashback credit | If booking refunded before cashback credit used → revoke credit |
| Platform-funded promo refund ledger | Reverse `booking_credit` + `promo_subsidy`. Platform recovers subsidy cost |
| Operator-funded promo refund ledger | Reverse `booking_credit` + `operator_promo`. Operator recovers promo cost |

---

## 10. Cashback Credit Design

### 10.1 Customer Credit Balance

```prisma
// Extend existing Customer model:
creditBalance    Int       @default(0)   // VND, accumulated cashback credits
```

### 10.2 Credit Lifecycle

```
1. Booking with CASHBACK promo completed (trip completed, not just paid):
   → creditBalance += promo.value
   → LedgerEntry: cashback_credit, amount = promo.value

2. Next booking: customer can apply credit at checkout
   → Booking.totalVnd reduced by min(creditBalance, totalVnd)
   → creditBalance -= appliedCredit
   → LedgerEntry: credit_applied, amount = -appliedCredit

3. Refund of cashback-earning booking (before trip):
   → If cashback not yet granted (trip not completed): no credit reversal needed
   → If cashback already granted: deduct from creditBalance (may go to 0, not negative)
```

### 10.3 Credit Expiry

- Credits expire 6 months after grant
- Tracked via `CreditTransaction` entity (out of scope for Stage 0, track via LedgerEntry timestamps)

---

## 11. Known Gaps

| Gap | Severity | Dependency |
|-----|----------|------------|
| Flash sale infrastructure (high-volume, time-limited with countdown UI) | MEDIUM | Frontend design |
| Referral program (unique per-customer code, reward on friend's booking) | MEDIUM | Customer growth |
| Promo code bulk generation tool (admin UI for batch with shared prefix) | LOW | Admin tooling |
| A/B testing promo effectiveness (conversion rate per promo vs control) | LOW | Analytics |
| Promo stacking policy (currently: no stacking, one per booking) | LOW | Product decision |
| Cashback credit expiry tracking (CreditTransaction entity) | MEDIUM | Stage 1 |
| Student discount verification (Em Quan persona, university email check) | LOW | Phase 2 |
| Promo display in search results (show discounted price before clicking) | MEDIUM | Frontend + search API |
| Operator promo approval workflow (admin review before activation) | LOW | Trust & safety |
