---
name: customer-incident-comms
description: Customer-facing incident communication — status page entries, email templates, escalation timing per severity. Outputs comms playbook to `docs/operate/incident-comms-playbook.md`. Reads `/project-classify` to skip XS. Use when user says "incident comms", "status page entry", "customer email", "post-mortem comms", "/customer-incident-comms", or before launch.
output_size:
  XS: skip
  S: 1h
  M: 2h
  L: 4h
  XL: 4h
---

# /customer-incident-comms — External Comms Playbook

## Why you'd care

During the first real incident the on-call engineer freezes at the status-page text box for 40 minutes because no template exists and the legal review of every word feels career-defining — meanwhile customers are tweeting "is X down?" and your competitor's BD team is screenshotting it. Pre-written severity-keyed templates plus an escalation cadence are what compress the "first useful update" SLA from "whenever someone finds the words" to under 15 minutes, which is the gap between a routine post-mortem and a churn event.

Invoke as `/customer-incident-comms`. Silence during outage = trust collapse. Over-promising = trust collapse. Templates remove the freeze-up.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS → SKIP.
2. Pre-existing: status page (Statuspage/BetterStack/instatus), transactional email provider, customer list segmentation.
3. SLA doc (if exists) — comms must honor SLA promises.

## Inputs
- Status page URL
- Customer segments (free / paid / enterprise)
- SLA terms requiring notification
- Brand voice guide (if exists)

## Process

1. **Comms trigger matrix**:

   | Severity | Status page | Email | Phone (enterprise) |
   |---|:--:|:--:|:--:|
   | SEV1 (full outage) | <5min | <30min | <1h |
   | SEV2 (degraded) | <15min | <2h if >30min impact | – |
   | SEV3 (partial) | optional | – | – |
   | SEV4 (minor) | – | – | – |

2. **Status page entry stages**:

   | Stage | Required content |
   |---|---|
   | Identified | What's broken, who's affected, ETA next update (NOT ETA-to-fix) |
   | Investigating | Cause hypothesis (if known), still affected, next update time |
   | Mitigating | Mitigation in progress, expected restore window |
   | Monitoring | Fix deployed, watching for stability |
   | Resolved | Final scope, total duration, link to post-mortem (when published) |

3. **Email templates** — write three, ready-to-fill:

   **Template A — Initial (SEV1, <30min)**:
   > Subject: [<Product>] Service disruption — we're investigating
   > 
   > At <UTC time>, we identified <issue> affecting <feature/region>. We are actively investigating. Customer impact: <can/cannot do X>.
   > 
   > Status updates: <status page URL>
   > Next update by: <UTC time + 30min>

   **Template B — Resolution**:
   > Subject: [<Product>] Service restored
   > 
   > As of <UTC time>, <feature> has been restored. Total impact: <duration>. Affected: <scope>.
   > 
   > We will publish a full post-mortem at <URL> within 5 business days.
   > 
   > If you experienced data loss or billing impact: <support email>.

   **Template C — Post-mortem published**:
   > Subject: [<Product>] Post-mortem for <date> incident
   > 
   > Root cause: <one-sentence>
   > What we changed: <three concrete changes>
   > Read the full report: <URL>

4. **Tone rules**:
   - Never blame customer, vendor, or "the cloud"
   - No "thoughts and prayers" prose; lead with facts
   - "We are working to restore" not "we apologize for the inconvenience"
   - Acknowledge before knowing the cause: silence is worse than uncertainty
   - Plain English over jargon: "logging service" not "OTLP collector"

5. **Approval routing**:
   - Status page entries: Comms Lead drafts, IC approves (no exec gate during incident)
   - Customer emails: Comms Lead + IC + (Legal for SEV1 if PII/security)
   - Post-incident write-up: Eng + Comms + Legal

6. **Anti-patterns to forbid**:
   - "Should be fixed shortly" — no fake ETAs
   - Status page resolved while users still affected
   - First email > 1h into SEV1 (page IC if Comms Lead hasn't drafted)
   - Burying scope in legalese

## Output

Write `docs/operate/incident-comms-playbook.md`:

```markdown
# Incident Comms Playbook
**Date:** <YYYY-MM-DD> | **Owner:** Comms Lead role

## Trigger matrix
<table from step 1>

## Status page entry template
- Stage names: Identified → Investigating → Mitigating → Monitoring → Resolved
- Each stage requires: what+who+when-next

## Email templates
- A: Initial — `templates/inc-email-initial.md`
- B: Resolution — `templates/inc-email-resolved.md`
- C: Post-mortem — `templates/inc-email-pm.md`

## Tone rules
- No fake ETAs
- No blame
- Facts before apology
- Plain English

## Approval
| Artifact | Drafter | Approver |
|---|---|---|
| Status page entry | Comms Lead | IC |
| Customer email SEV1 | Comms Lead | IC + Legal if PII |
| Post-mortem | Eng | Eng + Comms + Legal |

## Anti-patterns
- "Shortly" with no time
- Premature resolution
- Burying scope
- Silence > 1h
```

## Verification
- 3 email templates exist as files.
- Trigger matrix names minutes, not "soon".
- Approval chain doesn't require exec for status updates.
- Tone rules explicit (forbidden phrases listed).
- Plain-English check before send.
