---
name: api-versioning
description: HTTP API versioning + deprecation policy — URL vs header vs date-stamp tradeoff, breaking-change definition, dual-version window length, RFC 9745 Deprecation + RFC 8594 Sunset headers, migration guide, versioned test suites. Use when user says "API versioning", "deprecate endpoint", "v1 v2", "version cut", "/api-versioning", or when `/sandbox-env-design` / `/webhook-design-pattern` / `/sdk-versioning-policy` chains here. Pairs with `/sdk-versioning-policy` (client side).
output_size:
  XS: skip
  S: 30m
  M: 1.5h
  L: 3h
  XL: 4h
---

# /api-versioning — HTTP API Version + Deprecation Policy

## Why you'd care

Five failure modes hide inside any HTTP API shipped without a written versioning policy:

1. **No versioning at all** → first breaking change ships as a 200-OK semantic shift; downstream integrators discover it via charge-back, refund, or "why did our cron stop working" support ticket.
2. **Versioning scheme picked under pressure** → URL-path versioning chosen because it was "easy", then every microservice has its own `/v1/` prefix and the federated gateway can't route consistently across them.
3. **No breaking-change definition** → adding a required header counts as breaking on Tuesday, not breaking on Wednesday; arguments per PR.
4. **No deprecation window** → v1 shut off the same week v2 ships; enterprise customer with $400k ARR is on v1; account exec gets a Friday phone call.
5. **No sunset headers** → integrators have to read the changelog manually to learn an endpoint is dead; nobody reads changelogs; nobody migrates; cut day is a fire.

One written policy, decided before the first breaking change, encodes scheme + breaking definition + window length + deprecation/sunset-header wiring + migration-guide template. Pairs tight with `/sdk-versioning-policy` (the client half: same convergent pattern, different artifact).

Invoke as `/api-versioning`. Author before the first breaking change ships.

## When This Skill Applies

Triggers (user phrases):
- "API versioning", "deprecate endpoint", "v1 v2", "version cut", "breaking change"
- "/api-versioning"
- "Sunset header", "Deprecation header", "RFC 8594", "RFC 9745"

Auto-invoke (chained FROM):
- **`/sandbox-env-design`** — `livemode: false` events flow through the same envelope; version-per-env policy decided here.
- **`/webhook-design-pattern`** — `api_version` field in webhook envelope follows the policy this skill writes.
- **`/sdk-versioning-policy`** — SDK-major bumps often track API-major cuts; coordination doc lives here.
- Any time `/threat-model` flags deprecated-endpoint attack surface (un-retired v1 = unmonitored route).

## Pre-flight

1. **Existing API surface inventory.** List current endpoints + grouped by resource. If `docs/design/api-surface.md` missing, run `/api-surface` first.
2. **SDK coupling status.** Are there official SDKs (TypeScript, Python, Mobile)? If yes, cross-ref `/sdk-versioning-policy` — the two policies must agree on the breaking-change boundary.
3. **Customer-base tier inventory.** Hobbyist / startup / enterprise mix drives window length. Enterprise contracts may bind to specific window durations.
4. **Classify doc check.** Read `docs/classify/<project>.md`. Class **XS** → SKIP (no versioning policy needed for a single-user CLI; revisit at S+).
5. **Greenfield vs retrofit.** Greenfield = full freedom on scheme. Retrofit = current scheme is the constraint; this skill formalizes + documents existing pattern + extends with deprecation headers.

## Inputs

- **Project slug** — used in output filename.
- **Scheme preference** — `url-path | accept-header | date-stamp | query | undecided`.
- **Customer-base tier** — `hobbyist | startup | enterprise | mixed` → drives window length.
- **Deprecation-window length** — `6mo | 12mo | 24mo | 36mo` (default by tier).
- **Internal-API exception** — separate looser policy for private / admin / internal routes?
- **SDK coupling** — yes/no; if yes, coordinate with `/sdk-versioning-policy` output.

## Process

1. **Pick versioning scheme.** Tradeoff table (decide once, document):

   | Scheme | Example | Pros | Cons | Best for |
   |---|---|---|---|---|
   | URL path | `GET /v1/charges` | Visible in logs, easy to route, cacheable per version | URL is identity — `/v1/charges` ≠ `/v2/charges` even when same resource; rewrites painful | Public APIs, microservice gateways |
   | Accept header | `Accept: application/vnd.acme.v1+json` | URL = resource (one canonical), per-resource version negotiation possible | Invisible in browser, hard to test in curl one-liners | Hypermedia / RESTful purist designs |
   | Date-stamp header | `Acme-Api-Version: 2026-05-14` | Linear timeline, no v1 / v2 / v3 fights, fine-grained (per-day cuts), Stripe-proven | Customers pin a date — many distinct in-flight versions to maintain | Mature B2B (Stripe, GitHub-old) |
   | Query param | `GET /charges?version=v1` | Trivial to test in browser | Cache key collision risk, not idiomatic, looks unprofessional | Internal prototypes only |

   **Default for greenfield**: URL-path (`/v1/`) for simplicity OR date-stamp for any product with > 1 paying customer expected to bind to API versions long-term. Stripe-style date-stamp is the gold standard for fintech / payments / regulated.

   **Hybrid**: URL-path for major version (`/v1/`), date-stamp header for minor variations within a major. Avoids "v1.1, v1.2, v1.3" path proliferation.

2. **Write breaking-change definition.** No ambiguity. The contract:

   | Change | Breaking? | Examples |
   |---|---|---|
   | Add optional field to response | NO | New `livemode` field |
   | Add new optional query param | NO | New `?expand[]=customer` |
   | Add new endpoint | NO | `POST /v1/disputes/{id}/evidence` |
   | Add new event type | NO | New `charge.disputed.funds_reinstated` |
   | Add new error code | NO | New `card_declined_too_many_attempts` |
   | Make optional field required (request) | **YES** | `currency` now required on `POST /charges` |
   | Remove field from response | **YES** | Drop `customer_balance` from response |
   | Change field type (string → enum) | **YES** | `status` from string to fixed enum |
   | Change error semantics | **YES** | `404` → `403` on same condition |
   | Rename field | **YES** | `card_id` → `payment_method_id` |
   | Change pagination shape | **YES** | Offset → cursor |
   | Rename endpoint path | **YES** | `/charges` → `/payments` |
   | Add new required header (auth-scoped) | **YES** | `Idempotency-Key` now mandatory on mutations |
   | Change rate-limit response shape | **YES** | 429 body shape change |

   Additive = MINOR (no version bump). Subtractive / semantic = MAJOR (new version cut).

   Edge cases worth calling out:
   - **Tightening validation** = breaking (clients send valid data per old, now get 400).
   - **Loosening validation** = NOT breaking (clients sending valid data still valid).
   - **Bug fix that changes behavior** = breaking if customer relies on the bug. Default: cut a new version.

3. **Choose dual-version window length per customer tier.**

   | Tier | Window | Rationale |
   |---|---|---|
   | Hobbyist / free tier | 6 months | Low integration depth; one weekend to migrate |
   | Startup / Pro tier | 12 months | One annual planning cycle |
   | Enterprise | 24 months | Internal change-management cycle + SOC2 audit window |
   | Regulated (financial / health) | 24–36 months | Regulator approval pipeline + customer's customer migration |

   **Default**: 18 months for mixed-tier. Stripe = 4+ years (different beast — they support every date-stamp version ever shipped).

   Document the floor — what's the minimum window a customer can expect? Write it into Terms of Service if enterprise-binding.

4. **RFC 9745 `Deprecation:` + RFC 8594 `Sunset:` headers — exact wiring.**

   When endpoint enters deprecation window:
   ```
   HTTP/1.1 200 OK
   Deprecation: @1704067200
   Sunset: Wed, 01 Jan 2027 00:00:00 GMT
   Link: <https://api.acme.com/docs/migration/v1-to-v2>; rel="deprecation"
   Link: <https://api.acme.com/docs/migration/v1-to-v2>; rel="sunset"
   ```

   Notes:
   - `Deprecation` (RFC 9745): unix timestamp as `@<seconds>` OR IMF-fixdate. Use `@<unix-seconds>` for greenfield (less parsing ambiguity).
   - `Sunset` (RFC 8594): IMF-fixdate ONLY (RFC 7231). No unix-seconds.
   - `Link` rel="deprecation" + rel="sunset" point to human-readable migration doc.
   - Add `Warning: 299 - "Deprecated API"` for older clients that don't parse `Deprecation` header.
   - Emit on EVERY response from deprecated endpoint, not just first.

   Wire as middleware:
   ```typescript
   // express-style example
   app.use('/v1', (req, res, next) => {
     res.set('Deprecation', '@1704067200');
     res.set('Sunset', 'Wed, 01 Jan 2027 00:00:00 GMT');
     res.set('Link',
       '<https://api.acme.com/docs/migration/v1-to-v2>; rel="deprecation", ' +
       '<https://api.acme.com/docs/migration/v1-to-v2>; rel="sunset"'
     );
     res.set('Warning', '299 - "API v1 deprecated; use v2"');
     next();
   });
   ```

5. **Migration guide template.** One per major-version cut. Lives at `docs/api/migration-v<N>-to-v<N+1>.md`:

   ```markdown
   # API Migration — v1 → v2

   **Announced:** <YYYY-MM-DD>
   **Deprecation start:** <YYYY-MM-DD> (header emits from this date)
   **Sunset (v1 final):** <YYYY-MM-DD> (returns 410 Gone after this)
   **Window:** <18 months>

   ## Why
   <one paragraph — what problem v2 solves>

   ## Breaking changes
   | Endpoint | v1 | v2 | Migration |
   |---|---|---|---|
   | `POST /charges` | `card_id` field | `payment_method_id` field | Rename in your client code |
   | `GET /charges/{id}` | `customer_balance` field | (removed) | Use `GET /customers/{id}/balance` |
   | ...

   ## New endpoints
   ...

   ## Code samples (TS + Python)
   ### Before (v1)
   \`\`\`ts
   const charge = await stripe.charges.create({ card_id: 'card_...' });
   \`\`\`
   ### After (v2)
   \`\`\`ts
   const charge = await stripe.charges.create({ payment_method_id: 'pm_...' });
   \`\`\`

   ## Testing both sides
   - Sandbox endpoints support both v1 + v2 throughout window.
   - Set `X-Acme-Api-Version: v2` on test traffic.
   - Run your test suite against both versions during the migration window.

   ## Sunset (v1 cut day)
   On <YYYY-MM-DD> all v1 endpoints return `410 Gone` with `Link` pointing here.
   ```

6. **Versioned-test-suite strategy.** One suite per supported version:
   - `tests/api/v1/*.test.ts` — frozen after v1 deprecation announced, no new tests added except security
   - `tests/api/v2/*.test.ts` — primary suite, all new features
   - Run both in CI throughout the dual-version window
   - At sunset day: archive v1 suite to `tests/archived/v1-final-<YYYY-MM-DD>/`, delete from CI
   - Contract-test the v1 → v2 mapping for any endpoint that diverges (cross-ref `/contract-test`)

7. **Communication cadence.** When endpoint deprecates, integrators learn from:
   - Dashboard banner (visible on next login) — at announce + 6mo before sunset + 30d before sunset
   - Email to all integrators with API key activity in last 90d — at announce + 60d before sunset + 7d before sunset
   - Runtime header warnings (per step 4) — every request from deprecation date onward
   - Dev-docs callout — top-of-page banner on every deprecated endpoint's doc page
   - Changelog entry in `/release-notes`
   - Status-page incident on sunset day ("v1 API retired — affected: integrations not migrated; resolution: migrate to v2")

8. **Internal API exceptions.** Private / admin / internal routes get a looser policy:
   - No public deprecation window
   - Breaking change allowed at any time IF all callers within the org are migrated first (cross-ref `/coverage-map` to find callers)
   - `Deprecation` + `Sunset` headers still emitted, but window can be 1–4 weeks not months
   - Document the internal-route allow-list explicitly so external integrators (who somehow discovered the route) don't think it's public

9. **SDK-coupling decoupling note.** API version is the wire-format / endpoint version. SDK version is the client-library version. They are SEPARATE:
   - SDK MAJOR ↔ API MAJOR: when API major cuts, SDK MAJOR bumps too (default behavior of new SDK = new API version).
   - SDK can override per-call: `stripe.charges.create(params, { apiVersion: '2024-01-01' })` lets a customer pin to old API while running new SDK.
   - SDK MAJOR / MINOR cycle independent: SDK can ship breaking SDK-shape changes (parameter renaming, namespace reorg) without API change.
   - Cross-ref `/sdk-versioning-policy` for the SDK half. The two skills coordinate via this paragraph; do not duplicate.

## Output Format

Write `docs/design/api-versioning-<project>.md`:

```markdown
---
project: <project>
date: <YYYY-MM-DD>
scheme: <url-path | accept-header | date-stamp | query | hybrid>
current_version: <v1 | 2026-05-14>
supported_versions: [<list>]
deprecation_window: <6mo | 12mo | 18mo | 24mo | 36mo>
deprecation_header_format: rfc-9745
sunset_header_format: rfc-8594
internal_route_exception: <yes | no>
sdk_coupling: <yes | no>
status: <draft | approved | in-implementation | shipped>
companion_docs:
  sdk_versioning_policy: <link | n/a>
  webhook_design_pattern: <link | n/a>
  sandbox_env_design: <link | n/a>
---

# API Versioning Policy — <project>

## 1. Scheme + rationale
- Chosen: <url-path | date-stamp | etc>
- Rationale: <one paragraph — tradeoff acknowledged>
- Concrete: `<example request showing scheme>`

## 2. Breaking-change definition
[paste table from step 2]

## 3. Deprecation window
- Customer tier: <enterprise | mixed | hobbyist>
- Window: <N months>
- ToS binding: <yes | no — if yes, language reference>

## 4. Header wiring (RFC 8594 + RFC 9745)
- `Deprecation:` format: <@unix | IMF-fixdate>
- `Sunset:` format: IMF-fixdate
- `Link rel="deprecation"`: <doc URL pattern>
- `Link rel="sunset"`: <doc URL pattern>
- Middleware example: <link to repo>

## 5. Migration-guide template
- Location: `docs/api/migration-v<N>-to-v<N+1>.md`
- Per-cut deliverable owners: <Eng lead + DevRel>

## 6. Versioned-test-suite layout
- `tests/api/v1/*` — frozen at deprecation
- `tests/api/v2/*` — primary suite
- CI matrix: <both versions run on every PR throughout window>

## 7. Communication cadence
[paste table — dashboard / email / header / docs / changelog / status-page]

## 8. Internal API exception
<yes — separate allow-list at `docs/api/internal-routes.md`>
<no — public policy applies uniformly>

## 9. SDK coupling
- SDK MAJOR ↔ API MAJOR: <coupled | decoupled>
- Per-call override: <supported | not supported>
- Cross-ref: `/sdk-versioning-policy` at <link>

## Supported version matrix
| Version | Status | Deprecated | Sunset | Supported clients |
|---|---|---|---|---|
| v1 | deprecated | 2025-01-01 | 2027-01-01 | enterprise legacy |
| v2 | current | — | — | all |

## Open questions
- [ ] <e.g. version-per-resource or version-per-product?>
- [ ] <e.g. include preview/beta endpoints in versioning?>
```

## Multi-vertical worked examples

### Greenfield SaaS — scheduling-API product, 0 customers at decision time
- **Scheme**: URL-path `/v1/` (simplicity, expected mixed-tier customer base).
- **Window**: 18 months (default for unknown tier mix).
- **Breaking-change definition**: standard table; subtractive + semantic = MAJOR.
- **Headers**: `Deprecation: @<unix>` + `Sunset: <IMF>` + `Link` pointing to `docs.scheduling.app/migration/v1-to-v2`.
- **Test suite**: `tests/api/v1/` only at launch; `tests/api/v2/` created at first MAJOR cut.
- **Comms**: dashboard banner + email at announce; runtime header continuous; status-page incident on sunset day.
- **Migration cycle**: v1 → v2 not anticipated for 3+ years; this doc gets re-read then.

### Mature B2B — fintech payments API, 1200 enterprise customers, SOC2-bound
- **Scheme**: date-stamp header `Acme-Api-Version: 2026-05-14` (Stripe-pattern). URL stays canonical per resource.
- **Window**: 36 months (regulated tier + enterprise change-management).
- **Breaking-change definition**: stricter — even loosening validation requires version cut if customer's compliance suite expected validation to fail.
- **Headers**: `Deprecation` + `Sunset` per RFC; `Link` to public migration doc; `Warning: 299` for clients that don't parse `Deprecation` yet.
- **Test suite**: every date-stamp version supported has its own suite in CI matrix; oldest version drops only after sunset day.
- **Comms**: every quarterly business review touches it; account exec walks enterprise customer through migration plan.
- **Migration cycle**: 1–2 minor breaking changes per year; full MAJOR cut every 3–4 years.

### Internal-only API — admin / ops endpoints, 12 internal callers, no external integrators
- **Scheme**: URL-path `/internal/v1/` (separate from public `/v1/`).
- **Window**: 2 weeks default; can compress to 1 week with all-callers-migrated confirmation.
- **Breaking-change definition**: same table but bar to declare "breaking" is lower (acceptable — internal callers update simultaneously).
- **Headers**: still emit `Deprecation` + `Sunset` even though external integrators won't see them — log auditability + smoke-test parity.
- **Test suite**: single suite; old version archived day-of-cut.
- **Comms**: Slack channel #api-internal + Linear ticket; no email / dashboard / status-page.
- **Migration cycle**: ad-hoc; 5–8 internal cuts per year is fine.

## Boundaries

- **Not the same as `/sdk-versioning-policy`.** SDK = client library; API = wire format. Sibling skills. Coordinate via Section 9; do not duplicate.
- **Not the same as `/migration-author`.** That skill writes DB-schema migrations. API-version cut migration guide is for API clients, not DB schema.
- **Not the same as `/sunset-plan`.** Sunset = full product/feature shutdown. API-version sunset is a scope-restricted instance — endpoint goes 410 but service continues on new version. Chain TO `/sunset-plan` only if the entire API (all versions) is being shut down.
- **Does not author the migration guide content.** Provides the template + structure; content per cut is authored when the cut happens (typically by DevRel + the eng team owning the changed endpoints).
- **Does not enforce headers in middleware.** Specs the policy; implementation is a separate code task (this skill outputs the spec, dev wires the middleware).
- **Does not handle protocol-level versioning (HTTP/1.1 → HTTP/2).** Scope is application-layer API contract only.

## Re-run Behavior

- Re-run on the same project overwrites `docs/design/api-versioning-<project>.md` IF status is `draft`. If `approved` or later, write to `api-versioning-<project>-vN.md` with `supersedes:` in frontmatter.
- Adding new versions to support: append to Supported version matrix; no new file.
- Changing scheme post-launch: this is itself a breaking change to the policy. Requires explicit `supersedes:` + 12-month migration window for integrators to update their clients.
- Window-length changes mid-cycle: cannot shorten (binding to ToS); can extend.

## Auto-chain

- **Fires (downstream):**
  - `/sdk-versioning-policy` — if SDKs exist; the two skills coordinate, do not duplicate.
  - `/migration-author` — when a breaking version cut requires server-side DB or behavior migration paired with the version cut.
  - `/devdocs-gen` — publishes version matrix + migration guide to public docs.
  - `/contract-test` — locks prior-version response surface during dual-version window so accidental drift is caught in CI.
  - `/sunset-plan` — when a version's sunset date arrives and 410 cutover ships.
  - `/release-notes` — every version cut (announcement + sunset day) is a release-notes entry.
- **Reads (upstream):**
  - `/webhook-design-pattern` — webhook envelope `api_version` field follows this policy.
  - `/sandbox-env-design` — version-per-env decision (sandbox usually supports more versions than prod).
  - `/threat-model` — deprecated-endpoint attack surface; deprecated routes get same security scanning as current.
- **Pairs with:**
  - `/api-surface` — provides the endpoint inventory this skill versions.
  - `/sdk-versioning-policy` — sibling, MUST agree on breaking-change boundary.

## Verification

1. `docs/design/api-versioning-<project>.md` exists with frontmatter populated.
2. Scheme section names exactly one scheme; tradeoff section acknowledged.
3. Breaking-change definition table has both additive (NO) AND subtractive/semantic (YES) examples.
4. Window length matches customer-tier inputs (hobbyist 6mo / enterprise 24mo+ etc).
5. RFC 9745 `Deprecation` AND RFC 8594 `Sunset` header examples both present.
6. Migration-guide template referenced + path specified.
7. Versioned test-suite layout names `tests/api/v<N>/` convention.
8. Communication cadence covers all 6 channels (dashboard / email / runtime header / docs / changelog / status-page).
9. SDK-coupling section cross-refs `/sdk-versioning-policy` (or marks "no SDK" explicitly).
10. Cross-references in `## Auto-chain` resolve to existing skill files.

## Example Trigger

User: "we need to deprecate the old `/charges` endpoint with `card_id` and move customers to `/charges` with `payment_method_id` — write the versioning plan"

→ `/api-versioning` runs:
- Scheme decision (if not already chosen): URL-path `/v1/` → `/v2/` since the field rename is the breaking change
- Window: 18 months (mixed customer tier)
- Breaking-change classification: "rename field on request" = MAJOR, justifies `/v2/` cut
- Header wiring on `/v1/charges`: `Deprecation: @<announce-unix>`, `Sunset: <18mo IMF>`, `Link` to migration guide
- Migration guide stub at `docs/api/migration-v1-to-v2.md` with before/after code samples
- Versioned test suite: keep `tests/api/v1/charges.test.ts`, add `tests/api/v2/charges.test.ts`
- Comms cadence schedule: announce email + dashboard banner today, 7d-before-sunset email scheduled
- Auto-chain: `/sdk-versioning-policy` (SDKs need MAJOR bump in concert), `/contract-test` (lock v1 response shape), `/release-notes` (announce entry now + sunset entry then)
- Output: `docs/design/api-versioning-<project>.md`
