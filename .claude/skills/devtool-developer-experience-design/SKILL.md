---
name: devtool-developer-experience-design
description: Developer experience (DX) design for devtool/API/SDK products — time-to-first-success, time-to-Hello-World, error-message quality, getting-started tutorial spec, API ergonomics. Outputs DX scorecard + improvement plan to `docs/design/dx-<product>.md`. Reads `/project-classify` to skip XS. Use when user says "developer experience", "DX", "time-to-Hello-World", "TTFHW", "getting started", "onboarding for devs", "API ergonomics", "SDK quality", "/devtool-developer-experience-design", or when devtool conversion is below 5% from sign-up to first API call.
output_size:
  XS: skip
  S: 1h
  M: 3h
  L: 6h
  XL: 8h
---

# /devtool-developer-experience-design — Developer Experience Scorecard

## Why you'd care

For devtools, developer experience IS the product. Stripe, Twilio, and Vercel didn't win with feature parity; they won by collapsing time-to-first-successful-API-call from hours to minutes. The lifetime value of a developer who succeeds within 15 minutes vs 4 hours is 8-12× higher.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS → SKIP.
2. Confirm the product surface developers actually integrate with (REST API / GraphQL / SDK in N languages / CLI / webhook / dashboard).
3. Identify the canonical "Hello World" — the smallest useful piece of work (one API call returning a real result, one CLI command producing real output, one widget rendering on a page).
4. Have an honest baseline: time how long it takes a never-before-seen developer to complete Hello World from landing-page-arrival to first 200 response. If you don't know, stage 3 user tests this week.

## Inputs
- Product surface (API endpoints, SDK languages, CLI verbs).
- Current docs URL.
- Current sign-up → API-key flow.
- Analytics on funnel: visit → sign-up → API-key issued → first request → first successful request.
- 5-10 recent support tickets from new users.

## Process

1. **Define the DX north-star metric: Time-To-First-Hello-World (TTFHW)** — wall-clock time from a logged-out developer hitting your landing page to their first 2xx response from your API. Benchmark targets by category:

   | Product category | TTFHW target (p50) | TTFHW target (p90) |
   |---|---|---|
   | Payment API (Stripe-class) | <5 min | <15 min |
   | Communication API (Twilio-class) | <8 min | <20 min |
   | Database / backend-as-a-service | <10 min | <30 min |
   | Auth (Auth0-class) | <10 min | <30 min |
   | Edge / hosting (Vercel-class) | <2 min (deploy) | <10 min |
   | AI/ML API | <5 min | <15 min |
   | Observability (Datadog/Honeycomb) | <30 min | <2h |
   | Niche/enterprise integrations | <60 min | <4h |

   Measure this with real instrumentation: timestamp landing-arrival, sign-up-complete, api-key-issued, first-request-received, first-2xx-received. Five funnel events, one chart.

2. **DX scorecard — 12 dimensions** — rate each 1-5, with 3 = baseline industry table-stakes:

   | Dimension | 1 (broken) | 3 (baseline) | 5 (best in class) |
   |---|---|---|---|
   | Landing → sign-up conversion | <2% | 5-10% | >15% |
   | Sign-up complexity | credit card + ID verification | email + verify | OAuth one-click |
   | API key issuance | manual/email | dashboard, 1 click | auto-issued on signup, test key in env var of every code sample |
   | Hello-World copy-paste-ability | none, must read 5 pages | full code block exists | dashboard pre-fills your real test key into the sample |
   | First-call error messages | "Bad Request" | named error + docs link | error msg includes the exact fix + 1-line code diff |
   | SDK install friction | manual ZIP | `npm i` / `pip install` | `npm create` scaffolder generates full app |
   | Reference docs completeness | partial endpoints | every endpoint, every field | every endpoint + every field + every error code + try-it console |
   | Sample apps / quickstarts | 1 stale GitHub repo | 3+ frameworks (Next/Rails/Django) | 10+, all kept green by CI |
   | Sandbox / test mode | only prod, charges real money | test mode with fake credentials | test mode + replayable fixtures + recorded webhook playback |
   | Webhook devloop | requires public URL | webhook forwarding CLI (Stripe-style) | webhook replay + signed-request verification helper in SDK |
   | Error observability for devs | nothing | dashboard log with last 100 requests | full request/response history + diff-mode + redaction-of-PII |
   | Versioning + deprecation | breaks silently | major version in URL | semver + 12-month sunset + automated migration codemod |

   Score = sum / 60. <30 = critical work; 30-45 = competitive; 45-55 = strong; 55-60 = best-in-class (Stripe-tier).

3. **API ergonomics rubric** — apply to each top-10 endpoint:
   - **Predictable**: same patterns repeated (every list endpoint paginates the same way; every error returns the same envelope).
   - **Consistent naming**: resources are nouns (plural), verbs are HTTP methods. `POST /customers/{id}/charges` not `POST /chargeCustomer`.
   - **Pagination**: cursor-based (Stripe-style), not offset (which breaks at scale). Both directions if practical.
   - **Idempotency**: every state-changing endpoint accepts `Idempotency-Key` header. Server stores key+response for 24h.
   - **Error envelope**: stable shape across the API: `{ error: { type, code, message, param, doc_url } }`. Stripe is the canonical reference.
   - **Field expansion**: `?expand=customer,subscription` for related-resource inlining; saves N+1 round trips.
   - **Field selection**: `?fields=id,email,created` for narrowing response. Halves payload size for chatty integrations.
   - **Soft vs hard errors**: 4xx vs 5xx distinction is rigorous; never return 200 with `{ success: false }`.
   - **List filtering**: every list endpoint accepts created.gte/lte, ascending/descending sort, limit (default 10, max 100).
   - **Webhook delivery**: signed requests (HMAC-SHA256), retries with exponential backoff (1m, 5m, 30m, 2h, 5h, 10h, 24h), idempotent receiver pattern documented.

4. **Error message quality (Honeycomb's Three-Question Rule)** — every error message must answer:
   - **What** went wrong? (e.g., "API key invalid")
   - **Why** does it think that? (e.g., "the key starts with `sk_test_` but you're calling the live endpoint")
   - **What** do I do next? (e.g., "use a `sk_live_` key from https://dashboard.example.com/keys, or call the test endpoint instead")

   Audit your top 20 most-frequent errors against this rule. Stripe error example: `"You cannot create a charge with a token that has already been used; please use a new token. The token was created at <timestamp>." + doc_url`. That's three questions answered.

5. **Getting-started tutorial spec** — the canonical first-15-minutes flow, 6 sections:
   1. **Prerequisites** (3 lines max — "Node 18+, terminal access, email to sign up"). No "first install Docker, then…"
   2. **Sign up + get key** (1 click — dashboard pre-fills test key in next step).
   3. **Install SDK** (one command, exact version pinned).
   4. **First call** (≤15-line code sample, runnable as-is, with the developer's actual test key already substituted via interactive docs).
   5. **Inspect result** (link to dashboard showing the request you just made, with request ID, payload, response, latency).
   6. **Next step** (one — don't fan out to 8 options; route them to the next most valuable single feature).

   Time-budget per section: 30s, 30s, 2m, 3m, 1m, drop-off. Total ≤7 min. Anything slower is a step to cut.

6. **Sample-app green-keeping** — devtool sample apps rot in weeks. Discipline:
   - Each canonical framework gets one Hello-World repo (Next.js, Rails, Django, Express, Go, FastAPI — pick 4-6 covering your audience).
   - Every repo is wired to your CI; nightly run installs deps and runs Hello World against your prod API.
   - Failed nightly = page DX lead before docs go stale.
   - Version-pin everything; "latest" is a banana skin.
   - README has badge for green/red status. Red = users see it; psychologically forces fix.

7. **CLI/SDK ergonomics** — the developer's IDE is your real UI:
   - **TypeScript types from OpenAPI / spec**: auto-generated, published with each release. Stripe's `stripe-node` types are the reference quality.
   - **Auto-pagination iterator**: `for await (const customer of stripe.customers.list())` not manual cursor handling.
   - **Auto-retry on idempotent ops + connection errors** with backoff, configurable.
   - **Telemetry header**: SDK sends `User-Agent: yourcorp-node/1.2.3 (node 18.17.0)`; you learn version distribution and EOL-blast-radius.
   - **Deprecation warnings**: SDK logs (at WARN level) on deprecated method call with link to migration guide.
   - **Local-first config**: SDK reads from env vars first (`YOURCORP_API_KEY`), constructor second; never hard-code anywhere.

8. **Sandbox / test mode design** — devs need to integrate without burning real resources:
   - **Separate test keys + test data**: completely isolated from prod, no shared rows.
   - **Deterministic test fixtures**: card numbers like Stripe's `4242 4242 4242 4242` for "succeed" and `4000 0000 0000 0002` for "decline" — predictable, documented.
   - **Webhook simulation**: dashboard button to fire a webhook event of any type to any URL.
   - **Time skip**: if your product has time-based behavior (subscriptions, expirations), expose a test-mode time-warp.
   - **No rate limits in sandbox**: developers iterate fast; rate-limit only in prod.

9. **Developer dashboard as a debugging surface** — top 6 features ranked by usage:
   1. **Request log**: every API call, last N days, with request/response/latency/status. Filterable. Stripe's request log is the reference.
   2. **Webhook log**: every webhook attempt, response code, retry history, replay button.
   3. **API key management**: scope-limited keys, revocation, last-used timestamp.
   4. **Sandbox toggle**: switch between test and live with no nav.
   5. **Search by ID**: paste any resource ID, jump to inspection.
   6. **Diff mode**: compare two requests side by side ("why did this charge succeed and that one decline?").

10. **Docs information architecture** — three audiences need three doc shapes:
    - **Quickstart** (audience: brand-new dev): linear, 7-minute path to Hello World.
    - **How-to guides** (audience: dev with a specific task): "How do I refund a charge?" — 30 of these, indexed.
    - **Reference** (audience: dev with a known-unknown): every endpoint, every field, every error. Try-it console embedded.
    - **Conceptual / mental-model docs** (audience: architect): "How webhooks work", "When to use SetupIntents vs PaymentIntents".

    Pattern (Diátaxis): tutorials / how-to / reference / explanation. Each lives in its own URL tree, not interleaved. Search-first: Algolia or Mintlify-style instant search is table-stakes.

11. **DX runtime monitoring** — instrument what users do, not what you wish they did:
    - First request from a new account: timestamp + endpoint + outcome.
    - First-call error rate by error code (which errors are blocking new users?).
    - Sign-up to first-2xx funnel with cohort analysis.
    - SDK version distribution (deprecation planning).
    - Doc page heatmap (where do they bounce?).
    - Support ticket tagging by surface (auth / billing / webhooks / docs / SDK) — top-tag = next DX investment.

12. **DX review cadence** — quarterly:
    - Run the 12-dimension scorecard again. Track delta.
    - Re-time TTFHW with 3 fresh users (recruit via UserTesting/UserInterviews — $50 each, 30 min each).
    - Read 50 most recent support tickets, tag, find pattern.
    - Audit error messages on top-10 endpoints against Three-Question Rule.
    - Pick 3 biggest gaps; assign to next quarter's roadmap.

## Output

Write `docs/design/dx-<product>.md`:

```markdown
# Developer Experience Design — <Product>
**Date:** | **Owner:** | **Re-review:** quarterly

## North-star metric
- TTFHW (p50): <current> → <target>
- TTFHW (p90): <current> → <target>
- Sign-up → first-2xx funnel: visit __% → signup __% → key __% → first-call __% → first-2xx __%

## DX scorecard (12 dimensions)
| Dimension | Score (1-5) | Evidence | Gap → action |
|---|---:|---|---|
| Landing → sign-up | | | |
| Sign-up complexity | | | |
| API key issuance | | | |
| Hello-World copy-paste-ability | | | |
| First-call error messages | | | |
| SDK install friction | | | |
| Reference docs completeness | | | |
| Sample apps / quickstarts | | | |
| Sandbox / test mode | | | |
| Webhook devloop | | | |
| Error observability for devs | | | |
| Versioning + deprecation | | | |
| **Total / 60** | | | |

## API ergonomics audit (top 10 endpoints)
| Endpoint | Predictable | Naming | Pagination | Idempotency | Error envelope | Score |
|---|:---:|:---:|:---:|:---:|:---:|---:|
| | | | | | | |

## Top 20 errors — Three-Question Rule audit
| Error code | What? | Why? | What next? | Pass/fail |
|---|---|---|---|---|
| | | | | |

## Getting-started tutorial (≤7 min)
1. Prereqs:
2. Sign up + get key:
3. Install SDK:
4. First call:
5. Inspect result:
6. Next step:

Total time-budgeted: ___ min. Last user-tested: <date>, n=__ users.

## Sample apps (green-keeping)
| Framework | Repo | CI status | Last passing |
|---|---|---|---|
| Next.js | | | |
| Rails | | | |
| Django | | | |
| Express | | | |
| Go | | | |
| FastAPI | | | |

## SDK ergonomics checklist (per language)
- [ ] Auto-generated types from spec
- [ ] Auto-pagination iterator
- [ ] Auto-retry with backoff
- [ ] Telemetry header
- [ ] Deprecation warnings
- [ ] Env-var config

## Sandbox / test mode
- [ ] Test keys isolated
- [ ] Deterministic test fixtures documented
- [ ] Webhook simulator in dashboard
- [ ] Time-warp (if time-based product)
- [ ] No rate limits in sandbox

## Developer dashboard surfaces
- [ ] Request log (filterable, last N days)
- [ ] Webhook log + replay
- [ ] API key mgmt (scopes, last-used)
- [ ] Sandbox toggle
- [ ] Search by ID
- [ ] Diff mode

## Docs IA (Diátaxis)
- Quickstart URL:
- How-to guides count: __
- Reference completeness (endpoints / fields / errors): __ / __ / __
- Conceptual / mental-model docs: __

## Quarterly DX review
- Last review:
- Next review:
- Top 3 gaps:
  1.
  2.
  3.

## Investment plan (next 90 days)
| Gap | Owner | Quarter | Acceptance criteria |
|---|---|---|---|
| | | | |
```

## Verification
- TTFHW p50 + p90 measured with instrumentation, not estimated.
- 12-dimension scorecard scored with concrete evidence, not vibes.
- Top 20 errors audited against Three-Question Rule; fixes prioritized.
- Sample apps in ≥4 frameworks have green CI badges.
- 3 fresh users have walked the quickstart in the last 90 days.
- Quarterly review on calendar.
