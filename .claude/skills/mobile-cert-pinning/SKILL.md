---
name: mobile-cert-pinning
description: Certificate / public-key pinning design for mobile clients to defend against MITM via rogue CAs, sideloaded user trust stores, and Frida/Charles interception. Covers pin selection (leaf vs intermediate vs SPKI), rotation strategy, kill-switch, OkHttp/URLSession/TrustKit/Capacitor implementation, and bypass tradeoffs. Writes `docs/design/mobile-cert-pinning-<project>.md`. Reads `/project-classify` to skip XS/S unless PII or payments present. Use when user says "cert pinning", "certificate pinning", "SSL pinning", "TrustKit", "MITM", "Frida bypass", "OWASP MASVS", "/mobile-cert-pinning", or before shipping a mobile app that handles auth tokens, payments, or PII.
output_size:
  XS: skip
  S: skip
  M: 1h
  L: 2h
  XL: 4h
---

# /mobile-cert-pinning — Certificate pinning design

## Why you'd care

Without cert pinning, a single rogue CA or a sideloaded user profile lets an attacker MITM the app's API and steal auth tokens — and mobile security audits will flag this on day one. Pinning is the only credible defense, but the rotation strategy matters as much as the pin.

Invoke as `/mobile-cert-pinning`. Defense-in-depth control. Activate once the app handles auth tokens, payments, health data, or other PII. Skip below M unless threat-model says otherwise.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS, S without PII → SKIP
2. Read `docs/design/threat-model-<project>.md`.
3. Confirm the API surface is owned (you control cert issuance) — third-party APIs (Stripe, Firebase, S3) usually should NOT be pinned (you don't own their rotation).
4. Read `docs/ops/runbooks/` for any incident runbooks that would need a kill-switch entry.

## Inputs
- API domain(s) the app talks to.
- CA used today (Let's Encrypt, DigiCert, AWS ACM, Google Trust Services).
- Cert rotation cadence (LE = 90 days; ACM auto-rotates; commercial = annual).
- Mobile stacks: native iOS (URLSession), native Android (OkHttp), React Native, Flutter, Capacitor, Cordova.
- Min OS versions targeted (NSAppTransportSecurity, Network Security Config behaviors).
- Build-channel split (Dev / Staging / Prod must pin different things).

## Process
1. **Decide pin granularity**:
   - **Leaf-cert pin** — strongest; breaks on every rotation; bad fit for LE 90-day
   - **Intermediate-cert pin** — survives leaf rotation; breaks when CA rotates intermediate (DigiCert, LE did rotate ISRG X1 → X2)
   - **SPKI pin (public key)** — survives cert renewal if same key reused; standard recommendation; OWASP MASVS-NETWORK-1
   - **CA pin** — too loose; rogue cert from same CA defeats it
2. **Pin set composition** — always pin ≥2 SPKIs: one in-use + one backup (held offline, rotated in next release). Apple ATS rules and OWASP both require backup pin.
3. **Rotation strategy** — pre-publish the next pin in the app N releases before cert switch:
   - Release N: pins = [current, backup-A]
   - Release N+1: pins = [current, backup-A, backup-B] (overlap window)
   - Cert rotation event: server switches to key-A → app keeps working via backup-A
   - Release N+2: pins = [backup-A, backup-B] (drop old current)
4. **Kill-switch / unpin**:
   - Remote config flag (Firebase Remote Config, LaunchDarkly, ConfigCat) → `network.pinningEnabled=false`
   - Reachable BEFORE any pinned request — bootstrap via a separate non-pinned host or signed config bundle
   - Risk: a kill-switch bypassable by MITM defeats the point; sign the config payload with an offline key embedded in the binary
5. **Per-stack implementation**:
   - **iOS native**: TrustKit (Datatheorem) — declarative plist; or URLSessionDelegate `urlSession(_:didReceive:completionHandler:)` + SecTrustEvaluateWithError + SPKI hash compare
   - **Android native**: OkHttp `CertificatePinner.Builder().add(host, "sha256/...")` OR Network Security Config (`res/xml/network_security_config.xml` with `<pin-set>`); NSC respects user CAs on Android <7 by default — set `<base-config cleartextTrafficPermitted="false">` and `<trust-anchors>` accordingly
   - **React Native**: `react-native-ssl-pinning` or native bridge to OkHttp/URLSession; avoid `react-native-cert-pinner` (unmaintained)
   - **Flutter**: `http_certificate_pinning` or roll own with `SecurityContext` + custom `HttpClient.badCertificateCallback`
   - **Capacitor / Cordova**: `cordova-plugin-advanced-http` with SSL pinning enabled; pure WebView fetch CANNOT be pinned reliably — proxy through native plugin
6. **What NOT to pin**:
   - Third-party SDK endpoints — Firebase, Crashlytics, Stripe, Adjust, AppsFlyer, Google Maps, OneSignal — they rotate without telling you
   - CDN-hosted static assets if CDN can change certs
7. **Bypass realism — pinning is not a silver bullet**:
   - Frida + Objection's `ios sslpinning disable` / `android sslpinning disable` defeats pinning on rooted/jailbroken devices in <5 min
   - Pair with: jailbreak/root detection (DTTJailbreakDetection, RootBeer), Play Integrity API, App Attest (iOS 14+), SafetyNet successor
   - Treat pinning as raising attacker cost, not preventing dedicated attackers
8. **Failure mode design** — what happens when pin fails:
   - Log telemetry (without leaking the bad cert chain) via a non-pinned monitoring channel
   - Show user-friendly error: "Connection security check failed. Update the app." with App Store / Play deep link
   - Never silently degrade to non-pinned — that's a security regression
9. **CI/CD wiring**:
   - Generate SPKI hashes via `openssl x509 -in cert.pem -pubkey -noout | openssl pkey -pubin -outform der | openssl dgst -sha256 -binary | base64`
   - Store backup pin hashes in repo (public info; not a secret); store backup KEYS offline (HSM, AWS KMS, paper)
   - Build-time check: fail CI if pin list has <2 SPKIs or if pin matches no cert in chain validated against staging

## Output
Write `docs/design/mobile-cert-pinning-<project>.md`:

```markdown
# Mobile Certificate Pinning Design — <project>
**Date:** <YYYY-MM-DD>

## Scope
- App domains pinned: `api.<project>.com`, `auth.<project>.com`
- App domains NOT pinned (third-party): `firebaseio.com`, `appsflyer.com`, `stripe.com`, `sentry.io`
- Stacks: iOS native (Swift), Android native (Kotlin), React Native shell

## Pin granularity
- Strategy: **SPKI (public key) pinning** — OWASP MASVS-NETWORK-1
- Pin count per host: 2 active + 1 backup (3 total)
- Backup key generation: ECDSA P-256, generated in AWS KMS, never exported

## Current pin set (api.<project>.com)
| Slot | SPKI sha256 (base64) | Source | Status | Next rotation |
|---|---|---|---|---|
| Current | `Vjs8r4z+80wjNcr1YKepWQboSIRi63WsWXhIMN+eWys=` | LE ISRG Root X1 leaf, key A | active | 2026-08 |
| Backup-A | `C5+lpZ7tcVwmwQIMcRtPbsQtWLABXhQzejna0wHFr8M=` | key B (offline) | published | swap in v1.6 |
| Backup-B | `r/mIkG3eEpVdm+u/ko/cwxzOMo1bk4TyHIlByibiA5E=` | key C (offline) | published | swap in v1.7 |

## Rotation timeline
| Release | Active pins | Server key |
|---|---|---|
| v1.4 (current) | A, B | A |
| v1.5 | A, B, C | A |
| v1.6 | B, C | **switch to B** |
| v1.7 | B, C, D | B |
| v1.8 | C, D | **switch to C** |
- Rule: never rotate server key until ≥80% of installs are on a release that pins the next key.
- Track via Firebase Remote Config min-version + analytics.

## Kill-switch
- Remote flag: `mobile.cert_pinning.enabled` (default true) — fetched at app launch from non-pinned host `config.<project>.com`
- Config payload signed with Ed25519; public key compiled into the binary
- Kill window: ≤30 min from flag flip to next app foreground
- Audit log entry whenever flag toggles
- Incident runbook: `docs/ops/runbooks/cert-pinning-incident.md`

## Per-stack implementation
### iOS (TrustKit)
```swift
TrustKit.initSharedInstance(withConfiguration: [
  kTSKSwizzleNetworkDelegates: true,
  kTSKPinnedDomains: [
    "api.<project>.com": [
      kTSKEnforcePinning: true,
      kTSKIncludeSubdomains: false,
      kTSKPublicKeyHashes: [
        "Vjs8r4z+80wjNcr1YKepWQboSIRi63WsWXhIMN+eWys=",
        "C5+lpZ7tcVwmwQIMcRtPbsQtWLABXhQzejna0wHFr8M=",
      ],
      kTSKReportUris: ["https://reports.<project>.com/pin"],
    ]
  ]
])
```

### Android (OkHttp + NSC)
```kotlin
val pinner = CertificatePinner.Builder()
  .add("api.<project>.com",
       "sha256/Vjs8r4z+80wjNcr1YKepWQboSIRi63WsWXhIMN+eWys=",
       "sha256/C5+lpZ7tcVwmwQIMcRtPbsQtWLABXhQzejna0wHFr8M=")
  .build()
val client = OkHttpClient.Builder().certificatePinner(pinner).build()
```
Plus `res/xml/network_security_config.xml`:
```xml
<network-security-config>
  <domain-config>
    <domain includeSubdomains="false">api.<project>.com</domain>
    <pin-set expiration="2026-12-31">
      <pin digest="SHA-256">Vjs8r4z+80wjNcr1YKepWQboSIRi63WsWXhIMN+eWys=</pin>
      <pin digest="SHA-256">C5+lpZ7tcVwmwQIMcRtPbsQtWLABXhQzejna0wHFr8M=</pin>
    </pin-set>
  </domain-config>
  <base-config cleartextTrafficPermitted="false">
    <trust-anchors><certificates src="system"/></trust-anchors>
  </base-config>
</network-security-config>
```

### React Native shell
Calls bridge through native OkHttp / URLSession; no JS-layer fetch hits the pinned hosts (audited via Charles disabled-on-prod run).

## What is NOT pinned (with rationale)
| Host | Reason |
|---|---|
| `firebaseio.com` | Google rotates frequently |
| `*.stripe.com` | Stripe doc explicitly says don't pin |
| `*.sentry.io` | hosted SaaS rotates |
| `*.appsflyer.com` | attribution SDK |
| `cdn.<project>.com` | served from CloudFront, certs rotate via ACM |

## Defense-in-depth siblings
- Jailbreak/root detection: DTTJailbreakDetection (iOS), RootBeer (Android)
- App Attest (iOS) attestation on auth + payment endpoints
- Play Integrity API attestation on Android
- Server-side: rate-limit + anomaly detect on auth endpoints
- Token binding: refresh tokens bound to device-attested key

## Build-time guardrails
- CI step `scripts/verify-pins.sh` — fetches staging cert, computes SPKI, fails build if not in pin list
- pin set linted: must contain ≥2 SPKIs
- Lint check: no `NSAllowsArbitraryLoads = true`; no `cleartextTrafficPermitted = true` on prod build types

## Telemetry
- Pin failure event: `mobile.cert_pin.fail` (no cert chain content, just SPKI hash that was seen, app version, OS, device class)
- Alert if pin-fail rate >0.5% of sessions over 1h (TrustKit + Datadog)
- Auto-create incident if >5% over 15 min (cert mis-rotation likely)

## Failure UX
- Title: "Connection Security Issue"
- Body: "We couldn't verify a secure connection. Make sure you're on the latest version, and try again."
- Buttons: Open App Store / Open Play Store, Retry
- Never auto-fallback to unpinned — user-initiated retry only

## Incident runbook (cert mis-rotation)
1. Confirm telemetry spike — `mobile.cert_pin.fail` >5% in 15 min
2. Verify server cert chain (`openssl s_client -connect api.<project>.com:443 -servername api.<project>.com`)
3. If server is wrong: rollback cert
4. If app pins are wrong: flip kill-switch `mobile.cert_pinning.enabled=false`
5. Sign + publish config bundle update
6. Ship hotfix release with corrected pins (EAS Update / CodePush IF policy allows; native binary rev otherwise)
7. Post-mortem: docs/ops/postmortem/cert-pin-YYYYMMDD.md

## Cost + effort
| Item | Cost | Time |
|---|--:|---|
| TrustKit integration | $0 (Apache-2 OSS) | 0.5 day |
| OkHttp pinner | $0 | 0.5 day |
| Backup key generation in KMS | $1/mo per key | 0.5 day |
| CI verify-pins script | dev time | 0.5 day |
| Kill-switch wiring (Remote Config + Ed25519) | dev time | 1 day |
| Annual rotation drill | dev time | 0.5 day/yr |

## Risk if skip
- Public WiFi MITM with rogue Burp/Charles cert can capture auth tokens
- Compromised corporate MDM root CA → silent traffic interception
- Some Android <7 devices trust user-installed CAs by default → trivial MITM
- Audit findings (SOC 2, PCI, MASVS) flag missing pinning on PII/payment apps
- Without backup pin, a CA outage (e.g., DigiCert 2024 revocation event) bricks all installs

## Verification
- Pin set has ≥2 SPKIs per host
- Backup keys generated and stored offline (KMS / paper)
- Rotation calendar entries created in shared calendar through next 2 cert lifecycles
- Kill-switch wired and reachable via a NON-pinned host
- CI build fails if pins don't match staging
- Telemetry pipeline live and alert threshold set
```

## Verification
- Pin granularity decided (SPKI vs leaf vs intermediate) and rationale logged.
- Backup pin published in current release before any rotation.
- Kill-switch reachable via non-pinned bootstrap and payload signed.
- Per-stack code snippets present for every mobile stack in use.
- "What NOT to pin" list explicitly enumerated (third-party SDKs).
- Build-time pin verification script wired to CI.
- Incident runbook referenced.
