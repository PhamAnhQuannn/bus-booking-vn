---
name: post-mortem
description: Author the post-incident review — blameless timeline, contributing factors, 5-whys root cause, action items with owners and due dates, what-went-well. Full variant for customer-visible / SEV1-2; lite one-paragraph variant for internal experiments and inconclusive A/B tests. Use when user says "post-mortem", "postmortem", "incident review", "RCA", "root cause analysis", "what did we learn", "/post-mortem", or when `/rollback-plan` / `/feature-flag-rollout` / `/blue-green-deploy` / `/ab-test-design` / `/incident-commander-runbook` chains here.
output_size:
  XS: skip
  S: 30m
  M: 2h
  L: 4h
  XL: 4h
---

# /post-mortem — blameless incident review with action items that actually ship

## Why you'd care

Three failure modes hide inside any incident without a written post-mortem:

- **No review at all** = the same outage happens twice in eight months. The first time nobody wrote down what they learned; the second time nobody on the team had been there for the first one.
- **Review exists but assigns blame** = the engineer who pushed the bad migration writes the doc, hedges every sentence, and the action items are five "be more careful" bullets nobody owns. Nothing changes.
- **Action items without owners or dates** = the post-mortem lists "improve monitoring" and "add a runbook" and "rotate secrets quarterly". Three months later the same incident recurs and the action items are still in the doc, unowned, undone.

One blameless doc, written within 5 business days, with action items that have owners and due dates and a tracking ticket, closes the loop. The doc is read by the next on-call before they take the rotation. Recurrence drops; institutional memory compounds.

Invoke as `/post-mortem`. Write it within the SLA, not "when there's time".

## When This Skill Applies

Triggers (user phrases):
- "post-mortem", "postmortem", "incident review", "RCA", "root cause analysis"
- "what did we learn", "write up the incident", "/post-mortem"
- "learnings doc", "5-whys for this", "blameless review"

Auto-invoke:
- **From `/rollback-plan`** — after rollback execution if customer-visible OR SEV1/2 (full variant).
- **From `/feature-flag-rollout`** — after kill-switch fires if customer-visible (full variant); internal-only kills get lite variant.
- **From `/blue-green-deploy`** — after flip-back fires; logs already snapshotted from green stack feed the timeline.
- **From `/ab-test-design`** — ship-control or inconclusive result → lite variant (one-paragraph learning, appended to `docs/experiments/learnings.md`).
- **From `/incident-commander-runbook`** — IC schedules within 5 business days for every SEV1/2.

## Variants

| Variant | When | Output | SLA |
|---|---|---|---:|
| **Full** | SEV1/2, customer-visible, or repeat pattern | `docs/operate/post-mortem-<slug>.md` | 5 business days |
| **Lite** | Internal experiment, inconclusive A/B, SEV3-no-customer-impact | append to `docs/experiments/learnings.md` or `docs/incidents/learnings.md` | 2 business days |

Pick by impact, not by drama. A SEV3 that exposes a class-of-failure (e.g. "this is the third time a Phase 3 migration broke read-replicas") earns a full variant even if no customer noticed.

## Pre-flight

1. **Incident closed?** No post-mortem during active firefighting. Mitigation lands first, then this skill fires.
2. **Timeline data exists?** Slack `#inc-*` channel transcript, log snapshots (from `/blue-green-deploy` green snapshot or from observability), PagerDuty ack/resolve timestamps. Missing data = the doc will be guesswork; flag it explicitly in the contributing-factors section ("could not reconstruct minute X because logs rolled").
3. **Roles assigned during incident known?** IC, Tech Lead, Comms Lead, Scribe per `/incident-commander-runbook`. The doc names roles, not people — `IC` not `Alice`.
4. **Author is NOT the person who pushed the change.** Blameless review requires someone with distance. If the only person available is the change author, surface that as a process gap in the doc.

## Inputs

- **Incident slug** — matches `/rollback-plan` slug, `docs/incidents/<date>-<slug>.md`, `#inc-*` channel name.
- **Severity** — SEV1/2/3/4 per `/incident-commander-runbook` rubric.
- **Customer impact** — surface affected, % of users, duration, $$ if known.
- **Detection path** — monitoring fired, customer report, internal user noticed, etc.
- **Mitigation lever taken** — flag kill / flip-back / image revert / DB restore / forward-fix (from `/rollback-plan`).
- **Contributing factors candidate list** — usually 3–7; the 5-whys narrows to the structural one.

## Process

1. **Build the timeline first. Facts before story.**

   Pull timestamps from monitoring, Slack, PagerDuty, deploy log. Render UTC + local. Annotate each row with role-owner (IC / TL / CL / S). No interpretation in the timeline — facts only. Interpretation goes in the next section.

   ```
   | UTC           | Local         | Event                                       | Role |
   |---------------|---------------|---------------------------------------------|------|
   | 14:02:11      | 09:02 ET      | Deploy of pricing-v2 SHA a3f8e21 starts     | —    |
   | 14:11:40      | 09:11 ET      | Synthetic monitor reports p95 +180ms        | —    |
   | 14:13:55      | 09:13 ET      | Sentry error rate alert fires (>baseline×3) | —    |
   | 14:14:22      | 09:14 ET      | Page acked, SEV2 declared                   | IC   |
   | 14:15:10      | 09:15 ET      | #inc-pricing-v2-flag opened                 | IC   |
   | 14:16:30      | 09:16 ET      | Flag kill executed: pricing-v2 → 0%         | TL   |
   | 14:21:00      | 09:21 ET      | Synthetic recovered, error rate baseline    | TL   |
   | 14:25:00      | 09:25 ET      | Status page updated: resolved               | CL   |
   ```

   **Time-to-detect (TTD), time-to-mitigate (TTM), time-to-resolve (TTR) computed from this table.** Report each as a number.

2. **Identify the root cause via 5-whys. Stop at structure, not at the person.**

   The "person made a mistake" answer is never the root cause — it's the first why. Keep asking until the answer names a system property (no tests for the condition, no automated rollback, no schema migration validation gate, etc.).

   Example:
   ```
   Why did p95 spike on pricing-v2 rollout?
     → Because the new pricing query joined a 14M-row table without an index.
   Why was there no index?
     → Because the migration didn't add one.
   Why didn't the migration add one?
     → Because the author wasn't aware the join would happen — the query was in a different PR.
   Why didn't review catch the cross-PR dependency?
     → Because review tooling shows one PR at a time, no cross-PR query plan diff.
   Why don't we have a query-plan diff gate?
     → Because no one has built one; we rely on staging traffic to surface plan regressions, and staging doesn't have prod row counts.
   ```
   Root cause: **No automated query-plan diff between PRs on shared tables; staging row-counts differ from prod by 1000×.** Structural. Actionable. Not "Alice should have known".

3. **List contributing factors.** Not the root cause — the things that made the incident worse or longer than it had to be.

   Examples:
   - "Synthetic monitor alert threshold was set 5 min after the actual breach — should be 1 min for p95."
   - "Runbook for flag kill referenced a CLI command that was deprecated 4 months ago; on-call had to look up the new one."
   - "Status page update language was unclear ('investigating elevated errors' for 18 minutes); customers paged support."

   Each contributing factor becomes a candidate action item.

4. **Write what-went-well. Not optional.**

   Every post-mortem has a what-went-well section. Skipping it skews the team's perception that incidents are pure failure narratives. Examples:

   - "TTM was 4 minutes 30 seconds — flag-kill lever from `/rollback-plan` worked exactly as drilled."
   - "IC role was clear; no debate about who was driving."
   - "Sentry alert fired before any customer report — monitoring did its job."

5. **Action items — owners, due dates, tracking tickets.** No bullets without all three.

   | # | Action | Owner | Due | Ticket | Status |
   |--:|---|---|---|---|---|
   | 1 | Build cross-PR query-plan diff CI gate for shared tables | @alice | 2026-06-15 | ENG-4421 | open |
   | 2 | Tighten synthetic monitor p95 alert window to 1 min | @bob | 2026-05-21 | OPS-1108 | open |
   | 3 | Update `/rollback-plan` doc with new flag CLI command | @carol | 2026-05-17 | DOC-882 | open |
   | 4 | Add prod-row-count seed to staging weekly | @alice | 2026-07-01 | ENG-4422 | open |

   Each action item:
   - Has exactly one owner (a person, not a team — teams don't ship; people do).
   - Has a due date (no "TBD", no "eventually").
   - Has a ticket link (the doc is not the tracking surface — the ticket is).
   - Is small enough to ship by the due date OR is broken into sub-tickets.

   "Improve monitoring" is not an action item. "Tighten synthetic p95 alert window from 5min to 1min, owner @bob, due 2026-05-21, OPS-1108" is.

6. **Blameless language enforcement.** The doc never names a person as a cause. Use roles or systems.

   - ❌ "Alice forgot to add an index."
   - ✅ "The migration shipped without an index because no review gate caught the cross-PR join dependency."

   - ❌ "On-call was slow to respond."
   - ✅ "TTD was 12 minutes; alert threshold was tuned too loose."

   The author re-reads the draft with a name-search; every name in a cause position gets rewritten.

7. **Lite variant — one paragraph, append-only.**

   For `/ab-test-design` ship-control / inconclusive, or internal-only flag kill, or SEV3-no-impact: write **one paragraph** in the rolling learnings log. No timeline, no 5-whys, no action-item table. Just:

   ```
   ### 2026-05-14 — pricing-v2 A/B inconclusive
   Ran pricing-v2 vs control for 14 days, 18k users per arm. p-value 0.34, lift +0.8% (CI −1.1% → +2.7%). Shipped control. Hypothesis: pricing-v2 mid-tier anchor wasn't differentiated enough from base tier — users couldn't tell why to upgrade. Next experiment: widen the gap, retest in Q3.
   ```

   Append to `docs/experiments/learnings.md` (for experiments) or `docs/incidents/learnings.md` (for SEV3-no-impact). One paragraph. No ceremony.

8. **Distribution.** Full variant:
   - Slack `#engineering` link the day it's published.
   - Read by next on-call before they take rotation (checklist item in `/incident-commander-runbook`).
   - Action items reviewed in weekly engineering sync until closed.
   - 90-day follow-up: did the action items actually ship? If not, the post-mortem was theater.

## Output Format

### Full variant — `docs/operate/post-mortem-<incident-slug>.md`

```markdown
# Post-mortem — <incident-slug>

**Author:** <name> (NOT the change author) | **Date:** <YYYY-MM-DD>
**Severity:** SEV<1|2|3> | **Customer-visible:** <Y/N>
**Incident channel:** `#inc-<slug>` | **Incident log:** `docs/incidents/<date>-<slug>.md`
**Rollback plan exercised:** `docs/release/rollback-plan-<slug>.md` ✓

## Summary (TL;DR — 3 sentences max)

<Surface> degraded for <duration> on <date>. <Root cause in one sentence>. Mitigated by <lever>; <#> action items tracked.

## Impact

| Metric | Value |
|---|---|
| Surface affected | <e.g. /checkout, mobile app, API v2> |
| Users affected | <#> (<%> of MAU) |
| Duration (customer-impact window) | <HH:MM> |
| Revenue impact (if known) | $<#> |
| SEV | <1|2|3> |

## Timeline (UTC + local)

| UTC | Local | Event | Role |
|---|---|---|---|
| ... | ... | ... | ... |

**TTD:** <min> · **TTM:** <min> · **TTR:** <min>

## Root cause (5-whys → structural)

<5-whys chain, 4–6 levels deep>

**Root cause:** <one sentence naming the system property, not a person>

## Contributing factors

- <Factor 1>
- <Factor 2>
- <Factor 3>

## What went well

- <Item 1>
- <Item 2>
- <Item 3>

## Action items

| # | Action | Owner | Due | Ticket | Status |
|--:|---|---|---|---|---|
| 1 | <action> | @<person> | YYYY-MM-DD | <TICKET-N> | open |
| 2 | <action> | @<person> | YYYY-MM-DD | <TICKET-N> | open |

## Detection + response

- Detection path: <monitoring fired / customer reported / internal noticed>
- Mitigation lever: <flag kill / flip-back / image revert / DB restore / forward-fix>
- Roles during incident: IC <@>, TL <@>, CL <@>, Scribe <@>
- Communication: status page <opened HH:MM, resolved HH:MM>, customer email <Y/N>

## Follow-up (90-day check)

- [ ] Action items shipped (or re-scoped with justification)
- [ ] Did the incident recur or pattern repeat?
- [ ] Update on-call handover checklist if structural lesson

## References

- `/rollback-plan` doc: `docs/release/rollback-plan-<slug>.md`
- `/incident-commander-runbook`: `docs/operate/ic-runbook.md`
- Related ADR(s): `docs/adr/NNNN-*.md`
- Prior similar incident: <link if pattern repeat>
```

### Lite variant — append entry to `docs/experiments/learnings.md` OR `docs/incidents/learnings.md`

```markdown
### YYYY-MM-DD — <one-line title>

<One paragraph: what happened, what the data said, what we decided, what the next test or guardrail is. No timeline. No action-item table. ≤ 6 sentences.>
```

## Boundaries

- **Not the same as `/incident-commander-runbook`.** IC runbook is who-does-what during the page. This skill is what-we-learned after the page closes.
- **Not the same as `/rollback-plan`.** Rollback plan is pre-written before the release. Post-mortem is written after the rollback fires.
- **Not the same as `/customer-incident-comms`.** Customer comms is external; the post-mortem is internal (or external-redacted variant for SOC2/B2B-customer trust pages).
- **Not blame.** If the draft names a person as the cause of anything, rewrite. The author re-reads with name-search before publishing.
- **Not theater.** Action items without owners + dates + tickets = no action items. The doc tracks structural change, not feelings.
- **Not optional after SEV1/2.** Every SEV1/2 gets a full post-mortem within 5 business days. No exceptions. If the team is "too busy", that is itself a contributing factor for a future post-mortem.

## Auto-chain

- **From `/rollback-plan`** — after execution if customer-visible OR SEV1/2 (full variant).
- **From `/feature-flag-rollout`** — after kill-switch fires if customer-visible (full); internal-only kill → lite.
- **From `/blue-green-deploy`** — after flip-back; consumes the green-stack log snapshot for timeline reconstruction.
- **From `/ab-test-design`** — ship-control or inconclusive result → lite variant only.
- **From `/incident-commander-runbook`** — IC schedules within 5 business days for every SEV1/2.
- **To `/risk-register`** — if the root cause names a class-of-failure not already tracked, append it as a new risk row.
- **To `/adr-writer`** — if the action items include a structural change (new gate, new tool, new platform), the resulting decision earns an ADR.

## Verification

- Doc exists within SLA: full = 5 business days from incident close; lite = 2 business days.
- Author is NOT the change author (or the doc surfaces this as a process gap).
- Timeline has UTC + local + role columns; TTD/TTM/TTR computed.
- 5-whys chain present, 4+ levels deep, ending at a system property.
- Contributing factors section present (3+ items typical).
- What-went-well section present (NOT optional).
- Action items: every row has owner + due date + ticket link. No "TBD".
- Name-search pass: no person named in a cause position.
- 90-day follow-up checkbox present and reviewed at the 90-day mark.
- Lite variant ≤ 6 sentences, appended to the right rolling log.
