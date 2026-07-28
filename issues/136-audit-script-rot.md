---
depends-on: []
type: CHORE
wave: 3
---

## Parent PRD

Plan: `C:\Users\mrimp\.claude\plans\with-all-the-issues-reactive-llama.md` — PR 6.
GitHub #353, plus #367 folded in.

## What to fix

Four low-severity rot items. None affects correctness; all invite misread, and two sit inside
money-safety tooling where false confidence is the actual cost.

### 1. Vacuous data-leak check

`scripts/audit/data-leak-grep.sh:11-41` (A1) greps for `tempPasswordPlain` and maintains an
allowlist naming `lib/admin/createOperatorAccount.ts`, `lib/admin/getOperatorDetail.ts` and
others. The **column was dropped** in migration `20260615000000_drop_temp_password_plain`, so the
check can never fire again and the allowlist is scaffolding for something that no longer exists.
The string now survives only in `lib/logger.ts:82-83` (redact list) and test fixtures.

Remove it, or leave a `# historical — kept for regression insurance` comment so a future reader
doesn't read perpetual PASS as live coverage.

### 2. Dead grep path in the money-math check

`scripts/audit/greppable-invariants.sh:97-99` (G4) targets `lib/payouts/`, which **does not exist**
— payouts folded into `lib/ledger` post-091. The clause silently no-ops (empty glob, `2>/dev/null`
swallows the error) rather than failing. `lib/ledger/` and `lib/payment/` in the same command still
cover the live paths, so this is cosmetic — but a dead path inside a money-safety script is exactly
the "a gate that emits nothing is not proof" trap from the 2026-07-25 entry.

### 3. Duplicate npm aliases — **four, not three**

`package.json:10-16` has two duplicate pairs:

- `"test"` and `"test:unit"` — both byte-identical `"vitest run"`
- `"vitest:int"` and `"test:int"` — byte-identical; `"test:integration"` differs only by
  `--reporter=verbose`

CLAUDE.md documents only `pnpm test` and `pnpm vitest:int`. Drop the dead aliases, keep the
documented ones.

### 4. Constraint-boundary comment (#367, folded in)

`lib/charter/charterStatus.ts:330-343` issues two `createNotificationLog` calls with the same
`template` (`charterMatched`, one sms + one email). This is a **false positive** for the #328 bug —
charter rows carry NULL `bookingId`, and NULL is distinct under `@@unique([bookingId, template])`,
so two NULL-bookingId rows never collide (verified: neither call passes `bookingId`, and
`lib/core/db/notificationLogRepo.ts:27` defaults it to null).

But it is precisely the greppable smell from the #328 mistake-log entry. Anyone copying this
two-enqueue-same-template pattern onto a **Booking-linked** path reintroduces #328: P2002 inside
`$transaction` → whole-tx abort → sweep/webhook failure.

Add a short comment at the enqueue site naming the NULL-`bookingId` constraint boundary and
warning against copying it onto Booking-linked rows.

## Acceptance criteria

- [ ] A1 removed or explicitly marked historical.
- [ ] G4 no longer references a non-existent directory.
- [ ] Exactly one unit-test alias and one integration-test alias remain, matching CLAUDE.md.
- [ ] `charterStatus.ts` carries the constraint-boundary comment.
- [ ] `pnpm lint && pnpm tsc --noEmit && pnpm test` still green; audit scripts still run.

## Blocked by

- none

## Files

- `scripts/audit/data-leak-grep.sh`, `scripts/audit/greppable-invariants.sh`
- `package.json`, `lib/charter/charterStatus.ts`

## Severity

P3 — bundle. No behaviour change.
