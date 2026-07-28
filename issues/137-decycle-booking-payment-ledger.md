---
depends-on: []
type: REFACTOR
wave: 4
---

## Parent PRD

Plan: `C:\Users\mrimp\.claude\plans\with-all-the-issues-reactive-llama.md` — PR 7. GitHub #343.

## What to fix

Follow-up to #333. Now that `import-x/no-cycle` actually works (it was inert — the default
`import-x/extensions` excluded `.ts`, and the legacy resolver form never loaded), it reports **11**
cross-domain cycles among `lib/booking`, `lib/payment`, `lib/ledger`. The rule sits at `warn` for
those three domains via an override block (`eslint.config.mjs:204-214`) whose own comment says
"delete this whole block when #343 lands". A new cycle anywhere **outside** those three already
errors, so the gate is live — this issue burns down the known 11 and removes the exemption.

Cycle count re-verified at **11** during planning.

### Why they exist

Barrel-induced. `boundaries/entry-point` forces cross-domain imports through each domain's
`index.ts`, and barrels re-export the whole domain — so any bidirectional domain pair is an
automatic cycle even when the actually-used symbols don't cycle at runtime.

### The value edges (type-only imports are already ignored)

| Symbol | Importers | Verdict |
|---|---|---|
| `BOOKING_REF_REGEX` (`lib/booking/bookingRef.ts:43`) | `lib/payment/adapters/bankTransfer.ts:24`, `app/api/bookings/status/route.ts:15` | **pure leaf** — a regex in a 43-line module with no Prisma, only `crypto` |
| `legalPredecessors` (`lib/booking/transitions.ts:53-57`) | `lib/payment/processWebhook.ts:53`, `lib/payment/applyPaidTransition.ts:28`, and a **dynamic** `await import('@/lib/booking')` in `lib/jobs/reconcilePayments.ts:292` | **pure leaf** — 5-line function over a static map, 58-line module, no Prisma |
| `appendBookingPaidLedger` | `lib/booking/createCashBooking.ts:19` | money path, not a leaf |
| `getGatewayFor` | `lib/booking/initiateOnlineBooking.ts:30` | not pure — calls `getEnv()` + adapter factories |
| `refundOut` (`lib/ledger/refund.ts:95`) | `lib/payment/processWebhook.ts:54` **only** | 229-line money function |
| `refundPayment` | `lib/ledger/refund.ts:46` | calls `getEnv()`, small but not pure |

**Correction to the GitHub issue text:** it lists `applyPaidTransition → refundOut` as an edge.
`applyPaidTransition.ts` only mentions `refundOut` in prose comments (`:18`, `:43`) — the real edge
is `processWebhook.ts:54` alone.

### Fix

1. Move `BOOKING_REF_REGEX` to **`lib/core/id/`** — that module's own doc comment
   (`lib/core/id/index.ts:3`) already designates it: "Will hold ID/ref generation … booking-ref
   formatting **+ exported regex**." Only 2 production call sites.
2. Move `legalPredecessors`. It has **no designated home** among `lib/core`'s placeholder subdirs
   (`money/ time/ id/ result/ errors/ jobs/ http/` — none mentions a state-machine primitive).
   Proposed: `lib/core/booking/transitions.ts`. 3 production call sites, one of which is a dynamic
   import that must be repointed.
3. Reassess `refundOut` / `refundPayment` ownership in a **separate commit** — money path.
4. Delete the `eslint.config.mjs:204-214` override; `no-cycle` is already `error` globally.
5. Update the AGENTS.md Stage-3 "cycles at zero" note to reflect the now-real gate.

`lib/core` is deep-importable by every domain (`eslint.config.mjs:171` —
`{target:["lib-core"], allow:"**"}`) and is barred from importing any domain, so moving leaves
there breaks the cycle without creating a new edge.

## Acceptance criteria

- [ ] `pnpm lint` reports **0** `import-x/no-cycle` warnings.
- [ ] The `warn` override block is deleted, not weakened.
- [ ] Deep `vi.mock` paths for the moved symbols updated — per the 2026-06-03 rule, rewrite only
      `from '…'` / `import('…')` specifiers, never `.mock()` / `.importActual()` args.
- [ ] The dynamic import in `reconcilePayments.ts:292` is repointed and its test mock still
      intercepts.
- [ ] Money-path integration tests green: `reconcilePayments.int`, `bankTransferWebhook.int`,
      `ledgerCreditFee.int`, `refund`.
- [ ] `refundOut`/`refundPayment` changes ride their own commit.

## Blocked by

- none, but schedule last — these are money paths and the gate already protects new cycles.

## Files

- `lib/core/id/`, proposed `lib/core/booking/transitions.ts`
- `lib/booking/bookingRef.ts`, `lib/booking/transitions.ts`, `lib/booking/index.ts`
- `lib/payment/{adapters/bankTransfer,processWebhook,applyPaidTransition}.ts`
- `lib/jobs/reconcilePayments.ts`, `app/api/bookings/status/route.ts`, `eslint.config.mjs`

## Severity

P1 by label, but scheduled last: zero current money/security impact, and the gate already errors
on any NEW cycle outside the three exempted domains.
