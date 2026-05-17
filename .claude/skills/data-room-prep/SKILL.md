---
name: data-room-prep
description: Diligence data-room structure for Series A/B — folder taxonomy (financials/cap-table/legal/IP/customer/employment/tax), redaction policy, NDA wrapper, clean-room procedure for competitive-sensitive material. Outputs to `docs/inception/data-room-prep-<project>.md`. Use when user says "data room", "VDR", "Series A diligence", "Series B diligence", "due diligence prep", "diligence folder", "clean room", "redaction policy", "/data-room-prep", or after a term sheet lands. Upstream: `/cap-table-management`, `/investor-update-monthly`, `/kpi-dashboard-investor-grade`. Downstream: `/diligence-checklist`, `/reference-call-prep`. Distinct from `/data-room-bootstrap` (lighter pre-Series-A version) — this skill is the deeper Series A/B taxonomy + clean-room procedure.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 6h
---

# /data-room-prep — Diligence Either Closes the Deal Faster or Loses It

## Why you'd care

A term sheet is not a deal. Diligence is 2–4 weeks of investor lawyers, accountants, and analysts asking for documents you should already have in one place. A pre-built, well-organized data room signs in 2 weeks; a chaotic ad-hoc one signs in 4 — or never, because the buyer's diligence team interprets disorganization as a signal of operational risk. The Series A/B canon is a 7-folder taxonomy borrowed from corporate-M&A best practice (Latham, Cooley, Wilson Sonsini standard). Skip the redaction policy and you leak customer revenue / employee comp to a fund that may also back your competitor. Skip the clean-room procedure on competitive-sensitive material and you forfeit the deal-collapse-with-leak risk to the buyer.

## Pre-flight
- Read `/cap-table-management` — the cap-table folder is sourced from your single source of truth.
- Read `/investor-update-monthly` — paste the last 12 monthly updates into the customer/traction section.
- Read `/kpi-dashboard-investor-grade` — the metrics folder uses these definitions.
- Confirm a VDR or document-share tool: Docsend, DealRoom, Intralinks (late-stage), Box, or Notion (seed only — not appropriate for Series A+).
- Confirm legal counsel is engaged before populating the legal folder.

## Inputs
- Term sheet (drives which folders need depth: pricing, anti-dilution, board, etc.).
- Lead investor's standard diligence checklist (request it — most VCs will share their template).
- Existing financial records (P&L, balance sheet, cash flow, 13-week cash, AR aging).
- Cap-table source of truth (Carta, Pulley, Captable.io, or spreadsheet + lawyer-verified).
- All employment agreements, IP assignments, contractor agreements.
- All customer contracts, top-20 by ARR.
- Tax returns + state nexus filings.

## Process

1. **Pick the tool, not Notion.** For Series A/B the standard is Docsend (founder-grade), DealRoom or Intralinks (banker-grade), or sometimes Box / Google Drive with strict permissions. Notion lacks granular per-document access logs, watermarking, and dynamic-link expiry — fine for seed, malpractice for A+. The VDR's main jobs: per-user access control, granular access logs (who viewed what, when, for how long), watermarking with viewer email, and link expiry.

2. **Adopt the 7-folder taxonomy.** This is the corporate-M&A standard; deviation forces buyers' lawyers to re-map and slows diligence:

   ```
   00_Corporate/
     incorporation, bylaws, board minutes, prior financings
   01_Financials/
     P&L, balance sheet, cash flow, AR/AP, 13-week cash, budget, audited statements
   02_Cap_Table/
     cap table (current + as-converted), option ledger, SAFE / convertible note schedule, 409A
   03_Legal/
     MSAs, NDAs, vendor contracts, real-estate leases, pending litigation, settlements
   04_IP/
     IP assignment agreements (founders + employees + contractors), trademarks, patents, OSS license inventory
   05_Customer/
     top-20 contracts, MRR/ARR by customer, churn analysis, cohort retention, customer references list
   06_Employment/
     employee roster, offer letters, employment agreements, 1099 list, benefits plan, options grants log
   07_Tax/
     federal + state tax returns (3 years), sales-tax nexus filings, R&D credit study, transfer pricing
   ```

   Each folder gets a single `README.md` at its root listing its contents and last-updated dates. Make this human-readable; buyers' lawyers will skim.

3. **Folder-by-folder depth checklist:**

   **00 Corporate:**
   - Certificate of incorporation + every amendment
   - Bylaws (current version)
   - Stockholders' agreements (current + prior rounds)
   - Voting agreements
   - Investor rights agreements
   - All prior board meeting minutes (signed)
   - All prior board consents (signed)
   - All prior stockholder consents (signed)

   **01 Financials:**
   - 3 years of audited financials (Series B+) or reviewed (A) or in-house monthly (seed → A)
   - Current FY budget vs actual, monthly
   - 13-week rolling cash forecast
   - AR aging (top 20 customers)
   - AP aging
   - Stripe / payment-processor exports (raw transaction data, sanitized)
   - Bank statements (last 12 months)

   **02 Cap Table:**
   - Current cap table (issued + outstanding + as-converted)
   - Option-pool ledger (granted, exercised, cancelled, available)
   - SAFE / convertible-note schedule with valuation cap, discount, conversion mechanics
   - 409A valuation report (within last 12 months for option grants)
   - Pro-forma post-money cap table (this round)

   **03 Legal:**
   - All MSAs (customer side and vendor side)
   - All DPA / BAA / data-processing addenda
   - All NDAs (count + types; don't dump every one — list with reference)
   - Real-estate leases
   - All pending or threatened litigation with counsel memos
   - Settlements (last 5 years)
   - Regulatory inquiries / responses

   **04 IP:**
   - IP assignment agreements signed by every founder, employee, contractor (no gaps; missing one = deal-blocker)
   - Trademark registrations + applications
   - Patent registrations + applications
   - Domain-name ownership
   - Open-source license inventory (SBOM — see `/sbom-generate`)
   - Trade-secret protection policies

   **05 Customer:**
   - Top-20 customers by ARR with contract on file
   - MRR / ARR by customer for last 12 months
   - Cohort retention tables (matches `/kpi-dashboard-investor-grade`)
   - Churn analysis (logo + gross-dollar + net-dollar)
   - Customer reference list (pre-approved for diligence calls — see `/reference-call-prep`)
   - Customer satisfaction (NPS / CSAT if measured)

   **06 Employment:**
   - Current employee roster (name, role, start date, comp, equity)
   - All offer letters (signed)
   - All employment agreements (signed)
   - Contractor (1099) list with W-9s and IP assignments
   - Benefits plan documents
   - Options grants log (per-employee history)
   - Comp band documentation
   - Any pending HR claims / complaints (with counsel)

   **07 Tax:**
   - Federal tax returns (3 years)
   - State tax returns (every state with nexus)
   - Sales-tax nexus analysis + filings
   - R&D tax credit study + Form 6765
   - Transfer-pricing study (if applicable — international)
   - 1099-filings + W-2 totals

4. **Redaction policy — what to mask, what to leave clean.** Default rule: redact PII and customer-revenue per-customer below ARR threshold; do **not** redact things the investor's lawyers require to verify a representation:

   | Document | Redact | Leave clean |
   |---|---|---|
   | Customer contracts | Customer point-of-contact email/phone | Pricing, term, key clauses |
   | Employment agreements | SSN, home address, DOB | Comp, equity, IP assignment, NDA |
   | Customer revenue table | Customer name BELOW top-20 (use Customer A / B / …) | Top-20 named with ARR |
   | Cap table | Holder personal addresses | Holder names + share counts |
   | Bank statements | Account numbers (last 4 only) | Balances, transaction patterns |
   | Tax returns | Founder SSNs, EIN okay | Schedules, totals |

   Redactions must be **flat-image PDFs** (not text-box-overlay PDFs that can be uncovered with copy-paste). Use Adobe Acrobat redaction or a CLI tool like `qpdf` + `mutool` pipeline.

5. **NDA wrapper.** Every viewer signs an NDA *before* link access:
   - Standard mutual NDA, 3-year term, customer / supplier / employee non-solicit included.
   - Per-link NDA tracking in the VDR (Docsend supports this; DealRoom standard).
   - Carve-out: lead investor's lawyers operating under their firm's existing engagement letter need NDA confirmation but not personal signature.
   - Pipeline funds (early diligence, not lead) get a stricter NDA and shallower folder access (skip 06 Employment + 07 Tax until lead is identified).

6. **Tiered access — pipeline / lead / lead's-lawyers / accountants.** Not every viewer sees everything:

   | Viewer | 00 Corp | 01 Fin | 02 Cap | 03 Legal | 04 IP | 05 Cust | 06 Empl | 07 Tax |
   |---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
   | Pipeline VC (pre-term-sheet) | ✓ | summary | ✓ | summary | ✓ | summary (top-5 anon) | — | — |
   | Lead VC (post-term-sheet) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | summary | summary |
   | Lead's lawyers | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
   | Lead's accountants | — | ✓ | ✓ | — | — | ✓ (revenue) | summary | ✓ |
   | Co-investors | inherit lead access minus 06/07 unless lead approves |

7. **Clean-room procedure for competitive-sensitive material.** When a strategic investor (corporate VC) or a fund that has invested in your competitor wants diligence:
   - Set up a **separate clean-room sub-folder** (`98_Clean_Room/`).
   - Designate a clean-room counsel (often the investor's outside law firm, not their associates) as the only person who can access the unredacted competitive material (customer list, roadmap, pricing model, technical architecture).
   - Counsel produces a redacted / summary report for the investor's deal team.
   - Investor's deal team never sees raw competitive data.
   - Clean-room counsel signs a clean-room NDA with a stricter scope (no information transfer back to the fund's other portfolio companies).
   - This is standard FTC / HSR clean-room practice for any deal where competitive-sensitive material would leak otherwise.

8. **Access log + audit trail.** Every view is logged: user, document, timestamp, time-on-page, downloaded yes/no. Review the access log weekly during active diligence — sudden interest in 06 Employment by a lead's lawyer is a hiring-process red flag they're chasing; you can pre-empt with a 1:1.

9. **Versioning + freshness.** Every document carries a `last_updated` date in the filename or metadata: `01_PL_2026Q1_v2.pdf`. When a metric changes, ship a v3 with a changelog; never overwrite silently. Stale documents in the data room (>90 days for monthly data) are themselves a diligence finding.

10. **Pre-launch checklist (run before opening to first viewer):**
    - All 7 folders populated.
    - Each folder has a README with index.
    - Redactions applied as flat-image PDFs.
    - NDA wrapper live on every link.
    - Access tiers configured.
    - Clean-room sub-folder structured (even if empty).
    - Access log enabled.
    - Stale documents (>90 days) refreshed.
    - Counsel has reviewed the legal folder.

11. **Post-close cleanup.** When the deal closes:
    - Final cap table, signed docs, closing checklist filed in `00 Corporate/closings/<round>/`.
    - Lead VC retains permanent access; pipeline VCs lose access at close + 30 days.
    - Data room becomes the seed for the next round's data room (don't tear down — version forward).
    - Schedule a 90-day data-room refresh on the calendar.

12. **Anti-patterns to forbid:**
    - Google Drive with "anyone with the link can view" — no per-viewer audit.
    - PDFs with text-box redactions that can be copy-pasted (use flat-image only).
    - Sending the data-room link via email without per-recipient access tracking.
    - Letting pipeline VCs into 06 Employment / 07 Tax — they don't need it and it leaks comp.
    - Sharing competitive-sensitive material with a strategic VC without clean-room.
    - Letting the data room go stale during diligence (refresh monthly = signal of competence).
    - Counsel-bypass: founder uploads legal docs without counsel review.
    - Single share-link for all viewers — no granular revocation.

## Output

Write `docs/inception/data-room-prep-<project>.md`:

```markdown
# Data Room — <project>
**Stage:** <Series A / Series B / strategic round>
**Tool:** <Docsend / DealRoom / Intralinks / Box>
**Owner:** CEO + CFO + outside counsel
**Last refresh:** <YYYY-MM-DD>
**Re-refresh cadence:** monthly during diligence, quarterly otherwise

## Tool requirements
- Per-document access control + log
- Per-viewer watermarking (email)
- Link expiry (default 14 days, renewable)
- NDA wrapper at link-claim
- Granular revocation per-viewer

## Folder taxonomy
```
00_Corporate/         README.md + 8 sub-items
01_Financials/        README.md + 7 sub-items
02_Cap_Table/         README.md + 5 sub-items
03_Legal/             README.md + 7 sub-items
04_IP/                README.md + 6 sub-items
05_Customer/          README.md + 6 sub-items
06_Employment/        README.md + 8 sub-items
07_Tax/               README.md + 6 sub-items
98_Clean_Room/        README.md (clean-room counsel only)
99_Closing/           filed at close
```

## Document checklist (canonical Series A/B)
| Folder | Item | Status | Last updated |
|---|---|---|---|
| 00 | Certificate of incorporation + amendments | ✓ | <date> |
| 00 | Bylaws | ✓ | <date> |
| 00 | Stockholders' agreements | ✓ | <date> |
| 00 | Board minutes (all) | ✓ | <date> |
| 01 | Audited / reviewed financials (3 yrs) | ✓ | <date> |
| 01 | Monthly P&L vs budget | ✓ | <date> |
| 01 | 13-week cash forecast | ✓ | <date> |
| 01 | AR aging (top 20) | ✓ | <date> |
| 02 | Current cap table | ✓ | <date> |
| 02 | Option-pool ledger | ✓ | <date> |
| 02 | 409A report (<12mo) | ✓ | <date> |
| 02 | SAFE / note schedule | ✓ | <date> |
| 03 | MSAs (customer + vendor) | ✓ | <date> |
| 03 | DPA / BAA | ✓ | <date> |
| 03 | Litigation memos | ✓ | <date> |
| 04 | IP assignments (every employee + contractor) | ✓ | <date> |
| 04 | Trademarks + patents | ✓ | <date> |
| 04 | OSS license inventory (SBOM) | ✓ | <date> |
| 05 | Top-20 contracts | ✓ | <date> |
| 05 | MRR/ARR by customer | ✓ | <date> |
| 05 | Cohort retention | ✓ | <date> |
| 05 | Churn analysis | ✓ | <date> |
| 05 | Reference list | ✓ | <date> |
| 06 | Employee roster | ✓ | <date> |
| 06 | All offer letters | ✓ | <date> |
| 06 | Options-grant log | ✓ | <date> |
| 06 | Contractor 1099 list + W-9s | ✓ | <date> |
| 07 | Federal tax returns (3 yrs) | ✓ | <date> |
| 07 | State nexus filings | ✓ | <date> |
| 07 | R&D credit study | ✓ | <date> |

## Redaction policy
| Document | Redact | Leave clean |
|---|---|---|
| Customer contracts | Contact name/email/phone | Pricing, term, clauses |
| Employee agreements | SSN, home address, DOB | Comp, equity, IP, NDA |
| Customer ARR table | Customer names below top-20 (anon as Customer A/B/...) | Top-20 named with ARR |
| Cap table | Holder home addresses | Names + share counts |
| Bank statements | Account #s (last 4 only) | Balances, patterns |
| Tax returns | SSNs | EIN, schedules, totals |

Redactions are flat-image PDFs only (no text-box overlays).

## Tiered access
| Viewer | 00 | 01 | 02 | 03 | 04 | 05 | 06 | 07 | 98 |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Pipeline VC | ✓ | summary | ✓ | summary | ✓ | top-5 anon | — | — | — |
| Lead VC | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | summary | summary | — |
| Lead's lawyers | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Lead's accountants | — | ✓ | ✓ | — | — | revenue | summary | ✓ | — |
| Strategic / corp VC | per clean-room counsel summary only | | | | | | | | clean-room counsel only |

## NDA wrapper
- Mutual NDA, 3-year term, non-solicit included
- Per-link tracking
- Pipeline VCs: stricter NDA + shallower access
- Lead's lawyers: existing engagement-letter coverage

## Clean-room procedure
- Sub-folder `98_Clean_Room/`
- Clean-room counsel = sole accessor of competitive-sensitive material
- Counsel produces redacted summary for investor deal team
- Strict NDA scope (no transfer to other portfolio cos)
- Used when investor backs competitor or is corporate strategic

## Access-log review cadence
- Weekly during active diligence
- Anomalies flagged (e.g., sudden 06 Employment interest = potential CEO-replacement diligence)
- Monthly otherwise

## Versioning
- Filename convention: `<NN_doctype>_<period>_v<N>.pdf`
- Changelog in folder README
- Stale documents (>90 days, monthly data) trigger refresh

## Pre-launch checklist
- [ ] All 7 folders populated
- [ ] Per-folder README live
- [ ] Redactions flat-image only
- [ ] NDA wrapper on every link
- [ ] Tiered access configured
- [ ] Clean-room sub-folder structured
- [ ] Access log enabled
- [ ] Counsel reviewed legal folder
- [ ] All documents <90 days old

## Post-close
- Final docs filed in `99_Closing/<round>/`
- Pipeline VC access revoked at close + 30 days
- Data room versioned forward for next round
- 90-day refresh on calendar

## Anti-patterns enforced
- ❌ Google Drive "anyone with link"
- ❌ Text-box redactions (use flat-image)
- ❌ Pipeline VCs into 06/07
- ❌ Strategic VC into raw competitive material (use clean-room)
- ❌ Stale documents (refresh monthly during diligence)
- ❌ Founder-uploaded legal docs without counsel review
- ❌ Single shared link for all viewers

## References
- Cap table: `/cap-table-management`
- Monthly updates archive: `/investor-update-monthly`
- KPI definitions: `/kpi-dashboard-investor-grade`
- Reference calls: `/reference-call-prep`
- Diligence runbook: `/diligence-checklist`
```

## Verification
- All 7 folders populated; each has a README with last-updated dates.
- Redactions are flat-image PDFs, not text-box overlays (test: try to copy-paste from a redacted region — should fail).
- NDA wrapper enforced before any link grants access.
- Tiered access matrix configured per viewer category.
- Clean-room sub-folder structured even before strategic VCs are in process.
- Access log is reviewed weekly during diligence.
- All documents are <90 days old at first viewer access.
- Outside counsel has signed off on the legal folder before opening to lead's lawyers.
