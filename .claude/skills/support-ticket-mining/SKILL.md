---
name: support-ticket-mining
description: Mine existing-product support tickets/CRM/feedback for adjacent problems worth productizing — feature-request gold. Outputs to `docs/inception/ticket-mining-<project>.md`. Reads `/project-classify` to skip XS/S. Use when user says "ticket mining", "support data", "feature requests", "/support-ticket-mining", or when adjacent to existing product.
output_size:
  XS: skip
  S: skip
  M: 1h
  L: 2h
  XL: 4h
---

# /support-ticket-mining — Mine Existing Tickets

Invoke as `/support-ticket-mining`. For founders adjacent to existing product/job. Pre-built signal.

## Why you'd care

Support tickets are unfiltered customer voice that already paid you the cost of acquisition. Mining them for adjacent productizable problems is the highest signal-to-noise input for your roadmap.

## Pre-flight
1. Read `docs/classify/<project>.md` — XS/S → SKIP.
2. Confirm access to ticket source (helpdesk export, CRM, internal Slack, etc.).

## Inputs
- Ticket source (Zendesk/Intercom/Linear/Jira/Gmail/Slack channel).
- Date range (≥6 mo recommended).
- Filter (open + closed; ignore bugs, focus requests + workarounds).

## Process
1. **Pull tickets** — export to CSV/JSON.
2. **Cluster** — by topic/keyword (manual or LLM-assisted).
3. **Per cluster** — count, severity, $ impact if known, requesting personas.
4. **Rank** — frequency × severity × $ impact.
5. **Top 10 clusters** — could each be a product / wedge?

## Output
Write `docs/inception/ticket-mining-<project>.md`:

```markdown
# Ticket Mining — <project>
**Date:** <YYYY-MM-DD> | **Source:** <X> | **Range:** YYYY-MM to YYYY-MM | **Total:** N tickets

## Top 10 clusters
| # | Cluster | Count | Severity | $ impact | Persona | Wedge potential |
|--:|---|--:|---|---:|---|---|
| 1 | "Can't bulk-export" | 47 | HIGH | $20k churn | Ops mgr | YES — standalone exporter |
| 2 | ... | | | | | |

## Verbatim quotes per top cluster
### Cluster 1: <name>
- "I literally export to CSV by hand every Friday" — ticket #1234
- ...

## Wedge candidates (top 3)
1. <cluster> — why it could be standalone
2. ...

## Verdict
**ADJACENT-WEDGE-FOUND / NO-WEDGE / KILL**

## Next
- WEDGE-FOUND → /jtbd on cluster #1
- NO-WEDGE → look elsewhere
```

## Verification
- ≥6 mo of tickets (seasonal noise else).
- Clusters de-duped (don't count "export" + "download" as 2).
- $ impact estimated for top 3 (or marked "unknown").
