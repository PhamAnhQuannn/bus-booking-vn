# FI-012: Admin Console (Cong quan tri he thong)

> **Status:** DOCUMENTED
> **Last Updated:** 2026-06-20
> **Related:** ADR-004, ADR-012, ADR-016, ADR-019, DS-001, DS-003, DS-006, DS-010, DS-014, FD-026

## Overview

The Admin Console (`/admin/`) is the internal operations portal for platform admin roles (`SUPER_ADMIN`, `FINANCE`, `SUPPORT`) governing operator lifecycle management (KYB approval, suspension, reinstatement), content moderation (trips, routes, reviews), financial operations (payout settlement, ledger, fee configuration, refunds), compliance (DSAR handling, complaints with SLA enforcement, chargeback), customer management, and system health (cron monitoring, audit log, feature flags). Access requires admin JWT (email+password+TOTP MFA, 15-min access, 24-hr refresh) with TOTP step-up for finance and destructive actions.

## Scope & Boundaries

### In Scope

- Admin auth (email+password+TOTP MFA, invite-only)
- Operator KYB approval queue (PENDING_REVIEW -> UNDER_REVIEW -> APPROVED/REJECTED)
- Operator suspension, reinstatement, deactivation
- Fee configuration (global and per-operator override, effective-dated)
- Content moderation (trip/route/operator `moderatedAt` flag, review publish/hide)
- Cross-operator payout queue and settlement monitoring
- Cross-operator ledger view
- Refund queue (retry failed, manual complete for bank transfer)
- DSAR queue with statutory countdown timers (PDPL 2025)
- Complaint queue with CPL 2023 SLA enforcement
- Customer lookup, suspension, anonymization
- Place registry management (canonical names, aliases)
- Feature flag control
- Audit log viewer (append-only, phone-masked)
- Cron health panel (missed-cron detection)

### Out of Scope

- Customer-facing booking flow -> [FI-007](../FI-007-booking-flow/README.md)
- Operator-side fleet management -> [FI-009](../FI-009-operator-console/README.md)
- Staff management (done by operator admin) -> [FI-011](../FI-011-staff-management/README.md)
- Per-operator revenue reports (operator-side) -> [FI-009](../FI-009-operator-console/README.md)
- Payment webhook processing -> [FI-008](../FI-008-payment-integration/README.md)
- Payout settlement execution (cron-driven) -> [FI-010](../FI-010-payout-system/README.md)

### Bounded Context(s)

**Admin/Moderation Context** -- AdminUser, AdminSession, AdminAuditLog, ContentReport. Admins DISABLE, never EDIT catalog fields. Moderation sets `moderatedAt` (soft-hide from search), not content edits.

**Finance/Ledger Context** -- Cross-operator LedgerEntry, Payout, FeeConfig, Refund, Chargeback. Admin views and retries but does not execute settlement.

**Onboarding/KYB Context** -- Operator lifecycle transitions, KybDocument review, PayoutAccount verification.

**Customer Support Context** -- Complaint (CPL 2023 SLA), DataRequest (PDPL 2025 DSAR).

**Analytics/Reporting Context** -- JobRunLog (cron health), FunnelEvent (conversion funnel).

## Key Entities

| Model | Key Columns | Constraints | Notes |
|-------|-------------|-------------|-------|
| AdminUser | id (CUID PK), email (@unique), passwordHash, role (AdminRole: SUPER_ADMIN\|FINANCE\|SUPPORT), totpSecret (AES-256-GCM encrypted), totpEnabledAt, invitedBy, status (AdminStatus: ACTIVE\|DISABLED) | Invite-only. TOTP step-up for finance actions | `totpSecret` encrypted at rest via `TOTP_ENCRYPTION_KEY` |
| AdminSession | id (CUID PK), adminUserId (FK->AdminUser), refreshTokenHash (@unique), tokenFamily, rotationCount, expiresAt, revokedAt | 24-hr refresh TTL (shorter than operator/customer 7-day) | |
| AdminAuditLog | id (CUID PK), actor (String, not FK), action, target, argsRedacted (JSON, phones masked to last 4), timestamp | Append-only. BEFORE UPDATE/DELETE trigger blocks modification | Phone masking via `lib/audit/redactPhone.ts` |
| ContentReport | id (CUID PK), targetType (trip\|route\|operator), targetId, reason, reportedBy, status (open\|resolved), resolvedBy, resolvedAt | | |
| Complaint | id (CUID PK), customerId (FK->Customer?), bookingId (FK->Booking?), category, description, status (ComplaintStatus), acknowledgedAt, assignedTo, resolvedAt, resolution, slaDeadline, escalatedAt | GLOBAL entity (not tenant-scoped). ComplaintStatus: `open\|acknowledged\|in_progress\|resolved\|escalated\|closed` | CPL 2023 SLA: 3-day acknowledge, 7-30 day resolve. `complaintSlaMon` cron (hourly). 5-year retention |
| DataRequest | id (CUID PK), customerId (FK->Customer?), requestType (access\|rectify\|erase\|port), status (received\|processing\|completed\|rejected), requestedAt, acknowledgedAt, completedAt, handledBy, responseRef, notes | GLOBAL entity | PDPL 2025 deadlines: Access 10d, Correction 10d, Deletion 20d, Consent withdrawal 15d |
| Operator | (see [FI-009](../FI-009-operator-console/README.md)) | Admin writes `Operator.status` via `LEGAL_OPERATOR_TRANSITIONS`. Sets `rejectionReason` | |
| KybDocument | (see [FI-009](../FI-009-operator-console/README.md)) | Admin reviews docs, transitions status (submitted->accepted\|rejected). `purgedAt` tracks storage removal | |
| FeeConfig | (see [FI-009](../FI-009-operator-console/README.md)) | Admin creates new effective-dated rows. Never edits existing `ratePpm`. Floor 50000 (5%), ceiling 200000 (20%). TOTP step-up | |
| Payout | (see [FI-010](../FI-010-payout-system/README.md)) | Admin views cross-operator queue. `retryPayout` (`failed -> requested`). Bulk processing requires TOTP step-up | |
| Refund | id (CUID PK), bookingId (FK->Booking, Restrict), amount (Int VND), reason (RefundReason), status (requested\|processing\|completed\|failed), pspRefundRef, requestedBy, requestedAt, completedAt, failureReason, retryCount, nextRetryAt | Ledger integration: `refund_debit` + `refund_out` entries on completion | Bank transfer refunds = manual bank transfer (no programmatic API) |
| Place | id (CUID PK), canonicalName, aliases (String[]), slug (@unique) | GLOBAL. Admin manages canonical registry | |
| FeatureFlag | key (@id), enabled, value (JSON string?), updatedBy | Admin toggles runtime gates | |
| JobRunLog | id (CUID PK), jobName, startedAt, endedAt, status (success\|failed\|skipped_locked), rowsAffected, errorMessage | Read-only for admin; populated by cron jobs | |
| Review | id (CUID PK), bookingId (FK->Booking, Restrict, @unique), customerId (FK?), operatorId (FK, denormalized), tripId (FK, denormalized), rating (Int 1-5 CHECK), comment, status (ReviewStatus: pending\|published\|hidden), moderatedAt | Admin moderates (publish/hide). `moderatedAt` set on action | |

## API Endpoints

| Method | Path | Auth | Description | Status Codes |
|--------|------|------|-------------|--------------|
| POST | `/api/admin/auth/login` | Public (rate-limited) | Email+password, issues TOTP challenge; completes after TOTP verification | 200, 401 |
| POST | `/api/admin/auth/refresh` | Admin JWT | Rotate 24-hr refresh token | 200, 401 |
| POST | `/api/admin/auth/logout` | Admin JWT | Revoke admin session | 200 |
| GET | `/api/admin/operators` | Admin JWT | List operators. Filter by status | 200 |
| POST | `/api/admin/operators` | Admin JWT (SUPER_ADMIN) | Provision new operator | 201 |
| POST | `/api/admin/operators/:id/approve` | Admin JWT (SUPER_ADMIN) | UNDER_REVIEW -> APPROVED. Clears `disabledAt`. SMS+email notification. AdminAuditLog | 200 |
| POST | `/api/admin/operators/:id/reject` | Admin JWT (SUPER_ADMIN) | UNDER_REVIEW -> REJECTED. Sets `rejectionReason` | 200 |
| POST | `/api/admin/operators/:id/suspend` | Admin JWT (SUPER_ADMIN) | APPROVED -> SUSPENDED. Sets `disabledAt=NOW()`. Hides listings | 200 |
| POST | `/api/admin/operators/:id/reinstate` | Admin JWT (SUPER_ADMIN) | SUSPENDED -> APPROVED. Clears `disabledAt` | 200 |
| POST | `/api/admin/moderation/:targetType/:targetId` | Admin JWT (SUPER_ADMIN) | Moderate content. Sets `moderatedAt` -- soft-hide from search | 200 |
| GET | `/api/admin/content-reports` | Admin JWT | Moderation queue with status filter | 200 |
| POST | `/api/admin/reviews/:id/publish` | Admin JWT (SUPPORT) | Publish pending review | 200 |
| POST | `/api/admin/reviews/:id/hide` | Admin JWT (SUPPORT) | Hide review | 200 |
| GET | `/api/admin/payouts` | Admin JWT (FINANCE) | Cross-operator payout queue | 200 |
| POST | `/api/admin/payouts/:id/retry` | Admin JWT (FINANCE) | Retry failed payout (`failed -> requested`) | 200, 422 |
| GET | `/api/admin/ledger` | Admin JWT (FINANCE) | Cross-operator ledger queries | 200 |
| POST | `/api/admin/fee-configs` | Admin JWT (FINANCE, TOTP step-up) | Create fee config. Floor 50000, ceiling 200000 | 201 |
| GET | `/api/admin/audit-log` | Admin JWT (SUPER_ADMIN) | Append-only audit trail. Time-ordered | 200 |
| GET | `/api/admin/refunds` | Admin JWT | Admin refund list with filters | 200 |
| POST | `/api/admin/refunds/:id/retry` | Admin JWT | Retry failed refund | 200, 422 |
| POST | `/api/admin/refunds/:id/complete` | Admin JWT | Manual complete (bank transfer) | 200, 422 |
| GET | `/api/admin/complaints` | Admin JWT (SUPPORT) | Complaint queue with SLA countdown | 200 |
| PATCH | `/api/admin/complaints/:id` | Admin JWT (SUPPORT) | Update complaint (acknowledge, assign, resolve, escalate, close) | 200 |
| GET | `/api/admin/data-requests` | Admin JWT (SUPPORT) | DSAR queue with statutory countdown timers | 200 |
| PATCH | `/api/admin/data-requests/:id` | Admin JWT (SUPPORT) | Process DSAR | 200 |
| GET | `/api/admin/feature-flags` | Admin JWT (SUPER_ADMIN) | List feature flags | 200 |
| PATCH | `/api/admin/feature-flags/:key` | Admin JWT (SUPER_ADMIN) | Toggle feature flag | 200 |
| POST | `/api/admin/places` | Admin JWT (SUPER_ADMIN) | Create canonical place | 201 |
| PATCH | `/api/admin/places/:id` | Admin JWT (SUPER_ADMIN) | Update place | 200 |
| GET | `/api/admin/bookings` | Admin JWT (SUPPORT) | Cross-operator booking search by phone, email, or booking ref | 200 |
| GET | `/api/admin/customers` | Admin JWT (SUPPORT) | Customer lookup for support | 200 |
| POST | `/api/admin/payout-account/:id/verify` | Admin JWT | Verify operator payout account (sets `verifiedAt`) | 200 |

**Rate limit:** Admin API: 30 requests / 1 min / IP.

**Cross-operator data access:** Admin routes access any operator's data via explicit `operatorId` in path/query -- no `withOperatorScope` restriction.

## State Machine

### Operator Approval (state-machines.md S5)

Defined in `lib/onboarding/operatorStatus.ts` as `LEGAL_OPERATOR_TRANSITIONS`:

| From | To | Trigger | Guard |
|------|----|---------|-------|
| `PENDING_REVIEW` | `UNDER_REVIEW` | Admin starts review | `SELECT FOR UPDATE` on Operator |
| `UNDER_REVIEW` | `APPROVED` | Admin approves | Clears `disabledAt` |
| `UNDER_REVIEW` | `REJECTED` | Admin rejects | Sets `rejectionReason` |
| `REJECTED` | `PENDING_REVIEW` | Operator resubmits | Clears `rejectionReason` |
| `APPROVED` | `SUSPENDED` | Admin suspends | Sets `disabledAt=NOW()` |
| `SUSPENDED` | `APPROVED` | Admin reinstates | Clears `disabledAt` |

**Side effects:** Each transition enqueues two NotificationLog rows (SMS+email, template per target state). AdminAuditLog entry written inside same `$transaction` when `actor` is present.

**Capability Map:**

| Status | canLogin | searchVisible | canSell | canResubmit | listingsHidden |
|--------|---------|---------------|---------|-------------|---------------|
| PENDING_REVIEW | yes | no | no | no | no |
| UNDER_REVIEW | yes | no | no | no | no |
| APPROVED | yes | yes | yes | no | no |
| REJECTED | yes | no | no | yes | no |
| SUSPENDED | yes | no | no | no | yes |

### Complaint State Machine (DS-014 S3)

| From | To | Trigger | Actor |
|------|----|---------|-------|
| `submitted` | `acknowledged` | Admin acknowledges or auto-ack at SLA deadline | Admin/System |
| `acknowledged` | `investigating` | Admin assigns complaint | Admin |
| `investigating` | `resolved` | Admin closes with resolution text | Admin |
| `investigating` | `escalated` | SLA breach (cron) or customer request | System/Customer |
| `escalated` | `resolved` | Resolution reached post-escalation | Admin |

SLA deadlines: `acknowledgeDeadline = createdAt + 3 business days`. `resolveDeadline = acknowledgedAt + 7 days` (simple) or `acknowledgedAt + 30 days` (complex). `complaintSlaMon` cron runs hourly.

### Chargeback State Machine (DS-010)

| From | To | Trigger | Guard |
|------|----|---------|-------|
| `received` | `under_review` | Admin begins review | |
| `under_review` | `accepted` | Admin accepts chargeback (terminal) | |
| `under_review` | `contested` | Admin contests | |
| `under_review` | `expired` | Timeout (terminal) | |
| `contested` | `won` | PSP rules in platform's favor (terminal) | |
| `contested` | `lost` | PSP rules against platform (terminal) | |

## Business Rules & Invariants

1. **AdminAuditLog Immutability** -- All admin actions append to AdminAuditLog. BEFORE UPDATE/DELETE trigger blocks modification. Phone numbers masked to last 4. Enforcement: DB trigger; `lib/audit/redactPhone.ts`.

2. **Admin Does Not Edit Content** -- Admins DISABLE (set `moderatedAt`) never edit catalog fields (route names, trip prices, etc.). Enforcement: `lib/admin/` only sets disable/moderate flags.

3. **TOTP Step-Up for Finance** -- Fee adjustment and payout bulk processing require TOTP step-up verification. Enforcement: `lib/auth/requireStepUp.ts`; modal in FD-026 S3.4.

4. **Operator Deactivation Guard** -- Cannot deactivate operator with future paid bookings (`status IN ('confirmed','paid') AND departureAt > NOW()`). Enforcement: `lib/admin/disableOperator.ts`.

5. **Fee Rate Range** -- `ratePpm` floor: 50000 (5%), ceiling: 200000 (20%). Admin-configurable per operator. Effective-dated (new row per change, never in-place edit). Enforcement: `POST /api/admin/fee-configs` Zod validation.

6. **DSAR Statutory Deadlines** -- Access 10d, Correction 10d, Deletion 20d, Consent withdrawal 15d (PDPL 2025). Enforcement: `DataRequest.acknowledgedAt`, `DataRequest.completedAt`; countdown timers in FD-026.

7. **Complaint SLA** -- 3 business days acknowledge, 7-30 days resolve (CPL 2023). `complaintSlaMon` cron (hourly) auto-escalates past `slaDeadline`. 5-year retention. Enforcement: `Complaint.slaDeadline`; cron `/api/cron/complaint-sla-monitor`.

8. **Review Moderation** -- Reviews remain `pending` until admin publishes or hides. `moderatedAt` set on action. Enforcement: `Review.status`, `Review.moderatedAt`.

9. **Payout Account Re-verification** -- Any edit to operator payout account fields resets `PayoutAccount.verifiedAt=null`; admin must re-verify before withdrawal proceeds. Enforcement: `lib/onboarding/payoutVerify.ts`.

10. **Admin Does Not Hold Payout Settlement Execution** -- Settlement is executed by `settlePayout` cron. Admin only views queue and retries failed payouts. Enforcement: ADR-012; `lib/ledger/settlePayout.ts`.

11. **Operator License Expiry Alert** -- `operatorLicenseAlert` cron (daily): scan `KybDocument.expiryDate <= NOW()+60 days AND expiryAlertSentAt IS NULL`. Sends admin notification. Enforcement: `KybDocument.expiryDate`, `KybDocument.expiryAlertSentAt`.

12. **KYB Document Purge** -- `kybDocumentPurge` cron: purge KYB docs for operators REJECTED/SUSPENDED 90+ days. Sets `KybDocument.purgedAt`. Pointer row retained for audit trail. Enforcement: `/api/cron/kyb-doc-purge`.

13. **Cross-Operator Data Access** -- Admin routes access any operator's data via explicit `operatorId` -- no `withOperatorScope` restriction. Enforcement: DS-003 S8.

14. **Moderation Sets `moderatedAt`, Not Content** -- Admin moderation writes `Trip.moderatedAt`, `Route.moderatedAt`, `Operator.disabledAt` -- never changes content fields. Enforcement: `lib/admin/moderation.ts`.

## Frontend Surfaces

| Page | Path | Key Components | Notes |
|------|------|----------------|-------|
| Dashboard | `/admin/` | KPI cards (Total Bookings, GMV, Active Operators, Active Customers), System Alerts Panel (severity-ordered), Cron Health Panel (last run, status, missed-cron detection) | KPI toggle: today/week/month. Missed-cron: `now - lastRun > 2 * expectedInterval` -> red dot |
| KYB Approval Queue | `/admin/approvals` | Queue table (date, ref, name, entity type, status badge), Split-pane document review (PDF/image inline), Approve/Request More Info/Reject actions | Default filter: "Cho duyet" (pending). FIFO. All actions write AdminAuditLog |
| Operator Detail | `/admin/operators/[id]` | 6-tab view: Overview, Documents, Bookings, Payouts, Complaints, Audit Log. Action buttons: Approve/Suspend/Reinstate/Adjust Fee/Deactivate | Fee adjustment: slider/input 5-20%. TOTP step-up required |
| Customer Management | `/admin/users` | Search (exact-match phone, prefix-match booking ref), Detail (Identity, Booking Timeline, Account Status), Actions: Suspend/Manual Refund/Anonymize | Anonymize confirmation: type "XOA" to confirm (irreversible) |
| Finance - Refunds | `/admin/finance` (Refunds tab) | Columns: Booking Ref, Amount, PSP, Status, Failure Reason. Actions: Retry, Manual Complete (bank transfer ref required). Ledger impact preview | |
| Finance - Payouts | `/admin/finance` (Payouts tab) | Queue: Operator, Amount, Status, Requested At, Bank Account (masked). Actions: Bulk Process (TOTP), Retry Failed, View Ledger | |
| Finance - Ledger | `/admin/finance` (Ledger tab) | Per-operator ledger: Date, Type badge, Description, Amount (signed, green/red), Running Balance | LedgerEntry type badges with Vietnamese labels |
| Audit Log | `/admin/system` | Timestamp, Actor, Action, Target (masked), Details (JSON-expandable). Filters: Actor, Action Type, Date Range. No delete button | |

**LedgerEntry Type Badges:**

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

**Cron Health Panel -- Expected Intervals:**

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

**Role-based Nav Visibility:**

| Nav Item | SUPER_ADMIN | FINANCE | SUPPORT |
|----------|-------------|---------|---------|
| Dashboard | Yes | Yes | Yes |
| Approvals | Yes | No | No |
| Operators | Yes | No | No |
| Customers | Yes | No | Yes |
| Finance | Yes | Yes | No |
| System | Yes | No | No |

**Responsive:** Desktop-optimized (1024px+). Tablet (768px+) with horizontal scroll. Mobile functional but not optimized (banner: "De co trai nghiem tot nhat, vui long su dung may tinh").

## Regulatory Requirements

| Law/Decree | Requirement | Impact |
|------------|-------------|--------|
| Consumer Protection Law 2023 (No. 19/2023/QH15, Art. 29-34) | 3-day written acknowledgement, 7-30 day resolution, 5-year record retention, accessible complaint channel | Complaint state machine with SLA deadlines; `complaintSlaMon` cron; complaint retention |
| PDPL 2025 / Decree 13/2023/ND-CP | DSAR rights: access (10d), correction (10d), deletion (20d), consent withdrawal (15d). Statutory countdown timers | DataRequest DSAR queue; Anonymize action (irreversible PII scrub) |
| Decree 10/2020/ND-CP | Transport Business License required; route-specific authorization | KYB approval gate; `operatorLicenseAlert` cron (60-day expiry warning) |
| Decree 03/2021 (amended Decree 67/2023) | Mandatory passenger insurance | `insurancePolicyRef` verified during KYB |
| Circular 32/2025/TT-BTC | GDT e-invoice per booking. MISA meInvoice integration | Finance dashboard shows MISA e-invoice rejection alerts; `einvoiceSubmission` cron monitoring |
| E-Commerce Law 2025 (eff. July 2026) | Platform withholding for individual/household operators | `tax_withheld` ledger entries; tax display in per-operator ledger view |
| Decree 123/2020/ND-CP + Circular 78/2021 | E-invoice issuance by third-party authorization | Admin-level MISA integration |
| ADR-004 D14 | Unlicensed operator onboarding creates MoT shutdown risk | KYB gate: admin is sole actor who can APPROVE operators |
| E-Commerce Decree 52/2013 + MOIT registration | Complaint handling policy; operator verification process | Complaint policy transparency; KYB approval process |

## Testing Strategy

### Unit Tests

- Operator capability map (all 5 statuses x 5 capabilities)
- `LEGAL_OPERATOR_TRANSITIONS.isLegalTransition(from, to)` -- every valid/invalid transition pair
- `LEGAL_COMPLAINT_TRANSITIONS` -- all edges
- Complaint SLA business-day calculation (Vietnamese holiday exclusion)
- AdminAuditLog `argsRedacted` phone masking (`lib/audit/redactPhone.ts`)
- Fee rate display conversion: `ratePpm/10000 = pct%`

### Integration Tests

- `LEGAL_OPERATOR_TRANSITIONS` state machine: every edge (approve, reject, suspend, reinstate) with real DB
- `SELECT FOR UPDATE` on Operator row during transitions
- AdminAuditLog immutability trigger: attempt UPDATE/DELETE, confirm PG error
- Complaint SLA cron: seed complaint at `createdAt=3biz-days-ago`, confirm `complaintSlaMon` transitions to `escalated`
- DSAR deadline countdown derivation
- FeeConfig effective-dating: create two rows for same operator, confirm correct resolution by `getEffectiveFeeRate`
- Refund ledger entries: confirm `refund_debit` + `refund_out` created atomically on refund complete
- Cross-operator data access: admin endpoints must NOT apply `withOperatorScope`

### E2E Tests

- Admin login flow (email+password+TOTP)
- KYB approval flow (approve/reject operator)
- Operator suspend/reinstate
- Fee config adjustment with TOTP step-up
- Complaint queue acknowledge + resolve
- DSAR queue process
- Customer anonymize (DSAR deletion)
- Cron health panel reads JobRunLog
- CSRF header on all POST/PATCH/DELETE via `primeCsrf()`
- RSC purity: `Date.now()` must not appear inside admin page render body
- TOTP mock hygiene: `Buffer.from(s, 'hex')` must use 64-char hex-valid strings

## Cross-References

- **Architecture Decisions:** [ADR-004](../../architecture-decisions/ADR-004-multi-tenancy/README.md), [ADR-012](../../architecture-decisions/ADR-012-background-jobs/README.md), [ADR-016](../../architecture-decisions/ADR-016-module-boundaries/README.md), [ADR-019](../../architecture-decisions/ADR-019-state-machines/README.md)
- **Design Specifications:** [DS-001](../../design-specifications/DS-001-data-model/README.md), [DS-003](../../design-specifications/DS-003-api-contract/README.md), [DS-006](../../design-specifications/DS-006-background-jobs/README.md), [DS-010](../../design-specifications/DS-010-chargeback-design/README.md), [DS-014](../../design-specifications/DS-014-complaint-support/README.md)
- **Frontend Design:** [FD-026](../../frontend-design/FD-026-admin-console/README.md)
- **Business/Domain:** [bounded-contexts.md](../../business/domain-model/bounded-contexts.md), [state-machines.md](../../business/domain-model/state-machines.md), [invariants-catalog.md](../../business/domain-model/invariants-catalog.md), [admin-personas.md](../../business/personas/admin-personas.md)
- **Regulatory:** [transport.md](../../business/regulatory/transport.md), [data-privacy.md](../../business/regulatory/data-privacy.md), [consumer-protection.md](../../business/regulatory/consumer-protection.md)
- **Scaffolding:** [SI-005](../../scaffolding-infra/SI-005-testing-strategy/README.md)

## Known Gaps & Open Questions

- **HIGH -- KYB status `NEEDS_INFO` not in canonical `OperatorStatus` enum** -- FD-026 S3.3 shows "Request More Info" -> status `NEEDS_INFO`. DS-001 and `state-machines.md` only define `PENDING_REVIEW|UNDER_REVIEW|APPROVED|REJECTED|SUSPENDED`. Gap: either enum missing or FD-026 uses non-canonical label.
- **HIGH -- `operatorLicenseAlert` and `piiAnonymization` crons not built** -- ADR-012 `PARTIALLY_IMPLEMENTED`. Routes don't exist. Go-live blocker.
- **HIGH -- Chargeback system not implemented** -- DS-010 S1: "No chargeback workflow currently exists." `chargeback` LedgerEntry type exists but no model, no webhook handling, no admin queue. Financial risk: unrecoverable loss with no audit trail.
- **HIGH -- TOTP secret storage encryption verification** -- `AdminUser.totpSecret` AES-256-GCM encrypted at rest. Key management must be verified before go-live.
- **MEDIUM -- Business day calculation for SLA** -- Vietnamese public holiday calendar requires static holiday table with annual admin refresh. No automated holiday source.
- **MEDIUM -- Refund flow for bank transfer** -- Cash and bank_transfer payments have no programmatic refund API. Admin must mark complete manually with bank transfer reference.
- **MEDIUM -- Admin invite flow** -- `AdminUser` is invite-only. `invitedBy` field tracks inviter. Service `lib/admin/inviteAdmin.ts` exists but no documented route in DS-003 S8.
- **MEDIUM -- `paymentReconSweeper` not built** -- Backup for unmatched bank transfer payments. Affects finance accuracy.
- **MEDIUM -- Stranded `processing` payouts** -- No automatic recovery if cron crashes. Admin must detect via payout queue and retry manually.
- **LOW -- Cron dual-config maintenance** -- DS-006 S2.1: `vercel.json` AND sidecar `crontab` must declare identical schedules. No automated sync check.
- **LOW -- Admin role granularity for complaint actions** -- SUPPORT mapped to complaints, but FINANCE handles refund queue. SUPPORT agents initiating refunds needs role clarification.
- **LOW -- `complaintSlaMon` cron route existence** -- Listed in DS-014 as hourly. Verify route `/api/cron/complaint-sla-monitor` exists in codebase.
