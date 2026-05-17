---
name: bookkeeping-cadence
description: Pre-launch bookkeeping cadence — weekly/monthly/quarterly/annual rhythm, close checklist, reconciliation discipline, founder-vs-bookkeeper-vs-CFO RACI, investor-pack timing, escalation triggers. Outputs to `docs/inception/bookkeeping-cadence-<project>.md`. Use when user says "bookkeeping cadence", "monthly close", "reconciliation", "close calendar", "book-keeping rhythm", "/bookkeeping-cadence", or after `/accounting-stack-pick`.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /bookkeeping-cadence — Books Drift The Day You Stop Closing. Set The Calendar Before Month 1.

## Why you'd care

Books that miss a close compound errors silently and turn the first Series A diligence into a six-week archaeology dig. A locked monthly cadence catches cash leaks while they're days old, not quarters old.

Bookkeeping is not "do it when there's time". Books that aren't closed monthly compound errors, hide cash leaks, and make the first audit / Series A diligence a 6-week archaeology dig. Lock the cadence pre-launch.

## Pre-flight
Run after `/accounting-stack-pick` (need stack + DIY-vs-outsourced choice locked). Pairs with `/bank-account-setup`, `/payment-processor-pick`, `/payroll-stack-pick`, `/kpi-dashboard-investors`, `/investor-update-cadence`.

## Inputs
- Accounting stack pick (QBO / Xero / NetSuite / Puzzle / etc.)
- DIY-vs-outsourced model (founder-DIY / part-time bookkeeper / Pilot / fractional CFO / in-house)
- Cash vs accrual posture
- Revenue model (one-time / subscription / usage / services)
- Headcount (drives payroll cadence)
- Funding stage (pre-seed / seed / Series A — investor-pack expectations differ)

## Process
1. **Set weekly rhythm** — categorize, reconcile, AR/AP review.
2. **Set monthly close** — target day 5-10 of next month; full close checklist.
3. **Set quarterly review** — revrec spot-check, commissions, depreciation, estimated tax.
4. **Set annual cadence** — 1099/W-2 by Jan 31, corp filing, sales-tax annuals, audit prep.
5. **Reconciliation discipline** — bank / Stripe / payroll / AR / AP — frequency per source.
6. **RACI by task** — founder / bookkeeper / controller / fractional CFO / auditor.
7. **Investor-pack timing** — monthly by day N, quarterly KPI deck.
8. **Escalation triggers** — close slipping, unreconciled balances, variance to budget.
9. **Document + lock the calendar** before first transaction posts.

## Output
Write `docs/inception/bookkeeping-cadence-<project>.md`:

```markdown
# Bookkeeping Cadence (Pre-launch) — <project>
**Owner:** founder / Head of Finance / fractional CFO
**Date:** <YYYY-MM-DD>
**Stack:** <QBO / Xero / NetSuite / Puzzle>
**Model:** <DIY / part-time bookkeeper / Pilot / Bench / fractional CFO / in-house controller>
**Basis:** <cash / accrual>

## Why this exists pre-launch
- Books left to drift = month-3 close takes 3 weeks instead of 3 days
- Unreconciled cash hides fraud, double-charges, missed expenses
- Series A diligence wants 24+ months of clean closed monthlies — start now
- ASC 606 revrec demands monthly journal entries; can't catch up retroactively
- Tax filings (1099 / W-2 / sales tax / corp) have hard deadlines; missed = penalty + IRS letter

## Cadence overview

| Rhythm | Trigger day | Who | Time budget |
|--------|------------|-----|-------------|
| **Daily** | Mon-Fri | bookkeeper / auto-feed | 10 min |
| **Weekly** | Friday close | bookkeeper | 1-2 hr |
| **Monthly close** | Day 5-10 next month | bookkeeper + founder review | 1 day |
| **Quarterly review** | Within 15 days of Q-end | fractional CFO / controller | 1 day |
| **Annual** | Jan-Mar | accountant + auditor | 1-2 weeks |

## Daily
- Bank feeds auto-sync (Plaid / direct OFX)
- Stripe / processor payouts post to clearing account
- Payroll run posts JE (per run, not daily)
- Founder: nothing required (delegate or batch weekly)

## Weekly (Friday 30 min)
- [ ] Categorize all uncategorized bank transactions
- [ ] Categorize all uncategorized credit card transactions
- [ ] Reconcile primary operating bank account
- [ ] Review AR aging — flag invoices >30 days past due
- [ ] Review AP aging — schedule payments due next week
- [ ] File any new receipts (Ramp / Brex / Expensify capture)
- [ ] Tag any unclear transactions for founder review (Slack thread or shared doc)

**Founder weekly time:** 15-30 min review only.

## Monthly close (target day 5-10 of next month)

### Pre-close (last day of month)
- [ ] Run payroll if month-end falls before scheduled run; accrue if not
- [ ] Bill any unbilled customer work
- [ ] Capture all outstanding receipts / invoices

### Close steps (in order)
1. [ ] Reconcile all bank accounts (operating / payroll / tax-reserve / treasury)
2. [ ] Reconcile all credit cards / corporate cards
3. [ ] Reconcile Stripe / payment processor against deposits
4. [ ] Post payroll JE (gross wages / employer tax / benefits / 401k)
5. [ ] Post depreciation / amortization JE
6. [ ] Post accruals (unpaid bills received but not invoiced / accrued payroll)
7. [ ] Post prepaid expense amortization (insurance / SaaS annual prepays)
8. [ ] Post deferred revenue → revenue (ASC 606 ratable recognition)
9. [ ] Post commission capitalization + amortization (ASC 340-40 if applicable)
10. [ ] Review AR aging — write off uncollectible / book bad debt reserve
11. [ ] Review unusual GL accounts for misposted items
12. [ ] Reconcile intercompany if multi-entity
13. [ ] Run trial balance — confirm assets = liabilities + equity
14. [ ] Generate financials (P&L / BS / CF) + variance vs budget

**Lock the period** after founder sign-off — no retroactive edits.

### Founder review (day 8-10)
- 30-min review of monthly P&L, BS, cash position
- Variance commentary: what beat / missed vs budget and why
- Cash runway recalc — months remaining at current burn

## Quarterly (within 15 days of Q-end)
- [ ] Revrec spot-check — sample 10 contracts, verify ratable recognition matches ASC 606
- [ ] Commission cap reconciliation — verify amortization schedule current
- [ ] Fixed asset register review — depreciation methods correct, no missing assets
- [ ] Sales tax filings due quarterly in most states — verify nexus, file returns
- [ ] Federal estimated tax payment (corp): Apr 15 / Jun 15 / Sep 15 / Dec 15
- [ ] State estimated tax (varies)
- [ ] 401k contribution remittance verified
- [ ] R&D capitalization (Section 174) tracking current
- [ ] Cap table reconciliation against equity GL accounts
- [ ] Investor KPI deck (separate from monthly — see `/kpi-dashboard-investors`)

## Annual

### January (heavy month)
- [ ] **By Jan 31:** Issue 1099-NEC to contractors paid $600+
- [ ] **By Jan 31:** Issue W-2 to all employees
- [ ] **By Jan 31:** File 1096 transmittal + W-3 transmittal
- [ ] Reconcile payroll YTD to W-2s issued
- [ ] Reconcile contractor payments YTD to 1099s issued

### Q1
- [ ] Annual corporate tax filing prep (Form 1120 for C-corp)
- [ ] State franchise tax filings (Delaware $400 min + CA $800 min + state-by-state)
- [ ] Sales tax annual reconciliations
- [ ] Property tax filings (if owning equipment)
- [ ] 401k Form 5500 prep (if applicable)
- [ ] Audit prep if Series A+ requires (PBC list, lead schedules, reconciliations)

### March-April
- [ ] **Mar 15:** S-corp / partnership returns due (1120-S / 1065) — NA for C-corp
- [ ] **Apr 15:** C-corp return due (Form 1120) — or file extension Form 7004
- [ ] Q1 estimated tax payment

### Ongoing annual
- [ ] R&D tax credit study (if eligible — engage specialist)
- [ ] Section 174 R&D capitalization compliance
- [ ] FBAR filing if foreign accounts >$10k aggregate (FinCEN Form 114, due Apr 15)
- [ ] FATCA Form 8938 if foreign assets >threshold

## Reconciliation discipline (frequency by source)

| Source | Frequency | Tool | Sign-off |
|--------|-----------|------|----------|
| **Primary bank** | Weekly summary, monthly full | Plaid feed → QBO/Xero | bookkeeper |
| **Payroll bank** | Per payroll run + monthly | direct feed | bookkeeper |
| **Tax-reserve bank** | Monthly | direct feed | bookkeeper |
| **Treasury / MMF** | Monthly + interest accrual | manual statement | controller / CFO |
| **Stripe / processor** | Daily feed, weekly review, monthly tied to deposits | Synder / A2X | bookkeeper |
| **Corporate cards** | Weekly categorize, monthly close | Ramp / Brex feed | bookkeeper |
| **AR (invoices)** | Weekly aging review | QBO/Xero AR report | bookkeeper + founder |
| **AP (bills)** | Weekly aging review | Bill.com / Ramp Bill Pay | bookkeeper |
| **Payroll provider** | Per run JE + monthly tie | Gusto / Rippling export | bookkeeper |
| **Equity / cap table** | Quarterly | Carta / Pulley export | controller |

**Unreconciled threshold:** any account with >$100 unreconciled at month-end = escalate, do not close.

## RACI by task

| Task | Founder | Bookkeeper | Controller / fCFO | Auditor |
|------|---------|------------|-------------------|---------|
| Categorize transactions | I | R | A | — |
| Bank reconciliation | I | R | A | C |
| Payroll JE | I | R | A | — |
| Revrec JE (ASC 606) | I | C | R/A | C |
| Accrual JEs | I | C | R/A | C |
| Depreciation JEs | I | R | A | — |
| Commission cap (ASC 340-40) | I | C | R/A | C |
| Monthly close lock | A | R | C | — |
| Variance commentary | A | C | R | — |
| Investor pack | A | C | R | — |
| Tax filings | I | C | R | C |
| Audit response | I | C | R | A |
| Quarterly review | A | C | R | C |

R = responsible, A = accountable (sign-off), C = consulted, I = informed.

## Investor-pack timing

| Doc | Frequency | Due day | Audience |
|-----|-----------|---------|----------|
| **Monthly P&L / BS / CF** | Monthly | Day 10 next month | board + lead investor |
| **Monthly KPI dashboard** | Monthly | Day 10 next month | board + lead investor |
| **Monthly investor update email** | Monthly | Day 10-15 | full investor list |
| **Quarterly board pack** | Quarterly | 2 wk before board | board |
| **Annual financials** | Annual | Mar 31 | board + lead investor |
| **Audit / review report** | Annual (Series A+) | Q1 | board + future diligence |

See `/kpi-dashboard-investors`, `/investor-update-cadence`, `/board-meeting-cadence`.

## Escalation triggers
Hard rules — written, enforceable.

- Close slips past day 15 → founder + CFO syncs, root-cause it
- Unreconciled balance >$X (set per stage, e.g. $500 pre-seed / $5k seed) → block close
- Bank balance mismatch vs GL > 3 days → daily checkin until resolved
- AR aging >60 days >X% of total → collections action + write-off conversation
- Variance to budget >20% on any GL line → variance memo in monthly review
- Sales-tax filing missed deadline → file immediately + pay penalty + audit posting process
- Payroll tax deposit late → escalate immediately (IRS penalty escalates daily)

## Tooling integrations checklist
- [ ] Bank feeds via Plaid / direct OFX → accounting stack
- [ ] Credit card feeds (Ramp / Brex / Mercury card) → accounting stack
- [ ] Stripe → Synder or A2X → accounting stack (NOT native QBO connector)
- [ ] Payroll provider (Gusto / Rippling) → accounting stack via integration or JE
- [ ] Bill-pay (Bill.com / Ramp Bill Pay) → accounting stack
- [ ] Expense capture (Ramp / Brex / Expensify) → accounting stack
- [ ] Receipt capture mobile app for founder

## Document storage
- Receipts: cloud-attached to transaction in accounting stack (7-yr retention)
- Bank statements: download PDF monthly to cloud archive
- Tax filings: cloud archive permanently
- Audit support: lead schedules per account permanently
- Contracts / invoices: cloud + accounting stack attachment

## Year-1 cost estimate

| Item | Monthly |
|------|---------|
| Accounting software | $30-80 |
| Bookkeeper (part-time / Pilot / Bench) | $300-2000 |
| Bill-pay tool | $0-79 |
| Receipt capture | $0 (Ramp/Brex included) |
| Sales-tax engine (if applicable) | $50-300 |
| **Year-1 total** | **$380-2500/mo** |

## Anti-patterns
- ❌ "Close when I have time" — books drift 3 weeks per month skipped
- ❌ Reconcile only at year-end → 12 months of compounded errors
- ❌ No close lock → numbers change retroactively, audit nightmare
- ❌ Founder doing it all year 2 — bookkeeper cheap, founder time expensive
- ❌ No variance commentary → numbers without story
- ❌ Skip revrec JEs — ASC 606 violation, restate at audit
- ❌ Mixing personal + business → piercing the corporate veil + tax mess
- ❌ Not filing 1099s by Jan 31 → $290 per form penalty + IRS audit flag
- ❌ Late payroll tax deposit → 2-15% penalty + interest
- ❌ Stripe gross-to-net not split → revenue + COGS both wrong

## Pre-launch checklist
- [ ] Weekly Friday rhythm scheduled
- [ ] Monthly close target day set (day 5-10)
- [ ] Close checklist documented (14 steps)
- [ ] Quarterly review cadence scheduled
- [ ] Annual deadlines on calendar (Jan 31 / Mar 15 / Apr 15 / etc.)
- [ ] RACI assigned per task
- [ ] Reconciliation frequency per source set
- [ ] Investor-pack timing locked
- [ ] Escalation triggers documented
- [ ] Tooling integrations live before transaction #1

## Anti-patterns flagged
- ❌ No close calendar
- ❌ Reconciliation skipped
- ❌ No close lock
- ❌ Tax deadlines uncalendared
- ❌ No RACI → tasks fall through
- ❌ No escalation triggers
- ❌ Investor pack ad-hoc / late

## Quarterly review of cadence itself
- Are closes hitting day 10?
- Unreconciled balance trend?
- Variance commentary quality?
- Audit prep readiness vs prior quarter?
- Bookkeeper bandwidth — too thin / overspent?
- Tooling friction points

## Next
- Payroll → `/payroll-stack-pick`
- Investor reporting → `/kpi-dashboard-investors`, `/investor-update-cadence`
- Board cadence → `/board-meeting-cadence`
- Audit prep → `/audit-readiness` (post-launch)
```

## Verification
- Weekly / monthly / quarterly / annual rhythms defined.
- 14-step monthly close checklist.
- Reconciliation frequency per source set.
- RACI per task explicit.
- Investor-pack timing locked.
- Escalation triggers written.
- Tooling integrations checklist.
- Anti-patterns enumerated.
