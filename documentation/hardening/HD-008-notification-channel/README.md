# HD-008: Notification Channel Hardening

> Status: NOT_STARTED | References: FI-014, DS-007, ADR-013

## Purpose

Verify notification delivery reliability before production launch. SMS is the sole customer authentication channel (OTP delivery) -- a notification outage is an auth outage. This audit covers carrier registration, delivery monitoring, fallback strategy, and template compliance.

## Skill Invocation

- **Primary**: `/observability-review` -- notification delivery monitoring
- **Supplementary**: `/incident-runbook` -- SMS outage response

## Acceptance Criteria

### eSMS Brandname Registration (FI-014 -- HARD BLOCKER)

- [ ] Brandname application submitted to eSMS (Decree 91/2020 compliance)
- [ ] Brandname approved by carrier (5-10 business day process minimum)
- [ ] SMS templates registered and approved by carrier
- [ ] Production API key configured and tested with approved brandname
- [ ] Fallback: if brandname not approved by go-live, document interim plan (numeric sender ID?)

### Zalo ZNS Channel (FI-014 Gap)

- [ ] Zalo Official Account verified (prerequisite for ZNS)
- [ ] ZNS templates registered and approved
- [ ] OR: explicit deferral documented -- single SMS channel accepted with risk acknowledgment
- [ ] If deferred: document that Zalo ZNS was documented as "primary" but is actually not active (FI-014)

### OTP Delivery Reliability

- [ ] OTP SMS delivery rate monitored (target: >95% delivery within 30 seconds)
- [ ] Failed OTP delivery triggers alert (customer cannot authenticate if SMS fails)
- [ ] Rate limiter on OTP send prevents carrier-level throttling (5 req / 15 min per phone -- ADR-003)
- [ ] OTP lockout (3 failures -> 15-min) prevents brute-force without DOS-ing the carrier

### Delivery Monitoring & Alerting

- [ ] `NotificationLog` records delivery status for every SMS/email sent
- [ ] Delivery failure rate spike (>5% in 5 min window) triggers alert
- [ ] eSMS delivery callback webhook configured (if available) or polling status API
- [ ] Resend webhook for email bounce/complaint tracking configured

### Template Management

- [ ] All notification templates version-controlled in codebase
- [ ] No PII beyond recipient phone/email in notification log payload (I9 invariant)
- [ ] Phone numbers masked in any admin-visible notification log views (last-4 only)

### Fallback Strategy

- [ ] SMS provider failover documented (eSMS -> ? if eSMS down)
- [ ] If no failover provider: outage impact documented (auth blocked for all customers)
- [ ] Email as secondary OTP channel: evaluated and decided (yes/no with rationale)

## Verdict

**PASS** when: eSMS brandname approved and production-tested, OTP delivery monitoring active, and fallback strategy documented. Zalo ZNS may be deferred with documented risk acceptance.

## Cross-References

- FI-014 -- notification system feature (brandname registration, Zalo gaps)
- DS-007 -- notification dispatch design
- ADR-013 -- notification architecture
- HD-001 -- security review (OTP = auth dependency)
- GL-001 -- launch checklist (notification items)
