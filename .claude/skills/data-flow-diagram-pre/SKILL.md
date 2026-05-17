---
name: data-flow-diagram-pre
description: Pre-build data flow diagram — sources, ingress, storage, processors, egress per critical path with mermaid diagrams. Outputs to `docs/inception/data-flow-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "data flow", "DFD", "data flow diagram", "data lineage", "/data-flow-diagram-pre", or before threat model / DPIA.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /data-flow-diagram-pre — Pre-build Data Flow Diagrams

## Why you'd care

A threat model done without a current data-flow diagram catalogues the wrong risks against the wrong assets, and a DPIA without one cannot honestly answer "what crosses an EU border" — both produce paperwork that satisfies the auditor for a year and then ages into actual liability. Drawing the source → ingress → store → processor → egress map before code lands is the cheapest version; doing it after means archeology across a dozen repos plus interviewing engineers who have already left.

Invoke as `/data-flow-diagram-pre`. Map every data path before code lands. Feeds threat-model-pre, pii-inventory-pre, DPIA, residency map.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP
2. Read `docs/inception/pii-inventory-<project>.md`.
3. Read `docs/inception/data-residency-<project>.md` if exists.
4. Read `docs/inception/jtbd-<project>.md` for critical paths.

## Inputs
- Critical user journeys (signup, login, primary action, payment, support, export, delete).
- Sub-processor list.
- Storage systems (DB, cache, object store, search, warehouse).
- External integrations (webhooks, OAuth, APIs).

## Process
1. **Identify critical paths** (each gets its own DFD):
   - Signup / onboarding
   - Authentication / session
   - Primary product action (per JTBD)
   - Payment / checkout
   - Support ticket
   - Analytics event
   - Data export (DSAR portability)
   - Account delete (DSAR erasure)
   - Webhook receive
   - Cron / batch
2. **DFD elements** (Yourdon/DeMarco notation):
   - **External entity** (rectangle): user, third-party, regulator
   - **Process** (circle): transform / validate / enrich
   - **Data store** (parallel lines): DB table, cache, file
   - **Data flow** (arrow): direction + label (data class)
3. **Trust boundaries** (dashed line):
   - Internet ↔ edge
   - Edge ↔ app tier
   - App ↔ DB
   - App ↔ third-party
   - Region A ↔ Region B
4. **Per flow annotate**:
   - Data class (per `/data-classification-scheme`)
   - PII fields involved (per `/pii-inventory-pre`)
   - Encryption (TLS / mTLS / at-rest)
   - Authn / authz mechanism
   - Logging (what + retention)
5. **Mermaid as source of truth**:
   - sequenceDiagram for time-ordered (signup, payment)
   - flowchart for system topology
   - erDiagram for data model relationships
6. **Storage inventory cross-ref**:
   - Each store appears in ≥1 flow
   - Orphan stores flagged
7. **Egress catalog**:
   - Every outbound call to non-owned system
   - Per egress: purpose, data, region, encryption, retry, breaker
8. **Boundary risk per flow**:
   - Trust transitions = STRIDE candidate per `/threat-model-pre`
9. **Versioning**:
   - DFD reviewed when new flow added or processor changes
   - PR template requires DFD update if new external call

## Output
Write `docs/inception/data-flow-<project>.md`:

```markdown
# Data Flow Diagrams (Pre-build) — <project>
**Date:** <YYYY-MM-DD>

## Scope
- 8 critical paths in v1
- B2C SaaS, EU + US, AWS eu-west-1 + us-east-1

## Path 1 — Signup
\`\`\`mermaid
sequenceDiagram
    participant U as User (browser)
    participant CF as Cloudflare edge
    participant APP as App (EKS eu-west-1)
    participant AUTH as Auth0 (EU tenant)
    participant DB as Postgres (RDS eu-west-1)
    participant Q as SQS (eu-west-1)
    participant EM as Resend (EU)

    U->>CF: POST /signup (email, name, pw)
    CF->>APP: forward (TLS)
    APP->>APP: validate input
    APP->>AUTH: create user (mTLS, SCC)
    AUTH-->>APP: user_id + JWT
    APP->>DB: insert users row (TLS, in-region)
    APP->>Q: enqueue welcome-email
    APP-->>U: 201 + session cookie
    Q->>EM: send welcome (TLS, SCC)
\`\`\`
- PII: email, name, IP. Tier: Confidential.
- Lawful basis: Contract.
- Trust boundary crossed: Internet→Edge→App, App→Auth0 (US fallback?), App→Resend.
- Logging: app log (request id, user_id, no PII body), 90d Datadog EU.

## Path 2 — Login
\`\`\`mermaid
sequenceDiagram
    User->>App: POST /login
    App->>Auth0: verify
    Auth0-->>App: JWT (15min) + refresh (7d)
    App-->>User: session cookie httpOnly secure SameSite=Lax
\`\`\`
- WebAuthn passkey preferred path.
- Failure: 5 attempts → CAPTCHA → 15min lock.

## Path 3 — Primary action (place order)
\`\`\`mermaid
sequenceDiagram
    User->>App: POST /orders (cart)
    App->>DB: read inventory + price
    App->>Stripe: PaymentIntent (PAN never touches App)
    Stripe-->>App: pi_xxx + client_secret
    App-->>User: client_secret
    User->>Stripe: confirm card (Stripe.js direct)
    Stripe->>App: webhook payment.succeeded
    App->>DB: insert order
    App->>Q: enqueue fulfillment
    Q->>ShipBob: create shipment
\`\`\`
- PCI scope: only Stripe (no PAN to our infra).
- Webhook signature verified (Stripe-Signature header).

## Path 4 — Support ticket
\`\`\`mermaid
sequenceDiagram
    User->>App: open chat widget
    App->>Zendesk: create ticket (SCC, EU instance for EU user)
    Zendesk-->>User: ticket id
    Agent->>Zendesk: reply
    Zendesk->>User: notification (Resend)
\`\`\`
- PII: ticket body may contain anything. Treat as Confidential.

## Path 5 — Analytics event
\`\`\`mermaid
sequenceDiagram
    Browser->>PostHog (EU): event (page_view, click)
    PostHog->>Warehouse: nightly export
\`\`\`
- Consent gate: events fire only after analytics-cookie consent.
- IP truncated client-side.

## Path 6 — Data export (DSAR portability)
\`\`\`mermaid
sequenceDiagram
    User->>App: POST /me/export
    App->>App: enqueue export job
    Worker->>DB: read users, orders, support
    Worker->>Zendesk API: pull ticket bodies
    Worker->>Stripe API: pull payment history
    Worker->>S3: write JSON bundle (encrypted, signed URL 7d)
    Worker->>Resend: email signed-URL link
\`\`\`
- SLA: 30d (GDPR Art 12). Target: <72h.
- Audit log: who requested, who fulfilled, when downloaded.

## Path 7 — Account delete (DSAR erasure)
\`\`\`mermaid
sequenceDiagram
    User->>App: POST /me/delete
    App->>DB: mark deletion_pending (30d grace)
    Note over App: T+30d cron
    Worker->>DB: hard-delete users + cascade
    Worker->>Auth0: delete user
    Worker->>Stripe: detach customer (retain PCI-required tax 7y)
    Worker->>Zendesk: anonymize tickets
    Worker->>PostHog: delete distinct_id events
    Worker->>Datadog: scrub user_id from logs (best-effort)
\`\`\`
- Grace 30d for accidental delete recovery.
- Tax records retained per legal obligation; rest hard-deleted.

## Path 8 — Webhook receive (Stripe)
\`\`\`mermaid
sequenceDiagram
    Stripe->>App: POST /webhooks/stripe
    App->>App: verify Stripe-Signature
    App->>DB: idempotent insert event
    App->>Q: enqueue handler
    App-->>Stripe: 200 (within 5s)
\`\`\`
- Replay window: 5min (timestamp tolerance).
- Idempotency: event_id unique constraint.

## Storage inventory (cross-flow)
| Store | Region | Purpose | PII? | Backup | Retention |
|---|---|---|:--:|---|---|
| Postgres users | eu-west-1 | core | ✓ | KMS snapshot 35d | account+30d |
| Postgres orders | eu-west-1 | tx | ✓ | same | 7y tax |
| Redis sessions | eu-west-1 | cache | ✓ JWT | – | 7d |
| S3 profile photos | eu-west-1 | binary | ✓ | versioning 30d | account+30d |
| S3 export bundles | eu-west-1 | DSAR | ✓ | – | 7d signed URL |
| OpenSearch logs | eu-west-1 | obs | scrubbed | snapshot 7d | 90d |
| Datadog SaaS | datadoghq.eu | obs | scrubbed | vendor | 90d |
| PostHog SaaS | EU cloud | analytics | hashed id | vendor | 13mo |

## Egress catalog
| Destination | Purpose | Data | Region | Encryption | Retry | Breaker |
|---|---|---|---|---|---|---|
| Auth0 EU | identity | email, pw hash | EU | mTLS | 3x exp backoff | 5 fail/30s open |
| Stripe | payment | order, customer ref | US (SCC) | TLS 1.3 | none (idempotent key) | n/a |
| Resend | email | tpl, vars | EU | TLS | 3x | 5 fail/min |
| Zendesk | support | ticket | EU instance | TLS | none | n/a |
| ShipBob | fulfillment | address, items | US (SCC) | TLS | 3x | yes |
| Datadog EU | logs | scrubbed | EU | TLS | buffered | yes |
| PostHog EU | analytics | events | EU | TLS | buffered | yes |
| Cloudflare | edge | requests | global | TLS | – | – |

## Trust boundaries
- B1: Internet ↔ Cloudflare edge (DDoS, WAF)
- B2: Cloudflare ↔ EKS (mTLS via Cloudflare Tunnel)
- B3: EKS ↔ RDS (VPC private, IAM auth, TLS)
- B4: EKS ↔ Auth0/Stripe/Resend (TLS + signed webhooks back)
- B5: EU region ↔ US region (NEVER for customer data; only aggregates)
- B6: User session ↔ Admin (separate IdP path, MFA + IP allowlist)

## STRIDE handoff
Each boundary feeds `/threat-model-pre`. Per flow:
- Spoofing at B1 → CF Bot Mgmt
- Tampering at B2 → mTLS
- Repudiation at all → audit log
- Info disclosure at B5 → enforce in-region middleware
- DoS at B1 → CF rate-limit
- Elevation at B6 → JIT + session-record

## DFD update protocol
- New flow → add diagram + table rows
- New egress → catalog + DPA + SCC check
- New PII field → pii-inventory-pre updated first
- PR template checkbox: "DFD updated?"

## Effort + cost
| Item | Cost |
|---|--:|
| Initial DFD set (8 paths) | 1 wk eng + arch |
| Mermaid in repo + render in PR | 1 d devops |
| Quarterly review | 2 d |
| **Y1 total** | **~$8k internal** |

## Standards alignment
- ISO 27001 A.5.7 (info classification) ✓
- NIST SP 800-53 PL-8 (system architecture) ✓
- GDPR Art 30 (records of processing) ✓
- PCI DSS 1.2 (network diagram) ✓

## Risk if skipped
- Threat model built on assumed (not real) flows
- Egress to unknown processor surfaces post-incident
- DPIA missing flow detail → regulator reject
- New eng cannot reason about boundaries

## 90-day plan
1. Identify critical paths with PM (week 1)
2. Draft DFDs in mermaid (week 2)
3. Cross-ref with PII inventory (week 3)
4. Storage + egress catalog complete (week 4)
5. Threat-model handoff (week 5)
6. PR template DFD checkbox enforced (week 6)
7. Quarterly review calendar (week 12)
```

## Verification
- One DFD per critical path.
- Trust boundaries marked.
- Storage inventory complete.
- Egress catalog complete.
- Each flow annotated with PII + encryption + authz.
