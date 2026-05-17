---
name: reference-call-prep
description: Reference call prep — pick references, brief them, draft talking points, mock-call rehearsal. Outputs to `docs/inception/reference-call-prep-<project>.md`. Use when user says "reference call", "reference check", "customer reference", "back-channel", "/reference-call-prep", or late-stage diligence.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /reference-call-prep — References Lose Deals More Than They Win. Pre-Brief Or Lose.

Investor back-channels = 5-10 unscripted calls with customers, ex-colleagues, advisors. One unprepped reference = "they were okay" = soft no. Pre-brief = "must invest" energy.

## Why you'd care

An unprepped reference call is a coin flip that can sink the round or the deal. Pick references who match the diligence question, brief them on the angle, and you turn a hazard into a closer.

## Pre-flight
Run mid-diligence. Pairs with `/diligence-checklist`, `/investor-update-cadence`.

## Inputs
- Term sheet pending or signed.
- Customer list with NPS / engagement.
- Ex-colleague + advisor list.
- Investor's specific concerns (from meeting notes).

## Process
1. **Pick references** — skew to enthusiastic, not just polite.
2. **Match reference to investor concern** — if investor worried about churn, send happy long-time customer.
3. **Pre-brief each reference** — 15-min call to align talking points.
4. **Brief in writing** — 1-pager summary of co + investor + key messages.
5. **Mock the call** — predict 5 hardest questions, rehearse answers.
6. **Follow up after** — thank you + ask what was asked.
7. **Loop back to investor** — proactively address anything weak.

## Output
Write `docs/inception/reference-call-prep-<project>.md`:

```markdown
# Reference Call Prep — <project>
**Investor:** <firm + partner>
**Calls expected:** 5-10
**Diligence window:** <dates>

## Reference categories
| Category | Count | Purpose |
|----------|-------|---------|
| Customer (power user) | 3-5 | Validate value + retention |
| Customer (recent buyer) | 1-2 | Validate sales motion |
| Customer (churned, friendly) | 0-1 | Show honesty (optional) |
| Ex-colleague (co-founder / direct report / boss) | 2-3 | Validate founder character |
| Advisor / investor | 1-2 | Validate strategy |
| Domain expert | 0-1 | Validate market thesis |

Total: 7-12 ready references.

## Reference selection criteria
**Customers — pick for:**
- Active user (login last 30 days)
- ARR > 1x ACV (real spend)
- Multiple seats / locations / use cases
- Already gave NPS 9-10
- Articulate (writes good emails, speaks well)

**Ex-colleagues — pick for:**
- Recent (worked with you last 5 years)
- Senior enough to be credible
- Will return investor's call within 24 hr
- Already endorsed you publicly (LinkedIn, intro)

**Avoid for references:**
- Friends, family, anyone with personal bias
- Customers who haven't logged in in 60 days
- Anyone you haven't spoken to in 12+ months
- People with pending dispute / unhappy renewal

## Per-reference brief sheet
For each reference, prep a 1-pager:

```
# Reference brief: <name>

## Who
<Name>, <Title> at <Company>. <How they know me>.

## Why they're a strong reference
- <Specific value they got>
- <Specific story they can tell>
- <Their NPS / quote / outcome>

## Investor context
- <Investor name> at <Firm>
- Considering investing $<amount> at <stage>
- Their main concerns: <list 1-3>

## Talking points (what would be ideal to mention)
- <product impact + specific number>
- <onboarding / support experience>
- <founder qualities they observed>
- <story they can tell — keep it concrete>

## What NOT to share
- Specific contract terms
- Internal politics
- Anything under NDA

## Tone
- Honest, not promotional
- Concrete > abstract ("saved 12 hrs/week" > "saved time")
- If asked about weaknesses: <pre-aligned honest answer>

## Logistics
- Investor will reach out via email
- Expected: 20-30 min call
- Available windows: <dates/times>

Thank you for doing this.
```

## Investor-question prediction (per reference type)

### Customer references — likely asked
| Q | Strong answer pattern |
|---|----------------------|
| How did you find them? | "Outbound by <founder>, came in via <channel>" |
| What problem did you have before? | <specific cost / pain> |
| What changed after? | <specific outcome + number> |
| Would you switch back? | "No, because <specific lock-in>" |
| What do they suck at? | <minor, honest, fixable> |
| Would you increase spend? | <yes + reason> |
| Have you told peers? | <yes + names> |
| How does sales/support feel? | <positive specifics> |

### Ex-colleague references — likely asked
| Q | Strong answer pattern |
|---|----------------------|
| How long did you work with <founder>? | <duration + role> |
| In what capacity? | <reporting + project> |
| What's their superpower? | <specific trait + example> |
| Where do they need to grow? | <honest, framed as growth> |
| Hire them again? | "Yes, today" |
| Would you invest? | "I have" / "I would if I had capital" |
| Recall a hard moment — what'd they do? | <story> |

## Pre-call rehearsal protocol
For each reference, 15-min call:
1. **2 min:** Investor context + why this reference
2. **5 min:** Walk through brief sheet
3. **5 min:** Mock 3 hardest questions
4. **3 min:** Logistics + thank you

Do NOT script word-by-word. Reference must sound natural.

## Hostile-question handling
Investor may probe weakness. Pre-aligned honest answer pattern:
- "What frustrates you about working with them?" → "<minor honest thing + fix>"
- "What would make you churn?" → "<concrete competitive threat + low probability>"
- "Is there anything they're hiding?" → "<no, they're transparent — they told us about X>"

If reference doesn't know the honest answer, they fabricate or freeze. Both lose the deal.

## Post-call follow-up
Within 24 hr of each reference call:
- [ ] Text reference: "How'd it go? What'd they ask?"
- [ ] Log topics asked
- [ ] If a weak answer surfaced → proactively address with investor next touch
- [ ] Send reference a thank-you (handwritten if VIP)
- [ ] Pay it forward later

## Tracking sheet
| Reference | Type | Investor asked? | Asked yet? | Call done? | Notes |
|-----------|------|----------------|-----------|-----------|-------|
| <C name> | Customer | yes 2026-05-10 | yes 2026-05-11 | 2026-05-13 | Strong; asked about churn |
| <X name> | Ex-boss | yes 2026-05-10 | yes 2026-05-11 | 2026-05-12 | Strong; asked about co-founder split |

## Back-channel detection
Investors WILL call references you didn't list. Common back-channel sources:
- LinkedIn 2nd-degree (ex-coworkers you didn't list)
- Customers found via your website / Twitter
- Competitors' POV calls
- Industry analysts

Preempt: tell investor "Happy for you to talk to anyone. Here are names; call others too."

## Pitfalls flagged
- [ ] 7-12 references ready
- [ ] Each matched to investor concern
- [ ] 1-pager brief per reference
- [ ] Mock-call rehearsed
- [ ] Hostile Qs pre-aligned
- [ ] Tracking sheet live
- [ ] Back-channel acknowledged

## Anti-patterns
- ❌ Sending references unprepped
- ❌ Only happy references (looks fake)
- ❌ Friends as references
- ❌ Inactive customers as references
- ❌ Scripting word-by-word (sounds rehearsed)
- ❌ Not following up after the call
- ❌ Hiding back-channels (investor will find anyway)

## Next
- Diligence checklist → `/diligence-checklist`
- Term sheet review → `/term-sheet-literacy`
- Update cadence → `/investor-update-cadence`
```

## Verification
- 7-12 references picked by category.
- Selection criteria applied.
- Per-reference brief sheet.
- Mock-call protocol.
- Hostile-Q answers pre-aligned.
- Back-channel proactively acknowledged.
