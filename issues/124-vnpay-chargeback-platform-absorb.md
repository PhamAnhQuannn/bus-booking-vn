---
depends-on: []
type: FEATURE
wave: 1
spec: [S08, S13, S15]
---

## Parent PRD

Plan: `C:\Users\mrimp\.claude\plans\what-is-jwt-why-sparkling-crescent.md` — §E (Q1). **MONEY-CRITICAL — implement via `/tdd`.**

## What to build

Add a **platform-absorb** path for VNPay-originated chargebacks. Business decision (Q1): the platform contests disputes with evidence; if we lose, the **PLATFORM eats the loss and the operator is held harmless** — building operator trust. This DIVERGES from the current `recordChargeback` default in `lib/ledger/chargeback.ts`, which is operator-liable (spec S15#7).

VNPay has no push dispute webhook, so the existing **admin-manual** trigger (`app/api/admin/finance/chargeback`) is the correct mechanism — no auto-webhook needed. This slice adds the platform-absorb variant and routes VNPay disputes to it.

## Acceptance criteria

- [ ] `lib/ledger/chargeback.ts` gains a **platform-absorb path**: the full disputed amount lands as platform bad-debt (an `adjustment`/`chargeback_backstop`-style entry) and the operator balance is left UNCHANGED (no operator-liable `chargeback -amount` / `payout_reversal` clawback against the operator).
- [ ] The divergence from S15#7 is documented inline with a `// SPEC DIVERGENCE:` comment naming Q1 and the operator-held-harmless rationale.
- [ ] The admin chargeback route (`app/api/admin/finance/chargeback/route.ts`) can flag a chargeback as VNPay/platform-absorb (e.g. a `liability: 'platform' | 'operator'` discriminator, default preserving existing operator-liable behavior for non-VNPay).
- [ ] Idempotent on `sourceEventId` (replayed admin entry → no double effect), consistent with the existing engine.
- [ ] Tests (TDD): platform-absorb leaves `getOperatorBalance` unchanged; the platform bad-debt is recorded + queryable via `listChargebacks`; idempotency; pre-payout AND post-payout cases both keep the operator whole. Unit + integration.
- [ ] Existing operator-liable chargeback tests still pass (no regression to the default path).
- [ ] `pnpm tsc --noEmit` + `pnpm test` + `pnpm vitest:int` green.

## Blocked by

None — standalone ledger slice. Extends the built + tested engine.

## User stories addressed

- [S08]/[S13] chargeback reversal; [S15#7] liability model (VNPay = platform-absorb divergence).
