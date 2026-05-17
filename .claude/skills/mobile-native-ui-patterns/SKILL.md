---
name: mobile-native-ui-patterns
description: iOS HIG + Material 3 native UI pattern picks. Bottom sheets, tab bars, navigation bars, safe-area, gestures, haptics, dynamic type, dark mode, large title, swipe actions, modal presentation. Outputs `docs/design/mobile-ui-patterns.md` with per-platform pattern + cross-platform reconciliation. Use when user says "mobile UI", "iOS HIG", "Material 3", "bottom sheet", "tab bar", "safe area", "gestures", "swipe actions", "/mobile-native-ui-patterns", or before building any native or RN/Expo screen.
output_size:
  XS: skip
  S: 1h
  M: 2h
  L: 4h
  XL: 6h
---

# Mobile Native UI Patterns

## Why you'd care

Cross-platform shortcuts that ignore iOS HIG or Material 3 produce apps that feel wrong on both platforms, which trashes store ratings and conversion. The pattern picks make the app feel native where it counts.

iOS and Android users expect platform-native patterns. Web wireframes don't transfer. This skill picks the pattern per platform, reconciles cross-platform conventions for shared codebases (RN/Expo/Flutter), and locks down safe-area + dynamic type + dark mode at design time.

## When This Skill Applies

Activate when:
- User says "mobile UI", "iOS HIG", "Material 3", "bottom sheet", "tab bar", "safe area", "gestures", "swipe actions", "/mobile-native-ui-patterns"
- New mobile app (native iOS, native Android, React Native, Expo, Flutter)
- New screen on existing mobile app
- Cross-platform reconciliation: differing iOS vs Android pattern is forcing engineering choice
- Pre-launch mobile review

## Prerequisites

- Wireframe (`docs/design/wireframes/<screen>.md`).
- Nav decision (`docs/design/nav.md` — bottom tab confirmed for primary nav).
- Decision: native (Swift/Kotlin) vs RN/Expo vs Flutter (affects pattern fidelity).
- Decision: minimum OS version (iOS 16+/Android 12+ as default; older needs fallback notes).

## Steps

1. **Pick navigation chrome.** Tab bar (iOS) vs bottom navigation bar (Android M3); navigation bar (iOS) vs top app bar (Android).
2. **Decide modal presentation.** Sheet (iOS half/full) vs bottom sheet (Android M3 modal/standard); fullscreen modal vs page sheet.
3. **Define safe-area handling.** Top notch/dynamic island, bottom home indicator, side gesture areas.
4. **Gestures.** Swipe-back (iOS edge swipe), swipe-to-dismiss sheet, swipe row actions, long-press, pull-to-refresh.
5. **Haptics.** When to fire: success, warn, error, selection, impact. iOS UIImpactFeedbackGenerator / Android HapticFeedbackConstants.
6. **Dynamic Type / font scaling.** iOS Dynamic Type sizes; Android sp scaling. Test at largest accessibility size.
7. **Dark mode.** Token mapping, image asset variants, system-following vs user-toggle.
8. **Large title (iOS) / collapsing top app bar (Android).** Per-screen yes/no.
9. **Swipe actions on lists.** Leading/trailing actions, destructive confirmation.
10. **Status bar style.** Light vs dark content per screen.
11. **Cross-platform reconciliation.** For shared codebase, decide: ape-iOS-on-Android (no), ape-Android-on-iOS (no), platform-conditional (yes default), one-pattern-both (only if equivalent).
12. **Write** `docs/design/mobile-ui-patterns.md`.
13. **Auto-chain.** Per screen → `/ui-wireframe` for layout. New gesture → `/a11y-design` (alternative non-gesture path).

## Output Format — `docs/design/mobile-ui-patterns.md`

```markdown
---
last-updated: YYYY-MM-DD
status: draft | reviewed | implemented
platforms: iOS 16+, Android 12+ (Material 3)
runtime: Expo SDK 51 (React Native 0.74)
---

# Mobile UI Patterns

## Navigation Chrome

| Surface | iOS | Android |
|---------|-----|---------|
| Primary nav | Tab bar (5 items, SF Symbols) | M3 Bottom navigation bar (5 items, Material Symbols) |
| Per-screen header | Navigation bar with large title (Home, Browse) / inline title (detail) | M3 Top app bar (small for detail; large for Home) |
| Back action | iOS chevron + previous title; edge swipe back enabled | Material back arrow; system back gesture enabled |

Reconciliation (Expo/RN): use react-navigation native-stack — provides platform-native chrome out of the box. Don't restyle.

## Modal Presentation

| Use case | iOS | Android |
|----------|-----|---------|
| Picker / quick action | Sheet (`.sheet` with `.medium` detent) | M3 Modal bottom sheet |
| Multi-step flow | Page sheet (full-height card) | Full-screen dialog |
| Critical confirm | Alert (UIAlertController) | M3 Dialog |
| Image / media viewer | Full-screen modal (slide up) | Full-screen activity |

Sheet detents: prefer `.medium` then `.large` on iOS. Android M3 bottom sheet: half then full expand on drag.

## Transition Choreography

How screens and elements transition — referenced against the motion personality from `/motion-direction-spec` (`docs/design/motion.md`). Define what animates, what does NOT, and the reduced-motion fallback.

| Transition | iOS | Android | What animates | Reduced-motion fallback |
|------------|-----|---------|---------------|--------------------------|
| Push / pop (stack nav) | horizontal slide + parallax | M3 shared-axis X | incoming screen + back chevron | cross-fade only |
| Modal presentation | sheet slides up over dimmed parent | bottom sheet rises; scrim fades | sheet + scrim | instant present, scrim fades |
| Tab switch | cross-fade (no slide) | M3 shared-axis or fade-through | content area only; tab bar static | instant swap |
| Shared-element (list → detail) | matched-geometry (hero image, title) | M3 container transform | the shared element; rest cross-fades | no shared-element; plain push |
| Dismiss (swipe-down sheet) | sheet tracks finger, settles or springs back | sheet tracks finger | sheet position | no tracking; tap-to-dismiss |

- Easing + duration come from the motion personality in `motion.md` — do not invent per-screen timings (trips tell T8, no/generic motion).
- Rule: motion clarifies hierarchy and continuity; it never blocks input. Every transition completes (or is skippable) within the motion-spec budget.
- Reduced-motion (`UIAccessibility.isReduceMotionEnabled` / Android transition scale 0): fall back to cross-fade or instant — never remove the state change, only the movement.

## Safe Area

- Always wrap top + bottom in `SafeAreaView` (RN) or use `safeAreaInsets` (SwiftUI) / `WindowInsets` (Compose).
- Tab bar: bottom inset already handled by tab bar component; do not double-pad.
- Forms with sticky bottom CTA: button hugs `keyboardHeight + bottomInset`.
- Landscape: respect `safeAreaInsets.left/right` (notch on side).

## Gestures

| Gesture | Where | Action |
|---------|-------|--------|
| Edge swipe right (iOS) | every detail screen | navigate back |
| System back (Android) | every screen | navigate back |
| Swipe down on sheet | sheets/bottom sheets | dismiss |
| Pull to refresh | feed lists (Home, Bookings) | refetch |
| Swipe row leading | bookings list rows | "Mark as read" (non-destructive) |
| Swipe row trailing | bookings list rows | "Cancel" (destructive — confirm) |
| Long-press card | bookings list rows | context menu (share, copy id) |
| Pinch zoom | image viewer | zoom |

A11y: every gesture has a non-gesture alternative (kebab menu, button). Required for VoiceOver / TalkBack.

## Haptics

| Event | iOS feedback | Android feedback |
|-------|-------------|------------------|
| Tab change | `selection` (light) | `HapticFeedbackConstants.CONTEXT_CLICK` |
| Toggle on/off | `impact (light)` | `LONG_PRESS` |
| Action success (booking confirmed) | `notification (success)` | `CONFIRM` |
| Validation error | `notification (error)` | `REJECT` |
| Pull-to-refresh trigger | `impact (medium)` at threshold | `GESTURE_END` |

Respect `Settings.haptics` user preference; query via `UIImpactFeedbackGenerator` availability or `HapticFeedback` on Android. Don't fire haptics on every tap (annoyance).

## Dynamic Type / Font Scaling

- All text uses platform text styles (iOS: `.body`, `.title`, etc.; Android M3 typography scale: `bodyLarge`, `titleMedium`, etc.).
- No hardcoded `fontSize: 14`. RN: use a typography token map → resolves to platform-native style.
- Test at iOS XXXL (largest non-accessibility) AND Accessibility XL (largest with `legibilityWeight=bold`).
- Android: test at 200% font scale.
- Layout must reflow; no truncation of body text; CTAs grow vertically not get cut off.

## Dark Mode

- Tokens map to system semantic colors (iOS: `Color(.label)`, `Color(.systemBackground)`; Android: M3 `colorScheme.onSurface`).
- Brand colors have light + dark variants in token JSON.
- Images: provide `@light` and `@dark` asset variants (asset catalog on iOS, `values-night/` on Android).
- Mode follows system by default; in-app override available in settings.
- Test all surfaces in dark mode pre-merge.

## Per-Screen Header Style

| Screen | iOS | Android |
|--------|-----|---------|
| Home | Large title + search bar in nav | M3 Large top app bar + search |
| Browse | Large title | M3 Large top app bar |
| Detail (order, profile) | Inline title; back chevron | M3 Small top app bar |
| Modal sheets | No nav bar, drag handle visible | Drag handle visible |

## Swipe Actions on Lists

| List | Leading swipe | Trailing swipe |
|------|---------------|----------------|
| Bookings | "Mark unread" / "Mark read" (toggle) | "Cancel" (destructive — confirm modal) |
| Messages | "Pin" / "Unpin" | "Delete" (destructive — undo toast) |

Non-destructive actions execute immediately. Destructive actions require confirm modal OR undo-toast pattern.

## Status Bar

| Screen | iOS | Android |
|--------|-----|---------|
| Light surfaces | dark content | dark icons |
| Dark / hero surfaces | light content | light icons |
| Modal sheets | inherit underlying | inherit underlying |

Configure via `<StatusBar style="dark" />` (Expo) per screen or via root style provider.

## Platform-Specific Components

| iOS-only | Android-only |
|----------|--------------|
| Action sheet (`UIActionSheet`) | M3 Snackbar with action |
| Context menu (long-press preview) | M3 Menu (anchor button) |
| Form section grouped style | M3 List with leading/trailing icons |

In RN/Expo: use libraries that wrap platform-native (e.g., `@react-native-action-sheet/expo`, `react-native-context-menu-view`).

## Reconciliation Strategy

- Default: **platform-conditional**. iOS gets iOS chrome; Android gets Material chrome. Same screen content, different chrome.
- Exception: a custom-branded surface (e.g., onboarding hero) can use one design across both — full-bleed, no nav chrome, brand-controlled.
- Never: ape iOS chrome on Android (looks broken to Android users) or vice versa.

## A11y

- Every interactive element has accessible label (iOS `accessibilityLabel` / Android `contentDescription`).
- Touch targets ≥ 44×44pt (iOS) / 48×48dp (Android).
- VoiceOver / TalkBack rotor reaches every action.
- Reduced motion respected (iOS `UIAccessibility.isReduceMotionEnabled` / Android `Settings.Global.TRANSITION_ANIMATION_SCALE`).
- Reduced transparency respected (iOS).

## Testing Devices

| Platform | Smallest | Largest | Notch | Foldable |
|----------|---------|---------|-------|----------|
| iOS | iPhone SE 3 (4.7") | iPhone 16 Pro Max | iPhone 15+ | n/a |
| Android | Pixel 4a | Pixel 9 Pro XL | Pixel notch | Galaxy Z Fold (post-MVP) |

Pre-merge: test on smallest + largest of each platform. Focus on safe-area + Dynamic Type largest size.

## Out of Scope

- Wear OS / watchOS (post-MVP).
- TV (no plan).
- Foldable (post-MVP).

## Open Questions

- Adopt iOS 17 inspector / Android 14 PiP for video screens? Defer.
- Custom haptic patterns (CHHapticEngine) for premium-tier feedback? Post-MVP.
```

## Boundaries

- **One file per app.** Web app + mobile app = separate files.
- **Pick platform-native by default.** "Brand consistency across platforms" loses to "feels broken on this platform".
- **Safe-area is mandatory.** No hardcoded paddings near edges.
- **Dynamic Type / font scaling is mandatory.** Truncation = redesign required.
- **No code beyond library names.** Component impl downstream.

## Re-run Behavior

- Read existing first; surface diff.
- Bump `last-updated`.
- Re-evaluate when minimum OS version drops a major release.

## Auto-chain

- Chained with `/motion-direction-spec` — consumes `docs/design/motion.md` for the motion personality that drives Transition Choreography (easing, duration, what animates).
- Per surface → `/ui-wireframe` (mobile-specific layout).
- Each gesture → confirm `/a11y-design` has alternative.
- Dark mode tokens → `/design-system`.
- Pull-to-refresh / swipe actions → `/state-pattern-catalog` for loading states.

## Example Trigger

User: "pick mobile UI patterns for our Expo app"
→ Define nav chrome / modal / safe-area / gestures / haptics / dynamic type / dark mode per platform; reconcile cross-platform; write `docs/design/mobile-ui-patterns.md`.
