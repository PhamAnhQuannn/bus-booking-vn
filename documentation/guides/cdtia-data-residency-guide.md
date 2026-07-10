# CDTIA & Data Residency Guide

> Cross-border Data Transfer Impact Assessment — what it is, why we mostly don't need it, and how to file if we do.

**Related specs:** [ADR-020](../architecture-decisions/ADR-020-deployment/README.md), [SI-006](../scaffolding-infra/SI-006-deployment-config/README.md), [HD-007](../hardening/HD-007-regulatory-compliance/README.md), [data-privacy.md](../business/regulatory/data-privacy.md)

---

## TL;DR — Current Status

> **2026-07-10 Update**: Vercel Pro sin1 (Singapore) is the sole production host (ADR-020 D11). **CDTIA IS required** for compute (Vercel, Singapore), database (Neon, Singapore), and cache (Upstash, Singapore). The filing steps in Part 4 of this guide are the primary compliance path.

| Service | Data Location | CDTIA Required? | Status |
|---------|---------------|------------------|--------|
| **Vercel Pro (compute)** | **Singapore** | **YES** | Production host |
| **Neon (PostgreSQL)** | **Singapore** | **YES** | Production database |
| **Upstash (Redis)** | **Singapore** | **YES** | Production cache |
| Cloudflare R2 (storage) | Auto (nearest) | **YES** | Object storage for ticket PDFs |
| eSMS (SMS gateway) | Vietnam | **No** | Vietnam-hosted |
| SePay (payment) | Vietnam | **No** | Vietnam-hosted |
| Cloudflare CDN/DNS | Edge (global) | **No** | No PII stored; pass-through only |
| **Resend (email)** | **US** | **YES** | Deferred; stub mode for now |

**Bottom line:** CDTIA filing is required. All core infrastructure (Vercel, Neon, Upstash) is hosted in Singapore. Follow the filing steps in Part 4.

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

## Part 2: Why CDTIA Is Required

### Architecture Decision (2026-07-10)
Vercel Pro sin1 (Singapore) is the sole production host (ADR-020 D11). All core infrastructure is in Singapore:

- Compute (Next.js app) runs on Vercel Pro sin1 (Singapore)
- Database (PostgreSQL 16) on Neon ap-southeast-1 (Singapore)
- Cache (Redis 7) on Upstash ap-southeast-1 (Singapore)
- Object storage on Cloudflare R2

Personal data (customer names, phones, emails, booking records) is processed and stored on servers outside Vietnam. **CDTIA filing is mandatory.**

### What About Cloudflare CDN?
Cloudflare acts as a CDN/reverse proxy. User requests pass through Cloudflare edge nodes globally, but:
- Cloudflare does NOT store personal data (pass-through)
- SSL termination at edge, then re-encrypted to origin
- No PII cached — only static assets (`/_next/static/`)
- Cloudflare is classified as a "transit processor" not a "storage processor"

**Verdict: No CDTIA required for Cloudflare CDN alone, but CDTIA is already required for the Vercel/Neon/Upstash stack.**

---

## Part 3: The Resend Question (Additional US Transfer)

### Current Situation
Resend is a US-based transactional email service. If enabled (`EMAIL_PROVIDER=resend`), customer email addresses are sent to Resend's US servers for delivery.

Email addresses = personal data under PDPL 2025 Art. 2.
US servers = cross-border transfer under Decree 356/2025.

CDTIA is already required for the core Vercel/Neon/Upstash stack (Singapore). If Resend is also activated, the CDTIA dossier must additionally cover the US transfer for email.

### Options

#### Option A: Replace Resend with Vietnam-Hosted Email
Reduces cross-border scope to Singapore only. Options:
1. **eSMS email add-on** -- eSMS.vn (already our SMS provider) offers email delivery
2. **Defer customer auth** -- Phase 1 guest booking needs no customer OTP. If customer sign-in is enabled, email becomes launch-critical (customer OTP uses email since commit `686ec85`).

#### Option B: Keep Resend, Add US to CDTIA Dossier
If Resend is retained for production, include the US transfer in the CDTIA filing below.

---

## Part 4: CDTIA Filing Steps

> Required for the Vercel Pro + Neon + Upstash production stack (Singapore). Additional entries needed if Resend (US) is activated.

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
   - What data: customer PII (name, phone, email), booking records, payment metadata
   - Why: application hosting, database storage, cache, email delivery
   - Volume: estimated number of records/month
   - Frequency: real-time per transaction

3. Receiving party information
   - Vercel Inc. (compute) — Singapore
   - Neon Inc. (PostgreSQL) — Singapore
   - Upstash Inc. (Redis) — Singapore
   - Cloudflare Inc. (object storage) — global
   - Resend Inc. (email, if activated) — United States
   - Data processing role: processor (not controller)

4. Destination country assessment
   - Singapore data protection legal framework (PDPA)
   - United States (if Resend activated)
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

## Part 5: Post-Filing Record Keeping

After filing the CDTIA, maintain an internal compliance record:

### Keep Updated
Review the CDTIA filing when:
- Adding any new third-party service that processes user data
- Changing hosting provider or region
- Adding analytics, logging, or monitoring services hosted outside Vietnam
- Activating Resend or any other overseas email provider

---

## Part 6: Checklist

### CDTIA Filing (Required)
- [ ] DPAs signed with Vercel, Neon, Upstash, Cloudflare
- [ ] DPA signed with Resend (if `EMAIL_PROVIDER=resend`)
- [ ] CDTIA assessment report drafted and signed
- [ ] Dossier submitted to MPS A05 within 60 days of go-live
- [ ] Stamped receipt copy retained
- [ ] Privacy policy discloses cross-border transfer to Singapore (and US if Resend active)
- [ ] User consent mechanism in place
- [ ] Annual review calendar set

---

## Quick Reference

| Question | Answer |
|----------|--------|
| Do we need CDTIA? | **Yes** (Vercel/Neon/Upstash in Singapore) |
| What triggers CDTIA? | Any personal data sent to servers outside Vietnam |
| Who do we file with? | MPS Department A05 |
| How long to file? | Within 60 days of first cross-border transfer |
| What if we add a new overseas service later? | File CDTIA within 60 days of activating it |
| Is Cloudflare CDN a trigger? | No — pass-through, no PII stored |
| Is Vercel staging a trigger? | No — no real user data, test/seed only |
| What's the penalty? | Fines up to 100M VND; potential service suspension |
