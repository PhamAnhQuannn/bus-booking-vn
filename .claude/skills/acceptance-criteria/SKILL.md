---
name: acceptance-criteria
description: Generate Given/When/Then acceptance criteria for one or more issues. Annotates `issues/<id>.md` with a `## Acceptance Criteria` block per issue, each line a `Given … When … Then …` triple. Use when user says "acceptance criteria", "AC", "Given When Then", "definition of done", "/acceptance-criteria", or before `/tdd` on any S/L/XL planned-stage slice. Folds in rows surfaced by `/edge-case-enum` so each Decided edge case becomes a tracked AC.
output_size:
  XS: skip
  S:  30m
  M:  1h
  L:  2h
  XL: 3h
---

# /acceptance-criteria — Given/When/Then per issue

Invoke as `/acceptance-criteria`. Pick one or more issues, draft G/W/T rows, fold in `/edge-case-enum` Decided rows, write back to `issues/<id>.md`.

## Why you'd care

"User can refund" is not a contract. "Given a charge ≤14 days old, When the admin submits a refund, Then the original payment method is credited and a ledger row is appended" is. Three failure shapes die when this skill runs:

- **AC vacuum** — issue says only "user can refund"; dev picks one interpretation; product later says "no, partial refunds were always supposed to be allowed". Cost: a rewrite, sometimes a rollback.
- **Untestable AC** — "should be fast" is not a test. "Then p95 latency for the refund call is ≤ 800ms (per `docs/nfr.md`)" is.
- **Edge-case orphan** — `/edge-case-enum` decided "refund > original → reject 422" but nobody folded it back into the issue, so the test never gets written. AC block is the place where Decided rows land permanently.

## Pre-flight

1. Read `docs/classify/<project>.md`.
   - XS → SKIP.
   - S → top-3 Must-tier issues only.
   - M/L/XL → every Must-tier issue + every issue currently in `building`.
2. Read `issues/<id>.md` body — extract the user-story, scope, constraints.
3. Read `docs/qa/edge-cases-<slice>.md` if present (`/edge-case-enum` output) — every Decided row is a candidate AC.
4. Read `docs/nfr.md` — surfaces latency / a11y / security NFR rows that translate into G/W/T.

## Inputs

- One or more issue ids (e.g. `003`, `005,007`, or `all-must` to walk the priority list).
- Optional `/edge-case-enum` output for the slice.
- Optional `/prioritize` priority list — drives which issues get processed when scope is broad.

## Process

1. **Pick scope.** Single id, comma-list, or `all-must` (read `docs/qa/priority-list.md`).
2. **Per issue, draft Happy-path ACs first.** One per distinct successful outcome. Format:
   `- AC<n>: Given <precondition>, When <action>, Then <observable outcome>`
3. **Add Sad-path ACs.** Each error / reject / boundary case from the user-story.
4. **Fold in Decided edge-case rows.** Every `<slice>-EC<n>` with a Decided expected behavior becomes an AC. Preserve the EC id in the AC line for traceability (`- AC<n> [EC<m>]: Given …`).
5. **Add NFR-derived ACs** where the issue touches a perf / security / a11y surface (e.g. `Then p95 ≤ 800ms`).
6. **Surface gaps.** Any Undecided edge-case row → AC marked `[BLOCKED: spec hole — see EC<n>]`, plus a note in the issue body. `/tdd` blocks on these.
7. **Write** the `## Acceptance Criteria` block back to `issues/<id>.md` (replace existing block; never duplicate).

## Output Format

Inside `issues/<id>.md` body, append (or replace) this block:

```markdown
## Acceptance Criteria

### Happy path
- AC1: Given a charge ≤14 days old, When the admin submits a refund of an amount ≤ charge total in the same currency, Then the refund is approved, the original payment method is credited, and a ledger row is appended.
- AC2: Given an idempotency key already seen, When the same refund is re-submitted, Then the response from the first call is returned and no second ledger row is written. [EC2]

### Sad path
- AC3: Given a charge >14 days old, When the admin submits a refund, Then the response is 422 with code `outside_window`. [EC1]
- AC4: Given a refund amount > charge total, When submitted, Then the response is 422 with code `amount_exceeds_original`. [EC3]
- AC5: Given a $0 refund (full discount applied), When submitted, Then the response is 422 with code `nothing_to_refund`. [EC4]
- AC6: Given a charge in EUR and a refund request in USD, When submitted, Then the response is 422 with code `currency_mismatch`. [EC7]

### NFR-derived
- AC7: Given any successful refund, Then end-to-end p95 ≤ 800ms (per `docs/nfr.md`).
- AC8: Given any refund attempt, Then no PII appears in logs at level < ERROR (per `docs/inception/pii-inventory-*.md`).

### Blocked (spec hole)
- AC9 [BLOCKED: spec hole — see EC8]: Partial refund of an already-partially-refunded charge — behavior undecided.
```

Frontmatter (optional, top of file) — `/traceability-matrix` reads this:

```yaml
---
acceptance_criteria_count: 9
acceptance_criteria_blocked: 1
edge_case_refs: [EC1, EC2, EC3, EC4, EC7, EC8]
---
```

## Verification

- Every AC line parses as `Given … When … Then …` — no free-form paragraphs.
- Every Decided edge-case row from `/edge-case-enum` is folded in with its `[EC<n>]` ref.
- Every BLOCKED line names the EC id and reason.
- Issue's frontmatter `acceptance_criteria_count` matches the bullet count in the body.
- `/tdd` blocks on any BLOCKED AC.

## Cross-skill references

- **Upstream:** `/prd-to-issues` (issue bodies), `/edge-case-enum` (Decided rows fold in here), `/nfr-template` (NFR-derived ACs), `/data-model-design` (invariants ↔ ACs), `/prioritize` (which issues to process first).
- **Downstream:** `/tdd` (one test per AC), `/traceability-matrix` (every AC is one row), `/definition-of-done-pre` (DoD = all ACs pass), `/release-notes` (release ships the issues whose ACs are now green).

## When to re-run

- After every `/prd-to-issues` pass on new issues.
- After every `/edge-case-enum` pass — fold the new Decided rows in.
- After any scope change to an issue.
- Before `/tdd` on any Must-tier slice — never start TDD with an AC vacuum.
- Pre-launch (L/XL) — every Must-tier issue must have a non-empty AC block.
