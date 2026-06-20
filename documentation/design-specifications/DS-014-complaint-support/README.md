# DS-014 -- Complaint & Support API Design

## 1. Overview

This document defines the customer complaint handling system for the BusBooking platform — a multi-tenant Vietnam bus booking marketplace that must comply with the Consumer Protection Law 2023 (Law 19/2023). The law mandates that e-commerce platforms provide accessible complaint submission channels, acknowledge complaints within 3 business days, and resolve or escalate within 7-30 days. The complaint system is both a regulatory requirement and a critical customer retention mechanism; its design determines regulatory compliance, operator accountability, and customer trust.

**Source ADRs.** This document synthesizes decisions from ADR-010 (Booking Lifecycle), ADR-013 (Notification Architecture), ADR-015 (Error Contract). Business context from regulatory/consumer-protection.md, personas/customer-personas.md, domain-model/event-flows.md.

**Cross-references.** 01-data-model-design for `Complaint` entity schema and `Booking`/`Customer` relationships. 03-api-contract for route namespace table and auth middleware chain. 06-background-jobs for `complaintSlaMon` cron job and SLA deadline enforcement.

---

## 2. Regulatory Requirements (Law 19/2023)

### 2.1 Compliance Obligations

| Requirement | SLA | Detail | Penalty for Non-Compliance |
|---|---|---|---|
| Complaint submission channel | Available at all times | Platform must provide accessible complaint mechanism (online form, email, phone, or chat) | Administrative fine; potential platform suspension |
| Written acknowledgement | 3 business days | Written confirmation to complainant that complaint has been received and registered | Administrative fine |
| Resolution (simple cases) | 7 days | Cases with clear facts, no dispute over evidence | Administrative fine |
| Resolution (complex cases) | 30 days | Cases requiring investigation, evidence gathering, or third-party input | Administrative fine |
| Escalation | If unresolved after 30 days | Consumer can escalate to local consumer protection authority (VCCA or provincial DIT) | Regulatory investigation |
| Record keeping | 5 years | Complaint records retained for regulatory audit (aligns with T3 Financial retention tier) | Administrative fine |
| Transparency | Ongoing | Platform must publish complaint handling policy and process | Administrative fine |

### 2.2 Business Day Calculation

Business days exclude:
- Saturdays and Sundays
- Vietnamese public holidays (per Government Decree)

| Holiday | Typical Dates | Duration |
|---------|---------------|----------|
| New Year | January 1 | 1 day |
| Tet (Lunar New Year) | Late Jan / Feb (varies) | 5 days (may extend to 7-9 with weekends) |
| Hung Kings' Commemoration | 10th day of 3rd lunar month | 1 day |
| Liberation Day | April 30 | 1 day |
| International Labour Day | May 1 | 1 day |
| National Day | September 2 | 2 days (Sep 1-2 or Sep 2-3, per Government) |

**Known gap:** Business day calculation for Vietnamese public holidays requires a holiday calendar data source. Tet dates vary yearly (lunar calendar). A static holiday table with annual admin refresh is the minimum viable approach.

**Source:** regulatory/consumer-protection.md, Law 19/2023 (Consumer Protection Law).

---

## 3. Complaint State Machine

### 3.1 State Diagram

```
                          +---> investigating --+--> resolved
                          |                     |
submitted ---> acknowledged                     +--> escalated ---> resolved
```

### 3.2 Transition Table

| # | From | To | Trigger | Actor | SLA Impact |
|---|------|----|---------|-------|------------|
| C1 | `submitted` | `acknowledged` | Admin acknowledges or system auto-acknowledges at SLA deadline | Admin / System | Starts resolve clock |
| C2 | `acknowledged` | `investigating` | Admin assigns complaint for investigation | Admin | None |
| C3 | `investigating` | `resolved` | Admin closes with resolution text | Admin | SLA met if within 7/30 days |
| C4 | `investigating` | `escalated` | SLA breach (auto-escalate via cron) or customer requests escalation | System / Customer | SLA breached |
| C5 | `escalated` | `resolved` | Resolution reached after escalation (possibly with external authority involvement) | Admin | Post-breach resolution |

### 3.3 Legal Transition Constants

```typescript
const LEGAL_COMPLAINT_TRANSITIONS: Record<ComplaintStatus, ComplaintStatus[]> = {
  submitted:     ['acknowledged'],
  acknowledged:  ['investigating'],
  investigating: ['resolved', 'escalated'],
  escalated:     ['resolved'],
  resolved:      [],  // terminal
}
```

The transition guard follows the same pattern as booking state transitions (ADR-019 D2): `UPDATE ... WHERE status IN legalPredecessors(targetStatus)`. A second acknowledge on an already-acknowledged complaint matches zero rows -- idempotent no-op.

### 3.4 SLA Deadlines

| Deadline | Computed From | Value |
|----------|---------------|-------|
| `acknowledgeDeadline` | `createdAt + 3 business days` | Set at complaint creation |
| `resolveDeadline` (simple) | `acknowledgedAt + 7 calendar days` | Set when complaint is acknowledged with `priority = 'low'` or `'medium'` |
| `resolveDeadline` (complex) | `acknowledgedAt + 30 calendar days` | Set when complaint is acknowledged with `priority = 'high'` or `'urgent'` |

**Source:** ADR-010 (Booking Lifecycle state machine patterns), ADR-019 D2.

---

## 4. Data Model

### 4.1 Complaint Entity

```prisma
model Complaint {
  id                   String            @id @default(cuid())
  refCode              String            @unique  // human-readable reference (e.g., "CPL-2026-0001")
  customerId           String?                    // FK to Customer (null for guest complaints)
  customerPhone        String                     // contact phone (required for all complaints)
  customerEmail        String?                    // optional email for follow-up
  bookingId            String?                    // FK to Booking (optional -- not all complaints are booking-related)
  operatorId           String?                    // FK to Operator (derived from booking, or specified directly)
  category             ComplaintCategory
  subject              String                     // short description (max 200 chars)
  description          String                     // full complaint text
  status               ComplaintStatus
  priority             ComplaintPriority           // determines resolve deadline (7 vs 30 days)
  assignedTo           String?                    // admin user ID handling the complaint
  acknowledgedAt       DateTime?
  acknowledgeDeadline  DateTime                   // createdAt + 3 business days
  resolveDeadline      DateTime?                  // set at acknowledgement (7 or 30 days based on priority)
  resolvedAt           DateTime?
  resolution           String?                    // resolution description (required when resolved)
  escalatedAt          DateTime?
  createdAt            DateTime          @default(now())
  updatedAt            DateTime          @updatedAt

  @@index([status, acknowledgeDeadline])
  @@index([status, resolveDeadline])
  @@index([operatorId, status])
  @@index([customerId])
}
```

### 4.2 Enums

```prisma
enum ComplaintCategory {
  booking_issue        // booking creation, modification, cancellation problems
  payment_issue        // payment processing, double charge, failed payment
  refund_issue         // refund not received, partial refund, refund delay
  service_quality      // bus quality, cleanliness, amenities not as described
  operator_conduct     // driver behavior, departure delays, route deviations
  safety_concern       // safety violations, accidents, dangerous driving
  other                // catch-all
}

enum ComplaintStatus {
  submitted            // initial state -- awaiting acknowledgement
  acknowledged         // platform has acknowledged receipt
  investigating        // assigned to admin, under investigation
  resolved             // closed with resolution
  escalated            // SLA breached or customer requested escalation
}

enum ComplaintPriority {
  low                  // minor inconvenience; 7-day resolve deadline
  medium               // moderate impact; 7-day resolve deadline
  high                 // significant impact; 30-day resolve deadline
  urgent               // safety concern or regulatory exposure; 30-day resolve deadline
}
```

### 4.3 Priority-to-Deadline Mapping

| Priority | Resolve Deadline | Auto-Assignment |
|----------|-----------------|-----------------|
| `low` | `acknowledgedAt + 7 days` | None (admin assigns) |
| `medium` | `acknowledgedAt + 7 days` | None (admin assigns) |
| `high` | `acknowledgedAt + 30 days` | Auto-assign to senior admin |
| `urgent` | `acknowledgedAt + 30 days` | Auto-assign to senior admin + immediate notification |

**Auto-classification:** Complaints with `category = 'safety_concern'` are automatically escalated to `priority = 'urgent'` regardless of customer selection. Complaints with `category = 'refund_issue'` default to `priority = 'high'`.

**Source:** 01-data-model-design (entity design patterns), Law 19/2023.

---

## 5. Complaint Response Log

### 5.1 ComplaintResponse Entity

```prisma
model ComplaintResponse {
  id           String   @id @default(cuid())
  complaintId  String                     // FK to Complaint
  authorType   String                     // 'admin', 'operator', 'customer', 'system'
  authorId     String?                    // user ID (null for system-generated)
  message      String                     // response text
  internal     Boolean  @default(false)   // internal notes not visible to customer
  createdAt    DateTime @default(now())

  @@index([complaintId, createdAt])
}
```

### 5.2 Response Visibility Rules

| `authorType` | `internal = false` | `internal = true` |
|-------------|-------------------|-------------------|
| `admin` | Visible to customer, operator, admin | Visible to admin only |
| `operator` | Visible to customer, admin | Visible to admin only |
| `customer` | Visible to operator, admin | N/A (customer responses are always visible) |
| `system` | Visible to customer, operator, admin | Visible to admin only |

System-generated responses include:
- Auto-acknowledgement at SLA deadline ("Your complaint has been automatically acknowledged. An admin will review it shortly.")
- Auto-escalation at resolve deadline ("Your complaint has been escalated for priority review.")
- Status change notifications ("Your complaint has been assigned to a support representative.")

---

## 6. API Endpoints -- Customer

### 6.1 Submit Complaint

```
POST /api/complaints
Auth: Customer JWT (logged-in) or guest (phone verification required)
```

**Request body:**

```json
{
  "bookingId": "clxyz...",
  "category": "payment_issue",
  "subject": "Payment charged but no ticket received",
  "description": "I paid via VietQR on June 15 at 2:30 PM but my booking still shows awaiting_payment. The money was deducted from my account.",
  "customerPhone": "+84901234567",
  "customerEmail": "customer@example.com"
}
```

| Field | Required | Validation |
|-------|----------|------------|
| `bookingId` | No | Must be a valid booking ID; if provided, `operatorId` is derived from booking |
| `category` | Yes | Must be a valid `ComplaintCategory` enum value |
| `subject` | Yes | Max 200 characters |
| `description` | Yes | Max 5000 characters |
| `customerPhone` | Yes (guests); optional for logged-in (defaults to profile phone) | Vietnamese phone format |
| `customerEmail` | No | Valid email format |

**Response (HTTP 201):**

```json
{
  "complaint": {
    "id": "clxyz...",
    "refCode": "CPL-2026-0042",
    "status": "submitted",
    "category": "payment_issue",
    "subject": "Payment charged but no ticket received",
    "acknowledgeDeadline": "2026-06-20T17:00:00+07:00",
    "createdAt": "2026-06-17T10:30:00+07:00"
  }
}
```

**Side effects:**
- `acknowledgeDeadline` computed as `createdAt + 3 business days` (Vietnam business calendar)
- `NotificationLog` row enqueued: template `complaint_received`, recipient = `customerPhone`
- `ComplaintResponse` row created: authorType `system`, message "Your complaint has been received. Reference: CPL-2026-0042. We will acknowledge within 3 business days."
- If `category = 'safety_concern'`: priority auto-set to `urgent`, admin notification enqueued immediately

### 6.2 View Own Complaint

```
GET /api/complaints/{id}
Auth: Customer JWT (customerId must match) or phone verification
```

Returns complaint details plus non-internal responses. Internal admin/operator notes are excluded.

### 6.3 List Own Complaints

```
GET /api/customers/me/complaints?status=submitted,acknowledged&page=1
Auth: Customer JWT
```

Returns paginated list of customer's own complaints, ordered by `createdAt DESC`.

**Source:** 03-api-contract (customer route patterns), ADR-015 D1 (error contract).

---

## 7. API Endpoints -- Operator

### 7.1 List Operator Complaints

```
GET /api/op/complaints?status=investigating&page=1
Auth: Operator JWT (tenant-scoped via operatorId from token)
```

Returns complaints where `operatorId` matches the operator's JWT claim. Operator can only see complaints related to their own bookings/services.

### 7.2 View Complaint Detail

```
GET /api/op/complaints/{id}
Auth: Operator JWT (operatorId must match complaint.operatorId)
```

Returns complaint details plus non-internal responses. Internal admin notes are excluded.

### 7.3 Operator Response

```
POST /api/op/complaints/{id}/respond
Auth: Operator JWT (operatorId must match)
```

**Request body:**

```json
{
  "message": "We apologize for the delay. The bus departed 15 minutes late due to traffic congestion on QL1A. We will improve our scheduling.",
  "internal": false
}
```

| Field | Required | Validation |
|-------|----------|------------|
| `message` | Yes | Max 5000 characters |
| `internal` | No | Default `false`; if `true`, note visible only to admin (operator's private note to admin) |

**Side effects:**
- `ComplaintResponse` row created: authorType `operator`, authorId = operator user ID
- If `internal = false`: `NotificationLog` row enqueued to customer (email if available, SMS if not)

**Source:** 03-api-contract (operator route patterns), ADR-004 D12 (tenant scoping).

---

## 8. API Endpoints -- Admin

### 8.1 Endpoint Table

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/api/admin/complaints` | List all complaints with filters |
| `GET` | `/api/admin/complaints/{id}` | Full detail with all responses (including internal) |
| `PATCH` | `/api/admin/complaints/{id}/acknowledge` | Transition: submitted -> acknowledged |
| `PATCH` | `/api/admin/complaints/{id}/assign` | Assign to admin user |
| `PATCH` | `/api/admin/complaints/{id}/investigate` | Transition: acknowledged -> investigating |
| `PATCH` | `/api/admin/complaints/{id}/resolve` | Transition: investigating/escalated -> resolved |
| `PATCH` | `/api/admin/complaints/{id}/escalate` | Transition: investigating -> escalated |
| `POST` | `/api/admin/complaints/{id}/respond` | Add response (internal or external) |

All admin endpoints require Admin JWT + TOTP authentication.

### 8.2 List Complaints (with Filters)

```
GET /api/admin/complaints?status=submitted&priority=urgent&operatorId=clxyz&from=2026-06-01&to=2026-06-15&page=1
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string (comma-separated) | Filter by `ComplaintStatus` |
| `priority` | string (comma-separated) | Filter by `ComplaintPriority` |
| `operatorId` | string | Filter by operator |
| `category` | string | Filter by `ComplaintCategory` |
| `assignedTo` | string | Filter by assigned admin |
| `slaBreached` | boolean | If `true`, only complaints past their deadline |
| `from` / `to` | ISO date | Creation date range |
| `page` | integer | Pagination offset |

### 8.3 Acknowledge

```
PATCH /api/admin/complaints/{id}/acknowledge
```

**Request body:**

```json
{
  "priority": "high",
  "message": "We have received your complaint and will investigate. Your case has been classified as high priority."
}
```

**Side effects:**
- Transition: `submitted -> acknowledged`
- Set `acknowledgedAt = NOW()`
- Set `resolveDeadline` based on priority (7 or 30 days from `acknowledgedAt`)
- `ComplaintResponse` row: authorType `admin`, message from body
- `NotificationLog`: SMS/email to customer confirming acknowledgement with `refCode`

### 8.4 Resolve

```
PATCH /api/admin/complaints/{id}/resolve
```

**Request body:**

```json
{
  "resolution": "We have confirmed your VietQR payment of 350,000 VND and updated your booking to paid status. Your ticket has been issued. We apologize for the inconvenience caused by the reconciliation delay.",
  "message": "Your complaint has been resolved. Please check your booking status."
}
```

| Field | Required | Validation |
|-------|----------|------------|
| `resolution` | Yes | Max 5000 characters; stored on `Complaint.resolution` |
| `message` | No | Optional customer-facing response message |

**Side effects:**
- Transition: `investigating -> resolved` or `escalated -> resolved`
- Set `resolvedAt = NOW()`
- `ComplaintResponse` row: authorType `admin`, message from body (if provided)
- `NotificationLog`: SMS/email to customer with resolution text

### 8.5 Escalate

```
PATCH /api/admin/complaints/{id}/escalate
```

**Request body:**

```json
{
  "reason": "Unable to resolve within 30-day deadline. Customer requests escalation to consumer protection authority.",
  "internal": true
}
```

**Side effects:**
- Transition: `investigating -> escalated`
- Set `escalatedAt = NOW()`
- `ComplaintResponse` row: authorType `admin` or `system`, internal = per body
- `NotificationLog`: SMS to customer informing of escalation + contact info for VCCA/provincial DIT
- Admin alert: escalation triggers notification to senior admin/management

**Source:** 03-api-contract (admin route patterns), ADR-015 D1 (error contract).

---

## 9. Cron: `complaintSlaMon` (Hourly)

### 9.1 Sweep Logic

The `complaintSlaMon` cron runs hourly and detects approaching and breached SLA deadlines.

```
complaintSlaMon cron (every 1 hour)
  |
  +-- Query 1: Approaching acknowledge deadline (warning)
  |   WHERE status = 'submitted'
  |     AND acknowledgeDeadline < NOW() + interval '4 hours'
  |     AND acknowledgeDeadline >= NOW()
  |   Action: alert admin ("Acknowledge deadline approaching for CPL-2026-0042")
  |
  +-- Query 2: Breached acknowledge deadline (auto-acknowledge)
  |   WHERE status = 'submitted'
  |     AND acknowledgeDeadline < NOW()
  |   Action:
  |     - Auto-transition: submitted -> acknowledged
  |     - Set acknowledgedAt = NOW()
  |     - Set resolveDeadline = NOW() + 30 days (conservative, since priority may not be set)
  |     - Create ComplaintResponse: authorType='system', message='Auto-acknowledged due to SLA deadline'
  |     - Notify customer: "Your complaint has been acknowledged. Reference: CPL-2026-0042"
  |     - Alert admin: "Complaint CPL-2026-0042 auto-acknowledged (3-day SLA breached)"
  |
  +-- Query 3: Approaching resolve deadline (warning)
  |   WHERE status IN ('acknowledged', 'investigating')
  |     AND resolveDeadline < NOW() + interval '1 day'
  |     AND resolveDeadline >= NOW()
  |   Action: alert admin ("Resolve deadline approaching for CPL-2026-0042")
  |
  +-- Query 4: Breached resolve deadline (auto-escalate)
      WHERE status IN ('acknowledged', 'investigating')
        AND resolveDeadline < NOW()
      Action:
        - Auto-transition: acknowledged/investigating -> escalated
        - Set escalatedAt = NOW()
        - Create ComplaintResponse: authorType='system', message='Auto-escalated due to resolve deadline breach'
        - Notify customer: "Your complaint has been escalated for priority review"
        - Alert admin: "Complaint CPL-2026-0042 auto-escalated (resolve SLA breached)"
```

### 9.2 Cron Configuration

| Property | Value |
|----------|-------|
| Route | `/api/cron/complaint-sla-monitor` |
| Schedule | Every 1 hour |
| Auth | `CRON_SECRET` bearer token |
| Batch | `FOR UPDATE SKIP LOCKED`, 500 per batch |

### 9.3 Response Contract

```json
{
  "job": "complaintSlaMon",
  "status": "ok",
  "acknowledgeWarnings": 2,
  "acknowledgeBreaches": 0,
  "resolveWarnings": 1,
  "resolveBreaches": 0,
  "autoAcknowledged": 0,
  "autoEscalated": 0,
  "durationMs": 850
}
```

### 9.4 Index Usage

| Query | Index Used |
|-------|-----------|
| Submitted + acknowledge deadline | `@@index([status, acknowledgeDeadline])` |
| Acknowledged/investigating + resolve deadline | `@@index([status, resolveDeadline])` |

**Source:** 06-background-jobs SS4.1 (job catalog), 06-background-jobs SS15, ADR-012 D3.

---

## 10. Notification Integration

### 10.1 Notification Templates

| Template | Channel | Trigger | Content |
|----------|---------|---------|---------|
| `complaint_received` | SMS | Complaint submitted | "Your complaint (ref: CPL-2026-NNNN) has been received. We will respond within 3 business days." |
| `complaint_acknowledged` | SMS + email | Admin acknowledges | "Your complaint (ref: CPL-2026-NNNN) has been acknowledged and assigned for review." |
| `complaint_response` | Email (primary) / SMS (fallback) | Admin or operator responds (non-internal) | "New response to your complaint CPL-2026-NNNN. [message excerpt]" |
| `complaint_resolved` | SMS + email | Admin resolves | "Your complaint (ref: CPL-2026-NNNN) has been resolved. Resolution: [resolution text]" |
| `complaint_escalated` | SMS | Auto-escalation or customer-requested | "Your complaint (ref: CPL-2026-NNNN) has been escalated for priority review." |
| `complaint_sla_warning` | In-app (admin) | SLA deadline approaching | Internal admin alert |
| `complaint_sla_breach` | In-app + email (admin) | SLA deadline breached | Internal admin alert with breach details |

### 10.2 Notification Flow

All notifications follow the cron-only outbox pattern (06-background-jobs SS8.1):
1. Complaint endpoint creates `NotificationLog` row with `status = 'pending'`
2. `after()` attempts best-effort immediate dispatch
3. `notificationDispatch` cron (1-minute) catches any `pending` rows that `after()` missed

### 10.3 I9 Invariant Compliance

`NotificationLog.recipient` carries the phone number. The complaint `description` and `resolution` text in `NotificationLog.payload` must **not** contain phone numbers or email addresses. If the customer includes PII in their complaint text, it flows through the payload -- this is intentional (it is the customer's own submission), but admin responses must not echo customer PII back into notification payloads.

**Source:** ADR-013 D4, ADR-013 D7, 06-background-jobs SS8.

---

## 11. Minimum Viable Support Channel (Stage 0)

### 11.1 Pre-System Compliance

Before the full complaint API is built, Law 19/2023 compliance requires at minimum:

| Channel | Implementation | Regulatory Coverage |
|---------|---------------|-------------------|
| **Zalo OA** | Link to platform's or operator's Zalo Official Account in booking confirmation SMS + footer of all pages | Real-time chat support; Vietnamese customers expect Zalo as primary support channel |
| **Email** | `mailto:support@busbooking.vn` with pre-filled subject including `bookingRef` | Written complaint channel; creates audit trail |
| **Phone** | Hotline number displayed on booking confirmation and footer | Voice support (may be outsourced) |

### 11.2 Pre-Filled Email Link

```
mailto:support@busbooking.vn?subject=Complaint%20-%20Booking%20BB-2026-a1b2-c3d4&body=Booking%20ref%3A%20BB-2026-a1b2-c3d4%0A%0APlease%20describe%20your%20issue%3A%0A
```

The booking confirmation page and SMS include a deep link to this pre-filled email, ensuring the bookingRef is captured even when using the Stage 0 manual channel.

### 11.3 Stage 0 to Stage 1 Migration

| Stage 0 (Manual) | Stage 1 (API) | Migration Path |
|-------------------|---------------|----------------|
| Zalo OA chat | `POST /api/complaints` + web form | Add web form; Zalo OA remains as supplementary channel |
| Email to shared inbox | `POST /api/complaints` + email ingestion | Future: parse inbound emails to auto-create Complaint rows |
| Phone hotline | `POST /api/complaints` (agent creates on behalf of caller) | Admin creates complaint via dashboard during phone call |

**Source:** regulatory/consumer-protection.md.

---

## 12. Operator Accountability

### 12.1 Operator Complaint Metrics

Complaints feed into operator accountability metrics:

| Metric | Computation | Threshold | Action |
|--------|-------------|-----------|--------|
| Complaint rate | Complaints / bookings per trailing 30 days | > 5% | Admin warning to operator |
| Safety complaint count | `category = 'safety_concern'` per trailing 90 days | > 0 | Immediate admin review |
| Resolution satisfaction | Post-resolution survey score (if implemented) | < 3.0/5.0 | Operator review |
| SLA breach rate | Complaints where platform breached SLA / total complaints | > 10% | Internal process review |

### 12.2 Operator Visibility

Operators see:
- Complaints related to their bookings (filtered by `operatorId`)
- Non-internal responses from admin and customer
- Ability to respond to complaints (operator perspective/explanation)

Operators do **not** see:
- Complaints for other operators (tenant isolation via `operatorId` from JWT)
- Internal admin notes (`internal = true` responses)
- Admin assignment or priority information

### 12.3 Complaint-to-Booking Linkage

When a complaint references a `bookingId`:
- The complaint detail page shows booking details (route, departure, payment status, operator)
- `operatorId` is automatically derived from the booking's trip's route's operator
- Admin can view the full booking history alongside the complaint

**Source:** ADR-004 D12 (tenant scoping), personas/operator-personas.md.

---

## 13. Data Retention

### 13.1 Retention Policy

| Data | Retention | Tier | Rationale |
|------|-----------|------|-----------|
| `Complaint` rows | 5 years | T3 Financial | Law 19/2023 record-keeping requirement |
| `ComplaintResponse` rows | 5 years | T3 Financial | Part of complaint record |
| Customer PII in complaint text | 5 years, then anonymized | T3 Financial + PDPL 2025 | PII anonymization after retention period via `piiAnonymization` cron |

### 13.2 Anonymization

After 5-year retention, the `piiAnonymization` cron (06-background-jobs SS14.2) anonymizes:
- `Complaint.customerPhone` -> `REDACTED`
- `Complaint.customerEmail` -> `REDACTED`
- `Complaint.description` -> retained (may contain PII in free text; full anonymization would destroy complaint content)
- `ComplaintResponse.message` -> retained (same reasoning)

The complaint `refCode`, `category`, `status`, `resolution`, and timestamps are retained indefinitely for aggregate analytics and regulatory audit.

**Source:** ADR-007 D7, regulatory/data-privacy.md, PDPL 2025.

---

## 14. Error Contract

### 14.1 Complaint API Error Codes

| Code | HTTP Status | Condition |
|------|-------------|-----------|
| `complaint_not_found` | 404 | Complaint ID does not exist |
| `complaint_not_owned` | 403 | Customer attempting to view another customer's complaint |
| `invalid_transition` | 422 | State transition not allowed (e.g., resolving a `submitted` complaint) |
| `booking_not_found` | 422 | Referenced `bookingId` does not exist |
| `missing_resolution` | 422 | Attempting to resolve without providing `resolution` text |
| `subject_too_long` | 422 | Subject exceeds 200 characters |
| `description_too_long` | 422 | Description exceeds 5000 characters |
| `operator_not_authorized` | 403 | Operator attempting to access complaint for another operator's booking |

Error envelope follows the standard platform format (ADR-015 D1):

```json
{
  "error": {
    "code": "invalid_transition",
    "message": "Cannot resolve a complaint in 'submitted' status. Acknowledge first."
  }
}
```

**Source:** ADR-015 D1 (error contract).

---

## 15. Known Gaps

| Gap | Category | Risk | Required Before |
|-----|----------|------|----------------|
| Business day calculation for Vietnamese public holidays (Tet dates vary yearly) | Feature | HIGH -- incorrect SLA deadlines if holidays not accounted for | Go-live |
| File/image attachment for complaint evidence | Feature | MEDIUM -- customers cannot attach photos of bus condition, payment receipts, etc. (requires file storage integration) | Post-launch |
| Complaint analytics dashboard (volume by category, resolution time, SLA compliance rate) | Feature | MEDIUM -- no visibility into complaint trends | Post-launch |
| Integration with external dispute resolution (VCCA/provincial DIT case handoff) | Feature | LOW -- manual process acceptable initially | Post-launch |
| Customer satisfaction survey after resolution | Feature | LOW -- no feedback loop on resolution quality | Post-launch |
| Complaint-to-refund flow (auto-create refund from complaint resolution) | Feature | MEDIUM -- admin must manually create refund separately (depends on 07-refund-flow) | Post-launch |
| Email ingestion (auto-create Complaint from inbound email to support address) | Feature | LOW -- Stage 0 manual email channel functional | Post-launch |
| Complaint deduplication (customer submits same complaint multiple times) | Feature | LOW -- admin manually closes duplicates | Post-launch |
| Operator complaint response notification to admin | Feature | LOW -- admin must poll for operator responses | Post-launch |
| `refCode` sequence generation (thread-safe, gap-free, per-year reset) | Feature | MEDIUM -- sequential reference codes require atomic counter | Go-live |
| Zalo OA integration for real-time complaint chat | Feature | LOW -- Zalo OA link is Stage 0; structured integration is future work | Post-launch |
| Multi-language support for complaint submissions (Vietnamese + English) | Feature | LOW -- Vietnamese-only acceptable at launch | Post-launch |

---

## 16. Decision Log

| # | Decision | Date | Rationale |
|---|----------|------|-----------|
| S1 | State machine with 5 states (submitted/acknowledged/investigating/resolved/escalated) over simpler open/closed | 2026-06-19 | Law 19/2023 requires distinct acknowledge and resolve SLAs; state machine must track both deadlines independently |
| S2 | Auto-acknowledge at SLA deadline over hard enforcement | 2026-06-19 | Better to auto-acknowledge (system response) than to breach SLA with no acknowledgement at all; admin still alerted |
| S3 | Auto-escalate at resolve deadline over manual escalation only | 2026-06-19 | Law 19/2023 gives consumer right to escalate after 30 days; platform must proactively escalate to demonstrate good faith |
| S4 | Separate `ComplaintResponse` model over embedded responses in Complaint | 2026-06-19 | Response log grows independently; internal/external visibility requires per-response filtering; audit trail requires immutable response records |
| S5 | Guest complaints allowed (phone required, no account needed) | 2026-06-19 | Law 19/2023 mandates accessible complaint channel; requiring account creation is a barrier. Phone enables SMS notification |
| S6 | Priority determines resolve deadline (7 vs 30 days) over uniform 30-day | 2026-06-19 | Law 19/2023 distinguishes simple (7-day) from complex (30-day) cases; priority classification maps to this distinction |
| S7 | Stage 0 (Zalo OA + email + phone) satisfies minimum Law 19/2023 requirements | 2026-06-19 | Full complaint API is not a go-live blocker if manual channels are available; regulatory requirement is "accessible complaint mechanism", not "automated complaint API" |
| S8 | Hourly SLA monitoring cron over real-time deadline triggers | 2026-06-19 | SLA deadlines are measured in business days (3-30 days); hourly granularity is sufficient. Real-time triggers add complexity without regulatory benefit |
| S9 | 5-year complaint retention aligned with T3 Financial tier | 2026-06-19 | Law 19/2023 requires complaint record keeping for regulatory audit; 5 years matches booking/financial retention |
| S10 | Operator sees complaints for own bookings only (tenant-scoped) | 2026-06-19 | Multi-tenancy isolation; operator sees feedback about their service but not competitors' complaint patterns |
