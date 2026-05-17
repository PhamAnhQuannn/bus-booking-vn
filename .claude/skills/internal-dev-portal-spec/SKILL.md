---
name: internal-dev-portal-spec
description: Spec the internal developer portal (IDP) — Backstage-style service catalog schema, ownership metadata, tech-radar, scaffolding templates (Software Templates), TechDocs, onboarding wizard, plugin shortlist. Outputs IDP spec + catalog YAML schema + plugin matrix to `docs/inception/internal-dev-portal-<platform>.md`. Reads `/project-classify` to skip XS. Use when user says "developer portal", "Backstage", "service catalog", "tech radar", "onboarding wizard", "/internal-dev-portal-spec", or before adopting an IDP. Pairs with `/platform-as-product`, `/golden-path-design`, `/platform-team-charter`.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 6h
---

# /internal-dev-portal-spec — Internal Developer Portal Specification

## Why you'd care

Without a service catalog + ownership metadata, every incident starts with 'who owns this' and every onboarding starts with 'where is the code'. The IDP turns those questions into one search box.

Why you'd care: when an org has 50+ services, the unanswered questions become "who owns this?", "what does this depend on?", "is this on the golden path?", "how do I make a new one?", "is there a runbook?". Without a central answer the platform team becomes a human catalog answering the same five questions all day. Backstage (Spotify, open-sourced 2020), Port, Cortex, OpsLevel, Roadie, and Atlassian Compass all converged on the same shape: a catalog + scorecards + templates + docs portal. Skip the IDP and you re-invent it badly in Confluence + Slack channels. Pick one and your platform-as-product (`/platform-as-product`) suddenly has a storefront.

## Pre-flight
1. Read `docs/classify/<project>.md`. If XS or S → SKIP (M+ only — IDPs pay back when fleet ≥20 services).
2. Confirm fleet size, current pain (Confluence rot? ticket volume from "who owns X"?), and platform-team capacity to operate the IDP.
3. Confirm whether you can self-host (Backstage, Roadie self-hosted) or need SaaS (Port, Cortex, OpsLevel, Atlassian Compass). Self-host = lower TCO at scale + customizability; SaaS = lower ops burden + faster start.

## Inputs
- Service count + workload mix (web services, lambdas, ML jobs, libraries).
- Existing source-of-truth for ownership (CODEOWNERS, Confluence, spreadsheet, tribal).
- Existing scaffolders + CI templates.
- Existing docs surface (Confluence, GitHub wikis, markdown in repos, Notion).
- Compliance scope (does the catalog need to feed an audit?).

## Process

1. **Pick the IDP platform** — four contenders dominate:

   | Platform | License | Hosting | Strengths | Weaknesses |
   |---|---|---|---|---|
   | **Backstage** | Apache-2.0 | self-host | huge plugin ecosystem (~150+), CNCF graduated, fully customizable, owns Software Templates pattern | requires platform-team to operate; non-trivial upgrade story; complex frontend |
   | **Roadie** | commercial | SaaS (Backstage-managed) | Backstage without ops | per-user pricing; less customization |
   | **Port** | commercial | SaaS | model-driven (build your own entity types), great UX | newer; smaller plugin set |
   | **Cortex / OpsLevel / Atlassian Compass** | commercial | SaaS | scorecards-first, good for engineering excellence programs | catalog richness varies; less template-first |

   Decision factors: fleet size (Backstage shines at 100+ services); team capacity to run the portal itself; preference for code-as-config vs UI-driven; need for offline air-gapped (Backstage only).

2. **Define the entity model** — the catalog is data-driven. Backstage's Kind/Entity model (entities.dev) is the de-facto template:

   | Kind | Purpose | Example |
   |---|---|---|
   | `Component` | A unit of software — service, library, frontend | `acme-checkout-service`, `acme-auth-sdk` |
   | `API` | An interface exposed by a Component | `acme-checkout-api-v2` |
   | `Resource` | Infra a Component depends on | `acme-orders-db`, `acme-redis-cache` |
   | `System` | Group of components delivering capability | `payments-system` |
   | `Domain` | High-level business area | `commerce`, `growth` |
   | `Group` | Team | `team-payments`, `team-platform` |
   | `User` | Person | `alice` |
   | `Location` | Where to fetch entities from | `github:acme/repo/catalog-info.yaml` |
   | `Template` | Software Template (Backstage scaffolder) | `new-fastify-service` |

3. **Required catalog metadata per Component** — minimum bar, enforced at PR-merge time via lint:

   ```yaml
   apiVersion: backstage.io/v1alpha1
   kind: Component
   metadata:
     name: acme-checkout-service
     description: <one-line>
     annotations:
       github.com/project-slug: acme/checkout-service
       backstage.io/techdocs-ref: dir:.
       pagerduty.com/service-id: P12345
       datadoghq.com/dashboard-url: https://...
     tags: [tier-1, language:typescript, path:v8]
   spec:
     type: service                # service | website | library | documentation
     lifecycle: production        # experimental | beta | production | deprecated
     owner: team-checkout
     system: commerce
     dependsOn: [resource:acme-orders-db, component:acme-auth-sdk]
     providesApis: [acme-checkout-api-v2]
     consumesApis: [acme-payments-api-v1]
   ```

   PR check (Backstage catalog-info-validator or custom) rejects merges missing required fields.

4. **Ownership rules — no service without an owner**:
   - Every Component points to a `Group` (team).
   - Every Group has a `parent` (parent team, eventually engineering).
   - Every Group has ≥2 members (single-point-of-failure prevention).
   - Vacant ownership = alert to `team-platform` for re-homing within 30 days.
   - Pair with `CODEOWNERS` so GitHub-side review enforcement matches.

5. **Software Templates (scaffolders)** — list the templates that ship with the portal day-1:

   | Template | Produces | Time-to-deployed |
   |---|---|---|
   | `new-fastify-service` | TS Fastify service, golden-path v8, CI, ArgoCD app, dashboard, runbook, on-call entry | <5 min |
   | `new-python-batch` | Python batch job on k8s CronJob | <5 min |
   | `new-nextjs-app` | Next.js frontend on Vercel/CloudFront | <5 min |
   | `new-grpc-service` | Go gRPC service with codegen | <5 min |
   | `new-terraform-module` | Reusable TF module + tests + docs | <5 min |
   | `new-airflow-dag` | Data pipeline w/ standardized SLA monitors | <5 min |
   | `add-feature-flag` | LaunchDarkly flag + code stub | <2 min |

   Templates are versioned alongside the golden path (cross-link `/golden-path-design`). Old templates marked `deprecated` and tagged.

6. **TechDocs — docs-as-code** — Backstage TechDocs pattern: each repo has `/docs/` + `mkdocs.yml`; portal builds + serves. Adoption rules:
   - Every Component must have at least: README, runbook, ADRs link, dependency map.
   - Build in CI on every merge; fail PR if `mkdocs.yml` invalid.
   - Search across all TechDocs from the portal.
   - Cross-link to Confluence ONLY for legacy; goal is migration to docs-as-code.

7. **Tech Radar — adopt/trial/assess/hold quadrants** (Thoughtworks pattern). Curated list per quadrant per ring; quarterly review. Examples:
   - **Adopt**: Fastify, OpenTelemetry, ArgoCD, Vitest, Prisma 5.
   - **Trial**: tRPC, Hono, Pulumi, Temporal.
   - **Assess**: Bun, Deno KV, htmx.
   - **Hold**: Express (replaced by Fastify), Webpack (replaced by Vite/Turbopack), Mocha (replaced by Vitest).
   The Radar in the portal is the public face of platform-team taste; new services pick from Adopt/Trial.

8. **Scorecards** — automated grades per service to drive consistent quality:

   | Scorecard | Checks | Weight |
   |---|---|---|
   | "Production-ready" | has owner, has SLO, has runbook, on golden path v≥N-1, no critical CVEs, has on-call rotation, has dashboard | mandatory for tier-0/1 |
   | "DevEx hygiene" | README quality, CHANGELOG present, CI green rate ≥95%, mean PR-to-merge <2 days | informational |
   | "Security hygiene" | SBOM published, signed images, secrets-scan clean, no `latest` tag pulls | mandatory for prod |
   | "Cost hygiene" | tagged for chargeback, auto-scaling configured, resource requests reasonable | informational |

   Surfaced as a team-level dashboard. Encourage friendly competition; don't weaponize.

9. **Onboarding wizard** — new-hire experience driven by the portal:
   - Day 1: portal account, group memberships, on-call rotation visibility.
   - Day 2-3: guided tour — find your team's services, runbooks, SLOs.
   - Day 4-5: scaffolder run-through — make a sandbox service.
   - Week 2: pair on first real PR; portal surfaces "good first issue" tagged backlog.
   Goal: time-to-first-PR <2 weeks, time-to-first-prod-deploy <1 month.

10. **Plugin shortlist for Backstage day-1** (if self-host):

    | Plugin | Purpose | Effort |
    |---|---|---|
    | `@backstage/plugin-catalog` | Core entity catalog | core |
    | `@backstage/plugin-scaffolder` | Software Templates | core |
    | `@backstage/plugin-techdocs` | Docs site per Component | medium |
    | `@backstage/plugin-tech-radar` | Tech Radar | low |
    | `@backstage/plugin-kubernetes` | k8s deployments view | medium |
    | `@backstage/plugin-pagerduty` | On-call rotations | low |
    | `@backstage/plugin-github-actions` | CI status | low |
    | `@backstage/plugin-sonarqube` / `-snyk` | Security scorecards | low |
    | `@roadiehq/backstage-plugin-datadog` (or equiv) | Dashboards inline | low |
    | `@backstage/plugin-cost-insights` | Cloud cost per service | medium |
    | `@backstage/plugin-search` | Cross-portal search | low |
    | `@backstage/plugin-soundcheck` (Spotify, commercial) or community scorecard plugin | Scorecards | medium |

11. **Operating the portal — SLOs on the portal itself**:
    - Portal uptime ≥99.5%.
    - Catalog freshness <5 min from `catalog-info.yaml` merge to portal reflection.
    - Search P95 latency <500 ms.
    - Login flow P95 <2 s.
    - Mean entity ingestion error rate <1%.
    The portal is a Tier-1 service; treat it as such. (Recursive: the portal goes in its own catalog.)

12. **Rollout plan — phased adoption**:
    - **Phase 0 (weeks 0-4)**: spin up portal, ingest existing services from `catalog-info.yaml` PRs to 10 design-partner teams. Tech Radar v1 published.
    - **Phase 1 (months 2-3)**: roll Software Templates for new services; deprecate old scaffolders. TechDocs live for design partners.
    - **Phase 2 (months 4-6)**: scorecards live; mandatory for tier-0/1; informational for others. Onboarding wizard live.
    - **Phase 3 (months 7-12)**: 80% catalog coverage; org-wide adoption metric on platform-team OKR; legacy Confluence pages redirected.
    Quarterly NPS survey to measure portal-NPS specifically (target ≥30).

## Output

Write to `docs/inception/internal-dev-portal-<platform>.md`:

```markdown
# Internal Developer Portal Spec — <platform>

## Platform choice
<Backstage | Roadie | Port | Cortex | OpsLevel | Compass> — rationale: …

## Hosting
<self-hosted on k8s | SaaS> — TCO estimate: …

## Entity model
- Kinds in use: Component, API, Resource, System, Domain, Group, User, Template, Location
- catalog-info.yaml required fields: name, description, owner, type, lifecycle, system, dependsOn, providesApis
- Required annotations: github.com/project-slug, pagerduty.com/service-id, datadoghq.com/dashboard-url, backstage.io/techdocs-ref
- PR check enforces required fields

## Ownership rules
- Every Component → Group
- Every Group ≥2 members
- Vacant ownership → 30-day re-home alert
- CODEOWNERS mirrors portal Group

## Software Templates (day-1)
| Template | Produces | TTV |
|---|---|---|
| new-fastify-service | … | <5 min |
| new-nextjs-app | … | <5 min |
| new-python-batch | … | <5 min |
| new-grpc-service | … | <5 min |
| new-terraform-module | … | <5 min |
| add-feature-flag | … | <2 min |

## TechDocs
- Every Component must have README + runbook + ADRs link
- CI builds mkdocs; fail PR on broken docs
- Goal: 100% TechDocs adoption for tier-0/1 within 6 months

## Tech Radar (initial)
- Adopt: <list>
- Trial: <list>
- Assess: <list>
- Hold: <list>
- Review cadence: quarterly

## Scorecards
| Scorecard | Checks | Mandatory for |
|---|---|---|
| Production-ready | owner, SLO, runbook, path v≥N-1, CVE-clean, on-call, dashboard | tier 0/1 |
| Security hygiene | SBOM, signed image, secrets-scan, no `latest` pulls | all prod |
| DevEx hygiene | README, CHANGELOG, CI green ≥95%, PR-to-merge <2d | informational |
| Cost hygiene | tags, autoscaling, sane requests | informational |

## Onboarding wizard targets
- Day 1: account + group memberships visible
- Week 1: scaffolder dry-run + sandbox service
- Week 2: first real PR
- Month 1: first prod deploy

## Plugin shortlist (Backstage)
- catalog (core)
- scaffolder (core)
- techdocs
- tech-radar
- kubernetes
- pagerduty
- github-actions
- sonarqube / snyk
- datadog
- cost-insights
- search
- scorecards (soundcheck or equiv)

## Portal-level SLOs
- Uptime ≥99.5%
- Catalog freshness <5 min
- Search P95 <500 ms
- Login P95 <2 s

## Rollout phases
- Phase 0 (0-4 wk): spin up + design-partner ingest
- Phase 1 (2-3 mo): templates + deprecate old scaffolders
- Phase 2 (4-6 mo): scorecards live; onboarding wizard
- Phase 3 (7-12 mo): 80% catalog coverage; portal-NPS ≥30

## Risks
- <Backstage upgrade pain; mitigation: pinned versions + 4x/year upgrade windows>
- <catalog rot from stale catalog-info.yaml; mitigation: ownership-vacancy alert>
- <scorecard weaponization; mitigation: informational rings before mandatory>
```

## Verification
- [ ] Platform choice is named with rationale tied to fleet size, ops capacity, customization needs.
- [ ] Entity model + required catalog metadata are written down and enforced via PR check.
- [ ] Software Templates list covers the workload archetypes the org actually ships.
- [ ] Tech Radar has explicit Adopt/Trial/Assess/Hold lists and a review cadence.
- [ ] Scorecards distinguish mandatory (tier-0/1, security) from informational; not weaponized.
- [ ] Portal itself has SLOs (uptime, freshness, search latency) and is in its own catalog.
- [ ] Rollout is phased with measurable per-phase exit criteria including a portal-NPS target.
