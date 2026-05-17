---
name: platform-as-product
description: Treat the internal developer platform as a product with developer-customers — PRDs for platform features, SLOs/SLAs on platform APIs, adoption metrics, opt-in vs mandate, NPS surveys, roadmap. Outputs platform product charter + PRD template + adoption-metric set to `docs/inception/platform-as-product-<platform>.md`. Reads `/project-classify` to skip XS. Use when user says "platform as a product", "internal platform", "developer-as-customer", "platform PRD", "platform NPS", "/platform-as-product", or before staffing a platform team. Pairs with `/platform-team-charter`, `/golden-path-design`, `/internal-dev-portal-spec`.
output_size:
  XS: skip
  S: 1h
  M: 2h
  L: 3h
  XL: 4h
---

# /platform-as-product — Internal Platform as a Product

Why you'd care: Team Topologies (Skelton & Pais 2019) and Thoughtworks' platform-engineering practice both converged on the same finding — internal platforms that ship as "shared infra by mandate" lose to platforms that ship as products with willing developer-customers. Mandated platforms become bottlenecks, hated tax-collectors, and graveyards of half-built abstractions. Productized platforms (Spotify Backstage, Netflix Paved Path, Stripe Compute) earn adoption by being better than the alternative — measured, marketed, supported, and evolved like any other product. The wrong model wastes 2-5 engineering years and breeds anti-platform sentiment that lingers for half a decade.

## Why you'd care

An internal platform built without a product mindset becomes the org's most-resented dependency — mandated, unfunded, and one bus-factor away from collapse. Treating developers as customers is what keeps adoption voluntary and roadmaps honest.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS → SKIP.
2. Confirm scope — what is the *platform*? CI/CD, internal IaC, service scaffolding, observability stack, secrets/identity, ML platform, data platform, all of the above. Each warrants a separate product.
3. Confirm developer-customer count and shape (how many teams, what stages, what tech stacks).
4. Confirm executive sponsor and budget posture — platform-as-product needs persistent funding, not project-mode funding.

## Inputs
- Current platform surface area (services, libraries, runbooks, CI templates).
- Developer-customer cohort size + segmentation (junior vs senior, tier-1 vs experimental services).
- Existing pain signals — survey results, support-channel transcript, escalation log.
- Competing internal alternatives (the "shadow platforms" each team builds).
- Funding model — is the platform team chartered to be cost-recovered, free-at-point-of-use, or chargeback?

## Process

1. **Define the developer-customer** — concrete personas, not "developers". Examples:

   | Persona | What they want | What they tolerate |
   |---|---|---|
   | New-hire SWE | Onboarding in <1 week, "how do I deploy" answered in docs | Cookbook examples, opinionated defaults |
   | Senior SWE on tier-1 service | Stability, debuggability, perf control, ability to override | Some boilerplate; rejects opaque magic |
   | Staff/principal architect | Roadmap visibility, ability to influence direction | Long feedback loops if heard |
   | Data scientist | Notebook → prod in hours, not weeks | Limited config knobs |
   | SRE | Self-serve incident tooling, deep observability | Strict SLOs on platform components |

   For each persona, write down: top-3 jobs-to-be-done, time-to-value (TTV) target, current TTV baseline, gap.

2. **Adopt product practices for the platform team** — explicitly. The full kit:
   - **PRDs** for every platform feature ≥1 sprint. Template below.
   - **Product manager** role on the team (or rotating engineer-PM if too small to staff).
   - **Roadmap** — public to the developer-org, updated monthly, themes + bets.
   - **Release notes** — weekly or fortnightly, customer-facing, "what changed for you".
   - **Office hours** — weekly slot, developers walk in with questions.
   - **NPS / satisfaction survey** — quarterly, ≥5 questions, segmented by persona. Targets: NPS ≥30 to claim product-market-fit with your internal customers; ≥50 is exceptional.
   - **Win-loss** — when a team builds a shadow platform instead of using yours, treat it like a competitive loss; do a postmortem.
   - **Office of "no"** — say no to features that don't fit; PRDs with "Considered but not building" sections.

3. **PRD template for platform features**:

   ```markdown
   # PRD: <feature>
   ## Problem (developer-customer voice)
   <"As an X engineer building Y, I struggle with Z because…">
   ## Target persona(s)
   ## Current workaround / shadow-platform that this displaces
   ## Success metrics
   - Adoption: <N% of tier-1 services within 6 months>
   - Time-to-value: <from X hours to Y hours>
   - Quality: <reduced P1 from N/quarter to M/quarter>
   - NPS impact: <delta on next survey>
   ## Anti-goals
   <what this is explicitly NOT>
   ## Solution sketch
   ## Non-functional requirements (platform NFRs are stricter — platform is at the bottom of the stack)
   ## Rollout plan
   - Alpha (1-3 design partners)
   - Beta (10% of services, opt-in)
   - GA (paved road)
   - Sunset of displaced alternative
   ## Risk register
   ```

4. **SLOs on platform APIs** — the platform is at the bottom of the stack; its SLOs cap everyone above it. Define:

   | Platform component | SLI | SLO target | Burn-rate alerts | Implication if breached |
   |---|---|---|---|---|
   | CI pipeline (build → green) | P95 build time | <15 min | 2x for 1h, 14x for 5m | Block roadmap until met |
   | Service-scaffold (`new-svc`) | success rate of `new-svc` in 1 cmd | ≥99% | n/a | Bug bash + post-mortem |
   | Internal API gateway | uptime | ≥99.95% (≤22 min/mo down) | std | Caps every consumer at 99.9% |
   | Secrets API | P99 latency | <50 ms | std | Affects boot time of all services |
   | Observability ingest | data freshness | <60s end-to-end | std | Incidents go dark beyond freshness |
   | IaC apply | apply-to-effective | <10 min P95 | n/a | Block roadmap |

   Publish externally to developer-customers. Cross-link `/slo-define` for the methodology.

5. **Adoption metrics — the platform-product KPIs**:
   - **Paved-road adoption rate** — % of services on the supported golden path (target: ≥70% within 2 years; Spotify reports ~80%).
   - **Time-to-value** — minutes from "new dev opens IDE" to "service deployed to staging" (target: <2 hours; world-class <30 min).
   - **Self-service ratio** — % of platform interactions completed without filing a ticket to the platform team (target: ≥90%).
   - **Platform NPS** — quarterly survey of developer-customers (target: ≥30, exceptional ≥50).
   - **Cognitive-load score** — Team Topologies survey on intrinsic/extraneous/germane cognitive load (lower extraneous = better).
   - **Shadow-platform count** — number of teams building parallel infra (target: trending toward zero).
   - **Mean-time-to-onboard new-hire** to first-prod-deploy (target: <2 weeks).
   - **Platform cost / engineer served** — for chargeback or just internal sanity.

6. **Opt-in vs mandate model** — three postures, pick deliberately:
   - **Pull (paved road)**: platform is the easiest path; developers can deviate but pay the cost. Best for healthy cultures. Adoption via experience > policy.
   - **Push (mandated)**: governance/security/compliance line forces use. Use sparingly — only for things where deviation is truly unacceptable (auth, identity, audit logging, secret storage).
   - **Hybrid**: pull for productivity features; push for security/compliance primitives. Most large orgs land here.
   The mandate dose matters: if you mandate >20% of platform surface, NPS collapses; if <5%, security/compliance suffers.

7. **Funding model decisions**:
   - **Central-cost-center** — platform is a corp expense, free at point of use. Simplest; hides cost from consumers; risks "tragedy of the commons".
   - **Showback** — consumers see attributed cost, no chargeback. Influences behavior without budget pain.
   - **Chargeback** — consumers pay from their budgets. Forces ROI; risks death-spiral if pricing is wrong.
   - **Hybrid** — base platform free; premium add-ons (e.g. high-availability tier, premium observability retention) charged back.
   Pick once, document, revisit annually.

8. **Roadmap themes — 3-5 bets per year, not a feature backlog**. Example themes:
   - "Cut time-to-first-deploy by 75%"
   - "Eliminate the top 5 reasons developers escalate to platform Slack"
   - "Make our golden-path observable end-to-end without code changes"
   - "Cost transparency for every workload"
   - "Self-serve secrets for new services in <60s"
   Themes drive PRDs; PRDs drive sprints. Avoid promising granular features — features ship in service of themes, and developers can see the theme behind every shipped change.

9. **Developer-customer feedback loops** — 4 channels with different latency:

   | Channel | Latency | Use for |
   |---|---|---|
   | Support Slack/Discord | minutes | Acute help, surface trending pains |
   | Office hours | weekly | Open-ended consults, roadmap input |
   | Quarterly NPS survey | quarterly | Trend, persona-segmented satisfaction |
   | Annual platform review | yearly | Strategic direction, budget cycle |

   Triangulate — Slack volume is noisy, NPS is laggy; combine to spot signal.

10. **Marketing the platform internally** — yes, market. Tactics:
    - Internal blog / changelog with "tips & tricks" weekly post.
    - Internal demos at all-hands.
    - "Platform-team-week" recognition badges or shoutouts for first 100 adopters.
    - Champion program — every team has a designated "platform liaison" who gets early access in exchange for feedback.
    - Tech-radar entry: "platform-X is in ADOPT".

11. **Sunset of legacy alternatives** — paved roads work only if cobblestone paths die. For every platform feature shipped, identify what it displaces and write a sunset plan:
    - Announce: "feature X replaces tools Y and Z. Y/Z sunset in 12 months."
    - Inventory current Y/Z users.
    - Migration support: codemod, office hours, hand-holding for top users.
    - Hard cutoff date in PRD; missed cutoffs erode credibility — be willing to enforce or be willing to redesign.
    Cross-link `/sunset-plan`.

12. **Anti-patterns to write into the team charter as not-allowed**:
    - "Build it and they will come" — every feature ships with adoption plan + N committed design-partners.
    - "Top-down mandate without consent" — except for security/compliance primitives.
    - "Internal-only quality bar" — internal platforms ship with the same release notes, docs, SLOs, and support response that you'd give an external customer paying $50k.
    - "We are the only abstraction" — platform must be opt-out-able; teams with extreme requirements need an escape hatch (cross-link `/golden-path-design`).
    - "Optimize for platform-team productivity, not developer-customer productivity" — measured by adoption + NPS, not feature count.

## Output

Write to `docs/inception/platform-as-product-<platform>.md`:

```markdown
# Platform-as-Product Charter — <platform name>

## Mission (one sentence)
<e.g. "Reduce cognitive load on product teams by providing a paved road from idea to prod">

## Developer-customer personas
| Persona | Jobs-to-be-done | TTV target | TTV today | Gap |
|---|---|---|---|---|
| New-hire SWE | … | … | … | … |
| Tier-1 senior SWE | … | … | … | … |
| Data scientist | … | … | … | … |

## Product practices adopted
- [x] PM (or rotating engineer-PM)
- [x] PRDs for every feature ≥1 sprint
- [x] Public roadmap (monthly refresh)
- [x] Weekly release notes
- [x] Weekly office hours
- [x] Quarterly NPS survey
- [x] Win-loss review on shadow platforms
- [x] PRD "considered but not building" section

## SLOs on platform APIs
| Component | SLI | Target | Alert | Owner |
|---|---|---|---|---|
| CI pipeline | P95 build time | <15 min | 2x/1h | … |
| Service scaffold | success rate | ≥99% | … | … |
| API gateway | uptime | 99.95% | … | … |
| Secrets API | P99 latency | <50 ms | … | … |

## Adoption KPIs (annual targets)
- Paved-road adoption: <70%+>
- Time-to-first-deploy: <2 hr>
- Self-service ratio: <90%+>
- Platform NPS: <30+>
- Shadow-platform count: <trend>

## Posture model
<pull | push | hybrid> — rationale: …

## Funding model
<cost-center | showback | chargeback | hybrid> — rationale: …

## 12-month roadmap themes
1. <Theme>
2. <Theme>
3. <Theme>

## Feedback loop matrix
- Slack: real-time
- Office hours: weekly
- NPS: quarterly
- Strategic review: annual

## Internal marketing tactics
- Weekly tips post in #platform-news
- Champion program (1 per team)
- All-hands demo slot every release
- Tech-radar entries

## Anti-patterns prohibited
- Mandate without consent (except auth/audit primitives)
- Build-and-pray
- Sunset-by-neglect (every replacement ships a written sunset plan)

## Risks
- <e.g. exec sponsor turnover; mitigation: dual sponsors + written charter>
- <e.g. chargeback misprice; mitigation: 6-mo showback before billing>
```

## Verification
- [ ] Developer-customer personas are concrete people, not "developers".
- [ ] At least three product practices (PRDs, roadmap, NPS) are adopted with explicit cadence.
- [ ] Platform components have published SLOs that bound the SLOs of upstream services.
- [ ] Adoption KPIs are set with annual targets, not vanity metrics.
- [ ] Opt-in vs mandate posture is named and the mandate surface is <20% of total.
- [ ] Every replaced legacy tool has a written sunset plan with a date.
