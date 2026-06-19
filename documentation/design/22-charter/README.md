> ← [Previous](../21-feature-flags/) | [Index](../README.md) | [Next →](../23-deployment/)

## 22. Charter / Contract Rental Subsystem

### 22.1 What It Is

In addition to fixed-route scheduled trips (the main product), customers can request a **charter** — a private vehicle for a custom itinerary (tourism, group travel, business trips). This is a separate marketplace:

- **Fixed trips**: Known route, known time, known price, buy instantly
- **Charter**: Custom route, custom time, negotiated price, matched by admin

### 22.2 The Flow

```
Customer submits request (form: pickup, destination(s), dates, passengers, budget)
  │
  ▼
Admin reviews in Charter Dispatch queue
  │
  ├─ Option A: ASSIGN DIRECTLY to a specific operator
  │             Operator has 24h to accept/decline
  │             Decline → back to admin
  │
  ├─ Option B: PUBLISH to public pool (all approved operators see it)
  │             First operator to claim wins (atomic — no double-assignment)
  │             48h expiry → back to admin
  │
  └─ Option C: REJECT (spam/invalid)
```

### 22.3 First-Accept-Wins — Atomic Claim

When a charter request is published to the public pool, multiple operators might try to claim it simultaneously. The database handles this atomically:

```sql
UPDATE "CharterRequest"
SET status = 'ACCEPTED', "assigneeOperatorId" = 'op123'
WHERE id = 'charter456'
  AND status = 'PUBLISHED'
  AND "assigneeOperatorId" IS NULL;
-- If 1 row affected: you won the claim
-- If 0 rows affected: someone else claimed it first → 409 Already Claimed
```

### 22.4 Lead-Gen Payment Model

Charter pricing is bespoke — unlike fixed trips where the price is set by the operator and paid online. For charters:
1. Customer states a budget in the request
2. Operator accepts and contacts the customer directly
3. Price is negotiated off-platform (phone/chat)
4. Payment happens directly between customer and operator (outside our system)
5. Platform optionally invoices the operator a referral fee later

This is the **lead-generation** model — the platform connects supply and demand, not the payment rail.
