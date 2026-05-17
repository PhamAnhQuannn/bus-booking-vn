---
name: ota-update
description: Over-the-air update strategy for mobile apps — CodePush (EOL Q1 2025 in original form, MS-hosted ended; OSS fork code-push-server), EAS Update (Expo), Capacitor Live Updates (Ionic Appflow), Shorebird (Flutter). Decides JS-bundle vs binary-only model, channel/release strategy, rollout %, rollback, staged-update safety, and App Store / Play Store policy compliance (4.7 / 4.5 / 1.2 Deceptive Behavior). Writes `docs/design/ota-update-<project>.md`. Reads `/project-classify`. Use when user says "OTA update", "CodePush", "EAS Update", "Capacitor live update", "Shorebird", "hot reload prod", "over the air", "/ota-update", or before shipping any React Native / Expo / Capacitor / Flutter app to production.
output_size:
  XS: skip
  S: 1h
  M: 2h
  L: 4h
  XL: 6h
---

# /ota-update — Over-the-air update strategy

## Why you'd care

Without an OTA strategy, urgent bug fixes wait 1–7 days for App Review and the user has the broken version the whole time. The strategy picks the JS-bundle vs binary model so the hotfix path exists when you need it.

Invoke as `/ota-update`. Decide if + how to ship app updates without re-submitting to the stores. Run before first production release and again before any major framework upgrade.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP
2. Read `docs/release/app-store-review-<project>.md` (App Review constraints govern OTA scope).
3. Read `docs/design/feature-flag-<project>.md` if present (often the right answer instead of OTA).

## Inputs
- Mobile framework: React Native (bare), Expo Managed, Expo Bare, Capacitor, Cordova, Flutter, native iOS, native Android.
- App size + JS-bundle size (RN/Expo).
- Rollout audience (consumer / enterprise / kiosk / regulated).
- Target stores: App Store, Play, sideload, MDM.
- Existing CI/CD: GitHub Actions, Bitrise, EAS Build, App Center.

## Process
1. **Decide if OTA is the right hammer**:
   - Yes for: bug fixes in JS/Dart, copy/string changes, feature-flag remote payloads, A/B test variants, broken-button hotfixes
   - **No** for: native module updates, permission changes, new entitlements, RN/Flutter engine upgrades, new app icon, anything visible in App Store metadata
   - Feature flag → first; OTA → second; binary release → last
2. **App Store policy bounds**:
   - Apple guideline 3.3.2 (legacy) was repealed; OTA of JS bundle is allowed under guideline 4.7 for "HTML5 mini-apps" patterns and broadly tolerated for RN/Expo
   - **Hard rule**: OTA must not change the app's core purpose, content rating, or add features absent at review (1.2 Deceptive, 2.3.1)
   - Play policy: "Deceptive Behavior" / "Device and Network Abuse" — same intent; updates that materially change behavior require resubmission
   - Generative-AI features added via OTA must still meet 5.1.7 / Play GenAI policy as if reviewed
3. **Pick a provider**:
   | Provider | Stack | Status (2026) | Cost | Notes |
   |---|---|---|---|---|
   | **EAS Update** | Expo / RN | active, recommended | free tier 1k MAU, $99/mo growth, usage above | first-party; pairs with EAS Build |
   | **code-push-server (OSS)** | RN | community fork after Microsoft App Center retired CodePush 2025-03 | self-hosted | Microsoft App Center fully retired 2025; OSS fork required |
   | **Capacitor Live Updates** | Ionic / Capacitor | active | $499/mo+ Ionic Appflow tier | enterprise-priced |
   | **Shorebird** | Flutter | active, GA 2024 | free OSS / $20/mo / enterprise | code-push for Dart AOT — non-trivial |
   | **Expo Native Update + Custom CDN** | RN bare | DIY | infra-only | full control, more work |
   | **Firebase Remote Config** | any | active | free | NOT a code-push; config-only |
4. **Channel + branch model**:
   - Channels: `production`, `staging`, `preview`, `dev`
   - Branch → channel mapping in EAS Update (`eas update --branch production`)
   - Runtime version pins JS bundle to a compatible native binary — bump on every native change
5. **Rollout strategy**:
   - Phased: 1% → 5% → 25% → 100% over 24–72h
   - EAS Update supports rollouts via `eas channel:rollout`
   - CodePush uses `--rollout` percentage
   - Monitor crash-free rate + key funnel metrics during ramp
6. **Rollback model**:
   - "Republish-previous" pattern: re-promote the prior bundle as latest
   - Never delete the bundle — clients on it would break
   - Per-channel rollback < 2 min from kill decision
   - Worst-case: emergency native build IF native crash (OTA can't help when bundle won't even start)
7. **Safety: avoiding bricked installs**:
   - **Compatibility check**: every JS bundle declares runtimeVersion that matches a deployed native binary
   - **Atomic apply**: download → verify signature → swap on next cold start (NOT mid-session)
   - **Fallback**: on crash within N seconds of new bundle apply, automatically revert to previous bundle (Expo Updates has built-in rollback-on-error)
   - **Signature**: sign bundles with a key not in the binary (CDN compromise alone shouldn't push code)
   - **Pin manifest URL** with cert pinning or signature verification — otherwise rogue WiFi can MITM your hot-update
8. **Update timing UX**:
   - **On launch, check + apply silently** (most common; user sees no delay if download < threshold)
   - **On launch, blocking download** for critical fix — show progress, never block > 10s without skip option
   - **Background, apply next launch** — safest; default for Expo
   - Avoid mid-session updates — state will be lost or corrupted
9. **Observability**:
   - Track `ota.bundle.applied`, `ota.bundle.fail`, `ota.bundle.rollback` events with bundle ID
   - Crash-free rate gated per bundle ID
   - Hold rollout if Sentry shows new error class within first 1% slice

## Output
Write `docs/design/ota-update-<project>.md`:

```markdown
# OTA Update Strategy — <project>
**Date:** <YYYY-MM-DD>

## Decision
- Framework: React Native 0.74 (bare workflow)
- Provider: **EAS Update** (Expo)
- Rationale: first-party with EAS Build, free tier sufficient (<10k MAU forecast), CodePush App Center retired
- Native build cadence: every 6–8 weeks via EAS Build → App Store / Play
- OTA cadence: bug-fix as needed (<48h), copy/string updates weekly batches

## Scope policy
| Change type | Path |
|---|---|
| JS bundle bug fix | OTA — same day |
| Copy / string change | OTA — batched weekly |
| Asset (image, font) | OTA — same as bundle |
| New JS-only feature behind flag | OTA + flag default off |
| New native module / permission | Binary release |
| New app icon / launch screen | Binary release |
| Privacy Manifest update | Binary release |
| Targeting new SDK level | Binary release |
| App content rating change | Binary release |

## Channels
| Channel | Audience | Source branch | Auto-rollout |
|---|---|---|---|
| `dev` | engineers (Expo Go) | feature branches | continuous |
| `preview` | internal TestFlight / Play Internal | `main` post-merge | 100% |
| `staging` | TestFlight External (100) | release branches | 100% |
| `production` | App Store / Play production | tagged releases | phased |

## runtimeVersion policy
- Use `runtimeVersion: { policy: 'fingerprint' }` (EAS) — hash of native deps
- Every native change auto-bumps runtimeVersion; old bundles never apply to new binaries
- Old binaries keep receiving bundles for their runtimeVersion until app-store-retired

## Rollout playbook (production)
| Hour | % | Watch |
|---|--:|---|
| 0 | 1 | Sentry crash-free, P1 funnels |
| +2 | 5 | Sentry, ANR rate, conversion |
| +6 | 25 | Sentry, full funnel dashboard |
| +24 | 100 | full visibility |
- Halt criteria: crash-free <99.0%, ANR >0.5%, conversion drop >5%
- Hold command: `eas channel:rollout --branch production --action pause`

## Rollback procedure
1. Identify last-known-good bundle ID from `eas update:list --branch production`
2. `eas update:republish --branch production --group <previous-group-id>`
3. Verify rollout via `eas update:view`
4. Notify on-call + post in #ops
5. Open post-mortem within 24h: `docs/ops/postmortem/ota-rollback-YYYYMMDD.md`

## Bundle signing
- Signing key generated in EAS Secrets, never exported
- `expo.updates.codeSigningCertificate` configured in app.json
- Verification happens client-side before bundle is applied
- Key rotation: annual; published as backup before primary rotation

## Failure recovery in client
- `expo-updates` configured with `fallbackToCacheTimeout: 0` (load latest if reachable, otherwise embedded)
- Auto-rollback on crash via `Updates.fetchUpdateAsync` + `Updates.reloadAsync` only if `checkAutomatically: ON_LOAD` and integrity passes
- Crash within 5 s of new bundle apply → mark bundle "bad" in AsyncStorage, never re-apply

## App Store / Play policy bounds (self-imposed)
- Never use OTA to: add a new tracker, add a paywall flow not reviewed, add a new permission prompt, ship a feature category absent at review
- Document each OTA's scope in release notes (`docs/release-notes/`)
- Quarterly review of all OTA-shipped changes for cumulative-drift from reviewed app

## Observability
| Event | Properties |
|---|---|
| `ota.check` | currentBundleId, channel, network |
| `ota.download.start` | targetBundleId, sizeBytes |
| `ota.download.complete` | targetBundleId, durationMs |
| `ota.apply.success` | bundleId, runtimeVersion |
| `ota.apply.fail` | bundleId, reason |
| `ota.rollback.auto` | fromBundleId, toBundleId, reason |

## Cost
| Item | Cost |
|---|--:|
| EAS Update free tier | $0 / 1k MAU |
| EAS Update Production tier | $99/mo (10k MAU) |
| EAS Build (worker-minutes) | $99/mo Production |
| Sentry React Native | ~$26/mo team plan |
| Total (under 10k MAU) | ~$224/mo |

## Cross-platform parity
| Concern | iOS | Android |
|---|---|---|
| OTA permitted | yes (since policy update post-2019) | yes |
| Bundle size cap | App must run within iOS limits; bundle <10 MB ideal | same |
| Background download | allowed via Updates API | allowed |
| Cellular vs WiFi | configurable | configurable |

## Risk if skip / misuse
- Updates that change reviewed behavior risk rejection / app removal
- Without runtimeVersion fingerprinting → JS bundle calls a removed native method → universal crash
- Without signing → CDN compromise = full RCE on every install
- Without phased rollout → bad bundle reaches 100% before signal arrives → mass-incident
- Without auto-rollback → users stuck on bad bundle until they manually update via store
- CodePush legacy users who didn't migrate by 2025-03 lost ability to push updates

## Verification
- runtimeVersion policy chosen and documented
- Channels mapped to branches
- Phased rollout hours + halt criteria set
- Rollback command tested in staging
- Bundle signing enabled and key rotated annually
- Auto-rollback on crash configured client-side
- Policy-bound scope explicitly written
```

## Verification
- Provider chosen with cost line item.
- runtimeVersion / fingerprint policy described.
- Channel-to-branch map present.
- Phased rollout has halt criteria.
- Rollback command documented.
- Signing key story explicit.
- Auto-rollback on crash configured.
- App-store policy scope bounds called out.
