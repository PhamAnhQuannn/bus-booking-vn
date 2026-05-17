---
name: viral-coefficient-model
description: Model viral coefficient (K-factor), cycle time, payload mechanics — pinpoint the viral lever that actually matters. Outputs to `docs/inception/viral-coefficient-<project>.md`. Use when user says "viral", "K-factor", "referral coefficient", "invite mechanic", "/viral-coefficient-model", or before designing referral or share features.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /viral-coefficient-model — Most "Viral" Products Aren't. Run The Math.

K-factor < 1 = exponential decay. K-factor > 1 = exponential growth (rare). Cycle time is the often-ignored multiplier. Model both.

## Why you'd care

A referral feature designed without modeling K-factor and cycle time is a feature you won't know is broken. The math tells you whether the loop is actually amplifying or just churning users through invitations.

## Pre-flight
Run after `/gtm-motion-pick`. Pairs with `/community-building-plan`, `/launch-channel-plan`.

## Inputs
- Product type (does sharing/inviting create value for sender or receiver?).
- Current invite rate (if any).
- Acceptance rate (if any).
- Cycle time estimate (days from signup → invite sent → receiver signup).
- Channels available for invite (email, share link, embed, etc).

## Process
1. **Define K-factor:** K = (avg invites sent per user) × (acceptance rate)
   - K < 1 → decay, supplement with paid/content/sales
   - K = 1 → linear, replacement
   - K > 1 → viral growth (rare, e.g., Hotmail, Dropbox)
2. **Define cycle time (T):** average days from signup → new user from that signup
   - Slack: ~3-5 days (workspace invites)
   - Hotmail: ~7-14 days (one signature per email read)
   - WhatsApp: < 1 day (group invite)
3. **Growth model:** Users(t) = Users(0) × K^(t/T)
4. **Mechanism types:**
   - **Word-of-mouth** — passive, low K
   - **Incentivized referral** — Dropbox 2-sided incentive
   - **Network-required** — Slack workspaces, Figma files, Notion docs
   - **Forced share** — Hotmail signature, Calendly link, "Sent from Superhuman"
   - **Public artifact** — Loom video, Linktree page, Substack post
5. **Honest assessment:** most products K = 0.05-0.2. Don't lie to yourself.
6. **Lever pick** — focus on the ONE viral mechanism that matches product:
   - SaaS doc tool → public artifact share
   - Communication tool → invite required to use
   - Consumer app → referral incentive
   - Creator tool → "made with" badge on output
7. **Cycle time levers** — onboarding cuts T; reducing time-to-aha cuts T.
8. **Don't ship referral programs as primary engine if K < 0.3** — won't compound.

## Output
Write `docs/inception/viral-coefficient-<project>.md`:

```markdown
# Viral Coefficient Model — <project>
**Date:** <YYYY-MM-DD>
**Product:** <e.g., async standup tool>

## Current state (honest)
| Metric | Value | Source |
|--------|-------|--------|
| Avg invites sent per signup | 0.3 | Mixpanel events |
| Acceptance rate (invite → signup) | 35% | Mixpanel |
| **K-factor** | **0.105** | computed |
| Cycle time (T) | ~14 days | cohort analysis |

**Verdict:** Viral as primary engine = no. Supplement only.

## Where users naturally share
| Touchpoint | Mechanism | Current K contribution |
|------------|-----------|------------------------|
| Standup link share | Public artifact | 0.05 |
| "Invite team" CTA | Network-required | 0.04 |
| End-of-meeting share | Public artifact | 0.01 |
| Calendar event signature | Forced share | 0 (not built) |

## Lever pick
**Strongest current:** Public standup link share
**Why:** receivers see actual product value before signing up
**Target lift:** K from 0.05 → 0.15 by making standup link richer + adding "Made with [tool]" footer

## Mechanism design
- Footer on every shared standup: "Sent via [tool] — try free →"
- Include 1 sample standup from sender as preview (with permission)
- Cycle time cut: from 14d → 7d via faster onboarding (skip workspace setup until 2nd standup)

## Projected K trajectory
| Quarter | K | Note |
|---------|---|------|
| Q1 (now) | 0.10 | baseline |
| Q2 (after public artifact upgrade) | 0.18 | adds footer + preview |
| Q3 (after onboarding cut) | 0.22 | T from 14d → 7d |
| Q4 (after workspace invite improvement) | 0.30 | still sub-viral |

**Conclusion:** K never crosses 1. Supplement with paid + content + outbound.

## What we won't do
- ❌ Incentivized referral ($X for inviting) — incentive ≠ product fit
- ❌ Forced share with manipulative copy — kills trust
- ❌ Email-scraping invite flow (LinkedIn-style) — illegal/sleazy
- ❌ Build a "share to unlock" gate — users hate it

## Pitfalls flagged
- [ ] K-factor computed from real data (not guessed)
- [ ] Cycle time included in model
- [ ] Honest verdict: K < 1 means viral is not primary engine
- [ ] One lever picked (not all five)
- [ ] Dark-pattern share mechanics rejected
- [ ] Supplement channels named when K < 1

## Next
- Paid acquisition complement → `/paid-channel-plan`
- Content complement → `/content-engine-plan`
- Community complement → `/community-building-plan`
- Refine mechanism → `/share-mechanic-design`
```

## Verification
- K-factor computed from actual or honest estimate.
- Cycle time included.
- Mechanism type identified (not just "viral marketing").
- Honest verdict if K < 1.
- One concrete lever picked, not a wishlist.
- Dark patterns explicitly rejected.
