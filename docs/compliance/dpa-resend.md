# DPA Draft — Resend (transactional email)

> **DRAFT — not a signed agreement, not legal advice.** For counsel review before signing (owner: user).
> Maps to PDPL 2025 Art.25 + cross-border (Resend = US). Applies when `EMAIL_PROVIDER=resend`.

| Item | Value |
|------|-------|
| Processor | Resend (email delivery) |
| Data processed | recipient email, email content (booking confirmation, receipts) |
| Purpose limitation | ONLY transactional email; no marketing/profiling |
| Location | **United States (cross-border transfer)** → requires CDTIA filing |
| Sub-processors | Resend's infra sub-processors — obtain list |
| Security | API auth via `RESEND_API_KEY`; TLS; SPF/DKIM |
| Retention | delivery logs per Resend policy; minimize |
| Breach obligation | notify Bus-Booking without undue delay; cooperate with MPS filing |
| Deletion on termination | delete recipient data on contract end |
| Cross-border | **CDTIA (MPS A05) filing required** (owner: user) |

**Action (owner: user):** sign Resend's DPA (they publish a standard DPA); file CDTIA for the US transfer.
