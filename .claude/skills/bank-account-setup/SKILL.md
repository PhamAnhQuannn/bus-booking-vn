---
name: bank-account-setup
description: Pre-launch business banking pick — traditional vs neobank, FDIC sweep + treasury, KYB pack, signature controls, fraud controls, account separation, multi-currency, OFAC posture, FBAR/FATCA triggers. Outputs to `docs/inception/bank-account-setup-<project>.md`. Use when user says "bank account", "business banking", "neobank", "Mercury", "Brex", "Relay", "treasury", "FDIC", "/bank-account-setup", or right after formation.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /bank-account-setup — First Wire Decides Six Things. Pick Bank Before You Sign A Customer Or Take An Investor Dollar.

## Why you'd care

Post-SVB-2023, the banking pick is a runway-protection decision: FDIC caps at $250k, sweep programs vary, and a KYB delay can hold up your first customer wire by two weeks. Pick wrong and you're either undiversified or stuck waiting on docs the week revenue is supposed to land.

Banking pick is not commodity. Post-SVB-2023, bank choice = runway-protection choice. FDIC stops at $250k, sweep programs stack, neobanks vs traditional trade off speed-vs-relationship, and KYB delays kill founder week-1. Pick before EIN dries.

## Pre-flight
Run immediately after formation (EIN issued + state docs filed) and before any customer payment, payroll run, or investor wire. Pairs with `/jurisdiction-pick`, `/payment-processor-pick`, `/accounting-stack-pick`, `/payroll-stack-pick`.

## Inputs
- Entity type + state (Delaware C-Corp / LLC / foreign-qualified).
- EIN letter + formation docs ready.
- Funding stage (bootstrap / pre-seed / seed / Series A+).
- Expected runway in cash (drives FDIC sweep urgency).
- Geography of customers + vendors (USD only / multi-currency).
- Beneficial owners list (≥25% per FinCEN CTA).
- Industry (regulated? cannabis / crypto / firearms / adult → many banks refuse).

## Process
1. **Confirm KYB pack ready** — EIN letter, formation docs, operating agreement / bylaws, beneficial owner IDs, registered agent address, business address proof. Missing item = 2-week delay.
2. **Pick primary bank model** — traditional (Chase / BoA / First Citizens) vs neobank (Mercury / Brex / Relay) vs hybrid. Decision table below.
3. **Account architecture** — ops / payroll / tax-reserve / savings. Separate accounts, not "we'll track it in QBO".
4. **FDIC sweep + treasury** — if runway > $250k cash, mandatory sweep program (post-SVB). Multi-bank if > $5M.
5. **Signature + access controls** — who can wire, ACH limit, dual approval threshold, view-only vs spend.
6. **Fraud controls** — positive pay, ACH block, wire callback rule, alert rules.
7. **Integration plan** — accounting stack, payroll, payment processor, expense card.
8. **Multi-currency / international** — only if needed; adds complexity + fees.
9. **OFAC + sanctions posture** — vendor screening, customer screening if regulated.
10. **FBAR / FATCA check** — foreign accounts > $10k aggregate = FBAR filing required.
11. **Document + lock** — write decision doc, store credentials in shared vault (1Password / Bitwarden), set 90-day review.

## Output
Write `docs/inception/bank-account-setup-<project>.md`:

```markdown
# Bank Account Setup (Pre-launch) — <project>
**Owner:** founder / CFO / Head of Finance
**Date:** <YYYY-MM-DD>
**Entity:** <Delaware C-Corp / LLC / etc.>
**EIN:** <xx-xxxxxxx>
**State of formation:** <Delaware / Wyoming / etc.>
**Funding stage:** <pre-seed / seed / Series A>

## Why this exists pre-revenue
- Post-SVB-2023: bank choice = runway-protection choice. $250k FDIC cap is real.
- KYB delays kill founder week-1 — pack incomplete = 2 weeks lost
- Comingling personal + business = piercing the corporate veil
- Wire fraud = average loss $130k (2024 FBI IC3 data); founder click on spoofed invoice
- Industry classification (regulated → cannabis / crypto / adult / firearms / gambling) means many banks will refuse — find out now, not after first deposit

## KYB documentation pack
- [ ] EIN confirmation letter (CP575 or 147C)
- [ ] Certificate of Incorporation / Articles of Organization
- [ ] Operating Agreement (LLC) or Bylaws (Corp)
- [ ] Stock ledger / cap table snapshot
- [ ] Beneficial owner IDs (passport / driver license) for every ≥25% owner — FinCEN CTA requirement
- [ ] Registered agent confirmation
- [ ] Business address proof (lease / utility / virtual office contract)
- [ ] Foreign qualification certificates (if operating outside state of formation)
- [ ] Business license (if industry requires)

**FinCEN Beneficial Ownership Information (BOI) report:** filed separately at FinCEN.gov within 30 days of formation. Bank does not file for you.

## Bank pick — traditional vs neobank

| Dimension | Traditional (Chase / BoA / First Citizens) | Neobank (Mercury / Brex / Relay) | Hybrid (primary neobank + traditional backup) |
|-----------|-------------------------------------------|----------------------------------|-----------------------------------------------|
| Account opening | 1-3 weeks, in-person sometimes | Same-day to 3 days, online | 3-5 days combined |
| FDIC | $250k direct | $250k via partner bank + sweep stacks ($3M-$125M coverage) | Best of both |
| Wire speed | Same-day if before cutoff | Same-day, API-driven | — |
| Wire fees | $25-35 outgoing | Often free for incoming, $0-25 outgoing | — |
| ACH | Standard, sometimes 3-day | Same-day available | — |
| International wires | Yes, expensive ($45+) | Wise integration cheaper | — |
| Multi-currency | Yes (Citi / HSBC / First Citizens) | Wise / Mercury multi-currency limited | — |
| Treasury / sweep | Money market funds, T-bill ladders | Built-in (Mercury Treasury / Brex Yield) | — |
| Credit card | Yes, real underwriting | Often charge card not credit card (Brex / Ramp) | — |
| Relationship | Branch banker — useful for debt later | API + chat support, no banker | — |
| Lending | SBA / commercial loan eligibility | Limited; venture debt requires bank relationship | — |
| Compatibility with VCs | Universal | Universal; some VCs prefer traditional for clearing | — |
| Failure scenario | Bank fails (rare for top-10) | Partner bank fails — sweep program means depositor protected up to coverage cap | — |

**Decision:** <pick + justification>

**Recommended posture:**
- Pre-seed / seed bootstrapped: Mercury or Relay primary, no traditional needed yet
- Seed funded (cash > $250k): Mercury Treasury or Brex Yield for sweep; add traditional secondary if institutional investors require
- Series A+: Hybrid — neobank for ops + traditional for treasury/debt relationship

## Account architecture

| Account | Purpose | Approval | Notes |
|---------|---------|----------|-------|
| **Ops checking** | Day-to-day expenses, vendor payments | Founder + 1 | Keep balance < $50k; sweep rest |
| **Payroll** | Funded weekly before payroll run | Founder | Separate to limit fraud blast radius |
| **Tax reserve** | Quarterly estimated taxes + sales tax + payroll tax | View-only for most | Never spend |
| **Treasury / sweep** | Cash > 90-day runway | Founder + board approval > $X | Money market / T-bill / sweep program |
| **Savings (FDIC layer)** | Diversification across banks | Founder | Only if treasury yield not desired |
| **Multi-currency (if global)** | EUR / GBP / etc. | Founder | Wise Business or Mercury Multi-currency |

**Comingling rule:** zero personal expenses on business accounts. Reimburse via expense report. Every transaction must categorize cleanly in `/accounting-stack-pick`.

## FDIC sweep + treasury

| Cash position | Action |
|---------------|--------|
| < $250k | Single account, FDIC standard |
| $250k - $1M | Neobank sweep program (Mercury / Brex spread across 10-20 partner banks) |
| $1M - $5M | Sweep + money market fund parallel |
| $5M - $20M | T-bill ladder + sweep + 2nd bank |
| > $20M | Hire fractional CFO / treasury manager; T-bills + investment-grade corporate paper laddered |

**Post-SVB lesson:** never single-bank > $250k unless using a sweep program that is documented + audited. Read the fine print on sweep — confirm coverage limit, partner bank list, daily vs same-day liquidity.

**Our cash position:** <amount>
**Our sweep / treasury plan:** <details>

## Signature + access controls
- **Wire authorization tiers:**
  - < $5k: founder alone
  - $5k - $50k: founder + co-founder dual approval
  - > $50k: founder + board notify
  - > $250k: board approval
- **ACH limits:** daily $X, monthly $Y
- **View-only access:** accountant, fractional CFO, auditor
- **Spend access:** founder + co-founder only
- **Card access:** every employee with Brex / Ramp / Mercury card; spend rules per role

## Fraud controls
- **Positive pay** (traditional bank) — check fraud blocker
- **ACH block / filter** — block unrecognized originators
- **Wire callback rule** — never wire > $10k without phone-verified callback to known number (not number in email)
- **Email spoofing** — every wire request from CEO via email = call to verify, no exceptions
- **2FA on all banking logins** — hardware key (YubiKey) preferred, SMS-OTP only as fallback
- **Alerts:** every wire, every login, every new payee added
- **Quarterly review:** active users, dormant logins, payee list

**Founder rule:** if you ever feel rushed to wire money, slow down. Wire fraud relies on urgency.

## Integration plan
- **Accounting:** bank feed → QBO / Xero / Pilot / Bench (see `/accounting-stack-pick`)
- **Payroll:** bank-to-payroll funding via ACH (see `/payroll-stack-pick`)
- **Payment processor:** Stripe / Adyen payout to bank (see `/payment-processor-pick`)
- **Expense cards:** Brex / Ramp / Mercury Card auto-categorization
- **Bill pay:** Bill.com / Mercury Bill Pay / Ramp Bill Pay
- **API access:** Mercury / Brex / Modern Treasury for programmatic payments (if product needs)

## Multi-currency / international (skip if USD-only)
- Wise Business — best rates, multi-currency account, mid-market FX
- Mercury Multi-currency — USD + EUR + GBP
- HSBC / Citi — best for true global treasury
- **FX hedging** — not needed pre-Series A; revisit when FX exposure > 10% revenue
- **Receiving foreign payments** — local IBAN / sort code via Wise / Mercury saves recipient fees

## OFAC + sanctions posture
- **Vendor screening:** auto-screen via accounting / bill-pay tool (Ramp + Bill.com do this)
- **Customer screening:** required if regulated (fintech / crypto / arms / dual-use); SDN list + OFAC consolidated list
- **Sanctions hits:** freeze + report within 10 days
- **Country sanctions:** no payments to / from comprehensively sanctioned jurisdictions (Cuba / Iran / NK / Syria / Crimea + DNR/LNR / Russia partial)

## FBAR + FATCA
- **FBAR (FinCEN Form 114):** required if aggregate foreign account balance > $10k at any point in year. Filed by April 15 (auto-extension to Oct 15). Personal + entity both required if signatories.
- **FATCA (Form 8938):** required if foreign accounts > thresholds (corp: $50k EOY / $75k anytime). Filed with tax return.
- **Foreign account counted:** any non-US bank, brokerage, or signature authority

## Industry-specific blockers

| Industry | Banks that often refuse | Alternative |
|----------|------------------------|-------------|
| Cannabis | Most major banks | Safe-harbor banks: Dama / Safe Harbor Financial / select credit unions |
| Crypto / web3 | Most major banks; SVB-Mercury historically friendly | Mercury (case-by-case), Customers Bank, Lead Bank |
| Firearms / adult | Major banks varying | Specialty processors required |
| High-risk MCC | Most refuse | Need merchant account first via specialty processor |
| Stablecoin issuer | Highly regulated | Cross River / Customers Bank / Anchorage |

## Documentation + storage
- All bank credentials in shared password vault (1Password / Bitwarden Business)
- 2FA seed backups in secure offline (not phone Notes app)
- Account opening docs in `docs/legal/banking/`
- Wire instruction sheet for each vendor in vendor-master file
- Quarterly statement archive (Drive / S3) — 7-year retention

## Cost estimate (year 1, neobank-primary)
- Account fees: $0 (most neobanks)
- Wires (10/yr outgoing): $0-250
- Sweep program: $0-15bp depending on yield
- Cards: $0-150 issuance
- Multi-currency: 0.4-0.6% FX margin per conversion
- Treasury yield: 4-5% on swept cash (2026 rates)

**Total:** ~$0-500/yr in fees + 4-5% yield offset on idle cash

## Pre-launch checklist
- [ ] KYB pack complete (every item above)
- [ ] FinCEN BOI report filed
- [ ] Primary bank picked + applied
- [ ] Account architecture set up (ops / payroll / tax / treasury)
- [ ] FDIC sweep configured if cash > $250k
- [ ] Wire callback rule written + shared
- [ ] 2FA on every login
- [ ] Signature tiers documented
- [ ] Bank feed connected to accounting stack
- [ ] Vault entry created for credentials
- [ ] Quarterly review scheduled

## Anti-patterns
- ❌ Single bank, no sweep, cash > $250k
- ❌ Comingling personal + business
- ❌ Founder solo wire authority unlimited
- ❌ Email-only wire approval (CEO impersonation fraud)
- ❌ SMS-OTP only on banking 2FA
- ❌ No tax-reserve account → quarterly tax surprise
- ❌ "We'll separate accounts later" — never happens
- ❌ Skipping FinCEN BOI report (penalties up to $10k/day)
- ❌ Cannabis / crypto founder applying at Chase without disclosure

## Next
- Payment processor → `/payment-processor-pick`
- Accounting stack → `/accounting-stack-pick`
- Bookkeeping cadence → `/bookkeeping-cadence`
- Payroll stack → `/payroll-stack-pick`
- Insurance → `/insurance-policy-pick`
```

## Verification
- KYB pack listed.
- FinCEN BOI flagged.
- Bank model picked with justification.
- Account architecture with separation.
- FDIC sweep + treasury tier matched to cash position.
- Signature tiers + wire callback rule explicit.
- Fraud controls written.
- Integration plan named.
- FBAR / FATCA triggers checked.
- Industry-specific blockers screened.
