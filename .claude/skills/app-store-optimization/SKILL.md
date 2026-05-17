---
name: app-store-optimization
description: ASO playbook for App Store (iOS) + Google Play. Title, subtitle, keyword field, screenshots, preview video, ratings prompt cadence, conversion-rate optimization, A/B testing (Product Page Optimization on iOS, Custom Store Listings + Store Listing Experiments on Play), localization. Tooling: Sensor Tower, Mobile Action, data.ai, AppFollow, AppTweak. Reads `/project-classify` + GTM docs. Writes `docs/release/aso-<project>.md`. Use when user says "ASO", "app store optimization", "keyword research", "screenshots", "App Store", "Play Store", "Product Page Optimization", "PPO", "Custom Store Listings", "/app-store-optimization", or before app launch / after flat install rate.
output_size:
  XS: skip
  S: 1h
  M: 3h
  L: 4h
  XL: 4h
---

# /app-store-optimization — App Store + Play Store Optimization

## Why you'd care

A 5-point conversion-rate lift on the store page is the cheapest growth lever you'll ever pull — same traffic, more installs, zero CAC. Skipping ASO means you're paying for traffic that bounces on a generic icon and a wall of text.

Invoke as `/app-store-optimization`. Run before first submission, again at any major version, and again any month conversion rate drops >10%.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP (no mobile app at XS)
2. Read `docs/gtm/positioning-statement-<project>.md` and `docs/gtm/messaging-pillars-<project>.md` if present — store copy must echo positioning.
3. Read `docs/gtm/buyer-persona-<project>.md` to ground keyword intent.
4. Confirm App Store Connect + Google Play Console access.

## Inputs
- Category + subcategory (Productivity, Health & Fitness, etc.).
- Primary persona + their language (the words they'd type).
- Competitor app IDs (3–5 in same category).
- Current metrics if relaunching: impressions, product-page views, install conversion rate, retention D1/D7/D30.
- ASO tool access (any of: Sensor Tower, Mobile Action, data.ai, AppFollow, AppTweak — free tiers cover S/M).
- Launch market(s) — US-only or localized.

## Process
1. **Keyword universe build** (target 5–15 high-volume low-competition keywords):
   - Brainstorm seed list (15–30 keywords) from persona language + competitor names.
   - Plug into ASO tool — pull volume score (Sensor Tower 0–100) and difficulty.
   - Sweet spot: volume ≥ 30, difficulty ≤ 30.
   - Pull competitor keyword sets — find gaps (they rank top-10, you don't, low difficulty).
   - Final shortlist: 5–15 keywords ranked by (volume × intent) / difficulty.
2. **iOS keyword field strategy (100 char limit)**:
   - Comma-separated, no spaces after commas (saves chars).
   - Don't repeat your title/subtitle words — they already index.
   - Don't include category name — already indexed.
   - Don't use competitor brand names (rejection risk; Apple §5.2).
   - Singular indexes plural (and vice versa) — pick one.
   - Localize per storefront (each locale = own 100 chars).
3. **iOS metadata fields (each indexed differently)**:
   - **App name** (30 char) — brand + 1 keyword max. "Notion - notes, docs, tasks" pattern.
   - **Subtitle** (30 char) — value prop with 1–2 keywords. Indexes heavily.
   - **Keyword field** (100 char) — not user-visible, indexes only.
   - **Promotional text** (170 char) — does NOT index, but editable without review (use for launches, sales).
   - **Description** (4000 char) — does NOT index on iOS (does on Android — see below). First 3 lines visible above fold.
4. **Google Play metadata**:
   - **Title** (30 char) — indexes heavily.
   - **Short description** (80 char) — indexes; above-fold.
   - **Long description** (4000 char) — indexes (Play is full-text search, unlike App Store). Keyword density 1–3% per top keyword, no stuffing.
   - No dedicated keyword field; description carries it.
5. **Screenshots — the highest-leverage asset** (conversion lift 10–40% typical):
   - iOS: 6.7" required (iPhone 15 Pro Max). Optionally 6.5", 5.5", iPad 12.9" and 11".
   - Play: 1080×1920 phone; 7" + 10" tablet optional but boost surface.
   - Use 3–5 screenshots; first 2 do 80% of the work (visible without scroll).
   - Pattern: caption + screenshot. Caption = benefit, not feature ("Track 100 habits, all on one screen" not "Habit tracker").
   - First screenshot = headline value. Subsequent = feature → social proof → CTA.
   - Portrait > landscape on phones unless game.
6. **Preview video** (App Store) / **feature graphic + promo video** (Play):
   - iOS Preview: 15–30 sec, in-app footage only (Apple rejects splashes/marketing).
   - Play Promo: 30 sec max; can be marketing-style (YouTube-hosted).
   - Plays muted by default — caption everything.
   - Conversion lift 20–35% when well-produced.
7. **Ratings prompt cadence** (rating → ranking → installs flywheel):
   - iOS: `SKStoreReviewController` — Apple allows 3 prompts per 365 days. Trigger on positive moment (task completed, milestone hit), not on launch.
   - Android: Google Play In-App Review API — same idea, Play decides actual show.
   - Pre-prompt with NPS-style 1-tap ("Enjoying X?") to filter detractors to a feedback form, promoters to the system prompt.
   - Target: 4.5+ rating, 1000+ ratings before paid acquisition.
8. **A/B testing**:
   - **iOS Product Page Optimization (PPO)**: up to 3 treatments + control, traffic split, 30+ day tests, ≥80% of traffic recommended. Test screenshot variants, app icons, preview videos. Significance auto-calculated; need ~95% confidence + practical lift (5%+).
   - **iOS Custom Product Pages**: up to 35 alternate pages, no split test — each gets a unique URL for paid traffic.
   - **Google Play Store Listing Experiments**: classic A/B (up to 3 variants vs control), can test icon/screenshots/descriptions/short-desc/feature-graphic separately. Requires ~7-day run + 1k visitors per arm minimum.
   - **Custom Store Listings (Play)**: target by country / pre-registered users / install state / Google Ads campaign.
9. **Localization** (often the biggest ASO unlock):
   - iOS: each storefront = own metadata + screenshots + keyword field (free distribution to 175 storefronts; localization is per-language).
   - Top non-English ROI markets typically: Spanish (LatAm + ES), German, French, Japanese, Korean, Portuguese-BR, Simplified Chinese (mainland is Android-Huawei, iOS allowed via App Store CN).
   - "Localized" ≠ "translated" — keywords are different (German users don't search "fitness", they search "Fitnessstudio").
   - Tools: AppTweak + Mobile Action surface per-locale keyword volume.
10. **Ratings & reviews ops**:
    - Reply to every 1–3 star review within 48h (both stores let you reply).
    - Reply changes are visible to other browsers — turn 1-star into trust signal.
    - Sentiment-tag reviews monthly → feature backlog.
11. **Tracking**:
    - iOS: App Store Connect Analytics — impressions, product page views, conversion rate (impressions → install).
    - Play: Play Console — store listing visitors, acquisition reports.
    - Goal: conversion rate (PP views → install) > category median. iOS median ≈ 30–35%, Play median ≈ 25–30% (varies wildly by category).
12. **Refresh cadence**:
    - Keywords: review monthly, fully refresh quarterly.
    - Screenshots: test new variant every 6–8 weeks during growth phase.
    - Promotional text: change at launches / sales (no review required on iOS).

## Output
Write `docs/release/aso-<project>.md`:

```markdown
# ASO Plan — <project>
**Date:** <YYYY-MM-DD>
**Category:** <iOS category> / <Play category>
**Markets (Y1):** <US, GB, DE, JP …>
**Tool:** <Sensor Tower / Mobile Action / AppTweak / data.ai / AppFollow>

## Keyword shortlist (US-EN baseline)
| # | Keyword | Volume | Difficulty | Intent | Source |
|---|---|--:|--:|---|---|
| 1 | habit tracker | 65 | 28 | high | persona + tool |
| 2 | daily routine app | 42 | 19 | high | competitor gap |
| 3 | streak app | 38 | 22 | med | persona |
| 4 | morning routine | 51 | 35 | med | borderline; watch |
| 5 | tiny habits | 30 | 14 | med | gap |
| 6 | habit builder | 36 | 25 | med | tool |
| 7 | journal habit | 28 | 18 | low | gap |
| 8 | productivity habits | 44 | 31 | med | tool |
| 9 | habit reminder | 33 | 20 | high | persona |
| 10 | check off list | 27 | 16 | low | gap |

## iOS metadata (US storefront)
- **App name (30):** `Habitly — daily habit tracker` (29)
- **Subtitle (30):** `Build streaks, beat slumps` (26)
- **Keyword field (100):** `routine,streak,tiny,builder,reminder,journal,checklist,productivity,morning,daily,goal`
- **Promo text (170):** `New: shared habits with friends. Tap a streak to send a nudge.`
- **Description first 3 lines:** <hook line> / <proof line> / <CTA line>

## Google Play metadata (US-EN)
- **Title (30):** `Habitly: Habit Tracker` (22)
- **Short desc (80):** `Track daily habits, build streaks, beat resistance. Free & no ads.` (66)
- **Long desc (4000):** keyword density target 1.5% for "habit tracker", 1% for next 3 keywords. First paragraph repeats Short desc nearly verbatim. Headers H1/H2 included.

## Screenshot plan (iOS 6.7" required; cascade down)
| Slot | Caption | Screenshot focus |
|---|---|---|
| 1 | "Build habits that stick" | Home with streaks |
| 2 | "Track without the chore" | One-tap check-off |
| 3 | "See your streaks grow" | Streak heatmap |
| 4 | "Loved by 50,000 builders" | Testimonial overlay |
| 5 | "Free forever — no ads" | CTA + pricing badge |

## Preview video (iOS) / Promo video (Play)
- iOS: 28-sec in-app footage; captioned; no narration; muted-by-default safe.
- Play: 30-sec YouTube unlisted; first 5 sec = hook.

## Ratings prompt cadence
- Trigger: after user logs habit completion ≥ 5 days in a row.
- Pre-prompt UI: "Enjoying Habitly?" → Yes routes to SKStoreReviewController / In-App Review; No routes to feedback form.
- Cap: 3 per 365 days (iOS hard cap).
- Target: 4.5★ avg, 1k ratings before paid scale.

## A/B test plan (first 90 days)
| Test | Platform | Variants | Hypothesis | Success metric |
|---|---|---|---|---|
| Icon: gradient vs flat | iOS PPO | 2 + control | Gradient pops in search | install CR +5% |
| Screenshot 1: streak vs habits | Both | 2 + control | Streak = stronger hook | PP→install +8% |
| Short desc keyword: "tracker" vs "builder" | Play | 2 + control | "builder" matches intent | impressions +10% |
| Preview video on/off | iOS PPO | 2 + control | Video drives conv | install CR +12% |

Each test: 30 days, ≥95% confidence, ≥5% practical lift.

## Localization roadmap
| Locale | Storefront | Priority | Timeline |
|---|---|--:|---|
| en-US | US | P0 | launch |
| en-GB | GB | P1 | wk 2 |
| es-419 | MX, AR, CO | P1 | wk 4 |
| es-ES | ES | P2 | wk 8 |
| de-DE | DE | P1 | wk 6 |
| ja-JP | JP | P2 | wk 10 |
| pt-BR | BR | P2 | wk 10 |
| fr-FR | FR | P3 | wk 14 |

Per locale: keyword field + title + subtitle + 5 screenshots + first 3 desc lines. Use native speaker, not MT.

## Reviews ops
- Reply SLA: 1–3★ within 48h.
- Monthly: sentiment-tag last 30 days reviews → feature backlog.
- "Top complaint" → ship fix → reply quoting fix → ask original reviewer to update.

## Conversion baselines (target by D90)
| Metric | iOS target | Play target |
|---|--:|--:|
| Impression → PP view | 4–6% | 6–8% |
| PP view → install | 35% | 30% |
| Rating average | 4.5★ | 4.4★ |
| Rating volume | 1,000+ | 1,000+ |

## Tool stack
- Keyword research: <Sensor Tower / Mobile Action / AppTweak>
- Rank tracking: <AppTweak / AppFollow>
- Review aggregation + reply: <AppFollow>
- Competitor intel: <data.ai>

## Anti-patterns (auto-reject or auto-tank)
- Competitor brand in keyword field (Apple §5.2 reject)
- Title >30 chars padded with keywords ("App — best free easy fast tool for X Y Z")
- Same screenshot text in every locale (untranslated)
- Description as wall of keywords (Play algorithmic penalty)
- Rating prompt on first launch (kills conversion, low ratings from confused users)
- Screenshots that look like marketing flyer with tiny phone in corner (low conv)
- 5★ review-farm services (account ban)
- Ignoring 1★ reviews (compounds)

## Risk if skip
- Discoverability cliff: 65% of installs come from search; no ASO = no organic.
- Paid acquisition CPI 2–3× higher when conversion rate is below median.
- Bad ratings ossify — hard to climb back from 3.8★.
- Competitor takes your keyword whitespace and you pay to rent it back.
- Localization missed = leaving 60%+ of TAM on table (non-US markets).

## 90-day plan
1. Wk 1–2: keyword research + US-EN metadata + screenshot v1.
2. Wk 3: submit; promo text + ratings prompt code wired.
3. Wk 4–8: PPO test 1 (icon), Play experiment 1 (short desc).
4. Wk 6–10: localize to en-GB + es-419 + de-DE.
5. Wk 8–12: PPO test 2 (screenshot 1), Play experiment 2 (feature graphic).
6. Wk 12: review baseline metrics vs target; queue Q2 tests.
```

## Verification
- Keyword shortlist has 5–15 entries with volume + difficulty.
- iOS keyword field ≤ 100 chars, no competitor brands, no repeats from title.
- Play title ≤ 30 chars, short desc ≤ 80, long desc has keyword density target.
- Screenshot captions are benefits, not features.
- Ratings prompt is gated on positive moment, not first launch.
- At least 1 A/B test plan per store for first 90 days.
- Localization roadmap covers ≥ 3 non-English markets if non-XS/-S.
- Baseline conversion targets set vs category median.
