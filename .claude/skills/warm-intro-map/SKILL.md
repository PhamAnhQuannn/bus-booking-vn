---
name: warm-intro-map
description: Warm intro map — map mutual connections to target investors, score intro strength, draft forwardable blurbs. Outputs to `docs/inception/warm-intro-map-<project>.md`. Use when user says "warm intros", "intro path", "double-opt-in", "/warm-intro-map", or pre-raise.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /warm-intro-map — Cold Email = 5% Reply. Warm Intro = 60%.

Every target investor needs warm path before email. Map mutuals, rank intro strength, send forwardable blurb.

## Why you'd care

Cold outreach to investors converts in the single digits; warm intros convert in the double digits. Mapping mutuals and drafting forwardable blurbs is the highest-leverage hour of any pre-raise.

## Pre-flight
Run after `/investor-target-list`. Pairs with `/investor-crm-setup`.

## Inputs
- Tier 1 + Tier 2 investor list (~80 names).
- LinkedIn 1st + 2nd degree.
- Founder + advisor networks.
- Past customers / users with VC connections.

## Process
1. **List mutuals per target** — LinkedIn 2nd-deg, Twitter follows, alumni networks.
2. **Score intro strength:**
   - A — close relationship + recent contact, known to investor as credible
   - B — known to both, neutral relationship
   - C — barely knows one side
   - D — random mutual, not useful
3. **Pick A/B only** — C/D = cold path, skip.
4. **Draft forwardable blurb** — 3 sentences max + deck link.
5. **Double-opt-in** — ask mutual if comfortable forwarding, never ambush.
6. **Track:** sent date, response, meeting set.
7. **Reciprocate** — offer help back to every introducer.

## Output
Write `docs/inception/warm-intro-map-<project>.md`:

```markdown
# Warm Intro Map — <project>
**Target investors to warm-path:** 80 (T1 + T2)
**Warm paths identified:** TBD / 80

## Intro strength scoring
| Grade | Definition | Use? |
|-------|-----------|------|
| A | Mutual is close + credible to investor + replies fast | Yes — first wave |
| B | Mutual knows both, neutral | Yes — second wave |
| C | Mutual barely knows one side | Skip — go cold |
| D | LinkedIn-only, no real relationship | Skip |

## Mutual-connector inventory
| Connector | Relationship to us | Investors they can intro to | Strength |
|-----------|-------------------|----------------------------|----------|
| Bob (advisor) | Advisor since 2024 | Acme Ventures, BetaCap | A |
| Sara (ex-boss) | Worked together 3 yrs | Charlie Capital | A |
| Tom (peer founder) | Co-batch YC | Foo Fund, Bar VC | B |
| Maria (customer) | Power user, design partner | Delta Partners | B |

## Per-target intro path
| Investor | Connector | Strength | Asked? | Sent? | Meeting? |
|----------|-----------|---------|--------|-------|---------|
| Jane Smith @ Acme | Bob | A | 2026-05-08 | 2026-05-09 | 2026-05-15 |
| John Doe @ BetaCap | Bob | A | 2026-05-08 | pending | — |
| A Lee @ Charlie | Sara | A | pending | — | — |

## Forwardable blurb template
Send TO connector, not investor:

> "Hi <connector>,
>
> Quick ask — would you be open to introducing me to <investor name>?
>
> Context: We're <co name>, <1-line description>. <1-line traction>. Raising <round size>. <Why this investor specifically — 1 line>.
>
> Forwardable blurb below (no need to write anything yourself, just hit forward if comfortable):
>
> ---
>
> Subject: Intro — <co> / <investor>
>
> <Investor first name> — meet <founder name>, building <co>. They <product in 1 line>. <Traction in 1 line: revenue / customers / growth>. They're raising <round> and <why this investor> — thought you two should connect. Deck: <Docsend link>.
>
> <connector>"

## Double-opt-in protocol
1. Connector asks investor: "Would you be open to a 20-min intro call with <founder>?"
2. Investor says yes → connector forwards blurb
3. Investor says no / no reply 1 week → skip, no awkwardness

Don't let connector send cold. Always opt-in first.

## Reciprocity ledger
Every intro = a favor. Track what you owe back:
| Connector | Favor owed |
|-----------|-----------|
| Bob | Intro his portfolio co to our customer Sarah |
| Sara | Refer her hiring to my network |
| Tom | Trade investor notes post-raise |

## When no warm path
- Try Twitter DM with substance (response to specific tweet, not pitch)
- LinkedIn note via Premium (mention mutual or shared school)
- Conference hallway (always best)
- Cold email last resort — keep to 4 sentences, no deck attached

## Pitfalls flagged
- [ ] No C/D intros sent
- [ ] Double-opt-in respected
- [ ] Forwardable blurb < 100 words
- [ ] Reciprocity tracked
- [ ] No same connector hit twice in same week
- [ ] Tier 1 80%+ has warm path

## Anti-patterns
- ❌ Asking mutual to "send my deck around"
- ❌ Skipping double-opt-in
- ❌ Same blurb for every investor
- ❌ Forgetting to update connector after meeting
- ❌ Overusing one connector
- ❌ Pitching the connector (they're not the investor)

## Next
- CRM setup → `/investor-crm-setup`
- Update cadence → `/investor-update-cadence`
- Diligence prep → `/diligence-checklist`
```

## Verification
- A/B-graded intro paths only.
- Double-opt-in protocol defined.
- Forwardable blurb template.
- Reciprocity ledger.
- Cold-fallback path documented.
