---
name: solo-owner-adoption-mechanics
description: Habit + adoption design for single-user admin products (solo practitioner, freelance bookkeeper, indie landlord, restaurant owner, single-operator clinic). Picks daily-pull trigger (email/SMS/push), in-product anchor moment, anti-habituation refresh cadence, abandonment early-warning. Outputs `docs/design/solo-owner-adoption-<project>.md`. Use when product success depends on ONE non-technical operator returning regularly with no team to enforce usage. Triggers on "solo owner", "single admin", "owner adoption", "owner won't log in", "/solo-owner-adoption-mechanics". XS skip; S+ fires when single-admin role + ongoing engagement matters.
output_size:
  XS: skip
  S: 1h
  M: 3h
  L: 5h
  XL: 8h
---

# /solo-owner-adoption-mechanics — Single-user Admin Adoption

Invoke as `/solo-owner-adoption-mechanics`. The product has one decision-maker who is also the day-to-day operator (no IT team, no admin assistant, no SDR). The success metric depends on them coming back daily/weekly. Without a designed pull, they will drift after the honeymoon.

## Why you'd care

Products for single non-technical operators have nobody to enforce usage when adoption slips — the owner just stops logging in. Adoption mechanics are what make the daily return habit-forming instead of optional.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP (no admin product at XS).
2. Read `docs/inception/buyer-persona-deep-<project>.md` if present.
3. Confirm the adoption KPI: "owner logs in ≥N×/wk", "owner takes action ≥N×/wk", or similar.

## Inputs
- Operator profile: tech comfort (low/med), time pressure (high/very high), incentive (revenue / safety / regulatory).
- Critical actions: what must the operator do this week for the product to deliver value?
- Existing tools they open daily (POS, email, WhatsApp, paper book).
- Phone vs desktop usage split.

## Process
1. **Find the pre-existing daily ritual** the operator already does (open POS, check bank app, count cash, review tickets). Anchor your pull to that ritual's timeslot. Don't try to create a new ritual — graft onto an existing one.
2. **Pick a low-friction pull trigger**, ranked by effort to read:
   - **SMS** (best for sub-30s glance): one-line revenue + 1 anomaly. Twilio ~$0.008/send.
   - **Email** (good for skim): daily digest with revenue, top item, anomalies, 1 CTA.
   - **Push** (mobile installed): same as SMS but free; requires they install + grant permission.
   - **Phone wallpaper widget** (PWA installed): passive glance; lowest cost to read.
   - **WhatsApp Business message** (regional fit): high open rate in many markets.
   - Avoid Slack/Teams — wrong tool for solo ops.
3. **Design the trigger content** as a self-contained value unit:
   - Yesterday's revenue (or this-shift, this-day-of-week comparison).
   - One number that requires action (e.g. "3 reservations tomorrow, 2 reminders unread").
   - One anomaly (top item out of stock; refund pending; SLA breach).
   - One CTA deep-link into the product (not the homepage; the *action page*).
4. **Anti-habituation**:
   - Vary the content. Week 1 = revenue. Week 4 = comparison-to-last-month. Week 8 = top customer. Week 12 = forecast.
   - Skip days with nothing to say. Empty digest > noisy digest.
   - A/B subject lines monthly.
   - Plan a refresh at M3 and M6.
5. **Anchor-moment in product** — when the owner does log in, give them one clear "did the right thing" moment within 30s:
   - Today's revenue ticker.
   - Pending action count (with friendly "0 issues" empty state).
   - One-tap-resolve for the top item.
   - Don't dump them in a settings page or analytics dashboard.
6. **Friction audit** for the operator's most-frequent path (e.g. accept reservation):
   - Steps from notification → done ≤ 3.
   - Works one-handed on phone.
   - Reachable in <5s from any state.
7. **Abandonment early-warning**:
   - Log every login.
   - Alert when consecutive-days-without-login >7 (or >threshold for the product).
   - In-product nudge: "haven't seen you in a week — here's what changed".
   - Owner phone call from founder (yes, the founder) if >14 days; this is a save-the-account moment.
8. **No-show fallback channel**: if owner stops responding entirely, route critical ops alerts via SMS to a backup (manager, partner, the founder), not just in-product banner. Define this once at design time so day-30 isn't an emergency.
9. **Anti-pattern avoidance**:
   - Don't gamify with badges/streaks — small-business owners read this as patronizing.
   - Don't quote vanity metrics they can't act on.
   - Don't email more than daily.
   - Don't require app install for the pull trigger; meet them where they are.

## Output
Write `docs/design/solo-owner-adoption-<project>.md`:

```markdown
# Solo-owner adoption mechanics — <project>
**Date:** <YYYY-MM-DD>

## Adoption KPI
- Primary: "owner takes ≥1 action ≥N×/wk for ≥M weeks of Q4".
- Secondary: owner DAU/WAU ratio ≥0.6.
- Warning: 0-action week (any).

## Operator profile
- Role: <indie property mgr / clinic principal / restaurant owner>
- Tech comfort: low–med
- Phone-first: yes (78% mobile)
- Existing daily rituals: <opens email at 09:00, checks bank app at 10:00, posts to Instagram at end of day>

## Pull trigger (primary)
- **Channel:** daily email at 09:00 local (right after POS open).
- **Sender:** product name (not "no-reply@").
- **Subject (rotating):** ["Yesterday: $X across N orders", "Today: N reservations + N online orders", "<This week vs last week>"]
- **Body skeleton:**
  ```
  Yesterday
  Revenue: $XYZ (▲ N% vs same day last week)
  Orders: N online + N in-store
  Top item: <name>
  
  Heads-up
  - <3 reservations tomorrow at 7pm>
  - <Refund pending: #ord_abc, $XX>
  - <Out of stock: <item>>
  
  [Open today's view →]  ← deep-links to /admin/today
  ```
- **Skip rules:** empty digest when no signal. No 7-day streak counter.

## Pull trigger (fallback)
- **Channel:** SMS at 09:15 local IF email unread for 3 consecutive days.
- **Body:** one-line revenue + CTA short-link.
- **Twilio cost:** ~$0.008/send.

## In-product anchor moment
- Landing page `/admin/today` (not `/admin/dashboard`):
  - Big revenue number at top.
  - Pending-action card with count + one-tap-resolve.
  - "0 issues" empty state with a calm visual; no shame.
- Time-to-value < 30s from login → first satisfying interaction.

## Anti-habituation cadence
- M0–M2: revenue + top item + anomalies.
- M3 refresh: add this-day-of-week comparison.
- M6 refresh: add monthly forecast + top customer.
- M9 refresh: add YoY view (once data sufficient).
- Subject line A/B monthly.

## Friction audit (top path: accept reservation)
- Push/SMS notification → open admin → accept = **3 taps**.
- Works one-handed on iOS Safari + Android Chrome.
- p95 time from notification to accept = <12s on 4G.

## Abandonment early-warning
- Login event logged in AuditLog.
- Alert at consecutive-days-without-login ≥ 7 → in-app banner.
- Alert at ≥14 → SMS to owner + email to founder for personal outreach.
- Alert at ≥21 → fallback channel for critical alerts engages.

## Fallback channel for critical ops
- Routes: refund queue + SLA breach + payment failure.
- Targets: owner SMS (primary) → manager SMS (T+30min) → founder email (T+2h).
- Maintained in `docs/ops/escalation-<project>.md`.

## Anti-patterns excluded
- No badges, streaks, or "you're on fire 🔥".
- No vanity metrics (likes, impressions).
- No more-than-daily email.
- No required app install (PWA optional, not gate).

## Test plan
- 4-week A/B: with vs without daily email; measure dashboard DAU.
- Time-to-action measured from notification timestamp to action timestamp.
- Quarterly survey: "did the email help / annoy / both"; iterate content.

## Risk if skip
- Owner habituation after honeymoon (typical M2–M3) → product unused → no value → churn.
- Restaurant sim R5 (owner habituation) hit M2+7d; daily revenue email recovered it. This skill makes that recovery a pre-launch design step, not a reactive mitigation.
```

## Verification
- Daily-ritual anchor named (concrete tool/time, not abstract).
- Pull-trigger channel + cadence picked.
- Trigger content rotation plan documented.
- In-product anchor moment specified with <30s TTV target.
- Friction audit done for top path (count taps).
- Abandonment thresholds + escalation path written.
- Anti-patterns explicitly excluded.
- KPI tied to a concrete primary + secondary + warning metric.
