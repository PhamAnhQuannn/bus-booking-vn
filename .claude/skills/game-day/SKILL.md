---
name: game-day
description: Scheduled live failure-injection exercise — real systems, real load, planned blast radius. Distinct from paper tabletop or chaos-monkey background. Outputs game-day plan + after-action to `docs/operate/game-day-<date>.md`. Reads `/project-classify` to skip XS/S. Use when user says "game day", "live drill", "failure injection", "chaos exercise", "/game-day", or quarterly cadence.
output_size:
  XS: skip
  S: skip
  M: 4h
  L: 8h
  XL: 8h
---

# /game-day — Scheduled Live Failure Injection

## Why you'd care

Runbooks that have never been executed under load are fiction — the team's first real practice happens during the actual outage. Game day surfaces the broken alert, the missing access, and the wrong runbook owner while the customer is still happy.

Invoke as `/game-day`. Tabletops surface gaps in theory. Game days surface gaps in reality. Run quarterly minimum.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS/S → SKIP (not enough surface to drill).
2. Pre-existing: monitoring + alerting wired, incident runbook exists, oncall rotation real.
3. Maintenance window booked, stakeholders notified, customer-comms drafted in case of leak.

## Inputs
- Target service + dependency to fail
- Hypothesis ("if Redis dies, queue fails over within 30s")
- Blast radius cap (% of traffic, duration limit)
- Abort criteria
- Oncall + IC roster for the window

## Process

1. **Pick failure mode** — one per game day:

   | Failure | How to inject |
   |---|---|
   | DB primary down | Force failover via cloud console |
   | Cache layer down | `iptables` block / SG rule strip |
   | Upstream API 500s | Toxiproxy / WireMock fault injection |
   | Region-wide outage | Route53 weight 0 for one region |
   | Disk full | `fallocate` to consume free space |
   | CPU saturation | `stress-ng` on N cores |
   | Network latency | `tc qdisc` add 500ms delay |
   | Cert expiry | Roll back cert to expired snapshot in staging-clone |

2. **Write hypothesis BEFORE injection** — prediction tests learning:
   > "When primary DB fails, automated failover completes within 60s; error rate stays <1% during transition; no manual intervention needed."

3. **Define blast cap + abort**:
   - Max duration: <30min>
   - Max error rate: <5%>
   - Customer-visible threshold: any user-reported incident → abort
   - Abort command pre-written: `<one-line revert>`

4. **Roles**:
   - **Game-day lead** — drives, calls abort
   - **Observer** — watches monitors, calls abort threshold breach
   - **Injector** — runs the fault command
   - **Scribe** — timestamped log
   - **External comms standby** — drafts customer message in case of leak

5. **Timeline**:
   - T−7d: announce window, freeze unrelated deploys
   - T−1d: dry-run abort command in staging
   - T−1h: pre-brief, confirm roles, confirm comms standby
   - T0: inject
   - T0→Tn: observe, document each alert (fired? routed correctly? clear? actionable?)
   - Tn: revert
   - T+1h: hot-wash debrief
   - T+5d: written after-action

6. **After-action report** — required:
   - Hypothesis vs. actual outcome
   - Alerts that fired (and didn't)
   - Mean-time-to-detect, mean-time-to-mitigate
   - Surprises (unexpected dependencies, cascading failures)
   - Action items with owners + due dates

7. **Cadence**:
   - Quarterly minimum
   - Rotate failure mode (don't drill DB failover four times running)
   - Production-targeted ≥1×/year; staging-targeted other quarters acceptable for S/M

## Output

Write `docs/operate/game-day-<YYYY-MM-DD>.md`:

```markdown
# Game Day — <YYYY-MM-DD>
**Lead:** <name> | **Service:** <name> | **Failure:** <mode>

## Hypothesis
<one-sentence prediction>

## Blast cap
- Duration: <30min>
- Error rate: <5%>
- Abort: <command>

## Roles
- Lead: <name> | Observer: <name> | Injector: <name> | Scribe: <name>

## Timeline (UTC)
| Time | Event |
|---|---|
| T0 | <inject command run> |
| T+30s | <first alert fired> |
| ... | ... |
| T+12m | <revert run> |

## Alerts assessment
| Alert | Fired? | On-time? | Routed correctly? | Actionable? |
|---|:--:|:--:|:--:|:--:|
| <name> | ✓ | ✗ (90s late) | ✓ | ✗ (no runbook link) |

## Surprises
- <e.g., session store had hidden dependency on cache>

## Action items
| Item | Owner | Due |
|---|---|---|
| Add runbook link to <alert> | <name> | <date> |
| Fix session-store fallback | <name> | <date> |

## Next game day
- Date: <YYYY-MM-DD>
- Failure mode: <different from this one>
```

## Verification
- Hypothesis written BEFORE injection.
- Abort command pre-written and dry-run.
- Customer-comms standby drafted.
- After-action has owners + dates on every action item.
- Next game day scheduled before this one ends.
