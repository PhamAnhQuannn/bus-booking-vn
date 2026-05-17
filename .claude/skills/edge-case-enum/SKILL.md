---
name: edge-case-enum
description: Enumerate edge cases for one slice (issue, feature, or flow) before writing code. Walk a fixed catalogue (boundaries, empties, doubles, races, unicode, timezone, money, network, auth, scale, adversary) and emit a per-case row with description + expected behavior + test target. Output `docs/qa/edge-cases-<slice>.md`. Use when user says "edge cases", "what could break", "boundary", "negative tests", "/edge-case-enum", or before `/acceptance-criteria`/`/tdd` on any M/L/XL planned-stage slice.
output_size:
  XS: skip
  S:  30m
  M:  1h
  L:  2h
  XL: 3h
---

# /edge-case-enum — fixed-catalogue edge-case walk

Invoke as `/edge-case-enum`. Pick a slice, walk the catalogue, write down every case that applies, decide the expected behavior, name a test target.

## Why you'd care

The bug list for a shipped feature looks the same every time: empty list, two clicks, expired token, daylight-saving boundary, ten-emoji name, $0 invoice, network drop mid-submit. Each one is obvious once you say its name. The catalogue is the prompt that makes you say all the names before the code, not after the support ticket.

Three failure shapes this skill catches:

- **Author-mode bias** — the happy path runs in your head while you write; the boundary cases stay invisible because you never tried to fail your own code.
- **Test-name evasion** — tests cover what's easy to test. The hard ones (clock-skew, double-submit, partial-write) get skipped silently.
- **Spec drift** — the AC says "user can refund"; the edge `refund == $0 due to discount` was never decided, so dev picks one behavior and product later disagrees. Decide ahead.

## Pre-flight

1. Read `docs/classify/<project>.md`.
   - XS / S → SKIP (single-user hobby slices).
   - M / L / XL → run on every Must-tier slice.
2. Read the slice's `issues/<id>.md` and any `## Acceptance Criteria` block already present.
3. Read `docs/design/data-model.md` (constraints inform boundaries) and `docs/nfr.md` (latency / size limits inform scale).

## Inputs

- One slice scope — name + 1–3 sentences (e.g. "issue 003: refund within 14 days").
- Existing AC block if present (this skill expands it; `/acceptance-criteria` later folds the new cases back in).
- Project domain hints — money? time? user-supplied text? multi-tenant? — sharpens which catalogue sections apply.

## Process

1. **Lock the slice.** Write the slice in one sentence. If you can't, the slice is too big — split first.
2. **Walk the catalogue.** For each section below, ask "does this slice expose any case in this section?" Skip sections that don't apply (note "n/a") rather than fabricating.
3. **Per case, record:**
   - **ID** `<slice>-EC<n>`
   - **Description** — the input or condition.
   - **Expected** — the behavior (allow, reject with message X, queue, idempotent no-op, etc.).
   - **Test target** — file + test name where this will be exercised.
   - **Severity** — P1 (would lose money/data), P2 (would corrupt UX), P3 (cosmetic).
4. **Flag undecided.** Cases where Expected = `???` mean the spec has a hole — surface back to product before `/tdd`.
5. **Write** `docs/qa/edge-cases-<slice>.md`.

## Catalogue

- **Boundaries** — min, max, exactly-at-boundary, off-by-one (14d refund: day 13 / day 14 / day 14 + 1s / day 15).
- **Empties** — empty list, empty string, null, undefined, missing optional field, single-item list (singular grammar).
- **Doubles** — double-click submit, double-tap, repeat webhook delivery, duplicate request id.
- **Races** — two writers, write-then-read, cache-then-DB, optimistic-lock conflict, cancel during submit.
- **Unicode / text** — emoji in name, RTL, zero-width chars, very-long single-token, HTML / SQL / shell injection, mixed scripts.
- **Timezone / clock** — DST boundary, leap second, user TZ ≠ server TZ, system clock skew, expired-by-1s token.
- **Money** — $0, negative, currency mismatch, rounding (3-decimal currencies), refund > original, tax-after-discount ordering.
- **Network** — slow request, dropped mid-submit, 502 from upstream, retry storms, idempotency-key collision.
- **Auth / authz** — expired token, wrong tenant, role-elevation attempt, deleted user with active session.
- **Scale** — 0, 1, 10, 10k, 10M of N (rows, items, files). Pagination at boundary. Sort-stability under tie.
- **Adversary** — IDOR (other user's id in URL), CSRF, prompt injection (if LLM in loop), file with `..` path.
- **Localized formats** — date 12/13/2026 vs 13/12/2026, decimal `,` vs `.`, thousands separator, plural rules.

## Output Format

```markdown
# Edge cases — <slice> — <YYYY-MM-DD>
**Slice:** issue 003 — refund within 14 days · **AC base:** docs/issues/003.md

## Decided
| ID       | Sev | Description                                           | Expected                                    | Test target                                  |
|----------|-----|-------------------------------------------------------|---------------------------------------------|----------------------------------------------|
| 003-EC1  | P1  | refund requested day 14 + 1s                          | reject, 422, "outside window"               | tests/refund.spec.ts::boundary-just-after    |
| 003-EC2  | P1  | double-submit same idempotency key                    | second is no-op, returns first's response   | tests/refund.spec.ts::double-submit-idempotent |
| 003-EC3  | P1  | refund > original due to manual adjust                | reject, 422, "amount exceeds original"      | tests/refund.spec.ts::over-amount            |
| 003-EC4  | P2  | $0 refund (full discount applied)                     | reject, 422, "nothing to refund"            | tests/refund.spec.ts::zero-amount            |
| 003-EC5  | P1  | webhook re-delivery after partial write                | idempotent, no second ledger row            | tests/refund.spec.ts::webhook-redelivery     |
| 003-EC6  | P2  | user TZ AEST, refund window calc in UTC               | calc in UTC; surface user-TZ string in UI   | tests/refund.spec.ts::tz-display             |
| 003-EC7  | P3  | original charge in EUR, refund request in USD         | reject, 422, "currency mismatch"            | tests/refund.spec.ts::currency-mismatch      |

## Undecided (spec hole → escalate)
| ID       | Description                                           | Question for product                        |
|----------|-------------------------------------------------------|---------------------------------------------|
| 003-EC8  | partial refund of already-partially-refunded charge   | allow up to remaining? cap at first refund? |
| 003-EC9  | refund initiated, customer disputes 1 hour later      | which takes precedence: refund or dispute?  |

## Sections marked n/a (no exposure)
- Unicode / text — refund flow has no user-supplied text field.
- Localized formats — admin-only UI, single locale.
- Adversary (prompt injection) — no LLM in loop.
```

## Verification

- Every section in the catalogue is either expanded into ≥1 row or marked n/a — no silent skips.
- Every Decided row has a Test target file + name (even if the file doesn't exist yet — names create the placeholder for `/tdd`).
- Undecided rows trigger an escalation note in the slice's issue; `/tdd` blocks on them.
- After `/acceptance-criteria` re-runs, every Decided P1 row appears as a Given/When/Then in the AC block.

## Cross-skill references

- **Upstream:** `/data-model-design` (constraints define boundaries), `/threat-model-pre` (adversary cases), `/nfr-template` (scale limits), `/acceptance-criteria` (AC base).
- **Downstream:** `/acceptance-criteria` (refresh after Decided rows land), `/tdd` (one test per Decided row), `/traceability-matrix` (every EC row becomes a tracked AC).

## When to re-run

- Before every M/L/XL Must-tier slice enters `/tdd`.
- After any AC change for a slice already shipped (delta-walk new cases only).
- Pre-launch — sweep all Must-tier slices' edge-case files for Undecided rows.
- After any incident — add the incident scenario as a permanent EC row in the affected slice.
