# Bounded Context Map

> Extracted from codebase analysis (prisma/schema.prisma, lib/, app/api/). Research date: 2026-06-17.

---

## 1. Auth Context

Three distinct realms -- never mixed. Each realm has its own session model, OTP model, and auth-service module.

### Customer Realm

| Layer | Artifacts |
|-------|-----------|
| Models | `Customer`, `Session`, `OtpAttempt` |
| Services | `lib/auth/authService.ts`, `lib/auth/otp.ts`, `lib/auth/session.ts`, `lib/auth/sendOtp.ts`, `lib/auth/otpProof.ts` |
| Guard | `lib/auth/requireCustomerAuth.ts` |
| Account | `lib/account/` (profile, soft-delete, anonymization, suspension) |

### Operator Realm

| Layer | Artifacts |
|-------|-----------|
| Models | `OperatorUser`, `OperatorSession`, `OperatorOtpAttempt` |
| Services | `lib/auth/operatorAuthService.ts`, `lib/auth/operatorOtp.ts`, `lib/auth/operatorSession.ts`, `lib/auth/operatorUsername.ts` |
| Guard | `lib/auth/requireOperatorAuth.ts` |

### Admin Realm

| Layer | Artifacts |
|-------|-----------|
| Models | `AdminUser`, `AdminSession` |
| Services | `lib/auth/adminAuthService.ts`, `lib/auth/adminSession.ts`, `lib/auth/adminTotp.ts`, `lib/auth/totpCrypto.ts` |
| Guards | `lib/auth/requireAdminAuth.ts`, `lib/auth/requireAdminPage.ts`, `lib/auth/requireStepUp.ts` |

Invite-only. TOTP step-up required for finance actions.

### Cross-Cutting Auth Modules

- `lib/auth/csrf.ts` / `lib/auth/csrfClient.ts` -- CSRF double-submit cookie (client components must deep-import `csrfClient`, never the barrel)
- `lib/auth/jwt.ts` -- HS256 access/refresh tokens (15-min access TTL)
- `lib/auth/password.ts` -- bcrypt hashing for operator/admin passwords
- `lib/auth/refreshToken.ts` -- token-family rotation with revocation
- `lib/auth/safeReturnTo.ts` -- open-redirect prevention

---

## 2. Fleet/Catalog Context

Operator-owned supply side: vehicles, routes, trips, pickup areas, recurring schedules.

| Layer | Artifacts |
|-------|-----------|
<!-- Phase 2: Pickup area models deferred to post-launch (trigger: 4 operators). Phase 1 = station-only. -->
| Models | `Operator`, `Bus`, `BusMaintenance`, `Route`, `Place`, `Trip`, `RecurringTripTemplate`, `RecurringGenerationLog`, `OperatorPickupArea`, `TripPickupArea`, `TemplatePickupArea`, `RoutePickupArea` |
| Services | `lib/trips/createTrip.ts`, `lib/trips/cancelTrip.ts`, `lib/trips/markDeparted.ts`, `lib/trips/markCompleted.ts`, `lib/trips/completeTripCore.ts`, `lib/trips/searchTrips.ts`, `lib/trips/generateFromTemplate.ts`, `lib/trips/reassignBus.ts`, `lib/trips/salesToggle.ts`, `lib/trips/busOverlap.ts`, `lib/trips/toTripDto.ts` |
| Operator approval | `lib/onboarding/operatorStatus.ts`, `lib/onboarding/operatorCapabilities.ts` |
| Tenant scope | `lib/core/db/tenantScope.ts` (`withOperatorScope`) |

Description: The canonical catalog of what operators offer. Trips are the bookable unit -- each is a specific departure on a Route by a Bus at a fixed VND price. Recurring templates auto-generate Trip rows via daily cron for a 14-day horizon.

---

## 3. Booking Context

Customer demand side: holds, bookings, consent, check-in.

| Layer | Artifacts |
|-------|-----------|
| Models | `Hold`, `Booking`, `ConsentRecord` |
| Services | `lib/core/db/holdRepo.ts` (createHold, expireHolds), `lib/booking/bookingRepo.ts`, `lib/booking/initiateOnlineBooking.ts`, `lib/booking/initiateMomoBooking.ts`, `lib/booking/transitions.ts`, `lib/booking/checkIn.ts`, `lib/booking/pickupSelection.ts`, `lib/booking/consent.ts`, `lib/booking/bookingRef.ts`, `lib/booking/confirmationToken.ts`, `lib/booking/getHoldDetails.ts`, `lib/booking/ticketPdf.tsx` |

Description: A Booking begins life as a time-bounded Hold (10-min TTL). Hold creation is capacity-gated with pg advisory locks (phone-level cap then trip-level serialization). The hold converts to a Booking in `awaiting_payment` status. Two ConsentRecord rows (no_refund + pii_storage) are written atomically at booking initiation. Booking is identified by `bookingRef` (BB-YYYY-xxxx-xxxx, base36 lowercase) and `confirmationToken`.

---

## 4. Payment Context

Gateway-agnostic payment processing and webhook handling.

| Layer | Artifacts |
|-------|-----------|
| Models | `PaymentEvent` (adapter-specific raw webhook storage) |
| Services | `lib/payment/processWebhook.ts`, `lib/payment/applyPaidTransition.ts`, `lib/payment/refund.ts`, `lib/payment/gateway.ts` |
| Adapters | `lib/payment/adapters/momo.ts`, `lib/payment/adapters/vnpay.ts`, `lib/payment/adapters/stub.ts` |

Description: Each adapter implements the `PaymentGateway` interface (`gateway.ts`) and normalizes raw provider result codes to a canonical status enum (`paid | failed | pending | unknown`). PaymentEvent rows are idempotent via `@@unique([adapter, providerTxnId])`. The webhook handler always returns HTTP 200 to the gateway (except 400 for invalid HMAC). Post-commit side effects (overpay refund, oversold refund) run via Next.js `after()`.

---

## 5. Finance/Ledger Context

Double-entry accounting, payouts, fee configuration, settlements.

| Layer | Artifacts |
|-------|-----------|
| Models | `LedgerEntry`, `Payout`, `FeeConfig`, `PayoutAccount` |
| Services | `lib/ledger/ledgerRepo.ts`, `lib/ledger/balance.ts`, `lib/ledger/withdrawal.ts`, `lib/ledger/refund.ts`, `lib/ledger/settlePayout.ts`, `lib/ledger/calcPayout.ts`, `lib/ledger/chargeback.ts`, `lib/ledger/retryPayout.ts`, `lib/ledger/feeConfig.ts`, `lib/ledger/constants.ts`, `lib/ledger/buildRevenueCsv.ts`, `lib/ledger/buildBookingRevenueCsv.ts`, `lib/ledger/getRevenueReport.ts`, `lib/ledger/getPayoutReport.ts`, `lib/ledger/addManualAdjustment.ts`, `lib/ledger/setGlobalFee.ts`, `lib/ledger/setOperatorFeeOverride.ts` |

Description: Append-only, immutable ledger enforced by PostgreSQL `BEFORE UPDATE/DELETE` trigger (`ledger_entry_immutable`). Balance is always derived, never stored. Entry types: `booking_credit`, `platform_fee`, `refund_debit`, `refund_out`, `payout_debit`, `payout_reversal`, `chargeback`, `adjustment`, `tax_withheld`. All currency math uses BigInt (ES2017 constructor form). Platform fee stored as `ratePpm` (parts-per-million) in FeeConfig with effective-dating.

---

## 6. Notification Context

Single delivery path for all domain notifications.

| Layer | Artifacts |
|-------|-----------|
| Models | `NotificationLog` |
| Services | `lib/notification/dispatchNotifications.ts`, `lib/notification/email.ts`, `lib/notification/esms.ts`, `lib/notification/esmsClient.ts` |
| Repository | `lib/core/db/notificationLogRepo.ts` |

Description: All domains produce `NotificationLog` rows with `status='pending'`. The dispatch cron is the sole delivery path -- routes and webhooks only enqueue, never dispatch in-process. Channels: SMS (via eSMS/SpeedSMS) and email (via Resend). Retry with backoff tracked via `attemptCount` and `nextAttemptAt`. Scheduled notifications use the top-level `scheduledFor` column (never JSON payload).

---

## 7. Admin/Moderation Context

Platform administration, operator lifecycle management, content moderation.

| Layer | Artifacts |
|-------|-----------|
| Models | `AdminUser`, `AdminSession`, `AdminAuditLog`, `ContentReport` |
| Services | `lib/admin/moderation.ts`, `lib/admin/disableOperator.ts`, `lib/admin/createOperator.ts`, `lib/admin/createOperatorAccount.ts`, `lib/admin/inviteAdmin.ts`, `lib/admin/revokeAdmin.ts`, `lib/admin/resetAdminTotp.ts`, `lib/admin/resetOperatorAdminPassword.ts`, `lib/admin/suspendCustomer.ts`, `lib/admin/bootstrapSuperAdmin.ts`, `lib/admin/searchUsers.ts`, `lib/admin/listOperators.ts`, `lib/admin/listAllOperators.ts`, `lib/admin/getOperatorDetail.ts`, `lib/admin/getActionQueue.ts`, `lib/admin/getApprovalQueue.ts`, `lib/admin/getModerationQueue.ts`, `lib/admin/getPayoutQueue.ts`, `lib/admin/getCharterDispatchQueue.ts`, `lib/admin/getFailureAlerts.ts`, `lib/admin/getLedgerView.ts`, `lib/admin/getAuditLog.ts`, `lib/admin/getUserDetail.ts`, `lib/admin/setAdminRole.ts`, `lib/admin/listAdmins.ts` |

Description: Admins DISABLE, never EDIT catalog fields. Moderation sets `moderatedAt` on Trip/Route (soft-hide from search), not content edits. AdminAuditLog is append-only with immutability trigger. Phone numbers masked to last-4 digits via `lib/audit/redactPhone.ts`. Admin roles: `SUPER_ADMIN`, `FINANCE`, `SUPPORT`. Status: `ACTIVE | DISABLED`.

---

## 8. Reporting/Analytics Context

Conversion funnel instrumentation, revenue reporting, job run tracking.

| Layer | Artifacts |
|-------|-----------|
| Models | `FunnelEvent`, `JobRunLog` |
| Services | `lib/analytics/track.ts`, `lib/analytics/getFunnel.ts`, `lib/analytics/getAdminMetrics.ts`, `lib/ledger/getRevenueReport.ts`, `lib/ledger/buildRevenueCsv.ts`, `lib/ledger/buildBookingRevenueCsv.ts`, `lib/ledger/getBookingRevenueRows.ts`, `lib/ledger/getPayoutReport.ts` |

Description: FunnelEvent captures anonymous conversion steps (`search_performed`, `hold_created`, `payment_initiated`, `booking_paid`) keyed by session, no PII. JobRunLog tracks cron execution metadata. Revenue reports are operator-scoped and support CSV export.

---

## 9. Onboarding/KYB Context

Operator registration, document verification, payout account setup.

| Layer | Artifacts |
|-------|-----------|
| Models | `KybDocument`, `PayoutAccount`, `OperatorPickupArea`, `StoredObject` |
| Services | `lib/onboarding/registerOperator.ts`, `lib/onboarding/requestOperatorInfo.ts`, `lib/onboarding/operatorStatus.ts`, `lib/onboarding/operatorCapabilities.ts`, `lib/onboarding/kyb.ts`, `lib/onboarding/payoutAccount.ts`, `lib/onboarding/payoutVerify.ts`, `lib/onboarding/applicationRef.ts` |

Description: Operator registration produces an `applicationRef` and enters `PENDING_REVIEW` status. KYB documents (business_license, identity, payout_account) stored via object storage with keys in `KybDocument`. Payout account verification gate: any edit to account fields resets `verifiedAt` to null, blocking withdrawals until re-verified.

---

## 10. Charter Context

Group/private-hire requests. Lead-gen only, no payment rail.

| Layer | Artifacts |
|-------|-----------|
| Models | `CharterRequest` |
| Services | `lib/charter/charterStatus.ts`, `lib/charter/claimCharter.ts`, `lib/charter/createCharterRequest.ts`, `lib/charter/declineCharter.ts`, `lib/charter/charterRef.ts`, `lib/charter/getCharterByRef.ts`, `lib/charter/getOperatorCharters.ts`, `lib/charter/assertOperatorApproved.ts` |
| Jobs | `lib/jobs/charterExpirySweeper.ts` |

Description: Customer submits a charter request with origin, destinations, date range, passengers, and vehicle type. Admin dispatches to operator (direct assign or publish for claim). Operator accepts or declines. Settlement handled off-platform. Expiry sweeper transitions stale PUBLISHED/ASSIGNED_DIRECT requests.

---

## 11. E-Invoice Context

Vietnam compliance per Circular 32/2025/TT-BTC (GDT electronic invoicing; replaces Circular 78/2021).

| Layer | Artifacts |
|-------|-----------|
| Models | `EInvoice` |
| Services | Linked from Booking via `einvoiceRef` field |

Description: GDT-compliant electronic invoices tracked in the `EInvoice` model. Status lifecycle: `pending -> issued -> sent` (happy path) or `-> failed` (submission failure) or `-> cancelled` (voided). Referenced by `Booking.einvoiceRef`. Integration with MISA meInvoice for submission.

---

## 12. Feature Flags

| Layer | Artifacts |
|-------|-----------|
| Models | `FeatureFlag` |

Description: Simple key/enabled/value model for runtime feature gating. Tracked with `updatedBy` for audit.

---

## Context Relationships

- **Booking -> Fleet**: reads `Trip.price`, `Trip.status`, `Trip.salesClosed`, `Bus.capacity`, `Operator.status`. Booking is the downstream consumer of Fleet/Catalog supply.
- **Payment -> Booking**: `processWebhook` calls `applyPaidStatusTransition` which writes `Booking.status`. Payment is upstream to Booking's paid state.
- **Payment -> Finance/Ledger**: after paid transition, `appendBookingPaidLedger` writes `booking_credit` (+gross) and `platform_fee` (-fee) in the same transaction as the status update.
- **Finance/Ledger -> Fleet**: `completeTripCore` creates a `Payout` row and `payout_scheduled` notification. Settlement requires `Trip.completedAt` + T+1.
- **Auth -> Booking**: `customerId` stamped on Booking at initiation. Guest bookings backfilled to customer via phone match at registration (`attachGuestBookingByPhone`).
- **Admin -> Fleet**: admin writes `Operator.status` transitions, sets `Trip.moderatedAt` / `Route.moderatedAt` for content moderation.
- **Admin -> Finance/Ledger**: admin processes payout queue, manages fee configuration, handles chargebacks and manual adjustments.
- **Notification -> All**: all domains produce `NotificationLog` rows; the dispatch cron is the sole delivery path.
- **Onboarding -> Fleet**: operator approval (`APPROVED` status) is a prerequisite for search visibility and bookability.
- **Charter -> Admin**: admin routes charter requests to operators; settlement is off-platform.

---

## Anti-Corruption Layers

### PaymentGateway Interface

`lib/payment/gateway.ts` defines the `PaymentGateway` interface. Each adapter (`momo.ts`, `vnpay.ts`, `stub.ts`) normalizes raw provider result codes to the canonical `paid | failed | pending | unknown` enum. Native gateway field names (e.g., MoMo `resultCode`, VNPay `vnp_ResponseCode`) never cross the boundary into domain code.

### Tenant Scope (withOperatorScope)

`lib/core/db/tenantScope.ts` provides `withOperatorScope`, which constrains every operator-side query to `WHERE operatorId = $operatorId`. This is the ACL boundary ensuring operators can only access their own resources.

### DTO Boundary

`lib/trips/toTripDto.ts` and `lib/booking/toBookingDto.ts` map Prisma model rows to typed DTOs. Select whitelists match exactly the UI contract fields -- no filter-only columns leak to the client (see Mistake Log Issue 001).
