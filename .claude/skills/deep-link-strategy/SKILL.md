---
name: deep-link-strategy
description: Mobile deep link strategy — Universal Links (apple-app-site-association / AASA), Android App Links (assetlinks.json + Digital Asset Links), custom URL schemes fallback, deferred deep links, attribution providers (Branch, AppsFlyer, Adjust, Firebase Dynamic Links — EOL Aug 25 2025). Routes web URLs into app screens, handles install-first-then-deep-link, decides SDK vs DIY. Writes `docs/design/deep-link-strategy-<project>.md`. Reads `/project-classify`. Use when user says "deep link", "universal link", "app link", "Branch link", "AppsFlyer", "deferred deep link", "OneLink", "open app from email", "share link to screen", "/deep-link-strategy", or when shipping referral / share / email-link / marketing-campaign features.
output_size:
  XS: skip
  S: 1h
  M: 1h
  L: 2h
  XL: 3h
---

# /deep-link-strategy — Mobile deep link strategy

## Why you'd care

The referral campaign goes live and every share link opens the App Store landing page instead of the friend's invite — installs happen, but the contextual handoff dies on first launch and the referral attribution shows zero. Firebase Dynamic Links being EOL August 2025 means anyone who built on it is on a hard migration clock; getting Universal Links + App Links + a deferred-deep-link strategy correct on day one is what makes the difference between "share grows like crazy" and "share grows the App Store search rank, nothing else."

Invoke as `/deep-link-strategy`. Make a URL open the right screen in your app on iOS + Android, install + open if app missing, attribute the source. Run before any share / referral / email-campaign feature.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP
2. Read `docs/design/push-notification-design-<project>.md` — push payloads route via deep links too.
3. Read `docs/release/app-store-review-prep-<project>.md` — AASA + assetlinks are reviewer-visible.

## Inputs
- Domain(s): `https://app.example.com`, `https://example.com`
- Platforms: iOS, Android, web fallback.
- Use cases: share link, email CTA, push tap, paid ad attribution, referral, password reset.
- Existing attribution SDK if any.

## Process
1. **Pick link type per use case**:
   | Use case | Link type |
   |---|---|
   | Share / email CTA / push tap | Universal Link (iOS) + App Link (Android) — recommended |
   | Paid ad attribution / install referral | Attribution SDK (Branch / AppsFlyer / Adjust) |
   | OAuth callback only | Custom scheme `myapp://` is fine |
   | Cross-channel referral with reward | Attribution SDK |
2. **Decide SDK vs DIY**:
   - **DIY** (AASA + assetlinks only): cheaper, no third-party SDK, you own data. Loses: deferred deep linking, install attribution, fingerprint match.
   - **Attribution SDK**: deferred deep link out-of-box, install attribution, fraud detection. Cost: $0–$0.05 per install + SDK weight + privacy review.
   - **Firebase Dynamic Links**: **EOL Aug 25, 2025** — do NOT pick. Migrate off.
3. **iOS Universal Link setup**:
   - Host `apple-app-site-association` at `https://<domain>/.well-known/apple-app-site-association`
   - Content-type `application/json`, NO `.json` extension, served over HTTPS, no redirects, signed-cert (not self-signed)
   - `applinks.details[].appIDs = ["TEAMID.bundle.id"]`
   - `applinks.details[].components` paths array (replaces deprecated `paths`)
   - In Xcode: enable `Associated Domains` capability + entry `applinks:app.example.com`
   - Apple CDN caches AASA — changes can take 24 h; force refresh by bumping app version
   - Handle in `SceneDelegate.scene(_:continue:)` → `NSUserActivity.webpageURL`
4. **Android App Link setup**:
   - Host `assetlinks.json` at `https://<domain>/.well-known/assetlinks.json`
   - Content-type `application/json`, HTTPS, public
   - Include SHA-256 fingerprint of every signing key (debug, upload, Play App Signing)
   - In manifest: `<intent-filter android:autoVerify="true">` with `<data android:scheme="https" android:host="app.example.com" />`
   - Test: `adb shell pm verify-app-links --re-verify <package>` then `... get-app-links <package>`
   - **Play App Signing**: must include fingerprint from Play Console → Setup → App Integrity → App signing key certificate, NOT just your upload key
5. **Custom-scheme fallback**:
   - Keep `myapp://` for OAuth callbacks, intra-app navigation tests, dev tools
   - **Never** use as primary share link — no install-then-deep-link, no preview, browser-blocked
   - On Android: register intent-filter with `android:scheme="myapp"`; on iOS: `CFBundleURLTypes`
6. **Deferred deep linking**:
   - User clicks link → no app → App Store / Play install → first open should still land on the right screen
   - DIY: ~impossible reliably without fingerprint or paste-on-clipboard hacks (clipboard privacy-prompts on iOS 14+)
   - SDK route: Branch / AppsFlyer use IP+UA fingerprint match within ~2 h install window
   - Privacy: ATT-prompted IDFA improves match rate iOS, off by default
7. **Routing taxonomy**:
   - URL pattern → route → screen mapping table
   - Keep parsing in ONE module, not scattered
   - Strip and validate params; never `eval` or pass raw
   - Auth-required routes: capture URL, complete sign-in, then resume
8. **Web fallback**:
   - Same URL on desktop / mobile-web without app installed → render web view of content
   - Add smart App Banner on iOS (`<meta name="apple-itunes-app">`)
   - Android: Chrome shows Google Play instant install banner if App Link verified
9. **Testing protocol**:
   - AASA validator: <https://branch.io/resources/aasa-validator/>
   - assetlinks tester: `https://digitalassetlinks.googleapis.com/v1/statements:list?...`
   - Real-device test: paste link in Messages / Notes / WhatsApp → tap → app should open
   - Long-press preview test: shows app context (not just URL)
10. **Privacy / compliance**:
    - AppsFlyer / Branch / Adjust SDKs declare data collection in Privacy Manifest (iOS) + Data Safety (Android)
    - Required Reason API codes for `UserDefaults` if SDK uses it
    - ATT prompt required if SDK uses IDFA for cross-app tracking

## Output
Write `docs/design/deep-link-strategy-<project>.md`:

```markdown
# Deep Link Strategy — <project>
**Date:** <YYYY-MM-DD>

## Decision
- Primary domain: `https://app.example.com`
- iOS: Universal Links (AASA)
- Android: App Links (assetlinks.json) with `autoVerify=true`
- Attribution: **Branch** (free up to 10k MAU, $0.05/install over)
- Deferred deep link: via Branch
- Custom scheme: `exampleapp://` retained for OAuth callbacks only
- Firebase Dynamic Links: NOT used (EOL 2025-08-25)

## Route table
| URL pattern | Screen | Auth required | Params |
|---|---|---|---|
| `/` | Home | no | — |
| `/p/:postId` | PostDetail | no | postId (uuid) |
| `/u/:username` | Profile | no | username (alnum, 3-30) |
| `/r/:code` | Referral landing → signup | no | code (alnum, 8) |
| `/order/:orderId` | OrderDetail | yes | orderId (uuid) |
| `/settings/notifications` | NotifSettings | yes | — |
| `/checkout/success` | OrderSuccess | yes | session_id |

## AASA contents
```json
{
  "applinks": {
    "details": [{
      "appIDs": ["A1B2C3D4E5.com.example.app"],
      "components": [
        { "/": "/p/*", "comment": "post detail" },
        { "/": "/u/*", "comment": "profile" },
        { "/": "/r/*", "comment": "referral" },
        { "/": "/order/*", "comment": "order" },
        { "/": "/settings/*", "comment": "settings" }
      ]
    }]
  }
}
```

## assetlinks.json contents
```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.example.app",
    "sha256_cert_fingerprints": [
      "<Play App Signing SHA-256>",
      "<Upload key SHA-256>",
      "<Debug key SHA-256 — only in non-prod assetlinks>"
    ]
  }
}]
```

## Hosting
- Files served from CDN with `Cache-Control: public, max-age=3600`
- HTTPS only, no redirect, content-type `application/json`
- Both files version-controlled in `web/public/.well-known/`
- CI test: HEAD request returns 200 + correct content-type on every deploy

## Handler code map
| Platform | Entry point | Module |
|---|---|---|
| iOS (UIKit) | `application(_:continue:restorationHandler:)` | `AppDelegate+DeepLink.swift` |
| iOS (Scene) | `scene(_:continue:)` | `SceneDelegate+DeepLink.swift` |
| iOS (SwiftUI) | `.onContinueUserActivity(NSUserActivityTypeBrowsingWeb)` | `App.swift` |
| Android | `Intent.ACTION_VIEW` → MainActivity | `DeepLinkRouter.kt` |
| RN | `Linking.addEventListener('url', ...)` + `getInitialURL()` | `navigation/linking.ts` |
| Flutter | `app_links` package | `lib/router/deep_link.dart` |

## Branch SDK config
- iOS: `Branch.useAPIKey("<live-key>")` in didFinishLaunching
- Android: `Branch.getAutoInstance(this)` in Application.onCreate
- Test key for staging, live key for prod
- Privacy Manifest entry for Branch's `UserDefaults` access (Required Reason `CA92.1`)
- ATT NOT requested (Branch can operate without IDFA via fingerprint)

## Deferred deep link flow
1. User taps `https://app.example.com/r/SARAH42` on phone without app
2. iOS: redirected to App Store / Android: Play Store
3. User installs + opens
4. Branch SDK matches install to click via IP/UA fingerprint (within 2h)
5. SDK fires `branch:link` event → router parses → opens referral landing with `code=SARAH42`
6. Fallback: if no match, land on Home → show "Have a code?" prompt

## Auth-gated route flow
1. Link `/order/abc-123` arrives, user not signed in
2. Capture URL into `pendingDeepLink` (in-memory + AsyncStorage)
3. Show sign-in screen
4. On sign-in success, consume `pendingDeepLink` → navigate
5. Clear `pendingDeepLink` to avoid replay on next launch

## Testing checklist
- [ ] AASA validates at branch.io validator
- [ ] assetlinks validates via Google Digital Asset Links API
- [ ] Real-device test from Messages app (NOT Safari — Safari opens app from anywhere)
- [ ] Real-device test from Gmail, WhatsApp
- [ ] Long-press preview shows app context not URL
- [ ] Link works on phone WITHOUT app installed (deferred path)
- [ ] Link works on phone WITH app installed
- [ ] Auth-required link signs in then resumes
- [ ] Web fallback renders content on desktop
- [ ] All routes have analytics event `deep_link.opened` with source

## Observability
| Event | Properties |
|---|---|
| `deep_link.opened` | url, source (universal/applink/scheme/branch), referrer |
| `deep_link.route_matched` | route_name, route_params (sanitized) |
| `deep_link.no_match` | url (sanitized), fallback_taken |
| `deep_link.deferred_match` | install_time_to_match_ms, source |
| `deep_link.auth_gated.resumed` | route_name, signin_duration_ms |

## Cost
| Item | Cost |
|---|--:|
| Domain HTTPS + CDN (existing) | $0 |
| Branch (free tier, ≤10k MAU) | $0 |
| Branch growth tier | starts $300/mo |
| Engineering time setup | 2 days |

## Privacy / store disclosure
- iOS Privacy Manifest: declare Branch SDK in `NSPrivacyAccessedAPITypes` (Required Reason `CA92.1`)
- iOS Privacy Nutrition: Branch contributes `Identifiers — Device ID` linked to user, used for App Functionality + Analytics
- Android Data Safety: Branch contributes `App activity > Other actions` collected + shared with third party

## Risk if skip
- Without Universal Links: tapping share link in Messages opens Safari instead of app → user friction, broken share UX
- Without `autoVerify` Android App Links: chooser dialog "Open with..." every time → user picks browser, never gets to app
- Without deferred deep linking: referral campaigns lose 60-80% of installs because new users land on Home instead of the offer screen
- With Firebase Dynamic Links post-2025-08: links return 404 — campaigns silently break
- Without route allowlist: deep link injection can route to internal/admin screens
- Without auth-gating flow: unauthenticated users hit error screens, churn

## Verification
- AASA + assetlinks hosted, validated by external tool
- Route table covers every share-able screen
- One central parser module
- Auth-gated capture-and-resume flow implemented
- Deferred deep link tested on real device cold install
- Attribution provider in Privacy Manifest + Data Safety
- Observability events shipping
```

## Verification
- Domain + platform decided.
- AASA + assetlinks examples included.
- Route table with regex/validation per param.
- Auth-gated resume flow described.
- Attribution provider decision with cost.
- Privacy Manifest + Data Safety entries listed.
- Tested on cold install (deferred path).
