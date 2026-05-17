---
name: dora-metrics
description: Instrument the 4 DORA metrics — deploy frequency, lead time for changes, change failure rate, MTTR. Outputs metric definitions + dashboard spec + targets to `docs/operate/dora-<service>.md`. Reads `/project-classify` to skip XS. Use when user says "DORA", "deploy frequency", "lead time", "MTTR", "change failure rate", "/dora-metrics", or before any engineering retrospective.
output_size:
  XS: skip
  S: 1h
  M: 2h
  L: 4h
  XL: 4h
---

# /dora-metrics — Engineering Health Telemetry

## Why you'd care

Engineering retros run on vibes ("things felt slow this quarter") get derailed by whoever's loudest in the room, and the actual signal — deploys per day dropping from 12 to 3, MTTR creeping from 18 minutes to 4 hours — sits invisible until the founder asks why velocity feels off six months later. The four DORA numbers cost a sprint to instrument and convert "the team feels stuck" into a number with a trend line, which is the only thing leadership can actually act on without re-igniting the same retro argument every month.

Invoke as `/dora-metrics`. Four numbers. Backed by data. They tell you if engineering is healthy or wishful.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS → SKIP.
2. **Regulated-cadence gate** — if project is HIPAA / PCI-DSS / FedRAMP / SOC2-with-change-windows / IL2-6 / safety-critical (medical-device, FAA, automotive ISO-26262) / regulated-trading: "Elite multiple-per-day deploys" is an **anti-pattern**, not a goal. Regulated projects must respect change-control windows (often weekly/biweekly with CAB approval). Reframe the benchmark table: in those contexts, "Elite" = highest deploy rate *that still passes change-control without exception*. MTTR + change-fail-rate stay as written; deploy-freq + lead-time targets bend to regulatory cadence. Anti-pattern: gaming deploy frequency via low-control bypass.
3. Required inputs:
   - Deploy event source (CI/CD logs, deploy webhook, GitHub Actions runs)
   - Commit→deploy linkage (commit SHA tagged on artifact, env=prod label)
   - Incident source (PagerDuty / Opsgenie / incident.io / manual log)
3. Storage pick: Grafana+Prometheus, Datadog, Honeycomb, or just a Postgres table + Metabase.

## Inputs
- Service(s) in scope
- Deploy pipeline (where deploys originate)
- Incident tool

## Process

1. **Define each metric exactly** — definitions diverge wildly, lock them:

   | Metric | Definition | Unit |
   |---|---|---|
   | Deploy frequency | count of successful prod deploys per service per day | deploys/day |
   | Lead time for changes | median(deploy.timestamp − commit.timestamp) over last 30d | hours |
   | Change failure rate | (deploys causing prod incident or rollback) / total deploys, rolling 30d | % |
   | MTTR | median(incident.resolved_at − incident.created_at), rolling 30d | minutes |

2. **DORA benchmark table** — know where you sit:

   | Tier | Deploy freq | Lead time | Change fail | MTTR |
   |---|---|---|---|---|
   | Elite | multiple/day | <1h | 0–15% | <1h |
   | High | weekly–daily | 1d–1wk | 16–30% | <1d |
   | Medium | weekly–monthly | 1wk–1mo | 16–30% | 1d–1wk |
   | Low | monthly+ | 1mo+ | 16–30% | 1wk+ |

   **Regulated context override** — in HIPAA / PCI / FedRAMP / SOC2 / IL2-6 / safety-critical / trading-venue, deploy-freq and lead-time tiers re-anchor to the regulatory change-window cadence (often weekly/biweekly with CAB). "Elite" becomes "max rate inside change-control, no bypass". Change-fail and MTTR tiers unchanged.

3. **Instrumentation**:
   - **Deploy events**: emit on CD success: `{service, version, commit_sha, env, ts}` → topic/table
   - **Lead time**: join deploys with `git log` for commit timestamps
   - **Change failure**: tag incident with `caused_by_deploy_sha` field; OR auto-link if incident.created_at within 1h of deploy
   - **MTTR**: incident lifecycle timestamps (created → acknowledged → mitigated → resolved)

4. **Dashboard spec** — single page:
   - 4 big numbers (today's value vs 30d avg vs benchmark tier)
   - 4 sparklines (90d trend)
   - Per-service table if >5 services
   - Deploy-incident overlay chart (deploys as dots, incidents as bars)

5. **Targets + cadence**:
   - Set realistic 90-day target (one tier up from current)
   - Review in monthly engineering retro
   - Do NOT use as individual performance metric (Goodhart's law applies)

6. **Anti-gaming guardrails**:
   - Deploy frequency: ignore deploys with zero diff (no-op promotes)
   - Change failure: include rollbacks even when no formal incident
   - MTTR: clock starts at incident detection, not at "we agreed it's a sev"

## Output

Write `docs/operate/dora-<service>.md`:

```markdown
# DORA — <service>
**Date:** <YYYY-MM-DD> | **Class:** <S/M/L/XL> | **Current tier:** <Elite/High/Medium/Low>

## Definitions (locked)
- Deploy frequency: ...
- Lead time: ...
- Change failure rate: ...
- MTTR: ...

## Current values
| Metric | Value (30d) | Benchmark | Tier |
|---|---:|---|---|
| Deploy freq | 3.2/day | multiple/day | Elite |
| Lead time | 4h | <1d | High |
| Change fail | 22% | 0–15% | Medium |
| MTTR | 45min | <1h | Elite |

## Sources
- Deploy events: <topic/table>
- Incidents: <PagerDuty service>
- Commit linkage: <how>

## Dashboard
- URL: <link>
- Source-of-truth: <Datadog dashboard JSON path / Grafana ID>

## 90-day target
- Move Change failure rate from 22% → <15% via canary-deploy + better integration tests

## Anti-gaming
- ...
```

## Verification
- 4 metric definitions written with exact math (not "deploys often").
- Sources named per metric (not "from CI somewhere").
- Dashboard URL exists and renders all 4.
- Targets are tier-jumps, not vanity decimals.
- Used in retro cadence, not solo dashboard.
