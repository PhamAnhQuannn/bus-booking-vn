---
name: accounting-stack-pick
description: Pre-launch accounting stack pick — QBO vs Xero vs Pilot vs Bench vs Puzzle, chart of accounts, cash vs accrual, revenue recognition (ASC 606 / IFRS 15), expense + bill-pay integration, foreign currency, audit-readiness, close cadence. Outputs to `docs/inception/accounting-stack-pick-<project>.md`. Use when user says "accounting stack", "QuickBooks", "Xero", "Pilot", "bookkeeper", "chart of accounts", "/accounting-stack-pick", or right after bank account setup.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /accounting-stack-pick — Books Decided Year 1 = Audit Smooth Or Audit Pain Year 3.

## Why you'd care

A wrong chart-of-accounts at year one is a $50-150k migration plus three months of distorted reporting at Series B. Picking right on day one means your investor updates, audit, and tax filings stop being emergencies.

Accounting pick is forever-ish. Migration from QBO to NetSuite at Series B = $50-150k pain + 3-month operations distortion. Pick chart-of-accounts schema correctly day-1 so revenue recognition + investor reporting + audit prep work without surgery.

## Pre-flight
Run immediately after `/bank-account-setup`, before first invoice, before first expense, before first investor reporting cycle. Pairs with `/bookkeeping-cadence`, `/payroll-stack-pick`, `/payment-processor-pick`, `/three-statement-pro-forma`.

## Inputs
- Entity type + state.
- Revenue model (sub / one-time / usage / mixed).
- B2B vs B2C (B2B = invoicing + AR + A/R aging).
- Multi-currency? Multi-entity?
- Year-1 transaction volume estimate.
- DIY vs bookkeeper vs full-stack (Pilot / Bench).
- Funding stage (bootstrap = simplest; venture = ASC 606 + audit-ready from seed).
- Future audit horizon (Series B usually triggers; SaaS revenue recognition trickier).

## Process
1. **Pick base accounting software** — QBO (US default) vs Xero (international/multi-entity) vs Wave (free, limited) vs Sage / NetSuite (later stage).
2. **DIY vs outsourced** — DIY (founder-CFO) vs part-time bookkeeper vs Pilot / Bench / Puzzle (full-stack). Cost vs control.
3. **Cash vs accrual** — IRS allows cash up to $27M avg revenue; investors / lenders want accrual. **Default accrual from day-1** for SaaS.
4. **Chart of accounts** — pre-built SaaS template OR consulting CoA. Don't roll your own.
5. **Revenue recognition policy** — ASC 606 for US GAAP / IFRS 15 international. Subscription = recognize ratably; one-time = recognize on delivery. Document policy.
6. **Bank + processor + payroll integrations** — automated feeds eliminate manual entry errors.
7. **Expense + bill-pay tooling** — Ramp / Brex / Bill.com / Mercury Bill Pay.
8. **Multi-currency** — if applicable, enable from day-1 (retrofit painful).
9. **Close cadence** — monthly close target Day 5-15 of next month. Quarterly review.
10. **Audit-readiness baseline** — document retention, journal entry support, sub-ledger reconciliation.
11. **Investor reporting layer** — KPI dashboard (Pry / Mosaic / Causal / hand-rolled in Sheets).

## Output
Write `docs/inception/accounting-stack-pick-<project>.md`:

```markdown
# Accounting Stack Pick (Pre-launch) — <project>
**Owner:** founder / CFO / Head of Finance
**Date:** <YYYY-MM-DD>
**Fiscal year:** <Jan-Dec / custom>
**Reporting basis:** <Accrual / Cash>
**Functional currency:** USD
**Revenue model:** <SaaS sub / one-time / usage / mixed>

## Why this exists pre-revenue
- Migration off wrong base = $50-150k + 3-month distortion at Series B
- Wrong CoA day-1 = revenue cohorts unreportable later (CAC payback / cohort retention impossible to backfill)
- Cash basis day-1 = forced accrual re-statement at first audit (painful)
- "I'll clean it up later" never happens — books are the company's nervous system
- Investor due diligence requests historical financials; if books are messy, valuation hit or deal dies

## Base accounting software pick

| Software | Best for | Pricing (2026) | Pros | Cons |
|----------|----------|----------------|------|------|
| **QuickBooks Online (QBO)** | US default, < $20M revenue | $30-$200/mo | Universal accountant familiarity, integrations | Multi-entity is clunky, FX limited |
| **Xero** | International / multi-entity / multi-currency | $15-$78/mo | Strong multi-currency, clean UI | Smaller US accountant pool |
| **Wave** | Pre-revenue / very small | Free + paid features | Free | Limited reports, no accrual nuance |
| **FreshBooks** | Freelancers / sole proprietors | $19-$60/mo | Easy invoicing | Not for venture-track companies |
| **Sage Intacct** | $5M+ revenue, multi-entity | $400+/mo | Strong revrec + consolidation | Implementation cost |
| **NetSuite** | $20M+ revenue, complex | $$$$ | Enterprise depth | Implementation $50-200k |
| **Puzzle** | Modern SaaS, AI-first books | $50-$500+/mo | Investor-ready dashboards, faster close | Newer; smaller accountant pool |

**Our pick:** <software>

**Decision criteria:**
- US-only + standard SaaS: QBO or Puzzle
- International / multi-entity: Xero
- Bootstrapped < $200k revenue: QBO or Wave initially
- Venture-backed seed+: QBO + bookkeeper service, OR Puzzle
- $5M+ ARR or audit-imminent: consider Sage Intacct migration

## DIY vs outsourced

| Model | Cost/mo | Best for | Drawback |
|-------|---------|----------|----------|
| **DIY (founder)** | $0 + software | Pre-revenue / founder has finance background | Eats founder time + error-prone |
| **Part-time bookkeeper** | $300-$800 | Post-launch, < $1M revenue | Quality varies; you still own reconciliation |
| **Pilot** | $500-$2k | Seed+ venture, US, want hands-off | Pricier than freelance; bookkeeper-tier |
| **Bench** | $300-$500 | Cash basis, simple ops | Slower close, no accrual depth |
| **Puzzle (software + AI)** | $50-$500 | Modern SaaS, fast close | Less white-glove than Pilot |
| **Fractional CFO (Burkland / Graphite / Pilot CFO Services)** | $2-10k/mo | Series A+ | Full-service |
| **In-house controller** | $80-150k/yr | $5M+ ARR | Headcount commitment |

**Our pick:** <model>
**Trigger to upgrade:** <e.g. "raise Series A" / "ARR > $2M" / "audit required">

## Cash vs accrual

| Basis | When |
|-------|------|
| **Cash** | IRS allowed under $27M avg revenue; simpler |
| **Accrual** | GAAP standard; required for audit; required by most lenders + sophisticated investors |
| **Modified cash → accrual at year-end** | Avoid — re-statement pain |

**Recommendation:** **Accrual from day 1** for any SaaS / venture-track. Cash only if pure indie / no funding plans / no audit horizon.

**Our basis:** <cash / accrual>

## Chart of accounts (SaaS-flavored baseline)

**Use a template — do not roll from scratch.** Sources: QBO SaaS template, Pilot CoA, Burkland template, AICPA.

| Account # | Account | Type | Notes |
|-----------|---------|------|-------|
| 1000 | Cash — Ops | Asset | Linked to ops bank account |
| 1010 | Cash — Payroll | Asset | Separate account |
| 1020 | Cash — Tax Reserve | Asset | Separate |
| 1100 | Accounts Receivable | Asset | B2B invoicing |
| 1200 | Deferred Costs | Asset | Cap'd commissions (ASC 606) |
| 1500 | Fixed Assets | Asset | Computers, equipment |
| 1510 | Accumulated Depreciation | Asset (contra) | — |
| 2000 | Accounts Payable | Liability | Bills due |
| 2100 | Accrued Expenses | Liability | Unbilled work |
| 2200 | **Deferred Revenue** | Liability | **Subscription pre-paid revenue not yet earned — critical SaaS account** |
| 2300 | Payroll Liabilities | Liability | Withholding + employer tax |
| 2400 | Sales Tax Payable | Liability | Collected, owed to state |
| 2500 | Short-term debt | Liability | SAFE/notes if applicable |
| 3000 | Common Stock | Equity | — |
| 3100 | Preferred Stock | Equity | — |
| 3200 | APIC | Equity | Additional paid-in capital |
| 3300 | Retained Earnings | Equity | — |
| 4000 | **Subscription Revenue** | Revenue | Primary SaaS line |
| 4010 | One-time Revenue | Revenue | Setup fees, etc. |
| 4020 | Usage Revenue | Revenue | Metered |
| 4030 | Services Revenue | Revenue | Pro services |
| 4900 | Discounts & Refunds | Revenue (contra) | — |
| 5000 | **COGS — Hosting** | COGS | AWS / Vercel / Cloudflare |
| 5010 | COGS — Third-party APIs | COGS | OpenAI / Twilio / SendGrid |
| 5020 | COGS — Payment processing | COGS | Stripe fees |
| 5030 | COGS — Customer support | COGS | Support team % |
| 6000 | R&D — Salaries | Op-ex | |
| 6010 | R&D — Contractors | Op-ex | |
| 6020 | R&D — Software (dev tools) | Op-ex | |
| 6500 | S&M — Salaries | Op-ex | |
| 6510 | S&M — Ads + acquisition | Op-ex | |
| 6520 | S&M — Events | Op-ex | |
| 6530 | S&M — Tools | Op-ex | |
| 7000 | G&A — Salaries | Op-ex | |
| 7010 | G&A — Legal | Op-ex | |
| 7020 | G&A — Accounting | Op-ex | |
| 7030 | G&A — Insurance | Op-ex | |
| 7040 | G&A — Office | Op-ex | |
| 7050 | G&A — Software | Op-ex | |
| 8000 | Interest Income | Other | Treasury yield |
| 8100 | Interest Expense | Other | Venture debt |
| 8200 | FX Gain/Loss | Other | Multi-currency |
| 9000 | Tax expense | Tax | — |

**Class / department / location tracking:**
- Class: department (R&D / S&M / G&A) — drives op-ex segmentation
- Location: entity (if multi-entity)
- Customer: revenue cohort / customer-level P&L
- Project: capitalized cost tracking

## Revenue recognition policy (ASC 606 / IFRS 15)

**5-step framework:**
1. Identify contract with customer
2. Identify performance obligations
3. Determine transaction price
4. Allocate price to obligations
5. Recognize revenue as obligations satisfied

**SaaS subscription recognition:**
- Annual prepay $12k → recognize $1k/mo over 12 months
- $11k goes to **Deferred Revenue** (liability) on day-1
- Recognize $1k/month moving it to Subscription Revenue

**One-time:**
- Recognize on delivery (digital download = on access grant)

**Usage-based:**
- Recognize as consumed

**Set-up fees / activation fees:**
- Defer + recognize ratably if no standalone value
- Recognize on completion if standalone

**Commissions:**
- ASC 340-40: capitalize incremental commissions if expected contract > 1 year; amortize over estimated customer life

**Document policy:** `docs/finance/revrec-policy.md`. Auditor will ask year 1.

## Integrations

| Source | Tool | Sync method |
|--------|------|-------------|
| Bank | QBO bank feed / Plaid | Daily |
| Stripe | Native QBO Stripe connector OR Synder / A2X | Daily |
| Payroll | Gusto / Rippling / Justworks | Per-run journal entry |
| Bill-pay | Bill.com / Ramp / Brex / Mercury Bill Pay | Real-time |
| Expense cards | Brex / Ramp | Real-time |
| Inventory (if physical) | Shopify / Cin7 | Daily |
| CRM (for AR aging if B2B) | HubSpot / Salesforce | As-needed |
| ERP-grade revrec | Maxio (formerly Chargify+SaaSOptics) / Recurly Revenue / Sage Intacct revrec | At scale |

**Beware:** Stripe-to-QBO native connector logs gross, not net. Use Synder or A2X for clean Stripe deposits + fees split.

## Expense + bill-pay stack

| Tool | Fee | Best for |
|------|-----|----------|
| **Ramp** | Free (charge card) | US-first venture-backed, modern UX |
| **Brex** | Free (charge card) | Venture-backed, treasury included |
| **Mercury Bill Pay** | Free | If banking with Mercury |
| **Bill.com** | $45-$79/user/mo | AP automation, vendor portal |
| **Airbase** | $$ | Enterprise procurement |
| **Expensify** | $5-9/user | Receipts, mileage |

**Default:** Ramp or Brex card + Bill.com or Mercury Bill Pay for vendor AP.

## Multi-currency (skip if USD-only)
- Enable from day-1 if even one foreign vendor / customer
- Xero stronger than QBO for FX
- FX gain/loss tracked monthly
- Functional currency = USD; transaction currency varies
- Re-measurement quarterly (or monthly if material)

## Close cadence
- **Target close date:** day 10 of next month (faster post-Series A → day 5)
- **Close checklist:**
  - Bank reconciliation
  - Stripe / processor reconciliation (see `/payment-reconciliation`)
  - Payroll journal entries posted
  - Bill.com / AP cleared
  - Expense card transactions categorized
  - Deferred revenue waterfall calculated
  - Prepaid expenses amortized
  - Depreciation entries (if material)
  - Accruals (unbilled work, services rendered)
  - Sales tax payable verified
  - P&L review with founder/CFO
  - Balance sheet integrity check
  - Cash reconciliation to bank statement
  - Class / department tags spot-checked
- **Monthly investor pack:** P&L + balance sheet + cash + key SaaS metrics — see `/kpi-dashboard-investors`

## Audit-readiness baseline (even pre-audit)
- Every JE has a memo + supporting doc
- Sub-ledgers reconcile to GL monthly
- Bank reconciliations signed off
- Revenue recognition policy documented
- Material accounting estimates documented (commission cap, useful lives, customer life)
- Document retention 7+ years (see `/records-retention-pre`)
- Audit trail intact in software (don't delete entries; void instead)

## Investor reporting layer
- **Monthly investor update** (see `/investor-update-cadence`) pulls from books
- **KPI dashboard:** Pry / Mosaic / Causal / Sheets-rolled (see `/kpi-dashboard-investors`)
- **Three-statement model** updated monthly (see `/three-statement-pro-forma`)
- **Cohort analytics:** customer-level revenue tracking enabled in CoA (use Customer field)

## Cost estimate (year 1)

| Component | Cost/mo |
|-----------|---------|
| Software (QBO Plus) | $90 |
| Bookkeeper (part-time) | $400 |
| Bill.com / Ramp (free tier) | $0 |
| Stripe reconciliation (Synder) | $50 |
| **Total** | **~$540/mo / $6.5k/yr** |

Series A+ realistic: $2-5k/mo (Pilot or part-time controller).

## Anti-patterns
- ❌ "I'll catch up the books later" — pile-up never gets unwound
- ❌ Cash basis when investors expect accrual
- ❌ Roll-your-own chart of accounts → can't compare to industry benchmarks
- ❌ Stripe native connector posting gross-with-fees-in-COGS as gross revenue → revenue overstated
- ❌ Founder pays personal expenses with biz card "I'll reimburse"
- ❌ No deferred revenue account → SaaS revenue + balance sheet wrong
- ❌ Close happens at quarter-end only → no early signal
- ❌ Mixing customers / vendors / employees in same expense category
- ❌ No revrec policy doc → auditor blocks at Series B

## Pre-launch checklist
- [ ] Base software picked + subscribed
- [ ] Outsourced model picked (DIY / bookkeeper / Pilot)
- [ ] Cash vs accrual decided (accrual recommended)
- [ ] CoA seeded from template
- [ ] Class / dept / customer / project tracking turned on
- [ ] Bank feed connected
- [ ] Stripe / processor connected (Synder / A2X if applicable)
- [ ] Payroll connected
- [ ] Bill-pay tool wired
- [ ] Expense card integrated
- [ ] Multi-currency on (if needed)
- [ ] Revrec policy documented
- [ ] Close cadence + checklist saved
- [ ] First test close completed
- [ ] Investor KPI dashboard wired

## Next
- Bookkeeping cadence → `/bookkeeping-cadence`
- Payroll stack → `/payroll-stack-pick`
- Payment processor → `/payment-processor-pick`
- Three-statement pro-forma → `/three-statement-pro-forma`
- Investor reporting → `/investor-update-cadence`
- KPI dashboard → `/kpi-dashboard-investors`
- Records retention → `/records-retention-pre`
```

## Verification
- Base software picked.
- DIY vs outsourced decided.
- Accrual chosen for venture-track.
- CoA seeded from template (not rolled).
- Revrec policy documented.
- Integrations wired (bank / processor / payroll / bill-pay).
- Close cadence + checklist saved.
- Investor reporting layer named.
