> ← [Previous](../13-booking/) | [Index](../README.md) | [Next →](../15-notifications/)

## 14. Ticketing (QR / PDF)

### 14.1 Async PDF Generation

**The problem**: Generating a PDF is CPU-intensive (layout, fonts, rendering). Doing it inside the payment webhook handler would slow the response and risk a timeout — the PSP might not get a 200 OK, retries the webhook, and we process the payment twice.

**The solution**: The payment webhook handler does the critical work (booking + ledger) and returns 200 OK fast. PDF generation is enqueued as a background job:

```
Webhook received → [Create Booking + Ledger] → Return 200 OK → [Enqueue PDF job]
                   ^^^^^^^^^^^^^^^^^^^^^^^^                      ^^^^^^^^^^^^^^^^^
                   Synchronous (< 500ms)                         Asynchronous (takes 2-5s)
```

### 14.2 S3 — Simple Storage Service

**What it is**: S3 (originally Amazon's Simple Storage Service, but now a generic term) is cloud object storage — a service that stores files (objects) in buckets (containers). Think of it as a limitless hard drive in the cloud.

**Why S3 for tickets?**
- Scales infinitely (no "disk full" scenario)
- Durable (99.999999999% — "eleven nines" — data loss is essentially impossible)
- Supports **signed URLs** — temporary links that grant access for a limited time

**Signed URLs**: Instead of proxying the PDF through our server (server downloads from S3, then sends to client — slow and wasteful), we generate a temporary URL that lets the client download directly from S3:

```
Client → Server: "I need my ticket PDF"
Server → Client: "Here's a signed URL (valid for 1 hour): https://s3.../ticket-abc.pdf?signature=xyz&expires=..."
Client → S3: Downloads directly (server not involved)
```

### 14.3 QR Token — Signed Verification

The ticket QR code contains a signed token (like a mini-JWT) encoding the booking reference. When scanned:

1. QR reader opens a URL: `https://busbooking.vn/verify/BB-2026-a3x7-k9m2?token=eyJ...`
2. The public verify page looks up the booking in the database
3. Displays: booking ref, trip details, seats, PAID status, bus plate
4. No login required — anyone (operator, staff, customer) can verify

**The verify page is the source of truth** — it reads live data. The emailed PDF is a point-in-time snapshot that might go stale (e.g., if the bus is reassigned, the plate changes). That's why on bus reassignment, the PDF is regenerated and the customer is notified.

### 14.4 Check-in at Boarding

When the operator scans the QR at boarding:

```sql
UPDATE "Booking"
SET "checkedInAt" = NOW()
WHERE id = 'booking123'
  AND "checkedInAt" IS NULL;
-- Returns: 1 row affected = success (first scan)
-- Returns: 0 rows affected = already checked in (duplicate scan)
```

This is an **atomic conditional update** — if two staff members scan the same ticket at the exact same time, the database guarantees only one succeeds. The other gets "already checked in."
