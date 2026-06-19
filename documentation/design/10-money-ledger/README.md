> ← [Previous](../09-payment/) | [Index](../README.md) | [Next →](../11-concurrency/)

## 10. Money Correctness & Ledger

### 10.1 Append-Only Double-Entry Ledger

**What it is**: Every money event creates a new ledger entry — a row that records what happened, how much, and why. Entries are **never edited or deleted** (append-only). The balance is always computed by summing all entries (`SUM(amount)`), never stored as a mutable number.

**Why append-only?**
- An edited ledger entry destroys the audit trail. If someone changes `-500000` to `-50000`, there's no evidence.
- Append-only means every state is reconstructable — you can replay the ledger from entry #1 to derive the current balance.
- Enforced at the **database level**: the application role has `INSERT` permission on the ledger table but NOT `UPDATE` or `DELETE`. Even a bug in the application code can't corrupt history.

**Entry types**:

| Type | Direction | When | Example |
|------|-----------|------|---------|
| `booking_credit` | + (credit) | Customer pays for a trip | +450,000₫ |
| `platform_fee` | − (debit) | Platform takes its cut | −27,000₫ (6% of 450,000₫) |
| `refund_debit` | − (debit) | Operator cancels trip → clawback | −450,000₫ |
| `refund_out` | − (debit) | Money sent back to customer | −450,000₫ |
| `payout_debit` | − (debit) | Operator withdraws earnings | −423,000₫ |
| `payout_reversal` | + (credit) | Payout failed, money returned | +423,000₫ |
| `chargeback` | − (debit) | Bank dispute (card/PayPal) | −450,000₫ |
| `adjustment` | ± | Manual admin correction (with reason) | ±any |

### 10.2 BigInt — Why Integer Math for Money

**The problem with floating-point numbers**:

```javascript
0.1 + 0.2 = 0.30000000000000004  // NOT 0.3
```

Computers represent decimal numbers in binary, and many decimals (like 0.1) have infinite binary representations — so they're rounded. Over many transactions, these tiny errors accumulate.

**The solution**: Store all money as **integer minor units**. VND has no decimal places (no cents), so 450,000₫ is stored as the integer `450000`. All arithmetic is integer addition/subtraction — no floating point, no rounding errors.

**BigInt**: JavaScript's `Number` type is a 64-bit float that can only safely represent integers up to 2^53 (~9 quadrillion). That sounds large, but fee calculations involve multiplication: `450000 * 0.06 = 27000` — except with `Number`, `450000 * 0.06` might not equal exactly `27000` due to floating-point drift.

**BigInt** is JavaScript's arbitrary-precision integer type. It can represent integers of any size with zero rounding. We do ALL money math in BigInt:

```javascript
// Wrong (floating-point drift)
const fee = gross * 0.06;

// Correct (BigInt — exact)
const fee = (BigInt(gross) * BigInt(6)) / BigInt(100);
```

**ES2017 constraint**: Our build target doesn't support `6n` literal syntax. We use `BigInt(6)` constructor calls everywhere.

### 10.3 Platform Fee — FeeConfig

The platform takes a percentage of each booking as revenue. This rate is:
- **Not hard-coded** — stored in a `FeeConfig` database table
- **Per-operator overridable** — a new operator might get a lower rate as an incentive
- **Effective-dated** — rate changes apply from a specific date, not retroactively
- **Change-audited** — every rate change logged (who changed it, when, from what to what)

Rate is read at **credit time** (when the booking_credit ledger entry is created) and recorded on that entry — so even if the rate changes later, historical entries show the rate that was actually applied.

### 10.4 Balance States

Money flows through three states:

```
PENDING ─────────→ AVAILABLE ─────────→ PAID OUT
(trip not yet       (trip completed      (operator withdrew
 completed)          + T+1 settlement     to bank account)
                     delay passed)
```

- **Pending**: Customer paid, money credited to operator's ledger, but the trip hasn't happened yet. If the operator cancels the trip, this money gets clawed back (refund_debit).
- **Available**: Trip completed + 1 business day has passed (the T+1 settlement delay — a buffer for chargebacks/disputes). Operator can now withdraw.
- **Paid out**: Operator requested payout and money was sent to their bank account.

### 10.5 Settlement Delay — T+1

**T+1** means "Trip completion date plus 1 business day." Money becomes available for withdrawal 1 day after the trip is completed (marked as `status: completed` by the operator).

**Why the delay?**
- Chargebacks from credit card companies can arrive hours after payment
- Gives time for customer complaints (wrong bus, didn't depart) before the operator withdraws
- Standard practice in marketplace platforms (Uber, Airbnb all have settlement delays)

### 10.6 Chargeback Handling

**What is a chargeback?** When a customer disputes a credit card or PayPal charge with their bank. The bank forcibly reverses the payment — money leaves the platform account whether we agree or not.

**The dangerous scenario**: Customer pays → operator trip completes → operator withdraws earnings → chargeback arrives → money is already gone.

**How we handle it**:
1. `chargeback` ledger entry debits the operator's balance
2. If operator still has balance → covered
3. If operator's balance is insufficient → `payout_reversal` clawback + platform bad-debt backstop (platform absorbs the loss temporarily, recovers from operator later)
