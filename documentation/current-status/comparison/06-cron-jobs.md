# Cron Jobs — Spec vs Reality

Comparison of DS-006 Section 4.1 job catalog against `documentation/current-status/23-api-cron-dev.md`.

---

## Job Status Matrix

| # | Job Name | Route | Schedule (DS-006) | Status |
|---|---|---|---|---|
| 1 | `expireHolds` | `/api/cron/sweep-holds` | Every 1 min | IMPLEMENTED |
| 2 | `closeSales` | `/api/cron/close-sales` | Every 1 min | IMPLEMENTED |
| 3 | `notificationDispatch` | `/api/cron/dispatch-notifications` | Every 1 min | IMPLEMENTED |
| 4 | `ticketPdfGeneration` | `/api/cron/generate-ticket-pdfs` | Every 2 min | IMPLEMENTED |
| 5 | `autoCompleteTrips` | `/api/cron/complete-trips` | Every 5 min | IMPLEMENTED |
| 6 | `settlePayout` | `/api/cron/process-payouts` | Every 5 min | IMPLEMENTED |
| 7 | `einvoiceSubmission` | `/api/cron/einvoice` | Every 5 min | IMPLEMENTED |
| 8 | `sendReminders` | `/api/cron/send-reminders` | Every 15 min | IMPLEMENTED |
| 9 | `charterExpirySweeper` | `/api/cron/charter-expiry` | Every 15 min | IMPLEMENTED |
| 10 | `reconcilePayments` | `/api/cron/reconcile-payments` | Every 15 min | IMPLEMENTED |
| 11 | `generateFromTemplate` | `/api/cron/generate-trips` | Daily 01:00 VN | IMPLEMENTED |
| 12 | `piiAnonymization` | `/api/cron/retention` | Daily 03:00 VN | PARTIAL (route exists, service completeness unclear) |
| 13 | `operatorLicenseAlert` | `/api/cron/operator-license-alert` | Daily | NOT IMPLEMENTED |
| 14 | `kybDocumentPurge` | `/api/cron/kyb-doc-purge` | Periodic | NOT IMPLEMENTED |
| 15 | `complaintSlaMon` | `/api/cron/complaint-sla-monitor` | Hourly | NOT IMPLEMENTED |
| 16 | `subscriptionBilling` | `/api/cron/subscription-billing` | Daily | NOT IMPLEMENTED |

**Score:** 11 fully implemented + 1 partial = 12/16 (75%)

---

## Implemented Jobs — Detail

### 1. expireHolds (sweep-holds)
- **Purpose:** Expire active holds past TTL, restore seat capacity to trip
- **Spec note:** `HOLD_SWEEPER_MODE` defaults to `count` (dry-run). Must set to `sweep` for production.
- **Risk:** If left in `count` mode, holds never expire → phantom capacity accumulation
- **Status:** IMPLEMENTED but needs production config verification

### 2. closeSales (close-sales)
- **Purpose:** Trips within departure window → set `salesClosed=true`, block new bookings
- **Status:** IMPLEMENTED

### 3. notificationDispatch (dispatch-notifications)
- **Purpose:** Process pending `NotificationLog` entries → send via eSMS/Resend with exponential backoff
- **Dependency:** Requires `NOTIFY_STUB=false` for real SMS dispatch
- **Status:** IMPLEMENTED (stub mode by default)

### 4. ticketPdfGeneration (generate-ticket-pdfs)
- **Purpose:** Paid bookings → generate ticket PDF via `@react-pdf/renderer` → upload to storage
- **Status:** IMPLEMENTED

### 5. autoCompleteTrips (complete-trips)
- **Purpose:** Departed trips past completion window → transition to `completed` status
- **Writes:** `completedAt` timestamp + `status: 'completed'` in same update (Mistake Log Issue 014 rule)
- **Status:** IMPLEMENTED

### 6. settlePayout (process-payouts)
- **Purpose:** Process pending operator withdrawal requests → `requested -> processing -> settled/failed`
- **Spec gaps in implementation:**
  - `calcWithholding()` NOT integrated (FI-010 Section 7.6) — payouts compute without tax deduction
  - Stranded `processing` payout auto-recovery NOT implemented (SI-006 Known Gap)
  - T+1 settlement delay: IMPLEMENTED
  - `FOR UPDATE SKIP LOCKED` batch processing: IMPLEMENTED
- **Status:** IMPLEMENTED (missing tax withholding)

### 7. einvoiceSubmission (einvoice)
- **Purpose:** Pending `EInvoice` records → submit to MISA API → transition to `issued`/`failed`
- **Spec gap:** Transport-specific fields (`vehiclePlate`, `departureCity`, `destinationCity`, `operatorMst`) NOT mapped to MISA payload (FI-015, Decree 70/2025)
- **Status:** IMPLEMENTED (missing transport field mapping)

### 8. sendReminders (send-reminders)
- **Purpose:** Departure-eve and day-of booking reminders via SMS
- **Status:** IMPLEMENTED

### 9. charterExpirySweeper (charter-expiry)
- **Purpose:** Expired charter requests → state transition to expired status
- **Status:** IMPLEMENTED

### 10. reconcilePayments (reconcile-payments)
- **Purpose:** Reconcile payment records against PSP/bank records
- **Note:** DS-013 demoted `paymentReconSweeper` to optional backup — this route may serve a different reconciliation purpose
- **Status:** IMPLEMENTED

### 11. generateFromTemplate (generate-trips)
- **Purpose:** Auto-generate Trip rows from `RecurringTripTemplate` records, 14-day horizon
- **Status:** IMPLEMENTED

---

## Missing Jobs — Detail

### 13. operatorLicenseAlert — NOT IMPLEMENTED
- **Purpose:** Check operator transport license expiry dates, send renewal reminders
- **Spec ref:** SI-006 Section 5.2
- **Severity:** LOW (operational convenience, not revenue-blocking)
- **Model support:** `Operator` model has license-related fields
- **Resolution:** Implement route + service. Low priority.

### 14. kybDocumentPurge — NOT IMPLEMENTED
- **Purpose:** Purge KYB documents past retention period (approved operators, documents no longer needed)
- **Spec ref:** DS-006 Section 4.1
- **Severity:** LOW (storage cost, compliance hygiene)
- **Resolution:** Implement route. Delete or anonymize `KybDocument` records past retention.

### 15. complaintSlaMon — NOT IMPLEMENTED
- **Purpose:** Monitor complaint resolution against SLA (3-day acknowledge, 30-day resolve per CPL 2023)
- **Spec ref:** DS-006 Section 4.1
- **Severity:** LOW (compliance monitoring, not enforcement)
- **Resolution:** Implement route. Query unresolved complaints past SLA → alert admin.

### 16. subscriptionBilling — NOT IMPLEMENTED
- **Purpose:** Process operator subscription billing (if subscription-based pricing model adopted)
- **Spec ref:** DS-006 Section 4.1
- **Severity:** LOW (future feature, not current pricing model)
- **Resolution:** Defer until subscription pricing is implemented. Current model uses per-booking commission.

---

## Cron Configuration Parity

**Spec says (SI-006 Section 4.3):**
- Dual-config maintenance: `vercel.json` (Vercel staging) AND `deploy/crontab` (FPT sidecar) must stay in sync
- Canonical schedule source: DS-006 Section 4.1
- KG-26: No automated parity check exists

**Reality:**
- `vercel.json` has cron configuration for Vercel deployment
- `deploy/crontab` has cron configuration for FPT sidecar (supercronic)
- No automated check that both files define the same set of routes with equivalent schedules

**Gap:** Config drift between staging (Vercel) and production (FPT) cron schedules is possible.

**Resolution:** Add G9 greppable invariant check to CI (KG-26).
