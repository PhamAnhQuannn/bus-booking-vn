> ← [Previous](../18-security/) | [Index](../README.md) | [Next →](../20-observability/)

## 19. Compliance & Data Privacy

### 19.1 VN PDPD 2023 — Vietnam's Personal Data Protection Decree

**Full name**: Nghị định 13/2023/NĐ-CP (Decree 13/2023/ND-CP), effective July 1, 2023.

**What it governs**: How organizations collect, store, process, transfer, and erase personal data of individuals in Vietnam. Similar in spirit to Europe's GDPR but with Vietnam-specific requirements.

**Key obligations for us**:

| Obligation | What It Means | How We Comply |
|------------|--------------|---------------|
| **Consent** | Must get clear consent before collecting personal data | Consent checkbox at checkout + registration; separate consent for marketing |
| **Purpose limitation** | Data used only for stated purpose | We state: "to process your booking and send your ticket" — not "to sell to advertisers" |
| **Data minimization** | Collect only what's needed | Booking needs name + phone + email. We don't ask for ID number, date of birth, etc. |
| **Access right** | Individual can request a copy of their data | Admin support can export a customer's data |
| **Correction right** | Individual can request corrections | Edit profile / contact support |
| **Deletion right** | Individual can request data erasure | See anonymize-in-place below |
| **Breach notification** | Must notify authorities + affected individuals within 72 hours of a data breach | Incident runbook + notification templates prepared |
| **Cross-border transfer** | Special rules for transferring data outside Vietnam | We store data in Vietnam-region infrastructure where possible |

### 19.2 Anonymize-in-Place — The Erase vs. Retain Tension

**The problem**: A customer requests account deletion (their right under PDPD). But we MUST retain financial records for tax/audit/dispute purposes. Deleting the booking rows would destroy the money trail.

**The solution**: Anonymize-in-place.
- **Hard-delete**: Account credentials, session tokens, preferences → gone forever
- **Anonymize**: Booking rows stay, but PII (personally identifiable information) is scrubbed:
  - `buyerName` → `"[deleted]"`
  - `buyerPhone` → `"[deleted]"`
  - `buyerEmail` → `"[deleted]"`
  - `bookingRef`, `amount`, `tripId`, `status` → **preserved** (financial record)

The booking still shows "someone paid 450,000₫ for trip X" (audit trail intact) but no longer identifies who.

### 19.3 PII — Personally Identifiable Information

**What it is**: Any data that can identify a specific individual. In our system:

| PII Field | Where Stored | Retention |
|-----------|-------------|-----------|
| Customer name | Booking.buyerName, Customer.name | Until account deletion (then anonymized) |
| Phone number | Booking.buyerPhone, Customer.phone | Until account deletion |
| Email | Booking.buyerEmail, Customer.email | Until account deletion |
| Operator contact name | Operator.contactName | Until operator offboarding |
| Operator phone | Operator.contactPhone | Until operator offboarding |
| KYB documents | S3 bucket | Retained per business license regulations; deleted N years after operator leaves |

### 19.4 Audit Trail

Every privileged action (admin approvals, financial operations, account suspensions) is recorded in an append-only audit log:

```
AuditLog {
  id, actorId, actorType (admin|system), action, targetType, targetId,
  details (JSON), ipAddress, createdAt
}
```

- **Append-only at DB level**: The application role cannot UPDATE or DELETE audit log rows (enforced by PostgreSQL permissions or a trigger).
- **Exportable**: Admin can export the audit log for external review.

### 19.5 Consent Capture

Consent is captured at specific moments and stored:
- **No-refund policy**: Checkbox at checkout ("I understand this ticket is non-refundable for customer-initiated cancellations")
- **PII storage**: Checkbox at checkout ("I consent to my booking information being stored for ticket delivery and service purposes")
- **Marketing** (if added later): Separate opt-in, never bundled with the service consent

> **Business licensing**: For VSIC code registration, TMĐT (e-commerce platform) registration with Bộ Công Thương, and NHNN payment intermediary licensing guidance, see `docs/business-license-expansion-vn.md`.
