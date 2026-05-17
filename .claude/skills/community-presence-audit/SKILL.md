---
name: community-presence-audit
description: Audit which communities (Reddit/Discord/Slack/forums) host your buyers + rules of engagement. Outputs to `docs/inception/community-audit-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "communities", "Reddit", "Discord", "/community-presence-audit", or before community-led growth.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /community-presence-audit — Where Buyers Hang

## Why you'd care

Pasting your launch link in random subreddits gets you banned, not customers. Auditing where buyers actually hang and learning the etiquette per venue is what turns community-led growth into pipeline instead of a spam complaint.

Invoke as `/community-presence-audit`. Find them. Don't spam.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP
2. Read `docs/inception/buyer-persona-<project>.md`.

## Inputs
- Buyer persona job title + interests + tools used.
- Geographies served.

## Process
1. **List 10–20 communities** by platform:
   - Reddit subs (size, activity, mod-friendliness)
   - Discord servers (invite link, member count)
   - Slack workspaces (community-led, e.g. RevGenius, Demand Curve)
   - Indie Hackers / Hacker News / Lobsters / dev.to
   - LinkedIn Groups
   - Industry forums + niche subreddits
   - Facebook Groups (if persona ≥35 yo)
2. **Per community profile**:
   - Member count + DAU
   - Promotion rules (strict/lenient/banned)
   - Top 5 recent threads (proof topic relevance)
   - Founder/mod accessible?
3. **Engagement plan per community** — value-first posts, never link-drop:
   - Answer 5 questions before posting your own
   - Only share product if asked or rule-allowed
4. **Anti-pattern alarm** — spam = banned IP. Treat as long-term reputation play.

## Output
Write `docs/inception/community-audit-<project>.md`:

```markdown
# Community Audit — <project>
**Date:** <YYYY-MM-DD>

## Top communities (ranked by buyer density × access)
| Community | Platform | Members | Promotion rule | Buyer density | Plan |
|---|---|--:|---|---|---|
| r/<sub> | Reddit | 250k | self-promo Sat only | high | weekly value posts |
| <name> Discord | Discord | 8k | DM only after 30d | very high | active in #help |
| <name> Slack | Slack | 12k | #showcase channel | med | Q1 launch post |
| Indie Hackers | IH | 200k | open | med | weekly milestone |

## Per-community engagement plan
### r/<sub>
- Value posts: 1/wk on <topic>
- Comment depth: ≥5/wk
- Self-promo: Sat thread, 1/mo max
- Mod relationship: DM first

## Founder-as-creator presence
- Twitter: <handle>, <followers>
- LinkedIn: <handle>, <connections>
- Audience build target: 1k followers in 90 days

## Anti-patterns (avoid)
- Link-drop without context
- Sock-puppet upvoting
- Comment-section spam
- DM blast on LinkedIn (gets reported fast)

## Verdict
**HIGH-FIT (3+ buyer-dense communities) / MED / LOW (no native communities)**
```

## Verification
- ≥10 communities audited.
- Per-community promotion rule pulled from sidebar/about.
- Engagement plan = value-first, no spam.
- Founder-presence baseline measured.
