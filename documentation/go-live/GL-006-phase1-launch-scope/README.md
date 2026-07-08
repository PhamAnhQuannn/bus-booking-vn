# GL-006: Phase 1 Launch Scope

> Status: DRAFT | Created: 2026-06-21

## Phase 1 Definition

- **Operators**: 1-2 family-owned bus operators (platform owner = operator = same entity)
- **Payment**: VietQR bank transfer (SePay webhook) + cash at boarding
- **Bank account**: Single family Agribank account (BIN 970405)
- **Hosting**: Vercel Pro sin1 + Neon + Upstash (ADR-020 D11, Stage 0). FPT Cloud Docker self-hosted retained as backup.
- **Corridor**: Thanh Hoa ↔ TPHCM (beachhead route)
- **Goal**: Validate core booking flow with real passengers before scaling to external operators

## Payment Model Clarification

Phase 1 uses **central collection** (single Agribank account). This is correct and legal because:

- Platform owner and operator are the **same legal entity** (family)
- No third-party fund relationship exists — customer pays operator directly
- "Thu hộ chi hộ" (Decree 52/2024 Art. 3(17)) requires a **third-party** collection relationship
- No SBV IPS license needed
- No agency contract needed
- No legal opinion needed

Split-settlement (DS-009) becomes relevant only when adding **external** operators in Phase 2+.

## ADR Scope

| ADR | Scope | Reason |
|-----|-------|--------|
| ADR-001 Stack | IN-SCOPE | Core stack unchanged |
| ADR-002 NFR Targets | PARTIAL | Target 99.5% uptime + basic latency. Tet surge (2,000 concurrent) deferred |
| ADR-003 Auth | PARTIAL | Operator password auth + admin TOTP only. Customer auth deferred to Phase 2 (proxy 410 gate active) |
| ADR-004 Multi-Tenancy | PARTIAL | `withOperatorScope` stays for data isolation. Per-operator fee override unused (single operator) |
| ADR-005 Payment | PARTIAL | Bank transfer + cash only. Split-settlement, MoMo, VNPay all deferred |
| ADR-006 Pricing | PARTIAL | Trip pricing active. Commission can be 0% for family operator. Tax withholding deferred |
| ADR-007 Observability | PARTIAL | Stdout JSON logs + basic health check. BetterStack/Sentry deferred |
| ADR-008 Security | IN-SCOPE | OWASP headers, CSRF, rate limiting, input validation all needed |
| ADR-009 Concurrency | IN-SCOPE | SELECT FOR UPDATE + hold TTL prevent overselling |
| ADR-010 Booking Lifecycle | IN-SCOPE | Core domain — hold → book → pay → confirm |
| ADR-011 Search | IN-SCOPE | SSR search + real-time availability |
| ADR-012 Background Jobs | PARTIAL | Hold expiry, notification dispatch, sales close. E-invoice/PII sweepers deferred |
| ADR-013 Notifications | PARTIAL | eSMS for OTP + booking confirmation. ZNS, brandname SMS deferred |
| ADR-014 E-Invoice | DEFERRED | Not needed for family operator. Activate when ERC + tax registration complete |
| ADR-015 Error Contract | IN-SCOPE | Standard error shape for API |
| ADR-016 Module Boundaries | IN-SCOPE | Code hygiene, barrel imports |
| ADR-017 Schema Evolution | IN-SCOPE | Forward-only migrations |
| ADR-018 Testing Strategy | IN-SCOPE | E2E + integration + unit pyramid |
| ADR-019 State Machines | PARTIAL | Trip + Booking + Hold FSMs needed. Payout/Charter/EInvoice FSMs deferred |
| ADR-020 Deployment | IN-SCOPE | Vercel Pro sin1 + Neon + Upstash (FPT Cloud backup) |

## DS Scope

| DS | Scope | Reason |
|----|-------|--------|
| DS-001 Data Model | IN-SCOPE | Core schema |
| DS-002 Migration Strategy | IN-SCOPE | Forward-only migrations |
| DS-003 API Contract | IN-SCOPE | Route handlers + Zod validation |
| DS-004 API Versioning | DEFERRED | No external consumers yet |
| DS-005 Webhook Design | PARTIAL | SePay webhook only. MoMo/VNPay/ZaloPay adapters deferred |
| DS-006 Background Jobs | PARTIAL | Hold expiry + notification dispatch + sales close. E-invoice/PII/license sweepers deferred |
| DS-007 Refund Flow | PARTIAL | Manual bank transfer refund only. PSP refund APIs deferred |
| DS-008 ZaloPay Adapter | DEFERRED | Phase 3 |
| DS-009 Split-Settlement | DEFERRED | Phase 2+ (external operators) |
| DS-010 Chargeback | DEFERRED | No card payments in Phase 1 |
| DS-011 Tax Withholding | DEFERRED | Family operator = no withholding |
| DS-012 E-Invoice Fields | DEFERRED | No e-invoice in Phase 1 |
| DS-013 VietQR/SePay | IN-SCOPE | Primary payment method |
| DS-014 Complaint API | DEFERRED | Handle via Zalo/phone for Phase 1 |
| DS-015 DSAR/Privacy | DEFERRED | < 10k users, defer until scale |
| DS-016 Promotions | DEFERRED | Phase 2+ |
| DS-017 Deployment Portability | IN-SCOPE | Vercel primary; Docker on FPT Cloud as backup |

## Phase 1 Launch Checklist

Simplified from GL-001. Only items that apply to family operator + bank transfer + cash.

### Infrastructure

> Updated 2026-06-21: Infrastructure checklist now targets Vercel stack. See GL-001 for full checklist.

- [ ] Vercel Pro project created (sin1 region)
- [ ] Neon PostgreSQL 16 provisioned (ap-southeast-1)
- [ ] Upstash Redis provisioned (ap-southeast-1)
- [ ] Production deployment succeeding on Vercel
- [ ] Custom domain configured + SSL active
- [ ] DNS pointing to Vercel
- [ ] Cloudflare active (free tier acceptable for Phase 1)
- [ ] FPT Cloud Docker Compose backup validated (fallback)

### Security

- [ ] OWASP security headers configured
- [ ] CSRF double-submit middleware active
- [ ] Rate limiting on auth endpoints
- [ ] OTP lockout (3 failures → 15-min) working
- [ ] Production JWT secrets generated
- [ ] CRON_SECRET generated
- [ ] Gitleaks passing
- [ ] Admin password changed from `123456`
- [ ] `tempPasswordPlain` column handled

### Payment

- [ ] `SEPAY_API_KEY` configured (production)
- [ ] `VIETQR_ACCOUNT_NUMBER` + `VIETQR_BANK_BIN` set to family Agribank
- [ ] SePay webhook URL registered and tested with real transfer
- [ ] SePay bearer token verification active
- [ ] BookingRef extraction from memo working
- [ ] `PAYMENTS_STUB=false` in production
- [ ] Append-only ledger triggers active
- [ ] Cash-at-boarding flow working (operator confirms on console)
- [ ] Manual refund process documented

### Notifications

- [ ] eSMS production API key configured
- [ ] OTP SMS delivery working
- [ ] Booking confirmation SMS working

### Data

- [ ] All data in Singapore region (Neon ap-southeast-1, Upstash ap-southeast-1, Vercel sin1)
- [ ] Privacy policy published
- [ ] Terms of service published

### Cron Jobs

- [ ] Hold expiry sweep (10-min TTL)
- [ ] Notification dispatch
- [ ] Sales close (pre-departure cutoff)
- [ ] Supercronic sidecar running (`TZ=Asia/Ho_Chi_Minh`)

### Smoke Tests

- [ ] Customer: search → select trip → VietQR payment → booking confirmed
- [ ] Customer: search → select trip → cash booking → operator confirms
- [ ] Operator: view bookings → view manifest → mark departed → mark completed
- [ ] Health check endpoint returning 200

## GL-001 Items Deferred to Phase 2+

These GL-001 checklist items do not apply to Phase 1 family operator:

| Item | Why deferred |
|------|-------------|
| HD-006 payment & webhook security audit | Formal audit overkill for family operator + SePay only |
| HD-009 financial integrity audit | No external operator fund handling |
| Payment collection model legal clearance | Family = same entity, no thu hộ chi hộ |
| Admin reconciliation dashboard (~5% memo mismatch) | Handle manually for low volume |
| Payment anomaly alerting | Low volume, manual monitoring sufficient |
| Pickup areas (personal pickup destinations) | Station-only in Phase 1. Feature activates at 4 operators (#244-#253) |
| eSMS brandname approval (5-10 weeks) | Use generic sender for Phase 1; brandname for Phase 2 |
| DPO appointment | < 10k users, defer |
| DPA with processors | Family operation, minimal processor relationships |
| E-invoice mapping (Decree 70/2025) | No e-invoice in Phase 1 |
| Tax withholding | Family operator exempt |
| DSAR API | < 10k users, defer |
| PII anonymization cron | Defer until scale |
| BetterStack monitoring | Stdout logs + manual checks for Phase 1 |
| Sentry | Defer; check logs manually |
| TOTP backup codes | Family admin can reset directly |
| `operatorLicenseAlert` cron | Family operator = no license to track |
| `paymentRecon` sweeper | SePay webhook primary; manual reconciliation for edge cases |
| `strandedPayoutRecovery` cron | No payout to external operators |

## Phase 2 Triggers

Activate deferred specs when these conditions are met:

| Trigger | Activates |
|---------|-----------|
| First **external** operator onboarded | DS-009 split-settlement, ADR-004 full multi-tenancy, agency contracts, IPS legal opinion |
| ERC (business registration) obtained | ADR-014 e-invoice, DS-011 tax withholding, DS-012 e-invoice fields |
| > 1,000 monthly bookings | ADR-007 full observability (BetterStack + Sentry), HD-006/009 audits |
| > 10,000 registered users | DS-015 DSAR/privacy, DPO appointment, PII anonymization cron |
| MoMo/VNPay integration | DS-005 full webhook pipeline, DS-010 chargebacks, DS-007 PSP refunds |
| 4 operators onboarded | Pickup areas feature (PICKUP-01..10, #244-#253). Phase 1 = station-only |
| > 10 operators | DS-016 promotions, brandname SMS, admin reconciliation dashboard |

## Cross-References

- GL-001 — full launch checklist (Phase 2+ items)
- ADR-005 — payment architecture (split-settlement = Phase 2+)
- DS-013 — VietQR/SePay design (Phase 1 primary payment)
- ADR-020 — Vercel + Neon + Upstash deployment (Stage 0, FPT Cloud backup)
