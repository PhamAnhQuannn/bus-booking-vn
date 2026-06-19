> ← [Previous](../14-ticketing/) | [Index](../README.md) | [Next →](../16-background-jobs/)

## 15. Notification System

### 15.1 The Outbox Pattern

**What it is**: Instead of sending an SMS/email immediately (which can fail and block the current operation), we write a "send this notification" record to a database table (`NotificationLog`). A separate background worker reads the table and does the actual sending.

```
Payment webhook → [Create Booking] → [Insert NotificationLog row] → Return 200 OK
                                              │
                                     (later, every 30s)
                                              │
                               Cron worker → Read pending notifications → Send via SMS/email
                                              │
                                     Update NotificationLog: status = sent / failed
```

**Why?**
- The payment webhook is never blocked by a slow/failed SMS provider
- Failed sends are retried automatically by the next cron run
- Every send attempt is logged (for debugging "customer says they didn't get the SMS")

### 15.2 Decoupled from Booking State

A critical design rule: **notification failure must NEVER affect booking state**. The booking is `paid` because the payment webhook confirmed it. If the SMS fails to send, the booking is still paid — the customer can retrieve their ticket via the booking reference.

If notification status were folded into booking state (e.g., `paid_and_notified`), an SMS outage would make bookings appear "not fully processed" — a false alarm that could trigger incorrect refunds or re-processing.

### 15.3 Channels and Templates

| Template | Channel | Trigger |
|----------|---------|---------|
| `booking_confirmed` | SMS + email (PDF attached) | Payment confirmed |
| `otp_code` | SMS | Customer requests OTP |
| `operator_credentials` | Email | Admin creates operator account |
| `trip_cancelled_refund` | SMS + email | Operator cancels trip with paid bookings |
| `bus_reassigned` | SMS | Bus changed on a trip with paid bookings |
| `charter_matched` | SMS + email | Charter request matched to an operator |
| `payout_scheduled` | Email | Payout queued for processing |

### 15.4 Scheduled Notifications — The scheduledFor Column

Some notifications are scheduled for the future (e.g., payout T+1 sweep). The cron worker queries:

```sql
SELECT * FROM "NotificationLog"
WHERE template = 'payout_scheduled'
  AND "scheduledFor" <= NOW()
  AND status = 'pending';
```

**Critical rule**: `scheduledFor` is a **top-level indexed column** on the table, with a composite index `@@index([template, scheduledFor])`. It is NEVER stored inside a JSON payload column — querying inside JSON requires parsing every row (no index help), which becomes a full table scan as the table grows.

### 15.5 Stub Provider Day-1

Real SMS (via eSMS) and email delivery is deferred to go-live. Day-1, the notification system writes to `NotificationLog` and logs the "send" — but the actual HTTP call to the SMS/email provider is a no-op stub. This lets the entire booking→notification pipeline work end-to-end in development without real SMS costs or provider credentials.

A feature flag (`NOTIFY_STUB`) controls this. Flip to `false` when real credentials are configured.
