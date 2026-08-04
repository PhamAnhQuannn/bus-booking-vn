# 25 — Test Inventory

Testing stack: Vitest (unit + integration) + Playwright (e2e). Pre-commit hook runs `pnpm lint && pnpm tsc --noEmit`.

---

## Test Commands

| Command | What it runs |
|---------|-------------|
| `pnpm test` | Unit tests only (vitest) |
| `pnpm vitest:int` | Integration tests only (needs live DB) |
| `pnpm test:all` | Unit + integration |
| `pnpm test:e2e` | Playwright e2e |
| `pnpm vitest run path/to/file.test.ts` | Single unit test |
| `pnpm vitest run --config vitest.integration.config.ts path/to/file.int.test.ts` | Single integration test |

---

## Test Configuration

| File | Purpose |
|------|---------|
| `vitest.config.ts` | Unit tests — happy-dom environment, `@/*` path alias, excludes `*.int.test.ts` |
| `vitest.integration.config.ts` | Integration tests — node environment, sequential execution, 30s timeout, loads `.env.local` |
| `vitest.setup.ts` | Sets dummy `DATABASE_URL` (pg.Pool lazy), `NOTIFY_STUB=true` default |
| `vitest.integration.setup.ts` | Loads `.env.local` via dotenv, CI fallback |
| `playwright.config.ts` | 2 projects (chromium + mobile-390px), web server on :3001, CI headless |
| `test/stubs/server-only.ts` | Stub for `server-only` module (allows unit testing server-side code) |

---

## Unit Tests — lib/ Domain (`*.test.ts`)

| Path | Domain | What It Tests |
|------|--------|---------------|
| `lib/core/db/__tests__/searchCursor.test.ts` | core/db | Cursor encode/decode for pagination |
| `lib/core/db/__tests__/tenantScope.test.ts` | core/db | `withOperatorScope` filter injection |
| `lib/core/validation/__tests__/hold.test.ts` | core/validation | Hold input Zod schema |
| `lib/core/validation/__tests__/phone.test.ts` | core/validation | VN phone normalization (+84/0 formats) |
| `lib/core/validation/__tests__/search.test.ts` | core/validation | Search filter schema |
| `lib/auth/__tests__/jwt.test.ts` | auth | JWT sign/verify for all 3 realms |
| `lib/auth/__tests__/otp.test.ts` | auth | OTP generation, hashing, salt |
| `lib/auth/__tests__/otpProof.test.ts` | auth | Proof JWT issuance + verification |
| `lib/auth/__tests__/password.test.ts` | auth | Password hash + verify |
| `lib/auth/__tests__/csrf.test.ts` | auth | CSRF token generation + comparison |
| `lib/auth/__tests__/refreshToken.test.ts` | auth | Refresh token structure |
| `lib/auth/__tests__/session.test.ts` | auth | Customer session lifecycle |
| `lib/auth/__tests__/operatorSession.test.ts` | auth | Operator session + family reuse detection |
| `lib/auth/__tests__/operatorOtp.test.ts` | auth | Operator password reset OTP |
| `lib/auth/__tests__/authService.test.ts` | auth | Customer register/login/logout |
| `lib/auth/__tests__/adminAuthService.test.ts` | auth | Admin login + TOTP |
| `lib/auth/__tests__/totp.test.ts` | auth | TOTP enrollment + verification |
| `lib/auth/__tests__/sendOtp.test.ts` | auth | OTP dispatch via eSMS |
| `lib/auth/__tests__/requireCustomerAuth.test.ts` | auth | Customer auth guard |
| `lib/auth/__tests__/requireOperatorAuth.test.ts` | auth | Operator auth guard |
| `lib/auth/__tests__/requireAdminPage.test.ts` | auth | Admin page redirect guard |
| `lib/auth/__tests__/requireStepUp.test.ts` | auth | Step-up verification guard |
| `lib/auth/__tests__/safeReturnTo.test.ts` | auth | Open-redirect prevention |
| `lib/auth/__tests__/patchOperatorProfileSchema.test.ts` | auth | Profile patch validation |
| `lib/booking/__tests__/bookingRef.test.ts` | booking | BB-YYYY-XXXX-XXXX format |
| `lib/booking/__tests__/confirmationToken.test.ts` | booking | Single-use token |
| `lib/booking/__tests__/transitions.test.ts` | booking | Booking status state machine |
| `lib/booking/__tests__/attachGuestBookingByPhone.test.ts` | booking | Guest backfill (findFirst, not findUnique) |
| `lib/booking/__tests__/bookingDetailSelect.test.ts` | booking | Select whitelist shape |
| `lib/booking/__tests__/checkIn.test.ts` | booking | Check-in unit tests |
| `lib/booking/__tests__/getCustomerBookingDetail.test.ts` | booking | Customer booking view |
| `lib/booking/__tests__/initiateMomoBooking.test.ts` | booking | MoMo payment initiation |
| `lib/booking/__tests__/listCustomerBookings.test.ts` | booking | Customer booking list |
| `lib/booking/__tests__/ticketPdf.test.ts` | booking | PDF generation |
| `lib/catalog/__tests__/capacityGuard.test.ts` | catalog | Capacity reduction validation |
| `lib/catalog/__tests__/createRoute.test.ts` | catalog | Route creation |
| `lib/catalog/__tests__/deactivateRoute.test.ts` | catalog | Route deactivation |
| `lib/catalog/__tests__/updateRoute.test.ts` | catalog | Route update |
| `lib/catalog/__tests__/windowsOverlap.test.ts` | catalog | Time window collision |
| `lib/charter/__tests__/charterRef.test.ts` | charter | CH-YYYY-XXXXXX format |
| `lib/charter/__tests__/charterStatus.test.ts` | charter | Charter state machine |
| `lib/charter/__tests__/createCharterRequest.test.ts` | charter | Charter creation |
| `lib/charter/__tests__/getOperatorCharters.test.ts` | charter | Operator charter views |
| `lib/ledger/__tests__/balance.test.ts` | ledger | Operator balance derivation |
| `lib/ledger/__tests__/calcPayout.test.ts` | ledger | BigInt payout math + half-even |
| `lib/ledger/__tests__/feeConfig.test.ts` | ledger | Fee rate resolution |
| `lib/ledger/__tests__/ledgerRepo.test.ts` | ledger | Append-only entry |
| `lib/ledger/__tests__/addManualAdjustment.test.ts` | ledger | Manual adjustment |
| `lib/ledger/__tests__/buildRevenueCsv.test.ts` | ledger | Revenue CSV export |
| `lib/ledger/__tests__/buildBookingRevenueCsv.test.ts` | ledger | Booking revenue CSV |
| `lib/ledger/__tests__/chargeback.test.ts` | ledger | Chargeback processing |
| `lib/jobs/__tests__/charterExpirySweeper.test.ts` | jobs | Charter expiry logic |
| `lib/jobs/__tests__/generateTicketPdfs.test.ts` | jobs | Ticket PDF batch |
| `lib/jobs/__tests__/retentionSweeper.test.ts` | jobs | Retention sweep logic |
| `lib/admin/__tests__/bootstrapSuperAdmin.test.ts` | admin | First admin creation |
| `lib/admin/__tests__/getActionQueue.test.ts` | admin | Action queue |
| `lib/admin/__tests__/getAuditLog.test.ts` | admin | Audit log read |
| `lib/admin/__tests__/getCharterDispatchQueue.test.ts` | admin | Charter dispatch |
| `lib/admin/__tests__/getLedgerView.test.ts` | admin | Ledger view |
| `lib/admin/__tests__/getModerationQueue.test.ts` | admin | Moderation queue |
| `lib/admin/__tests__/getPayoutQueue.test.ts` | admin | Payout queue |
| `lib/admin/__tests__/getUserDetail.test.ts` | admin | User detail |
| `lib/admin/__tests__/inviteAdmin.test.ts` | admin | Admin invite |
| `lib/admin/__tests__/listAllOperators.test.ts` | admin | Operator list |
| `lib/admin/__tests__/moderation.test.ts` | admin | Content moderation |
| `lib/admin/__tests__/resetAdminTotp.test.ts` | admin | TOTP reset |
| `lib/admin/__tests__/revokeAdmin.test.ts` | admin | Admin revocation |
| `lib/admin/__tests__/searchUsers.test.ts` | admin | User search |
| `lib/admin/__tests__/setAdminRole.test.ts` | admin | Role assignment |
| `lib/admin/__tests__/suspendCustomer.test.ts` | admin | Customer suspension |
| `lib/analytics/__tests__/getAdminMetrics.test.ts` | analytics | Admin dashboard KPIs |
| `lib/api/__tests__/holdsClient.test.ts` | api | Holds fetch wrapper |
| `lib/flags/__tests__/flags.test.ts` | flags | Feature flag lookup + cache |
| `lib/ratelimit/__tests__/factory.test.ts` | ratelimit | Rate limiter factory |
| `lib/security/__tests__/holdCookie.test.ts` | security | Hold cookie signing |
| `lib/state/__tests__/holdTimerStore.test.ts` | state | Hold timer countdown |
| `lib/account/__tests__/validateDisplayName.test.ts` | account | Display name validation |
| `lib/__tests__/withErrorHandler.test.ts` | lib root | Error handler wrapper |

---

## Integration Tests (`*.int.test.ts`)

Require live PostgreSQL (docker compose). Run with `pnpm vitest:int`.

| Path | Domain | What It Tests |
|------|--------|---------------|
| `lib/core/db/__tests__/holdCap.int.test.ts` | core/db | Concurrent hold cap enforcement (advisory locks) |
| `lib/core/db/__tests__/holdRepo.int.test.ts` | core/db | Hold creation, capacity checks, expiry |
| `lib/core/db/__tests__/holdRepo.pspWindow.int.test.ts` | core/db | PSP window (20-min seat reservation for awaiting_payment) |
| `lib/auth/__tests__/otp.int.test.ts` | auth | OTP consume with CAS |
| `lib/booking/__tests__/checkIn.int.test.ts` | booking | Check-in with real DB |
| `lib/booking/__tests__/bookingRepo.int.test.ts` | booking | Booking repository queries |
| `lib/booking/__tests__/operatorBookingQueue.int.test.ts` | booking | Operator booking queue filtering |
| `lib/catalog/__tests__/capacityGuard.int.test.ts` | catalog | Capacity guard with $transaction + FOR UPDATE |
| `lib/catalog/__tests__/getOperatorBus.int.test.ts` | catalog | Bus detail query |
| `lib/catalog/__tests__/listOperatorBuses.int.test.ts` | catalog | Bus list query |
| `lib/charter/__tests__/charterExpirySweeper.int.test.ts` | charter | Charter expiry with real data |
| `lib/charter/__tests__/claimCharter.int.test.ts` | charter | First-accept-wins claiming |
| `lib/ledger/__tests__/chargeback.int.test.ts` | ledger | Chargeback with real ledger |
| `lib/ledger/__tests__/ledgerCreditFee.int.test.ts` | ledger | Credit + fee entry pair |
| `lib/ledger/__tests__/ledgerImmutability.int.test.ts` | ledger | DB trigger blocks UPDATE/DELETE |
| `lib/ledger/__tests__/refundOut.int.test.ts` | ledger | External refund flow |
| `lib/ledger/__tests__/retryPayout.int.test.ts` | ledger | Payout retry |
| `lib/ledger/__tests__/withdrawal.int.test.ts` | ledger | Withdrawal request flow |
| `lib/jobs/__tests__/reconcilePayments.int.test.ts` | jobs | Payment reconciliation |
| `lib/jobs/__tests__/retentionSweeper.int.test.ts` | jobs | PII anonymization |
| `lib/jobs/__tests__/cronJobs.int.test.ts` | jobs | Full cron job integration |
| `lib/admin/__tests__/adminService.int.test.ts` | admin | Admin service integration |
| `lib/audit/__tests__/adminAuditImmutability.int.test.ts` | audit | Audit log immutability trigger |
| `lib/notification/__tests__/dispatchNotifications.int.test.ts` | notification | Notification dispatch with SKIP LOCKED |
| `lib/payment/__tests__/applyPaidTransition.oversold.int.test.ts` | payment | Oversold capacity check during payment |
| `lib/staff/__tests__/staffService.int.test.ts` | staff | Staff CRUD |
| `lib/storage/__tests__/storage.int.test.ts` | storage | Storage stub operations |
| `lib/trips/__tests__/createTrip.int.test.ts` | trips | Trip creation with pickup snapshot |
| `lib/trips/__tests__/reassignBus.int.test.ts` | trips | Bus reassignment with overlap guard |
| `lib/trips/__tests__/searchTrips.int.test.ts` | trips | Trip search with filters |
| `lib/trips/__tests__/searchTrips.pagination.int.test.ts` | trips | Search cursor pagination |
| `lib/trips/__tests__/tripLifecycle.int.test.ts` | trips | Full lifecycle: scheduled → departed → completed |
| `lib/security/__tests__/tenantIsolation.int.test.ts` | security | Cross-tenant data leak prevention |
| `lib/account/__tests__/anonymizeCustomer.int.test.ts` | account | Customer PII anonymization |
| `lib/account/__tests__/changePassword.int.test.ts` | account | Password change flow |
| `lib/account/__tests__/changePhone.int.test.ts` | account | Phone change with OTP |
| `lib/account/__tests__/forgotPassword.int.test.ts` | account | Password recovery |
| `lib/account/__tests__/lockout.int.test.ts` | account | OTP lockout sentinel |

---

## API Route Tests (`app/api/**/route.test.ts`)

77 route test files covering request validation, auth guards, status codes, and error paths.

### By Domain

| Domain | Count | Key Tests |
|--------|-------|-----------|
| Auth (customer) | 8 | login, register, otp/send, otp/verify, logout, refresh, forgot-password |
| Auth (operator) | 6 | forgot-password, forgot-password/verify, forgot-password/reset, logout, password/change, refresh |
| Auth (admin) | 2 | login, totp/verify |
| Bookings | 3 | initiate, [id]/ticket, holds/create, holds/[id] |
| Holds | 2 | create, detail |
| Charter | 2 | create, [ref]/cancel |
| Cron | 9 | sweep-holds, close-sales, complete-trips, dispatch-notifications, generate-ticket-pdfs, generate-trips, process-payouts, send-reminders, charter-expiry |
| Op/buses | 5 | create, [id] detail, [id] deactivate, maintenance create, maintenance [mid] |
| Op/routes | 2 | create, [id] update |
| Op/trips | 1 | [id] patch-price-lock |
| Op/bookings | 2 | check-in, no-show |
| Op/charter | 3 | claim, accept, decline |
| Op/other | 8 | profile, register, resubmit, activity, scan, kyb/submit, kyb/upload-url, money/withdraw, payout-account |
| Admin/operators | 6 | approve, reject, suspend, reinstate, fee-override, kyb/url |
| Admin/customers | 2 | suspend, reinstate |
| Admin/finance | 6 | fee/global, chargeback, refund-out, ledger/adjustment, payouts/approve, payouts/retry |
| Admin/moderation | 2 | reports/resolve, trips/disable |
| Admin/system | 3 | flags, admins, admins/revoke |
| Other | 2 | health, geo |

---

## Root-Level Tests (`__tests__/`)

| Path | What It Tests |
|------|---------------|
| `__tests__/proxy.admin.test.ts` | Admin auth guard in proxy.ts |
| `__tests__/proxy.ratelimit.test.ts` | Rate-limit enforcement in proxy.ts |
| `__tests__/proxy.requestId.test.ts` | Request-ID propagation in proxy.ts |

---

## E2E Tests (`e2e/`)

19 Playwright spec files. Run with `pnpm test:e2e`.

| File | Portal | What It Tests |
|------|--------|---------------|
| `auth-otp-roundtrip.spec.ts` | Customer | OTP send → verify → login flow |
| `search.spec.ts` | Customer | Trip search + filters via URL params |
| `hold-flow.spec.ts` | Customer | Hold creation + expiry countdown |
| `stub-payment.spec.ts` | Customer | Payment via stub gateway → booking |
| `momo-booking.spec.ts` | Customer | MoMo payment integration |
| `account-settings.spec.ts` | Customer | Profile + phone + password settings |
| `account-password-reset.spec.ts` | Customer | Forgot password flow |
| `data-leak-smoke.spec.ts` | All | Verify no sensitive data exposed (tenant isolation) |
| `op-first-login.spec.ts` | Operator | Force password change on first login |
| `op-fleet.spec.ts` | Operator | Bus creation + maintenance + deactivation |
| `op-routes.spec.ts` | Operator | Route creation + pickup areas |
| `op-trips.spec.ts` | Operator | Trip scheduling + lifecycle |
| `op-booking-queue.spec.ts` | Operator | Booking queue + check-in |
| `op-reports.spec.ts` | Operator | Revenue + payout reports |
| `op-staff.spec.ts` | Operator | Staff hiring + assignment |
| `op-staff-client.spec.ts` | Operator | Staff member console view |
| `op-profile.spec.ts` | Operator | Profile + bank account |
| `op-forgot-password.spec.ts` | Operator | Password reset |
| `cron-recurring.spec.ts` | System | Recurring trip generation + cron execution |

### E2E Helpers

| File | Purpose |
|------|---------|
| `e2e/helpers/csrf.ts` | `primeCsrf()` — extract CSRF token from Playwright storage state for API calls |

---

## Test Statistics

| Category | Count |
|----------|-------|
| Unit test files (lib/) | ~75 |
| Integration test files (lib/) | ~38 |
| API route test files (app/) | ~77 |
| Root test files (__tests__/) | 3 |
| Component test files | 1 |
| E2E spec files | 19 |
| **Total test files** | **~213** |
