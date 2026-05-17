---
name: yc-application-draft
description: Draft YC application answers — terse, concrete, no fluff. Maps every question to YC's actual rubric (founders, product, market, traction, vision). Outputs to `docs/inception/yc-application-<project>.md`. Use when user says "YC application", "Y Combinator", "YC apply", "/yc-application-draft", or pre-batch deadline.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /yc-application-draft — YC Reads 10,000. Yours Has 90 Seconds.

YC's form rewards specificity. Vague + grandiose = pass. Concrete + small + weird = read further.

## Why you'd care

YC's question rubric punishes fluff and rewards specificity — the application is itself a pitch test. Drafting against the actual rubric is what gets you the interview instead of the rejection.

## Pre-flight
Run after `/elevator-pitch`, `/north-star-metric-pick`. Pairs with `/sequoia-deck-skeleton`, `/founding-story-narrative`.

## Inputs
- Founder bios (no resumes, just relevance).
- Product 1-liner + URL.
- Traction (numbers).
- Origin story.
- Why this team, why now.

## Process
1. **Plain English.** No buzzwords ("revolutionary AI-powered platform"). Just nouns + verbs.
2. **Answer the question asked.** YC questions are surgical. Drift = signal you don't know your business.
3. **Numbers > narrative.** "$8k MRR" beats "growing fast".
4. **Show, don't tell.** Demo video > description. Live URL > screenshot.
5. **Quirky is OK.** "Why is your team well-suited" — answer like a human, not a press release.
6. **What we'd do with $500k** — concrete hires + milestones, not "extend runway".
7. **Founder video** — 1 min, talk like a person, show your face.
8. **Edit ruthlessly** — cut by 30% on second pass.

## Output
Write `docs/inception/yc-application-<project>.md`:

```markdown
# YC Application Draft — <project>
**Batch:** YC <S/W><YY>
**Submitted by:** <date>

## 1. Company name
<Name>

## 2. Company URL
<https://...>

## 3. Describe what your company does in 50 chars or less
<X for Y who Z.> — 50 char max, force concise.
Example: "Returns automation for SMB ecom ops teams"

## 4. Describe what your company does in more detail (≤ 250 chars)
<2-3 sentences. Plain English. Who you serve + what changes for them.>

## 5. URL of your product (or demo video)
- Product: <URL>
- 1-min demo video: <URL>

## 6. Where will the company be based?
<City, Country>

## 7. Founders — names, ages, % equity, technical?
| Name | Age | % | Technical? | LinkedIn |
|------|-----|---|------------|----------|
| <A> | <31> | <50> | Yes | <url> |
| <B> | <33> | <50> | Yes | <url> |

## 8. How long have the founders known each other and how did you meet?
<Honest. "3 years, met at <company>" beats "we're best friends". If recent: explain why working together anyway.>

## 9. Have any of the founders had children or other dependents?
<Honest yes/no.>

## 10. How do you all know each other?
<Same as #8 — expanded to project history>

## 11. How long have each of the founders been working on this?
<Specific dates. "Founder A: 6 months full-time, Founder B: 6 months full-time".>

## 12. How far along are you?
<Concrete. "<X> paying customers, $<Y> MRR, growing <Z>% MoM. Built MVP in 8 weeks.">

## 13. How long have each of you been working on this?
<Same as #11, can collapse>

## 14. Are you incorporated? Where?
<Delaware C-Corp / not yet. If not: when planning>

## 15. If you've already started working on it, how long have you been working?
<Repeat with start date specifics>

## 16. Are any of the founders covered by a non-compete or IP assignment from a prior employer?
<Honest. Yes/no + if yes how resolved.>

## 17. What is your company going to make? (≤ 600 chars)
<2-3 sentence product. Skip pitch-deck speak. Be concrete: "We let X do Y so they can Z." Add 1 sentence on technical approach.>

## 18. Why did you pick this idea? Do you have domain expertise? How do you know people need what you're making?
<3 parts: (1) origin story — specific moment, (2) domain expertise — what you know that others don't, (3) evidence of need — interviews count, intuition doesn't.>

Example:
> "Founder A spent 4 years at <ecom company> watching ops teams manually process 500 returns/day. Built script that automated 80%. When we left and called 20 SMB founders, 18 said 'where do I sign?'"

## 19. Who are your competitors? What do you understand about your business that they don't?
<Name 3 real competitors. State honest 1-line on what they do. Then 1 sentence on your insight they're missing. Insight should be non-obvious + falsifiable.>

## 20. How do or will you make money? How much could you make?
<Pricing model + ACV + 5-yr revenue plausibility>

## 21. Which of the founders write code?
<Both / one + which / none>

## 22. Have you applied to YC before?
<Yes (dates + outcome) / No. If yes: what changed since.>

## 23. If you have a demo, what is the URL?
<URL — should be live not Loom>

## 24. Anything else we should know about your company, plans, or competition?
<Use this. Mention your weirdest most-true insight. The thing that wouldn't fit elsewhere.>

## Founder video (1 min)
**Script structure:**
- (0-10s) Hi we're <A> and <B>, we make <X>
- (10-30s) Why: founder story / specific pain point
- (30-50s) Traction: <numbers>
- (50-60s) What YC unlocks

Don't read off script. Be a person.

## Pre-submit checklist
- [ ] Every answer specific (no "various" / "many" / "leading")
- [ ] No buzzwords (AI-powered, revolutionary, platform, ecosystem)
- [ ] Traction numbers with dates
- [ ] Competition slide named + honest
- [ ] Live product URL (not video-only)
- [ ] 1-min video uploaded
- [ ] Founder bios — relevance not resume
- [ ] All co-founders read + signed off

## Anti-patterns
- ❌ "We're the only ones doing X" (you're not, you haven't looked hard enough)
- ❌ "Massive $X bn market" (top-down)
- ❌ "Disrupting <industry>" (cliché → trash)
- ❌ Future-tense everything ("we will, we plan, we intend")

## Pitfalls flagged
- [ ] Specific numbers + dates per claim
- [ ] Origin story has a specific moment
- [ ] Competition named honestly
- [ ] Demo is live, not slides
- [ ] Video shows founders, not just product
- [ ] Edited by 30% after first draft

## Next
- Demo day script if accepted → `/demo-day-script`
- Founders agreement → `/founders-agreement`
- Deck for next round → `/sequoia-deck-skeleton`
```

## Verification
- All 23-ish YC questions answered.
- Specific numbers + dates throughout.
- No buzzwords.
- Live product URL.
- Founder video script outlined.
- Edited down by 30%+.
