---
depends-on: []
type: FEATURE
wave: 1
spec: [S13, S15]
---

## Parent PRD

Plan: `C:\Users\mrimp\.claude\plans\what-is-jwt-why-sparkling-crescent.md` — §F (Q3). **MONEY-CRITICAL — implement via `/tdd`.**

## What to build

Track VNPay's MDR (Merchant Discount Rate, ~0.5–2%) per booking so the platform has real per-method cost visibility. VNPay's cut is **platform-float** — the operator is kept whole (they earn the full fare minus only the existing platform commission). This mirrors exactly how `refund_out` is excluded from operator balance.

Operator-payout tracking already exists (`payout_debit` → `paidOut` in `lib/ledger/balance.ts`); this slice adds ONLY the VNPay-cost dimension.

## Acceptance criteria

- [ ] `psp_fee` added to the Prisma `LedgerEntryType` enum via a **forward migration** (any index declared in both DSL + `migration.sql` per the Issue-007 rule; enum-add is `ALTER TYPE ... ADD VALUE`).
- [ ] `psp_fee` is **NOT** added to `OPERATOR_BALANCE_TYPES` (`lib/ledger/balance.ts:82`) — it is platform-float, excluded like `refund_out`. Operator balance unaffected. (Model comment documents the exclusion.)
- [ ] On the VNPay **paid** webhook path (`lib/payment/processWebhook.ts` / `applyPaidTransition.ts`), append a `psp_fee` entry tagged to the booking, amount = MDR × fare computed in **BigInt** (ES2017 → `BigInt()` constructor, no `n` literals; half-even like `calcPayout`).
- [ ] MDR rate = a documented **placeholder const `VNPAY_MDR_RATE = 1.1%`** flagged `// TODO: real VNPay contract rate — user swaps before go-live`. Non-blocking.
- [ ] `psp_fee` is idempotent on its `sourceEventId` (mirror the append-only + P2002-swallow pattern; a replayed VNPay IPN writes it once).
- [ ] A `listPspFees` / sum query for the admin Finance tab ("VNPay cost this month").
- [ ] Tests (TDD): platform-float EXCLUSION from `getOperatorBalance` (operator balance identical with/without the psp_fee row); BigInt correctness; idempotency on replay. Unit + integration (`pnpm vitest:int`).
- [ ] Migration parity verified (schema `@@`/enum ↔ `migration.sql`); `pnpm tsc --noEmit` + `pnpm test` + `pnpm vitest:int` green.

## Blocked by

None — standalone ledger slice. (The webhook write only fires once VNPay is live, but the ledger mechanics are independently testable.)

## User stories addressed

- [S13] ledger fee accounting; [S15] platform cost visibility.
