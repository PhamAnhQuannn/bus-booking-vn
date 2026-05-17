---
name: cyber-insurance-pick
description: Founder / CFO / head of security responsibility — cyber liability insurance pick — first-party breach response, ransomware, BI, third-party privacy/network liability, regulatory defense, carriers, limits by data sensitivity. Outputs to `docs/inception/cyber-insurance-pick-<project>.md`. Use when user says "cyber insurance", "breach insurance", "ransomware coverage", "data breach", "Coalition", "At-Bay", "CISO cyber policy", "CFO cyber bind", "/cyber-insurance-pick", or before first PII processed.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /cyber-insurance-pick — Cyber Is The Only Policy That Funds The Breach Response In Real Time. Bind Before First PII Lands.

Cyber ≠ "for big companies that get hacked". Cyber = the only policy that pays for the breach coach, forensics firm, notification letters, credit monitoring, regulatory defense, ransom negotiator, and lost revenue *while the incident is happening*. Without cyber, a single ransomware attack averages $4.4M (IBM 2025). For a seed-stage startup, that's company-ending. Bind before first PII is processed — most carriers want minimum security controls in place at bind.

## Why you'd care

A breach without cyber insurance means writing seven-figure incident response checks from your operating account. The carrier-and-limit decision before first PII processed is what keeps a security incident from also being a solvency event.

## Pre-flight
Run before first PII collected OR before first paid customer OR before any of: customer MSA requires it, EU/UK customers, healthcare/financial data, AI training on user data. Pairs with `/insurance-policy-pick`, `/e-and-o-insurance-pick`, `/threat-model-pre`, `/pii-inventory-pre`, `/incident-runbook`.

## Inputs
- Data sensitivity (PII / PHI / PCI / financial / IP / mostly metadata).
- Data volume (rows of PII; orders of magnitude matters: 10k vs 1M vs 100M).
- Hosting (Vercel/AWS/GCP/own-data-center — drives breach surface).
- Auth model (passwords / MFA / SSO / passwordless).
- Backup posture (RPO/RTO already defined? Tested?).
- Regulatory exposure (GDPR / CCPA / HIPAA / PCI / SOX / GLBA).
- Largest single-customer data volume.
- Customer MSA cyber minimums from pipeline.

## Process
1. **Map cyber risk surface** — what you hold, where, who can reach it.
2. **Confirm customer-driven minimums** — pipeline MSAs.
3. **Pick coverage form** — combined with tech E&O vs standalone.
4. **Set limits by data sensitivity + volume + regulatory exposure.**
5. **Pick carrier** — Coalition / At-Bay / Cowbell / Corvus (cyber-specialty) vs bundled (Vouch/Embroker) vs traditional (Beazley/Chubb/Travelers).
6. **Get pre-bind security controls in place** — MFA, EDR, backups, patching — to avoid carrier denial or premium loading.
7. **Negotiate sub-limits + exclusions** — ransomware sub-limit, war exclusion, biometric exclusion.
8. **Document + lock at `docs/inception/cyber-insurance-pick-<project>.md`.**

## Output
Write `docs/inception/cyber-insurance-pick-<project>.md`:

```markdown
# Cyber Insurance Pick — <project>
**Owner:** founder / CTO / CISO
**Date:** <YYYY-MM-DD>
**Stage:** <pre-revenue / paid customers / scaling>
**PII rows held:** <N>
**Regulatory exposure:** <GDPR / CCPA / HIPAA / PCI / none>
**Effective date:** <YYYY-MM-DD>
**Term:** 12 months

## Why cyber exists separate from GL + E&O + D&O
- **GL** covers bodily injury + property damage — not data loss.
- **E&O** covers software-bug economic loss — not breach response cost, regulatory fines, or ransom.
- **D&O** covers personal director liability — not entity breach cost.
- **Cyber** covers: first-party breach response (forensics, breach coach, notification, credit monitoring, PR, lost revenue, ransomware), third-party privacy/network liability (lawsuits from affected users, regulatory fines/defense), and pays in the first 24-72 hours of an incident.
- **IBM Cost of a Data Breach 2025:** average $4.4M. For a startup pre-Series A, this is company-ending without cyber.
- Customer MSAs increasingly demand $1M-$10M cyber. **No cyber = no enterprise contract.**

## Cyber risk surface — what cyber covers
### First-party (your costs)
| Coverage | What it pays | Typical sub-limit |
|----------|--------------|-------------------|
| **Breach response / incident response** | Forensics firm, breach coach (lawyer), PR, customer notification | $1M-$5M |
| **Credit/identity monitoring** | 1-2 yr monitoring for affected users | Per-user cap |
| **Ransomware / cyber extortion** | Ransom payment, negotiator, decryption | $250k-$2M sub-limit (often capped) |
| **Business interruption (cyber BI)** | Lost revenue during outage caused by attack | $1M-$5M |
| **Dependent / contingent BI** | Revenue lost when key vendor (AWS, Stripe) is breached | $500k-$2M |
| **Digital asset restoration** | Cost to rebuild data, software, configurations | $500k-$2M |
| **Funds transfer fraud / social engineering** | Wire fraud, BEC attacks | $100k-$500k sub-limit |
| **Computer fraud** | Direct theft via system compromise | $250k-$1M |
| **Reputation harm / brand recovery** | PR campaign post-breach | $250k-$1M |
| **Hardware bricking** | Physical device damage from attack | $100k-$500k |

### Third-party (your liability to others)
| Coverage | What it pays | Typical limit |
|----------|--------------|---------------|
| **Privacy liability** | Lawsuits / class actions from affected users | Shared with tower |
| **Network security liability** | Suits over compromised customer systems | Shared |
| **Regulatory defense + fines** | GDPR/CCPA/HIPAA/state-AG fines + defense costs | Up to $X sub-limit |
| **PCI DSS fines + assessments** | Card-brand penalties post-breach | $500k-$2M |
| **Media liability** | Defamation, IP infringement (often shared w/ E&O) | $1M+ |

## Data sensitivity → limit calibration
| Data held | Suggested cyber limit | Premium ballpark |
|-----------|----------------------:|------------------:|
| Metadata only (no PII) | $1M | $1-2k |
| Email + basic PII (<10k rows) | $1M | $2-4k |
| PII + financial (10k-100k rows) | $1M – $3M | $4-10k |
| Sensitive PII (100k-1M rows) | $3M – $5M | $10-25k |
| PHI (HIPAA-touching) | $5M – $10M | $25-60k |
| PCI cardholder data | $5M – $10M + PCI sub-limit | $25-75k |
| Financial services / regulated | $5M – $25M | $50-150k |
| EU / UK users (GDPR fine 4% revenue) | +$2M-5M regulatory sub-limit | premium loading 20-40% |

**Our pick:** $<X>M limit, $<Y>k retention, premium estimate $<P>k/year

## Coverage form pick
| Form | Pros | Cons |
|------|------|------|
| **Combined Tech E&O + Cyber (shared limit)** | Cheaper, simpler, single broker | Shared limit risk; gap risk at seam |
| **Cyber standalone (cyber specialty carrier)** | Deeper coverage, dedicated breach response, security partnership | More cost; coordination at claim |
| **Both combined + standalone tower (excess)** | Specialty carrier primary, generalist excess | Most expensive |

**Recommended for seed-Series A:** Cyber specialty (Coalition / At-Bay) standalone + Tech E&O bundle from Vouch/Embroker. Two separate policies, two distinct $X limits.

**Our pick:** <form>

## Carriers
**Cyber specialty (security-led underwriting + active risk management):**
- **Coalition** — strongest cyber specialty for tech startups. Includes free continuous security monitoring (asset scans, vulnerability alerts). $1M-$15M typical.
- **At-Bay** — similar to Coalition; security-led. Strong at $1M-$10M.
- **Cowbell** — growing fast, cyber-only, $1M-$15M.
- **Corvus** — analytics-driven, ransomware specialty.
- **Resilience** — mid-market, integrated breach response.

**Bundled (cyber + E&O combined):**
- **Vouch** — strong on SaaS, $1M-$5M sweet spot.
- **Embroker** — Series A through Series B.

**Traditional (via broker):**
- **Beazley** — gold-standard, $1M-$50M.
- **Chubb** — premium, broad form.
- **AIG** — large limits, $10M+.
- **Travelers** — mainstream, broad appetite.
- **Tokio Marine HCC** — strong on combined towers.
- **Munich Re / Hannover Re** — reinsurance-backed specialty.

**Our pick:** <carrier>
**Why:** <fit: stage / data sensitivity / security partnership value / customer-required>

## Pre-bind security controls (carrier requirements)
Cyber underwriters increasingly require minimum controls. **Missing controls = denial or 50-100% premium loading.**

| Control | Required by most carriers | Notes |
|---------|--------------------------:|-------|
| **MFA on all admin accounts** | ✅ mandatory | Hard rule across carriers |
| **MFA on email** | ✅ mandatory | BEC is #1 claim trigger |
| **MFA on VPN / remote access** | ✅ mandatory | |
| **Endpoint detection & response (EDR)** | ✅ increasingly mandatory | CrowdStrike / SentinelOne / Defender / etc |
| **Tested backups (immutable / offline)** | ✅ mandatory | Ransomware survival; demonstrate restore drill |
| **Patch cadence** | ✅ expected | <30 days for critical patches |
| **Privileged Access Management (PAM)** | preferred | Series A+ |
| **Email filtering (anti-phishing)** | preferred | Cuts BEC frequency |
| **Security awareness training** | preferred | Annual + phishing sim |
| **Incident response plan documented** | preferred | Tied to `/incident-runbook` |
| **Vendor risk assessment** | preferred | Sub-processor cyber posture |

**Pre-bind audit:**
- [ ] MFA universal (admin / email / VPN)
- [ ] EDR deployed on all endpoints
- [ ] Backups tested in last 90 days
- [ ] Patch cadence documented
- [ ] IR plan written

If gap → fix before binding. Or carrier writes coverage carve-outs around the gap.

## Sub-limits + exclusions to negotiate
### Sub-limits — confirm they're large enough
- ✅ **Ransomware sub-limit** — often $250k-$2M cap (not full tower). Negotiate up if exposure justifies.
- ✅ **Regulatory fines + defense** — full limit, not sub-limit, where law permits insurance of fines.
- ✅ **PCI assessments** — full sub-limit if PCI exposure exists.
- ✅ **Business interruption** — waiting period (typical 8-12 hr) before BI triggers.
- ✅ **Dependent BI** — covers AWS/Stripe/key-vendor outage. Critical.
- ✅ **Funds transfer fraud / social engineering** — often capped low ($100k-$250k); raise if wire-heavy.

### Exclusions to push back on
- ❌ **Prior knowledge** — bars claims known pre-bind. Full disclosure at bind protects you.
- ❌ **Prior acts / retroactive date** — bars pre-policy incidents. **Negotiate full prior-acts coverage** at first bind.
- ❌ **War / nation-state attack** — emerging carrier exclusion post-NotPetya. **Push for narrow definition** (attributed kinetic war only, not "cyber war"). Lloyds 2023 mandate has affected wording.
- ❌ **Biometric data exclusion** (e.g., BIPA-related) — if product collects face/fingerprint, exclude this exclusion.
- ❌ **Unencrypted device exclusion** — bars claims on lost laptop with unencrypted disk. Enable full-disk encryption fleet-wide.
- ❌ **Failure to patch / failure to maintain controls** — narrow to "wilful failure" not "any unpatched system".
- ❌ **Bodily injury / property damage** — standard for cyber; expected.
- ❌ **Intentional acts** — narrow to "with intent to cause harm".
- ❌ **Acts of insiders** — typically "rogue insider" carve-back exists; confirm scope.
- ❌ **Cryptocurrency** — many carriers exclude crypto-related losses; if business touches crypto, negotiate explicit inclusion.

## Customer-driven minimums (MSA compliance)
| Customer segment | Typical cyber minimum |
|------------------|----------------------:|
| SMB | $1M |
| Mid-market | $1M – $3M |
| Enterprise | $3M – $10M |
| Fortune 500 | $5M – $25M |
| Healthcare / fintech | $5M – $10M minimum + BAA / regulator requirements |
| Government | $5M – $25M |

**Pipeline check:**
- Largest pending MSA cyber minimum: $<X>M
- Highest-stakes industry: <industry>
- **Required limit floor:** $<X>M (matched to largest pending deal)

## Breach response team (pre-built)
Most cyber carriers include a panel — pre-vetted vendors who respond on day 1:
- ✅ Breach coach (privileged outside counsel) — coordinates response
- ✅ Forensics firm (Mandiant / CrowdStrike / Kroll / Charles River)
- ✅ Notification vendor (Epiq / Kroll / Experian / Equifax)
- ✅ Credit monitoring provider
- ✅ Ransomware negotiator (Coveware / Arete)
- ✅ Crisis comms / PR firm
- ✅ Regulator-specific defense counsel

**Action pre-bind:** Confirm panel includes vendors you'd actually use. Carrier-supplied breach coach is huge value beyond the dollar limit.

## Incident response activation
**24-hour rule:** Notify carrier within 24-72 hr of incident discovery. Late notice = denial.
**Hotline:** Carrier provides 24/7 incident hotline. Add to `/incident-runbook`.
**Privileged channel:** Once breach coach engaged, all comms via privileged counsel — protects against discovery in litigation.

**Document the workflow in `/incident-runbook`.**

## Premium budget by stage
| Stage | Data sensitivity | Cyber annual premium |
|-------|------------------|---------------------:|
| Pre-revenue, low PII | Metadata + emails | $1-3k |
| Paid customers, basic PII | <100k rows | $3-8k |
| Growth, medium PII | 100k-1M rows | $8-20k |
| Scale, sensitive PII | PHI / financial / 1M+ rows | $20-60k |
| Mid-market, regulated | EU + HIPAA + PCI | $50-150k |

## Renewal discipline
- 90 days pre-expiry: broker requests renewal app.
- 60 days: update headcount, PII row count, new data types, control changes, claims history.
- 45 days: receive renewal terms. Compare to market every 2 cycles.
- 30 days: bind. Confirm all controls still in place.
- Re-shop trigger: premium >15% YoY without claims, coverage form change, carrier exits cyber market (some have), or major incident at carrier (capacity tightens).

## AI/ML-specific cyber concerns
- AI training data containing PII triggers same regulatory exposure as production PII.
- Prompt injection / model jailbreak claims emerging — confirm coverage form addresses.
- Output liability blurs E&O/cyber boundary — bundle helps.
- Data exfiltration via model inversion is an emerging threat — covered under standard "data breach" form.

## Common founder mistakes
- ❌ Skip cyber until first incident — denial at claim because too late
- ❌ Bind without MFA / EDR in place — carrier denies controls were misrepresented
- ❌ Ransomware sub-limit too low — pay difference out of pocket
- ❌ War exclusion accepted broadly — nation-state attack denied
- ❌ Biometric data product without exclusion-stripping endorsement
- ❌ Late notice (>72 hr) — coverage denied for procedural breach
- ❌ Combined cyber + E&O shared limit when separate tower warranted
- ❌ Carrier with no incident-response panel — scramble at 2 AM to find forensics firm
- ❌ Customer MSA minimum not met — deal stalls
- ❌ Auto-renewal without market check — 30% premium creep over 2 yr

## Anti-patterns
- ❌ No cyber when holding any PII
- ❌ Limit below customer MSA minimum
- ❌ Bind without minimum security controls
- ❌ Ransomware sub-limit too low for exposure
- ❌ Broad war exclusion uncarved
- ❌ Biometric exclusion accepted on biometric product
- ❌ Late notice in IR plan (>72 hr buffer)
- ❌ No breach-response panel in carrier
- ❌ Combined cyber+E&O shared limit when separate needed
- ❌ Wrong carrier rating (< A-VII)
- ❌ Cyber bound after first incident discovered

## Pre-bind checklist
- [ ] Data sensitivity + volume mapped
- [ ] Customer MSA minimums surveyed
- [ ] Coverage form picked (combined vs standalone)
- [ ] Limit ≥ largest customer MSA minimum
- [ ] Pre-bind security controls in place (MFA, EDR, backups, patching)
- [ ] Sub-limits adequate (ransomware, BI, regulatory fines, funds-transfer fraud)
- [ ] Exclusions negotiated (war narrow, biometric carved, prior-acts coverage, encryption normal)
- [ ] Carrier rating ≥ A-VII confirmed
- [ ] Breach response panel reviewed
- [ ] 24/7 hotline + carrier notice procedure added to `/incident-runbook`
- [ ] Premium reserved in budget
- [ ] Renewal calendared 90 days pre-expiry

## Hand-off
- Risk umbrella + bundle context → `/insurance-policy-pick`
- Tech E&O / professional liability (paired tower) → `/e-and-o-insurance-pick`
- Director/officer personal liability → `/d-and-o-insurance-pick`
- PII inventory feeding cyber limits → `/pii-inventory-pre`
- Threat surface feeding cyber risk → `/threat-model-pre`
- Incident response activation tied to cyber notice → `/incident-runbook`
- Retention policy reducing breach blast radius → `/records-retention-pre`
- MSA insurance schedule → `/msa-template`
- Data Processing Addendum + cyber coordination → `/dpa-template`
```

## Verification
- Data sensitivity + volume mapped.
- Customer MSA minimums confirmed.
- Coverage form picked.
- Limit ≥ largest customer MSA minimum.
- Pre-bind controls (MFA / EDR / backups / patching) in place.
- Sub-limits + exclusions negotiated.
- War + biometric exclusions narrowed where applicable.
- Breach response panel reviewed.
- 24-72 hr notice procedure documented.
- Carrier rating ≥ A-VII.
- Renewal calendared.
