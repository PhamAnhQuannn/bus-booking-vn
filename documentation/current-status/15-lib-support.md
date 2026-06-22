# 15 -- lib/charter, lib/jobs, lib/ticketing

Support domains: charter lead management, background job framework, and ticket verification/QR.

---

## 1. lib/charter/ -- Charter Request State Machine

Charter requests are lead-gen requests for private bus charters. The domain manages the full lifecycle from customer submission through operator matching, with no on-platform payment rail (settlement happens off-platform).

### Barrel (index.ts)

Exports all public symbols. Issues 081-086.

### Files

| File | Exports | Purpose |
|------|---------|---------|
| `charterRef.ts` | `generateCharterRef`, `CHARTER_REF_REGEX` | Human-readable ref `CH-YYYY-XXXXXX` (4-digit VN year + 6 random uppercase base36). Collision-safe via DB unique index + retry. Regex: `/^CH-\d{4}-[0-9A-Z]{6}$/`. |
| `charterStatus.ts` | `transitionCharterRequest`, `LEGAL_CHARTER_TRANSITIONS`, `CUSTOMER_CANCELLABLE_STATUSES`, `isLegalCharterTransition`, types | Single source of truth for the charter state machine. SELECT FOR UPDATE serialization. Discriminated result (`{ ok, from, to }`), throws only for illegal edges or missing rows. Post-commit match notification on ACCEPTED. |
| `createCharterRequest.ts` | `createCharterRequest`, `CreateCharterRequestInput`, `CreateCharterRequestResult` | Customer charter form handler. Resolves origin via `resolveOrCreatePlace` (Issue 044). Creates directly in ADMIN_REVIEW (skips SUBMITTED). Retry-loop for ref collisions (P2002). Post-commit charterSubmitted sms+email. |
| `claimCharter.ts` | `claimCharter`, `ClaimCharterResult`, `ClaimCharterReason` | Atomic first-accept-wins public pool claim (Issue 084). Conditional UPDATE with rowcount guard (no read-then-write). Discriminated result: `{ ok:true }` or `{ ok:false, reason }`. Post-commit customer match + operator win notifications. |
| `declineCharter.ts` | `declineCharter`, `DeclineCharterInput`, `DeclineCharterResult` | Operator declines a direct-assign lead (Issue 083). Two-step: ASSIGNED_DIRECT -> DECLINED -> ADMIN_REVIEW. Each step via `transitionCharterRequest`. Best-effort ops decline notification. |
| `getCharterByRef.ts` | `getCharterByRef`, `CharterByRef` | In-process read by public ref. Feeds the public status page. Operator contact revealed only when status === ACCEPTED. Returns null on miss. |
| `getOperatorCharters.ts` | `getAssignedCharters`, `getAcceptedCharters`, `getPublicPoolCharters`, types | Three operator-side queries. Assigned: pending leads WITHOUT customer contact (reveal-on-accept AC3). Accepted: full details WITH contact for off-platform fulfillment. Public pool: PUBLISHED unclaimed leads, cursor-paginated, no contact. |
| `assertOperatorApproved.ts` | `assertOperatorApproved`, `isOperatorApproved`, `isCharterEnabled`, `CharterNotApprovedError` | APPROVED gate for charter actions (Issue 083). Derives from `getOperatorCapabilities(status).canSell`. Route handlers throw `CharterNotApprovedError` (403); RSC uses boolean `isOperatorApproved`. |
| `errors.ts` | `CharterError`, `CharterErrorCode` | Tagged error: `charter_not_found` or `illegal_transition`. Thrown only for exceptional outcomes; normal outcomes use discriminated results. |

### State Machine

```
SUBMITTED        -> ADMIN_REVIEW | CANCELLED
ADMIN_REVIEW     -> ASSIGNED_DIRECT | PUBLISHED | REJECTED | CANCELLED
ASSIGNED_DIRECT  -> ACCEPTED | DECLINED | ADMIN_REVIEW(timeout) | CANCELLED
PUBLISHED        -> ACCEPTED | EXPIRED | CANCELLED
DECLINED         -> ADMIN_REVIEW
EXPIRED          -> ADMIN_REVIEW
ACCEPTED         -> COMPLETED | CANCELLED
REJECTED / COMPLETED / CANCELLED -> [] (terminal)
```

Customer-cancellable statuses (pre-ACCEPT only): SUBMITTED, ADMIN_REVIEW, ASSIGNED_DIRECT, PUBLISHED.

### Side Effects per Transition Target

| Target | Side Effects |
|--------|-------------|
| ASSIGNED_DIRECT | Sets assigneeOperatorId + acceptByAt deadline |
| PUBLISHED | Stamps publishedAt + claimByAt deadline |
| REJECTED | Sets rejectionReason |
| DECLINED / EXPIRED | Clears assigneeOperatorId |
| ADMIN_REVIEW | Clears assigneeOperatorId + acceptByAt + claimByAt |
| ACCEPTED | Post-commit charterMatched sms+email to customer |

### Tests

| Test File | Type |
|-----------|------|
| `__tests__/charterRef.test.ts` | Unit |
| `__tests__/charterStatus.test.ts` | Unit |
| `__tests__/createCharterRequest.test.ts` | Unit |
| `__tests__/claimCharter.int.test.ts` | Integration |
| `__tests__/declineCharter.test.ts` | Unit |
| `__tests__/getOperatorCharters.test.ts` | Unit |
| `__tests__/charterExpirySweeper.int.test.ts` | Integration |

---

## 2. lib/jobs/ -- Background Job Framework

Cron job cores and infrastructure. Each core is a `JobCore` function that runs inside an advisory-locked transaction. The cron route (`/api/cron/*`) calls `runJob(name, core)` which handles locking, logging, and error capture.

### Barrel (index.ts)

Exports all job cores + `runJob` + types.

### Infrastructure Files

| File | Exports | Purpose |
|------|---------|---------|
| `types.ts` | `JobResult`, `JobOpts`, `JobCore` | Shared types. `JobResult`: `{ rowsAffected, status: 'success' \| 'skipped_locked', errorMessage? }`. `JobCore`: `(tx, opts?) => Promise<JobResult>`. `JobOpts`: clock injection `{ now? }`. |
| `runJob.ts` | `runJob` | Runner harness. Wraps core in `withAdvisoryLock`, writes exactly one `JobRunLog` row per invocation (success or failed). On throw: logs `status='failed'` then rethrows. |
| `withAdvisoryLock.ts` | `withAdvisoryLock` | PG transaction-scoped advisory lock via `pg_try_advisory_xact_lock(hashtext(jobName))`. Lock not acquired -> `skipped_locked`. Auto-releases on commit/rollback. |

### Job Core Files

| File | Export | Trigger | Description |
|------|--------|---------|-------------|
| `expireHolds.ts` | `expireHolds` | Issue 019 AC1 | Sweep active holds past expiresAt -> expired. Batch 500, FOR UPDATE SKIP LOCKED. |
| `generateTrips.ts` | `generateTrips` | Issue 043 | Wrapper around `generateTripsFromTemplates` (14-day horizon). Lazy import. Lock tx holds advisory key only; per-row trips commit independently. |
| `autoCloseSales.ts` | `autoCloseSales` | Issue 019 AC2 | Close sales on scheduled trips at/after departure. Sets `salesClosed=true`. Batch 500. |
| `autoCompleteTrips.ts` | `autoCompleteTrips` | Issue 019 AC3 | Sweep departed trips past route duration -> completed via `completeTripCore`. FOR UPDATE OF t SKIP LOCKED, batch 100. |
| `dispatchNotifications.ts` | `dispatchNotifications` | Issue 058 | Wrapper around `lib/notification` dispatcher. Lazy import. Lock tx holds advisory key; dispatch commits independently. |
| `generateTicketPdfs.ts` | `generateTicketPdfs` | Issue 074 | Generate-once ticket PDFs for paid bookings. Claim batch (ticketPdfKey IS NULL, SKIP LOCKED), render via `renderTicketPdf`, upload via `putObject`, stamp key. Enqueue ticketReady email. Batch 25. |
| `reconcilePayments.ts` | `reconcilePayments` | Issue 095 | Resolve stuck `awaiting_payment` bookings the webhook missed. 30-min threshold. Branch (a): confirming PaymentEvent found -> paid via shared monotonic path + ledger. Branch (b): hold expired, no confirmation -> `payment_failed_expired`. Degraded match for garbled bank-transfer memos (exact amount + adapter + time window). Claim 200, FOR NO KEY UPDATE SKIP LOCKED. |
| `processPayouts.ts` | `processPayouts` | Issue 019 AC5 | Settle requested payouts whose scheduledAt arrived. Requested -> processing -> paid (+ payout_debit ledger entry) or failed. Verified payout account gate (Issue 078). Unverified -> skip for retry. FOR UPDATE SKIP LOCKED. |
| `retentionSweeper.ts` | `retentionSweeper` | Issue 090 | Two retention windows. (1) Guest PII 365d: bulk scrub buyerName/buyerPhone/buyerEmail on guest bookings past departure. (2) KYB docs 90d: per-row delete storage object + stamp purgedAt for REJECTED/SUSPENDED operators. KYB batch 200. |
| `charterExpirySweeper.ts` | `charterExpirySweeper` | Issue 086 | Reroute timed-out charter leads back to admin review. (1) ASSIGNED_DIRECT past acceptByAt -> ADMIN_REVIEW. (2) PUBLISHED past claimByAt -> EXPIRED -> ADMIN_REVIEW. Concurrent operator action wins (illegal_transition caught + skipped). Best-effort customer notification. Claim 200. |
| `sendReminders.ts` | `sendReminders`, `claimReminders` | Issue 019 AC4 | 24h pre-departure SMS reminder. Two-phase: claim (stamp reminderSentAt inside advisory-lock tx) then dispatch (sendSms outside tx). At-most-once delivery. 23-25h departure window. |

### Exported Constants

| Constant | File | Value | Purpose |
|----------|------|-------|---------|
| `RECONCILE_THRESHOLD_MINUTES` | `reconcilePayments.ts` | 30 | Min age for reconciliation candidates |
| `DEGRADED_MATCH_WINDOW_MINUTES` | `reconcilePayments.ts` | 30 | Bank transfer degraded match time window |
| `matchDegraded` | `reconcilePayments.ts` | function | Exported for testing; finds orphan confirming events |
| `BATCH_SIZE` | `generateTicketPdfs.ts` | 25 | PDF generation batch size |

### Concurrency Model

All job cores share the same concurrency strategy:

1. **Run-level**: `withAdvisoryLock` prevents two overlapping cron ticks of the same job from running.
2. **Row-level**: `SELECT ... FOR UPDATE SKIP LOCKED` (or FOR NO KEY UPDATE) claims individual rows so concurrent actions don't conflict.
3. **Lock tx vs work tx**: Most jobs use the lock tx only to hold the advisory key; actual writes commit independently on the pooled prisma client (generateTrips, dispatchNotifications, charterExpirySweeper). Some jobs (expireHolds, autoCloseSales, processPayouts) do work directly on the lock tx.

### Tests

| Test File | Type |
|-----------|------|
| `__tests__/charterExpirySweeper.test.ts` | Unit |
| `__tests__/generateTicketPdfs.test.ts` | Unit |
| `__tests__/reconcilePayments.test.ts` | Unit |
| `__tests__/reconcilePayments.int.test.ts` | Integration |
| `__tests__/retentionSweeper.test.ts` | Unit |
| `__tests__/retentionSweeper.int.test.ts` | Integration |
| `__tests__/cronJobs.int.test.ts` | Integration |

---

## 3. lib/ticketing/ -- Ticket Tokens, QR, and Verification

Ticket verification infrastructure for boarding QR codes. Covers token minting/verification, QR code generation, and the public boarding verify page read.

### Barrel (index.ts)

Exports: `getTicketVerification`, `mintTicketToken`, `verifyTicketToken`, `ticketQrMatrix`.

### Files

| File | Exports | Purpose |
|------|---------|---------|
| `ticketToken.ts` | `mintTicketToken`, `verifyTicketToken`, `TicketTokenClaims` | HS256 JWT signed with dedicated TICKET_SECRET (separate from JWT_SECRET). Claims: `{ scope:'ticket', ref, ct }` only (no PII). Deterministic (no iat/exp/jti) so reprints produce identical tokens (AC4). No expiry (validity governed by live DB row, not token clock). Verify rejects wrong scope/key/malformed -> null. |
| `getTicketVerification.ts` | `getTicketVerification`, `TicketVerification` | Token -> live PII-free boarding view. Verifies token, reads live DB by confirmationToken (unique-indexed). Defense-in-depth: bookingRef must match signed ref claim. Returns live trip/bus/route/operator data (reflects bus reassignment after QR print). Includes check-in state (Issue 073). Deliberately omits buyerName/buyerPhone/buyerEmail (public page). |
| `qr.ts` | `ticketQrMatrix`, `ticketQrSvg`, `ticketQrDataUrl`, `TicketQrOptions` | Pure-JS QR encoder (port of qrcode-generator, no npm dependency). BYTE mode, ECC level M, auto-version 1-40. `ticketQrMatrix` returns boolean[][] module matrix. `ticketQrSvg` renders SVG string. `ticketQrDataUrl` wraps as base64 data URL. All deterministic. |

### Token Design Decisions

| Decision | Rationale |
|----------|-----------|
| Dedicated TICKET_SECRET | Compromise of one key realm cannot forge the other |
| No PII in token | Token is a tamper-evident lookup pointer; verify page does fresh DB read |
| No expiration | Boarding QR must verify days after issue; live DB row governs validity |
| Deterministic mint | Reprinted ticket / re-rendered QR produces identical string |
| Scope guard | `scope==='ticket'` rejects cross-realm tokens even under hypothetical same key |

### TicketVerification Shape

```typescript
interface TicketVerification {
  bookingRef: string;
  status: string;
  isPaid: boolean;           // paid | completed
  ticketCount: number;
  providerTxnId: string | null;
  operatorName: string;
  route: { origin: string; destination: string };
  departureAt: string;       // ISO 8601
  busPlate: string;
  busType: string;
  checkIn: {
    checkedInAt: string | null;
    noShowAt: string | null;
  };
}
```

### Tests

| Test File | Type |
|-----------|------|
| `__tests__/ticketToken.test.ts` | Unit |
| `__tests__/getTicketVerification.test.ts` | Unit |
| `__tests__/qr.test.ts` | Unit |

---

## Cross-Domain Dependencies

| From | To | Via |
|------|----|-----|
| `lib/charter/charterStatus.ts` | `lib/audit` | `writeAdminAuditLog` |
| `lib/charter/charterStatus.ts` | `lib/core/db/notificationLogRepo` | `createNotificationLog` |
| `lib/charter/createCharterRequest.ts` | `lib/places` | `resolveOrCreatePlace` |
| `lib/charter/assertOperatorApproved.ts` | `lib/onboarding` | `getOperatorCapabilities` |
| `lib/jobs/autoCompleteTrips.ts` | `lib/trips` | `completeTripCore` |
| `lib/jobs/generateTrips.ts` | `lib/trips` | `generateTripsFromTemplates` |
| `lib/jobs/processPayouts.ts` | `lib/ledger` | `settlePayout`, `appendLedgerEntry` |
| `lib/jobs/processPayouts.ts` | `lib/onboarding` | `isPayoutAccountVerified` |
| `lib/jobs/reconcilePayments.ts` | `lib/payment` | `applyPaidStatusTransition`, `appendBookingPaidLedger` |
| `lib/jobs/reconcilePayments.ts` | `lib/booking` | `legalPredecessors` |
| `lib/jobs/reconcilePayments.ts` | `lib/ledger` | `refundOut` |
| `lib/jobs/generateTicketPdfs.ts` | `lib/booking` | `renderTicketPdf`, `customerBookingDetailSelect` |
| `lib/jobs/generateTicketPdfs.ts` | `lib/storage` | `putObject` |
| `lib/jobs/generateTicketPdfs.ts` | `lib/ticketing` | `mintTicketToken` |
| `lib/jobs/retentionSweeper.ts` | `lib/account` | retention day constants |
| `lib/jobs/retentionSweeper.ts` | `lib/storage` | `deleteObject` |
| `lib/jobs/charterExpirySweeper.ts` | `lib/charter` | `transitionCharterRequest`, `CharterError` |
| `lib/jobs/sendReminders.ts` | `lib/notification` | `sendSms`, `renderTemplate` |
| `lib/ticketing/getTicketVerification.ts` | `lib/core/db/client` | `prisma` |
