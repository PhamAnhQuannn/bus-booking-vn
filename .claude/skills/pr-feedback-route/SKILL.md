---
name: pr-feedback-route
description: Read-only dispatcher for post-review remediation on a GitHub PR. Fetches inline review comments on a `CHANGES_REQUESTED` PR via `gh pr view` + `gh api .../pulls/<PR#>/reviews` + `/comments`, reconstructs unresolved threads (heuristic — last reply not by PR author), classifies each thread's body text against a remediation-skill matrix (extract, dead-code, consistency, debt, architecture, types, tests, edge-cases, lint, observability, resilience, rate-limit, SLO, deploy-safety, ops, security, privacy, audit, schema, lifecycle, ledger, nit), buckets by P1/P2/P3 severity, then writes docs/qa/pr-feedback-route-pr<PR#>-YYYYMMDD.md with ranked per-thread copyable commands. Does NOT auto-invoke, does NOT reply, does NOT resolve threads. Use when user says "address review", "respond to review", "what does the reviewer want", "/pr-feedback-route", or after a reviewer leaves CHANGES_REQUESTED comments on an open PR.
output_size:
  XS: 5m
  S: 10m
  M: 15m
  L: 20m
  XL: 30m
---

# /pr-feedback-route — Post-Review Remediation Dispatcher

## Why you'd care

A reviewer left twelve inline comments on your PR. Three are nits ("rename `x` to `count`"). Two are blocking ("this can double-refund"). One asks for tests on an edge case. One wants the helper extracted. The rest fall somewhere between "should fix" and "consider this." Reading them straight down the PR page mixes severities and gives every comment equal weight — so the nit about indent gets the same attention as the double-refund bug. This skill reads those comments, drops anything the PR author already replied to, ranks the rest by severity, matches each one to a remediation skill (`/refactor-extract`, `/tdd`, `/migration-author`, `/ledger-invariants`, …), and surfaces the commands so you fix the blocking thread first and skip past the styling nits.

Invoke as `/pr-feedback-route <PR#>`. Read-only. Does NOT reply to threads, does NOT resolve threads, does NOT modify the PR.

---

## Pre-flight

1. `gh auth status` — must succeed. If `gh` missing or unauthenticated, stop and tell user: install `gh` and run `gh auth login`.
2. `gh pr view <PR#> --json number,title,headRefName,baseRefName,headRefOid,isDraft,state,url,reviewDecision,author` — capture PR shape + decision.
3. If `state != "OPEN"` → stop, report "PR closed/merged, nothing to route."
4. If `reviewDecision != "CHANGES_REQUESTED"` → stop with the actual decision (`APPROVED` / `REVIEW_REQUIRED` / null) and one-line note: "no changes requested; nothing to route."
5. Fetch reviews + inline comments (parallel):
   - `gh api repos/{owner}/{repo}/pulls/<PR#>/reviews` — list of reviews with `state` (`APPROVED` / `CHANGES_REQUESTED` / `COMMENTED`) + `user.login` + `id`.
   - `gh api repos/{owner}/{repo}/pulls/<PR#>/comments` — inline file+line comments. Each has `id`, `in_reply_to_id`, `path`, `line` (or `original_line`), `body`, `user.login`, `user.type`, `created_at`, `pull_request_review_id`.
6. Pin to `headRefOid` captured in step 2 — surface it in the report so the reader can spot stale routing if HEAD has since moved.

---

## Thread reconstruction

Inline comments form threads via `in_reply_to_id`. Build threads:

- **Root**: comment where `in_reply_to_id` is null.
- **Children**: comments whose `in_reply_to_id` chain back to that root.
- **Last reply**: the chronologically latest comment in the thread (root or any child).

### Unresolved detection (heuristic)

GitHub's REST v3 `/pulls/<PR#>/comments` endpoint does not expose thread resolved-state. The GraphQL `pullRequestReviewThread.isResolved` does, but to stay REST-only we use a heuristic:

A thread is **unresolved** if **all** of these hold:
- The root's enclosing review (`pull_request_review_id`) has `state == "CHANGES_REQUESTED"`.
- The last reply in the thread was authored by someone **other than the PR author** (i.e. a reviewer still has the last word).
- The root commenter is not a bot (`user.type != "Bot"` AND login does not match `*[bot]`).

If the PR author has the last word in a thread, treat it as **resolved** (author has responded; ball is in the reviewer's court). Conservative bias: when in doubt, surface — don't suppress.

Drop:
- Threads rooted in `APPROVED`-only or `COMMENTED`-only reviews (we only act on `CHANGES_REQUESTED`).
- Threads where the last reply is by the PR author.
- Bot-authored roots.

---

## Classification — comment body → remediation category

Per surviving thread root, scan the lowercased `body` text for category signals. **Top-down, first match wins.**

| Signal in comment body                                                                | Remediation category    | Recommended skill(s)                                       |
|---------------------------------------------------------------------------------------|-------------------------|------------------------------------------------------------|
| `extract`, `duplicate`, `duplicated`, `DRY`, `pull this out`, `helper`                | duplication / extract   | `/refactor-extract`                                        |
| `dead code`, `unused`, `never called`, `remove this`                                  | dead code               | `/dead-code-scan`                                          |
| `inconsistent`, `convention`, `match the pattern in`, `this differs from`             | consistency             | `/consistency-audit`                                       |
| `tech debt`, `TODO`, `FIXME`, `hack`, `we should clean this up`                       | debt                    | `/debt-scan`                                               |
| `architecture`, `boundary`, `coupling`, `wrong layer`, `module`                       | architecture            | `/architect-review <PR#>` + `/improve-codebase-architecture` |
| `type`, ` any `, ` unknown `, `narrow this`, `type safety`, `generic`                 | type safety             | `/type-safety-audit`                                       |
| `test`, `no test`, `missing test`, `untested`, `coverage`                             | tests                   | `/tdd` + `/coverage-map`                                   |
| `edge case`, `what if`, `what happens when`, `race`, `concurrent`                     | edge cases / property   | `/fuzz-property-test` + `/mutation-test`                   |
| `lint`, `formatter`, `prettier`, `eslint`                                             | lint                    | `/lint-setup`                                              |
| `crypto`, `IV`, `nonce`, `KDF`, `bcrypt rounds`, `weak hash`, `MD5`, `SHA1`, `ECB`     | crypto / sec-deep       | `/security-review-deep <PR#>`                              |
| `rate-limit`, `throttle`, `abuse`, `audit log`, `authz on mutation`                    | sec-deep abuse / authz  | `/security-review-deep <PR#>`                              |
| `N+1`, `slow query`, `missing index`, `bundle size`, `cold start`, `cache`, `findMany without take` | perf / cost      | `/perf-review <PR#>`                                       |
| `breaking`, `removed field`, `renamed field`, `back-compat`, `new dep`, `typosquat`, `license`, `lockfile` | back-compat / supply | `/backcompat-review <PR#>`                           |
| `no log`, `missing log`, `no metric`, `no span`, `not instrumented` (per-PR)           | obs (per-PR)            | `/observability-review <PR#>`                              |
| `add structured logging`, `wire OTel`, `instrument the service`, `observability story` | observability (codebase) | `/logging-instrument` + `/otel-wire`                      |
| `retry`, `timeout`, `backoff`, `circuit breaker`, `fail open`, `fail closed`          | resilience              | `/retry-backoff-policy` + `/circuit-breaker-config`        |
| `rate limit`, `throttle`, `abuse`                                                     | rate limit              | `/rate-limit-design`                                       |
| `SLO`, `SLA`, `error budget`, `latency target`                                        | reliability targets     | `/slo-define` + `/error-budget-policy`                     |
| `rollback`, `rollout`, `feature flag`, `gate`, `canary`                               | deploy safety           | `/deploy-health-gate` + `/rollback-plan`                   |
| `runbook`, `on-call`, `oncall`, `incident`                                            | ops                     | `/incident-commander-runbook`                              |
| `threat`, `attack`, `auth bypass`, `CSRF`, `XSS`, `injection`, `RCE`, `SSRF`          | security                | `/threat-model-pre`                                        |
| `PII`, `personal data`, `GDPR`, `redact`, `data subject`                              | privacy                 | `/pii-inventory-pre`                                       |
| `audit log`, `audit trail`, `who did what`, `compliance log`                          | audit                   | `/audit-log-design`                                        |
| `migration`, `backfill`, `schema change`, `alter table`, `DDL`                        | schema                  | `/migration-author`                                        |
| `purge`, `delete user data`, `retention`                                              | data lifecycle          | `/data-purge-runbook`                                      |
| `ledger`, `double entry`, `balance`, `invariant`, `must equal`                        | ledger                  | `/ledger-invariants`                                       |
| `nit`, `style`, `spacing`, `indent`, `naming` — AND body ≤ 200 chars                  | nit                     | `/atomic-file-edit`                                        |
| (no signal matched)                                                                   | unclassified            | `/atomic-file-edit` *(advisory — read thread, decide)*     |

Before matching, drop installed-skills filter: list `.claude/skills/*/SKILL.md` via Glob; any recommendation referencing a skill not on disk should be silently dropped from the command line (but the category label stays, so the reader can still see what was matched).

### Risk-slot uplift

If the comment's `path` matches a risk slot (reuse `/commit-split` "Universal slots" taxonomy):
- `schema` — `prisma/schema.prisma`, `prisma/migrations/**`, `alembic/versions/**`, `db/migrate/**`, `drizzle/**`
- `auth` — `app/api/auth/**`, `app/(auth)/**`, `lib/auth.ts`, `middleware.ts`, `auth/**`
- `payment` — `app/api/webhooks/**`, `app/api/payment/**`, `lib/stripe.ts`, `lib/payment.ts`
- `admin` — `app/admin/**`, `app/api/admin/**`, `components/admin/**`

…append `/architect-review <PR#>` to the recommended set regardless of category, and tag the row with the matched slot.

---

## Severity bucket

Per thread, derive P1/P2/P3:

- **P1** if reviewer body contains `block`, `must fix`, `broken`, `wrong`, `bug`, `security`, `data loss`, `regression`; OR comment `path` is in a risk slot (`schema|auth|payment|admin`).
- **P2** if reviewer body contains `should`, `prefer`, `consider`, `please change`, `not a fan`.
- **P3** if classified as `nit`, OR body contains `nit:`, `optional:`, `style:` prefix.

Default if no signal matches: **P2**.

---

## Ranking

Sort threads top-down:

1. **P1** unresolved — risk-slot path first, then `created_at` ascending (oldest waiting longest).
2. **P2** unresolved — `created_at` ascending.
3. **P3** unresolved — `created_at` ascending.
4. **Unclassified** P2/P3 — bottom (advisory: reader decides).

---

## Output Format

Write to `docs/qa/pr-feedback-route-pr<PR#>-YYYYMMDD.md` (idempotent same-day overwrite):

```
PR FEEDBACK ROUTE — PR #<PR#> "<title>"
───────────────────────────────────────
PR:        <URL>
Base/Head: <baseRefName> ← <headRefName> @ <headRefOid[:8]>
Decision:  CHANGES_REQUESTED
Reviewers: @alice, @bob
Generated: <ISO timestamp>

Unresolved threads: <N>  (P1: <a> · P2: <b> · P3: <c>)

P1 — BLOCKING:

  thread #1  app/api/payment/refund.ts:84  @alice  2h ago
    "this can double-refund if Stripe retries — we need an idempotency key on the
     refund record, not just the request"
    category: ledger (risk slot: payment)
    → /ledger-invariants && /architect-review <PR#>

  thread #2  prisma/schema.prisma:42  @bob  4h ago
    "you're dropping this column without a backfill — existing rows will break the
     NOT NULL on the new field"
    category: schema (risk slot: schema)
    → /migration-author && /architect-review <PR#>

P2 — SHOULD FIX:

  thread #3  app/orders/list.tsx:120  @alice  2h ago
    "this query is duplicated three times in this file — pull it into a hook"
    category: duplication / extract
    → /refactor-extract

  thread #4  lib/utils/parse.ts:30  @bob  3h ago
    "no test covers the empty-input case"
    category: tests
    → /tdd && /coverage-map

P3 — NITS:

  thread #5  components/Button.tsx:12  @alice  2h ago
    "nit: prefer `onClick` ordering before `disabled` to match the rest of the file"
    category: nit
    → /atomic-file-edit

UNCLASSIFIED (read thread, decide manually):

  thread #6  README.md:1  @bob  5h ago
    "have we thought about the rollout sequence here?"
    → /atomic-file-edit  (advisory — pattern unclear)

RECOMMENDED NEXT: /ledger-invariants && /architect-review <PR#>
                  (P1, risk slot: payment, oldest unresolved)

SUMMARY: <a> P1 · <b> P2 · <c> P3 · <u> unclassified · pinned to <headRefOid[:8]>
```

Empty case (`CHANGES_REQUESTED` but every thread has a last-reply from the PR author):

```
PR FEEDBACK ROUTE — PR #<PR#>
───────────────────────────────────────
Decision: CHANGES_REQUESTED but no unresolved threads detected.
(All inline comments have a reply from the PR author. Reviewer needs to re-look or re-request.)

RECOMMENDED NEXT: ping reviewer for re-review (gh pr review --request <@reviewer>)
```

Wrong-decision case (e.g. `APPROVED`):

```
PR FEEDBACK ROUTE — PR #<PR#>
───────────────────────────────────────
Decision: APPROVED — no changes requested; nothing to route.
```

---

## Boundaries

- Does NOT auto-invoke remediation skills — surfaces copyable commands; user picks.
- Does NOT reply to threads.
- Does NOT resolve threads.
- Does NOT modify the PR (no labels, no edits, no ready-state changes, no `gh pr review`).
- Does NOT read general issue comments or PR-body comments — **inline review comments only**.
- Does NOT consider `APPROVED` or `COMMENTED`-only reviews — `CHANGES_REQUESTED` only.
- Does NOT process bot comments.
- Read-only.

---

## Auto-chain

- **No auto-chain out.** Triage layer, not an orchestrator. User reads the report, picks the command, fires manually.
- **Triggered by**: user saying "address review", "respond to review", "what does the reviewer want", "act on PR feedback", `/pr-feedback-route`. Also dispatched from `/route` when user intent is "act on PR review feedback".
- **Cross-links**: `/pr-inbox` (sibling triage layer — pre-review side). All remediation skills referenced in the matrix above.

## Integration

- **Discovery layer**: produces per-thread command lines. Read by user.
- **Produces**: `docs/qa/pr-feedback-route-pr<PR#>-YYYYMMDD.md` (idempotent same-day overwrite).
- **Consumes**: `gh pr view --json` + `gh api .../pulls/<PR#>/reviews` + `gh api .../pulls/<PR#>/comments`. No other inputs.
- **Re-run**: idempotent. Re-run any time reviewer adds new inline comments or PR HEAD moves.
