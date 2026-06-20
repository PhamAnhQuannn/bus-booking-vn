# Pre-Launch Compliance Timeline — Vietnam

> Cross-domain timeline. See individual regulatory files for deep dives.
> Last researched: June 2026.

## Blocking Dependency Map

```
IRC (15 wd statutory / 3-5 wk actual)
  └─► ERC (3-7 wd)
        ├─► Tax registration (10-20 days)
        │     └─► E-invoice registration (GDT portal + MISA)
        ├─► Bank account (DICA)
        │     └─► PSP merchant onboarding (VNPay / MoMo production)
        └─► MOIT e-commerce registration (Decree 117/2025; requires ERC + tax code)

SBV PSP licensing ── NOT needed if using licensed VNPay/MoMo (marketplace model)

DECIDED (2026-06-19): FPT Cloud (Vietnam) is the chosen primary host.
TIA/CDTIA is NOT required for hosting (no cross-border transfer).
See ADR-020 D7/D8/D9/D10, DS-017.

Brandname SMS
  └─► Trademark certificate
        └─► Carrier registration (Viettel + Vinaphone + Mobifone; 2-4 wk each)

PDPL/Cybersecurity
  └─► DPIA ── submit within 60 days of start of processing
  └─► TIA/CDTIA ── submit within 60 days of first offshore data transfer
```

---

## Week 1-2: Entity & Legal Foundation

| Action | Notes |
|--------|-------|
| Select entity structure | LLC (TNHH) preferred for foreign-invested marketplace |
| Engage local law firm for IRC/ERC filing | Identify firm with DPI/MOIT experience |
| Begin document legalization (apostille/consular) | **BLOCKER**: 15-30 days elapsed; start Day 1 |
| Secure office lease or MOU | Required for IRC application |
| Prepare feasibility study and capital plan | Mandatory attachment for IRC |
| Obtain personal VNeID e-ID for local legal rep | Mandatory from July 1 2025 (Decree 69/2024) |
| Prepare UBO declaration | 25%+ holders disclosed (Law 76/2025, effective July 1 2025) |

---

## Week 3-4: IRC Submission + Parallel Tracks

| Action | Notes |
|--------|-------|
| Submit IRC application to Department of Planning and Investment (Sở Kế hoạch và Đầu tư / DPI) | Statutory 15 working days; actual 3-5 weeks |
| Begin trademark application for brandname SMS | Long lead-time; start before IRC clears |
| Initiate NAPAS/VietQR bank partnership discussion | Exploratory; production requires ERC |
| Begin VNPay + MoMo merchant onboarding (sandbox) | Sandbox available pre-ERC; production requires ERC |
| Draft Privacy Policy and Cookie consent UI | Required before site goes live under PDPL 2025 |

---

## Week 5-8: ERC, Tax, and E-Invoice Registration

| Action | Notes |
|--------|-------|
| Receive IRC | Allow Week 6-7 buffer for delays |
| Submit ERC application | 3-7 working days after IRC issuance |
| Open corporate bank account (DICA) | Requires ERC; choose NAPAS-member bank |
| Register for tax / obtain tax code | 10-20 days post-ERC |
| Register for e-invoices with GDT portal | Requires tax code |
| Select GDT-certified e-invoice provider | MISA recommended: 24/7 GDT connectivity, XML/digital-sig, 10-year storage |
| Register for social insurance | Must precede first employee hire |
| Submit MOIT e-commerce registration | Decree 117/2025 -- requires ERC + tax code |
| Begin brandname SMS template registration | BM02 LoA; register with Viettel, Vinaphone, Mobifone |

> **Decree 117/2025 applicability**: applies to marketplace platforms enabling third-party operators to sell. Registration is mandatory. Thresholds: Vietnamese domain, Vietnamese-language interface, or 100,000+ domestic transactions/year.

---

## Week 9-12: PSP Go-Live, SMS, Compliance

| Action | Notes |
|--------|-------|
| Complete VNPay production merchant onboarding | Requires ERC, tax code, bank account, website with compliance policies |
| Complete MoMo production merchant onboarding | Same requirements as VNPay |
| Submit brandname SMS sender registration to all 3 carriers | Allow 2-4 week processing per carrier |
| Confirm brandname SMS approved | OTP/transactional only; promotional SMS requires VNCert pre-approval |
| Conduct DPIA and submit to Ministry of Public Security portal | Within 60 days of first user data collection |
| ~~Submit TIA/CDTIA for hosting~~ | **NOT REQUIRED** — FPT Cloud (Vietnam) chosen as primary host (2026-06-19). No cross-border transfer for compute/DB/Redis. Evaluate CDTIA for Resend (US email) only if retained. See ADR-020 D7, DS-017 §3.1. |
| Appoint DPO | SME grace: 5 years if <100k records and no sensitive data |
| Legal opinion on PSP licensing | Confirm marketplace model = no SBV license needed |
| E-invoice provider integration (MISA API) | XML format, digital signature; test in UAT before go-live |

---

## Ongoing Post-Launch

| Action | Frequency | Notes |
|--------|-----------|-------|
| MOIT e-commerce registration updates | As business changes | Notify within 10 days of material changes |
| DPIA updates | Every 6 months or on business change | Re-file with MPS |
| Brandname SMS template updates | Per new template | Must re-register with all 3 carriers |
| PSP reconciliation and settlement reporting | Daily/weekly | VNPay T+1, MoMo T+1 to T+2 |
| E-invoice issuance per booking | Per transaction | Decree 70/2025: issue at time of sale |
| Cybersecurity incident reporting | Within 72 hours of detection | File with MPS (A05 Department) |
| AML/KYC transaction monitoring | Ongoing | Via VNPay/MoMo; review flagged transactions |

---

## Critical Path Summary

| Dependency | Total Elapsed | Blocker Level |
|------------|---------------|---------------|
| Document legalization -> IRC -> ERC | 43-87 days end-to-end | **CRITICAL** -- start Day 1 |
| ERC -> MOIT e-commerce, PSP production, tax, e-invoice | Cascading; ERC is the single gate | **CRITICAL** |
| Tax code -> e-invoice GDT registration + MISA setup | 10-20 days after ERC | HIGH |
| DPIA within 60 days of first data collection | Tie to soft-launch date | HIGH |
| Brandname SMS: 2-4 weeks per carrier after submission | Parallel with PSP onboarding | MEDIUM |
| New E-Commerce Law (effective July 1 2026) | Transitional provisions may allow registered platforms to continue until June 30 2027 — **UNVERIFIED: cite specific article or remove claim**. Tax withholding obligations (Decree 117/2025) may NOT be covered by this grace period. | **VERIFY** |
