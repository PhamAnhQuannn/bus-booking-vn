---
name: mutation-test
description: Detect test theater. Run Stryker/PIT/mutmut mutation testing on critical paths (auth, billing, data integrity). Outputs mutation score + survived-mutants list to `docs/testing/mutation-<service>.md`. Reads `/project-classify` to skip XS. Use when user says "mutation test", "test quality", "test theater", "are tests real", "/mutation-test", or before any compliance/SOC2 audit.
output_size:
  XS: skip
  S: 1h
  M: 2h
  L: 4h
  XL: 8h
---

# /mutation-test — Test Theater Detection

## Why you'd care

High line coverage with mutation testing scores of 30% means most tests are theater — they execute the code but assert nothing meaningful. Mutation testing reveals where the suite is actually lying about safety.

Invoke as `/mutation-test`. Coverage % lies — tests can run code without asserting anything. Mutation testing mutates source, expects tests to fail. Survived mutant = silent test.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS → SKIP.
2. Confirm test suite exists + passes green.
3. Pick tool per language:
   - JS/TS: StrykerJS
   - Java: PIT
   - Python: mutmut / cosmic-ray
   - C#: Stryker.NET
   - Go: go-mutesting
   - Ruby: mutant

## Inputs
- Critical-path module list (auth, billing, payments, permissions, data-transform)
- Target mutation score (default: 75% for critical paths, 60% for app layer)
- Time budget (mutation runs are slow — start with one module)

## Process

1. **Scope first** — never run lib-wide on day 1. Pick ONE module:
   - billing math, auth token check, permission resolver, data-migration transform
2. **Install + config** — language-specific. Example Stryker `stryker.config.json`:
   - `mutate: ["src/billing/**/*.ts"]`
   - `testRunner: "jest"`
   - `thresholds: { high: 80, low: 60, break: 50 }`
3. **First run + triage** — output a survived-mutants table. For each survivor:
   - Real gap → add assertion
   - Equivalent mutant (no behavioral change) → mark ignore with justification
   - Untestable boundary (logging, perf) → exclude
4. **Score targets**:
   | Module class | Target |
   |---|---:|
   | Billing / payments / tax | 90% |
   | Auth / permissions / crypto | 90% |
   | Data migration / transforms | 85% |
   | Business logic core | 75% |
   | UI glue / view layer | 50% |
   | Logging / telemetry | exclude |
5. **CI gate** — fail PR if mutation score on critical path drops below threshold. Cache mutant runs by file hash; don't re-mutate untouched code.
6. **Expand** — after first module green, queue next critical module.

## Output

Write `docs/testing/mutation-<service>.md`:

```markdown
# Mutation Test — <service>
**Date:** <YYYY-MM-DD> | **Tool:** <Stryker/PIT/...> | **Module:** <billing>

## Score
- Killed: <X> / <Y>
- Survived: <N> (critical: <M>)
- Timed out: <T>
- No coverage: <NC>
- **Score:** <%> (target <%>)

## Survived mutants — triage
| # | File:line | Mutation | Triage | Action |
|--:|---|---|---|---|
| 1 | billing/tax.ts:42 | `+` → `-` | real gap | add assertion: <test name> |
| 2 | billing/round.ts:7 | `Math.floor` → `Math.ceil` | equivalent | ignore — proven by adjacent test |

## CI gate
- File: `.github/workflows/mutation.yml`
- Threshold: <%>
- Run cadence: <PR / nightly / weekly>

## Next module queued
<auth | permissions | ...>
```

## Verification
- Tool matches language.
- Scope is module, not whole repo on first run.
- Every survived mutant has triage row (real / equivalent / excluded).
- CI gate file path named, threshold explicit.
- Critical-path modules hit ≥85%.
