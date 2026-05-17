---
name: privacy-policy-pre
description: Pre-launch Privacy Policy draft — GDPR + CCPA/CPRA + UK GDPR + LGPD layered disclosures, lawful basis matrix, data inventory linkage, cookie + tracker disclosure, children + sensitive data, do-not-sell/share signal, retention + rights flow. Outputs to `docs/inception/privacy-policy-pre-<project>.md`. Use when user says "privacy policy", "privacy notice", "data protection notice", "/privacy-policy-pre", or before public launch / first data collection.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /privacy-policy-pre — Privacy Policy Drafted From Real Data Inventory, Not Template Copy-Paste.

A privacy policy that doesn't match what your code actually does = a regulatory complaint waiting. Draft from `/pii-inventory-pre` output, layer disclosures for GDPR + CCPA + UK + Brazil + the other 30 regimes, and ship before the first byte of PII is collected.

## Why you'd care

A privacy policy copied from a competitor's site is a regulatory time bomb — it makes claims your stack can't honor, and "we didn't know" isn't a GDPR defense. Drafting from your actual data inventory is what makes it enforceable in both directions.

## Pre-flight
Run before public launch OR before any user-data collection (analytics, signup, contact form). Pairs with `/pii-inventory-pre`, `/data-flow-diagram-pre`, `/lawful-basis-mapping`, `/cookie-banner-design`, `/dpa-template`, `/terms-of-service-pre`.

## Inputs
- Output of `/pii-inventory-pre` (what data, where stored, why, how long).
- Output of `/lawful-basis-mapping` (per-purpose lawful basis for GDPR).
- Output of `/data-flow-diagram-pre` (processors + cross-border flows).
- Target jurisdictions (US, EU, UK, CA, BR, others).
- User age range (13+ / 16+ / 18+).
- Cookies + trackers used.
- Whether AI/ML training on user data is planned.

## Process
1. **Pull data inventory** — every PII category goes in policy. Mismatch = FTC enforcement target.
2. **Layer disclosures per jurisdiction** — GDPR Art. 13/14, CCPA/CPRA, UK GDPR, LGPD, etc.
3. **Lawful basis matrix per processing purpose** — required for GDPR.
4. **Sensitive / special-category data** — Art. 9 / CPRA sensitive — heightened disclosure + opt-in.
5. **Children data** — COPPA U13 / GDPR-K 13-16 / Quebec / state-by-state.
6. **Cookies + trackers** — what categories, what purpose, opt-in/out path.
7. **Retention schedule** — per category, per purpose.
8. **Rights flow** — access / delete / portability / objection / opt-out — and how to exercise.
9. **Cross-border transfers** — adequacy / SCCs / TIA reference.
10. **AI training disclosure** — if training on user data, conspicuous notice + opt-out.
11. **Versioning + change notice** — material change procedure.
12. **Lawyer review pre-launch.**

## Output
Write `docs/inception/privacy-policy-pre-<project>.md`:

```markdown
# Privacy Policy (Pre-launch Draft) — <project>
**Owner:** founder / DPO / General Counsel
**Date:** <YYYY-MM-DD>
**Version:** 0.1 (pre-launch draft)
**Status:** DRAFT — lawyer review + DPO review required before launch
**Effective date:** <YYYY-MM-DD upon launch>
**Jurisdictions covered:** US (federal + CA + state mosaic), EU (GDPR), UK (UK GDPR + DPA 2018), Brazil (LGPD), <others>

## Why this exists pre-launch
- Privacy policy is a regulatory document, not marketing copy — FTC, state AGs, EU DPAs all enforce it
- The policy must match what the code actually does (data inventory) or it's a deceptive practice
- GDPR Art. 13 requires notice at collection — policy live before first byte of EU PII
- CCPA requires policy + "Do Not Sell or Share My Personal Information" link before any CA collection
- COPPA requires verifiable parental consent before any U13 collection
- Material changes require notice + sometimes new consent — easier to start broad and refine

## Source-of-truth feed
This policy is generated from:
- `docs/inception/pii-inventory-pre-<project>.md` (data inventory)
- `docs/inception/data-flow-diagram-pre-<project>.md` (processors + flows)
- `docs/inception/lawful-basis-mapping-<project>.md` (GDPR Art. 6 basis per purpose)

If the code/inventory changes, this policy must update. Drift = liability.

## Layered structure
- **Layer 1 (short notice):** 1-page TL;DR at top — categories, purposes, rights, contact. Plain language.
- **Layer 2 (full notice):** Detailed sections below.
- **Layer 3 (just-in-time):** Inline disclosures at collection points (signup, analytics opt-in, cookie banner) — not in this doc.

## Layer 1 — Quick summary
**What we collect:** account info (email, name), usage data (clicks, page views), device data (IP, user-agent), <other>.
**Why:** to provide the Service, secure accounts, improve product, comply with law.
**Who we share with:** processors (hosting, email, analytics, payments — see Section X), legal-compulsion recipients.
**How long we keep it:** per Retention Schedule (Section X).
**Your rights:** access, delete, port, object, opt-out of sale/share — see Section X.
**Contact:** <privacy@example.com>
**EU representative:** <if applicable, Art. 27>
**UK representative:** <if applicable>
**DPO:** <if applicable, Art. 37>

## Layer 2 — Full notice

### 1. Who we are (Controller / Business)
- Legal entity: <name>
- Registered address: <address>
- Contact: <privacy@example.com>
- DPO (if Art. 37 trigger): <name / contact>
- EU Art. 27 representative (if non-EU controller offers to EU): <name / address>
- UK representative (if non-UK controller offers to UK): <name / address>

### 2. Scope
- Personal information collected via the Service (website, app, API)
- Excludes: data we don't collect (third-party links, etc.)
- Does NOT apply to: anonymized / aggregated data

### 3. Categories of personal information collected

| Category | Examples | Source | Required? |
|----------|----------|--------|-----------|
| **Account / identifiers** | Name, email, username, password hash, user ID | Direct from user | Yes for account |
| **Contact** | Phone, address, billing address | Direct / payment processor | If applicable |
| **Authentication** | Password hash, MFA secrets, session tokens, OAuth tokens | Direct / IdP | Yes |
| **Usage / activity** | Pages, clicks, sessions, feature events, timestamps | Automated | No (analytics opt-in if EU) |
| **Device / technical** | IP, user-agent, OS, browser, screen, language, timezone | Automated | No |
| **Location** | Approximate (from IP), precise (if GPS opted in) | Automated / opt-in | No |
| **Payment** | Last 4 of card, expiry, billing zip (full card stored by processor) | Payment processor | If purchasing |
| **Commercial / transaction** | Orders, subscription, refunds | Automated | If purchasing |
| **User content** | Files, posts, messages uploaded | Direct | If using feature |
| **Communications** | Support tickets, emails to us | Direct | If contacting |
| **Inferences** | Preferences, behavior segments derived from above | Derived | No |
| **Sensitive (CPRA / Art. 9)** | <if applicable: health, race, religion, sexual orientation, precise geolocation, gov ID, financial account, biometric, genetic> | <source> | Opt-in only |
| **Children data (U13)** | <if applicable> | <source> | Verifiable parental consent only |

### 4. Sources
- Directly from you (signup, settings, content)
- Automatically as you use the Service (logs, analytics, cookies)
- From third parties (OAuth login providers, payment processor, fraud prevention)
- From public sources (very rarely — disclose specifically if so)

### 5. Purposes + lawful bases (GDPR Art. 6)

| Purpose | Categories used | Lawful basis (GDPR) | CCPA business purpose |
|---------|-----------------|---------------------|----------------------|
| Provide + operate the Service | Account, usage, device | Contract (Art. 6(1)(b)) | Performing services |
| Authenticate + secure accounts | Account, auth, device | Contract + Legitimate interest (security) | Detecting security incidents |
| Process payments | Payment, contact, commercial | Contract | Performing services |
| Customer support | Account, communications | Contract / Legitimate interest | Performing services |
| Product improvement + analytics | Usage, device, inferences | Legitimate interest (with opt-out) OR consent (EU strict reading) | Internal research |
| Marketing communications | Account, contact, inferences | Consent (EU) / opt-out (US) | Advertising / marketing |
| Personalization | Usage, inferences | Legitimate interest / consent | Performing services |
| Fraud prevention | All | Legitimate interest + Legal obligation | Detecting security incidents |
| Legal compliance | All | Legal obligation (Art. 6(1)(c)) | Complying with law |
| Defending legal claims | All | Legitimate interest | Auditing / defending claims |
| <AI training, if applicable> | <specify> | Consent (strongly recommended) OR legitimate interest (with opt-out + LIA) | <specify> |

**For sensitive / special-category data** (Art. 9): explicit consent OR specific other Art. 9 condition. Explicit. Always.

### 6. Cookies + similar technologies
- **Strictly necessary:** session, auth, CSRF — no consent needed (EU ePrivacy)
- **Functional:** preferences, language — consent recommended in EU
- **Analytics:** product analytics — consent required in EU (PostHog/Mixpanel/GA4 all need opt-in)
- **Advertising:** retargeting / cross-site — consent required in EU + CCPA opt-out in US
- **Cookie banner** disclosed at first visit (consent for EU, notice + opt-out for US)
- **Do Not Track signal:** how we treat (most: ignore; some: honor as opt-out)
- **Global Privacy Control (GPC):** CCPA requires honoring as opt-out

Cookie list (separate page): <URL>

### 7. Recipients (who we share with)
**Service providers / processors** (work for us, bound by contract):
- Hosting: AWS / Vercel / GCP / Cloudflare
- Database: <provider>
- Email: Postmark / SendGrid / Resend
- Analytics: PostHog / Mixpanel / GA4
- Payments: Stripe / Adyen / others
- Customer support: Plain / Intercom / Linear
- Error monitoring: Sentry / Datadog
- File storage: S3 / R2 / GCS
- <others>

Full sub-processor list maintained at <URL>.

**Third parties (not service providers):**
- Legal compulsion: courts, regulators on lawful request
- Acquirer: in a merger / acquisition (will notify)
- Aggregated / anonymized partners: only de-identified data
- <if any sale or share for cross-context behavioral ads: declare and provide opt-out>

**We do NOT sell** personal information for money, as defined under CCPA, **unless this box is checked:** ☐. If checked, see Section 11 for opt-out.

**Sharing for cross-context behavioral advertising** (CPRA): ☐ Yes / ☐ No. If Yes, see opt-out.

### 8. International data transfers
- Primary processing: <country>
- Transfers to: <list countries>
- Transfer mechanisms:
  - EU → US: SCCs 2021/914 + Transfer Impact Assessment / EU-US Data Privacy Framework (if recipient certified)
  - UK → other: UK IDTA Addendum
  - Switzerland → other: Swiss Addendum
  - Adequacy decisions used: <list>
- Copies of safeguards available on request: <privacy@example.com>

### 9. Retention
| Category | Active retention | Post-account retention | Justification |
|----------|------------------|------------------------|---------------|
| Account / identifiers | Life of account | 90 days | Service provision + dispute window |
| Auth / sessions | Active session | 24 hours | Security |
| Usage / analytics | 25 months | Aggregated thereafter | Product improvement |
| Logs | 90 days | — | Security + ops |
| Payment / transaction | 7 years | 7 years | Tax + accounting law |
| Communications | 3 years | 3 years | Support history |
| Backups | 35 days rolling | — | DR |
| Marketing consent | Until withdrawn | Withdrawal proof retained | Demonstrate consent (Art. 7) |

After retention period: deleted or irreversibly anonymized.

### 10. Your rights (GDPR + UK GDPR)
- **Access** (Art. 15) — get a copy of your data
- **Rectification** (Art. 16) — correct inaccurate data
- **Erasure / "right to be forgotten"** (Art. 17) — delete data where law allows
- **Restriction** (Art. 18) — pause processing while we sort out a dispute
- **Portability** (Art. 20) — receive data in machine-readable format
- **Object** (Art. 21) — to legitimate-interest processing + to direct marketing absolutely
- **Withdraw consent** (Art. 7(3)) — anytime, without affecting prior lawful processing
- **Lodge complaint** with supervisory authority — list of EU DPAs, ICO for UK
- **Not be subject to automated decisions** with legal/significant effect (Art. 22) — describe if any

How to exercise: email <privacy@example.com> OR self-serve portal at <URL>.
Response time: 30 days (extendable 60 days for complex requests).
Verification: we may ask to verify identity proportionally.
No fee for first request; reasonable fee for excessive/repeat.

### 11. California rights (CCPA + CPRA)
California residents have, additionally:
- Right to know — categories + specific pieces (12-mo lookback / 24-mo with CPRA)
- Right to delete
- Right to correct (CPRA)
- Right to limit use of sensitive PI (CPRA)
- Right to opt-out of sale or sharing — "Do Not Sell or Share My Personal Information" link at <URL>
- Right to opt-out of automated decision-making (in CPRA regulations)
- Non-discrimination for exercising rights

Honoring Global Privacy Control (GPC): Yes (required).

Authorized agent: <process>.

### 12. Other US state rights
We extend equivalent rights to residents of: Virginia (VCDPA), Colorado (CPA), Connecticut (CTDPA), Utah (UCPA), Texas (TDPSA), Florida (FDBR), Oregon (OCPA), Montana, Tennessee, Delaware, New Hampshire, New Jersey, Indiana, Iowa, Kentucky, Minnesota, Maryland, Rhode Island, <others as adopted>. Same exercise procedure as above.

### 13. Brazil rights (LGPD)
LGPD rights (Art. 18): confirmation, access, correction, anonymization, portability, deletion, info on sharing, info on consequences of refusing consent, revocation of consent.
Contact: <privacy@example.com> or DPO (Encarregado).

### 14. Children
- We do NOT knowingly collect from children U13 (US) / U16 (EU varies 13-16 by member state).
- If we discover U13 data collected without parental consent, we delete promptly.
- Parents: contact <privacy@example.com> to review or delete child's data.
- COPPA-specific operators: separate COPPA notice required.

### 15. Sensitive personal information
Under CPRA + GDPR Art. 9, sensitive PI includes: gov ID, financial account, precise geolocation, race / ethnicity, religion, union membership, genetic, biometric, health, sex life / orientation, communications content, citizenship / immigration status.
- We collect: <list categories, if any> for <purposes>.
- We do NOT use sensitive PI for purposes beyond providing the Service.
- CA residents can limit use via <URL>.

### 16. Automated decision-making + AI
- We use AI/ML for: <e.g. fraud scoring, recommendation, content moderation>.
- Significant decisions made automatically: <yes / no>; if yes, you can request human review (Art. 22).
- **AI training on user data:** <Yes / No>. If Yes:
  - Categories used: <list>
  - Lawful basis: <consent / legitimate interest with opt-out>
  - Opt-out: <URL>
  - User content used: <yes / no>
  - Cross-customer / aggregated: <describe>

### 17. Security
- We use industry-standard technical + organizational measures (see TOMs in DPA / `/threat-model-pre`).
- Encryption in transit + at rest.
- Access control + least privilege.
- Vulnerability management.
- Breach notification per Art. 33/34 + state breach laws.
- No system is 100% secure — best efforts statement.

### 18. Data breach notification
- If a breach likely to result in high risk: notify affected users without undue delay (Art. 34).
- Notify supervisory authority within 72 hours (Art. 33) where required.
- US state breach laws followed where applicable.

### 19. Changes to this policy
- We may update — current version + date at top.
- **Material changes:** 30-day prior notice via email + in-app + posted.
- Continued use after effective date = acceptance.
- Archived prior versions: <URL>.

### 20. Contact + complaint paths
- Privacy questions: <privacy@example.com>
- DPO: <name / contact>
- EU Art. 27 rep: <name / address>
- UK rep: <name / address>
- Supervisory authority complaint:
  - EU: list of DPAs at <edpb.europa.eu>
  - UK: ICO at <ico.org.uk>
  - US: FTC + state AG
  - Brazil: ANPD

## Just-in-time disclosures (separate from this policy)
Tag points in the product where disclosure happens at collection:
- Signup form: link to this policy + checkbox
- Cookie banner: granular consent (EU) / opt-out (US)
- Analytics consent (EU): explicit opt-in
- Marketing email consent: separate checkbox, unchecked, soft opt-in only for existing customers in jurisdictions that allow
- Sensitive data collection: explicit consent + purpose
- AI training: conspicuous + opt-out
- Children gate: age verification + parental consent (if U13)

## Cross-reference matrix
| This section | GDPR article | CCPA / CPRA | LGPD | UK GDPR |
|--------------|--------------|-------------|------|---------|
| Categories (§3) | Art. 13(1)(c) | §1798.100(a) | Art. 9 | Art. 13 |
| Purposes + basis (§5) | Art. 6, 13(1)(c)(d) | §1798.100(a) | Art. 7-11 | Art. 6 |
| Recipients (§7) | Art. 13(1)(e) | §1798.100(a) | Art. 9 III | Art. 13 |
| Transfers (§8) | Art. 13(1)(f), 44-49 | — | Art. 33 | Art. 13 + Schedule 21 |
| Retention (§9) | Art. 13(2)(a) | §1798.100(a)(3) | Art. 15 | Art. 13 |
| Rights (§10-13) | Art. 13(2)(b), 15-22 | §1798.105+ | Art. 18 | Art. 13 |
| Children (§14) | Art. 8 | §1798.120(c) | Art. 14 | Art. 8 (DPA s9) |
| Sensitive (§15) | Art. 9 | §1798.121 | Art. 11 | Art. 9 |
| Automated decisions (§16) | Art. 22 | §1798.185(a)(16) | Art. 20 | Art. 22 |
| Breach (§18) | Art. 33, 34 | State breach laws | Art. 48 | Art. 33, 34 |

## Anti-patterns
- ❌ Template policy that doesn't match data inventory
- ❌ "We may share with third parties" with no list
- ❌ "We don't sell data" with no CCPA-specific definition / link
- ❌ Cookie disclosure missing or vague
- ❌ No lawful basis per purpose (GDPR)
- ❌ Single retention period for all data
- ❌ Rights flow without contact path
- ❌ Children data collected without verifiable parental consent
- ❌ Sensitive data without explicit consent
- ❌ AI training on user data without disclosure + opt-out
- ❌ Cross-border transfer with no mechanism named
- ❌ No EU / UK Art. 27 representative when required
- ❌ No DPO when triggered (large-scale monitoring / sensitive)
- ❌ Material change without notice
- ❌ Drafted by founder without lawyer / DPO review

## Pre-launch checklist
- [ ] Data inventory + lawful basis + flow diagrams pulled
- [ ] All PII categories disclosed
- [ ] Purposes + lawful bases mapped (GDPR table)
- [ ] CCPA/CPRA specific section + DNSMPI link
- [ ] LGPD specific section (if BR)
- [ ] UK GDPR specifics
- [ ] Cookie banner wired separately
- [ ] Cross-border transfer mechanisms named
- [ ] Retention schedule per category
- [ ] Rights exercise flow live + tested
- [ ] Children gate (if applicable)
- [ ] Sensitive data explicit-consent flow
- [ ] AI training disclosure + opt-out (if applicable)
- [ ] EU rep + UK rep + DPO as required
- [ ] Material-change notice procedure
- [ ] Lawyer + DPO review before launch

## Anti-patterns flagged
- ❌ Policy doesn't match inventory
- ❌ Missing CCPA DNSMPI link
- ❌ No cookie banner
- ❌ No rights exercise path
- ❌ AI training without disclosure
- ❌ Sensitive data without explicit consent
- ❌ Children data without parental consent
- ❌ No EU rep when required
- ❌ Generic template with no jurisdiction-specifics

## Next
- ToS → `/terms-of-service-pre`
- EULA → `/eula-pre`
- DPA → `/dpa-template`
- Cookie banner → `/cookie-banner-design`
- Data inventory → `/pii-inventory-pre`
- Lawful basis → `/lawful-basis-mapping`
- Data flow diagram → `/data-flow-diagram-pre`
- Retention policy → `/records-retention-pre`
```

## Verification
- Drafted from data inventory + lawful basis output.
- All PII categories disclosed.
- Lawful basis per purpose (GDPR table).
- CCPA / CPRA / LGPD / UK GDPR specifics.
- Cookies disclosed.
- Cross-border mechanism stated.
- Retention schedule per category.
- Rights exercise flow.
- Children + sensitive + AI training disclosures.
- EU / UK rep + DPO as required.
- Lawyer + DPO review pre-launch.
