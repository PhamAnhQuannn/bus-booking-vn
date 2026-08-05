# PII Inventory (ROPA) — 2026-08-04

Maps to HD-007 (PDPL 2025 compliance). Records what personal data is collected, where, lawful basis,
retention, and downstream processors. Cross-checked against `prisma/schema.prisma`.

## Data categories
| Data | Fields (schema) | Subject | Lawful basis (PDPL) | Retention |
|------|-----------------|---------|---------------------|-----------|
| Customer contact | `Customer.phone/email/displayName` | Customer | Contract performance | Account lifetime + legal window |
| Booking buyer | `Booking.buyerName/buyerPhone/buyerEmail` | Buyer (may be guest) | Contract performance | Per retention policy; anonymized by `anonymize-customers` cron |
| Auth credential | `Customer.passwordHash`, `OperatorUser.passwordHash` | Customer/Operator | Legitimate interest (security) | Account lifetime |
| Operator contact | `OperatorUser.phone/email/contactPhone/notificationPhone/username/displayName` | Operator staff | Contract | Account lifetime |
| Payout bank details | `PayoutAccount.accountNumber` (**AES-256-GCM at rest**, `BANK_ENCRYPTION_KEY`), `bankName/accountHolderName` | Operator | Contract (payout) | Account lifetime |
| Admin TOTP | `AdminUser.totpSecret` (**AES-256-GCM at rest**, `TOTP_ENCRYPTION_KEY`) | Admin | Security | Account lifetime |
| Session/token | JWT (in cookies), `confirmationToken`, `bb_hold` | Customer | Contract | Short-lived |

## Downstream processors (cross-border)
| Processor | Data shared | Location | DPA | CDTIA |
|-----------|-------------|----------|-----|-------|
| Neon (Postgres) | all above | Singapore (ap-southeast-1) | needed | user-handled |
| Upstash (Redis) | rate-limit keys (phone/IP hashes) | Singapore | needed | user-handled |
| Vercel (hosting) | request data | sin1 | needed | user-handled |
| SePay | payment memo, bookingRef | Vietnam | needed | domestic |
| eSMS.vn | phone + OTP (when NOTIFY_STUB=false) | Vietnam | needed | domestic |
| Resend | email (when EMAIL_PROVIDER=resend) | US | needed | user-handled |
| MISA (e-invoice) | buyer name/tax id (when EINVOICE=misa) | Vietnam | needed | domestic |

## Privacy/Terms gap-check (P3.1/P3.2)
- `app/privacy/page.tsx` — **substantially PDPL-complete**: purpose, lawful basis, retention, data-subject
  rights, complaint channel, third-party disclosure, cross-border transfer, contact all present.
  **Residual gap: no named DPO** (Data Protection Officer) — this is an org appointment, not page text.
- `app/terms/page.tsx` + `app/chinh-sach-huy-ve-hoan-tien/page.tsx` — **complete**: responsibilities,
  payment, refund/cancellation, liability limit, governing law present. No content gap found.

## User-owned legal checklist (P3.6 — owner: user, NOT auto-completable)
- [ ] **owner: user** — Appoint a DPO + add contact to the privacy policy (PDPL 2025, payment processor = no SME exemption).
- [ ] **owner: user** — Central-collection legal clearance (Nghị định 52/2024 thu-hộ/chi-hộ): IPS license OR legal opinion OR split-settlement.
- [ ] **owner: user** — CDTIA cross-border filing (MPS A05, ≤60 days) for Neon/Vercel/Upstash/Resend.
- [ ] **owner: user** — Sign the 4 processor DPAs (`docs/compliance/dpa-*.md` drafts).
- [ ] **owner: user** — Enable Neon PITR 30-day (also P1.16) + secrets-manager export.

> These are DRAFTS / pointers. Nothing here is a legal opinion; the legal items above require the user
> (or their counsel) and are not marked done by this process.
