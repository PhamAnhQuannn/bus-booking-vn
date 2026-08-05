# DPA Draft — SePay (payment processor)

> **DRAFT — not a signed agreement, not legal advice.** For counsel review before signing (owner: user).
> Maps to PDPL 2025 Art.25 (controller↔processor). Bus-Booking = Controller; SePay = Processor.

| Item | Value |
|------|-------|
| Processor | SePay (VietQR bank-transfer webhook) |
| Data processed | payment memo, `bookingRef`, transfer amount/timestamp |
| Purpose limitation | ONLY to reconcile inbound bank transfers to bookings; no secondary use |
| Location | Vietnam (domestic — no cross-border transfer) |
| Sub-processors | none permitted without prior written notice |
| Security | webhook authenticated via `SEPAY_API_KEY` bearer; TLS in transit |
| Retention | processor retains only as needed for reconciliation + legal record |
| Breach obligation | notify Bus-Booking **without undue delay** (≤24h) on any incident; cooperate with the 72h MPS filing |
| Deletion on termination | delete/return all Bus-Booking personal data on contract end |
| Audit | Bus-Booking may request evidence of compliance |

**Action (owner: user):** obtain SePay's DPA/terms, reconcile against the above, sign.
