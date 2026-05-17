---
name: design-review
description: Multi-perspective critique of design docs in docs/design/. Surfaces inconsistencies between wireframe / api-contract / data-model / flow / a11y / failure / capacity / cache / cost. Use when user says "design review", "review architecture", "audit design", "/design-review", or before kicking off implementation. Writes docs/design/review-YYYYMMDD.md.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# Design Review

## Why you'd care

The wireframe shows a "Save Draft" button that the API contract has no endpoint for, the data model has a `status` enum that the flow doc still refers to as a boolean, and the failure design promises 99.9% but the capacity plan is sized for one node — nobody noticed because each doc was written by a different person on a different day. Catching the drift between design artifacts before implementation is roughly 50× cheaper than catching it as a production bug filed by the customer who first hit the missing endpoint.

Cross-doc consistency review. *Do the wireframes match the API contract? Does the failure design honor the SLOs? Are entities used in flows defined in the data model?* Surfaces drift before code starts.

## When This Skill Applies

Activate when:
- User says "design review", "review architecture", "audit design", "design audit", "/design-review"
- 3+ design docs exist in `docs/design/`.
- Pre-implementation kickoff for a feature.
- Before launch readiness.
- Before stakeholder demo of design phase.

## Prerequisites

- `docs/design/` populated with at least: wireframes (one or more), api-contract, data-model, one user-flow.
- Optionally: a11y, failure, capacity, cache, cost docs.
- Read-only â€” never modifies the source design docs.

## Steps

1. **Inventory** `docs/design/` â€” list every file, last-updated date.
2. **Build the consistency matrix.** For each pair of related docs, what must match.
3. **Run consistency checks** (below). Score each: âœ… pass, âš ï¸ minor drift, âŒ blocker.
4. **Run completeness checks.** What design artifact is missing for the features in scope?
5. **Run coverage checks.** Every PRD issue â†’ traceable to a design doc?
6. **Run NFR alignment.** Does capacity / failure / a11y honor `docs/nfr.md`?
7. **Open questions.** Aggregate all "Open Questions" sections from each doc â€” are any blocking?
8. **Score readiness.** Greenlight, yellow, red for implementation start.
9. **Write** `docs/design/review-YYYYMMDD.md`.
10. **Auto-chain.** Per blocker â†’ re-run the originating skill (`/api-contract`, `/data-model-design`, etc.).

## Consistency Matrix

| Source A | Source B | Must match |
|----------|----------|------------|
| user-flow | api-contract | every server interaction in flow has an endpoint |
| user-flow | data-model | every entity referenced has a defined entity |
| user-flow | wireframe | every step has a screen wireframe (or noted "no UI") |
| api-contract | data-model | every endpoint payload field has a matching entity field (or aggregation noted) |
| api-contract | failure | every external dep called has a failure mode |
| wireframe | design-system | every component is in inventory or flagged "new" |
| wireframe | a11y | every screen has an a11y doc when interactive |
| capacity | api-contract | every endpoint with budget exists |
| cache | api-contract | every cached endpoint exists; method = GET |
| cache | failure | invalidation events match write paths |
| cost | capacity | demand numbers match |
| failure | nfr | retry / timeout policy honors latency SLO |
| a11y | nfr | contrast meets accessibility SLO |
| threat-model | api-contract | every PII/money endpoint has threat coverage |

## Completeness Checks

- Every PRD feature has at least: api-contract entry, data-model entry (if persistent), one user-flow (if multi-step), one wireframe (if has UI).
- Every consumer-facing screen has a11y design.
- Every external dependency has failure design.
- Every hot path (per capacity-plan) has cache strategy.
- Every architecturally significant choice has an ADR.

## Output Format â€” `docs/design/review-YYYYMMDD.md`

```markdown
---
review-date: YYYY-MM-DD
scope: feature X | full design | pre-launch
status: greenlight | yellow | red
---

# Design Review â€” YYYY-MM-DD

## Inventory

| File | Last updated | Status |
|------|--------------|--------|
| docs/design/wireframes/checkout-payment.md | YYYY-MM-DD | reviewed |
| docs/design/api-contract.md | YYYY-MM-DD | draft |
| docs/design/data-model.md | YYYY-MM-DD | reviewed |
| docs/design/flows/checkout.md | YYYY-MM-DD | draft |
| docs/design/a11y-checkout-payment.md | YYYY-MM-DD | draft |
| docs/design/failure-checkout.md | â€” | MISSING |
| docs/design/capacity.md | â€” | MISSING |

## Findings

### âŒ Blockers

1. **api-contract vs flow drift** â€” `flows/checkout.md` references `POST /api/payments/intent`, `api-contract.md` only documents `POST /api/payments`. One must move.
2. **Missing failure design** â€” checkout flow depends on Stripe + mailer; no `docs/design/failure-checkout.md`. Run `/failure-design`.

### âš ï¸ Drift

3. **wireframe vs design-system** â€” `BookingSummaryCard` in wireframe not yet in design-system inventory. Action: add to inventory or mark as "feature-local".
4. **a11y contrast** â€” `countdown-warn` token (#F59E0B) fails AA on white bg. Action: bump in design-system tokens.
5. **flow vs data-model** â€” flow mentions `webhook_events` table; data-model doesn't define it. Action: add entity or note as infra-table-out-of-scope.

### âœ… Pass

- Booking lifecycle in data-model matches state machine in flow.
- Wireframe states (loading/empty/error) cover all flow branches.
- ADRs in place for: Prisma, Stripe, shadcn-ui choices.

## Completeness

| Feature | api-contract | data-model | flow | wireframe | a11y | failure |
|---------|:-:|:-:|:-:|:-:|:-:|:-:|
| Checkout | âœ… | âœ… | âœ… | âœ… | âœ… | âŒ |
| Reservation | âœ… | âœ… | âŒ | âš ï¸ partial | âŒ | âŒ |
| Refund | âŒ | âœ… | âŒ | âŒ | âŒ | âŒ |
| Auth (sign-up) | âœ… | âœ… | âš ï¸ partial | âœ… | âŒ | âš ï¸ partial |

## Coverage to PRD

| Issue | Design coverage | Status |
|-------|------------------|--------|
| issues/0001-checkout-stripe.md | full | ready to /tdd |
| issues/0002-perishable-hold.md | full (data-model + flow + wireframe) | ready to /tdd |
| issues/0003-refund.md | none | run `/data-model-design` + `/api-contract` + `/user-flow` |

## NFR Alignment

| NFR | Target | Design coverage |
|-----|--------|-----------------|
| API p95 < 400ms | nfr.md | âœ… capacity-plan budgets honor |
| WCAG 2.2 AA | nfr.md | âš ï¸ contrast issue on countdown |
| Zero double-charge | nfr.md | âœ… idempotency in api-contract; need failure-design to confirm retry policy |
| Recovery within 1h of dep outage | nfr.md | âŒ missing failure-design |

## Open Questions (aggregated)

| From | Question | Blocking? |
|------|----------|-----------|
| data-model | ULID vs CUID | no, default CUID |
| data-model | Soft vs hard delete for Booking | no, default soft |
| api-contract | API versioning strategy | no, defer |
| capacity-plan | Read replica trigger | no, M9 concern |
| cost-model | Stripe negotiation lever | no, M3 concern |

## Readiness Verdict

**Status: âŒ red â€” implementation NOT ready.**

Required before code starts:
- Resolve blocker #1 (api-contract endpoint name).
- Run `/failure-design` for checkout flow.
- Resolve a11y contrast token.

Recommended (not blocking):
- Promote BookingSummaryCard into design-system.
- Define refund design suite (issue 0003).

## Re-review trigger

Re-run after blockers cleared. Auto-chain offers /api-contract, /failure-design, /design-system to address.
```

## Boundaries

- **Read-only.** Never edits source design docs. Only writes review report.
- **Doesn't propose new design.** Identifies gaps, then routes to the right skill.
- **Cross-doc only.** Within-doc quality issues are the domain skill's problem; here we look at *between* docs.
- **No vibes.** Every finding cites the file:section in both docs.
- **Score the verdict.** "Looks fine" is not a review.

## Re-run Behavior

- One review file per date. Re-run = new file, not overwrite.
- Older reviews keep as history (great for "what was the state when we shipped X").

## Auto-chain

- `/anti-generic-design-check` - mandatory; every design review runs the genericness audit (13-tell checklist + corpus delta) before scoring readiness.
- Each blocker â†’ suggest the skill that fixes it (`/api-contract`, `/failure-design`, etc.).
- Drift on tokens â†’ `/design-system`.
- Missing flow â†’ `/user-flow`.
- After all blockers cleared â†’ suggest `/plan` or `/tdd` to start implementation.

## Example Trigger

User: "do a design review before I start coding the checkout"
â†’ Inventory `docs/design/`, run consistency matrix + completeness + NFR alignment, score readiness, write `docs/design/review-YYYYMMDD.md`.
