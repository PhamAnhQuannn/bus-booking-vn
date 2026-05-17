---
name: data-room-bootstrap
description: Build investor data room — folder structure, doc inventory, access control, NDA flow. Outputs to `docs/inception/data-room-bootstrap-<project>.md`. Use when user says "data room", "VDR", "diligence room", "investor docs", "/data-room-bootstrap", or pre-Series A / post-term-sheet.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /data-room-bootstrap — Diligence Eats Your Week. Pre-Pack It.

## Why you'd care

The term sheet lands and the diligence list (40-60 items) arrives the same week — and the founder spends the next two weeks frantically generating cap tables, exporting bank statements, and chasing down old contractor IP assignments instead of running the company. That delay is the period during which markets move, the lead VC's IC re-debates, and "they're not ready" becomes the easy rationale for a re-trade. Pre-packing the room means signing in 2 weeks, not 4, and keeping the deal at the original valuation.

Once you have a term sheet, diligence runs 2-4 weeks. Pre-built data room = sign in 2, not 4. Saves the deal too — slow + chaotic = "they're not ready".

## Pre-flight
Run after `/sequoia-deck-skeleton`. Pairs with `/diligence-checklist`, `/investor-update-cadence`.

## Inputs
- Cap table.
- Financials (P&L, balance sheet, cash flow).
- Customer list + contracts.
- IP / patent / trademark filings.
- Org docs + corporate records.

## Process
1. **Pick a tool:** Docsend, Notion, Google Drive (locked), or VDR (Intralinks for late stage). Solo founders: Docsend or Notion.
2. **Folder structure first** — don't dump files into one folder.
3. **Doc inventory checklist** — what every diligence covers.
4. **NDA flow** — track who signed before access.
5. **Tracking** — who opened what, when, how long.
6. **Versioning** — date-stamp all docs, archive old versions.
7. **Live vs static** — financials should be current month, not 6 months stale.

## Output
Write `docs/inception/data-room-bootstrap-<project>.md`:

```markdown
# Data Room — <project>
**Tool:** Docsend / Notion / Drive / VDR
**Access:** request-only with NDA
**Last updated:** <YYYY-MM-DD>

## Folder structure
```
data-room/
├── 00-overview/
│   ├── pitch-deck.pdf
│   ├── one-pager.pdf
│   ├── product-demo-video.mp4
│   └── README.md (this file)
├── 01-corporate/
│   ├── certificate-of-incorporation.pdf
│   ├── bylaws.pdf
│   ├── board-consents/
│   ├── stockholder-consents/
│   ├── 83b-elections/
│   └── eIN-letter.pdf
├── 02-cap-table/
│   ├── current-cap-table.xlsx (Carta export)
│   ├── option-grants/
│   ├── SAFE-agreements/
│   ├── stock-purchase-agreements/
│   └── 409A-valuation-latest.pdf
├── 03-financials/
│   ├── monthly-P&L-current.xlsx
│   ├── balance-sheet.xlsx
│   ├── cash-flow.xlsx
│   ├── 3-year-projection.xlsx
│   ├── unit-economics.xlsx
│   ├── bank-statements/ (last 3 mo)
│   └── tax-returns/
├── 04-product/
│   ├── architecture-diagram.pdf
│   ├── tech-stack.md
│   ├── product-roadmap.pdf
│   ├── feature-matrix.xlsx
│   └── security-overview.pdf
├── 05-customers/
│   ├── customer-list.xlsx (top 20 by ARR)
│   ├── cohort-retention.xlsx
│   ├── case-studies/
│   ├── master-service-agreement-template.pdf
│   └── NPS-results.pdf
├── 06-team/
│   ├── org-chart.pdf
│   ├── employee-list.xlsx
│   ├── employment-agreements/
│   ├── contractor-agreements/
│   ├── advisor-agreements/
│   └── option-grant-policy.pdf
├── 07-IP/
│   ├── ip-assignment-master-list.xlsx
│   ├── patents/ (filings + grants)
│   ├── trademarks/
│   ├── domain-portfolio.xlsx
│   ├── open-source-license-audit.pdf
│   └── github-org-export.zip
├── 08-legal/
│   ├── customer-contracts/ (top 10)
│   ├── vendor-contracts/ (>$25k/yr)
│   ├── insurance-policies.pdf
│   ├── litigation-disclosure.pdf
│   └── regulatory-licenses/
├── 09-market/
│   ├── competitive-analysis.pdf
│   ├── market-research/
│   ├── analyst-reports/
│   └── press-clippings/
└── 10-prior-rounds/
    ├── seed-SAFE-summary.pdf
    ├── A-term-sheet-final.pdf
    └── investor-updates-archive/
```

## Document inventory checklist
### 00 — Overview
- [ ] Pitch deck (current)
- [ ] One-pager (PDF)
- [ ] Demo video link (Loom / YouTube unlisted)
- [ ] README explaining structure

### 01 — Corporate
- [ ] Certificate of incorporation (DE)
- [ ] Bylaws
- [ ] Board minutes (all, ordered)
- [ ] Stockholder consents
- [ ] All 83(b) elections filed
- [ ] EIN letter
- [ ] State qualifications (where doing business)

### 02 — Cap table
- [ ] Current cap table (Carta export)
- [ ] All option grants signed
- [ ] All SAFEs (pre-money + post-money distinction noted)
- [ ] Convertible notes (if any)
- [ ] 409A valuation < 12 months old
- [ ] Vesting schedules per grant

### 03 — Financials
- [ ] Monthly P&L (last 12 mo)
- [ ] Balance sheet
- [ ] Cash flow statement
- [ ] 3-year projection (model + assumptions)
- [ ] Unit economics breakdown
- [ ] Bank statements (last 3 mo)
- [ ] Tax returns (all years filed)
- [ ] Burn / runway dashboard

### 04 — Product
- [ ] Architecture diagram
- [ ] Tech stack doc
- [ ] Product roadmap (12-mo)
- [ ] Feature matrix
- [ ] Security overview / SOC 2 status

### 05 — Customers
- [ ] Top 20 customers + ARR
- [ ] Cohort retention curves
- [ ] 3-5 case studies
- [ ] MSA template
- [ ] NPS / CSAT results

### 06 — Team
- [ ] Org chart
- [ ] Employee list (title, start date, comp)
- [ ] All employment agreements (with IP assignment + non-compete where legal)
- [ ] Contractor agreements
- [ ] Advisor agreements

### 07 — IP
- [ ] IP assignment from every contributor
- [ ] Patent filings + grants
- [ ] Trademark registrations
- [ ] Domain portfolio
- [ ] OSS license audit
- [ ] GitHub org export

### 08 — Legal
- [ ] Top 10 customer contracts
- [ ] Material vendor contracts (>$25k/yr)
- [ ] Insurance policies (E&O, D&O, cyber, general liability)
- [ ] Litigation disclosure (yes/no + details)
- [ ] Regulatory licenses (if any)

### 09 — Market
- [ ] Competitive analysis
- [ ] Market research
- [ ] Analyst reports (Gartner / Forrester if relevant)
- [ ] Press clippings

### 10 — Prior rounds
- [ ] All prior term sheets + closing docs
- [ ] All investor updates (archive)

## Access control
| Stage | Who gets access | NDA required? |
|-------|----------------|---------------|
| Initial pitch | 00 only (overview) | No |
| Interest signal | 00 + 01 + 03 (high-level) | Soft NDA |
| Term sheet pending | All except 02, 06, 08 customer contracts | Yes |
| Term sheet signed | Full access | Yes + signed |
| Closing | Full + redline tracking | Lockup clause |

## NDA flow
1. Investor requests access → send Docsend mutual NDA link
2. Investor signs (DocuSign) → auto-add to data room with view-only
3. Trigger access expiry 14 days post-decline / pass
4. Watermark all PDFs with viewer email + timestamp

## Tracking
- Docsend / Notion analytics: page-by-page time
- Weekly review: who's active, who's stalled
- Slack alert on first view of "10 — prior rounds" (signal of deep diligence)

## Versioning
- All docs named `<topic>-<YYYY-MM-DD>.pdf`
- Archive old versions in `_archive/` subfolder
- Cap table: replace, don't update in place
- Financials: monthly snapshot, never overwrite

## Pitfalls flagged
- [ ] No file dumped into root
- [ ] All docs current month (financials not stale)
- [ ] NDA flow live before sharing
- [ ] Watermarking on
- [ ] Tracking on
- [ ] Access tiers locked
- [ ] Versioned filenames

## Anti-patterns
- ❌ "Email us and we'll send" — friction kills deals
- ❌ Stale financials (>30 days old)
- ❌ No NDA → investor forwards to competitor
- ❌ Missing 83(b) elections (deal-stopper)
- ❌ Unsigned advisor agreements (IP risk)
- ❌ Open Drive link with edit access

## Next
- Diligence prep → `/diligence-checklist`
- Investor update cadence → `/investor-update-cadence`
- Reference call prep → `/reference-call-prep`
- Term sheet literacy → `/term-sheet-literacy`
```

## Verification
- Folder structure built.
- 10 folder sections populated.
- NDA flow defined.
- Access tiers per stage.
- Tracking + watermarking on.
- All financials current month.
