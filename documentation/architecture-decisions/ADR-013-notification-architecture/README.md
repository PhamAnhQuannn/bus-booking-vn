# ADR-013: Notification Architecture

## Status
ACCEPTED

## Date
2026-06-17 (reviewed and confirmed)

## Context

Bus-Booking delivers transactional notifications to Vietnamese travelers and bus operators across a market where phone-based messaging dominates and email is tertiary. The notification architecture must satisfy Vietnam-specific regulatory, cost, and deliverability constraints while serving six distinct customer personas and five operator segments with fundamentally different channel preferences.

Key business constraints driving notification decisions (sourced from `documentation/business/`):

- **Phone-first population**: All 6 customer personas are phone-centric — "Chị Lan" (migrant worker) has no stable email, "Em Quan" (student) uses Zalo as primary channel, "Ba Hoa" (elderly) needs SMS with operator name and phone number. Email is explicitly rated low-importance for Vietnamese bus travelers. (personas/customer-personas.md)
- **Zalo dominance**: ~75M MAU in Vietnam; supports structured templates with buttons/links; 200–500 VND/msg vs SMS 300–800 VND/msg (50–70% savings). Industry pattern: Grab, Be, Tiki, Shopee VN all use ZNS primary with SMS fallback. (regulatory/telecom-sms.md)
- **SMS delivery gap**: Foreign providers (Twilio, AWS SNS) achieve only 60–80% delivery to Vietnam vs local providers (eSMS, Stringee, VNPT-IT, FPT SMS) at 95–99%. Brandname SMS registration is a 2–4 week hard blocker per carrier requiring business cert, tax code, and template pre-approval. (regulatory/telecom-sms.md)
- **Notification cost in unit economics**: ~1,000 VND per booking (~2.5% of the 40,000 VND commission revenue on a 400K average ticket). Cost efficiency directly impacts net margin per booking (4.0% of ticket). (market-research/business-model.md)
- **No customer support channel (Risk #6)**: Rated CERTAIN likelihood, HIGH impact — "email on ticket + Contact Support link routing to Zalo OA must exist before go-live". Consumer Protection Law 2023 requires complaint acknowledge within 3 working days, resolve within 7–30 working days. (risk-matrix.md, regulatory/consumer-protection.md)
- **Booking confirmation content requirements**: E-Transactions Law 2023 mandates booking confirmations include departure details, price, operator info, and cancellation terms. Electronic messages have legal validity equal to paper. (regulatory/consumer-protection.md)
- **PII handling**: Invariant I9 prohibits raw phone numbers in NotificationLog payload — phone must be in `recipient` column only. PDPL 2025 requires per-instance consent for cross-border transfer; phone numbers sent to overseas processors constitute cross-border transfer requiring CDTIA compliance. (domain-model/invariants-catalog.md, regulatory/data-privacy.md)
- **Cron-only dispatch**: All domains produce NotificationLog rows; the dispatch cron is the sole delivery path — routes and webhooks only enqueue, never dispatch in-process. Notification failure must never affect booking state. (domain-model/bounded-contexts.md)
- **Operator channel preferences**: Micro operators (60–70% of market) use phone/Facebook/Zalo, no IT, need Zalo-friendly notifications. Large operators value brand control. (personas/operator-personas.md, competitor-benchmark/operator-sentiment.md)
- **Competitive position**: BB has SMS and email but only web push (partial) — VeXeRe and redBus have full app push and live tracking. SMS/Zalo booking confirmation is rated P1 (currently email-only). (competitor-benchmark/feature-parity-matrix.md, market-research/feature-benchmark.md)
- **Data privacy**: eSMS and Resend are third-party processors requiring DPAs under PDPL 2025. Decree 53/2022 requires Vietnamese PII stored on Vietnam servers. Foreign Contractor Tax (5% CIT + 5% VAT) withholding applies to payments to overseas providers like Resend. (regulatory/data-privacy.md, regulatory/einvoice-tax.md)

---

## Decisions

### 1. Notification Channel Strategy — ZNS Primary + SMS Fallback + Email Supplementary

| Option | Pros | Cons |
|--------|------|------|
| **ZNS primary + SMS fallback + email supplementary** | Optimal cost (50–70% savings on ZNS vs SMS-only); dual-channel resilience for Tet surge; email provides rich content (PDF ticket attachment, VAT invoice link); matches industry pattern (Grab, Be, Tiki, Shopee VN); reaches all 6 customer personas | Three channel integrations to build and maintain; Zalo OA registration required; SMS brandname registration still required for fallback; email low-priority for core Vietnamese users |
| SMS only | Universal reach; simplest single-channel integration; no app dependency | 300–800 VND/msg (most expensive at scale); brandname SMS registration 2–4 week blocker per carrier; plain text only (no buttons, links, or PDF attachments); no rich content for VAT invoices |
| Email only | Near-zero delivery cost; rich content (HTML, PDF attachment); no carrier registration needed; works for international tourists | Email rated low-importance for Vietnamese travelers; "Chị Lan" has no stable email; "Ba Hoa" may not check email; low open rates in Vietnam for transactional messages; does not satisfy P1 requirement for SMS/Zalo confirmation |
| SMS + email (no ZNS) | Universal reach + rich content; simpler than three-channel approach | Foregoes 50–70% cost savings from ZNS; misses Zalo-native user behavior; no structured templates with action buttons; higher per-booking notification cost (~1,500 VND vs ~1,000 VND dual-channel) |

**Choice**: ZNS primary + SMS fallback + email supplementary

**Reasons**:
- Zalo ZNS reaches ~75M MAU in Vietnam at 200–500 VND/msg vs SMS at 300–800 VND/msg — at scale, dual-channel saves 50–70% on notification delivery costs, directly impacting the ~1,000 VND per-booking notification budget in unit economics (regulatory/telecom-sms.md, market-research/business-model.md)
- Industry pattern validation: Grab, Be, Tiki, and Shopee VN all use ZNS primary with SMS fallback — Vietnamese users expect this channel hierarchy (regulatory/telecom-sms.md)
- SMS fallback covers segments without Zalo: "Ba Hoa" (elderly, feature phone), "Marco" (international tourist, fresh local SIM), users in low-connectivity areas (personas/customer-personas.md)
- Email supplementary serves specific use cases: PDF ticket attachment, VAT invoice delivery for "Anh Minh" (business traveler), operator credential provisioning, admin notifications — but is never the sole delivery channel for booking confirmations (personas/customer-personas.md, market-research/feature-benchmark.md)
- SMS/Zalo booking confirmation is rated P1 (currently email-only) — launching without phone-based notification "feels unreliable to Vietnamese users" and ZNS is recommended over SMS for "higher open rates, lower cost, 70M Zalo users" (market-research/feature-benchmark.md)
- Zalo OA/ZNS campaigns achieve $3–5 USD first-booking CAC (25–35% lower than Facebook) — the notification infrastructure doubles as a customer acquisition channel (market-research/business-model.md)

> **IMPLEMENTATION STATUS** (2026-06-18)
> - **Documented**: ZNS primary channel with SMS fallback and email supplementary.
> - **Actual**: Zalo ZNS is not integrated. SMS via eSMS is the actual primary notification channel. Email via Resend is implemented. No ZNS OA registration has been completed.
> - **Status**: `NOT_IMPLEMENTED` (ZNS portion)
> - **Tracking**: ZNS integration deferred. SMS (eSMS) functions as primary, not fallback. Cost savings from ZNS-primary strategy are unrealized. Zalo OA registration is a prerequisite.

---

### 2. SMS Provider Selection — Vietnamese Local Aggregator (eSMS)

| Option | Pros | Cons |
|--------|------|------|
| **eSMS.vn (Vietnamese aggregator)** | 95–99% delivery rate to Vietnam; full VN carrier support (Viettel, VNPT, Mobifone); handles multi-carrier registration and routing; delivery status callback available; Vietnamese company (no cross-border data transfer for phone numbers) | Single-provider dependency; eSMS downtime during Tet = no SMS delivery; key rotation runbook required |
| Stringee (Vietnamese aggregator) | 95–99% delivery rate; full VN support; voice + SMS combined offering | Less established than eSMS for SMS aggregation; may lack delivery status callback granularity; additional vendor evaluation needed |
| Twilio (international) | Global reach for international tourists; well-documented API; strong developer tooling | 60–80% delivery rate to Vietnam; no VN sender numbers; expensive; phone numbers sent to US servers = cross-border transfer requiring CDTIA under PDPL 2025; Foreign Contractor Tax (5% CIT + 5% VAT) withholding on payments |
| AWS SNS (international) | Part of existing AWS ecosystem; simple API; scales automatically | 60–80% delivery rate to Vietnam; limited VN routing; same cross-border data transfer concern as Twilio; FCT withholding applies |

**Choice**: eSMS.vn (Vietnamese aggregator)

**Reasons**:
- eSMS achieves 95–99% delivery rate to Vietnam vs 60–80% for foreign providers (Twilio, AWS SNS) — "Must use Vietnamese SMS providers for reliable OTP delivery. Foreign APIs have poor deliverability and may be filtered by carriers" (regulatory/telecom-sms.md)
- eSMS handles multi-carrier registration and routing as an aggregator — simpler than direct registration with each carrier (Viettel ~50%, VNPT ~20%, Mobifone ~15%) individually (regulatory/telecom-sms.md)
- Vietnamese company means phone numbers processed domestically — avoids PDPL 2025 cross-border data transfer requirements and CDTIA filing obligation that would apply to Twilio/AWS (regulatory/data-privacy.md)
- Delivery status callback required (not fire-and-forget) — eSMS provides this capability for retry logic and notification audit trail (stakeholder-map.md)
- Already identified as the preferred provider with key rotation runbook requirement in stakeholder map (stakeholder-map.md)
- eSMS downtime during Tet is a known risk — mitigated by ZNS-primary strategy where SMS is fallback only (risk-matrix.md, regulatory/telecom-sms.md)

---

### 3. Email Provider — Resend (with FCT Compliance)

| Option | Pros | Cons |
|--------|------|------|
| **Resend** | Modern API; developer-friendly; reliable delivery for transactional email; React email template support | Foreign provider — FCT withholding (5% CIT + 5–10% VAT) on payments; email content with Vietnamese PII constitutes cross-border transfer requiring CDTIA; DPA required under PDPL 2025 |
| MISA Email (Vietnamese provider) | Domestic processing (no CDTIA for email content); no FCT; already integrated for e-invoicing | Email is not MISA's core product; API maturity and deliverability uncertain; adds scope to MISA integration |
| FPT Email (Vietnamese provider) | Domestic processing; established VN tech company; no CDTIA for content | Smaller ecosystem; less developer tooling; separate integration from eSMS (different vendor) |
| Self-hosted (Postal/Mailtrain) | Full data control; no vendor dependency; no FCT; domestic processing if VN-hosted | Ops burden: DKIM/SPF/DMARC management, IP reputation, deliverability monitoring; single point of failure; distraction from core product |

**Choice**: Resend

**Reasons**:
- Email is supplementary (not primary) for Vietnamese travelers — used for PDF ticket attachment, VAT invoice delivery, and operator/admin notifications. Low volume relative to ZNS/SMS makes FCT withholding cost manageable (personas/customer-personas.md, market-research/feature-benchmark.md)
- Email delivery via Resend is already part of the notification context architecture (domain-model/bounded-contexts.md, domain-model/event-flows.md)
- FCT withholding (5% CIT + 5% VAT) applies to payments to Resend as a foreign contractor — must be budgeted into notification cost model (regulatory/einvoice-tax.md)
- DPA required with Resend under PDPL 2025 as a third-party data processor (regulatory/data-privacy.md)
- CDTIA filing required since email content containing Vietnamese PII transits to Resend's infrastructure (regulatory/data-privacy.md)
- Self-hosted rejected: ops burden of email deliverability management is disproportionate when email is the tertiary notification channel — platform engineering resources are better spent on the core booking product (vietnam-market-context.md)

---

### 4. Dispatch Model — Cron-Based Outbox with `after()` Acceleration for Time-Critical Notifications

| Option | Pros | Cons |
|--------|------|------|
| **Cron-only outbox pattern** | Booking state never blocked by notification failure; failed sends retried automatically; every send attempt logged for debugging; webhook handler always returns 200 immediately; decoupled from booking lifecycle | Slight delay between event and delivery (up to cron interval); requires background job infrastructure; more rows in NotificationLog table |
| In-process send (synchronous) | Immediate delivery; simpler architecture (no background job) | SMS/email failure blocks webhook response; webhook timeout risk (PSP retry storms); notification failure could cascade to booking state; no retry without manual intervention |
| Event-driven (message queue) | Real-time delivery; natural backpressure handling; scales horizontally | Additional infrastructure (Redis/RabbitMQ queue); message ordering complexity; dead-letter queue management; overkill for notification volume at launch scale |
| Hybrid (immediate attempt + queue fallback) | Fast happy-path delivery; queue catches failures | Dual-path complexity; race conditions between immediate and queued attempts; harder to debug delivery issues; booking state still at risk from synchronous path |

**Choice**: Cron-based outbox as default dispatch path, with `after()` acceleration for time-critical notifications

**Reasons**:
- Critical design rule: notification failure must NEVER affect booking state — the booking is `paid` because the payment webhook confirmed it; if SMS fails, the booking is still paid (domain-model/bounded-contexts.md)
- Payment webhook must always return HTTP 200 to gateway (except 400 for invalid HMAC) — synchronous notification sending risks webhook timeout, causing PSP retry storms that compound the problem (domain-model/event-flows.md)
- All domains produce NotificationLog rows with `status='pending'` — the dispatch cron is the catch-all delivery path; routes and webhooks enqueue, and the cron ensures delivery even if `after()` fails (domain-model/bounded-contexts.md)
- Retry with backoff tracked via `attemptCount` and `nextAttemptAt` columns on NotificationLog — automatic retry on next cron run without manual intervention (domain-model/bounded-contexts.md)
- eSMS delivery status callback is not fire-and-forget — the cron-based approach naturally accommodates asynchronous delivery status updates (stakeholder-map.md)
- Message queue rejected: additional infrastructure overhead not justified at launch scale (10–20 operators, beachhead corridor); cron-based dispatch is sufficient for projected volume and can be migrated to queue-based if Tet surge (10–20x traffic) demands it (risk-matrix.md, vietnam-market-context.md)

> **EXEMPTION: Time-Critical Notifications** (added 2026-06-20)
>
> The following notification types are exempt from cron-only dispatch and use `after()` acceleration (post-commit immediate attempt with cron catch-up on failure), per DS-006 (Background Jobs) hybrid trigger pattern and ADR-012 D2/D6:
>
> - **OTP send** — user is waiting at a 6-digit input box; cron-interval delay (up to 60s) is unacceptable for authentication UX
> - **Booking confirmation SMS** — customer expects immediate confirmation after payment; delay erodes trust
> - **Trip cancellation SMS** — affected passengers need prompt notification to make alternative arrangements
> - **Payment webhook post-commit notifications** — DS-005 §8.2 specifies `after()` for all webhook-triggered SMS (customerBookingPaid, operatorNewBooking)
>
> The `after()` hook fires immediately after the HTTP response is sent. If `after()` fails silently (cold-start crash, timeout), the 1-minute cron sweep picks up the pending NotificationLog row on its next invocation. This preserves the core invariant: notification failure never affects booking/payment state.
>
> All other notification types (payout_scheduled, operator onboarding, admin alerts, batch reports) use cron-only dispatch — no `after()` acceleration needed.

---

### 5. Notification Scheduling & Retry — Top-Level scheduledFor Column with Exponential Backoff

| Option | Pros | Cons |
|--------|------|------|
| **Top-level `scheduledFor` column + composite index** | Cron query uses indexed column (`WHERE template = X AND scheduledFor <= NOW() AND status = 'pending'`); no JSON parsing overhead; scales to millions of rows; supports both immediate and future-scheduled notifications | Additional column on NotificationLog; requires composite index maintenance |
| scheduledFor in JSON payload | No schema change; flexible structure | Full table scan required (no index on JSON key); `payload->>'scheduledFor'::timestamp <= NOW()` is non-indexable; performance degrades linearly with table size |
| Separate scheduling table | Clean separation of concerns; dedicated scheduling logic | Extra join on every dispatch query; two tables to maintain; orphaned scheduling rows if notification deleted; unnecessary complexity for a single scheduling predicate |
| No scheduling (immediate only) | Simplest model; no scheduling logic | Cannot support payout notifications (`scheduledFor = completedAt + 1 day`); trip completion side effects require future-dated dispatch; loses T+1 payout notification capability |

**Choice**: Top-level `scheduledFor` column with composite index `@@index([template, scheduledFor])` + exponential backoff retry

**Reasons**:
- `scheduledFor` must be a top-level indexed column, never a JSON payload key — querying inside JSON requires parsing every row (no index help), which becomes a full table scan as the table grows (domain-model/invariants-catalog.md)
- Payout notification requires future scheduling: trip completion enqueues `payout_scheduled` notification with `scheduledFor = completedAt + 1 day` (domain-model/event-flows.md, domain-model/state-machines.md)
- Composite index `@@index([template, scheduledFor])` supports the cron dispatch query directly — `WHERE template = 'payout_scheduled' AND scheduledFor <= NOW() AND status = 'pending'` uses the index efficiently (domain-model/invariants-catalog.md)
- Retry via `attemptCount` and `nextAttemptAt` with exponential backoff provides automatic resilience against transient eSMS/Resend outages (domain-model/bounded-contexts.md)
- SMS fallback after 60s ZNS failure aligns with the eSMS stakeholder requirement for delivery status callbacks — if ZNS attempt fails, `nextAttemptAt` is set and the retry dispatches via SMS fallback channel (stakeholder-map.md)

---

### 6. Customer Support Channel — Email + Zalo OA (Minimum Viable)

| Option | Pros | Cons |
|--------|------|------|
| **Email + Zalo OA** | Satisfies Consumer Protection Law complaint channel requirement; Zalo is dominant messaging platform in Vietnam (100M+ users); small operators already use Zalo; near-zero infrastructure cost; Zalo OA doubles as notification and support channel | Not real-time support; limited automation; no ticketing/tracking built-in; relies on Zalo OA agent availability |
| Dedicated ticketing system (Zendesk, Freshdesk) | Professional ticket tracking; SLA management; knowledge base; multi-channel routing | Expensive for pre-revenue startup; foreign SaaS = FCT withholding; overkill for launch volume; doesn't match how Vietnamese users communicate (Zalo, not email portals) |
| In-app live chat (Intercom, Tawk.to) | Real-time; no app switching; modern UX | Requires native app or always-on web widget; staffing burden for real-time response; high cost per agent seat |
| Phone hotline | Familiar to Vietnamese users; FUTA uses hotline-centric model | High cost per interaction; requires trained Vietnamese-speaking agents; scalability challenge during Tet surge; doesn't generate written audit trail for complaint SLA tracking |

**Choice**: Email + Zalo OA (minimum viable support channel)

**Reasons**:
- Risk #6 (no customer support channel) is rated CERTAIN likelihood, HIGH impact — "Email + Zalo OA required before launch. Must exist before go-live" (risk-matrix.md)
- Consumer Protection Law 2023 requires a designated complaint channel accessible from the platform with 3-day acknowledge and 7–30 day resolve timelines (regulatory/consumer-protection.md)
- Zalo is Vietnam's dominant messaging platform (100M+ users) — small operators already use Zalo, not email; booking notifications should support Zalo OA as a channel (stakeholder-map.md)
- "Em Quan" (student) values Zalo chat support responsiveness as a trust factor; "Chị Lan" (migrant worker) uses Zalo/Facebook; micro operators (60–70%) use phone/Facebook/Zalo (personas/customer-personas.md, personas/operator-personas.md)
- Zalo OA verification requires business registration documents — aligns with the Zalo Official Account verification already needed for ZNS delivery (regulatory/telecom-sms.md)
- Zalo OA/ZNS campaigns achieve $3–5 USD first-booking CAC (25–35% lower than Facebook for local services) — the support channel doubles as an acquisition channel (market-research/business-model.md)
- Dedicated ticketing system rejected: disproportionate cost for pre-revenue startup at beachhead scale (1–3 operators, 20+ bookings/day); Zalo OA provides written audit trail sufficient for complaint SLA tracking (vietnam-market-context.md)

---

### 7. PII Handling in Notifications — Recipient Column Isolation (I9 Invariant)

| Option | Pros | Cons |
|--------|------|------|
| **Phone in `recipient` column only; never in payload JSON** | Single PII exposure point; payload can be logged/exported safely; consistent with I9 invariant; supports structured log redaction; DPA scope is narrower (processor sees recipient, not duplicated across fields) | Dispatch logic must extract phone from `recipient` column, not payload; template rendering needs explicit recipient parameter |
| Phone in both recipient and payload | Simpler template rendering (all data in one place); no special extraction logic | Double PII exposure; payload logging leaks phone numbers; violates I9 invariant; admin UI payload inspection exposes raw phone; wider DPA scope with processors; PDPL 2025 data minimization violation |
| Phone in payload only (no recipient column) | All notification data in one structure; flexible schema | No indexed recipient column for audit/lookup; phone buried in unstructured JSON; cannot efficiently query "all notifications sent to phone X"; makes 72h breach notification harder (cannot enumerate affected recipients) |
| Encrypted phone in payload | PII protected even if payload leaked; defense-in-depth | Encryption key management burden; cannot search by recipient without decryption; complicates delivery dispatch; overkill when column isolation achieves the goal |

**Choice**: Phone in `recipient` column only; never in payload JSON (I9 invariant)

**Reasons**:
- I9 invariant: "No raw phone in NotificationLog payload; phone MUST be in `recipient` column only" — prevents double-exposure of PII if payload is logged or exported (domain-model/invariants-catalog.md)
- PDPL 2025 requires data minimization — storing phone in two places (recipient + payload) violates the principle that PII should appear in exactly the minimum locations necessary (regulatory/data-privacy.md)
- 72h breach notification to MPS requires ability to enumerate affected individuals — indexed `recipient` column enables efficient `SELECT DISTINCT recipient WHERE ...` query (regulatory/data-privacy.md)
- eSMS and Resend are third-party processors requiring DPAs — narrower PII scope (phone only in recipient, not duplicated in payload transmitted to processor) reduces DPA complexity and PDPL audit surface (regulatory/data-privacy.md, stakeholder-map.md)
- Admin UI may render notification payload for debugging ("customer says they didn't get the SMS") — I9 ensures payload inspection doesn't expose raw phone numbers to support agents who may not have PII access authorization (domain-model/invariants-catalog.md)
- Logger redaction list must include the `recipient` field but does not need to parse arbitrary payload JSON for phone patterns — cleaner redaction boundary (domain-model/invariants-catalog.md)

---

### 8. Transactional vs Marketing Separation — Strict Content Separation with DNC Check for Marketing

| Option | Pros | Cons |
|--------|------|------|
| **Strict separation: transactional SMS/ZNS never contain promotional content; marketing requires opt-in + DNC check** | Compliant with Decree 91/2020 (anti-spam); transactional messages exempt from consent and DNC checks; clear regulatory boundary; template pre-approval simpler when content is pure transactional; avoids 60–80M VND organizational fines | Two template categories to manage; marketing capability deferred; no cross-promotion in booking confirmations |
| Mixed content (transactional + promotional in same message) | Single message per event; cross-promotion opportunity in booking confirmation; fewer messages sent total | Violates Decree 91/2020: "OTP/booking confirmations must NOT contain promotional content"; risks 60–80M VND fine; carrier may reclassify as marketing (lower delivery priority); brandname SMS template pre-approval likely rejected |
| Marketing-only (no transactional) | Simplest approach; no notification system needed | No booking confirmation delivery; no OTP delivery; no trip cancellation alerts; fundamentally unworkable for a booking platform |
| All messages treated as marketing (opt-in for everything) | Maximum compliance safety; explicit consent for every message | Massive UX friction: customer must opt-in to receive booking confirmation; violates user expectation; unnecessary since transactional messages are exempt from consent requirement |

**Choice**: Strict separation — transactional messages never contain promotional content; marketing messages require opt-in consent + DNC registry check

**Reasons**:
- Decree 91/2020 (anti-spam) classifies message types: OTP codes, booking confirmations, and departure reminders are transactional exempt (no consent needed, no DNC check); marketing/promotions require opt-in consent and must not be sent 10PM–8AM (regulatory/telecom-sms.md)
- Violations carry fines of 60–80M VND for organizations — mixing promotional content in transactional messages risks the entire SMS channel being reclassified (regulatory/telecom-sms.md)
- Brandname SMS registration requires template pre-approval by each carrier — templates that mix transactional and promotional content are likely to be rejected or delayed, compounding the existing 2–4 week registration blocker (regulatory/telecom-sms.md)
- Vietnam maintains a DNC registry managed by VNPT under MOIT — marketing SMS must check DNC before sending; transactional messages are exempt. Mixing content forces DNC check on every message (regulatory/telecom-sms.md)
- PDPL 2025 requires separate consent per processing purpose — marketing consent must be unbundled from service consent; pre-ticked boxes prohibited (regulatory/data-privacy.md, regulatory/dpia-checklist.md)
- Zalo ZNS template types are categorized separately (OTP, transaction notification, customer care) — carrier-side enforcement already assumes this separation (regulatory/telecom-sms.md)
- Consumer Protection Law 2023 booking confirmation must include: departure details, price, operator info, cancellation terms — adding promotional content dilutes the legally-required information and risks unfair-terms challenge (regulatory/consumer-protection.md)

---

## Consequences

### Positive
- ZNS-primary channel saves 50–70% on notification delivery costs vs SMS-only — directly improves the ~1,000 VND per-booking notification cost line item in unit economics
- Dual-channel resilience (ZNS + SMS) provides independent delivery paths during Tet surge (10–20x traffic) when carrier SMS outages are a known risk
- Cron-only outbox pattern guarantees notification failure never corrupts booking state — the core business invariant that payment confirmation is decoupled from notification delivery
- I9 invariant enforcement (phone in `recipient` only) reduces PII exposure surface and simplifies DPA scope with eSMS and Resend
- Zalo OA serves triple duty: support channel (satisfying Consumer Protection Law), notification delivery (ZNS), and customer acquisition ($3–5 USD CAC) — maximizing ROI on a single platform integration
- Strict transactional/marketing separation eliminates Decree 91/2020 fine risk and simplifies carrier template pre-approval during the 2–4 week brandname registration process
- Vietnamese SMS provider (eSMS) achieves 95–99% delivery rate and avoids cross-border data transfer obligations that would apply to Twilio/AWS

### Negative
- Three-channel integration (ZNS + SMS + email) increases development and maintenance surface vs single-channel approach
- Zalo OA registration requires business registration documents and verification — adds to the pre-launch compliance timeline alongside brandname SMS registration
- eSMS single-provider dependency creates a single point of failure for SMS delivery — if eSMS is down during Tet and ZNS also fails, no fallback delivery path exists
- Resend (email) as a foreign provider incurs FCT withholding (5% CIT + 5% VAT) and requires CDTIA filing with MPS for cross-border PII transfer
- Cron-based dispatch introduces delivery delay (up to cron interval) vs synchronous send — not instant, though sub-minute intervals are achievable
- Minimum viable support (Email + Zalo OA) lacks professional ticketing, SLA automation, and multi-agent routing — adequate for beachhead but requires upgrade before scaling past 200+ bookings/day
- ZNS-primary assumes Zalo app installation — segments without Zalo ("Ba Hoa" elderly, "Marco" tourist) always fall back to the more expensive SMS channel

### Mitigations
- Three-channel complexity: ZNS and SMS share eSMS aggregator integration surface; email via Resend is a separate but simple API. Channel routing is a "try ZNS → on failure after 60s → SMS" waterfall per stakeholder-map.md requirement. Template management shared across channels (regulatory/telecom-sms.md, stakeholder-map.md)
- eSMS dependency: ZNS is the primary channel (majority of volume); SMS is fallback only. If both ZNS and eSMS fail simultaneously, booking is still valid — customer can retrieve ticket via booking reference on web. Future mitigation: add Stringee as secondary SMS aggregator post-launch (risk-matrix.md)
- Resend FCT: email is supplementary (low volume relative to ZNS/SMS); FCT withholding budgeted into notification cost model. Migration to Vietnamese email provider is possible but low-priority given email's tertiary role (regulatory/einvoice-tax.md)
- Cron delivery delay: cron interval configurable (30s default); for time-critical OTP delivery, a separate fast-path dispatch exists in the auth context (regulatory/telecom-sms.md)
- Support channel scaling: Zalo OA provides written audit trail sufficient for Consumer Protection Law complaint tracking (3-day acknowledge SLA). Dedicated ticketing system (Vietnamese provider preferred to avoid FCT) evaluated at 50+ operator scale (risk-matrix.md, vietnam-market-context.md)
- Zalo-absent users: SMS fallback delivery rate is 95–99% via eSMS; "Ba Hoa" persona specifically needs "SMS confirmation with operator name and phone" which is achievable via brandname SMS templates (personas/customer-personas.md, regulatory/telecom-sms.md)

---

## References

All decisions sourced exclusively from `documentation/business/`:

| Document | Cited In |
|----------|----------|
| regulatory/telecom-sms.md | D1, D2, D5, D6, D8 |
| regulatory/data-privacy.md | D2, D3, D7, D8 |
| regulatory/consumer-protection.md | D6, D8 |
| regulatory/einvoice-tax.md | D3, Mitigations |
| regulatory/dpia-checklist.md | D8 |
| personas/customer-personas.md | D1, D6, D7, Mitigations |
| personas/operator-personas.md | D6 |
| market-research/business-model.md | D1, D6 |
| market-research/feature-benchmark.md | D1, D3 |
| domain-model/bounded-contexts.md | D3, D4, D5 |
| domain-model/event-flows.md | D3, D5 |
| domain-model/invariants-catalog.md | D5, D7 |
| domain-model/state-machines.md | D5 |
| risk-matrix.md | D2, D4, D6, Mitigations |
| stakeholder-map.md | D2, D5, D6, Mitigations |
| competitor-benchmark/feature-parity-matrix.md | Context |
| competitor-benchmark/operator-sentiment.md | Context |
| vietnam-market-context.md | D3, D4, D6, Mitigations |
