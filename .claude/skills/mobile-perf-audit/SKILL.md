---
name: mobile-perf-audit
description: Mobile performance audit — startup time (TTI / cold / warm / hot), frame rate (jank, GPU), scroll perf, memory (heap, leaks), battery / thermals, app binary size. Uses Xcode Instruments, Android Profiler, MetricKit, JankStats, Firebase Performance, Sentry Performance, Reaperf, Flipper, Perfetto. Writes `docs/design/mobile-perf-audit-<project>.md`. Reads `/project-classify`. Use when user says "perf audit", "app is slow", "jank", "startup slow", "memory leak", "battery drain", "app size", "TTI", "frame drops", "/mobile-perf-audit", or before any mobile production release where p95 user has mid-range Android.
output_size:
  XS: skip
  S: 1h
  M: 2h
  L: 3h
  XL: 4h
---

# /mobile-perf-audit — Mobile performance audit

## Why you'd care

App-store conversion drops sharply once cold-start crosses 2 seconds or scroll jank shows up — and users never write a ticket, they just uninstall. The audit surfaces the issues that show up in reviews as 'slow' or 'laggy' before they cost retention.

Invoke as `/mobile-perf-audit`. Catch slow startup, jank, memory leaks, and battery drain before users do. Run before first production release and again after major feature drops.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP
2. Read `docs/design/observability-<project>.md` for existing perf telemetry.
3. Verify `/app-store-review-prep` ran — app size limits + launch-time crash rules tie in.

## Inputs
- Platform: iOS, Android, both.
- Stack: native (Swift / Kotlin), React Native, Flutter, Expo, Capacitor.
- Target device floor: e.g. iPhone XS / Pixel 4a / Galaxy A13 (set p10 device — not your test device).
- Network floor: 3G / Slow 4G / WiFi.
- Current pain points: startup, scroll, list, screen X.

## Process
1. **Define perf SLOs** (per device class):
   - Cold start TTI (Time-To-Interactive): p75 < 2.5 s on mid-range, < 4 s on low-end
   - Warm start: < 1.5 s
   - First-frame: < 1 s (block visible)
   - Scroll jank (frames > 16.67ms): < 1% on 60Hz, < 1% on 90/120Hz adjusted budget
   - ANR rate (Android): < 0.47% (Play Vitals bad-behavior threshold)
   - App-not-responding hangs (iOS MetricKit): track p99 hangDuration
   - Crash-free sessions: ≥ 99.5%
   - App size (download): iOS < 200 MB cellular cap awareness, Android < 150 MB APK / 200 MB AAB ideal
   - Battery: < 4% / hour active foreground
2. **Measurement toolchain**:
   | Tool | Platform | What it catches |
   |---|---|---|
   | **Xcode Instruments — Time Profiler** | iOS | CPU hotspots, launch trace |
   | **Xcode Instruments — Allocations / Leaks** | iOS | retain cycles, growth |
   | **Xcode Instruments — Hangs** | iOS | main-thread blocks > 250ms |
   | **MetricKit (MXMetricPayload)** | iOS prod | real-user TTI, hangs, disk, battery |
   | **Android Profiler (CPU, Memory, Energy)** | Android | hotspots, heap, leaks |
   | **Perfetto / systrace** | Android | system-level trace, frame timing |
   | **JankStats (AndroidX)** | Android prod | real-user jank events |
   | **Macrobenchmark (AndroidX)** | Android CI | startup + scroll regression gate |
   | **Firebase Performance Monitoring** | both | network + custom traces |
   | **Sentry Performance** | both | distributed tracing, slow transactions |
   | **Reaperf** | RN | RN-specific bridge / JS thread |
   | **Flipper** | RN (legacy) | dev-time inspection; deprecated 2024 — prefer React Native DevTools |
   | **React Native DevTools** | RN 0.76+ | new built-in profiler |
   | **Flutter DevTools** | Flutter | timeline, CPU, memory |
   | **LeakCanary** | Android | retained objects in dev |
   | **Bloaty McBloatface** | both | binary size analyzer |
3. **Startup trace**:
   - **Cold start**: process create → first frame → TTI (first interactive component responds)
   - Instrument with `signpost` (iOS) / `androidx.tracing` (Android) at: pre-main → didFinishLaunching → root view rendered → JS bridge ready (RN) → first screen interactive
   - Common wins:
     - Defer non-critical SDK init (analytics, ads, attribution) by 2–5 s
     - Lazy-load fonts/images
     - Trim main-thread blocking from app launch — push to background queues
     - RN: enable Hermes, ditch JSC (Hermes is default 0.70+ but verify)
     - RN: enable new architecture (Fabric + TurboModules) where stable
     - Android: enable R8 full-mode, baseline profiles (`androidx.profileinstaller`)
     - iOS: enable bitcode-free LTO build flags, prewarm avoidance
4. **Scroll + frame audit**:
   - Long lists → use `FlatList` with `getItemLayout` + `keyExtractor`; or `FlashList` (Shopify) which is 5–10× faster
   - Flutter → `ListView.builder` + `itemExtent` when fixed
   - Native → `UICollectionViewDiffableDataSource` / `RecyclerView` with DiffUtil
   - Avoid shadow / blur / over-draw on scroll surfaces
   - Image: downsample to display size, use `react-native-fast-image` or Coil/Glide (Android), SDWebImage (iOS)
   - **Measure with Macrobenchmark**: `@Test ScrollJank` baseline gates regressions in CI
5. **Memory profile**:
   - Heap snapshot at: app launched idle, after 5 screen navigations, after returning to home
   - Compare retained sizes; investigate growth > 10%
   - Common leaks: closures holding `self` (Swift), inner classes (Kotlin), event-listener not removed (RN/JS), Bitmap not recycled (legacy Android)
   - iOS: `Leaks` instrument + `vmmap` for VM growth
   - Android: LeakCanary in dev + Memory Profiler heap dump
   - Watch for OOM kills via Crashlytics / Sentry / MetricKit `MXAppRunTimeMetric.cumulativeCellularUsage`
6. **Battery + thermals**:
   - Xcode Energy Log: CPU, location, network, display
   - Android: Battery Historian / Energy Profiler
   - Throttle conditions: app should not run hot in idle background
   - Common drains: location always-on, polling network instead of push, video preview not paused, sensor not unregistered
7. **App binary size**:
   - iOS: App Store Connect → App Size report (per device class)
   - Android: AAB analyzer in Android Studio; per-device APK sizes
   - Strategies:
     - Asset pruning, AVIF/HEIC for static images, on-demand resources (iOS), Play Asset Delivery (Android)
     - Strip unused locales (`bundleConfig.languageSplit`)
     - Tree-shake JS (Metro / Hermes precompile)
     - Native lib trimming, ABI splits (`armeabi-v7a`, `arm64-v8a` only)
8. **Network perf**:
   - Audit cold-launch network calls — should be ≤ 2, ≤ 100 KB
   - HTTP/2 or HTTP/3 (QUIC) for primary API
   - Image CDN with auto WebP/AVIF, adaptive sizing
   - Prefetch above-the-fold data during splash
9. **CI regression gate**:
   - Macrobenchmark + iOS XCTest perf metrics run on every PR touching critical paths
   - Fail PR if startup p75 regresses > 10% vs main
   - Track binary size delta — fail if > 1 MB unjustified

## Output
Write `docs/design/mobile-perf-audit-<project>.md`:

```markdown
# Mobile Performance Audit — <project>
**Date:** <YYYY-MM-DD>
**Auditor:** <name>
**App version audited:** 4.7.1 (build 2480)

## Device matrix
| Tier | Device | OS | RAM | When used |
|---|---|---|---|---|
| Floor | iPhone XS | iOS 16.7 | 4 GB | p10 iOS user |
| Floor | Pixel 4a | Android 13 | 6 GB | p10 Android |
| Mid | iPhone 13 | iOS 17 | 4 GB | p50 iOS |
| Mid | Samsung A54 | Android 14 | 6 GB | p50 Android |
| High | iPhone 15 Pro | iOS 18 | 8 GB | sanity |

## SLO table
| Metric | Floor target | Mid target | Current p75 | Status |
|---|---:|---:|---:|---|
| Cold start TTI | <4.0 s | <2.5 s | 3.1 s mid / 5.2 s floor | FAIL floor |
| Warm start | <2.0 s | <1.5 s | 1.4 s | PASS |
| Frame jank rate | <2% | <1% | 3.4% | FAIL |
| ANR rate | <0.47% | <0.30% | 0.61% | FAIL |
| Crash-free sessions | ≥99.0% | ≥99.5% | 99.71% | PASS |
| App download size | <200 MB | <150 MB | 178 MB | PASS |
| Battery / hr fg | <5% | <4% | 6.2% | FAIL |

## Top findings
1. **Cold-start TTI 5.2 s on floor device** — analytics SDK init blocks main thread 1.4 s. Defer.
2. **Home feed scroll jank 3.4%** — image not downsampled, full 3000×2000 JPEG decoded inline. Switch to FastImage + CDN sizing.
3. **Memory growth +18% after 5 navigations** — chat screen holds listener after unmount. Add cleanup in useEffect return.
4. **ANR rate 0.61%** — sync DB read on app-resume on UI thread. Move to coroutine.
5. **Battery 6.2%/hr foreground** — location updates fire every 1 s even when no map. Throttle to 30 s when map not visible.

## Action plan
| Pri | Action | Owner | ETA | Expected impact |
|---|---|---|---|---|
| P0 | Defer analytics SDK init 3 s post-launch | mobile-1 | wk1 | TTI -1.2 s |
| P0 | Replace `Image` with FastImage + Cloudflare auto-resize | mobile-2 | wk1 | jank -2% |
| P0 | Fix chat listener leak | mobile-2 | wk1 | mem stable |
| P1 | Move DB read to coroutine on resume | mobile-3 | wk2 | ANR -0.3% |
| P1 | Throttle location updates | mobile-3 | wk2 | batt -1.5% |
| P2 | Enable RN Hermes (already on) — add baseline profiles Android | mobile-1 | wk3 | TTI -0.3 s |
| P2 | Enable R8 full-mode | mobile-1 | wk3 | size -8 MB |

## Telemetry to add
| Event | Trigger | Properties |
|---|---|---|
| `perf.cold_start.tti` | first interactive | duration_ms, device, os |
| `perf.warm_start.tti` | foreground resume | duration_ms |
| `perf.screen.tti` | each screen visible | screen, duration_ms |
| `perf.jank.session` | session end | jank_frames_count, total_frames |
| `perf.network.cold_launch` | launch+5s | requests_count, total_bytes |

## CI gates
- Macrobenchmark `StartupBenchmark` runs on every PR; fail if p75 startup regress >10%
- iOS XCTest `measure(metrics:)` on launch + home scroll; fail >10%
- Android Studio APK analyzer in CI; fail size delta >1 MB without label `size-ok`

## Tools in use
| Tool | Cost | Where |
|---|--:|---|
| Sentry Performance | included team plan | prod RUM |
| Firebase Performance | free | prod RUM |
| MetricKit (iOS) | free | prod, weekly digest |
| JankStats (Android) | free | prod |
| Xcode Instruments | free | dev / pre-release |
| Android Profiler | free | dev / pre-release |
| LeakCanary | free | dev builds |
| Macrobenchmark | free | CI |

## Re-audit cadence
- Quarterly full pass
- Per release: regression CI gate only
- Per major framework upgrade (RN / Flutter / Expo SDK): full pass

## Risk if skip
- Play Vitals "bad behavior" threshold (ANR > 0.47%, crash > 1.09%) demotes app in store ranking; persistent violation can hide from search
- App Store reviewer rejects launch-time crashes under guideline 2.1
- p10 device users churn at 3× rate vs p50 due to perceived slowness
- Battery-drain reviews tank ratings — Play 1-star reviews mention "drain" most for fitness/social apps
- Memory leaks cause OOM kills that look like crashes — confuse triage

## Verification
- SLOs set per device class
- Each FAIL row has owner + ETA
- CI gate live before next release
- Tool budget fits stack
- Re-audit cadence on calendar
```

## Verification
- Device matrix names p10 device, not test device.
- Each SLO has current measurement.
- Top-5 findings list specific code/SDK at fault.
- Action plan has owner + ETA + expected impact.
- CI regression gate configured.
- Telemetry events ship with bundle, not later.
