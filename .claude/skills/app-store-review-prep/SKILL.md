---
name: app-store-review-prep
description: Pre-submission compliance precheck against Apple App Review Guidelines and Google Play Developer Program Policies. Inputs the app's feature list, monetization model, data collection, and target SDK; outputs a rejection-risk register, required metadata (privacy nutrition labels, Data Safety form, App Privacy details, Privacy Manifest, ATT prompt copy), reviewer notes draft, and TestFlight/Internal Testing rollout plan. Writes `docs/release/app-store-review-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "App Review", "App Store rejection", "Play Store policy", "submit to App Store", "TestFlight", "Play Console", "reviewer notes", "/app-store-review-prep", or before any submission to App Store Connect or Google Play Console.
output_size:
  XS: skip
  S: 1h
  M: 2h
  L: 3h
  XL: 4h
---

# /app-store-review-prep — App Store + Play Store submission precheck

## Why you'd care

Each rejection costs a week and pushes your launch date past your marketing window. Pre-checking the obvious traps — privacy nutrition labels, ATT copy, IAP rules, sign-in-with-Apple parity — is the difference between approved-on-first-try and a four-week submission loop.

Invoke as `/app-store-review-prep`. Run before every public submission and before every major version that adds a new permission, IAP SKU, account-creation surface, or third-party SDK.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP (no mobile distribution at XS)
   - S+ → run if shipping native, React Native, Flutter, Capacitor, or hybrid app to App Store / Play Store
2. Read `docs/inception/pii-inventory-<project>.md` if present (privacy labels depend on it).
3. Read `docs/design/in-app-purchase-<project>.md` if present (IAP rejection is the #1 reason).
4. Inspect any prior rejection emails in App Store Connect → Resolution Center.

## Inputs
- Bundle ID / Application ID for each store.
- Target SDK / iOS deployment target.
- Feature list — especially: account creation, social login, payments, UGC, camera, location, contacts, health, kids content, crypto, gambling, dating, generative AI.
- Monetization model: free, paid, IAP consumable, auto-renewing subscription, ads, external payment (reader app).
- List of third-party SDKs (analytics, attribution, ads, crash, push).
- Existing privacy policy + support URLs.

## Process
1. **Guideline scan — Apple App Review Guidelines (current)**:
   - **1.1 Objectionable Content** — UGC must have report + block + moderation + EULA
   - **1.2 User-Generated Content** — minimum 4 controls: filter, report, block, contact info
   - **2.1 App Completeness** — no placeholder, demo account credentials in Review Notes
   - **2.3.10 Accurate Metadata** — screenshots must show in-app content, no Android frames
   - **2.5.1 Software Requirements** — only documented APIs; no private API symbols
   - **3.1.1 In-App Purchase** — digital goods MUST use IAP; no external payment links except reader-app entitlement / EU DMA / Music Streaming Services entitlement
   - **3.1.3(b) Multiplatform Services** — informational link to website pricing is allowed under External Link Account Entitlement
   - **3.2.2 Unacceptable** — artificially manipulating reviews, ranking
   - **4.0 Design** — minimum functionality; not a web wrapper
   - **4.2 Minimum Functionality** — no "we are a website" wrappers
   - **4.7 HTML5 Games / Mini-apps** — sandboxed
   - **4.8 Sign in with Apple** — required if you offer Google/Facebook/Twitter login AND collect PII (carve-outs for education/enterprise SSO)
   - **5.1.1 Data Collection & Storage** — privacy policy URL required at submission
   - **5.1.1(v) Account Deletion** — in-app deletion required since iOS 16 (June 2022)
   - **5.1.2 Data Use & Sharing** — App Tracking Transparency prompt for IDFA
   - **5.1.7 AI-Generated Content** — guardrails + report mechanism (2024+)
   - **Privacy Manifest** (PrivacyInfo.xcprivacy) — required for all apps and SDKs since May 1, 2024; declare NSPrivacyTracking, NSPrivacyTrackingDomains, NSPrivacyCollectedDataTypes, and Required Reason API usage (file timestamp, system boot time, disk space, active keyboard, user defaults)
2. **Guideline scan — Google Play Developer Program Policies (current)**:
   - **Data Safety form** — required disclosure for every data type collected/shared (Play Console → Policy → App content)
   - **Permissions & APIs that Access Sensitive Information** — declaration form for SMS/Call Log, Location (background), All Files Access, AccessibilityService, Health Connect
   - **Families Policy** — if targeting children; designed-for-families program
   - **Target API Level** — Play requires targetSdk = currentApi − 1 (currently 34 for new apps as of Aug 2024; 35 for updates by Aug 31, 2025)
   - **Payments** — Play Billing required for digital goods; external billing allowed in EEA/India/S.Korea under user-choice billing (12% fee reduction)
   - **Subscriptions** — must show full price, billing period, free-trial conversion terms
   - **Account Deletion** — in-app + web URL since 2024
   - **Health Apps** — Health Connect data requires declaration
   - **Generative AI Apps** — must allow users to report offensive content (2024)
   - **Real-Money Gambling** — country-by-country allowlist
   - **Financial Services** — country-specific disclosures
3. **Privacy labels & manifests**:
   - Apple App Privacy "Nutrition Labels" — fill in App Store Connect → App Privacy
   - Apple Privacy Manifest (PrivacyInfo.xcprivacy) — generate per app target + verify each SDK ships its own
   - Google Data Safety form — line item per data type with collection/sharing/purpose/optional
4. **ATT (App Tracking Transparency)** — if you call IDFA or share data with brokers; prompt copy + pre-prompt copy + denied-state fallback
5. **Encryption export compliance (ITSAppUsesNonExemptEncryption)** — most apps use exempt encryption (HTTPS only); confirm or file annual self-classification report with BIS
6. **Reviewer notes** — demo account, test card numbers, OTP bypass, geo-fenced feature instructions, video walkthrough
7. **TestFlight & Internal Testing**:
   - TestFlight internal (up to 100) — instant; external (up to 10,000) — Beta App Review (typically <24h)
   - Play Internal testing (up to 100) — instant; Closed Testing — required for 12-tester / 14-day rule before Production access (2023 policy)
8. **Rejection runbook** — pre-write the "Reply to Review Team" template for the top 5 likely rejection reasons

## Output
Write `docs/release/app-store-review-<project>.md`:

```markdown
# App Store + Play Store Submission Precheck — <project>
**Date:** <YYYY-MM-DD>
**Submission target:** iOS 1.4.0 (build 142) + Android 1.4.0 (versionCode 1400)

## Rejection-risk register
| # | Guideline | Risk | Mitigation | Owner |
|---|---|---|---|---|
| 1 | App Store 3.1.1 IAP | Subscription upsell shown before paywall sheet — could read as "external payment" | Refactor to StoreKit2 SubscriptionStoreView | iOS lead |
| 2 | App Store 5.1.1(v) Account deletion | Currently web-only delete | Add in-app Settings → Delete Account → confirm → revoke token | mobile |
| 3 | App Store 4.8 Sign in with Apple | Offer Google login and collect email → SIWA required | Add SIWA button above Google | mobile |
| 4 | App Store Privacy Manifest | Missing for Sentry-cocoa <8.36 | Upgrade SDK; verify NSPrivacyAccessedAPITypes | mobile |
| 5 | Play Data Safety | "Approximate location" collected but undeclared | Update Data Safety form | PM |
| 6 | Play Target API 34 | Currently 33 | Bump compileSdk + targetSdk to 34 | Android lead |
| 7 | Play Subscriptions | Trial terms not in paywall copy | Add "$0 for 7 days, then $9.99/mo" line | design |
| 8 | ATT | Tracking IDFA via AppsFlyer without prompt | Wire ATTrackingManager.requestTrackingAuthorization on first attribution event | mobile |
| 9 | Reviewer notes | Phone OTP gated; reviewer cannot pass | Hard-code 555-0100 bypass for App Review build | backend |
| 10 | Generative AI 5.1.7 | LLM chat surface, no report button | Add long-press → Report | mobile |

## Apple Privacy Nutrition Label
| Data type | Collected | Linked to user | Used for tracking | Purpose |
|---|:--:|:--:|:--:|---|
| Email | yes | yes | no | App Functionality, Account Management |
| Name | yes | yes | no | App Functionality |
| Phone | yes | yes | no | App Functionality (2FA) |
| Precise location | no | — | — | — |
| Coarse location | yes | yes | no | Analytics |
| Purchase history | yes | yes | no | App Functionality |
| User content (photos) | yes | yes | no | App Functionality |
| Crash data | yes | no | no | App Functionality (Sentry) |
| Performance data | yes | no | no | Analytics (Firebase) |
| Identifiers — User ID | yes | yes | no | App Functionality |
| Identifiers — Device ID (IDFA) | yes | yes | YES | Third-Party Advertising (AppsFlyer) |

## Privacy Manifest (PrivacyInfo.xcprivacy)
- NSPrivacyTracking: true (we send IDFA to AppsFlyer on ATT-authorized state only)
- NSPrivacyTrackingDomains: ["appsflyer.com", "facebook.com"]
- NSPrivacyAccessedAPITypes:
  - FileTimestamp — reason `C617.1` (display to user)
  - UserDefaults — reason `CA92.1` (access by app itself)
  - SystemBootTime — reason `35F9.1` (measure elapsed time)
- Required-reason check against every SDK's bundled PrivacyInfo.xcprivacy

## Google Data Safety form
| Data type | Collected | Shared | Optional | Purpose |
|---|:--:|:--:|:--:|---|
| Email address | yes | no | no | Account management |
| Phone number | yes | no | no | Account management, App functionality |
| Name | yes | no | yes | Personalization |
| Approximate location | yes | yes (AppsFlyer) | yes | Analytics, Advertising |
| Photos | yes | no | yes | App functionality |
| App interactions | yes | yes (Firebase, AppsFlyer) | no | Analytics |
| Crash logs | yes | yes (Sentry) | no | App functionality |
| Device or other IDs | yes | yes | no | Analytics, Advertising |
- Data encrypted in transit: yes
- Data deletion request available: yes (in-app + web)

## ATT prompt copy
- **Pre-prompt** (in-app sheet): "Help us improve <App>. Allow tracking so we can credit the friend who invited you and personalize recommendations. You can change this anytime in Settings → Privacy."
- **System prompt usage description (NSUserTrackingUsageDescription)**: "Used to credit invite referrals and personalize content."
- **Denied state**: still functions; AppsFlyer falls back to SKAdNetwork.

## Reviewer Notes (paste in App Store Connect)
```
Demo account:
  Email: appreview+may2026@<project>.com
  Password: ReviewPass!2026
Test phone (auto-bypass OTP, code 000000): +1 555-0100
Test card: 4111 1111 1111 1111 / 12/29 / 123
Sandbox IAP user: appreview-sandbox@<project>.com (Sandbox tester in App Store Connect)
Geo-gated feature "Live Tables" — set device region to US.
Walkthrough video: https://<our-cdn>/review-video-1.4.0.mp4
Known limitation: push notifications require physical device; not testable on Simulator.
```

## Reviewer Notes (paste in Play Console → App content → App access)
```
Demo account: appreview@<project>.com / ReviewPass!2026
Test phone: +1 555 0100, OTP 000000
License-test account is set in Play Console → Setup → License testing.
Test card 4111 1111 1111 1111 with Google Play Billing test mode.
```

## Encryption export compliance
- Uses only standard HTTPS / TLS → exempt
- Set ITSAppUsesNonExemptEncryption = NO in Info.plist
- Annual self-classification report: not required for exempt apps

## Submission rollout plan
| Stage | Audience | Duration | Exit criteria |
|---|---|---|---|
| Dev | engineers | continuous | green build |
| TestFlight Internal | 12 internal | 2 days | smoke + crash-free >99.5% |
| TestFlight External (Beta App Review) | 100 testers | 3 days | no P1 bugs, NPS pulse |
| Play Internal | 12 internal | 2 days | parity with TestFlight Internal |
| Play Closed (Alpha) | 50 — meet 12-tester/14-day rule for new dev accts | 14 days | required for new accounts |
| App Store Production — phased release | 1% → 2% → 5% → 10% → 20% → 50% → 100% over 7 days | 7 days | crash-free >99.5%, no Resolution Center entries |
| Play Production — staged rollout | 1% → 5% → 20% → 50% → 100% | 5 days | crash-free >99.5%, ANR <0.47% |

## Rejection-reply runbook
- **3.1.1 IAP rejection** → reply template, link to StoreKit2 code, screencast of paywall
- **5.1.1 Privacy policy** → confirm URL is publicly accessible, no auth wall
- **2.1 Crashes on launch** → request crash log, symbolicate via dSYM upload to Sentry, fix + resubmit
- **2.3.10 Metadata** → re-shoot screenshots without status-bar mocks, remove "Android" wording
- **4.0 Minimum functionality** → demonstrate native features (push, biometrics, share sheet, widgets)
- Expedited Review request reserved for: bug fixing safety-of-life, broken auth, regulatory takedown

## Cost + timeline
| Item | Cost | Time |
|---|--:|---|
| Apple Developer Program | $99/yr | annual |
| Google Play Developer | $25 one-time | once |
| TestFlight Beta App Review (external) | $0 | <24h typical |
| Play Closed Testing 12-tester/14-day | $0 | 14 days (new accounts only) |
| Localized screenshots (Fastlane Snapshot) | dev time | 3 days |
| Privacy review (legal) | $2k–$5k | 1 week |
| Re-submission after rejection | dev time | 1–3 days per round |

## Risk if skip
- Rejection cycle adds 24–72h per round; typical first-time rejection adds 1–2 weeks
- Removal from store mid-launch if Privacy Manifest missing post-May 2024
- IAP 3.1.1 violations risk developer-account termination on repeat offense
- Data Safety inaccuracies trigger Play policy strike → app removal
- ATT non-compliance → IDFA returns all-zeros + risk of removal under 5.1.2
- App Tracking violations have led to multi-million-dollar fines (CNIL, ICO) since 2023

## Verification
- Every guideline row above has an owner.
- Privacy Nutrition Label + Data Safety form filled.
- Privacy Manifest verified per SDK (`grep -r PrivacyInfo.xcprivacy Pods/`).
- ATT prompt copy approved by product + legal.
- Reviewer notes drafted with working demo credentials.
- Rollout stages defined with crash-free gate.
```

## Verification
- Both Apple and Google guideline scans completed.
- Rejection-risk register has ≥10 rows ranked by likelihood × impact.
- Privacy Nutrition Label + Data Safety form lines item-by-item filled.
- Privacy Manifest declared with Required Reason API codes.
- Reviewer notes contain working demo credentials, OTP bypass, sandbox IAP user.
- Phased release / staged rollout percentages set with exit criteria.
- Rejection-reply runbook prewritten for top 5 likely reasons.
