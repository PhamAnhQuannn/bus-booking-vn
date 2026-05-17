---
name: mobile-crash-symbolication
description: Mobile crash symbolication + reporting pipeline — dSYM upload (iOS), ProGuard / R8 mapping upload (Android), JS source-map upload (RN / Expo), NDK symbol upload, Sentry / Firebase Crashlytics / Bugsnag / Embrace integration, MetricKit (iOS) hangs + diagnostics, ANR detection (Android), crash-free SLO. Writes `docs/design/mobile-crash-symbolication-<project>.md`. Reads `/project-classify`. Use when user says "crash report", "symbolicate", "dSYM", "ProGuard mapping", "source map", "Sentry mobile", "Crashlytics", "ANR", "MetricKit", "/mobile-crash-symbolication", or before first mobile production release.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 1h
  XL: 2h
---

# /mobile-crash-symbolication — Mobile crash symbolication

## Why you'd care

Crashes without symbolicated stacks are useless — you see the bug count climbing and can't tell which release shipped it. The pipeline turns the noise into a fix list.

Invoke as `/mobile-crash-symbolication`. Make stack traces readable. Set crash-free SLO. Wire upload pipeline into CI so no release ships without symbols. Run before first production release.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP
2. Read `docs/design/observability-<project>.md` for current error pipeline.
3. Read `docs/design/mobile-perf-audit-<project>.md` — ANR / hang SLOs live there too.

## Inputs
- Platform: iOS, Android, both.
- Stack: native (Swift / Kotlin), React Native, Flutter, Expo, Capacitor, Unity.
- CI: GitHub Actions, Bitrise, Xcode Cloud, EAS Build, Fastlane, Codemagic.
- Existing error tool (if any).

## Process
1. **Pick provider**:
   | Provider | Stack | Cost (2026) | Notes |
   |---|---|---|---|
   | **Sentry** | all (RN, Flutter, native, Unity) | free 5k events/mo, team $26/mo, business $80/mo | best DX, source maps + dSYM + ProGuard in one |
   | **Firebase Crashlytics** | native + RN + Flutter | free | tied to Google; slower symbolication; weaker grouping |
   | **Bugsnag** | all | free 7.5k events, $25/mo+ | strong release tracking |
   | **Embrace** | all, mobile-specific | usage-based, talk to sales | rich session replay |
   | **Instabug** | native + RN | $249/mo+ | bug-report attached |
   | **App Store Connect → Crashes organizer** | iOS only | free | always-on, but slow + iOS-only |
   | **Play Console → Android Vitals** | Android only | free | always-on; auto-symbolicates if mapping uploaded |
   - Default pick: **Sentry**. Use Crashlytics if already deep in Firebase.
   - **Always** also enable Apple's Crashes organizer + Play Vitals — they catch what SDK misses (pre-init crashes).
2. **iOS symbolication**:
   - Build with `DEBUG_INFORMATION_FORMAT = dwarf-with-dsym` for Release (Xcode default)
   - dSYMs generated alongside `.app` → uploaded to App Store Connect with binary
   - **Bitcode is deprecated** (Xcode 14+) — no need to download dSYMs from App Store Connect post-build; you have them locally
   - Upload dSYMs to Sentry: `sentry-cli debug-files upload --include-sources <path>`
   - For Hermes (RN 0.70+): upload Hermes source maps too
   - For Swift compiled with `-Onone` interop: ensure dSYM contains Swift type info (default since Xcode 12)
3. **Android symbolication**:
   - R8 (default, replaces ProGuard) emits `mapping.txt` per variant in `build/outputs/mapping/release/`
   - Native crashes (NDK / C++): emit `*.so` symbols in `build/intermediates/merged_native_libs/release/out/lib/<abi>/`
   - Upload mapping to:
     - Play Console: automatic if signed with Play App Signing (recommended)
     - Sentry: `sentry-cli upload-proguard --android-manifest app/build/intermediates/merged_manifests/release/AndroidManifest.xml app/build/outputs/mapping/release/mapping.txt`
     - Crashlytics: Gradle plugin auto-uploads if `firebaseCrashlytics { mappingFileUploadEnabled true }`
   - Upload NDK symbols to Sentry: `sentry-cli debug-files upload --include-sources --type il2cpp ./build/.../out/lib`
4. **React Native source maps**:
   - Generate during Release build (Metro): both platforms via `--sourcemap-output`
   - iOS: `react-native bundle --sourcemap-output ios/sourcemaps/main.jsbundle.map`
   - Android: similar, into `android/app/build/generated/sourcemaps/react/release/`
   - Hermes-compiled: must `compose-source-maps.js` to combine JS map + Hermes bytecode map
   - Upload to Sentry via `@sentry/react-native` plugin which wraps `sentry-cli` automatically
5. **Flutter symbol upload**:
   - `flutter build apk --obfuscate --split-debug-info=./symbols`
   - Upload `./symbols/*.symbols` to Sentry via `sentry-dart-plugin`
   - iOS: same `--split-debug-info` outputs Dart symbols alongside iOS dSYM
6. **CI integration**:
   - Symbol upload runs after build, before artifact archive
   - Fail build if upload fails — never ship unsymbolicated release
   - Store mapping.txt + dSYM as build artifacts for at least 1 year (regulatory retention varies)
   - Tag uploaded symbols with `release: <bundle-id>@<version>+<build>` matching SDK release init
7. **MetricKit + ANR**:
   - iOS: opt-in to `MXMetricManager` → receive daily diagnostic payloads (`MXCrashDiagnostic`, `MXHangDiagnostic`)
   - Forward to Sentry / Crashlytics for unified view
   - Android: `ApplicationExitInfo` API (API 30+) reports last-exit reason; forward `REASON_ANR`, `REASON_CRASH_NATIVE`, `REASON_LOW_MEMORY`
   - Play Vitals "ANR rate" threshold 0.47% — exceed → store ranking penalty
8. **Grouping + dedup**:
   - Sentry: tune `fingerprint` for shared error wrappers (e.g. all `NetworkError` collapse to one issue)
   - Use `before_send` to drop noisy / known-benign errors (cancelled tasks, expected 401)
   - Alert only on **new issue introduced this release** + **regression of resolved issue**
9. **SLO + alerts**:
   - Crash-free sessions ≥ 99.5% prod
   - Crash-free users ≥ 99.0% prod
   - ANR rate ≤ 0.30% target (Play threshold 0.47% bad-behavior)
   - Alert thresholds:
     - New issue affecting > 0.5% sessions within 1 h → page on-call
     - Crash-free drop > 0.5 percentage points in 24 h → page
     - Regression of resolved issue → page
10. **PII / privacy**:
    - Scrub user email, phone, address, tokens from breadcrumbs + extra context
    - Sentry: `sendDefaultPii: false`; manually attach user-id only (no email)
    - GDPR: data-processing addendum signed with vendor
    - Privacy Manifest entry for Sentry / Crashlytics SDK access

## Output
Write `docs/design/mobile-crash-symbolication-<project>.md`:

```markdown
# Mobile Crash Symbolication & Reporting — <project>
**Date:** <YYYY-MM-DD>

## Decision
- Primary tool: **Sentry** ($26/mo team)
- Secondary: Apple Crashes organizer + Play Vitals (free, both always on)
- Stack: React Native 0.74 with Hermes
- SDK: `@sentry/react-native` 5.x
- Release tag format: `com.example.app@4.7.1+2480`

## Symbol upload pipeline
| Artifact | Platform | Tool | When | Storage retention |
|---|---|---|---|---|
| dSYM | iOS | `sentry-cli debug-files upload` via plugin | CI release build, post-archive | 12 mo build artifact |
| Hermes source map | iOS+Android | `@sentry/react-native` postbuild | CI release build | 12 mo |
| R8 mapping.txt | Android | Sentry Gradle plugin + Play upload (auto) | CI release build | 12 mo |
| NDK symbols (.so) | Android | `sentry-cli` (only if NDK used) | CI release build | 12 mo |

## CI snippet (GitHub Actions, iOS)
```yaml
- name: Build iOS
  run: xcodebuild archive ... 
- name: Upload symbols to Sentry
  env:
    SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
    SENTRY_ORG: example
    SENTRY_PROJECT: ios
  run: |
    sentry-cli releases new "com.example.app@$(./scripts/version.sh)"
    sentry-cli debug-files upload --include-sources ios/build/
    sentry-cli react-native xcode ios/build/sourcemaps/
    sentry-cli releases finalize "com.example.app@$(./scripts/version.sh)"
```

## SDK init (RN)
```ts
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  release: `com.example.app@${pkg.version}+${buildNumber}`,
  dist: buildNumber,
  environment: __DEV__ ? 'development' : 'production',
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  beforeSend: scrubPii,
});
```

## SLO + alerting
| Metric | Target | Alert threshold | Action |
|---|---:|---|---|
| Crash-free sessions | ≥99.5% | drop >0.5pp in 24h | page on-call |
| Crash-free users | ≥99.0% | drop >0.5pp in 24h | page |
| ANR rate (Android) | ≤0.30% | >0.47% sustained 6h | page; investigate top contributor |
| New issue this release | 0 critical | any new issue >0.5% sessions | page within 1h |
| Resolved-issue regression | 0 | any | page |

## PII scrub list
- email, phone, address, full_name → strip from breadcrumbs + extras
- Authorization headers → already stripped by Sentry default
- Request bodies → scrub `password`, `token`, `pin`, `ssn`, `dob`
- Console.log breadcrumbs → drop in production

## Privacy / store disclosure
- iOS Privacy Manifest: declare Sentry in `NSPrivacyAccessedAPITypes` if it uses `UserDefaults` (Required Reason `CA92.1`) or `FileTimestamp` (`C617.1`)
- Privacy Nutrition: declare `Diagnostics — Crash Data` + `Diagnostics — Performance Data`, not linked to user
- Data Safety: `Diagnostics > Crash logs` + `Diagnostics > Performance` collected, ephemeral, not shared

## Coverage gaps (and acceptance)
- Pre-init crashes (before Sentry SDK loads) → caught by Apple Crashes organizer + Play Vitals
- JS engine crashes inside Hermes → caught via native bridge (Sentry handles)
- Watchdog terminations (iOS 0x8badf00d) → MetricKit `MXHangDiagnostic`
- Low-memory kills → `ApplicationExitInfo.REASON_LOW_MEMORY` on Android; MetricKit on iOS

## Verification checklist (per release)
- [ ] dSYM uploaded for both production + dev builds
- [ ] Hermes source map combined + uploaded
- [ ] R8 mapping uploaded to Sentry + Play
- [ ] Release tag matches in SDK init + CI
- [ ] Test crash in staging → readable stack within 60 s in Sentry
- [ ] No PII in breadcrumbs (manual spot-check 10 events)
- [ ] Apple Crashes organizer shows test crash too
- [ ] Play pre-launch report run, no blocking crashes

## Cost
| Item | Cost |
|---|--:|
| Sentry team plan | $26/mo |
| Sentry Performance bundle | included |
| Apple Crashes organizer | $0 |
| Play Vitals | $0 |
| Eng time pipeline | 1 day setup + 0.5 day per release |

## Risk if skip
- Stack traces show `<redacted>` / hex addresses → can't fix bugs → ratings tank
- Play Vitals ANR >0.47% sustained → search demotion + Play Store warning to users ("This app may slow your device")
- Crash-free rate not visible per release → no signal to halt rollout → bad version reaches 100%
- Without source-map upload: RN errors show minified `a.b.c is not a function` — useless
- Without mapping upload: R8 obfuscates class names, every crash shows `a.b.c.d` 
- Without Privacy Manifest entry: App Review rejection under 5.1.1

## Verification
- Provider chosen with cost
- Upload pipeline runs in CI, build fails on upload failure
- Release tag matches across SDK + CI + symbol upload
- SLO + alert thresholds defined
- PII scrub list explicit
- Privacy Manifest + Data Safety entries listed
- Test crash verified in staging
```

## Verification
- Provider picked with explicit cost line.
- Symbol upload step in CI, blocks release on failure.
- Release tag format matches SDK init + CI upload + plugin.
- Crash-free + ANR SLO with alert thresholds.
- PII scrubbing rule list.
- Privacy Manifest + Data Safety disclosure.
- Test-crash verification step in staging.
