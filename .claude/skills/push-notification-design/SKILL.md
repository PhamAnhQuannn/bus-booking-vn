---
name: push-notification-design
description: End-to-end push notification design for iOS (APNs) + Android (FCM) — opt-in UX, permission re-prompt strategy, payload patterns (alert / silent / data-only / rich media), token lifecycle, segmentation, quiet hours, frequency caps, deep-link target, A/B testing, analytics, and provider pick (OneSignal / Braze / Customer.io / Firebase Messaging / SNS / direct APNs+FCM). Writes `docs/design/push-notification-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "push notification", "APNs", "FCM", "OneSignal", "Braze", "rich notifications", "silent push", "deep link from push", "opt-in prompt", "/push-notification-design", or before shipping any push-enabled mobile feature.
output_size:
  XS: skip
  S: 1h
  M: 2h
  L: 3h
  XL: 4h
---

# /push-notification-design — Push notifications design

Invoke as `/push-notification-design`. Run before requesting the OS permission for the first time, before integrating any notification provider, and before any "send a marketing blast" plan.

## Why you'd care

Push notifications are the single most-revocable permission in mobile — one tone-deaf send and the user disables them forever, taking your re-engagement channel with them. Get the opt-in moment and frequency cap right or lose the surface.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP
2. Read `docs/inception/pii-inventory-<project>.md` (push token = identifier; falls under GDPR/CCPA).
3. Read `docs/release/app-store-review-<project>.md` (permission gating affects review).
4. Read `docs/design/analytics-events-<project>.md` (push send/open events).

## Inputs
- Audience: consumer / enterprise / b2b kiosk.
- Notification categories: transactional, account security, marketing, content, social, system.
- Required vs nice-to-have channels (transactional often must succeed; marketing is opt-in).
- Regulatory: GDPR (consent required for marketing), CAN-SPAM (US not applicable to push), TCPA (not applicable to push but FTC scrutiny), CCPA opt-out.
- Mobile stacks involved (native, RN, Flutter, Capacitor).

## Process
1. **Opt-in UX strategy (iOS is gated)**:
   - iOS: explicit `UNUserNotificationCenter.requestAuthorization` — one shot, denial near-permanent without Settings deeplink
   - Android 13+ (API 33): explicit `POST_NOTIFICATIONS` runtime permission
   - **Pre-prompt** (a.k.a. priming screen): show a custom screen BEFORE the OS prompt that explains value and offers "Continue" → fires OS prompt; "Not now" defers and never burns the iOS shot
   - **Defer the ask** until user reaches a moment-of-value (post-onboarding, after first key action) — opt-in rates ~2x baseline
   - **Provisional authorization** (iOS 12+) — deliver notifications quietly to Notification Center without alert/sound; lets user evaluate value
2. **Re-prompt strategy when denied**:
   - In-app banner: "Notifications are off. You'll miss order updates" → button opens iOS Settings deep link (`UIApplication.openSettingsURLString`) / Android Notification Channel settings
   - Show after N missed key events; cap to 1/week max
3. **Channels & categories (Android Notification Channels, iOS Notification Categories)**:
   | Channel | Importance | Default sound | User toggle |
   |---|---|---|---|
   | `transactional` | HIGH | yes | locked-on (or hidden) |
   | `security` | HIGH | yes | locked-on |
   | `social` | DEFAULT | yes | user-controlled |
   | `marketing` | LOW | no | user-controlled, default off |
   | `system` | MIN | no | user-controlled |
4. **Payload patterns**:
   - **Alert push (APNs `alert`)** — visible
   - **Silent push (`content-available: 1` iOS, `priority: high` data-only FCM)** — background fetch trigger; rate-limited by OS; iOS budgets ~2–3/hour
   - **Mutable content (`mutable-content: 1`)** — Notification Service Extension can decrypt, localize, attach media
   - **Rich media** — image, video, audio; FCM image up to 1 MB, APNs attachment up to 10 MB but practical 1 MB
   - **Action buttons** — APNs `category` matching UNNotificationCategory; Android `Notification.Action`
   - **Live Activities (iOS 16.1+)** — for ongoing real-world activities (delivery, score); via ActivityKit + push to `liveactivity` push-type
5. **Token lifecycle**:
   - Token issued by APNs / FCM on first launch with permission
   - Send token + userId + deviceId to backend; upsert keyed on (userId, deviceId)
   - Token rotates: app reinstall, OS upgrade, user switches device → register on every cold start
   - Stale-token cleanup: APNs/FCM returns `Unregistered` / `NotRegistered` → delete from DB
   - GDPR: token is a device identifier; include in DSAR export + deletion
6. **Deep link to surface**:
   - Payload includes `deeplink: https://<project>.app/...` (Universal Link / App Link)
   - On tap: app cold-starts → reads `userInfo` → routes via existing deep-link handler (see `/deep-link-strategy`)
   - Track `push.open` analytic with campaign + variant
7. **Segmentation & throttling**:
   - Quiet hours: respect user timezone; never send marketing 22:00–08:00 local
   - Frequency cap: marketing ≤ 3/week, transactional uncapped
   - Suppression list: unsubscribers, recent-uninstall (lastSeen > 30d → quarantine)
   - Segments: behavior, lifecycle stage, paying vs free
8. **Provider pick**:
   | Provider | Best for | Cost | Notes |
   |---|---|--:|---|
   | **Direct APNs + FCM** | full control, cost-min | $0 infra; dev time high | own everything; build own scheduler |
   | **Firebase Cloud Messaging** | budget-conscious | free for sends | thin; lacks campaign UI |
   | **OneSignal** | simple marketing | free <10k subs, $9/mo +30k | rich UI, fast setup |
   | **Customer.io** | lifecycle messaging | $100/mo+ | strong segmentation + email parity |
   | **Braze** | enterprise lifecycle | $$$$ (annual contract) | richest segmentation |
   | **AWS SNS** | AWS shop, fan-out | usage-based | low-level |
   | **Iterable / Airship** | enterprise | $$$$ | competitor to Braze |
   | **Knock** | dev-first notification platform | $250/mo+ | unified push/email/SMS/in-app |
9. **Compliance & privacy**:
   - Apple App Privacy: declare push token as "Device ID" or "Other Identifier" linked to user
   - Google Data Safety: same
   - GDPR Article 6 lawful basis: consent for marketing; legitimate interest / contract for transactional
   - CCPA opt-out: honor "Do Not Sell or Share" — exclude from sharing if categorized as sharing
10. **Observability**:
    - Events: `push.token.register`, `push.send`, `push.delivered`, `push.open`, `push.dismiss`, `push.permission.granted/denied`
    - APNs feedback service → record-uninstall
    - FCM delivery reports (BigQuery export)

## Output
Write `docs/design/push-notification-<project>.md`:

```markdown
# Push Notification Design — <project>
**Date:** <YYYY-MM-DD>

## Provider pick
- **Production**: OneSignal (consumer launch, <10k subs free tier)
- **Migration plan**: re-evaluate at 100k MAU → consider Customer.io or Braze
- Reasons: web dashboard for non-eng marketing, free tier, RN SDK maturity, A/B testing built-in

## Opt-in funnel
| Step | UX | Goal |
|---|---|---|
| 0. App open | no prompt | — |
| 1. After 1st order placed | priming screen "Get order updates" | 70% continue |
| 2. OS prompt (iOS UNUserNotificationCenter / Android POST_NOTIFICATIONS) | system prompt | 80% allow of continuers → 56% net |
| 3. If denied | in-app banner after 3 missed transactional events | re-prompt via Settings deep link |
| 4. Provisional fallback (iOS) | request `.provisional` on first launch | silent delivery to notification center |

## Categories / channels
| Channel | Android Importance | iOS Category | Default | Marketing-eligible |
|---|---|---|---|---|
| `order_status` | HIGH | ORDER_UPDATE | on (locked) | no |
| `security` | HIGH | SECURITY | on (locked) | no |
| `social` | DEFAULT | SOCIAL | on | no |
| `promos` | LOW | PROMO | off | yes |
| `news` | MIN | NEWS | off | yes |

## Payload templates
### Transactional — order delivered
```json
{
  "aps": {
    "alert": {"title": "Order delivered", "body": "Your $30 order arrived"},
    "sound": "default",
    "category": "ORDER_UPDATE",
    "thread-id": "order-{{orderId}}",
    "mutable-content": 1
  },
  "deeplink": "https://<project>.app/orders/{{orderId}}",
  "imageUrl": "https://cdn.<project>.com/order/{{orderId}}.jpg",
  "campaignId": "txn-order-delivered",
  "category": "transactional"
}
```
### Marketing — weekly digest
```json
{
  "aps": {
    "alert": {"title": "Top picks for you", "body": "5 new spots this week"},
    "sound": "default",
    "category": "PROMO"
  },
  "deeplink": "https://<project>.app/discover?utm_source=push&utm_campaign=weekly",
  "campaignId": "mkt-weekly-digest-2026-05-13",
  "category": "marketing"
}
```
### Silent — background sync
```json
{
  "aps": {"content-available": 1},
  "syncReason": "inventory-updated",
  "catalogId": "cat_123"
}
```

## Quiet hours + frequency caps
- Marketing window: 09:00–20:00 user-local; never 21:00–08:59
- Frequency cap: ≤3 marketing pushes/user/week, ≤1/day
- Transactional: no cap (order, security, social-reply)
- Re-engagement re-prompt for permission: ≤1/week if denied

## Token lifecycle
- Backend table `push_subscriptions(userId, deviceId, platform, token, locale, tz, createdAt, lastSeen)`
- Upsert on every cold start
- Mark inactive after 30 days no app open
- Hard-delete on APNs/FCM "Unregistered" feedback
- Included in DSAR + GDPR delete

## Segmentation taxonomy
- `lifecycle`: visitor, signed_up, activated, paying, lapsed, churned
- `cohort_month`: YYYY-MM
- `paying_tier`: free, basic, pro
- `tz_bucket`: PT, ET, CET, JST, ...
- `language`: en, es, fr, ja
- `last_active_days_bucket`: 0-1, 2-7, 8-30, 31+

## Deep link routing
- All push payloads carry `deeplink` Universal Link / App Link
- On tap: AppDelegate → `UIApplicationDelegate.application(_:continue:restorationHandler:)` → route via existing handler
- Track `push.open` analytics with campaignId, variant, deeplink target
- Defer-link via Branch SDK if user is not yet installed (rare for push but yes for SMS→install→push handoff)

## A/B testing
- Variants per campaign — title, body, image, CTA, send-time
- Holdout: 10% global no-marketing-push control to measure marginal lift
- KPI: 24h conversion to target action, not just open-rate
- Tool: OneSignal A/B + PostHog cohorts

## Compliance
- App Privacy / Data Safety: push token disclosed as Device ID, linked to user, used for App Functionality + Analytics + (marketing pushes) Targeted Advertising
- GDPR: explicit marketing-push consent toggle in Settings → Notifications → Marketing; default OFF in EU
- CCPA: "Do Not Sell or Share" honored → user excluded from any segment passed to ad partners
- Apple HIG: never spam, every notification must be actionable

## Observability events
| Event | Trigger | Source |
|---|---|---|
| `push.permission.shown` | OS prompt shown | client |
| `push.permission.granted` | user allowed | client |
| `push.permission.denied` | user denied | client |
| `push.token.register` | token sent to server | server |
| `push.send` | server hits OneSignal API | server |
| `push.delivered` | OneSignal delivery webhook | OneSignal |
| `push.open` | user tap | client |
| `push.dismiss` | swipe-away | client |
| `push.unsubscribe` | toggle off | client |

## Dashboards (PostHog)
- Daily: opt-in rate by funnel step, sends, delivered %, open %, dismiss %
- Weekly: campaign A/B results, segment performance
- Alert: open-rate drop >30% W/W per campaign category

## Cost (year 1)
| Item | Cost/mo |
|---|--:|
| OneSignal Growth (50k MAU push) | $99 |
| APNs / FCM | $0 |
| iOS Apple Developer | $99/yr ÷ 12 |
| Eng time first-pass | 5 days |
| Total ongoing | ~$110/mo |

## Risk if skip
- Asking for permission on app launch → 20-30% opt-in; deferred ask → 50-70%
- iOS deny is near-permanent (Settings-only); burning the prompt cuts your reach in half forever
- Sending marketing without explicit consent in EU → GDPR fine + Apple/Google reports
- No quiet hours → 3 AM pushes = uninstall + 1-star review
- No frequency cap → user disables all notifications, including transactional
- No silent-token cleanup → APNs throttles your push certificate
- Missing deep-link routing → user tap goes to home screen → 0 conversion

## Verification
- Permission ask is deferred to moment-of-value, not app launch
- Pre-prompt screen reviewed by design + legal
- Categories / channels declared at app first run
- All payload templates have `deeplink` + `campaignId`
- Quiet hours + caps live in scheduling layer
- Token table includes lifecycle fields and is wired to feedback service
- Compliance: marketing consent persisted; CCPA suppression list wired
- Observability events firing into PostHog
```

## Verification
- Opt-in UX deferred past app launch.
- Pre-prompt copy drafted.
- Channels / categories table present.
- At least 3 payload templates (transactional, marketing, silent).
- Quiet hours and frequency caps set.
- Token lifecycle covers register, refresh, unregister, delete.
- Deep-link routing path documented.
- Compliance section addresses GDPR consent, Apple/Google Privacy declarations, CCPA opt-out.
- Provider chosen with cost.
- Analytics events enumerated.
