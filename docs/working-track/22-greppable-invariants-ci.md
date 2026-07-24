# 22 -- Greppable Invariants G1-G6 CI Automation

## Status: DONE

## What changed

1. Created `scripts/audit/greppable-invariants.sh` — automated grep checks from Mistake Log
2. Added `greppable-invariants` CI job to `.github/workflows/ci.yml`
3. Added `// bigint-exempt:` annotations to `halfEvenRound` in `lib/ledger/calcPayout.ts`

## Invariants implemented

| ID | Check | Source |
|----|-------|--------|
| G1 | No operatorId from request body in op routes | ADR-008 D8 |
| G2 | No server-component self-fetch (localhost/NEXT_PUBLIC_BASE_URL) | Mistake Log #002/003 |
| G3 | No JSON payload cron predicates | Mistake Log #014 |
| G4 | No Math.round/floor/ceil in money modules (use BigInt) | Mistake Log #016 |
| G5 | No Date.now()/Math.random() in RSC page components | Mistake Log #016 |
| G6 | No 'use client' server barrel imports (extended beyond A3) | Mistake Log #092b |

## Not implemented (deferred)

G7-G11 require cross-file analysis (mock parity, findFirst vs findUnique audit) beyond simple grep. Deferred to Phase 2 hardening.

## Files

- `scripts/audit/greppable-invariants.sh` — new CI audit script
- `.github/workflows/ci.yml` — new Greppable Invariants job
- `lib/ledger/calcPayout.ts` — bigint-exempt annotations on halfEvenRound
