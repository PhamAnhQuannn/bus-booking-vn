---
name: analytics-spec
description: Event tracking schema. Naming conventions, props, trigger surface per event. Funnel design (visit → primary action). PostHog/Mixpanel-agnostic. Use when user says "analytics events", "event tracking", "PostHog spec", "Mixpanel spec", "track event", "/analytics-spec", or before launch / new feature. Writes docs/design/analytics-events.md + lib/analytics.ts.
output_size:
  XS: skip
  S: 1h
  M: 2h
  L: 4h
  XL: 6h
---

# Analytics Spec

## Why you'd care

Three months in, "ten events all named different" is unfixable without a backfill and a migration of every dashboard. Defining names, props, and triggers up front is the only way the funnel data you ship today is still readable next quarter.

Single source of truth for analytics events: name, props, trigger surface, owner. Prevents the typical "ten events all named different" drift. Defines the project's primary funnel (visit → resource view → primary-action start → primary-action confirm). Vendor-agnostic schema → wrapped in `lib/analytics.ts` → swappable backend.

## When This Skill Applies

Activate when:
- User says "analytics events", "event tracking", "PostHog spec", "Mixpanel spec", "track event", "/analytics-spec"
- Before launch — funnel + retention measurement need to ship with v1
- New feature → must spec events before implementation
- Quarterly audit — events drift, naming inconsistent
- Onboarding new product person — they ask "what do we track?"

Pairs with `/user-flow` (events line up with flow steps), `/nfr-template` (funnel KPIs are NFRs), `/observability-design` (system metrics complement product metrics).

## Prerequisites

- Vendor decided: PostHog (recommended for self-hostable + replay), Mixpanel, Amplitude, GA4.
- Naming convention agreed: this skill enforces `<noun>_<verb>_<context>` snake_case. Use the placeholder convention `<resource>_viewed`, `<primary-action>_started/submitted/confirmed/failed` and instantiate per project (see funnel-example table below).
- Privacy stance: no PII in events (no email, phone). Use stable hashed user ID.
- Cookie/consent flow if EU traffic — see `/threat-model`.

## Steps

1. **Identify funnels.** Generic shape: visit → resource view → primary-action start → primary-action submit → primary-action confirm. Instantiate `<resource>` and `<primary-action>` for the project's vertical (table below shows 3 worked instantiations).
2. **Name events.** `<noun>_<verb>_<context>` snake_case. Past-tense verb. No camelCase.
3. **Per event, define:**
   - Name
   - Trigger surface (page + interaction)
   - Required props
   - Optional props
   - Who owns this metric (PM, growth, ops)
4. **Define common props auto-attached.** `userId`, `sessionId`, `path`, `viewport`, `releaseSha`.
5. **No PII rule.** Email, phone, full name → never in events. Use `userId` (stable, opaque) instead.
6. **Build typed wrapper.** `lib/analytics.ts` — single `track(eventName, props)` function. Type prevents misnamed events at compile time.
7. **Document funnels.** Map each funnel step to event sequence + drop-off measurement.
8. **Define retention/engagement events.** `app_returned`, `<primary-action>_repeated`.
9. **Quality checks.** Per-event "looks like" example payload; QA can spot-check in PostHog.
10. **Write `docs/design/analytics-events.md`**.

## Funnel-Example Instantiations

The catalog and `EventMap` below use placeholder names (`<resource>_viewed`, `<primary-action>_submitted`). Pick one column when speccing your project's events:

| Placeholder | Restaurant (booking) | SaaS (signup→activation) | Marketplace (checkout) |
|-------------|----------------------|--------------------------|------------------------|
| `<resource>_viewed` | `restaurant_viewed` | `pricing_viewed` | `listing_viewed` |
| `<primary-action>_started` | `reservation_started` | `signup_started` | `checkout_started` |
| `<primary-action>_submitted` | `reservation_submitted` | `signup_submitted` | `checkout_submitted` |
| `<primary-action>_confirmed` | `reservation_confirmed` | `signup_completed` | `order_confirmed` |
| `<primary-action>_failed` | `reservation_failed` | `signup_failed` | `checkout_failed` |
| `<primary-action>_repeated` | `reservation_repeated` | `feature_re_engaged` | `repeat_purchase` |

Substitute placeholders with concrete names in your project; the structure stays the same across verticals.

## Output Format — `lib/analytics.ts`

```typescript
import posthog from "posthog-js";
import { env } from "@/lib/env";

// Placeholder convention shown below — substitute <resource> and <primary-action>
// with concrete names for your project (see funnel-example table above).
type EventMap = {
  // Discovery
  page_viewed: { path: string; referrer?: string };
  resource_viewed: { resourceId: string; resourceSlug: string };           // <resource>_viewed
  search_submitted: { query: string; resultCount: number };

  // Primary-action funnel
  primary_action_started: { resourceId: string; quantity?: number };       // <primary-action>_started
  primary_action_step_picked: { resourceId: string; stepValue: string };   // intermediate step (e.g. time-slot, plan-tier, shipping)
  primary_action_submitted: { resourceId: string; quantity?: number };     // <primary-action>_submitted
  primary_action_confirmed: { resourceId: string; recordId: string; amountCents?: number }; // <primary-action>_confirmed
  primary_action_failed: { resourceId: string; reason: "no_capacity" | "payment_failed" | "validation" | "other"; errorCode?: string };

  // Account
  signup_completed: { method: "email" | "google" };
  login_completed: { method: "email" | "google" };
  signout: Record<string, never>;

  // Engagement
  app_returned: { daysSinceLast: number };
  primary_action_repeated: { resourceId: string; previousCount: number };  // <primary-action>_repeated

  // Errors (product-level, not technical — those go to Sentry)
  feature_error: { feature: string; reason: string };
};

type EventName = keyof EventMap;

let initialized = false;

export function initAnalytics() {
  if (typeof window === "undefined" || initialized) return;
  if (!env.NEXT_PUBLIC_POSTHOG_KEY) return; // dev / not configured
  posthog.init(env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: false, // we send page_viewed manually with our shape
  });
  initialized = true;
}

export function identify(userId: string, traits?: Record<string, string | number | boolean>) {
  if (typeof window === "undefined") return;
  posthog.identify(userId, traits);
}

export function track<K extends EventName>(event: K, props: EventMap[K]) {
  if (typeof window === "undefined") return;
  posthog.capture(event, props);
}

export function reset() {
  if (typeof window === "undefined") return;
  posthog.reset();
}
```

## Output Format — `docs/design/analytics-events.md`

```markdown
---
last-updated: YYYY-MM-DD
vendor: posthog
status: spec | implemented | audited
---

# Analytics Events

Single source of truth for product events. Mirrored in `lib/analytics.ts` (typed). Any event not in this doc + the typed map = bug, must reject in PR review.

## Naming Convention

- `<noun>_<verb>_<context?>` — snake_case
- Past-tense verb (`submitted`, not `submit`)
- Noun is the *subject* the verb acts on (`<primary-action>_submitted`, not `user_submitted_<primary-action>`)
- Context optional, only when same noun-verb has multiple meaningful surfaces

## Common Props (auto-attached, do not specify per-event)

| Prop | Type | Source |
|------|------|--------|
| userId | string \| null | session, hashed |
| sessionId | string | PostHog auto |
| path | string | `window.location.pathname` |
| viewport | string | "1920x1080" |
| releaseSha | string | `process.env.VERCEL_GIT_COMMIT_SHA` or your stack equivalent |
| timestamp | ISO 8601 | event time |

## Event Catalog

Placeholders below (`<resource>`, `<primary-action>`) — instantiate per project. See funnel-example table in skill body for 3 worked vertical instantiations (restaurant, SaaS, marketplace).

### Discovery

| Event | Trigger | Required props | Optional props | Owner |
|-------|---------|----------------|----------------|-------|
| `page_viewed` | Every route change | `path` | `referrer` | growth |
| `<resource>_viewed` | Resource detail page mounted | `resourceId`, `resourceSlug` | — | growth |
| `search_submitted` | Search form submit | `query`, `resultCount` | — | growth |

### Primary-action Funnel (PRIMARY)

| Event | Trigger | Required props | Funnel step |
|-------|---------|----------------|-------------|
| `<primary-action>_started` | User opens primary CTA / dialog | `resourceId`, `quantity?` | 1 |
| `<primary-action>_step_picked` | User makes intermediate choice (slot/tier/shipping) | `resourceId`, `stepValue` | 2 |
| `<primary-action>_submitted` | Form submit (before fulfillment/payment) | `resourceId`, `quantity?` | 3 |
| `<primary-action>_confirmed` | Fulfillment success + DB row written | `resourceId`, `recordId`, `amountCents?` | 4 |
| `<primary-action>_failed` | Any failure in funnel | `resourceId`, `reason`, `errorCode?` | (drop-off) |

`reason` enum: `no_capacity | payment_failed | validation | other`. Anything not in enum = `other` + free-text in `errorCode`.

### Account

| Event | Trigger | Required props | Owner |
|-------|---------|----------------|-------|
| `signup_completed` | New User row created | `method` | growth |
| `login_completed` | Auth session start | `method` | growth |
| `signout` | Session ended by user | — | growth |

### Engagement

| Event | Trigger | Required props | Owner |
|-------|---------|----------------|-------|
| `app_returned` | Auth user lands after > 7d gap | `daysSinceLast` | PM |
| `<primary-action>_repeated` | User repeats primary action on same resource | `resourceId`, `previousCount` | PM |

### Errors (product, not technical)

| Event | Trigger | Required props |
|-------|---------|----------------|
| `feature_error` | Catch-all for product-visible errors | `feature`, `reason` |

Technical errors (500s, JS exceptions) → Sentry, not PostHog.

## Funnels (PostHog config)

### Primary-action funnel

`<primary-action>_started` → `<primary-action>_step_picked` → `<primary-action>_submitted` → `<primary-action>_confirmed`

Window: 30min. Conversion target: 60%+. Below 50% triggers investigation.

Drop-off interpretation:
- Step 1→2 large drop: intermediate-choice UI confusion / no capacity / no options
- Step 2→3 large drop: form friction / missing info
- Step 3→4 large drop: fulfillment failure (cross-check `<primary-action>_failed` + payment/upstream logs)

### Sign-up → first primary-action

`signup_completed` → `<primary-action>_confirmed` (within 7d, same userId).

Target activation: 30%+.

## Retention cohorts

- D1, D7, D30 retention: any event from `userId` after sign-up
- Primary-action repeat rate: distinct `userId` with > 1 `<primary-action>_confirmed` / total

## Privacy & Compliance

- **No PII.** `userId` is opaque (DB UUID). Email/phone/name MUST NOT appear in props.
- **Consent.** EU users get cookie banner; PostHog only initializes after consent.
- **Anonymous → identified.** Pre-login events captured anonymously; on login, call `identify(userId)` to merge sessions.
- **Right of erasure.** PostHog supports user deletion via API — wire into your account-delete endpoint if PostHog enabled in prod.

## Adding a new event

1. Add to `EventMap` in `lib/analytics.ts` (TypeScript prevents typos at call site)
2. Add row to event catalog table here
3. Decide funnel impact: does this slot into existing funnel or create new one?
4. PR includes both code + doc update — reviewer rejects if either missing
5. Verify in PostHog "live events" view post-deploy

## Out of Scope

- Server-side events (e.g. cron job ran) — those go to `/observability-design` SLOs
- A/B testing — separate `/feature-flag-wire` integration
- Heatmaps / session replays — PostHog handles separately, not specced as events

## Auto-chain

- New funnel step → update funnel section + PostHog dashboard
- Drop-off > target → `/user-flow` revisit
- Privacy concern → `/privacy-impact` + `/threat-model`
- Vendor migration → re-write `lib/analytics.ts`, doc stays
```

## Boundaries

- **Events are forever.** Renaming = data discontinuity. Pick once, live with it.
- **No PII, ever.** Opaque IDs only. Email in event = compliance bug.
- **Spec before code.** Doc + type map updated → THEN implementation. Reverse order = drift.
- **One owner per event.** Diffuse ownership = nobody investigates funnel changes.
- **Funnel = primary metric.** Vanity events (every click) clutter; spec what changes decisions.
- **Server vs product events.** Primary-action confirmations are product (this skill). Webhook latency is system (`/observability-design`).

## Re-run Behavior

- If `docs/design/analytics-events.md` exists, read first.
- Cross-check `EventMap` in `lib/analytics.ts` against doc — diff = drift, surface.
- Spot-check PostHog "live events" — events present in tool but not in doc = unspecced shipping.

## Auto-chain

- New funnel needed → add events to map + doc same PR
- Drop-off below target → `/user-flow` retro
- New feature → spec events before scaffold
- Vendor swap → keep doc + map, replace `posthog` import with new client
- PII concern → `/privacy-impact`

## Example Trigger

User: "we need event tracking before launch — what do we measure?"
→ Define primary-action funnel + auth + engagement events using the placeholder convention (`<resource>_viewed`, `<primary-action>_started/submitted/confirmed/failed`), instantiate placeholders for the project's vertical, write typed `lib/analytics.ts` with `EventMap`, write `docs/design/analytics-events.md` with naming rules + funnels + privacy.
