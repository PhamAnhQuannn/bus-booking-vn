---
name: fuzz-property-test
description: Property-based + fuzz testing for parsers, auth, billing math, serializers. Uses fast-check (JS), Hypothesis (Py), QuickCheck (Haskell), go-fuzz, jqwik (Java). Outputs property suite + corpus to `docs/testing/fuzz-<module>.md`. Reads `/project-classify` to skip XS. Use when user says "fuzz", "property test", "QuickCheck", "Hypothesis", "/fuzz-property-test", or when testing parsers/protocols/security-critical code.
output_size:
  XS: skip
  S: 1h
  M: 2h
  L: 4h
  XL: 8h
---

# /fuzz-property-test — Generative Test Suite

## Why you'd care

Example-based tests only cover the cases the author thought of — parsers, billing math, and auth code have failure modes humans don't enumerate. Property + fuzz testing surfaces the corner that costs you a CVE or a wrong-amount charge in prod.

Invoke as `/fuzz-property-test`. Example-based tests check the cases you thought of. Property-based + fuzz tests find the cases you didn't.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS → SKIP.
2. Pick targets — high-value for generative:
   - Parsers, serializers (JSON/protobuf/CSV)
   - Auth/token/crypto handlers
   - Billing math, currency conversion, tax
   - Permission resolvers
   - Idempotency-key handlers
   - URL/path routers, query builders
3. Pick framework per stack:
   - JS/TS: fast-check
   - Python: Hypothesis
   - Java/Kotlin: jqwik
   - Go: built-in `testing.F` (1.18+) or go-fuzz
   - Rust: proptest / quickcheck
   - Haskell: QuickCheck

## Inputs
- Module + function signatures to test
- Invariants the function MUST hold (write them down — this is the hard part)
- Time budget per run (default: 30s CI, 10min nightly)

## Process

1. **Write invariants first** — not test cases. Examples:
   - Round-trip: `parse(serialize(x)) === x` for any valid `x`
   - Idempotency: `f(f(x)) === f(x)`
   - Commutativity: `add(a,b) === add(b,a)`
   - Bounded: `0 ≤ tax(amount) ≤ amount`
   - Monotonic: `a ≤ b ⇒ f(a) ≤ f(b)`
   - Never-throws: `parse(any string)` doesn't crash, returns Result
   - Auth: `verify(sign(x, k), k) === true`; `verify(sign(x, k), k') === false`

2. **Generators** — define input shape:
   - Use builtin combinators (`fc.string`, `fc.integer`, `fc.record`)
   - Shrinkers matter: framework should report MINIMAL failing case, not the 4KB random blob
   - For domain types, build custom generators (valid email, valid ISO date, valid USD amount)

3. **Fuzz vs property split**:
   - Property: structured input, semantic invariant (math, parser round-trip)
   - Fuzz: unstructured bytes, crash/hang detection (binary parsers, untrusted input)
   - Use Go's `testing.F` or AFL for byte-level; Hypothesis/fast-check for structured

4. **Corpus management** — every failing input found becomes a regression seed:
   - Save shrunk failure to `testdata/corpus/<test>/<hash>.bin`
   - CI re-runs corpus first; full property search after

5. **CI integration**:
   - Per-PR: 30s budget per property, deterministic seed
   - Nightly: 10min budget, random seed, fail loudly on new failures
   - Long fuzz: dedicated runner, 1h+ per critical parser

6. **Document found bugs** — every property that found a real bug becomes documentation. Comment it: "property X caught Y in commit Z".

## Output

Write `docs/testing/fuzz-<module>.md`:

```markdown
# Property/Fuzz Suite — <module>
**Date:** <YYYY-MM-DD> | **Framework:** <fast-check/Hypothesis/...>

## Invariants
| # | Invariant | Function under test | Generator |
|--:|---|---|---|
| 1 | parse(serialize(x)) === x | json.encode/decode | fc.anything({maxDepth:5}) |
| 2 | 0 ≤ tax(a) ≤ a | billing.computeTax | fc.float({min:0, max:1e9}) |

## Corpus
- Location: `testdata/corpus/<module>/`
- Seeds: <N> (each = past regression)

## CI
- File: `.github/workflows/fuzz.yml`
- PR budget: 30s/property
- Nightly: 10min/property

## Bugs found (running log)
| Date | Property | Bug | Fix commit |
|---|---|---|---|
| ... | ... | ... | ... |
```

## Verification
- Each invariant is a property statement, not a single example.
- Generators shrink to minimal failing input.
- Failing inputs persisted to corpus.
- CI has bounded budget (not unbounded).
- Framework matches language.
