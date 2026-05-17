---
name: mom-test-protocol
description: Rob Fitzpatrick's Mom Test interview protocol — past behavior, specifics, no pitch. Outputs to `docs/inception/mom-test-<project>.md`. Use when user says "mom test", "customer interview", "user interview", "discovery call", "/mom-test-protocol", or before any customer conversation.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /mom-test-protocol — Mom Test Interview Kit

## Why you'd care

Most founder customer-interviews are pitch sessions disguised as discovery and produce false-positive signal. The Mom Test protocol forces the conversation onto past behavior and specifics — the only honest data source.

Interview without leading. Three rules: talk past, ask specifics, shut up about your idea.

## Pre-flight
None. Pairs with `/customer-interview-script`, `/jtbd`, `/interview-log`.

## Inputs
- Problem hypothesis (one sentence).
- Target persona slug.
- 5-10 interview slots booked.

## Process
1. **Three commandments** — write at top of script:
   - Talk about their life, not your idea.
   - Ask about specifics in the past, not generics or opinions about the future.
   - Talk less, listen more.
2. **Anti-questions** — list 5 leading questions you must NOT ask ("would you use X?", "do you think X is good?", "if we built X...").
3. **Past-behavior probes** — 5-7 open questions ordered worst-to-best problem:
   - "Walk me through the last time you <task>."
   - "What was hardest about that?"
   - "What did you do next? Why that?"
   - "What have you tried to fix it?"
   - "What did you spend on it (time/money)?"
4. **Specificity rescue** — when you get generic, pivot to: "Tell me about the last time that happened."
5. **Commitment & advance ladder** — end-of-interview asks ranked weak→strong: opinion < intro < time < money < waitlist with email < pre-order. Push for the strongest the conversation supports.
6. **Compliment alarm** — flag any "I love it / great idea / I'd totally use that". Re-ask in past-behavior form.
7. **Note template** — capture quotes verbatim, not paraphrase.

## Output
Write `docs/inception/mom-test-<project>.md`:

```markdown
# Mom Test Protocol — <project>
**Date:** <YYYY-MM-DD>

## Hypothesis being tested
<one sentence>

## Three rules (taped to monitor)
1. Their life, not my idea.
2. Specifics in the past, not generics about future.
3. Talk less.

## Anti-questions (DO NOT ASK)
- Would you use ___?
- Do you think ___ is a good idea?
- If we built ___, would you pay?
- (add 2 more)

## Past-behavior script
1. Walk me through the last time you <task>.
2. What was hardest about <thing>?
3. What did you do about it?
4. What have you tried already (tools, hacks, workarounds)?
5. How much time/money did <pain> cost last month?
6. Who else is affected?
7. (optional) Anything I should have asked but didn't?

## Specificity rescue
Generic → "Tell me about the last time that happened."

## Commitment ladder (ask in this order, stop at top YES)
1. Would you take a 30-min follow-up call? (time)
2. Can you intro me to 2 others with this problem? (social capital)
3. Would you join a waitlist with your email? (intent)
4. Would you pre-pay $X to lock first access? (cash)
5. Would you sign LOI for $Y at launch? (commercial)

## Compliment log (red flags)
- (compliments to re-probe)

## Verbatim quote captures
> "..."

## Next
- Run 5-10 interviews → `/interview-log`
- Distill pain frequency + severity → `/pain-severity-rubric`
- If 5+ confirm pain → `/problem-statement-doc`
```

## Verification
- 3 rules listed verbatim.
- 5+ anti-questions listed.
- Script uses past tense, no hypotheticals.
- Commitment ladder ordered weak→strong.
