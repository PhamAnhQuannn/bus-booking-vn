# Scaffolding & Infrastructure

> Overview of project scaffolding, development environment, CI/CD, and deployment documentation for the BenXe bus-booking platform.

| Document | Description |
|----------|-------------|
| [SI-001](SI-001-project-scaffold/) | Toolchain baseline (§0), stack choices, monorepo structure, module architecture, multi-tenancy model, foundational architectural patterns, testing philosophy (§8), and SDLC process (§9) |
| [SI-002](SI-002-dev-environment/) | Local development setup: toolchain, database, dev server, environment variables, stub modes, Prisma workflow, seed data, known pitfalls, and Redis provider configuration |
| [SI-003](SI-003-ci-cd-pipeline/) | CI/CD pipeline stages, security gates, data leak audit, Docker build, container registry, deployment flow, migration safety, IaC, branch strategy, PR review gates, and post-deploy verification |
| [SI-004](SI-004-linting-formatting/) | ESLint configuration, module boundary enforcement, Prettier, pre-commit hooks, input validation, and API response standards |
| [SI-005](SI-005-testing-strategy/) | Test pyramid, real-database mandate, unit test mock hygiene, E2E strategy, concurrency testing, and financial math testing |
| [SI-006](SI-006-deployment-config/) | Hosting architecture, deployment contract, Docker Compose reference, cron sidecar, Nginx, SSL, NFRs, staged evolution, and provider migration |

## Reading Order

Suggested reading sequence for new team members:

1. **SI-001** -- Understand the toolchain versions (§0), stack choices, monorepo structure, architectural patterns, testing philosophy (§8), and branch/SDLC process (§9). This doc establishes context for all subsequent SI docs.
2. **SI-002** -- Set up a working local environment. Follow the prerequisite checklist, start Docker services, configure `.env.local`, run migrations and seed.
3. **SI-004** -- Learn the linting and formatting rules before writing any code. Module boundary enforcement and input validation conventions are prerequisite knowledge for passing CI.
4. **SI-005** -- Understand the testing strategy, mock hygiene rules, and concurrency testing requirements before writing tests.
5. **SI-003** -- Review the full CI/CD pipeline to understand how code moves from branch to production, including security gates and migration safety checks.
6. **SI-006** -- Study the deployment architecture when preparing for staging or production deployments, provider migration, or infrastructure changes.

## Go-Live Blockers (consolidated from SI Known Gaps)

Items below are scattered across SI-001–006 Known Gaps sections. All block Issue 094 go-live unless noted. See also `documentation/hardening/` (HD-001–005) and `documentation/go-live/` (GL-001–005) for structured gate checklists.

| Blocker | Source | Severity |
|---------|--------|----------|
| PSP payment model discrepancy — documented split-settlement vs actual central-collection | SI-001 §5.5 | Critical |
| Admin seed password hardcoded to `123456` (blocks Issue 113) | SI-002 §7.2 | Critical |
| `OperatorUser.tempPasswordPlain` dev-only column — remove or encrypt | SI-002 §7.2 | Critical |
| `superRefine` production guards incomplete — not all secrets have min-length | SI-002, SI-006 | High |
| Dependabot + `pnpm audit` not in CI | SI-003 KG-01 | High |
| HTTP security headers (OWASP set) not configured | SI-003 KG-02 | High |
| PayoutAccount bank details stored plaintext — no field encryption | SI-003 KG-03 | High |
| No secrets rotation runbook (6 JWT/HMAC secrets) | SI-003 KG-06 | High |
| Branch protection rules not configured in GitHub | SI-003 KG-04 | High |
| Post-deploy health check + rollback definition undocumented operationally | SI-003 KG-05, GL-004 | High |
| Neon PG pooler transaction mode confirmed compatible with Prisma | SI-002, SI-006 | Resolved |
| Monitoring tooling (BetterStack, Sentry) not deployed — 2-min detection target has no tooling | SI-006 §9.4, GL-002 | High |
| Hardening audits not started — 5 gates undefined (HD-001–005) | SI-003 §14.5 | High |
| Go-live gates not started — 5 gates undefined (GL-001–005) | SI-003 §14.5 | High |
| Greppable invariant CI enforcement — 11 new checks not yet in CI | SI-003 KG-14 | Medium |
| `operatorLicenseAlert` + `piiAnonymization` cron routes not implemented | SI-006 §5.2 | Medium |
| `paymentReconSweeper` not built — SePay is sole bank-transfer confirmation | SI-006 §5.2 | Medium |
| RPO/RTO undefined | SI-006, GL-003 | Medium |
| Payout `processing` stranding — no auto-recovery timeout | SI-006 §5 | Medium |
| State machine transition maps incomplete — 5/8 missing `LEGAL_*_TRANSITIONS` | SI-003 KG-17 | Medium |

## Cross-Cutting References

- Architecture Decision Records (ADRs): `documentation/architecture-decisions/ADR-001` through `ADR-020`
- Design Specifications (DS): `documentation/design-specifications/DS-001` through `DS-017`
- Domain model and state machines: `documentation/business/domain-model/`
- Rebuild plan and issue tracker: `rebuild-plan.md` (repo root)
