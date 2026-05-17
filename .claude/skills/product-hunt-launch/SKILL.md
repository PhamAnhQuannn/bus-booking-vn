---
name: product-hunt-launch
description: Product Hunt launch playbook for indie/creator/SaaS launches. Hunter outreach (do you need one, how to ask), launch-day timing (00:01 PT), asset kit (gallery images, GIF, maker comment, tagline), upvote etiquette (PH rules), maker-comment template, ship/community/upcoming pages, post-launch follow-up + path to Top 5 of Day. Reads `/project-classify` + GTM docs. Writes `docs/release/product-hunt-launch-<project>.md`. Use when user says "Product Hunt", "PH launch", "hunter", "Top 5 of day", "/product-hunt-launch", or before launching a consumer/indie product.
output_size:
  XS: skip
  S: 1h
  M: 2h
  L: 2h
  XL: skip
---

# /product-hunt-launch — Product Hunt Launch Playbook

Invoke as `/product-hunt-launch`. Run 2–4 weeks before launch day. Re-running on a relaunch is allowed (PH permits relaunch ≥ 6 months after last launch, must be meaningfully new version).

## Why you'd care

A botched PH launch wastes the one hunter relationship you have and the one shot at "Top 5 of Day" momentum. Done with a kit and a maker comment in place, it's a 10k-eyeball traffic event for a Tuesday.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP (no product yet)
   - XL → SKIP (mature companies rarely PH-launch; if they do, it's a category page or a new product spin-out)
2. Read `docs/gtm/positioning-statement-<project>.md` and `docs/gtm/launch-channel-plan-<project>.md` if present.
3. Read `docs/gtm/creator-audience-build-<project>.md` if present — PH leverages existing audience.
4. Check PH account age + karma (older account, light prior engagement reads more authentic to PH community).

## Inputs
- Product name + tagline (60 char max on PH).
- Category fit (PH has Topics — pick 1 primary + 2–3 secondary).
- Launch goal: Top 5 of Day? Top of Week? Featured by mods? Lead capture? Customer count?
- Existing audience size: Twitter/X, email list, Discord, LinkedIn, newsletter.
- Hunter status: hunting yourself (maker-hunt) vs asking an established hunter.
- Free vs paid product; demo URL or sandbox.
- Launch-day team — who's on Slack/Discord live to respond.

## Process
1. **Hunter decision**:
   - **Maker-hunt (most launches now)**: you hunt your own product. PH largely flattened hunter advantage 2020+; maker-hunts can hit #1.
   - **Established hunter**: pick someone with high follower count + relevant audience. Don't cold-DM with "please hunt me" — that's a meme of failure. Build relationship 4–8 weeks prior: comment on their hunts, share their work. Ask 2 weeks out with a 1-paragraph pitch + demo + asset link.
   - **Don't shop hunters** — pick one. PH frowns on shopping.
   - Hunter etiquette: hunter gets first comment, makers respond in thread.
2. **Launch-day pick**:
   - PH day = 12:01 AM PT to 11:59 PM PT (Pacific Time, San Francisco).
   - **Best days**: Tue, Wed, Thu — highest traffic, also highest competition.
   - **Easier days**: Sun, Mon — lower bar to Top 5, but lower ceiling on absolute reach.
   - Avoid: US holidays, OpenAI/Apple/Google major event days (your traffic vanishes).
   - Submit product 24h+ in advance as draft; PH allows scheduling.
3. **Launch-day timing**:
   - Product goes live at 12:01 AM PT. First 4 hours set the ranking trajectory.
   - Your maker comment lands at minute 1.
   - First-hour ping list: closest network (15–30 people who said they'd help) — DM at 12:05 AM PT with direct link.
   - Email blast at 6:00 AM PT (catches East Coast morning + Europe afternoon).
   - Twitter/X thread + LinkedIn at 7:00 AM PT.
   - Mid-day refresh post at 12:00 PM PT.
   - Final push at 6:00 PM PT.
4. **Asset checklist**:
   - **Thumbnail**: 240×240, simple, recognizable at small size. Often a stylized logo or single-character emblem.
   - **Tagline (60 char)**: clear value, no jargon. "X for Y who want Z." pattern works.
   - **Description (260 char)**: expanded value prop. First sentence repeats tagline angle differently.
   - **Gallery (up to 8)**: image or GIF or video. Image 1 = hero shot (full UI screenshot or branded image). Image 2 = GIF (under 3MB, autoplays on PH — high attention).
   - **Maker comment**: see template below.
   - **First commenter** (the hunter) — gets pinned.
   - **Topics**: 1 primary + 2–3 secondary; PH uses these for category leaderboards (Top in Productivity, Top in AI, etc.).
   - **Pricing label**: Free / Freemium / Paid / Subscription — be accurate, mismatches get flagged.
   - **Promo code** (optional but boosts upvotes 10–25%): PH-exclusive code, 20–30% off, expires 7 days.
5. **Maker comment template** (lands at minute 1, pinned):
   - Para 1: Origin story — why you built it (1–3 sentences, human, vulnerable OK).
   - Para 2: What it does + who it's for (2–3 sentences, specific).
   - Para 3: What's free, what's paid, PH-exclusive offer.
   - Para 4: Ask — "I'd love feedback on X. AMA in the comments today." (drives engagement, which drives ranking).
   - Length: 150–250 words. Long enough to be substantive, short enough to read on mobile.
6. **Pre-launch warm-up** (2–4 weeks out):
   - **Upcoming page**: PH lets you create a coming-soon page; followers get notified when you launch. Drive subscribers via email + social CTA "follow me on PH".
   - **Ship page**: stories/updates on the upcoming page — share build logs, screenshots, milestones.
   - Target: 200–500 upcoming-page followers if going for Top 5. (Conversion to launch-day upvote ≈ 20–40%.)
7. **Upvote etiquette (PH rules — don't get torpedoed)**:
   - **Allowed**: telling your network you launched, asking for "support" or "feedback", sharing on social.
   - **Forbidden**: asking explicitly for upvotes ("please upvote my product"). PH detects this and shadow-ranks.
   - **Forbidden**: incentivizing upvotes ("upvote for a discount"). Auto-removal.
   - **Forbidden**: vote-fraud rings, paid upvotes. Account ban + product removal.
   - Safe wording: "We're live on Product Hunt today — would love your feedback / support." Link to the page; let visitors decide.
   - Encourage **comments** more than upvotes — comments weight heavily in PH ranking.
8. **Top 5 of Day reality check**:
   - Top 5 typically requires ~250–500+ upvotes (varies by day; some Tuesdays need 600+). Top 1 of Day often 700–1500 upvotes.
   - Comments matter more than upvotes for ranking velocity in last 6 hours.
   - Maker engagement (replying to every comment) signals to PH algorithm.
   - Mid-day stalls are normal — second wind 4–7 PM PT as West Coast logs on after lunch.
9. **Outbound list build (pre-launch)**:
   - Email subscribers: dedicated "we launch Tuesday" mail T-7 + reminder T-1 + launch-day mail.
   - Twitter/X: pin "launching Tuesday on PH" tweet 1 week out; pin launch-day thread.
   - LinkedIn: post 3 days before + launch day.
   - Indie communities: Indie Hackers, r/SideProject, r/Entrepreneur (read each sub's promo rules — most allow on "Self Promo" days).
   - Discord/Slack communities you're a member of (only where permitted; don't burn).
   - Newsletter swaps: Lenny's, Benn Stancil, Trends.vc, Indie Hackers daily — pitch 4 weeks out, most need long lead.
10. **Launch-day team posture**:
    - 1 maker on PH comments full-time 6 AM – 11 PM PT — reply to every comment within 15 min, with substance.
    - 1 person on Twitter/X replies + retweets.
    - 1 person handles support tickets / signups (expect 10× normal volume).
    - All hands on Slack/Discord war room.
11. **Post-launch follow-up** (PH's tail is the underrated win):
    - Day +1: thank-you post on Twitter/LinkedIn with badge ("we hit #X on Product Hunt yesterday"). Adds social proof.
    - Day +2: email subscribers a recap + asks for testimonials.
    - Week +1: reach out to top commenters for interviews / case studies.
    - Month +1: PH "Featured" badge embed on landing page (PH provides HTML).
    - Tail traffic: PH backlink stays high-DA — sustains SEO trickle for months.
    - If you hit Top 5: pitch press (TechCrunch, The Verge for consumer; Indie Hackers profile, The Pragmatic Engineer for dev tools).
12. **Failure modes — what to do if rank stalls**:
    - Below #10 by hour 3 → push harder on comments (not upvotes); ask makers/customers to share usage stories in thread.
    - Below #15 by hour 6 → accept the day; focus on email capture + community pickup.
    - Don't fake-upvote to recover — auto-detected; humiliation worse than mid-rank.

## Output
Write `docs/release/product-hunt-launch-<project>.md`:

```markdown
# Product Hunt Launch Plan — <project>
**Date:** <YYYY-MM-DD>
**Launch day target:** <Tue YYYY-MM-DD>
**Goal:** Top 5 of Day | Top of Week in <Topic> | 500 signups | $X MRR

## Hunter decision
- ☐ Maker-hunt (I hunt myself)
- ☐ Established hunter — name: <handle> — ask date: T-14 — status: <invited / accepted / declined>

## Tagline + description
- Tagline (60 char): <…>
- Description (260 char): <…>
- Topics: Primary = <…>; Secondary = <…>, <…>, <…>
- Pricing label: Free | Freemium | Paid | Subscription

## Asset kit
| Asset | Status |
|---|:--:|
| Thumbnail 240×240 | ☐ |
| Hero image (1270×760 recommended) | ☐ |
| GIF (auto-play, ≤3MB) | ☐ |
| Gallery images (up to 8) | ☐ |
| Demo video (optional, ≤2 min) | ☐ |
| PH-exclusive promo code | ☐ <CODE-20-OFF> |

## Maker comment (draft)
> <para 1: origin story, 1–3 sentences>
>
> <para 2: what it does + who it's for, 2–3 sentences>
>
> <para 3: free vs paid + PH-exclusive offer>
>
> <para 4: ask — feedback + AMA>

Length: <…> words.

## Pre-launch warm-up (T-14 to T-1)
- ☐ Upcoming page live (date: T-14)
- ☐ Ship updates posted weekly
- ☐ Upcoming-page subscriber target: <300>
- ☐ Email list "we launch Tue" mail (T-7)
- ☐ Twitter/X pinned tweet (T-7)
- ☐ Newsletter swap pitches sent (T-28)
- ☐ Indie Hackers + r/SideProject planned posts drafted
- ☐ Community DMs to close network (T-1, 15–30 people)

## Launch-day timeline (all times Pacific)
| Time | Action | Owner |
|---|---|---|
| 12:01 AM | Product goes live | auto |
| 12:02 AM | Maker comment posted | Maker A |
| 12:05 AM | DM close-network (15 people) | Maker A |
| 6:00 AM | Email blast | Maker B |
| 7:00 AM | Twitter/X thread + LinkedIn post | Maker B |
| 9:00 AM | Indie Hackers post (Self Promo Tuesday) | Maker A |
| 10:00 AM | Reply to all comments — running thread | Maker A |
| 12:00 PM | Mid-day refresh tweet + LinkedIn | Maker B |
| 2:00 PM | Reddit r/SideProject post (if it's allowed-day) | Maker A |
| 4:00 PM | "Currently #X — thanks!" post on socials | Maker B |
| 6:00 PM | Final-push tweet + DM 2nd-ring network | Maker A |
| 9:00 PM | Wind-down; reply remaining comments | Maker A |
| 11:55 PM | Screenshot final rank | Maker B |

## Team roster
- Maker A (PH comments + outreach): <name>
- Maker B (Twitter/X + LinkedIn): <name>
- Support (signups + tickets): <name>
- War-room channel: <#launch-day>

## Upvote-etiquette guardrails
- Wording used: "We're live on PH today — would love your feedback."
- ☐ No "please upvote" anywhere
- ☐ No incentivized upvotes
- ☐ Promo code is for product, not for upvotes

## Target metrics
| Metric | Target |
|---|--:|
| Upvotes by hour 4 | 80+ |
| Upvotes by EOD | 350+ (Top 5 floor) |
| Comments | 50+ |
| PH page visits | 5,000+ |
| Signups | 500+ |
| Email captures | 800+ |
| Twitter follows | 200+ |

## Post-launch follow-up
- Day +1: Twitter thank-you with rank badge
- Day +2: email recap to subscribers + testimonials ask
- Week +1: outreach to top commenters
- Month +1: embed PH "Featured" badge on landing page
- If Top 5: pitch <press list — TechCrunch / The Verge / IH profile>

## Anti-patterns (will tank you)
- "Please upvote" anywhere in copy
- Asking 3 hunters and picking whoever bites
- Launching on Apple/Google event day
- Maker offline during launch day
- Generic maker comment ("Hi PH, check out my new app!")
- Promo code conditional on upvote
- Buying upvotes / vote-ring (account ban)
- Relaunching same product within 6 months
- No GIF in gallery (auto-play GIF is highest-attention slot)
- Maker comment without an ask or AMA

## Risk if skip
- Single-day surge wasted: 70% of PH traffic happens day-of; an unprepared launch peaks at 50–80 upvotes vs 300+ floor for Top 5
- No upcoming-page = no notify-on-launch list (your largest single-day cohort)
- Hunter relationship not built = scramble to maker-hunt with no warm intros
- Bad maker comment = visitors bounce; PH algorithm sees low engagement; ranking dies by hour 3
- No team coverage = comments unanswered; ranking penalized in afternoon

## Relaunch eligibility
- PH allows relaunch if: ≥ 6 months since last launch, materially new version (new core feature, not just bugfixes).
- Plan: <if relaunching, what's new>
```

## Verification
- Hunter decision made (maker-hunt or named hunter with accept).
- Tagline ≤ 60 char; description ≤ 260 char.
- Asset kit complete (thumbnail + hero + GIF minimum).
- Maker comment drafted 150–250 words with origin + value + ask.
- Pre-launch warm-up timeline starts ≥ T-14.
- Launch-day timeline assigns owners per time slot.
- No "please upvote" language anywhere in plan or assets.
- Target metrics set with Top-5 floor at 250–500+ upvotes.
- Post-launch follow-up plan extends ≥ 1 month.
