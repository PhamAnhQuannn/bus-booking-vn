---
name: sdk-versioning-policy
description: SDK/library versioning + deprecation policy — semver discipline, breaking-change definition, deprecation cadence + sunset timelines, polyglot SDK release matrix, codemods + migration guides, RFC 8594 Sunset + RFC 9745 Deprecation headers for HTTP SDKs. Outputs versioning charter + deprecation playbook to `docs/inception/sdk-versioning-<product>.md`. Reads `/project-classify` to skip XS. Use when user says "SDK versioning", "semver", "breaking change policy", "deprecation cadence", "migration guide", "polyglot SDK", "/sdk-versioning-policy", or before v1.0. Pairs with `/api-versioning` (server API) and `/devtool-distribution-channels` (publishing).
output_size:
  XS: skip
  S: 1h
  M: 2h
  L: 4h
  XL: 5h
---

# /sdk-versioning-policy — SDK Versioning + Deprecation Policy

Why you'd care: SDK versioning is a one-way door. Once `1.0.0` ships, every method signature, type export, and import path is load-bearing on someone's production code. A sloppy major bump trashes weeks of customer engineering time and burns trust permanently (Twilio's Helper Library 5→6 migration, Stripe's `2020-08-27` API pin, AWS SDK v2→v3). A *too-cautious* policy ossifies the library and forces customers onto unsupported old paths. The good middle: explicit semver rules, telegraphed deprecations, codemods for the painful changes, and a polyglot release matrix that doesn't strand users on the language you ship slowest.

## Why you'd care

Breaking-change discipline is what separates an SDK with 10k installs from an SDK with 10k angry GitHub issues. A written policy plus codemods is the contract that lets the SDK evolve without burning trust.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS → SKIP.
2. Confirm SDK languages in scope (TS/JS, Python, Go, Java, Ruby, .NET, Rust, PHP, Swift, Kotlin). Each has different stability conventions.
3. Confirm distribution channels from `/devtool-distribution-channels`.
4. Confirm whether the underlying HTTP/gRPC API has its own version policy (`/api-versioning`) — SDK version and API version are decoupled and must be reasoned about together.

## Inputs
- SDK language matrix + current versions.
- API surface stability (alpha/beta/GA) per endpoint.
- Customer-base size estimate (more customers = longer deprecation windows).
- Tier-1 customers' tolerance for breaking changes (enterprise: low; greenfield startup: high).
- Existing semver discipline (or absence thereof) — audit current changelog for accidental breaks.

## Process

1. **Adopt semver explicitly — write down what a "breaking change" means for *your* SDK**. Semver (semver.org) says MAJOR.MINOR.PATCH but it's underspecified. Pin definitions:

   | Bump | Definition (for an SDK) | Examples |
   |---|---|---|
   | **PATCH (x.y.Z)** | Backwards-compatible bug fix. No new API surface. No behavior change for correct inputs. | Fix off-by-one in pagination, fix retry-after parsing |
   | **MINOR (x.Y.0)** | Backwards-compatible feature addition. New methods, new optional parameters, new return-shape *fields* (additive only), wider input types. | Add `client.invoices.create()`, add optional `idempotencyKey` param |
   | **MAJOR (X.0.0)** | Breaking change. Any of: removed/renamed method, removed/renamed param, narrowed input type, narrowed return type (field removed), new required param, changed default value, raised min runtime version, dependency major bump that surfaces in your public types. | Rename `client.charges` → `client.payments`, drop Node 16 support |

   Special cases to spell out:
   - **Type-only breaks** (TypeScript): tightening a return type counts as MAJOR for TS consumers even if runtime behavior is unchanged.
   - **Error message text changes**: PATCH unless customers parse the string (don't make them, but accept the contract).
   - **Bundled-dependency upgrade**: MAJOR if it leaks (e.g. new peer-dep requirement), MINOR otherwise.
   - **Default-argument change**: MAJOR unless it's a bug fix.
   - **Performance regression >25%**: MAJOR (controversial but defensible — customers depend on perf).

2. **Pre-1.0 (0.x) rules** — semver allows `0.x.y` to break on MINOR. Use this freedom honestly: pre-1.0 means *expect breaking changes*, MINOR bumps may break. Stop being clever about `0.99.0`; ship `1.0.0` when the API surface is stable enough that the next 12 months are MINOR-only.

3. **Stability tiers within one SDK** — not every part of an SDK matures at the same rate. Use explicit stability markers per export:
   - `@stable` — full semver guarantees.
   - `@beta` — public but may change in MINOR; mark in JSDoc/docstring/decorator.
   - `@experimental` — may change in PATCH; require opt-in flag (`client.experimental.foo()`).
   - `@internal` — not part of the public API; in TS, suffix file with `.internal.ts` and exclude from `exports` map; in Python, prefix `_module`.
   Customers who use `@experimental` accepted instability — that's the deal.

4. **Polyglot release matrix** — when you ship N SDKs, decide your concurrency model:
   - **Lockstep** (Stripe-style): all SDKs ship the same version for the same API change at roughly the same week. Pros: customers can pin "Stripe-2024-06-20" across stack. Cons: slowest SDK gates everyone.
   - **Independent** (AWS-style): each SDK versions independently. Pros: ship fast in lead language. Cons: customers debug "why does Python SDK have it but Go doesn't?".
   - **Tiered**: TypeScript + Python are tier-1 (release within 1 week of API change); Go/Java/Ruby tier-2 (within 1 month); .NET/PHP/Swift tier-3 (within 1 quarter, or community-maintained).
   Pick one; document it; commit publicly. Mixed signals destroy trust faster than a slow release cadence.

5. **Deprecation cadence — the timeline customers can plan around** — pick a deprecation window and stick to it. Industry norms:

   | SDK profile | Typical deprecation window | Sunset notice cadence |
   |---|---|---|
   | High-churn early-stage devtool | 6 months | Release notes + runtime warning |
   | Mature B2B (Stripe, Twilio) | 12-24 months | Release notes + runtime warning + email to API users + dashboard banner |
   | Enterprise/regulated (banking, healthcare) | 24-36 months | Plus formal sunset notices to procurement contacts |
   | Long-tail open source | 12 months | Release notes + CHANGELOG only |

   Mechanics per deprecation:
   - **T-0** (deprecation announcement): mark deprecated in code (`@deprecated` JSDoc, `DeprecationWarning` in Python, `[Obsolete]` in C#), update docs with replacement, add to changelog Top.
   - **T+0 → T-3mo**: runtime warning logged once per process via SDK telemetry (off by default but on for `@deprecated` methods).
   - **T+50% of window**: increase warning severity, dashboard banner if SDK reports usage telemetry.
   - **T+window**: remove in next MAJOR; cite the removed method by name in the migration guide.

6. **Migration guide template** — every MAJOR ships with a migration guide. Required sections:
   - **TL;DR** — one paragraph of what changed and the typical migration shape.
   - **Compatibility matrix** — which API versions and runtimes are now supported / dropped.
   - **Breaking changes catalog** — table with `Old API | New API | Mechanical replacement | Codemod available?`.
   - **Codemod / automated migration** — `npx @acme/sdk-codemod@1` that rewrites usage in-place where possible. Aim for ≥70% of call sites auto-migrated. Use jscodeshift (JS/TS), libcst or RedBaron (Python), gofmt-style AST rewrites (Go).
   - **Manual migration walkthrough** — examples for the top 5 use cases.
   - **Rollback procedure** — how to pin back to last MAJOR if discovered late.
   - **Office hours / support channel** — public Discord/Slack thread, GitHub Discussion, or weekly Q&A for 4 weeks post-release.

7. **HTTP SDK ↔ API version coupling** — the SDK has its own semver; the underlying API has its own version (often date-stamped: Stripe's `2024-06-20`, GitHub's `2022-11-28`). Decide the coupling rule:
   - **Pinned mode**: SDK x.y.z pins exactly one API version. Upgrading SDK MAJOR may shift API version. (Stripe model.)
   - **Floating mode**: SDK reads API version from constructor (`new Client({ apiVersion: "2024-06-20" })`). SDK MAJOR is independent of API version.
   - **Header injection**: SDK sends `Acme-Api-Version: 2024-06-20`. Server enforces. SDK helps with type-safety per version via codegen.
   Document which mode you're in. Send `Deprecation:` (RFC 9745) and `Sunset:` (RFC 8594) headers on responses for deprecated API endpoints; SDK logs them as a warning automatically.

8. **Codegen vs hand-written matrix** — for polyglot, pick:
   - **Hand-written SDKs**: idiomatic per language, but slower polyglot velocity. Use for SDKs where DX matters most (top-2 languages).
   - **Codegen from OpenAPI/Smithy/Protobuf**: fast polyglot, but feels like a transpiled foreigner. Tools: openapi-generator, Smithy (AWS), fern.dev, Stainless, speakeasy, Kiota (Microsoft).
   - **Hybrid**: codegen low-level transport + types; hand-written ergonomic facade on top (Stripe shape).
   Pick the model + own the codegen template if you choose codegen — don't accept generator defaults; they're rarely idiomatic.

9. **CHANGELOG discipline** — Keep-A-Changelog format (keepachangelog.com). Sections: Added / Changed / Deprecated / Removed / Fixed / Security. Every release tagged with date and link to GitHub compare view. PR template requires a `CHANGELOG.md` entry as a check; missing entry blocks merge.

10. **Minimum-supported-runtime policy** — write down the rule for dropping runtime versions:
    - **Node**: support every Node LTS in maintenance + current. Drop Node N when N goes EOL (https://endoflife.date/nodejs). Minimum bump = MAJOR.
    - **Python**: support every Python in security-fix support. Drop 3.x when 3.x reaches end-of-security. Minimum bump = MAJOR (NumPy SPEC 0 / NEP 29 is a useful reference).
    - **Go**: support last 2 Go releases (matches Go team policy).
    - **Java**: LTS-only (8, 11, 17, 21) unless you have a reason.
    - **.NET**: target latest LTS + last LTS.
    - **Browsers**: state matrix (last 2 Chrome/Safari/Firefox/Edge releases; document IE/legacy stance).
    Drop in MAJOR releases only, with at least one MINOR release announcing the upcoming drop.

11. **Telemetry for deprecation visibility** — opt-in SDK telemetry (off by default; document in privacy notice) reports: SDK version, runtime version, method names called, deprecated-method hits. Enables: "75% of usage of deprecated `oldFoo()` is concentrated in 3 customers — call them before remove date". Without it you remove blind and learn about pain via P1 tickets the day after.

12. **Release governance** — who can cut a MAJOR? Pin the rule:
    - PATCH/MINOR: any maintainer can ship after green CI + changelog entry.
    - MAJOR: requires (a) RFC published 4 weeks ahead, (b) approval from SDK lead + product lead, (c) migration guide + codemod merged, (d) release-comms plan (blog, email, dashboard banner), (e) explicit GA tag on a beta release that's been in the wild ≥2 weeks.
    Pre-release shapes: `1.0.0-alpha.1`, `1.0.0-beta.1`, `1.0.0-rc.1`, `1.0.0`. npm tag: `next` for prereleases, `latest` for GA. PyPI: equivalent via PEP 440 (`1.0.0a1`, `1.0.0b1`, `1.0.0rc1`).

## Output

Write to `docs/inception/sdk-versioning-<product>.md`:

```markdown
# SDK Versioning + Deprecation Policy — <product>

## Languages in scope
- Tier 1 (lockstep within 1 wk of API change): TypeScript, Python
- Tier 2 (within 1 mo): Go, Java
- Tier 3 (within 1 qtr): Ruby, .NET, PHP

## Semver definitions
- PATCH = …
- MINOR = …
- MAJOR = …
- TS type-only breaks: <MAJOR | MINOR>
- Bundled-dep upgrade: <…>
- Default-arg change: <…>

## Stability tiers
| Marker | Meaning | Where displayed |
|---|---|---|
| `@stable` | full semver | default |
| `@beta` | may change in MINOR | JSDoc / docstring |
| `@experimental` | may change in PATCH | namespaced (`client.experimental.*`) |
| `@internal` | not public | file-suffix / underscore-prefix |

## Polyglot release model
<lockstep | independent | tiered>

## API ↔ SDK coupling mode
<pinned | floating | header-injection> — rationale: …

## Deprecation cadence
- Window: 12 months (mature B2B target)
- T-0 mechanics: `@deprecated` + changelog + runtime warning
- T+50% mechanics: warning severity up + dashboard banner
- T+100% mechanics: removed in MAJOR; migration guide cites by name

## Migration guide template lives at
`docs/sdk/migration/v<N>-to-v<N+1>.md`
- Required sections: TL;DR, compat matrix, breaking-changes catalog, codemod usage, manual walkthrough, rollback, office hours.

## Minimum-supported-runtime policy
- Node: every LTS in maintenance + current
- Python: every release in security-support window
- Go: last 2 minor releases
- Java: LTS-only (8/11/17/21)
- Browser: last 2 of Chrome/Safari/Firefox/Edge

## CHANGELOG discipline
- Keep-A-Changelog sections
- PR check enforces entry
- Linked compare URL per release

## Telemetry for deprecations
- Opt-in only; documented in privacy notice
- Captures: sdk version, runtime, method names, deprecated-method hits
- Dashboard: top 10 deprecated-method users by customer

## Release governance
- PATCH/MINOR: any maintainer
- MAJOR: RFC 4 wks ahead + 2 approvers + migration guide + codemod + comms plan
- Pre-release shapes: alpha → beta → rc → GA
- npm dist-tag: `next` (pre) / `latest` (GA)
- PyPI version style: PEP 440 (`1.0.0a1`)

## Codegen strategy
- Tier-1 hand-written + low-level transport from <openapi-generator | fern | stainless | speakeasy | smithy | kiota>
- Generator template owned in `/codegen/templates/`

## Risks
- <Tier-3 language drift; mitigation: community-maintainer SLA or downgrade tier>
- <Major-version fatigue; mitigation: bundle multiple breaking changes into single MAJOR per 12-18 months>
```

## Verification
- [ ] PATCH/MINOR/MAJOR rules are written down with concrete examples specific to *this* SDK.
- [ ] Stability tiers (`@stable`/`@beta`/`@experimental`) are enforced at the export level, not just docs.
- [ ] Polyglot release model is explicit (lockstep / independent / tiered) and tier-1 vs tier-2 SLAs match reality.
- [ ] Deprecation cadence specifies T-0, T+50%, T+100% mechanics and is calibrated to customer profile.
- [ ] Every planned MAJOR has a migration guide template, a codemod plan, and a comms plan; PR template enforces CHANGELOG entries.
- [ ] Minimum-supported-runtime drop rule is written and tied to upstream EOL calendars.
