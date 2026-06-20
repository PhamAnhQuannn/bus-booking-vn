# DS-010 -- Chargeback Design

## 1. Overview

This document defines the chargeback and dispute handling architecture for the BusBooking platform -- a multi-tenant Vietnam bus booking marketplace. No chargeback workflow currently exists in the platform -- chargebacks from VNPay card payments and MoMo e-wallet disputes would result in unrecoverable financial loss with no audit trail, no operator notification, and no dispute evidence process. This gap is a direct financial risk: the platform (or operator, under split-settlement) absorbs the loss silently.

Chargebacks are initiated by the cardholder's issuing bank (VNPay card payments) or by the customer through the MoMo app (e-wallet disputes). They reverse a previously settled payment and debit the merchant. The platform must track chargebacks, respond within PSP-mandated deadlines, manage evidence submission, and handle the financial impact on operator payouts.

**Source ADRs.** This document synthesizes decisions from ADR-005 (Payment Architecture -- PSP adapter layer, PaymentEvent idempotency), ADR-006 (Pricing/Currency -- VND integer arithmetic, BigInt computation), ADR-010 (Booking Lifecycle -- state machine transitions), ADR-019 (State Machines -- transition maps, legal predecessor sets). Business context from regulatory/payment.md, domain-model/state-machines.md, domain-model/invariants-catalog.md.

**Cross-references.** 01-data-model-design for `PaymentEvent`, `LedgerEntry`, `Booking`, `Payout` entity schemas. 05-webhook-design for webhook processing pipeline and adapter normalization. 06-background-jobs for cron patterns and `JobRunLog` contract. 07-refund-flow for customer-initiated refund lifecycle (distinct from chargeback). 09-split-settlement for marketplace model impact on chargeback responsibility.

---

## 2. Chargeback Windows and Reason Codes

### 2.1 PSP Chargeback Windows

| PSP | Window | Card/Wallet Type | Chargeback Mechanism |
|-----|--------|-------------------|---------------------|
| VNPay (domestic ATM) | 45 calendar days from transaction date | Napas domestic debit (ATM cards) | Issuing bank initiates via Napas dispute process |
| VNPay (international) | 90 calendar days from transaction date | Visa, Mastercard (credit/debit) | Issuing bank initiates via Visa/MC dispute network |
| MoMo | 30 calendar days from transaction date | E-wallet balance, linked bank account | Customer disputes via MoMo app; MoMo mediates |
| VietQR | N/A | Bank transfer | No chargeback mechanism -- bank transfers are irrevocable |

### 2.2 Reason Codes

| Reason Code | Description | Applicable PSPs | Evidence Requirements |
|-------------|------------|-----------------|----------------------|
| `fraud` | Unauthorized transaction -- cardholder did not authorize payment | VNPay (card), MoMo | Transaction logs, IP address, device fingerprint, 3DS authentication proof |
| `not_received` | Service not received -- customer paid but did not travel | VNPay, MoMo | Trip manifest (passenger boarded), GPS departure confirmation, booking confirmation SMS |
| `not_as_described` | Service materially different from description | VNPay, MoMo | Terms of service, route/schedule as advertised, operator response |
| `duplicate` | Customer charged twice for same booking | VNPay, MoMo | PaymentEvent records showing single vs. duplicate `providerTxnId` |
| `unauthorized` | E-wallet account compromised | MoMo | MoMo account security logs, device binding records |

**Source:** ADR-005 D4, ADR-010.

---

## 3. Chargeback State Machine

### 3.1 State Diagram

```
                    ┌──────────────────────────────────────────────┐
                    │                                              │
  PSP notification  │                                              ▼
  ─────────────────►  received ──► under_review ──┬──► accepted ──► [terminal]
                                                  │     (refund to cardholder)
                                                  │
                                                  ├──► contested ──┬──► won ──► [terminal]
                                                  │   (evidence     │   (chargeback reversed,
                                                  │    submitted)   │    platform/operator keeps funds)
                                                  │                 │
                                                  │                 └──► lost ──► [terminal]
                                                  │                     (chargeback upheld,
                                                  │                      funds debited)
                                                  │
                                                  └──► expired ──► [terminal]
                                                      (deadline passed,
                                                       auto-accepted)
```

### 3.2 Legal Transition Map

```typescript
// lib/chargeback/transitions.ts
const LEGAL_CHARGEBACK_TRANSITIONS: Record<ChargebackStatus, ChargebackStatus[]> = {
  received:     ['under_review'],
  under_review: ['accepted', 'contested', 'expired'],
  accepted:     [],  // terminal
  contested:    ['won', 'lost'],
  won:          [],  // terminal
  lost:         [],  // terminal
  expired:      [],  // terminal
};
```

### 3.3 Transition Guards

| Transition | Guard | Effect |
|-----------|-------|--------|
| `received` -> `under_review` | Admin assigns case for review | Sets `reviewStartedAt` |
| `under_review` -> `accepted` | Admin accepts chargeback (or auto-accept on deadline) | Triggers clawback ledger entries (SS6) |
| `under_review` -> `contested` | Admin submits evidence to PSP | Sets `evidenceSubmittedAt`, stores `evidenceUrl` |
| `under_review` -> `expired` | `responseDeadline < NOW()` (cron-triggered) | Auto-transitions; equivalent to accepted |
| `contested` -> `won` | PSP reverses chargeback (platform notified) | Releases held reserve (if applicable) |
| `contested` -> `lost` | PSP upholds chargeback (platform notified) | Triggers clawback ledger entries (SS6) |

**Source:** ADR-019 (state machine patterns), ADR-010 (booking lifecycle).

---

## 4. Data Model

### 4.1 Chargeback Entity

```prisma
model Chargeback {
  id                String            @id @default(cuid())
  bookingId         String
  paymentEventId    String
  operatorId        String
  amount            Int               // chargeback amount in VND (always positive)
  reason            ChargebackReason
  status            ChargebackStatus
  pspCaseId         String?           // PSP's chargeback/dispute reference ID
  pspAdapter        PaymentAdapter    // which PSP originated the chargeback
  evidenceUrl       String?           // URL to uploaded evidence file (S3/R2)
  evidenceNote      String?           // admin notes on evidence submitted
  responseDeadline  DateTime          // PSP deadline for evidence submission
  reviewStartedAt   DateTime?         // when admin started review
  evidenceSubmittedAt DateTime?       // when evidence was submitted to PSP
  resolvedAt        DateTime?         // when terminal state was reached
  resolvedBy        String?           // admin user ID who resolved
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt

  booking           Booking           @relation(fields: [bookingId], references: [id])
  paymentEvent      PaymentEvent      @relation(fields: [paymentEventId], references: [id])
  operator          Operator          @relation(fields: [operatorId], references: [id])

  @@index([status, responseDeadline])
  @@index([operatorId, status])
  @@index([bookingId])
  @@index([pspAdapter, pspCaseId])
}
```

### 4.2 Enums

```prisma
enum ChargebackReason {
  FRAUD              // unauthorized transaction
  NOT_RECEIVED       // service not received
  NOT_AS_DESCRIBED   // service materially different
  DUPLICATE          // charged twice for same booking
  UNAUTHORIZED       // e-wallet account compromised (MoMo)
}

enum ChargebackStatus {
  RECEIVED       // PSP notified platform of chargeback
  UNDER_REVIEW   // admin is reviewing case
  ACCEPTED       // chargeback accepted, funds returned to cardholder
  CONTESTED      // evidence submitted to PSP, awaiting decision
  WON            // PSP reversed chargeback in platform's favor
  LOST           // PSP upheld chargeback, funds debited
  EXPIRED        // response deadline passed, auto-accepted
}
```

### 4.3 Booking Model Extension

Add an optional relation and a chargeback status indicator to the Booking model:

```prisma
// In Booking model:
chargebacks       Chargeback[]
chargebackStatus  BookingChargebackStatus @default(NONE)
```

```prisma
enum BookingChargebackStatus {
  NONE          // no chargeback filed
  ACTIVE        // chargeback in progress (received, under_review, contested)
  RESOLVED      // chargeback resolved (accepted, won, lost, expired)
}
```

The `chargebackStatus` field on Booking enables the operator dashboard to display chargeback indicators without joining to the Chargeback table. It is updated by the chargeback state machine transitions.

**Source:** ADR-005, 01-data-model-design.

---

## 5. Financial Impact -- Reserve Fund Model

### 5.1 Option Analysis

| Option | Description | Complexity | Cash Flow Impact | Recommendation |
|--------|------------|------------|------------------|----------------|
| **Option A: Clawback** | No reserve. Chargeback after payout -> deduct from operator's next payout. | Low | Operator receives full payout; clawback on next cycle if chargeback occurs | Recommended for Stage 0 |
| **Option B: Escrow Reserve** | Hold X% of each payout in escrow for chargeback window duration (45-90 days). | Medium | Operator receives reduced payout; reserve released after window closes | Recommended at scale (>1000 bookings/month) |
| **Option C: Insurance** | Purchase chargeback insurance from PSP or third party. | Low (operational) | Premium cost absorbed by platform or passed to operator | Evaluate when chargeback rate data available |

### 5.2 Stage 0 Recommendation -- Clawback (Option A)

At current transaction volumes, the probability of chargebacks is low and the financial exposure per-incident is bounded by the VND ticket price (typically 100,000-500,000 VND per booking). Option A (clawback) is the simplest implementation:

1. Operator receives full payout at T+1
2. If chargeback occurs after payout, create negative ledger entries against operator's balance
3. Deduct clawback amount from next `settlePayout` cycle
4. If operator balance insufficient, flag as receivable for admin follow-up

### 5.3 Escrow Reserve Trigger Criteria

Transition to Option B (escrow reserve) when any of:
- Monthly transaction volume exceeds 1,000 bookings per operator
- Chargeback rate exceeds 0.5% of transactions for any operator
- Cumulative outstanding clawback receivables exceed 10,000,000 VND across all operators
- PSP mandates reserve (some PSPs require marketplace merchants to hold reserves)

**Source:** ADR-006, ADR-005 D1.

---

## 6. Operator Clawback Flow

### 6.1 Clawback Sequence

When a chargeback is accepted or lost AFTER the operator's payout has already settled:

```
Chargeback accepted/lost
  │
  ├─ 1. Verify original Payout status
  │     └─ status = 'paid' → clawback required
  │     └─ status = 'requested'/'processing' → deduct from pending payout (no clawback)
  │
  ├─ 2. Create clawback LedgerEntry (inside $transaction)
  │     ├─ chargeback_debit:  -amount VND (debit operator balance)
  │     └─ chargeback_out:    -amount VND (return to PSP/cardholder)
  │
  ├─ 3. Create ClawbackReceivable record
  │     ├─ operatorId, chargebackId, amount, status: 'pending'
  │     └─ Applied against next settlePayout cycle
  │
  ├─ 4. Notify operator
  │     ├─ NotificationLog entry: template = 'chargeback_accepted'
  │     ├─ Payload: booking ref, amount, reason, next payout impact
  │     └─ Channel: SMS + operator portal notification
  │
  └─ 5. Update Booking.chargebackStatus = 'RESOLVED'
```

### 6.2 Clawback Ledger Entries

```typescript
// lib/chargeback/applyClawback.ts
async function applyClawback(
  tx: PrismaTransactionClient,
  chargeback: Chargeback,
  paymentEvent: PaymentEvent
) {
  // Debit operator balance
  await tx.ledgerEntry.create({
    data: {
      type: 'chargeback_debit',
      amount: BigInt(-chargeback.amount),    // negative: reduces operator balance
      operatorId: chargeback.operatorId,
      bookingId: chargeback.bookingId,
      sourceEventId: `chargeback:${chargeback.id}:debit`,
      description: `Chargeback ${chargeback.pspCaseId} - ${chargeback.reason}`,
    },
  });

  // Record outflow to PSP/cardholder
  await tx.ledgerEntry.create({
    data: {
      type: 'chargeback_out',
      amount: BigInt(-chargeback.amount),    // negative: funds leaving platform
      operatorId: chargeback.operatorId,
      bookingId: chargeback.bookingId,
      sourceEventId: `chargeback:${chargeback.id}:out`,
      description: `Chargeback refund to cardholder via ${chargeback.pspAdapter}`,
    },
  });
}
```

### 6.3 Payout Deduction

The `settlePayout` cron (06-background-jobs) checks for outstanding clawback receivables before processing each operator's payout:

```typescript
// lib/payouts/settlePayout.ts -- clawback deduction
async function applyClawbackDeductions(
  tx: PrismaTransactionClient,
  operatorId: string,
  payoutAmount: bigint
): Promise<bigint> {
  const pendingClawbacks = await tx.clawbackReceivable.findMany({
    where: { operatorId, status: 'pending' },
    orderBy: { createdAt: 'asc' },
  });

  let remaining = payoutAmount;
  for (const clawback of pendingClawbacks) {
    if (remaining <= BigInt(0)) break;
    const deduction = remaining >= BigInt(clawback.amount)
      ? BigInt(clawback.amount)
      : remaining;
    remaining -= deduction;
    await tx.clawbackReceivable.update({
      where: { id: clawback.id },
      data: {
        status: deduction === BigInt(clawback.amount) ? 'applied' : 'partial',
        appliedAmount: Number(deduction),
      },
    });
  }

  return remaining;  // net payout after clawback deductions
}
```

### 6.4 Insufficient Balance Handling

If the operator's payout amount is less than the outstanding clawback:

| Scenario | Action |
|----------|--------|
| Payout >= clawback | Deduct full clawback from payout; mark receivable as `applied` |
| Payout < clawback | Deduct entire payout; mark receivable as `partial`; carry forward remainder |
| No pending payouts | Receivable remains `pending`; flag for admin after 30 days |
| Operator deactivated | Escalate to admin; manual recovery process |

**Source:** ADR-006 (BigInt arithmetic), 06-background-jobs (settlePayout cron).

---

## 7. Admin API

### 7.1 Route Table

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/admin/chargebacks` | GET | Admin JWT | List chargebacks with filters |
| `/api/admin/chargebacks/{id}` | GET | Admin JWT | Chargeback detail with booking, payment, operator context |
| `/api/admin/chargebacks/{id}/review` | PATCH | Admin JWT | Start review (transition `received` -> `under_review`) |
| `/api/admin/chargebacks/{id}/contest` | POST | Admin JWT | Submit evidence to PSP (transition `under_review` -> `contested`) |
| `/api/admin/chargebacks/{id}/resolve` | PATCH | Admin JWT | Accept or close (transition to terminal state) |
| `/api/admin/chargebacks` | POST | Admin JWT | Manually create chargeback (from PSP email notification) |

### 7.2 List Endpoint Filters

```typescript
// GET /api/admin/chargebacks query params
interface ChargebackListQuery {
  status?: ChargebackStatus;
  operatorId?: string;
  pspAdapter?: PaymentAdapter;
  reason?: ChargebackReason;
  dateFrom?: string;    // ISO date, filters on createdAt
  dateTo?: string;
  deadlineBefore?: string;  // filter chargebacks with deadline approaching
  page?: number;
  pageSize?: number;    // default 20, max 100
}
```

### 7.3 Detail Response

```typescript
// GET /api/admin/chargebacks/{id} response
interface ChargebackDetailResponse {
  chargeback: {
    id: string;
    status: ChargebackStatus;
    reason: ChargebackReason;
    amount: number;
    pspCaseId: string | null;
    pspAdapter: PaymentAdapter;
    responseDeadline: string;    // ISO datetime
    resolvedAt: string | null;
    resolvedBy: string | null;
    evidenceUrl: string | null;
    evidenceNote: string | null;
    createdAt: string;
  };
  booking: {
    id: string;
    bookingRef: string;
    status: BookingStatus;
    totalVnd: number;
    customerPhone: string;       // masked: +84***1234
    tripDate: string;
    routeName: string;
  };
  payment: {
    id: string;
    adapter: PaymentAdapter;
    providerTxnId: string;
    amount: number;
    paidAt: string;
  };
  operator: {
    id: string;
    name: string;
    contactPhone: string;        // masked
  };
  payoutStatus: {
    payoutId: string | null;
    status: PayoutStatus | null; // whether operator has already been paid out
    settledAt: string | null;
  };
  clawback: {
    receivableId: string | null;
    amount: number | null;
    status: string | null;       // pending, applied, partial
  } | null;
}
```

### 7.4 Contest Endpoint

```typescript
// POST /api/admin/chargebacks/{id}/contest
interface ContestRequest {
  evidenceUrl: string;      // URL to uploaded evidence document
  evidenceNote: string;     // admin description of evidence
}

// Response: updated Chargeback with status = 'contested'
```

### 7.5 Resolve Endpoint

```typescript
// PATCH /api/admin/chargebacks/{id}/resolve
interface ResolveRequest {
  resolution: 'accepted' | 'won' | 'lost';
  note?: string;
}

// 'accepted' → triggers clawback flow (SS6)
// 'won' → releases any held reserve; no financial impact
// 'lost' → triggers clawback flow (SS6)
```

### 7.6 Manual Creation

When PSPs do not provide programmatic chargeback webhooks, admin creates chargebacks manually from PSP notification emails:

```typescript
// POST /api/admin/chargebacks
interface CreateChargebackRequest {
  bookingRef: string;           // BB-XXXX-XXXX-XXXX booking reference
  pspCaseId?: string;           // PSP's dispute reference
  reason: ChargebackReason;
  amount: number;               // VND
  responseDeadline: string;     // ISO datetime -- PSP's evidence deadline
}
```

The handler resolves `bookingRef` to `bookingId`, `paymentEventId`, and `operatorId` from the Booking and PaymentEvent records.

**Source:** ADR-015 (error contract), 03-api-contract.

---

## 8. Cron: chargebackDeadlineMonitor

### 8.1 Schedule and Purpose

| Property | Value |
|----------|-------|
| Cron schedule | `0 9 * * *` (daily at 09:00 UTC+7 / 02:00 UTC) |
| Route | `/api/cron/chargeback-deadline` |
| Auth | `CRON_SECRET` bearer token |
| Max duration | 30 seconds |
| Purpose | Monitor approaching deadlines and auto-expire overdue chargebacks |

### 8.2 Processing Logic

```typescript
// lib/chargeback/chargebackDeadlineMonitor.ts
async function chargebackDeadlineMonitor(tx: PrismaTransactionClient) {
  const now = new Date();
  const warningThreshold = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 days

  // 1. Auto-expire overdue chargebacks
  const overdue = await tx.chargeback.findMany({
    where: {
      status: { in: ['RECEIVED', 'UNDER_REVIEW'] },
      responseDeadline: { lt: now },
    },
  });

  for (const cb of overdue) {
    await tx.chargeback.update({
      where: { id: cb.id },
      data: {
        status: 'EXPIRED',
        resolvedAt: now,
        resolvedBy: 'system:deadline-monitor',
      },
    });
    // Expired = auto-accepted; trigger clawback
    await applyClawback(tx, cb, /* paymentEvent */);
    await tx.booking.update({
      where: { id: cb.bookingId },
      data: { chargebackStatus: 'RESOLVED' },
    });
  }

  // 2. Warn on approaching deadlines
  const approaching = await tx.chargeback.findMany({
    where: {
      status: { in: ['RECEIVED', 'UNDER_REVIEW'] },
      responseDeadline: { gte: now, lt: warningThreshold },
    },
  });

  for (const cb of approaching) {
    await tx.notificationLog.create({
      data: {
        template: 'chargeback_deadline_warning',
        channel: 'admin_alert',
        recipientType: 'admin',
        recipientId: 'all',
        payload: {
          chargebackId: cb.id,
          bookingId: cb.bookingId,
          deadline: cb.responseDeadline.toISOString(),
          daysRemaining: Math.ceil(
            (cb.responseDeadline.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
          ),
        },
        status: 'pending',
      },
    });
  }

  return { expired: overdue.length, warned: approaching.length };
}
```

### 8.3 Response Contract

```json
{
  "job": "chargebackDeadlineMonitor",
  "status": "success",
  "rowsAffected": 3,
  "details": {
    "expired": 1,
    "warned": 2
  },
  "durationMs": 450
}
```

**Source:** 06-background-jobs (cron pattern, JobRunLog, response contract).

---

## 9. Webhook Integration

### 9.1 PSP Chargeback Notification

PSP chargeback webhooks, where available, follow the same processing pipeline as payment webhooks (05-webhook-design SS3.1) with a chargeback-specific adapter:

| PSP | Chargeback Webhook | Availability |
|-----|-------------------|--------------|
| VNPay | May provide chargeback notification callback (depends on merchant tier and contract) | Uncertain -- requires contract negotiation |
| MoMo | Dispute notification via MoMo Business API webhook | Uncertain -- depends on MoMo partnership level |
| VietQR | N/A (bank transfers are irrevocable) | N/A |

### 9.2 Webhook Route (If Available)

```
POST /api/payments/{psp}/chargeback
  │
  ├─ 1. HMAC verification (same adapter layer as payment webhooks)
  │
  ├─ 2. Zod validation (chargeback-specific schema)
  │
  ├─ 3. Normalize to canonical chargeback event
  │     └─ { bookingRef, amount, reason, pspCaseId, deadline }
  │
  ├─ 4. Booking lookup by bookingRef
  │     └─ NOT FOUND → HTTP 200 (no enumeration leak)
  │
  ├─ 5. Idempotency check: Chargeback with same pspCaseId + pspAdapter
  │     └─ EXISTS → HTTP 200 (duplicate, no-op)
  │
  ├─ 6. Create Chargeback record (status = 'received')
  │
  ├─ 7. Update Booking.chargebackStatus = 'ACTIVE'
  │
  └─ 8. Create admin notification (template = 'chargeback_received')
```

### 9.3 Manual Entry Fallback

Until PSP chargeback webhooks are confirmed available, the primary intake path is manual admin entry (SS7.6). The admin creates a Chargeback record from the PSP's email or portal notification. The same state machine and clawback flows apply regardless of intake method (webhook vs. manual).

**Source:** 05-webhook-design SS2-3, ADR-005 D4.

---

## 10. Split-Settlement Impact (DS-009)

### 10.1 Chargeback Responsibility Shift

Under the split-settlement marketplace model (DS-009), chargeback responsibility may shift:

| Settlement Model | Who Holds Funds | Chargeback Debited From | Platform Role |
|-----------------|----------------|------------------------|---------------|
| Central collection | Platform | Platform merchant account | Platform absorbs, then claws back from operator |
| Split-settlement | PSP settles directly to operator | Operator's sub-merchant account (potentially) | Platform facilitates dispute process only |

### 10.2 Implications

Under split-settlement, the PSP may debit the chargeback directly from the operator's sub-merchant settlement, bypassing the platform entirely. The platform's chargeback workflow must handle both scenarios:

1. **Central collection chargebacks**: Platform is debited; platform claws back from operator (SS6)
2. **Split-settlement chargebacks**: PSP debits operator directly; platform records the chargeback for audit trail but may not need to perform clawback (funds never passed through platform)

### 10.3 Hybrid Handling

```typescript
// lib/chargeback/resolveChargeback.ts
async function handleChargebackFinancials(
  tx: PrismaTransactionClient,
  chargeback: Chargeback,
  booking: Booking
) {
  if (booking.settlementModel === 'CENTRAL') {
    // Platform was debited by PSP; clawback from operator
    await applyClawback(tx, chargeback);
  } else {
    // Split-settlement: PSP debits operator directly
    // Record informational ledger entry only (no platform balance impact)
    await tx.ledgerEntry.create({
      data: {
        type: 'chargeback_operator_direct',
        amount: BigInt(0),  // no platform balance change
        operatorId: chargeback.operatorId,
        bookingId: chargeback.bookingId,
        sourceEventId: `chargeback:${chargeback.id}:direct`,
        description: `Chargeback debited directly from operator by ${chargeback.pspAdapter}`,
      },
    });
  }
}
```

**Source:** DS-009 (split-settlement migration), ADR-005 D1.

---

## 11. Booking State Impact

### 11.1 Chargeback vs. Booking Status

A chargeback does not automatically change the Booking's primary status (`paid`, `completed`, etc.). The `chargebackStatus` field tracks chargeback activity independently:

| Booking Status | Chargeback Event | Effect |
|---------------|-----------------|--------|
| `paid` (trip upcoming) | Chargeback received | `chargebackStatus = ACTIVE`. Trip still valid unless admin cancels. |
| `completed` (trip finished) | Chargeback received | `chargebackStatus = ACTIVE`. Post-trip dispute; service was delivered. |
| `cancelled` / `refunded` | Chargeback received | Log warning: chargeback on already-refunded booking. May indicate double-dip attempt. |

### 11.2 Fraud Detection Signal

Chargebacks with reason `fraud` on bookings where the customer completed the trip (`status = 'completed'`, passenger on manifest) are flagged as potential friendly fraud:

```typescript
// lib/chargeback/detectFriendlyFraud.ts
function isFriendlyFraudCandidate(
  chargeback: Chargeback,
  booking: Booking
): boolean {
  return (
    chargeback.reason === 'FRAUD' &&
    booking.status === 'completed' &&
    booking.departedAt !== null  // passenger confirmed on manifest
  );
}
```

Friendly fraud candidates are flagged in the admin dashboard for prioritized evidence collection (trip manifest, departure confirmation, SMS delivery records).

---

## 12. Notification Flow

### 12.1 Chargeback Notifications

| Event | Recipient | Channel | Template |
|-------|-----------|---------|----------|
| Chargeback received | Admin | Admin portal + email | `chargeback_received` |
| Deadline approaching (3 days) | Admin | Admin portal + email | `chargeback_deadline_warning` |
| Chargeback auto-expired | Admin + Operator | Admin portal + SMS | `chargeback_expired` |
| Chargeback accepted/lost | Operator | SMS + operator portal | `chargeback_accepted` |
| Chargeback won | Operator | SMS + operator portal | `chargeback_won` |
| Clawback applied to payout | Operator | SMS + operator portal | `clawback_applied` |

### 12.2 Operator Notification Content

Chargeback notifications to operators include:

- Booking reference (`BB-XXXX-XXXX-XXXX`)
- Chargeback amount (VND)
- Reason code (human-readable Vietnamese translation)
- Trip date and route
- Impact on next payout (if clawback applies)
- Action required (if evidence needed)

**Source:** ADR-013 (notification architecture).

---

## 13. Metrics and Monitoring

### 13.1 Key Metrics

| Metric | Description | Alert Threshold |
|--------|------------|-----------------|
| `chargeback_rate` | Chargebacks / total transactions (rolling 30 days) | > 0.5% (PSP may suspend merchant) |
| `chargeback_rate_per_operator` | Per-operator chargeback rate | > 1.0% (flag operator for review) |
| `chargeback_response_time_avg` | Average time from `received` to `contested`/`accepted` | > 5 days (process bottleneck) |
| `chargeback_win_rate` | Contested chargebacks won / total contested | < 30% (evidence quality issue) |
| `chargeback_expired_count` | Chargebacks auto-expired (deadline missed) | > 0 (process failure) |
| `clawback_outstanding_total` | Total pending clawback receivables (VND) | > 10,000,000 VND (escalate) |

### 13.2 PSP Chargeback Rate Thresholds

PSPs may suspend or terminate merchant accounts if chargeback rates exceed thresholds:

| PSP | Warning Threshold | Suspension Threshold |
|-----|-------------------|---------------------|
| VNPay (Visa/MC) | 0.65% | 1.0% |
| VNPay (domestic) | 1.0% | 2.0% |
| MoMo | 0.5% | 1.0% |

The `chargebackDeadlineMonitor` cron (SS8) calculates and logs the rolling chargeback rate. Threshold breaches create `AdminAuditLog` entries with severity `critical`.

**Source:** ADR-007 (observability).

---

## 14. Known Gaps

| Gap | Impact | Mitigation |
|-----|--------|------------|
| PSP chargeback webhook availability | VNPay and MoMo may not provide programmatic chargeback notification webhooks. Admin may need to create chargebacks manually from PSP email/portal notifications. | Manual creation endpoint (SS7.6) is the primary intake path until webhook availability is confirmed. |
| Evidence upload infrastructure | Dispute evidence (scanned documents, screenshots, manifests) requires file storage. No file upload infrastructure exists in the platform. | Use Vercel Blob or Cloudflare R2 for evidence files. Pre-signed upload URLs via admin API. |
| Reserve fund percentage calibration | Option B (escrow reserve) requires historical chargeback rate data to calibrate the reserve percentage. No transaction history exists yet. | Start with Option A (clawback). Collect chargeback rate data for 6 months before evaluating reserve model. |
| Split-settlement chargeback responsibility | Under marketplace model (DS-009), PSP may handle chargebacks directly with the operator's sub-merchant account. Platform's role may be limited to audit trail only. | Design chargeback workflow to support both central and split models (SS10). Confirm PSP chargeback routing during DS-009 Phase 1 contract negotiation. |
| Second presentment | After a contested chargeback is won, the cardholder can re-dispute (second presentment / pre-arbitration). This is rare but possible on Visa/MC. | Not modeled in Stage 0 state machine. Add `pre_arbitration` state if second presentment volume is non-zero. |
| Partial chargebacks | Some PSPs allow chargebacks for partial amounts (e.g., one seat out of a multi-seat booking). Current model assumes full-amount chargebacks. | `amount` field on Chargeback supports partial amounts. Ledger entries use actual chargeback amount, not booking total. |
| Customer communication | No customer-facing chargeback status page. Customer interacts with their bank/PSP directly. | Acceptable for Stage 0. Customer's primary interface is their bank or MoMo app, not the platform. |
| Chargeback arbitration fees | Visa/MC charge arbitration fees (USD 500+) if a contested chargeback goes to arbitration and the merchant loses. | Not modeled in Stage 0. At current volume, arbitration is unlikely. Flag for inclusion when international card volume grows. |
| Refund-chargeback interaction | Customer may request a refund (DS-007) AND file a chargeback simultaneously, resulting in double recovery. | `chargebackStatus = ACTIVE` on Booking should block new refund initiation. Admin must check refund history when reviewing chargebacks. |
| Operator-initiated evidence | Current design has admin submitting evidence. Operators may want to submit their own evidence (trip manifests, boarding records). | Add operator-facing chargeback detail endpoint in future iteration. Admin reviews and forwards to PSP. |
