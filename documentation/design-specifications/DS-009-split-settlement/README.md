# DS-009 -- Split-Settlement Migration Design

## 1. Overview

This document defines the migration path from a central collection payment model to PSP split-settlement (marketplace model) for the BusBooking platform -- a multi-tenant Vietnam bus booking marketplace. The central collection model, in which all customer payments flow through a single platform merchant account before operator payout, creates critical regulatory exposure under SBV Decree 52/2024 Art. 3(17): the platform is performing "thu ho/chi ho" (collect and remit) functions that require an Intermediary Payment Services (IPS) license. The split-settlement migration eliminates this classification by instructing the PSP to split each payment at source -- operator share to the operator's bank account, platform commission to the platform account -- so the platform never holds customer funds.

**Source ADRs.** This document synthesizes decisions from ADR-004 D2 (multi-tenancy tenant isolation), ADR-005 D1 (payment architecture, PSP adapter layer), ADR-006 (pricing/currency, VND integer arithmetic, BigInt platform fee computation). Business context from regulatory/payment.md (IPS license risk rated CRITICAL/CERTAIN), regulatory/compliance-timeline.md, business/market-research/regulatory-compliance.md.

**Cross-references.** 01-data-model-design for `PaymentEvent`, `LedgerEntry`, `Payout`, `Operator` entity schemas. 03-api-contract for payment route namespace and middleware auth chain. 05-webhook-design for webhook processing pipeline and adapter normalization layer. 06-background-jobs for `settlePayout` cron and payout lifecycle.

---

## 2. Current State -- Central Collection

### 2.1 Payment Flow

All customer payments currently flow through a single platform-owned merchant account at each PSP:

```
Customer ──► PSP (VNPay / MoMo / Bank Transfer)
                 │
                 ▼
         Platform Merchant Account
         (single tmnCode / partnerCode)
                 │
                 ├─ 100% of payment amount collected
                 │
                 ▼
         Platform holds funds
                 │
                 ├─ Deducts platform fee (6% default, BigInt arithmetic)
                 │
                 ▼
         Operator payout (T+1 after trip completion)
```

### 2.2 PSP Credentials

| PSP | Credential | Scope |
|-----|-----------|-------|
| VNPay | Single `tmnCode` + `hashSecret` | All operators, all bookings |
| MoMo | Single `partnerCode` + `accessKey` + `secretKey` | All operators, all bookings |
| Bank transfer (VietQR + SePay) | Single bank account (platform) | All operators, all bookings |

### 2.3 Regulatory Risk

The central collection model carries the highest regulatory risk identified in the platform's compliance assessment:

| Risk Factor | Assessment |
|-------------|------------|
| SBV classification | "Thu ho/chi ho" (collect and remit) under Decree 52/2024 Art. 3(17) |
| License required | Intermediary Payment Services (IPS) license |
| Risk rating | CRITICAL / CERTAIN |
| Consequence | Cease-and-desist order, fines up to 200M VND per violation, forced platform shutdown |
| Mitigation | Migrate to PSP split-settlement (marketplace model) |

The platform collects 100% of customer funds, holds them (however briefly), and then remits the operator share. Under SBV's interpretation, this constitutes payment intermediary activity regardless of hold duration.

**Source:** ADR-005 D1, regulatory/payment.md, business/market-research/regulatory-compliance.md.

---

## 3. Target State -- Split-Settlement (Marketplace Model)

### 3.1 Payment Flow

Under split-settlement, the PSP splits each payment at source according to instructions embedded in the payment request:

```
Customer ──► PSP (VNPay / MoMo)
                 │
                 ├─ Split instruction in payment request
                 │
                 ▼
         PSP splits at settlement:
                 │
                 ├─ Operator share (94%) ──► Operator Bank Account
                 │
                 └─ Platform fee (6%)   ──► Platform Bank Account
```

### 3.2 Key Properties

| Property | Central Collection | Split-Settlement |
|----------|-------------------|-----------------|
| Fund custody | Platform holds 100% | PSP splits at source; platform never holds customer funds |
| Operator credentials | Platform credentials only | Per-operator sub-merchant registration at PSP |
| Settlement | Platform → Operator (T+1 payout cron) | PSP → Operator directly (PSP settlement cycle) |
| Platform revenue | Deducted from pooled funds | Received as commission split from PSP |
| IPS license | Required | Not required -- platform is technology provider |
| Regulatory model | Payment intermediary | E-commerce marketplace platform (Decree 85/2021) |

### 3.3 Regulatory Reclassification

Under split-settlement, the platform's regulatory classification changes:

- **From:** Payment intermediary performing "thu ho/chi ho" (Decree 52/2024) -- requires IPS license
- **To:** E-commerce marketplace platform (Decree 85/2021) providing technology services -- requires e-commerce platform registration only
- **Platform revenue model:** B2B commission invoicing to operators (VAT invoice for platform fee), not deduction from pooled customer funds

**Source:** ADR-005 D1, ADR-004 D2.

---

## 4. VNPay Marketplace Integration

### 4.1 Sub-Merchant Registration

VNPay's marketplace model allows a master merchant (the platform) to register sub-merchants (operators) under its merchant agreement. Each operator receives a unique sub-merchant identifier.

| Step | Actor | Action | Timeline |
|------|-------|--------|----------|
| 1 | Operator | Provides business license, bank account details via operator portal | Day 0 |
| 2 | Platform | Submits sub-merchant registration via VNPay Merchant Management API | Day 0 |
| 3 | VNPay | KYB verification (business license, bank account ownership) | 3-5 business days |
| 4 | VNPay | Issues `subMerchantId` for operator | Day 3-5 |
| 5 | Platform | Updates `OperatorPspAccount` record to `ACTIVE` | Day 3-5 |

### 4.2 Payment Request with Split Instruction

The VNPay adapter embeds split instructions in the payment URL generation request:

```typescript
// lib/payment/adapters/vnpay.ts -- split-settlement payment request
interface VnPaySplitParams {
  vnp_TmnCode: string;            // platform master tmnCode
  vnp_Amount: number;             // total amount in VND * 100
  vnp_OrderInfo: string;          // booking reference
  vnp_SubMerchantId: string;      // operator's sub-merchant ID
  vnp_PlatformFee: number;        // platform fee in VND * 100
  // ... standard VNPay params (vnp_ReturnUrl, vnp_IpAddr, etc.)
}
```

### 4.3 Settlement Flow

| Leg | Amount | Destination | Timing |
|-----|--------|------------|--------|
| Operator share | `totalAmount - platformFee` | Operator's registered bank account | VNPay T+1 settlement cycle |
| Platform fee | `platformFee` | Platform's bank account | VNPay T+1 settlement cycle |

### 4.4 HMAC Verification

Split-settlement webhooks use the same HMAC SHA-512 verification as the current webhook pipeline (05-webhook-design SS2.1). The webhook payload may include additional fields for split details (`vnp_SubMerchantId`, `vnp_PlatformFeeAmount`). The adapter normalization step (05-webhook-design SS3.1 step 3) extracts and validates these.

**Source:** ADR-005 D1, 05-webhook-design SS2-3.

---

## 5. MoMo Marketplace Integration

### 5.1 Sub-Partner Registration

MoMo's marketplace model uses sub-partner codes under the platform's master partner agreement:

| Step | Actor | Action | Timeline |
|------|-------|--------|----------|
| 1 | Operator | Provides business license, bank account, MoMo merchant info via operator portal | Day 0 |
| 2 | Platform | Submits sub-partner registration via MoMo Business API | Day 0 |
| 3 | MoMo | KYB verification | 3-7 business days |
| 4 | MoMo | Issues `subPartnerCode` for operator | Day 3-7 |
| 5 | Platform | Updates `OperatorPspAccount` record to `ACTIVE` | Day 3-7 |

### 5.2 Payment Request with Split Instruction

```typescript
// lib/payment/adapters/momo.ts -- split-settlement payment request
interface MoMoSplitParams {
  partnerCode: string;             // platform master partnerCode
  subPartnerCode: string;          // operator's sub-partner code
  amount: number;                  // total amount in VND
  platformFee: number;             // platform fee in VND
  orderInfo: string;               // booking reference
  requestId: string;               // idempotency key
  // ... standard MoMo AIO v3 params
}
```

### 5.3 Settlement Flow

| Leg | Amount | Destination | Timing |
|-----|--------|------------|--------|
| Operator share | `amount - platformFee` | Operator's registered bank account | MoMo settlement cycle (T+1 to T+3) |
| Platform fee | `platformFee` | Platform's bank account | MoMo settlement cycle |

### 5.4 HMAC Verification

Split-settlement IPN callbacks use the same HMAC SHA-256 verification as the current pipeline (05-webhook-design SS2.1). Additional fields (`subPartnerCode`, `platformFeeAmount`) are included in the signature base string per MoMo's AIO v3 specification.

**Source:** ADR-005 D1, 05-webhook-design SS2-3.

---

## 6. Data Model Changes

### 6.1 OperatorPspAccount Entity

A new entity tracks each operator's sub-merchant registration at each PSP:

```prisma
model OperatorPspAccount {
  id          String           @id @default(cuid())
  operatorId  String
  adapter     PaymentAdapter   // vnpay, momo, zalopay
  merchantId  String           // sub-merchant ID / sub-partner code at PSP
  status      PspAccountStatus // PENDING, ACTIVE, SUSPENDED, REVOKED
  bankAccount String           // masked for display (e.g. "****6789")
  metadata    Json?            // PSP-specific fields (e.g. VNPay terminal ID)
  verifiedAt  DateTime?
  revokedAt   DateTime?
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt

  operator    Operator         @relation(fields: [operatorId], references: [id])

  @@unique([operatorId, adapter])
  @@index([status])
}
```

### 6.2 PspAccountStatus Enum

```prisma
enum PspAccountStatus {
  PENDING    // registration submitted to PSP, awaiting KYB approval
  ACTIVE     // KYB approved, ready for split-settlement transactions
  SUSPENDED  // temporarily disabled (compliance hold, operator request)
  REVOKED    // permanently disabled (fraud, operator deactivation)
}
```

### 6.3 Settlement Model Discriminator

To support the parallel-run period where both central-collection and split-settlement bookings coexist:

```prisma
enum SettlementModel {
  CENTRAL    // legacy: platform collects 100%, pays out to operator
  SPLIT      // marketplace: PSP splits at source
}
```

Add `settlementModel SettlementModel @default(CENTRAL)` to the `Booking` model. This field is set at booking creation time based on operator's `OperatorPspAccount` status and determines which ledger entry pattern applies.

### 6.4 Payment URL Generation Change

The `createPaymentUrl` function (called during hold-to-booking transition) must resolve the operator's PSP sub-merchant ID:

```typescript
// lib/payment/createPaymentUrl.ts
async function resolveOperatorPspAccount(
  tx: PrismaTransactionClient,
  operatorId: string,
  adapter: PaymentAdapter
): Promise<{ merchantId: string; settlementModel: 'CENTRAL' | 'SPLIT' }> {
  const account = await tx.operatorPspAccount.findUnique({
    where: { operatorId_adapter: { operatorId, adapter } },
  });

  if (account?.status === 'ACTIVE') {
    return { merchantId: account.merchantId, settlementModel: 'SPLIT' };
  }

  // Fallback to central collection (operator not yet onboarded)
  return { merchantId: ENV.PLATFORM_MERCHANT_ID, settlementModel: 'CENTRAL' };
}
```

**Source:** ADR-005 D1, ADR-004 D2, 01-data-model-design.

---

## 7. Migration Path -- Parallel Run

The migration from central collection to split-settlement follows a five-phase rollout to avoid disrupting live bookings:

### 7.1 Phase Summary

| Phase | Description | Duration | Rollback |
|-------|------------|----------|----------|
| Phase 1 | Platform marketplace registration with PSPs | 2-4 weeks | N/A (no code change) |
| Phase 2 | Operator sub-merchant onboarding (KYB flow) | Ongoing | Operators remain on central collection |
| Phase 3 | Parallel run -- new bookings for onboarded operators use split-settlement | 2-4 weeks | Feature flag off reverts to central |
| Phase 4 | Cutover -- all new payments through split-settlement | 1 week | Revert feature flag |
| Phase 5 | Decommission central collection payout path | After chargeback window closes | Forward-only |

### 7.2 Phase 1 -- Platform Marketplace Registration

- Register platform as a marketplace/aggregator merchant with VNPay and MoMo
- Negotiate marketplace contract terms (split-settlement fees, settlement cycles)
- Obtain API credentials for sub-merchant management endpoints
- No code deployment; purely contractual

### 7.3 Phase 2 -- Operator Sub-Merchant Onboarding

- Add `OperatorPspAccount` model and migration
- Build operator portal KYB flow: operator submits business license + bank account details
- Platform calls PSP sub-merchant registration API
- Webhook or polling for KYB approval status
- Operator dashboard shows PSP account status per adapter

### 7.4 Phase 3 -- Parallel Run

- Feature flag: `SPLIT_SETTLEMENT_ENABLED` (per-operator override via `FeatureFlag` model)
- `createPaymentUrl` checks operator's `OperatorPspAccount` status:
  - `ACTIVE` + feature flag on: embed split instruction, set `Booking.settlementModel = 'SPLIT'`
  - Otherwise: use central collection credentials, set `Booking.settlementModel = 'CENTRAL'`
- Both settlement models coexist in the same deployment
- `settlePayout` cron handles both models (see SS10)

### 7.5 Phase 4 -- Cutover

- Require all operators to have `ACTIVE` PSP accounts before accepting new bookings
- Default `settlementModel` to `SPLIT` for all new bookings
- Central collection path remains for in-flight bookings created before cutover
- Monitor split-settlement webhook success rate, reconciliation discrepancies

### 7.6 Phase 5 -- Decommission

- After the longest chargeback window (90 days for international cards via VNPay) has passed for the last central-collection booking:
  - Remove central collection code paths
  - Remove `CENTRAL` enum value from `SettlementModel` (migration adds CHECK constraint)
  - Archive historical central-collection ledger entries (read-only, no deletion)

**Source:** ADR-005 D1, ADR-004 D2.

---

## 8. Ledger Impact

### 8.1 Entry Type Changes

The append-only double-entry ledger (`LedgerEntry` model, `sourceEventId` unique) uses different entry patterns for each settlement model:

#### Central Collection (Current)

```
PaymentEvent(paid) triggers:
  LedgerEntry: booking_credit     +500,000 VND  (platform account)
  LedgerEntry: platform_fee       -30,000  VND  (6% deducted)

settlePayout cron triggers:
  LedgerEntry: payout_debit       -470,000 VND  (platform account → operator bank)
```

Under central collection, the platform temporarily holds the full amount. The ledger reflects 100% credit followed by fee deduction and payout.

#### Split-Settlement (Target)

```
PaymentEvent(paid) triggers:
  LedgerEntry: platform_fee_credit  +30,000  VND  (platform commission received from PSP)
  LedgerEntry: operator_settled      +470,000 VND  (informational: operator share settled by PSP)
```

Under split-settlement, the platform never holds the operator's share. The `operator_settled` entry is informational (not a platform balance change) -- it records that the PSP settled the operator's share directly. The `platform_fee_credit` is the only balance-affecting entry for the platform.

### 8.2 Entry Type Enum Extension

```typescript
// lib/ledger/entryTypes.ts
type LedgerEntryType =
  // Central collection (existing)
  | 'booking_credit'
  | 'platform_fee'
  | 'payout_debit'
  | 'payout_reversal'
  // Split-settlement (new)
  | 'platform_fee_credit'     // platform commission received via PSP split
  | 'operator_settled'        // informational: PSP settled operator share directly
  // Chargeback (see DS-010)
  | 'chargeback_debit'
  | 'chargeback_out';
```

### 8.3 Ledger Routing Logic

```typescript
// lib/ledger/writeLedgerEntries.ts
function getLedgerPattern(booking: { settlementModel: SettlementModel }) {
  switch (booking.settlementModel) {
    case 'CENTRAL':
      return centralCollectionPattern;   // existing: booking_credit + platform_fee
    case 'SPLIT':
      return splitSettlementPattern;     // new: platform_fee_credit + operator_settled
  }
}
```

The `settlementModel` field on the Booking determines which ledger pattern fires on the paid webhook. Both patterns are immutable once written. During the parallel run, the ledger contains a mix of both patterns, distinguishable by entry type.

### 8.4 Reconciliation

A daily reconciliation cron compares:
- Platform-side `platform_fee_credit` entries against PSP settlement reports
- Operator-side `operator_settled` entries against PSP settlement confirmations
- Discrepancies flagged for admin review via `AdminAuditLog`

**Source:** ADR-006, ADR-005 D1, 01-data-model-design (LedgerEntry), 06-background-jobs.

---

## 9. Webhook Changes

### 9.1 Split Details in Webhook Payload

Split-settlement webhooks from VNPay and MoMo may contain additional fields indicating the split amounts:

| PSP | Additional Webhook Fields |
|-----|--------------------------|
| VNPay | `vnp_SubMerchantId`, `vnp_MerchantAmount`, `vnp_PlatformFeeAmount` |
| MoMo | `subPartnerCode`, `merchantAmount`, `platformFeeAmount` |

### 9.2 Split Amount Verification

The webhook processing pipeline (05-webhook-design SS3.1) gains a new verification step between step 5 (PaymentEvent INSERT) and step 6 (status-dependent transition):

```
Step 5.5: Split amount verification (split-settlement bookings only)
  ├─ Compute expected: operatorShare = totalAmount - platformFee(booking)
  ├─ Compare: webhook.merchantAmount === expected operatorShare
  ├─ Compare: webhook.platformFeeAmount === expected platformFee
  ├─ MATCH → proceed to step 6
  └─ MISMATCH → log structured warning, create AdminAuditLog entry,
                 hold booking in 'payment_received_review' status,
                 do NOT auto-transition to 'paid'
```

### 9.3 Adapter Normalization Extension

The adapter normalization layer (05-webhook-design SS3.1 step 3) extends the canonical result with optional split fields:

```typescript
interface WebhookNormalized {
  status: 'paid' | 'failed';
  providerTxnId: string;
  amount: number;           // total amount VND
  currency: string;
  // Split-settlement fields (optional, present only for split-settlement txns)
  splitDetails?: {
    merchantAmount: number;      // operator share VND
    platformFeeAmount: number;   // platform fee VND
    subMerchantId: string;       // operator's PSP sub-merchant ID
  };
}
```

**Source:** 05-webhook-design SS3, ADR-005 D4.

---

## 10. Payout Flow Impact

### 10.1 Central Collection Payout (Current)

Under central collection, the `settlePayout` cron (06-background-jobs) performs actual money movement:

```
settlePayout cron (T+1 after trip completion):
  1. Query Payout WHERE status = 'requested'
  2. Initiate bank transfer from platform account to operator bank account
  3. Transition Payout: requested → processing → paid
  4. Write LedgerEntry: payout_debit
```

### 10.2 Split-Settlement Payout (Target)

Under split-settlement, the PSP has already settled funds to the operator at T+0. The payout cron changes from "transfer money" to "confirm settlement received":

```
settlePayout cron (T+1 after trip completion):
  1. Query Payout WHERE status = 'requested' AND settlementModel = 'SPLIT'
  2. Verify PSP settlement report confirms operator received funds
  3. Transition Payout: requested → paid (no money movement by platform)
  4. Write LedgerEntry: settlement_confirmed (informational)
```

### 10.3 T+1 Delay Rationale

The T+1 delay is retained even under split-settlement:

| Reason | Explanation |
|--------|------------|
| Dispute buffer | Customer may dispute within hours of payment; T+1 allows cancellation before operator settlement finalizes |
| Reconciliation window | Platform verifies PSP settlement report matches expected amounts before confirming |
| Chargeback early detection | Some chargebacks arrive within 24 hours (see DS-010) |

### 10.4 Mixed-Model Handling

During the parallel run (Phase 3-4), the `settlePayout` cron handles both models:

```typescript
// lib/payouts/settlePayout.ts
for (const payout of pendingPayouts) {
  if (payout.booking.settlementModel === 'CENTRAL') {
    await settleViaBankTransfer(tx, payout);   // existing path
  } else {
    await confirmSplitSettlement(tx, payout);  // new path: verify PSP report only
  }
}
```

**Source:** 06-background-jobs (settlePayout), ADR-005 D1.

---

## 11. Regulatory Impact

### 11.1 License Elimination

| Requirement | Central Collection | Split-Settlement |
|-------------|-------------------|-----------------|
| IPS license (Decree 52/2024) | Required -- platform is payment intermediary | Not required -- platform is technology provider |
| E-commerce platform registration (Decree 85/2021) | Required | Required |
| MOET notification for online service | Required | Required |
| Commission invoicing | Deduction from pooled funds (problematic) | B2B VAT invoice to operator (standard) |

### 11.2 Invoicing Model Change

Under central collection, the platform deducts its fee from pooled funds before paying the operator -- an accounting arrangement that mirrors payment intermediary behavior. Under split-settlement:

1. PSP settles operator share directly to operator's bank account
2. Platform issues a B2B VAT invoice to operator for the commission amount (6% of booking value)
3. Operator pays platform commission per invoice terms (or platform receives commission split from PSP directly)
4. Standard B2B commercial relationship -- no "thu ho/chi ho" characterization

### 11.3 Residual Compliance Requirements

Split-settlement eliminates the IPS license requirement but does not eliminate all regulatory obligations:

| Obligation | Status |
|-----------|--------|
| E-commerce platform registration (Decree 85/2021) | Required -- platform operates an online marketplace |
| Tax withholding on operator payments | May apply depending on operator tax status (see DS-011) |
| E-invoice for commission (Decree 123/2020) | Required -- platform issues e-invoice for each commission charge |
| Data privacy (PDPA when enacted) | Required -- customer PII handling unchanged |
| Consumer protection (Law on Consumer Rights 2023) | Required -- refund/cancellation policies unchanged |

**Source:** ADR-005 D1, regulatory/payment.md, regulatory/compliance-timeline.md.

---

## 12. Bank Transfer Considerations

> **Updated 2026-06-20**: Bank transfer now uses SePay webhook for confirmation (push-based, 5-30s). However, it remains a direct bank-transfer-based payment with no PSP-level split-settlement capability.

Bank transfer (VietQR + SePay) settles directly to the platform's Agribank account. No PSP-level split-settlement is possible. Under the marketplace model:

| Option | Description | Recommendation |
|--------|------------|----------------|
| Option A | Keep central collection for bank transfer only | Acceptable if bank transfer volume is low (<10% of transactions). Platform still performs "thu ho/chi ho" for these transactions only. Regulatory risk is proportionally lower but not zero. |
| Option B | Deprecate bank transfer as a payment method | Eliminates residual IPS risk entirely. Customer impact depends on bank transfer adoption rate. |
| Option C | Route bank transfer payments to operator's bank account directly | Customer transfers directly to operator. Platform loses visibility and reconciliation capability. Not recommended. |

**Stage 0 recommendation:** Option A (keep bank transfer on central collection) with volume monitoring. If bank transfer exceeds 10% of transaction volume, escalate to legal counsel for IPS license risk re-assessment. Document the carve-out in the operator agreement.

**Source:** ADR-005 D4, DS-013 (SePay webhook design).

---

## 13. Operator Onboarding Impact

### 13.1 KYB Flow Extension

Split-settlement adds PSP-specific KYB requirements to the operator onboarding flow:

| Current Onboarding | Additional for Split-Settlement |
|--------------------|---------------------------------|
| Business license upload | Same (shared with PSP) |
| Bank account verification | PSP verifies bank account ownership independently |
| Platform approval | PSP approval (3-7 business days per PSP) |
| Single step | Per-PSP registration (operator may need accounts at multiple PSPs) |

### 13.2 Onboarding State Machine

```
operator_created → kyb_submitted → kyb_approved → psp_registration_pending
                                                        │
                    ┌───────────────────────────────────┘
                    │
                    ├─ PSP approves → psp_active (can accept bookings via this PSP)
                    │
                    └─ PSP rejects → psp_rejected (re-submit with corrections)
```

An operator can be `psp_active` for one PSP and `psp_registration_pending` for another. Bookings are routed to PSPs where the operator has an active sub-merchant account.

### 13.3 Fallback During Onboarding

During Phase 3 (parallel run), operators without active PSP accounts continue to use central collection. The operator dashboard displays PSP account status and prompts operators to complete registration.

---

## 14. Known Gaps

| Gap | Impact | Mitigation |
|-----|--------|------------|
| VNPay marketplace API availability | VNPay may not offer sub-merchant/marketplace API to all merchant tiers. Requires contract negotiation. | Engage VNPay sales during Phase 1. Fallback: VNPay-facilitated settlement (manual split). |
| MoMo marketplace API availability | MoMo Business API sub-partner registration may have eligibility requirements. | Engage MoMo partnership team during Phase 2. |
| Bank transfer split-settlement impossibility | Bank transfer (VietQR + SePay) is direct bank-transfer-based; no PSP-level split. Must keep central collection or deprecate. | Option A (SS12) with volume monitoring. |
| ZaloPay marketplace support | ZaloPay integration is planned (DS-008) but marketplace capability unknown. | Defer to DS-008 timeline; evaluate ZaloPay sub-merchant API availability. |
| Operator onboarding friction | Each operator must complete PSP KYB separately (3-7 business days per PSP). May delay go-live. | Batch onboarding for existing operators in Phase 2; new operators onboard as part of platform registration. |
| Transition period accounting | Mixed `CENTRAL` and `SPLIT` ledger entries during parallel run increase reconciliation complexity. | Clear `settlementModel` discriminator on Booking; separate reconciliation reports per model. |
| PSP settlement timing variance | PSP settlement cycles (T+1 to T+3) may not align with platform's T+1 payout expectation. | `settlePayout` cron must tolerate PSP settlement delays; add `settlement_pending` intermediate status if needed. |
| Commission VAT invoicing automation | Under split-settlement, platform must issue B2B VAT e-invoices to operators for commission. Requires integration with e-invoice provider. | Cross-reference DS-012 (transport e-invoice) for e-invoice infrastructure; extend to commission invoicing. |
| Chargeback responsibility under split-settlement | Under marketplace model, PSP may route chargebacks directly to operator. Platform's chargeback workflow (DS-010) may need PSP-specific handling. | Design chargeback flow to support both central and split-settlement models. |
| Rate negotiation | Platform fee split ratio must be agreed with each PSP (PSP may charge marketplace facilitation fee). | Factor PSP marketplace fee into platform fee calculation; may affect the 6% default rate. |
