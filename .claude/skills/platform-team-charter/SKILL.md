---
name: platform-team-charter
description: One-page charter for a platform/infrastructure team. Defines scope, non-scope, intake process, sustaining-vs-build ratio target, and on-call expectations so the team and its customers share one source of truth. Use when user says "platform team charter", "team charter", "what's in scope for platform", "intake process", "platform on-call", "/platform-team-charter", or when forming a new platform/devx/infra team or resetting an existing one. Writes docs/platform/team-charter.md. Pairs upstream with /platform-as-product (product posture) and /team-topologies-fit (team type). Pairs downstream with /golden-path-design (what paths the team supports), /internal-dev-portal-spec (surface the catalog), /slo-define (platform SLOs), /raci-chart (decision rights), /oncall-health (rotation sustainability).
output_size:
  XS: 0.5h   # one-pager still ships — solo founder formalizing platform-of-one role
  S:  0.5h   # one-pager
  M:  1h     # one-pager + intake form Notion/Linear link
  L:  1h     # one-pager + intake form + RACI for top 5 decisions
  XL: 1h     # one-pager + intake form + RACI + named rotation roster
---

# /platform-team-charter — One-Page Treaty Between Platform Team and Its Customers

> **Why you'd care.** Platform teams die two ways: (1) becoming a request-shaped help desk because there's no "no" in writing, or (2) shipping infra nobody adopts because there's no intake to surface real demand. A one-page charter, signed by both the platform lead and the head of engineering, is the cheapest insurance against both failure modes. Bucket A — one page, same shape XS through XL, because the bottleneck is *clarity*, not *volume*.

## Why you'd care

Platform teams without a written charter become an infinite intake queue for every cross-cutting whim. The charter is the document the team and its customers point at when scope creep starts.

## Pre-flight

Confirm the platform team is real (or about to be), not a label retrofitted onto an ops squad. Check whether `/platform-as-product` ran — if yes, lift the persona table and SLO targets from there. Check whether `/team-topologies-fit` classified the team (Platform / Enabling / Stream-aligned / Complicated-subsystem per Skelton & Pais 2019) — Platform-team charter assumes Platform classification; if Enabling, scope shifts to time-boxed engagements not standing services. If no prior skill ran, default to a 4-6 engineer staffing assumption and Platform team type.

## Inputs

- Org chart slice showing platform team + its top 5 customer teams
- Current incident log (last 90 days) — feeds on-call expectations realism check
- Current backlog or roadmap if any — feeds sustaining-vs-build ratio anchor
- One sentence from the head of engineering: "What is platform team for?"
- Optional: prior `/platform-as-product` PRD, `/golden-path-design` matrix, `/slo-define` targets

## Process

1. **Name the team and its mission in one sentence.** Format: `<Team Name> exists to <verb> <thing> so that <customer> can <outcome>.` Example: *Foundation Platform exists to operate the paved-road runtime (Kubernetes, Argo, OTel→Datadog, CI/CD) so that product engineers can ship to prod without learning infra.* No mission-statement-by-committee adjectives. One sentence, ≤25 words. Anti-example to reject: *"a world-class, customer-obsessed platform org enabling velocity and excellence."*

2. **List in-scope responsibilities (5-8 items, concrete).** Each item is a *capability the team owns end-to-end*, not a project. Use the format `<capability>: <SLO or quality bar>`. Example items: *Paved-road runtime (K8s, Helm, ArgoCD) — 99.95% control-plane availability. CI/CD platform (GitHub Actions runners, deploy pipeline) — P95 deploy <10min. Observability stack (OTel collector, Datadog integration) — ingest freshness <60s. Secrets management (Vault + KMS) — API P99 <50ms, zero unencrypted-at-rest. Developer portal (Backstage) — 99.5% portal uptime, catalog freshness <5min. Golden-path templates (`acme new svc`) — `<5min` from `init` to running container. On-call platform tooling (PagerDuty integration, runbook templates) — best-effort.* Capabilities not listed = not platform's job.

3. **List out-of-scope responsibilities (5-10 items, concrete and named).** This is the most valuable section of the document because it's the one you'll point to when someone files a ticket. Format: `<thing requested>: <where it belongs instead>`. Examples: *Product-feature work in stream-aligned services: owning team. Business-logic database schemas: owning team (platform provides Prisma + migration tooling only). Frontend component library: design-systems team. SSO/SAML configuration for SaaS vendors: IT/security ops. Salesforce, HubSpot, billing systems: revenue-ops engineering. Customer-facing status page content: incident commander on call. Compliance evidence collection for non-platform controls: GRC team. ML training infrastructure: ML platform team (separate). One-off scripts and data migrations: requesting team.* Be specific enough that a senior IC could route a ticket without asking.

4. **Define the intake process — single front door, written, with SLA.** Pick exactly one channel. Recommended: a Linear/Jira project called `PLAT-INTAKE` with a required template (problem statement, urgency, affected teams, suggested due date, whether self-service exists). Slack `#platform-help` for *questions*, never for *work*. Office hours weekly 60min — recurring slot, walk-in. Triage SLA: every intake ticket gets a human response within **2 business days** with one of three outcomes — accepted to roadmap, accepted with workaround now, rejected with reason. Rejection categories explicitly enumerated: *(a) Out of scope — route to <team>. (b) In scope but lower priority than current commitments — re-rank next quarter. (c) Self-serviceable — see <docs link>. (d) Won't fix — incompatible with paved-road direction.*

5. **Set the sustaining-vs-build ratio target.** Industry anchor: Google SRE baseline 50/50 toil-vs-engineering; Stripe Compute reports 60/40 build/run during steady-state; Spotify Backstage team ran ~70/30 build/run in growth phase. **Default target for a steady-state platform team: 60% build / 30% sustaining / 10% on-call & incident response.** Measure quarterly via Linear/Jira labels (`build`, `sustain`, `oncall`, `interrupt`). Hard rule: if sustaining + on-call exceeds 50% for two consecutive quarters, *one of* (a) cut scope, (b) hire, or (c) invest the next quarter exclusively in toil reduction. Document this trigger in the charter — it's the team's negotiating leverage.

6. **Define on-call expectations explicitly.** Rotation size (minimum 4 engineers for sustainable, 6+ preferred — fewer triggers burnout per `/oncall-health`). Shift length (recommended: weekly handoff Mon 10am, with secondary backup). What pages and what doesn't: *page only on customer-impacting platform-component outages — ArgoCD, K8s control plane, secrets API, CI runners, OTel collector, Backstage. Do NOT page for: individual app errors (owning team's problem), Slack notifications, non-urgent intake.* Response SLA: P0 ack within 5min, P1 within 15min, P2 within 1 business hour. Compensation: explicit — comp time, on-call pay rate, or whatever the org policy is. Escalation chain named: primary → secondary → platform lead → eng VP. Quarterly fire-drill (game-day) required.

7. **Decision rights — top 5 decisions with single named accountable owner.** Format mini-RACI (Responsible, Accountable, Consulted, Informed). Examples: *Adding a new runtime to the paved road (e.g., Bun): A=Platform Lead, R=Platform team, C=affected stream-aligned tech leads, I=Eng VP. Deprecating a paved-road component (e.g., dropping Node 18): A=Platform Lead, R=Platform team, C=all stream-aligned teams using it, I=Eng VP. Changing CI runner pricing/capacity: A=Platform Lead, R=Platform team, C=Finance, I=Eng VP. Granting cluster-admin to non-platform engineer: A=Platform Lead, R=Security, C=requesting team, I=Eng VP. Sunsetting an internal service: A=service owner, R=service owner + platform, C=customers, I=Platform Lead.* No decision without a single named A.

8. **Funding and headcount commitment.** State who owns the platform budget line (typically Eng VP or CTO) and current headcount with named roles (e.g., *2 senior SWE, 1 staff SWE, 1 SRE, 1 EM*). State the *minimum viable headcount* below which scope must shrink — the charter's headcount floor. State the planning horizon for hiring (quarterly headcount review). If the team can't hire to floor, the charter explicitly says which capabilities are paused, not silently degraded.

9. **Customer commitments — what platform owes its customers.** Three commitments, three asks. *Owes:* (a) SLOs on listed capabilities, (b) 6+ months deprecation notice on paved-road components, (c) public roadmap updated quarterly. *Asks:* (a) use the intake process, not back channels, (b) keep service catalog entries current (owner + on-call link), (c) attend quarterly platform roadmap review or send a delegate. Reciprocal. Written. Signed.

10. **Metrics the charter is measured against.** Four numbers, reviewed quarterly: *Paved-road adoption % across services (target ≥70% by month 12). Platform NPS from internal customers (target ≥30 at 6mo, ≥50 mature). Sustaining + on-call as % of team time (target ≤40%). Mean time to onboard a new service onto paved road (target <2hr).* These are the *only* metrics the team commits to externally — internal team OKRs can be more detailed but charter-level metrics are the contract with the org.

11. **Anti-patterns the team explicitly will not do.** Short list, in writing, to short-circuit recurring asks. Examples: *Will not build one-off custom dashboards for individual teams (use Datadog self-service). Will not own bespoke CI workflows per repo (templates only). Will not approve break-glass access requests via DM (use audit-logged break-glass flow). Will not act as a help desk for IDE configuration (point to docs). Will not commit to roadmap items via Slack chat (intake only).* This is the section that earns the platform lead political capital because it's the one cited when saying "no."

12. **Review cadence and revision rules.** Charter reviewed every 6 months by platform lead + eng VP. Any change requires written sign-off by both. Customers notified of changes via #platform-announce + email. Charter version-controlled in repo, not in a wiki that drifts. File a PR to change it. Last-reviewed date in the document header.

## Output

Write to `docs/platform/team-charter.md`. One page. Markdown template:

```markdown
# <Team Name> Charter

**Last reviewed:** YYYY-MM-DD by <platform lead> + <eng VP>
**Next review:** YYYY-MM-DD
**Version:** vX.Y

## Mission
<One sentence, ≤25 words, format: `<Team> exists to <verb> <thing> so that <customer> can <outcome>`.>

## In Scope
| Capability | SLO / Quality Bar |
|---|---|
| Paved-road runtime (K8s, Helm, ArgoCD) | 99.95% control-plane availability |
| CI/CD platform | P95 deploy <10min |
| Observability stack | Ingest freshness <60s |
| Secrets management | API P99 <50ms |
| Developer portal | 99.5% uptime |
| Golden-path templates | <5min init→running |

## Out of Scope
| Request | Routed to |
|---|---|
| Product-feature work | Owning stream-aligned team |
| Business-logic schemas | Owning team (platform provides tooling only) |
| Frontend components | Design-systems team |
| Vendor SSO/SAML | IT/security ops |
| ML training infra | ML platform team |
| One-off scripts | Requesting team |

## Intake Process
- **Front door:** `PLAT-INTAKE` Linear project — required template
- **Questions:** `#platform-help` Slack (questions, not work)
- **Office hours:** weekly <day/time>
- **Triage SLA:** human response in 2 business days, one of: accepted / accepted-with-workaround / rejected-with-reason

## Sustaining vs Build Ratio
- **Target:** 60% build / 30% sustaining / 10% on-call & incident
- **Measurement:** Linear labels, quarterly review
- **Trigger:** If sustaining + on-call >50% for 2 consecutive quarters → (a) cut scope, (b) hire, or (c) toil-reduction quarter

## On-Call
- **Rotation:** <N> engineers, weekly shift, Mon 10am handoff
- **Pages on:** ArgoCD, K8s control plane, secrets API, CI runners, OTel collector, Backstage
- **Does NOT page on:** individual app errors, non-urgent intake
- **Response SLA:** P0 5min, P1 15min, P2 1 business hour
- **Escalation:** primary → secondary → <platform lead> → <eng VP>
- **Comp:** <org policy reference>
- **Game-day:** quarterly

## Decision Rights (Top 5)
| Decision | A | R | C | I |
|---|---|---|---|---|
| Add runtime to paved road | Platform Lead | Platform | stream-aligned tech leads | Eng VP |
| Deprecate paved-road component | Platform Lead | Platform | all consuming teams | Eng VP |
| CI capacity change | Platform Lead | Platform | Finance | Eng VP |
| Grant cluster-admin to non-platform | Platform Lead | Security | requester | Eng VP |
| Sunset internal service | Service Owner | Service Owner + Platform | customers | Platform Lead |

## Headcount & Budget
- **Owner:** <Eng VP / CTO>
- **Current:** <N senior SWE, M staff SWE, 1 SRE, 1 EM>
- **Floor:** <minimum viable — below this, paused capabilities listed>

## Reciprocal Commitments
**Platform owes customers:** SLOs above, ≥6mo deprecation notice on paved-road components, quarterly public roadmap.
**Customers owe platform:** use intake process, keep catalog entries current, attend quarterly roadmap review.

## Measured On (Charter-Level Metrics)
| Metric | Target |
|---|---|
| Paved-road adoption % | ≥70% by month 12 |
| Platform NPS | ≥30 at 6mo, ≥50 mature |
| Sustain + on-call % of team time | ≤40% |
| Mean time to onboard new service | <2hr |

## We Will Not
- Build one-off dashboards per team (use Datadog self-service)
- Own bespoke per-repo CI workflows (templates only)
- Approve break-glass via DM (audit-logged flow only)
- Act as IDE help desk (point to docs)
- Commit roadmap via Slack (intake only)

## Revision
- **Cadence:** every 6 months
- **Approval:** platform lead + eng VP
- **Notification:** `#platform-announce` + email
- **Source of truth:** this file, version-controlled

---
_Signed: <platform lead>, <eng VP>. Last modified <date>._
```

## Verification

- [ ] Mission sentence is ≤25 words and names a verb, a thing, a customer, and an outcome
- [ ] In-scope table has 5-8 capabilities each with a measurable SLO or quality bar (no vague "best-effort" except where called out)
- [ ] Out-of-scope table has 5-10 explicit routings (every common back-channel request named and re-routed)
- [ ] Intake process names a single channel with a written triage SLA in business days
- [ ] On-call rotation has named size, shift cadence, page-on list, page-NOT-on list, escalation chain, and quarterly game-day
- [ ] Charter is signed (named, dated) by both platform lead and eng VP, and has a `Next review` date set
