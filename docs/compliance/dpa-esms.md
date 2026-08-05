# DPA Draft — eSMS.vn (SMS/OTP delivery)

> **DRAFT — not a signed agreement, not legal advice.** For counsel review before signing (owner: user).
> Maps to PDPL 2025 Art.25. Bus-Booking = Controller; eSMS = Processor. Applies when `NOTIFY_STUB=false`.

| Item | Value |
|------|-------|
| Processor | eSMS.vn (brandname SMS + OTP) |
| Data processed | recipient phone number, OTP/notification message content |
| Purpose limitation | ONLY to deliver OTP + transactional booking SMS; no marketing reuse |
| Location | Vietnam (domestic) |
| Sub-processors | telco carriers (delivery) — disclosed |
| Security | API auth via `ESMS_API_KEY`/`ESMS_SECRET_KEY`; TLS |
| Retention | message logs per eSMS policy; minimize |
| Breach obligation | notify Bus-Booking ≤24h; cooperate with 72h MPS filing |
| Deletion on termination | delete recipient data on contract end |

**Action (owner: user):** sign eSMS DPA; also complete brandname registration (Decree 91/2020) before go-live SMS.
