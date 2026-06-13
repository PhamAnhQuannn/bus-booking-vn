# PII Inventory — Bus-Booking VN

**Date:** 2026-06-12 | **Owner:** Solo dev | **Next Review:** 2026-09-12 (quarterly or on schema change)

## PII Fields

| Field | Table / Form | Category | Sensitive? | Source | Lawful Basis | Purpose | Retention | Sub-processors | Encryption | Risks |
|---|---|---|---|---|---|---|---|---|---|---|
| phone | Customer | contact | no | user | contract | login + booking contact | until account delete + anonymize | eSMS (SMS), Upstash (rate-limit key) | TLS transit; plaintext at rest | medium — primary auth identifier |
| email | Customer | contact | no | user | contract | ticket delivery | until account delete → NULL | email provider (deferred) | TLS transit; plaintext at rest | low |
| displayName | Customer | identity | no | user | contract | booking display | until account delete → 'Deleted user' | none | TLS; plaintext at rest | low |
| passwordHash | Customer, OperatorUser, AdminUser | auth | no | user | contract | authentication | until account delete | none | argon2id/scrypt **hashed** | low |
| contactPhone | Operator | contact | no | user | contract | business contact | indefinite (active operator) | eSMS | TLS; plaintext at rest | low |
| notificationPhone | Operator | contact | no | user | contract | SMS alerts | indefinite | eSMS | TLS; plaintext at rest | low |
| contactEmail | Operator | contact | no | user | contract | business comms | indefinite | email provider (deferred) | TLS; plaintext at rest | low |
| legalName | Operator | business | no | user | contract | legal identification | indefinite | none | TLS; plaintext at rest | low |
| contactName | Operator | identity | no | user | contract | business contact person | indefinite | none | TLS; plaintext at rest | low |
| address | Operator | address | no | user | contract | business address | indefinite | none | TLS; plaintext at rest | low |
| phone | OperatorUser | contact | no | derived | contract | operator staff login | indefinite (active staff) | eSMS | TLS; plaintext at rest | low |
| contactPhone | OperatorUser | contact | no | derived | contract | staff contact | indefinite | eSMS | TLS; plaintext at rest | low |
| notificationPhone | OperatorUser | contact | no | derived | contract | staff alerts | indefinite | eSMS | TLS; plaintext at rest | low |
| displayName | OperatorUser | identity | no | admin | contract | staff display | indefinite | none | TLS; plaintext at rest | low |
| **tempPasswordPlain** | OperatorUser | auth | **yes** | system | contract | first-login provisioning | **until first password change** | none | **PLAINTEXT** | **high** — cleartext password in DB; gated by Issue 113; must remove before go-live |
| **accountNumber** | PayoutAccount | financial | **yes** | user | contract | payout disbursement | indefinite (active operator) | future bank API | **PLAINTEXT** (masked on display to last-4) | **high** — bank account stored plaintext; required for payout-send |
| accountHolderName | PayoutAccount | financial | no | user | contract | payout verification | indefinite | future bank API | TLS; plaintext at rest | medium |
| buyerName | Booking | identity | no | user | contract | ticket + manifest | **365d post-departure → '[expired]'** | none | TLS; plaintext at rest | low |
| buyerPhone | Booking | contact | no | user | contract | booking contact + SMS | **365d post-departure → '+8490xxxxxx0'** | eSMS | TLS; plaintext at rest | low |
| buyerEmail | Booking | contact | no | user | contract | ticket delivery | **365d post-departure → NULL** | email provider (deferred) | TLS; plaintext at rest | low |
| pickupDetail | Booking, Hold | location | no | user | contract | custom pickup instructions | 365d (with booking) | none | TLS; plaintext at rest | medium — free-text, may contain address PII |
| escalationNote | Booking | notes | no | operator | legitimate interest | trip operations | indefinite | none | TLS; plaintext at rest | low |
| customerPhone | Hold | contact | no | user | contract | pre-booking snapshot | hold expiry (5min) + DB cleanup | none | TLS; plaintext at rest | low |
| customerName | Hold | identity | no | user | contract | pre-booking snapshot | hold expiry + DB cleanup | none | TLS; plaintext at rest | low |
| customerEmail | Hold | contact | no | user | contract | pre-booking snapshot | hold expiry + DB cleanup | none | TLS; plaintext at rest | low |
| contactName | CharterRequest | identity | no | user | contract | charter lead-gen | indefinite | none | TLS; plaintext at rest | low |
| contactPhone | CharterRequest | contact | no | user | contract | charter contact | indefinite | eSMS | TLS; plaintext at rest | low |
| contactEmail | CharterRequest | contact | no | user | contract | charter contact | indefinite | email provider | TLS; plaintext at rest | low |
| email | AdminUser | contact | no | system | contract | admin login | indefinite | none | TLS; plaintext at rest | low |
| **totpSecret** | AdminUser | auth/2FA | **yes** | system | contract | admin 2FA | indefinite | none | **PLAINTEXT** (redacted in logs) | **high** — 2FA secret stored plaintext; compromise = bypass TOTP |
| recipient | NotificationLog | contact | no | derived | contract | SMS/email dispatch audit | indefinite | eSMS, email provider | TLS; plaintext at rest | medium — phone/email in dispatch log |
| payload | NotificationLog | content | no | derived | contract | message audit trail | indefinite | none | TLS; plaintext at rest | medium — pre-rendered SMS body with names/dates |
| phone | OtpAttempt | contact | no | user | contract | OTP verification | OTP TTL (5min) | none | TLS; plaintext at rest | low |
| codeHash | OtpAttempt | auth | no | system | contract | OTP verification | OTP TTL | none | **SHA-256 hashed** | low |
| ipAddress | OtpAttempt, OperatorOtpAttempt | device | no | derived | legitimate interest | abuse prevention | OTP TTL | none | TLS; plaintext at rest | low — **not in logger redaction list** |

## Sub-Processors

| Vendor | Data Categories | Region | DPA? | Status | Env Vars |
|---|---|---|---|---|---|
| MoMo (payment) | order ID, amount, callback URLs | Vietnam | pending | **Active** (sandbox default) | `MOMO_*` |
| eSMS.vn (SMS) | phone numbers, SMS body (OTP, booking confirmations) | Vietnam | pending | **Stubbed** (`NOTIFY_STUB=true`) | `ESMS_*` |
| Upstash (Redis) | IP addresses, usernames, phone (as rate-limit keys) | US/EU | pending | **Active** in prod only | `UPSTASH_REDIS_REST_*` |
| Vercel (hosting) | server logs, request metadata | US | pending | **Active** | `CRON_SECRET` |
| Sentry (errors) | error context (scrubbed via REDACT_KEYS) | — | N/A | **Deferred** (SDK not installed) | `SENTRY_DSN` |
| Email provider | email addresses, message body | — | N/A | **Deferred** (stub only) | none |
| S3-compatible storage | KYB document files (business license, ID photos) | — | pending | **Stubbed** (`STORAGE_STUB=true`) | `STORAGE_*` |
| Future bank API | bank account number, holder name, payout amount | Vietnam | N/A | **Deferred** (stub payout) | none |

## Logger Redaction Coverage

**Redacted (44 paths):** customerPhone, customerName, customerEmail, buyerPhone, buyerName, buyerEmail, phone, newPhone, contactPhone, notificationPhone, pickupDetail, customPickup, escalationNote, address, otp, otpCode, code, otpProof, accessToken, refreshToken, password, passwordHash, newPassword, currentPassword, tempPassword, refreshTokenHash, codeHash, totpSecret, totpCode, accountNumber, recipient, bb_hold, HOLD_SECRET, ESMS_API_KEY, ESMS_SECRET_KEY, authorization, cookie, req.query, req.url

**NOT redacted (gaps):**
- `ipAddress` on OTP attempts — add to redaction list
- `argsRedacted` in AdminAuditLog — partially redacted (phone last-4 visible)
- `notes` on CharterRequest — free-text, may contain PII

## Consent Tracking

| Consent Type | Version | Collection Point | Storage | Immutable? |
|---|---|---|---|---|
| `no_refund` | 2026-06-01 | Booking checkout | ConsentRecord (append-only, DB trigger) | **Yes** |
| `pii_storage` | 2026-06-01 | Booking checkout | ConsentRecord (append-only, DB trigger) | **Yes** |

## Retention Policy

| Data | Trigger | Action | Cron |
|---|---|---|---|
| Guest booking PII (name/phone/email) | 365d post-departure | Anonymize → `[expired]` / `+8490xxxxxx0` / NULL | `/api/cron/retention` daily 3AM |
| KYB documents (rejected/suspended operators) | 90d post-upload | Delete from storage, stamp `purgedAt` | `/api/cron/retention` daily 3AM |
| Customer account deletion (on-demand) | User request | phone→NULL, displayName→'Deleted user', bookings anonymized, sessions revoked | `/api/account/delete` |
| OTP attempts | 5min TTL (DB expiry) | Row expires, available for cleanup | natural expiry |
| Holds | 5min expiry | Swept to `expired` status | `/api/cron/sweep-holds` every min |

## DSAR Readiness

| Right | Implemented? | Endpoint | Notes |
|---|---|---|---|
| Access/Export | **Partial** | No dedicated export endpoint | Customer can view bookings via `/account/bookings` |
| Deletion | **Yes** | `DELETE /api/account/delete` | Soft-delete + anonymization; ledger entries retained (financial obligation) |
| Rectification | **Partial** | `PATCH /api/account/name`, phone change flow | Name + phone changeable; email change not implemented |
| Portability | **No** | — | No machine-readable export (JSON/CSV) |
| Consent withdrawal | **No** | — | Consent records are immutable; withdrawal would require booking cancellation |

## Risks Flagged

### P0 — Pre-Launch Blockers
1. **tempPasswordPlain stored in cleartext** — OperatorUser.tempPasswordPlain is plaintext in DB. Issue 113 gates go-live. Must encrypt or remove before production.
2. **No DPA with any sub-processor** — MoMo, eSMS, Upstash, Vercel all pending. Required for Vietnam PDPL compliance.

### P1 — High Priority
3. **Bank account number stored plaintext** — PayoutAccount.accountNumber needed for payout-send but no field-level encryption. Consider encrypting at rest with app-level key.
4. **TOTP secret stored plaintext** — AdminUser.totpSecret is the 2FA shared secret. DB compromise = TOTP bypass. Consider encrypting with app-level key.
5. **ipAddress not in logger redaction list** — OtpAttempt.ipAddress could leak to structured logs.
6. **No data portability endpoint** — DSAR right to portability not implemented.

### P2 — Medium Priority
7. **NotificationLog stores plaintext recipient + payload** — SMS dispatch log retains phone numbers and rendered message body indefinitely. Add retention policy.
8. **CharterRequest.notes free-text** — May contain PII; not in logger redaction list.
9. **AdminAuditLog not tamper-proof** — Can be deleted (no immutability trigger unlike LedgerEntry/ConsentRecord).
