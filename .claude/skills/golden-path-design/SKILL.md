---
name: golden-path-design
description: Design the paved-road developer workflow — Spotify Backstage golden-path pattern, Tier-1/Tier-2/Tier-3 service classification, tiered support (gold/silver/bronze), deprecation of off-path tools, escape hatches for special cases. Outputs golden-path catalog + tier classification + opt-out policy to `docs/inception/golden-path-<platform>.md`. Reads `/project-classify` to skip XS. Use when user says "golden path", "paved road", "Backstage scaffold", "service tiers", "supported stack", "/golden-path-design", or before standardizing how new services get built. Pairs with `/platform-as-product` and `/internal-dev-portal-spec`.
output_size:
  XS: skip
  S: 1h
  M: 2h
  L: 3h
  XL: 4h
---

# /golden-path-design — Golden Path / Paved Road Developer Workflow

## Why you'd care

When every team picks its own stack, the platform team supports N service patterns and the SRE budget collapses under the variance. A paved road plus tiered support concentrates the help where it earns its keep.

Why you'd care: Spotify's "golden path" pattern (~2018), Netflix's "paved road", and Google's "well-trodden path" all converged on the same insight — when 80% of internal services follow the same opinionated stack, the platform team can invest deep in that one stack and everyone above it gets velocity, observability, security, and SRE-grade ops for free. Diverge from the path and you pay the cost of operating your own snowflake. The danger is forcing the path — without escape hatches, tier-1 services with unusual needs go renegade, and the platform team gets a reputation for being out-of-touch. The design problem: opinionated enough to deliver leverage, flexible enough that the 20% edge cases aren't enemies.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS → SKIP.
2. Confirm scope — what kind of golden path? New service scaffold, frontend app scaffold, data pipeline, ML job, batch job, lambda/function, CLI tool. One golden path per workload archetype; do not try to make one path serve all.
3. Inventory current services + workloads — how many on each de facto stack today? Where does drift exist?
4. Confirm platform-team headcount — golden path is only sustainable if the platform team can keep it green. Rule of thumb: 1 platform engineer per 20-40 developer-customers on the path.

## Inputs
- Current service inventory + tech stack distribution (e.g. 60% Node/TS, 25% Python, 10% Go, 5% other).
- SRE incidents tagged by service tier — which services *must* not drift?
- Platform team size + skill matrix.
- Existing scaffold tooling (Cookiecutter, Yeoman, Backstage Software Templates, hygen, copier).
- Compliance scope (SOC 2, HIPAA, PCI) — what *must* be on the path for audit?

## Process

1. **Define service tiers** — every workload classified into a tier on creation. Without tiers, you cannot calibrate the path's strictness:

   | Tier | Description | Examples | SLO requirement | On-call expectation | Allowed to leave path? |
   |---|---|---|---|---|---|
   | **Tier 0** | Existence-critical, outage = company-down | Auth, payments, primary DB, primary API gateway | 99.99% | 24x7 paged on-call | No — path is mandatory |
   | **Tier 1** | Revenue or experience critical | Checkout, search, primary product UI | 99.95% | 24x7 paged on-call | No — path is strongly recommended; deviations require RFC + platform sign-off |
   | **Tier 2** | Important but degradable | Admin tools, recommendation engine, secondary features | 99.9% | Business-hours paging | Yes — opt-out allowed with self-support agreement |
   | **Tier 3** | Internal-only, experimental | Cron jobs, ETL, batch analytics, internal dashboards | 99% | No paging, eventual-fix | Yes — minimal expectations |
   | **Tier 4** | Sandbox / R&D | Spikes, ML experiments, hackathon projects | none | none | n/a — off-path by default |

2. **Define the golden path per workload archetype** — concrete tech, not abstractions. Example for a typical web-services golden path:

   | Layer | Golden path choice | Rationale |
   |---|---|---|
   | Language | TypeScript on Node 22 LTS | Largest internal expertise, hireable, mature tooling |
   | Framework | Fastify 4 + tRPC for internal APIs | Type-safety end-to-end |
   | DB access | Prisma 5 with shared connection-pool helper | Migrations + types |
   | Auth | shared `@acme/auth` (OIDC client) | One library, audited |
   | Logging | OpenTelemetry → shared collector → Datadog | Single dashboard |
   | Metrics | OTel metrics → Datadog | Same |
   | Tracing | OTel traces → Datadog | Same |
   | Secrets | shared `@acme/secrets` (AWS Secrets Manager) | Audit + rotation |
   | Deploy | shared Helm chart + ArgoCD app-of-apps | One-line `acme deploy` |
   | CI | shared GitHub Actions workflow `@acme/.github/workflows/svc.yml` | DRY |
   | Tests | Vitest + supertest + Testcontainers | One pattern |
   | Lint/format | shared eslint + prettier preset | No bikeshed |
   | Container | distroless multi-stage Dockerfile (shared template) | SBOM + minimal |
   | Observability dashboard | auto-provisioned per service from name | Free dashboards |

   Each row links to a doc page in the internal dev portal.

3. **Build the "5-minute new service" experience** — the headline UX of the golden path. Target: `acme new svc <name>` produces a green-CI, deployed-to-staging, observable service in <5 minutes. Constituent parts:
   - Backstage Software Template (or alternative scaffolder) creates the repo from a template.
   - CI runs on first commit; passes.
   - ArgoCD picks up the new manifest; deploys to staging.
   - Service registers in the catalog; auto-creates dashboard, alerts, runbook stub, on-call rotation entry.
   - PR template, CODEOWNERS, README, runbook scaffolded.
   - SLO file scaffolded with default targets per tier.
   Measure this end-to-end and graph it in the platform NPS dashboard.

4. **Tiered support model — gold/silver/bronze** — explicitly describe what the platform team commits to per tier:

   | Tier support | What the platform team does | What the team must do |
   |---|---|---|
   | **Gold (on-path Tier 0/1)** | Full SRE-grade ops: auto-upgrades, security patching, library upgrades via codemods, P1 paging within 15 min, root-cause + fix | Stay on path; review codemod PRs; accept upgrade cadence |
   | **Silver (on-path Tier 2)** | Auto-patching for security; quarterly upgrade PRs; P2 paging next-business-day | Stay on path; merge upgrades within 2 weeks |
   | **Bronze (on-path Tier 3 OR opt-out Tier 1/2)** | Security advisories only; "best effort" help via office hours | Self-support; respond to security advisories within SLA |
   | **Off-path** | Security advisories only; not eligible for platform on-call | Full self-support, no platform escalation; document own runbook |

   This is the contract that makes opt-out *acceptable* — teams that leave the path know exactly what they lose, and it's their choice.

5. **Escape hatches** — every golden path needs explicit off-ramps to prevent revolt:
   - **Opt-out registration**: a `platform.yaml` in repo with `paved_road: false` + `reason: "<one paragraph>"` + `approver: <staff+>`. Listed in the dev portal so the platform team knows.
   - **Partial opt-out**: `paved_road: partial; deviations: [database, deploy]`. Each deviation listed with rationale.
   - **Migration path back**: every off-path team has a documented path to rejoin; platform team offers help on request.
   - **No-shame norms**: opt-out is not a failure; it's a flag for the platform team that the path is missing an option.

6. **Deprecation of off-path tools** — pair the path with retiring the cobblestone:
   - Inventory current alternatives to each golden-path layer (every database type in production, every CI system, every secrets tool).
   - For each, set: sunset date, migration helper offered, last-supported version.
   - Communicate via release notes, dev portal banners, email, and 1:1 outreach for high-impact teams.
   - Enforce hard cutoffs only after migration help is real and tested. Soft mandates that never harden are worse than honest "we'd prefer X, but we'll keep maintaining Y for 2 years".
   Cross-link `/sunset-plan`.

7. **Living golden path — versioning the path itself** — pin the path to a version (e.g. `golden-path-2026Q2`) so that:
   - Services scaffolded last year are not held to today's path overnight.
   - Path changes are versioned with migration guides (e.g. "Path v8 → v9: Fastify 4 → 5; codemod available").
   - The platform team's roadmap includes "advance N% of on-path services from v8 to v9 this quarter".
   - Auto-PR bots open upgrade PRs against on-path services to keep them current; merge SLA is part of the gold/silver tier contract.

8. **Path-level NFRs** — the golden path itself has non-functional requirements:
   - **Time-to-first-deploy**: <30 min for a new service.
   - **Time-to-upgrade**: <1 day across the fleet for a security patch (auto-PR + merge).
   - **Path-availability**: scaffolder + CI templates green ≥99.9%.
   - **Path-coverage**: ≥70% of tier-0/1 services on the latest path version within 6 months of release.
   - **Path-cost-of-leaving**: documented per layer (e.g. "leaving observability path costs ~2 SWE-weeks/year to maintain own dashboards").

9. **Tier promotion / demotion process** — services migrate tiers as their importance changes:
   - Promotion (T2 → T1): triggered by incident impact, revenue dependency, or executive request. Requires: SLO upgrade, on-call rotation, path-adherence audit.
   - Demotion (T1 → T2): possible but rare; usually only on sunset.
   - Annual review per service to confirm tier still matches reality.

10. **Catalog & ownership** — every service in the dev portal has:
    - Owner team + secondary owner (single-owner risk).
    - Tier classification.
    - Path-version pin (or off-path reason).
    - SLO file location.
    - Runbook location.
    - On-call rotation link.
    - Dependencies (what it consumes; what consumes it).
    - Compliance flags (SOX-bound? HIPAA-bound? PCI-bound?).
    Cross-link `/internal-dev-portal-spec` for the catalog schema.

11. **Anti-patterns to write into the path charter as forbidden**:
    - "Path by mandate without compelling DX" — if the path is harder than rolling your own, it dies.
    - "One path for everything" — separate paths per workload archetype.
    - "Path that lags upstream by years" — set explicit upgrade cadence and fund it.
    - "No off-ramp" — every path has documented opt-out.
    - "Opaque magic" — every layer must be open-able: developers can read the source, override defaults, and debug.

12. **Measure the path's value monthly**:
    - On-path service count by tier.
    - Off-path service count, with reasons aggregated.
    - Time-to-first-deploy (median, P90).
    - Time-to-merge-upgrade (median, P90).
    - Mean time to fix path-level CVE across fleet.
    - Survey: "would I voluntarily start a new service on the path? (1-5)".
    Surface in monthly platform-team report.

## Output

Write to `docs/inception/golden-path-<platform>.md`:

```markdown
# Golden Path — <workload archetype> — <platform>

## Service tiers
| Tier | Description | SLO | On-call | Path-required? |
|---|---|---|---|---|
| 0 | … | 99.99% | 24x7 | mandatory |
| 1 | … | 99.95% | 24x7 | strongly recommended |
| 2 | … | 99.9% | biz-hrs | optional |
| 3 | … | 99% | no | optional |

## Golden path v<version>
| Layer | Choice | Doc link | Override allowed? |
|---|---|---|---|
| Language | TS/Node 22 | … | tier 2/3 only |
| Framework | Fastify + tRPC | … | … |
| … | … | … | … |

## 5-min new-service UX target
- `acme new svc <name>` → green CI → deployed to staging in <5 min
- Auto-provisioned: dashboard, alerts, runbook stub, on-call entry, SLO file

## Tiered support contract
| Tier support | Platform delivers | Team owes |
|---|---|---|
| Gold | full SRE, codemod upgrades, 15-min P1 | accept upgrades, review codemods |
| Silver | security patches, quarterly upgrades | merge upgrades <2 wks |
| Bronze | advisories only | self-support |
| Off-path | advisories only | full self-support, no escalation |

## Escape hatches
- `platform.yaml` `paved_road: false` + reason + staff approver
- Partial opt-out per layer
- No-shame norm

## Deprecation of off-path alternatives
| Legacy tool | Replaced by | Sunset date | Migration helper |
|---|---|---|---|
| <Express monolith template> | <Fastify scaffold> | <date> | <codemod> |
| <ad-hoc Datadog dashboards> | <auto-provisioned> | <date> | <CLI> |

## Path version + roadmap
- Current: `golden-path-<YYYY-Q>`
- v→v+1 migration cadence: <every 6 months>
- Auto-PR bot: enabled; merge SLA per tier

## Path NFRs
- Time-to-first-deploy: <30 min>
- Path scaffolder uptime: <99.9%>
- Coverage tier-0/1: <70%+>
- Time-to-fleet-patch: <1 day for security>

## Catalog requirements per service
- Owner + secondary owner
- Tier
- Path version pin (or off-path reason)
- SLO file path
- Runbook path
- On-call rotation
- Dependencies (in/out)
- Compliance flags

## Anti-patterns prohibited
- Mandate without DX advantage
- One path for all workloads
- Path that lags upstream
- No off-ramp
- Opaque magic

## Metrics dashboard (monthly)
- On-path count by tier
- Off-path count by reason
- Time-to-first-deploy
- Time-to-merge-upgrade
- Voluntary-adoption survey score

## Risks
- <e.g. platform team understaffed for fleet size; mitigation: tier reduction or auto-upgrade investment>
```

## Verification
- [ ] Service tiers (T0-T4) are defined with concrete SLO and on-call expectations.
- [ ] Golden path enumerates *named* tech per layer, not abstractions; each layer has an "override allowed?" answer.
- [ ] Tiered-support contract (gold/silver/bronze/off-path) makes the trade-off of opt-out concrete and non-shameful.
- [ ] Escape-hatch mechanism (opt-out + partial-opt-out + path-back) is documented.
- [ ] Path is versioned; auto-PR upgrade cadence is committed with merge SLA per tier.
- [ ] Path NFRs (time-to-first-deploy, time-to-fleet-patch, adoption %) are measured monthly.
