---
name: tax-closeout
description: Year-end + quarterly tax closeout for a solo-dev SaaS: sales tax / VAT / GST, income tax prep, 1099s, books reconciliation. Outputs to `docs/finance/tax-closeout-<period>.md`. Reads `/project-classify` to skip XS. Use when user says "tax closeout", "year end", "quarterly tax", "VAT filing", "1099", "sales tax", "/tax-closeout", or before Jan 31 / Apr 15 / quarterly deadlines.
output_size:
  XS: skip
  S: 1h
  M: 4h
  L: 4h
  XL: 4h
---

# /tax-closeout — Close the Books Without Drama

Invoke as `/tax-closeout`. Tax season pain is a year-round problem you noticed in March. Quarterly closeout + clean books + handoff to accountant = no shoebox of receipts panic.

## Why you'd care

Missing a sales-tax filing or a 1099 deadline is a penalty that compounds monthly while you don't notice. A closeout cadence with the right artifacts is the difference between an audit-ready file and a year-end scramble.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS → SKIP.
2. Bookkeeping current (no > 30d unreconciled).
3. CPA / tax preparer engaged or self-filing checklist ready.

## Inputs
- Entity type (sole prop / LLC / S-corp / C-corp / Ltd / GmbH)
- Jurisdictions (home country + state + sales tax nexus states + VAT countries)
- Period (Q1/Q2/Q3/Q4/annual)
- Stack: bookkeeping (QBO/Xero/Wave), payments (Stripe/Paddle), tax-calc (Stripe Tax/Anrok/TaxJar)

## Process

1. **Books reconciliation** — first, always:
   - All bank accounts reconciled to statement
   - All credit cards reconciled
   - Stripe/Paddle payouts matched to bank deposits
   - Uncategorized transactions = 0
   - Owner draws / contributions tagged correctly
   - Fixed assets + depreciation entries posted

2. **Revenue truth-check** — three sources must agree:

   | Source | Number |
   |---|---|
   | Bookkeeping P&L revenue | $X |
   | Processor gross (Stripe + others) | $X minus fees + refunds = $Y |
   | Bank deposits net | $Y minus processor float |

   Mismatch > 1% → investigate before filing.

3. **Sales tax / VAT / GST** — by jurisdiction:

   | Region | Trigger | Rate source | Filing |
   |---|---|---|---|
   | US states | nexus (economic $100k or 200tx in most) | TaxJar / Stripe Tax | per state, monthly/quarterly |
   | EU | first €1 to EU consumer (OSS scheme) | Stripe Tax | quarterly OSS return |
   | UK | £85k threshold (or voluntary) | Stripe Tax | quarterly VAT return |
   | Canada | $30k GST/HST threshold | Stripe Tax | annual/quarterly |
   | Australia | $75k GST threshold | Stripe Tax | quarterly BAS |

   Reverse-charge B2B = no tax collected but report. Keep VAT-ID validations (VIES) per invoice.

4. **Income tax prep pack** — what CPA needs:
   - P&L for period
   - Balance sheet at period end
   - General ledger export
   - 1099s received (your contractor work)
   - 1099-Ks (processor: Stripe issues if > $20k + 200tx, threshold varies)
   - Bank/credit statements
   - Asset purchase receipts > $2,500 (capitalization candidates)
   - Home office sq-ft + total home sq-ft (if claiming)
   - Mileage log
   - Health insurance premiums (self-employed deduction)
   - Retirement contributions (SEP/Solo-401k)

5. **1099 issuance** — Jan 31 deadline (US):
   - List every contractor paid > $600 cash/check/ACH (NOT card — card is reported by processor)
   - Collect W-9s before first payment, not at year end
   - File 1099-NEC via processor (Gusto / track1099 / QBO)
   - Send copy to contractor + IRS by Jan 31
   - State filings separately if required

6. **Estimated taxes** — quarterly federal + state (US):
   - Q1: Apr 15, Q2: Jun 15, Q3: Sep 15, Q4: Jan 15
   - Safe harbor: pay 100% of prior year tax (110% if AGI > $150k) → no underpayment penalty
   - Or pay 90% of current year — riskier if income spiked
   - Self-employment tax: 15.3% on net SE income up to SS cap

7. **Deduction sweep** — common solo-dev:

   | Category | Notes |
   |---|---|
   | Home office | sq-ft % or simplified $5/sqft up to 300sqft |
   | Internet + phone | business-use % |
   | Software / SaaS | 100% if business |
   | Hardware | < $2,500 expense; > $2,500 capitalize + Sec 179 |
   | Conferences + travel | full if business; meals 50% (US) |
   | Health insurance | self-employed deduction (above the line) |
   | Retirement | SEP-IRA up to 25% of SE income; Solo-401k higher |
   | Professional fees | CPA, legal, contractor work |
   | Education | books, courses (if maintains/improves skill) |

8. **Doc retention**:
   - Tax returns: forever
   - Receipts / source docs: 7 years (US), varies by country
   - Payroll records: 4 years (US)
   - Sales tax docs: 4-6 years per state
   - Digital is fine if legible + dated; cloud backup mandatory

9. **Handoff to CPA**:
   - Shared folder with locked sub-folders by category
   - Q&A doc: known oddities, one-time events, big purchases
   - Prior year return for reference
   - 2-week buffer before filing deadline for back-and-forth

10. **Anti-patterns**:
    - Mixing personal + business in one account — months to untangle
    - Waiting to file sales tax until you "feel ready" — penalties compound
    - DIY income tax with foreign income / multiple states — false economy
    - W-9 collection at year-end — contractor won't respond
    - No estimated tax payments — April 15 surprise + penalty
    - "I'll catch up bookkeeping in December" — December you hates November you

## Output

Write `docs/finance/tax-closeout-<period>.md`:

```markdown
# Tax Closeout — <period> <YYYY>
**Date:** <YYYY-MM-DD> | **Owner:** <founder + CPA name>

## Books reconciliation
- [ ] Bank reconciled
- [ ] CC reconciled
- [ ] Stripe payouts matched
- [ ] Uncategorized = 0
- [ ] Depreciation posted

## Revenue truth
| Source | $ |
|---|---|
| P&L revenue | |
| Processor gross | |
| Bank deposit reconciliation | |
Delta: < 1%

## Sales tax / VAT
| Region | Collected $ | Filed | Due date |
|---|---|---|---|
| US-CA | | | |
| EU OSS | | | |
| UK | | | |

## CPA pack
- [ ] P&L
- [ ] Balance sheet
- [ ] GL export
- [ ] 1099s received
- [ ] 1099-K from Stripe
- [ ] Statements
- [ ] Asset receipts
- [ ] Home office
- [ ] Mileage log
- [ ] Health insurance
- [ ] Retirement contribs

## 1099 issued (Jan 31)
| Contractor | $ paid | W-9 on file | Filed |
|---|---|---|---|

## Estimated taxes
| Quarter | Due | Paid | Method |
|---|---|---|---|
| Q1 | Apr 15 | | |
| Q2 | Jun 15 | | |
| Q3 | Sep 15 | | |
| Q4 | Jan 15 | | |

## Deductions sweep
[List by category with $]

## Doc retention
- Stored: s3://archive/tax/<year>/
- Retention: 7y

## Notes for CPA
[Oddities, one-time events, questions]
```

## Verification
- Books reconciled (zero uncategorized).
- Revenue agrees across P&L / processor / bank within 1%.
- Sales tax filed in every nexus jurisdiction.
- 1099s issued by Jan 31.
- Estimated tax paid on each quarterly deadline.
- CPA handoff pack complete > 2w before filing deadline.
- Receipts archived to durable storage with 7y retention.
