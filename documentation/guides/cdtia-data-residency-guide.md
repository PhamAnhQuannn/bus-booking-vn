# CDTIA & Data Residency Guide

> Cross-border Data Transfer Impact Assessment — what it is, why we mostly don't need it, and how to file if we do.

**Related specs:** [ADR-020](../architecture-decisions/ADR-020-deployment/README.md), [SI-006](../scaffolding-infra/SI-006-deployment-config/README.md), [HD-007](../hardening/HD-007-regulatory-compliance/README.md), [data-privacy.md](../business/regulatory/data-privacy.md)

---

## TL;DR — Current Status

> **2026-06-21 Update**: With the pivot to Vercel Pro + Neon + Upstash as primary production stack (ADR-020 D11), **CDTIA IS required** for database (Neon, Singapore) and cache (Upstash, Singapore). The filing steps in Part 4 of this guide are now the primary compliance path, not a Resend-only edge case. FPT Cloud backup deployment eliminates CDTIA entirely — see `deployment-fpt-cloud-setup.md`.

| Service | Data Location | CDTIA Required? | Status |
|---------|---------------|------------------|--------|
| FPT Cloud VPS (compute) | Vietnam | **No** | ELIMINATED |
| FPT Managed PostgreSQL | Vietnam | **No** | ELIMINATED |
| FPT Managed Redis | Vietnam | **No** | ELIMINATED |
| FPT Object Storage | Vietnam | **No** | ELIMINATED |
| eSMS (SMS gateway) | Vietnam | **No** | Vietnam-hosted |
| SePay (payment) | Vietnam | **No** | Vietnam-hosted |
| Cloudflare CDN/DNS | Edge (global) | **No** | No PII stored; pass-through only |
| Vercel (staging only) | Singapore | **No** | No production data; test/seed only |
| **Resend (email)** | **US** | **YES** | Only remaining trigger |

**Bottom line:** FPT Cloud hosting (decided 2026-06-19) eliminates CDTIA for all core infrastructure. Only **Resend** (US-based email) still triggers it — and can be avoided entirely by switching to a Vietnam-hosted email solution.

---

## Part 1: What is CDTIA?

### Definition
CDTIA (Cross-border Data Transfer Impact Assessment / Ho so danh gia tac dong chuyen du lieu ca nhan ra nuoc ngoai) is a mandatory filing when Vietnamese user personal data is transferred to servers outside Vietnam.

### Governing Laws
| Law/Decree | What It Covers |
|------------|----------------|
| **PDPL No. 91/2025/QH15** | Personal Data Protection Law (effective Jan 1, 2026). Art. 25: cross-border transfer rules |
| **Decree 356/2025/ND-CP** | PDPL implementation. Expressly classifies foreign cloud services as cross-border transfer |
| **Decree 53/2022/ND-CP** | Cybersecurity implementation. Data localization mandate: 3 categories must be stored in Vietnam |
| **Decree 13/2023/ND-CP** | Original Personal Data Protection Decree (largely replaced by PDPL 2025) |
| **Decree 147/2024/ND-CP** | Internet services. Requires at least one Vietnam server |
| **Law 116/2025/QH15** | New Cybersecurity Law (effective July 1, 2026). Retains data localization mandate |

### What Data Must Stay in Vietnam?
Under Decree 53/2022, domestic enterprises must store these 3 categories in Vietnam with 24-month minimum retention:

1. **Personal information** — name, phone, email, ID, address
2. **User relationship data** — who connects with whom on the platform
3. **User-generated data** — bookings, reviews, messages, transaction records

### Filing Authority
- **Ministry of Public Security (Bo Cong an), Department A05** (Cuc An ninh mang va phong chong toi pham su dung cong nghe cao)
- Filing method: submit dossier directly to A05
- **Deadline: 60 days from the date cross-border transfer begins**

---

## Part 2: Why We (Mostly) Don't Need CDTIA

> **2026-06-21 Note**: This section was written when FPT Cloud was the primary host. With Vercel-first stack, CDTIA filing IS required and accepted. The analysis below remains valid for the FPT Cloud backup deployment path.

### Architecture Decision (2026-06-19)
ADR-020 Decision D2 chose **FPT Cloud (Vietnam)** as primary host. This means:

- All compute (Next.js app) runs on FPT Cloud Server in Vietnam
- All database (PostgreSQL 16) on FPT Managed DB in Vietnam
- All cache (Redis 7) on FPT Managed Redis in Vietnam
- All object storage on FPT Object Storage in Vietnam

**No personal data crosses Vietnam's border = No CDTIA obligation.**

This is documented across: ADR-020 D2/D7, SI-006 S1.1/S1.3, DS-017 S3.1, GL-001, HD-007.

### What About Cloudflare?
Cloudflare acts as a CDN/reverse proxy. User requests pass through Cloudflare edge nodes globally, but:
- Cloudflare does NOT store personal data (pass-through)
- SSL termination at edge, then re-encrypted to origin
- No PII cached — only static assets (`/_next/static/`)
- Cloudflare is classified as a "transit processor" not a "storage processor"

**Verdict: No CDTIA required for Cloudflare CDN.**

### What About Vercel (Staging)?
Vercel sin1 (Singapore) is retained for staging/preview only:
- No production user data
- Only test/seed data
- `PAYMENTS_STUB=true`, `NOTIFY_STUB=true`

**Verdict: No CDTIA required — no real personal data processed.**

---

## Part 3: The Resend Problem (Only Remaining CDTIA Trigger)

### Current Situation
Resend is a US-based transactional email service. If enabled (`EMAIL_PROVIDER=resend`), customer email addresses are sent to Resend's US servers for delivery.

Email addresses = personal data under PDPL 2025 Art. 2.  
US servers = cross-border transfer under Decree 356/2025.

### Options

#### Option A: Replace Resend with Vietnam-Hosted Email (Recommended)
**Eliminates CDTIA entirely.** Options:
1. **eSMS email add-on** — eSMS.vn (already our SMS provider) offers email delivery
2. **Self-hosted Postal/Mailtrain** on FPT Cloud VPS — full control, no cross-border
3. **Defer email feature** — Phase 1 only needs SMS (OTP, booking confirmation). Email can wait.

If Option A is chosen: set `EMAIL_PROVIDER="stub"` (already default) and skip CDTIA entirely.

#### Option B: Keep Resend, File CDTIA
If Resend is retained for production, follow the filing steps below.

---

## Part 4: CDTIA Filing Steps (If Needed)

> Only required if using Resend or any other overseas data processor in production.

### Step 1: Prepare the Dossier (Ho so)

The CDTIA dossier must contain these documents per PDPL 2025 Art. 25 and Decree 13/2023 Art. 25:

#### Document 1: Transfer Impact Assessment Report
```
Title: Bao cao danh gia tac dong chuyen du lieu ca nhan ra nuoc ngoai
       (Cross-border Personal Data Transfer Impact Assessment Report)

Contents:
1. Data controller information
   - Company name, address, tax code, legal representative
   - Contact person for data protection

2. Description of the transfer
   - What data: customer email addresses
   - Why: transactional email delivery (booking confirmations, receipts)
   - Volume: estimated number of records/month
   - Frequency: real-time per transaction

3. Receiving party information
   - Resend Inc., [address], United States
   - Data processing role: processor (not controller)
   - Data protection measures: [Resend's security page]

4. Destination country assessment
   - United States data protection legal framework
   - Adequacy determination (if any from Vietnam MPS)
   - Risks identified and mitigations

5. Data subject rights
   - How Vietnamese users can exercise PDPL rights
   - Contact mechanism for data access/deletion requests

6. Technical and organizational safeguards
   - Encryption in transit (TLS 1.2+)
   - Data retention policy (email logs purged after N days)
   - Access controls
   - DPA (Data Processing Agreement) with Resend
```

#### Document 2: Data Processing Agreement (DPA) with Resend
- Must be signed between your company and Resend
- Resend provides a standard DPA: check their legal/compliance page
- Must cover: processing purpose, data categories, retention, deletion, sub-processors

#### Document 3: Consent Mechanism (if relying on consent)
- Privacy policy must disclose cross-border transfer to US for email
- User consent must be obtained (can be bundled in registration ToS)
- Consent must be freely given, specific, informed, unambiguous

### Step 2: Internal Approval
1. Legal representative (Nguoi dai dien phap luat) signs the assessment report
2. Date the report
3. Keep internal copy with company seal (con dau)

### Step 3: Submit to MPS A05

#### Method: Direct Submission
- **Where:** Cuc An ninh mang va phong chong toi pham su dung cong nghe cao (A05)
  - Address: 40 Hang Bai, Hoan Kiem, Ha Noi (MPS headquarters)
  - Or regional office if applicable
- **What to bring:**
  - 2 copies of the complete dossier (1 for A05, 1 stamped as received for your records)
  - Company seal
  - Power of attorney if representative is not the legal rep
- **Deadline:** Within **60 days** from the date of the first cross-border transfer

#### Online Submission (if available)
- Check **https://dichvucong.bocongan.gov.vn** (MPS online public services portal)
- As of 2026, online CDTIA submission availability varies — confirm with A05

### Step 4: Post-Filing Obligations
1. **Keep records** — retain the stamped dossier copy for at least 24 months
2. **Update on change** — if data categories, volume, or receiving party changes, file an update
3. **Annual review** — review the assessment annually and update if circumstances change
4. **Respond to A05 requests** — MPS may request additional information within 15 business days

### Step 5: Ongoing Compliance
- Monitor Resend's sub-processor list for changes
- Update privacy policy if transfer scope changes
- Maintain consent records
- Be prepared for A05 inspection

---

## Part 5: Documenting "No CDTIA Needed" Determination

Even when CDTIA is not required, you should document WHY for audit purposes.

### Create Internal Record

Save this as an internal compliance memo (not in the public repo):

```
MEMORANDUM — CDTIA Determination
Date: [date of FPT Cloud go-live]
Company: [your company name]
Service: Bus Booking Platform ([domain])

DETERMINATION: CDTIA filing is NOT required.

RATIONALE:
All personal data processing occurs on infrastructure physically located
in Vietnam (FPT Cloud, Ho Chi Minh City / Hanoi data centers):

- Application server: FPT Cloud Server (Vietnam)
- Database: FPT Managed PostgreSQL (Vietnam)
- Cache: FPT Managed Redis (Vietnam)
- Object storage: FPT Object Storage (Vietnam)
- SMS gateway: eSMS.vn (Vietnam)
- Payment gateway: SePay (Vietnam)

No personal data is transferred to servers outside Vietnam.
Cloudflare CDN is used for edge caching of static assets only —
no personal data is cached or stored by Cloudflare.

Email delivery: currently stub mode (no email sent).
If a cross-border email provider is activated in the future,
a CDTIA will be filed within 60 days per PDPL 2025 Art. 25.

LEGAL BASIS:
- PDPL No. 91/2025/QH15, Art. 25 (cross-border transfer)
- Decree 356/2025/ND-CP (foreign cloud = cross-border)
- Decree 53/2022/ND-CP (data localization)

ARCHITECTURE DECISION: ADR-020, Decision D2 (2026-06-19)

Signed: _______________
Legal Representative
[Company seal]
```

### Keep Updated
Review this determination when:
- Adding any new third-party service that processes user data
- Changing hosting provider
- Adding analytics, logging, or monitoring services hosted outside Vietnam

---

## Part 6: Checklist

### If Using FPT Cloud Only (No Resend)
- [ ] All services confirmed Vietnam-hosted (FPT Cloud Console)
- [ ] `EMAIL_PROVIDER` = `"stub"` in production env
- [ ] Internal "No CDTIA Needed" memo signed and filed
- [ ] Privacy policy states data stored in Vietnam
- [ ] No overseas third-party processors in production

### If Using Resend (CDTIA Required)
- [ ] DPA signed with Resend
- [ ] CDTIA assessment report drafted and signed
- [ ] Dossier submitted to MPS A05 within 60 days
- [ ] Stamped receipt copy retained
- [ ] Privacy policy discloses cross-border transfer to US
- [ ] User consent mechanism in place
- [ ] Annual review calendar set

---

## Quick Reference

| Question | Answer |
|----------|--------|
| Do we need CDTIA? | **No** (if all on FPT Cloud + no Resend) |
| What triggers CDTIA? | Any personal data sent to servers outside Vietnam |
| Who do we file with? | MPS Department A05 |
| How long to file? | Within 60 days of first cross-border transfer |
| What if we add a new overseas service later? | File CDTIA within 60 days of activating it |
| Is Cloudflare CDN a trigger? | No — pass-through, no PII stored |
| Is Vercel staging a trigger? | No — no real user data, test/seed only |
| What's the penalty? | Fines up to 100M VND; potential service suspension |
