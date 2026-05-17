---
name: on-call-philosophy-pre
description: Pre-launch on-call philosophy — solo-founder vs rotation, escalation tiers, alert hygiene, comp model, burnout floors, runbook expectations. Outputs to `docs/inception/on-call-philosophy-pre-<project>.md`. Use when user says "on-call", "pager", "rotation", "incident response", "PagerDuty", "/on-call-philosophy-pre", or before first prod.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /on-call-philosophy-pre — Pager Culture Decided At Hire 1. Set It Right Before The First 2 AM Page.

## Why you'd care

Founders default to 'I'll just answer the page myself' and then burn out at month four — and there's no rotation infrastructure ready when the team finally hires. Setting the philosophy pre-prod is the cheap moment to draw the lines.

On-call ≠ "founder gets every page forever". On-call = a designed system with defined load, comp, alert hygiene, and recovery. Decide the philosophy before you have customers, before the first 3 am page hardcodes a bad pattern.

## Pre-flight
Run before first prod deploy OR before hire #2 if hire #1 = engineer. Pairs with `/incident-runbook`, `/observability-design`, `/burnout-early-warning`, `/post-mortem`.

## Inputs
- Product type (B2C consumer / B2B SaaS / fintech / infra) — different uptime expectations.
- Customer SLA commitments (none / informal / contractual).
- Team size + geography (solo / 2-3 / multi-zone).
- Founder + team prior on-call exposure (some / scarred / none).

## Process
1. **Pick the model** — solo-founder, primary+secondary, follow-the-sun, third-party.
2. **Define what pages** — alert hygiene = the difference between sustainable and not.
3. **Set escalation tiers** — P1 / P2 / P3 with response times.
4. **Comp model** — on-call pay or time-back, not vibes.
5. **Burnout floors** — max consecutive pages, post-incident recovery, mandatory handoff.
6. **Runbook expectations** — every alert points to a runbook.
7. **Tool stack** — pager + status page + post-mortem + on-call calendar.
8. **Onboarding to on-call** — shadow rotations, not "you have the pager, good luck".

## Output
Write `docs/inception/on-call-philosophy-pre-<project>.md`:

```markdown
# On-Call Philosophy (Pre-launch) — <project>
**Owner:** founder / Head of Eng
**Date:** <YYYY-MM-DD>
**Stage:** pre-launch / pre-revenue / post-launch
**Team size:** <N>

## Why this exists before first prod
- The first 2 am page sets the cultural pattern. Decide intentionally now.
- "Founder pages forever" = founder burns out + bus factor 1
- Unpaid, unbounded on-call kills senior eng retention
- Alert noise compounds — every false page trains people to ignore real ones
- Customers eventually pay for SLAs; you need to know if you can deliver

## Stage-appropriate posture

| Stage | Posture |
|-------|---------|
| **Pre-launch / pre-revenue** | Best-effort. No formal pager. Status page reactive. |
| **First customers (< 50)** | Founder primary, co-founder secondary. Business-hours only initially. |
| **Production with paying customers** | Rotation of 2+ engineers, 7-day shifts, comp baked in. |
| **Multi-region SaaS** | Follow-the-sun or third-party (PagerDuty + ops contractor) — no solo 24/7. |

Current stage: <stage>
Current posture: <posture>

## Models (pick one)

### A) Solo-founder pager
- Founder gets all P1/P2 alerts
- **Acceptable only:** pre-revenue / pre-launch
- Hard expiration: revoke when revenue starts OR when founder has had 2 consecutive bad nights
- Failure mode: founder breaks in 6-12 months

### B) Primary + Secondary (2-person rotation)
- Primary takes pages; secondary backs up if primary unreachable in 5 min
- 7-day shifts, weekly handoff
- **Acceptable:** 2-5 person eng team
- Failure mode: 50/50 split = each person on-call 26 weeks/yr (too much) — add more rotations as team grows

### C) Rotation of N (recommended at 4+ engineers)
- N engineers, 1 primary at a time, 1 secondary
- Each person on-call ~1 week every N weeks
- Holidays + vacation rotate fairly
- Failure mode: alert noise + bad handoff = silent on-call hell

### D) Follow-the-sun
- Multiple time-zones, each region handles their business hours
- **Acceptable:** 8+ engineers across 2-3 zones
- Failure mode: handoff drops, cross-zone incidents fall through

### E) Third-party / managed
- Ops vendor (e.g. ScaleOps / Squadcast partner) handles tier-1
- **Acceptable:** never-not-online infra products
- Failure mode: vendor doesn't know your system → escalates everything

**Our pick:** <model>
**Trigger to upgrade to next tier:** <signal — e.g. "team hits 4 engineers" or "first paying customer">

## Escalation tiers

| Tier | Definition | Response time | Notification | Examples |
|------|-----------|---------------|--------------|----------|
| **P1** | Prod down OR data loss OR security | 5 min ack, 30 min mitigate | Phone call + SMS + Slack | Full outage, payment broken, data leak |
| **P2** | Degraded prod OR single-customer down | 15 min ack, 2 hr mitigate | SMS + Slack | One region slow, one customer can't login |
| **P3** | Non-urgent issue | Next business day | Slack only | Cosmetic bug, internal tool flaky |

**Default for new alerts:** P3. Promote based on data, not anxiety.

## What pages (alert hygiene)
Rule: every page must require human action *now*. Anything else = email, dashboard, or nothing.

**Pages:**
- ✅ Customer-facing endpoint 5xx rate > X% for Y min
- ✅ Database unreachable
- ✅ Payment provider down
- ✅ Background job queue depth > X
- ✅ Cert expiring in < 7 days (escalating)
- ✅ Synthetic check fails on critical user flow
- ✅ Budget alert: cloud cost > X% of monthly limit

**Does NOT page:**
- ❌ CPU > 80% (correlate with user impact first)
- ❌ Single instance down (autoscaling handles)
- ❌ Slow query (Slack-only)
- ❌ Test environment alerts
- ❌ Anything resolved in < 1 min
- ❌ Predictable scheduled events

**Alert review monthly:** any alert that fired and was actionless → tune or remove.

## Runbooks
Every P1 + P2 alert links to a runbook. No runbook = the alert is incomplete.
- See `/incident-runbook` for template
- Runbook updated within the incident week
- New engineer should be able to follow without paging the author

## Comp model
On-call is work. Compensate or rotate often enough that it isn't punishment.

**Options:**
- **Stipend:** $X/week on primary, $Y/week on secondary
- **Time back:** comp day for any night with 2+ pages OR any P1 page
- **Equity bump:** for the founder/solo-on-call period, more equity recognizes the load
- **Hybrid:** stipend + comp days for pages

**Our model:** <pick>
**Holidays:** double rate OR mandatory time-back day

## Burnout floors
Hard rules — written, enforceable.
- Max 2 consecutive on-call weeks without a break week
- Page after midnight → next morning starts at 11 am earliest
- 2+ pages in one night → next day off, no exceptions
- Post-P1 incident → 1 comp day mandatory before next on-call shift
- New parent / illness / bereavement → off rotation, no questions
- Personal yellow/orange on `/burnout-early-warning` → off rotation that week

## Handoff protocol
Weekly handoff meeting, 15 min, Monday morning:
- Open issues from past week
- Anything currently degraded
- Upcoming risky changes (deploys, migrations)
- Anything weird seen but not page-worthy
- Action items from any incidents

Written handoff in `#on-call-handoff` channel — searchable record.

## Tool stack
- **Pager:** PagerDuty / Opsgenie / Better Stack On-Call / Grafana OnCall
- **Alerting source:** Datadog / Grafana / Sentry / Vercel
- **Status page:** BetterStack / Statuspage / Atlassian / hand-rolled
- **Incident channel:** `#incidents` Slack channel + dedicated room per active P1
- **Post-mortem doc:** Notion / wiki — see `/post-mortem`
- **Runbook home:** repo `docs/ops/runbooks/` or wiki

## Incident response flow
1. Alert fires → primary acks
2. If unacked in 5 min → secondary paged
3. Primary opens `#inc-<short-id>` channel + status-page incident if customer-visible
4. Severity assigned within 10 min
5. Mitigate (rollback / failover / hotfix)
6. Resolve + close incident channel
7. Post-mortem within 7 days for P1; optional for P2

See `/incident-runbook` + `/post-mortem`.

## SLA / SLO posture (pre-revenue)
- Don't commit to SLAs in contracts before measuring
- Internal SLO targets (aspirational): 99.5% pre-launch → 99.9% post-launch → 99.95% mature
- See `/observability-design` for SLO definition

## Onboarding to on-call
- Shadow 1 full rotation before primary
- Read all runbooks
- Walk through last 5 post-mortems
- Pair with 1 incident-veteran
- First 2 weeks as primary: secondary is most-experienced person

**Not ready signal:** can't run the top-5 runbooks without help → not yet primary.

## Founder-specific (until rotation is staffed)
- Founder primary for first phase is *expected* but bounded
- Hard expiration: when revenue > $X OR team > Y engineers OR personal burnout score yellow
- Co-founder / first engineer must learn runbooks early, not after crisis
- Plan B: contractor on retainer for true emergency if solo

## Customer comms during incidents
- Status page updated within 10 min of P1 declared
- First customer-facing update within 30 min
- Updates every 30 min until resolved
- Post-mortem published (sanitized) for P1s affecting customers within 14 days
- See `/status-page` + `/support-loop`

## Anti-patterns
- ❌ Founder on-call forever, no expiration plan
- ❌ Alert that fires daily with no action taken
- ❌ Pager assigned without runbook
- ❌ Junior solo-on-call without shadow rotation
- ❌ No comp for on-call hours
- ❌ Handoff via "ping me if anything weird"
- ❌ No post-mortem for P1
- ❌ Status page silent during outage
- ❌ Customer SLA committed before measurement
- ❌ Vacation cancelled to cover gap (= comp the gap-filler instead)

## Quarterly review
- Page volume per shift trending?
- Alert noise: % actionable?
- Burnout floors breached?
- SLO performance vs target
- Runbook coverage % of alerts
- Comp model still fair as team scales?

## Pre-launch checklist
- [ ] Model picked (and expiration trigger for solo-founder)
- [ ] P1/P2/P3 tiers defined with response times
- [ ] Alert hygiene rules + monthly review scheduled
- [ ] Runbook required for every P1/P2 alert
- [ ] Comp model defined
- [ ] Burnout floors written
- [ ] Handoff protocol scheduled
- [ ] Tool stack live (pager + status + incident channel)
- [ ] Onboarding-to-on-call doc

## Anti-patterns flagged
- ❌ Solo-founder pager with no expiration
- ❌ Pages without runbooks
- ❌ No comp model
- ❌ No alert review cadence
- ❌ Burnout floors unwritten
- ❌ Customer comms ad-hoc

## Next
- Runbooks → `/incident-runbook`
- Observability + SLO → `/observability-design`
- Status page → `/status-page`
- Post-mortem template → `/post-mortem`
- Burnout monitoring → `/burnout-early-warning`
```

## Verification
- Model picked + expiration trigger.
- Tiers + response times explicit.
- Alert hygiene + monthly review.
- Runbook required per P1/P2 alert.
- Comp model defined.
- Burnout floors written.
- Tool stack live.
- Onboarding flow.
