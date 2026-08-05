# DPA Draft — MISA meInvoice (e-invoice)

> **DRAFT — not a signed agreement, not legal advice.** For counsel review before signing (owner: user).
> Maps to PDPL 2025 Art.25. Applies when `EINVOICE_ENABLED=misa` (Circular 78/2021). Deferred until e-invoice go-live.

| Item | Value |
|------|-------|
| Processor | MISA meInvoice (GDT-certified e-invoice issuance) |
| Data processed | buyer name, tax id (MST), invoice line items, transport fields (plate, route) |
| Purpose limitation | ONLY to issue/transmit legal e-invoices to GDT; no secondary use |
| Location | Vietnam (domestic) |
| Sub-processors | GDT (tax authority) as legal recipient — disclosed |
| Security | API auth via `MISA_API_KEY` over HTTPS (env.ts enforces https) |
| Retention | statutory invoice retention (per tax law) |
| Breach obligation | notify Bus-Booking ≤24h; cooperate with MPS filing |
| Deletion on termination | subject to statutory invoice-retention overrides |

**Action (owner: user):** sign MISA DPA when enabling e-invoice; confirm GDT certification + transport-field mapping (FI-015).
