---
name: eula-pre
description: Pre-launch End-User License Agreement — desktop app / mobile app / game / extension / SDK / on-prem distribution. License grant scope, install-time vs use-time click-wrap, virtual goods + IAP, anti-cheat, reverse engineering, export control, store ToS overrides (Apple / Google / Steam). Outputs to `docs/inception/eula-pre-<project>.md`. Use when user says "EULA", "end-user license", "software license", "/eula-pre", or before shipping installable / store-distributed software.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /eula-pre — EULA Different From ToS. Software You Install Needs A License Grant, Not Just A Service Contract.

## Why you'd care

The app gets rejected from the Apple App Store the day before launch because the EULA reuses a SaaS ToS that doesn't grant the install + run license Apple's review requires — and the founder spends Friday night editing a license they don't fully understand. EULA governs the software itself (license to install + run binary code) while ToS governs the service; shipping a binary without both, with proper anti-reverse-engineering, anti-cheat, and store-overrides, is what creates unenforceable license terms and IP leakage that surfaces during the next acquirer's IP diligence.

EULA governs *the software itself* (license to install + run binary code), while ToS governs *the service* (online interaction). If you ship a binary — desktop, mobile, game, extension, SDK, on-prem — you need both. EULA wired wrong = unenforceable license + store rejection + IP leakage.

## Pre-flight
Run before first installable binary ships OR before store submission. Pairs with `/terms-of-service-pre`, `/privacy-policy-pre`, `/dpa-template`, `/ip-strategy`, `/export-control-screen`.

## Inputs
- Distribution model (direct download / Apple App Store / Google Play / Steam / Epic / Microsoft Store / browser store / enterprise on-prem).
- Software type (desktop app / mobile app / game / browser extension / SDK / library / firmware / VM image).
- Open-source components used (license-compatibility implications).
- Virtual goods / IAP / DLC / lootbox model.
- Anti-cheat / DRM stack (if game).
- Target jurisdictions (US / EU / UK / global / China-special).
- B2C / B2B / both.
- AI/ML inside the binary (model weights, on-device inference).

## Process
1. **EULA vs ToS scope** — license to software (EULA), service rules (ToS). Both needed for online apps.
2. **Distribution channel overrides** — store ToS supersede or layer on top (Apple, Google, Steam mandatory clauses).
3. **License grant scope** — copies, devices, users, sublicensing, transfer.
4. **Click-wrap at install OR first run** — record acceptance.
5. **Reverse engineering carve-outs** — EU mandates some (Directive 2009/24/EC Art. 6 interoperability).
6. **Open-source component disclosure** — copyleft drift, attribution.
7. **Virtual goods + IAP** — no real-world value, non-refundable, account-bound.
8. **Anti-cheat / DRM** — disclosed + privacy-compliant.
9. **Export control** — EAR / OFAC / dual-use software notice.
10. **Termination + uninstall consequence.**
11. **Versioning + update consent.**
12. **Store-specific compliance** — Apple Sec. 3.1, Google §, Steam Subscriber Agreement.

## Output
Write `docs/inception/eula-pre-<project>.md`:

```markdown
# End-User License Agreement (Pre-launch Draft) — <project>
**Owner:** founder / General Counsel
**Date:** <YYYY-MM-DD>
**Version:** 0.1 (pre-launch draft)
**Status:** DRAFT — lawyer review required before release / store submission
**Distribution channels:** <direct / App Store / Play / Steam / Epic / Microsoft Store / extension store / on-prem>
**Effective date:** <YYYY-MM-DD upon launch>

## Why this exists pre-launch
- EULA is the license grant — without it, distributing a binary gives the user no defined rights, creating ambiguity and IP risk
- App stores require EULA disclosure (Apple Sec. 3.1.5(a), Google Play Developer Distribution Agreement) — without one, your EULA is the store default, which strips your protections
- Reverse-engineering and DRM-circumvention clauses live in EULA, not ToS — needed for IP defense (DMCA §1201, EU Trade Secret Directive)
- Virtual goods / IAP must disclaim real-world value at the EULA level, not buried in ToS
- Open-source license obligations (attribution, copyleft) attach at distribution — EULA references them

## EULA vs ToS vs Privacy Policy vs DPA
| Doc | Governs | Bound by |
|-----|---------|----------|
| **EULA** | License to install + run software | User who installs (per-copy / per-seat) |
| **ToS** | Online service interaction | User who uses service |
| **Privacy Policy** | Personal data handling | Notice document (not contract) |
| **DPA** | B2B personal-data processing | Controller-Processor contract |

Online app with installable client: needs both EULA + ToS. Pure SaaS browser-only: ToS sufficient. Pure offline desktop tool: EULA sufficient.

## Distribution channel pick

| Channel | Mandatory overrides | Notes |
|---------|---------------------|-------|
| **Apple App Store** | Apple's Standard EULA applies UNLESS you submit a custom EULA. Apple Sec. 3.1.5(a) governs IAP. Cannot link to external payment in iOS app body (post-Epic, US: in-app link allowed for digital content per court order, contested). | Submit custom EULA via App Store Connect. |
| **Google Play** | Google's Developer Distribution Agreement + Play Console policies. Custom EULA allowed but flagged at submission. | Lootbox disclosure required. |
| **Steam** | Steam Subscriber Agreement primary; your EULA layered. Cannot bypass Steam DRM. | Trading cards / virtual items per Steam-specific rules. |
| **Epic Games Store** | Epic's EULA primary; your EULA layered. | |
| **Microsoft Store** | Standard Application License Terms apply unless custom EULA. | |
| **Chrome Web Store / Firefox / Edge** | Browser-specific developer agreements. Permissions model is store-disclosed. | |
| **Direct download** | Your EULA is the only contract — extra-load it. | |
| **Enterprise on-prem** | Negotiated EULA per customer, often integrated into MSA. | |

**Our channels:** <list>

## License grant (Section 1)

### 1.1 Grant
Licensor grants Licensee a:
- non-exclusive
- non-transferable (unless explicit transfer permitted)
- non-sublicensable
- revocable
- limited

license to install + use the Software solely in accordance with this EULA + applicable Documentation.

### 1.2 Scope
- **Permitted copies:** <number per license — typical: 1 copy per device, up to N devices per user OR per seat>
- **Permitted users:** Licensee + immediate household (B2C) OR named employee (B2B per-seat)
- **Permitted environments:** production / dev / test (specify for B2B)
- **Permitted purposes:** personal / internal business / specified application
- **Geographic scope:** <worldwide, except sanctioned jurisdictions>
- **Term:** perpetual OR subscription-tied (lapses on non-payment / cancellation)

### 1.3 Reservation
All rights not expressly granted are reserved by Licensor.

### 1.4 Subscription tie (if subscription)
- License conditional on active subscription
- License terminates on non-payment / cancellation
- Grace period: <N days>
- Post-termination: uninstall obligation; data export permitted

## Restrictions (Section 2)
Licensee shall NOT:
- Copy beyond permitted scope
- Modify, adapt, translate, or create derivative works (except as expressly permitted)
- Reverse engineer, decompile, disassemble, or attempt to derive source code, **except to the extent law permits and Licensor must allow** (EU Directive 2009/24/EC Art. 6 interoperability — cannot contractually waive in EU; similar carve-outs in AU, UK, parts of US for noninfringing fair use)
- Remove or alter notices, watermarks, attribution, DRM
- Sublicense, rent, lease, lend, sell, distribute, or transfer (unless explicit transfer right)
- Use to develop competing product
- Use beyond seat / device limits
- Circumvent technical protection measures (DMCA §1201 / EU Information Society Directive Art. 6)
- Use in violation of law, sanctions, or third-party rights
- Conduct benchmarking / performance testing for publication (B2B) without consent (where enforceable)
- Use to train AI models on the Software's output (where applicable)
- Bypass anti-cheat / anti-tamper (games)

## Click-wrap timing
- **Install-time:** clickable EULA dialog before install completes, "I Agree" required to proceed
- **First-run:** if install can't host dialog (mobile / app store), first-run screen presents EULA before any feature access
- **Update-time:** material changes prompt re-acceptance; minor updates notice-only

**Storage of acceptance:**
- User ID (if authenticated) or install ID
- EULA version + hash
- Timestamp + locale
- Channel (where installed from)

## Ownership + IP (Section 3)
- Software is licensed, not sold
- Licensor + its licensors retain all IP rights (copyright, patent, trademark, trade secret)
- Open-source components: subject to their own licenses; list in NOTICES file or in-app About panel
- User-generated content created with Software: owned by user (or per ToS for online sync)
- Feedback: assigned to Licensor or perpetual license back

## Open-source components
- Bundled OSS list (NOTICES file or in-app screen)
- Each OSS component subject to its own license
- Copyleft (GPL / LGPL / AGPL / MPL) compliance:
  - GPL static linking: typically infectious — avoid for proprietary binary
  - LGPL dynamic linking: permitted with attribution + re-link offer
  - AGPL network use: triggers source disclosure — generally avoid for SaaS / hosted
  - MPL file-level copyleft: permitted with file-level attribution
- Attribution required per license terms

Reference: `/licensing-audit` output.

## Updates + auto-update (Section 4)
- Licensor may release updates: bug fix, security, feature, breaking change
- Auto-update behavior disclosed: <silent / prompt / opt-in>
- Update may modify, replace, or remove features
- License terms in effect at update time apply to updated Software
- Material changes to EULA require re-acceptance

## Virtual goods + In-App Purchases (Section 5 — games / consumer apps only)
- Virtual currency: not real currency, no exchange rate, no cash redemption, non-transferable, non-refundable (except where law requires)
- Virtual items: license, not ownership; revocable on account termination
- IAP terms incorporate platform-specific rules (Apple Sec. 3.1.1+, Google Play Billing)
- Lootbox / random-reward mechanics:
  - **Disclosure of probabilities required** (Apple Sec. 3.1.1, Google Play Families, Belgium gambling ban, Netherlands KSA, Germany, China publishing rules)
  - Probability disclosure UI inside app
  - Age gate hardened where applicable
- Refund policy: per platform terms + jurisdiction law
- Account suspension = forfeiture (disclose conspicuously)

## DRM + anti-cheat (Section 6 — games / paid software only)
- Software may include technical protection measures
- User consents to anti-cheat data collection (disclose categories: process list, memory scan, hardware ID — privacy-policy linked)
- Kernel-level anti-cheat: extra-conspicuous disclosure (Vanguard / EAC / BattlEye / PunkBuster patterns)
- Circumventing DRM violates this EULA + DMCA §1201 + EU Information Society Directive Art. 6
- Data collected by anti-cheat: per Privacy Policy

## Telemetry + crash reporting (Section 7)
- Crash reports + diagnostic telemetry transmitted to Licensor
- Categories: stack trace, OS, app version, anonymized device ID, optional logs
- Opt-in / opt-out controls in settings
- Per Privacy Policy
- EU users: GDPR consent / legitimate-interest flow

## Warranty + disclaimer (Section 8 — ALL CAPS for UCC §2-316)
- Limited warranty: Software performs substantially as documented for [90] days from install (if any warranty given at all)
- Beyond limited warranty: Software provided "AS IS" + "AS AVAILABLE"
- No implied warranties of merchantability, fitness for particular purpose, non-infringement, accuracy
- Consumer rights protections preserved where law mandates (EU Sale of Goods Directive, UK Consumer Rights Act, Australian Consumer Law)

## Limitation of liability (Section 9 — ALL CAPS)
- No consequential, incidental, special, indirect, punitive damages
- Aggregate cap: amount paid for the Software in trailing 12 months OR <jurisdiction minimum cap>
- Free software: $50 USD or jurisdiction minimum
- Carve-outs: gross negligence / fraud / death-injury / consumer-mandatory unwaivable

## Indemnification (Section 10)
- Licensor indemnifies for IP infringement claims (third-party patent / copyright) within usage scope
  - Procedure: prompt notice, Licensor controls defense, remedies = procure license / modify / replace / refund unamortized
  - Excludes: combination with non-Licensor software, modification by user, use beyond scope
- Licensee indemnifies for user misuse + user-uploaded content + user breach

## Export control + sanctions (Section 11)
- Software subject to export laws: US EAR + OFAC + EU dual-use Regulation 2021/821 + UK ECJU
- License not granted to:
  - Sanctioned countries (current OFAC list: Cuba, Iran, North Korea, Syria, Russia partial, Crimea / DNR / LNR, others as updated)
  - Sanctioned persons (SDN list)
  - End uses prohibited (WMD, military, nuclear, missile per EAR §744)
- ECCN classification: <ENC if encryption / 5D002 / NLR / etc>
- License Exception ENC for mass-market encryption (if applicable) — file CCATS + semi-annual report
- Encryption registration with BIS (if applicable)

## Termination (Section 12)
- Auto-termination on EULA breach (no notice required for serious breach)
- Licensor may terminate with [30] days notice for material breach if curable
- Licensee may terminate by uninstalling + ceasing use
- Effect of termination:
  - License revoked
  - Licensee must destroy / uninstall all copies
  - Survives termination: Sections [Restrictions, IP, Disclaimer, Limitation, Indemnification, Governing Law, Misc]

## Governing law + dispute (Section 13)
- Governing law: <state / country>
- Exclusive venue / arbitration: per `/terms-of-service-pre` or separate
- UN CISG excluded
- Consumer-mandatory rights preserved per jurisdiction

## Jurisdiction-specific addenda

### EU / EEA
- Reverse-engineering carve-out for interoperability (Directive 2009/24/EC Art. 6) — cannot be waived
- Implied warranty for consumer goods: 2 yr minimum per Sale of Goods Directive
- 14-day right of withdrawal for distance-sold digital content UNLESS user expressly waives + execution started (must disclose)
- EU Digital Content Directive 2019/770 obligations
- Court venue: consumer can sue in own member state (Brussels I bis)

### UK
- Consumer Rights Act 2015: digital content quality + fit-for-purpose can't be disclaimed for consumers
- 14-day right to reject (consumer)

### California
- Auto-renewal disclosure (Cal. BPC §17602)
- Shine the Light (Civ. Code §1798.83)

### Australia
- ACL guarantees can't be excluded for consumers
- ACCC compliance

### Quebec
- French-language requirement (Bill 96)
- Consumer Protection Act 

### China (if shipping CN)
- Cybersecurity Law / PIPL / DSL
- Game publishing license (ISBN / banhao) required for monetized games
- Real-name registration
- Minor playtime caps (NPPA rules)

### Brazil
- LGPD
- CDC consumer code: pro-consumer interpretation; 7-day distance-sales withdrawal

## Store-specific compliance

### Apple App Store (iOS, iPadOS, macOS, watchOS, tvOS, visionOS)
- Custom EULA via App Store Connect (otherwise Apple's Standard EULA applies — limits your protections)
- Sec. 3.1 (IAP): must use Apple IAP for digital goods (with court-ordered carve-outs for external links per recent rulings — verify current state)
- Sec. 5.1 (data): comply with privacy policy + tracking transparency
- Sec. 4.5 (kids): COPPA + Kids Category restrictions
- Lootbox probability disclosure: Sec. 3.1.1
- Sign in with Apple required if other third-party sign-in offered

### Google Play
- Developer Distribution Agreement primary
- Play Billing for digital goods (mostly — recent ruling allows alternative billing for some)
- Families Policy if targeting kids
- Loot box disclosure
- Data Safety form accurate vs actual collection

### Steam
- Steam Subscriber Agreement primary
- Steamworks API rules
- Trading + market rules for virtual items
- Refund policy: 14 days / 2 hr playtime default (you can't override against user)
- VAC + anti-cheat rules

### Microsoft Store
- Standard Application License Terms unless custom
- Xbox-specific add (if console)

### Chrome / Firefox / Edge extensions
- Manifest V3 (Chrome / Edge)
- Permissions transparency
- Remote code restrictions
- Data handling disclosure

## Versioning + change procedure
- Version numbers + effective date
- Material change: re-acceptance flow on next launch
- Minor change: in-app notice
- Archive of prior versions: <URL>

## In-app About / NOTICES screen
Must include:
- Software version
- Copyright notice
- Trademarks
- OSS components + licenses (full text or link)
- Patent notices (if any)
- Export classification statement
- Link to full EULA
- Link to Privacy Policy
- Link to ToS (if online service)

## Anti-patterns
- ❌ Shipping with Apple Standard EULA when custom protections needed
- ❌ Reverse-engineering blanket ban in EU (unenforceable + DPA fines)
- ❌ Hidden auto-update mechanism without disclosure
- ❌ Lootbox without probability disclosure
- ❌ Kernel anti-cheat without conspicuous notice
- ❌ Account-bound virtual goods without forfeiture-on-termination disclosure
- ❌ OSS components used without NOTICES screen / attribution
- ❌ Copyleft (GPL / AGPL) statically linked into proprietary binary
- ❌ Export to sanctioned jurisdiction without screen
- ❌ Encryption shipped without ECCN classification + BIS process
- ❌ Click-wrap missing → unenforceable license
- ❌ One EULA for ToS-required online interaction (need separate ToS)
- ❌ China shipment without banhao for monetized game
- ❌ COPPA app without Kids-category compliance
- ❌ Lawyer review skipped before App Store / Play submission

## Pre-launch checklist
- [ ] Distribution channels listed + each channel's mandatory overrides reviewed
- [ ] License grant scope (copies / devices / users / purposes) defined
- [ ] Click-wrap timing wired (install / first-run / update)
- [ ] Acceptance record stored
- [ ] Restrictions section includes EU reverse-engineering carve-out
- [ ] OSS NOTICES screen + attribution
- [ ] Copyleft audit clean (`/licensing-audit`)
- [ ] Virtual goods / IAP / lootbox disclosure (if applicable)
- [ ] Anti-cheat / DRM disclosure (if applicable)
- [ ] Telemetry opt-in/out (per privacy policy)
- [ ] ALL CAPS warranty + liability
- [ ] Export control screen + ECCN classification
- [ ] Termination + uninstall consequence
- [ ] Jurisdiction-specific addenda (EU / UK / CA / AU / CN / BR / Quebec)
- [ ] Store-specific compliance per channel
- [ ] Update + versioning procedure
- [ ] About / NOTICES screen in-app
- [ ] Lawyer reviewed before submission

## Anti-patterns flagged
- ❌ Default store EULA when custom needed
- ❌ No reverse-engineering carve-out (EU)
- ❌ No OSS attribution
- ❌ Copyleft contamination
- ❌ Lootbox without probability disclosure
- ❌ Anti-cheat without conspicuous notice
- ❌ Export controls missed
- ❌ Click-wrap missing
- ❌ Store-specific clauses missed → submission rejection

## Next
- ToS → `/terms-of-service-pre`
- Privacy Policy → `/privacy-policy-pre`
- DPA → `/dpa-template`
- IP strategy → `/ip-strategy`
- OSS audit → `/licensing-audit`
- Export control → `/export-control-screen`
- AI/ML weights handling → `/ai-act-classifier`
```

## Verification
- Distribution channels + per-channel overrides identified.
- License grant scope explicit (copies / devices / users / purposes / term).
- Click-wrap timing wired + acceptance stored.
- EU reverse-engineering carve-out present.
- OSS NOTICES + copyleft audit linked.
- Virtual goods / lootbox / DRM / anti-cheat clauses (where applicable).
- ALL CAPS warranty + liability.
- Export control + ECCN.
- Store-specific compliance per channel.
- Jurisdiction addenda.
- Versioning + update flow.
- Lawyer review pre-submission.
