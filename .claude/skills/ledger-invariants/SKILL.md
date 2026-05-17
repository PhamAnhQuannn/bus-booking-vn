---
name: ledger-invariants
description: Ledger design — single-entry vs double-entry choice, balance invariants, suspense accounts, reconciliation cadence, close discipline, out-of-balance break alerts. Outputs to `docs/design/ledger-<project>.md`. Reads `/project-classify`; skip XS. Use when user says "ledger", "double-entry", "general ledger", "GL", "journal entry", "reconciliation", "out of balance", "trial balance", "suspense account", "/ledger-invariants", or before any product moves money / records balances.
output_size:
  XS: skip
  S: 1h
  M: 3h
  L: 6h
  XL: 8h
---

# /ledger-invariants — Money-Movement Ledger Design

Invoke as `/ledger-invariants`. Defines the algebra of how your product records value movement: the invariants that must always hold, the cadence you check them, and the suspense-account workflow when they break.

## Why you'd care
Every system that records money will eventually go out of balance. Without explicit invariants + automated break detection, you find out at audit — by which time you've shipped wrong numbers to customers + investors for months and the auditor can't sign your statements. Real cost: a 10-day delayed close at a fintech costs ~$200k-$2M in audit + remediation + counsel fees, and tanks Series-B due diligence.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS → SKIP.
2. Read `docs/design/data-model.md` for entity model.
3. Read `docs/design/idempotency-<service>.md` (ledger writes MUST be idempotent).
4. If regulated: read `docs/compliance/regulator-relations-<project>.md`.

## Inputs
- Money-movement surfaces: payments-in, payments-out, transfers, fees, refunds, chargebacks, settlements, FX, interest accruals, write-offs.
- Counterparty types: customers, merchants, vendors, internal accounts, partner banks, processors.
- Asset classes held: fiat (which currencies), crypto (which assets), securities, gift cards, points/credits.
- Regulatory cadence: GAAP/IFRS, Reg DD for deposit accounts, Reg E error resolution windows, settlement timing.

## Process

1. **Choose ledger paradigm** — single-entry, double-entry, or triple-entry:

   | Paradigm | When to use | When to avoid |
   |---|---|---|
   | **Single-entry** (one row per movement) | Internal counters, points/credit, prepaid usage without real money | Anytime real money flows, regulated activity, multi-party movement |
   | **Double-entry** (debit/credit pair per entry, sum = 0) | Default for any product handling money, GL, settlement, payouts | Almost never wrong — overhead worth it |
   | **Triple-entry** (cryptographic third-party witness) | Crypto custody, on-chain settlement, high-trust marketplace escrow | Operational overhead; only when counterparties distrust each other |

   Default = double-entry. Single-entry is technical-debt-at-birth for any product that eventually adds payouts/refunds/FX.

2. **The canonical invariants** — these must hold at every commit boundary:

   - **I1 — Conservation**: `sum(debits) == sum(credits)` per journal entry. Always. No partial entries.
   - **I2 — Account equation**: `assets = liabilities + equity` at every point-in-time across the chart of accounts.
   - **I3 — Trial balance**: Sum of all account balances across the chart sums to zero (after closing entries).
   - **I4 — Period close immutability**: Once a period is closed, no journal entry may post to it. Adjustments must use a reversal + reposting in current period.
   - **I5 — Ledger continuity**: `account.balance = sum(entries.amount where account = X up to date)`. Recomputable from history (event-sourced).
   - **I6 — Idempotency**: Same external event id → at most one journal entry posted. Replay safe.
   - **I7 — Causality**: Every journal entry traces to an external business event (payment, transfer, refund, etc.) and is reproducible from it.
   - **I8 — Currency homogeneity**: A single journal entry posts in one currency; cross-currency requires explicit FX entries with rates pinned to a date.
   - **I9 — Cash on hand ≥ user liabilities**: For products that hold customer funds (FBO accounts), the segregated balance at the bank ≥ sum of user-facing balances at all times. (Real fines: PayPal $25M, Robinhood $30M, FTX terminal failure.)
   - **I10 — Settlement-aware available balance**: User's `available` ≠ user's `total`. Funds in transit / pending hold / freeze must be carved out. Show both balances.

3. **Chart of accounts (COA) skeleton**:

   ```
   1xxx Assets
     1100 Cash — operating (per bank per currency)
     1200 Cash — customer FBO (per bank per currency)
     1300 Receivables
     1400 Prepaid expenses
   2xxx Liabilities
     2100 Customer balances (per user)
     2200 Payables
     2300 Deferred revenue
     2400 Tax payable
   3xxx Equity
     3100 Retained earnings
     3200 Contributed capital
   4xxx Revenue
     4100 Transaction fees
     4200 Subscription
     4300 Interchange
     4900 Other revenue
   5xxx Cost of revenue
     5100 Processor fees
     5200 Bank fees
     5900 Reversal losses
   6xxx Operating expenses
   7xxx Other (interest, FX)
   9xxx Suspense / clearing
     9100 Cash-in suspense
     9200 Cash-out suspense
     9300 FX clearing
     9900 Unreconciled
   ```

   Every user has a sub-ledger account under 2100. Internal-control rule: a user-facing account can only credit/debit via posted journal entries — never direct UPDATE.

4. **Journal-entry schema** (minimum viable):
   ```sql
   CREATE TABLE journal_entry (
     id              uuid PRIMARY KEY,
     external_id     text UNIQUE NOT NULL,  -- idempotency
     description     text NOT NULL,
     business_event  text NOT NULL,         -- 'payment.captured' etc.
     posted_at       timestamptz NOT NULL,
     effective_date  date NOT NULL,         -- accounting period
     period_id       text NOT NULL,         -- YYYY-MM, FROZEN once closed
     created_by      text NOT NULL,
     reversal_of     uuid REFERENCES journal_entry(id)  -- corrections
   );
   CREATE TABLE journal_line (
     id              uuid PRIMARY KEY,
     entry_id        uuid REFERENCES journal_entry(id),
     account_id      text NOT NULL,          -- 1100, 2100-<user_id>, ...
     direction       text NOT NULL CHECK (direction IN ('debit','credit')),
     amount          numeric(20,4) NOT NULL CHECK (amount > 0),
     currency        char(3) NOT NULL,
     metadata        jsonb
   );
   -- I1 enforced by trigger or app:
   -- sum(debit) - sum(credit) == 0 per entry per currency
   ```

   Use integer minor units (cents, satoshis) or `numeric(20,4)` — never floats.

5. **Event → entry mapping table** — every business event names its journal recipe:

   | Event | Debit | Credit | Notes |
   |---|---|---|---|
   | payment.captured (card → user wallet) | 1100 cash-operating | 2100-<user> customer balance | Net of fees in separate entry |
   | processor.fee | 5100 processor fees | 1100 cash-operating | Fee posted concurrently |
   | refund.issued | 2100-<user> | 1100 cash-operating | Reverses original |
   | payout.requested | 2100-<user> | 9200 cash-out suspense | Pending bank confirmation |
   | payout.confirmed | 9200 cash-out suspense | 1100 cash-operating | Suspense cleared |
   | payout.returned | 1100 cash-operating | 2100-<user> | Reverses if NSF/bounce |
   | fx.conversion | 1100 src | 9300 FX clearing | Two-leg if rate differs |
   | interest.accrued | 5x interest expense | 2400 interest payable | Daily accrual |
   | chargeback.received | 2100-<user> + 5900 loss | 1100 cash-operating | Loss recognition |

   This table IS the design — every new feature must add rows before code ships.

6. **Suspense / clearing accounts** — the "I don't know yet" pattern:
   - Use a suspense (9xxx) account when one leg is known but the other isn't yet (e.g., money received but customer not identified)
   - **Hard rule**: every entry to suspense gets a workflow task with SLA (T+3 days resolve, escalate at T+5)
   - **Daily suspense report**: balance > 0 = work to do; aged buckets (0–3d / 3–7d / 7d+)
   - **Suspense should trend to zero** — non-zero steady state means a broken upstream pipeline

7. **Reconciliation cadence** — how you prove the books match reality:

   | Recon | Cadence | Source A | Source B | Tolerance |
   |---|---|---|---|---|
   | Bank vs GL (cash) | Daily | Bank statement | 1100 ending balance | $0 (any break = break) |
   | Processor vs GL | Daily | Stripe / Adyen settlement file | 1100 + 5100 movements | $0 |
   | User sub-ledger sum vs 2100 | Daily | sum(2100-<user>) | 2100 control account | $0 (I2) |
   | FBO bank vs user liabilities | Daily | FBO bank balance | sum(2100-<user>) | $0 (I9) |
   | FX revaluation | Daily | FX rates | 9300 + open positions | $0 |
   | Trial balance | Daily | sum of all account balances | 0 | $0 (I3) |
   | Subledger tie-outs (invoice, payout, refund) | Daily | Module DB | GL | $0 |
   | Bank fees | Monthly | Bank statement | 5200 | $0 |
   | Tax payable | Monthly | Tax engine | 2400 | $0 |

   Every break = open ticket. Owner = Controller / Treasury. Aging buckets reported to CFO weekly.

8. **Period close discipline** — monthly + annual:
   - **T+1 to T+5**: subledger close (AR, AP, payroll, depreciation)
   - **T+5 to T+8**: bank recs + sweeps + accrual entries
   - **T+8 to T+10**: management close — preliminary trial balance
   - **T+10**: period locked in software; flag set per I4
   - **T+10 to T+15**: financial statements + management report
   - Adjustments after lock = reversal in current period (never edit prior)
   - **Annual close**: external audit T+45 to T+90 for SOC1 / GAAP

9. **Out-of-balance break alerts** — what fires + when:
   - **Real-time**: I1 violation (entry doesn't balance) → reject + page (this should be impossible — trigger guards against bugs)
   - **Hourly**: I9 violation (FBO < user liabilities) → page Treasury + freeze new payouts
   - **Daily 06:00**: I2/I3 (trial balance not zero, control account doesn't match sublegder) → page Controller + Finance Eng
   - **Daily 09:00**: bank recon break > threshold → ticket
   - **T+3 / T+5 / T+7**: suspense aging → escalating ticket / page

10. **Anti-patterns** (real finance disasters):
    - Allowing UPDATE on balance fields → makes I5 unverifiable. Use journal entries only.
    - Single-entry with periodic "fix-up" jobs → tech debt eats the company; never reach SOC1
    - Float arithmetic on money — banker's rounding silently shifts pennies; auditors catch it after months
    - Suspense balance "tolerated" — every dollar in 9900 is a break someone deferred
    - No `period_id` lock — late-arriving journal entries silently restate prior months
    - Posting to user balance from multiple code paths (UI handler, webhook, batch job) without single ledger service → races, double-posts, lost entries
    - FX done at "current rate" instead of pinned date — auditor unwinds your books retroactively
    - Mixing customer FBO funds with operating cash — regulatory + criminal exposure
    - "We'll reconcile at month-end" — daily or you'll be 10 days into a $2M break with no idea where it started

11. **Lineage + auditability**:
    - Every journal entry traces to an immutable business event (event store / outbox table)
    - Every entry is reproducible: replay the events → identical entries
    - Reversal entries reference original; no in-place edits ever
    - Externally-visible balance = derived view, never a stored field that drifts

12. **Operational tooling** — what the finance team needs day-1:
    - **Trial balance viewer** with period selector
    - **Account drill-down** to journal lines + linked business events
    - **Suspense aging report** auto-emailed at 08:00
    - **Recon dashboard** with daily green/red per recon item
    - **Manual journal-entry tool** (controller-only, dual-control approval, audited)
    - **Period-close checklist** with sign-offs

## Output

Write `docs/design/ledger-<project>.md`:

```markdown
# Ledger Design — <project>
**Date:** <YYYY-MM-DD> | **Owner:** Controller + Finance Eng | **Approved:** CFO <date>

## Paradigm
- Double-entry, event-sourced
- Currency: integer minor units (cents). FX = explicit conversion entries.
- Period lock: monthly. Adjustments via reversal in current period only.

## Invariants (must hold at all commit boundaries)
- I1 conservation: per-entry debit-sum == credit-sum
- I2 account equation: assets = liabilities + equity
- I3 trial balance sums to zero
- I4 closed-period immutability (lock flag)
- I5 balance = sum(history) — recomputable
- I6 idempotent posting (external_id unique)
- I7 every entry traces to a business event
- I8 currency-homogeneous per entry
- I9 FBO bank ≥ sum(user balances) at all times
- I10 available vs total balance separated

## Chart of accounts (summary; full COA in /coa.csv)
| Range | Use |
|---|---|
| 1xxx | Assets (1100 operating, 1200 customer FBO) |
| 2xxx | Liabilities (2100 customer balances per user) |
| 3xxx | Equity |
| 4xxx | Revenue (4100 fees, 4200 subscription) |
| 5xxx | COGS (5100 processor fees) |
| 6xxx | OpEx |
| 9xxx | Suspense / clearing (9100 cash-in, 9200 cash-out, 9300 FX, 9900 unreconciled) |

## Event-to-entry mapping
| Business event | Debit | Credit | Notes |
|---|---|---|---|
| payment.captured | 1100 | 2100-<user> | + concurrent 5100/1100 for processor fee |
| payout.requested | 2100-<user> | 9200 | suspense until bank confirms |
| payout.confirmed | 9200 | 1100 | clears suspense |
| refund.issued | 2100-<user> | 1100 | |
| chargeback.lost | 2100-<user> + 5900 | 1100 | recognize loss |
| fx.conversion | 1100 USD | 9300 / 1100 EUR | pinned rate, two legs |
| interest.accrued | 5x | 2400 | daily |
| reversal | inverse | inverse | refs original entry id |

## Reconciliation register
| Recon | Cadence | A | B | Owner | Tolerance | Alert channel |
|---|---|---|---|---|---|---|
| Cash — operating bank | daily 06:00 | bank stmt | 1100 | Controller | $0 | #finance-breaks |
| Cash — FBO bank | daily 06:00 | FBO stmt | sum(2100) | Treasury | $0 | page |
| Processor settlement | daily 06:00 | settle file | 1100+5100 | Controller | $0 | ticket |
| Sub-ledger 2100 sum | daily 06:00 | sum(per-user) | control acct | Finance Eng | $0 | page |
| Trial balance zero | continuous | sum(all) | 0 | Finance Eng | $0 | page |
| FX revaluation | daily | rates × pos | 9300 + holdings | Treasury | $0 | ticket |
| Bank fees | monthly | bank stmt | 5200 | Controller | $0 | ticket |

## Suspense workflow
- Every suspense entry opens a ticket with SLA (3d resolve, 5d escalate)
- Daily 08:00 aging report to controller + CFO weekly
- Steady-state target: $0 in 9xxx

## Period close calendar
- T+1 to T+5: subledger close
- T+5 to T+8: bank rec + accruals
- T+8 to T+10: management close + trial balance
- T+10: period locked (I4 enforced)
- T+15: financial statements
- T+45 to T+90: annual audit

## Break-alert policy
- I1 violation → reject write + page (should be impossible)
- I9 violation → page Treasury + freeze new payouts
- I2/I3 violation → page Controller + Finance Eng
- Recon break > 0 → ticket within SLA per table
- Suspense aged >5d → page

## Tooling
- Trial-balance UI
- Account drill-down → entries → events
- Suspense aging email 08:00 daily
- Recon dashboard
- Manual journal entry (controller, dual control, audited)
- Period-close checklist

## Anti-patterns to avoid
- UPDATE on balance fields (use entries only)
- Single-entry "we'll upgrade later"
- Float math on money
- Suspense > 0 normalized
- Multi-path balance writes without single ledger service
- FX at "current rate"
- FBO commingled with operating cash
- Monthly-only recon

## Compliance / regulatory hooks
- FBO segregation per state MTL + FinCEN MSB rules
- 7-year retention on entries (records-retention)
- Lock + reversal traceable for SOX-style audit
- Audit-trail integrity per /chain-of-custody-financial
```

## Verification
- Double-entry chosen unless explicit single-entry justification.
- All 10 invariants named + enforcement mechanism noted.
- COA defined; user sub-ledger pattern explicit.
- Event-to-entry table includes every money-moving event.
- Every reconciliation has cadence + owner + tolerance + alert path.
- Period-close calendar dated with lock enforcement.
- Suspense aging SLA + escalation defined.
- No-UPDATE rule on balances stated.
- FBO segregation invariant (I9) called out if holding customer funds.
