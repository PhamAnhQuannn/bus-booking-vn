---
name: ideal-customer-profile
description: ICP doc — firmographic + behavioral + technographic profile of the customer who'll buy fastest and stay longest. Outputs to `docs/inception/icp-<project>.md`. Use when user says "ICP", "ideal customer profile", "who's our customer", "/ideal-customer-profile", or before sales outreach or paid ads.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /ideal-customer-profile — The Customer Who'll Pay First, Stay Longest

## Why you'd care

Without a sharp ICP, sales chases everyone and closes the wrong-fit customers who churn fastest and complain loudest — and paid acquisition burns on the wrong audience. The doc forces the filter before money starts flowing out the door.

ICP ≠ persona. ICP describes the company; persona describes the human inside. This skill writes the ICP.

## Pre-flight
None. Pairs with `/buyer-persona-deep`. Run after `/beachhead-segment-pick`.

## Inputs
- Beachhead segment.
- 3-5 best current customers / strongest prospects.

## Process
1. **Reverse-engineer from wins** — list your 3-5 best customers (or design partners). What do they have in common?
2. **Firmographic** — industry, company size (employees / revenue / locations), geography, growth stage.
3. **Behavioral** — what they DO that makes them ideal (e.g., "tracks support tickets in a spreadsheet", "posts on r/devops", "switched CI provider in last 12 months").
4. **Technographic** — what's in their stack (cloud / CI / accounting / CRM) — predicts integration fit.
5. **Trigger event** — what just happened that makes them buy now? (post-incident review, regulatory deadline, leadership change, new funding).
6. **Anti-ICP** — explicit "do NOT sell to" list. Saves time + protects retention metrics.
7. **Disqualification questions** — 3-5 questions to ask in first 5 min of a discovery call.

## Output
Write `docs/inception/icp-<project>.md`:

```markdown
# Ideal Customer Profile — <project>
**Date:** <YYYY-MM-DD>

## Reverse-engineered from
| Customer | Why they're ideal | Common traits |
|----------|-------------------|---------------|
| <name> | High usage, low churn risk | ... |
| <name> | Referenced 3 others | ... |
| <name> | Expanded seats in 90 days | ... |

## Firmographic
- **Industry:** <code / vertical>
- **Size:** <X-Y employees / $X-Y revenue / N locations>
- **Geography:** <regions>
- **Growth stage:** <bootstrap / Series A / public>
- **Funding pattern:** <recently raised / profitable / declining>

## Behavioral
- Current workaround: <e.g., spreadsheet + Slack channel>
- Online presence: <where they hang out — r/X, LinkedIn group, conf>
- Decision speed: <weeks / quarters>
- Champion presence: <single eng-lead / committee>

## Technographic
- CI: <GitHub Actions / CircleCI / Buildkite / ...>
- Cloud: <AWS / GCP / Vercel / ...>
- Comms: <Slack / Teams / Discord>
- Source: <GitHub / GitLab / Bitbucket>

## Trigger events (any one fires interest)
- [ ] Recent incident / outage causing > $X loss
- [ ] Leadership change in last 6 months
- [ ] Just raised / added new team
- [ ] Switching CI / cloud provider
- [ ] Regulatory deadline (<date>)

## Anti-ICP (do NOT pursue)
- Enterprises with HQ-mandated tech stack (procurement-locked)
- Teams < 3 devs (sub-economic)
- Pure agency / contract shops (different problem)
- Single-founder who refuses any SaaS tool

## Disqualification questions
1. "How many devs / repos / deploys per week?"
2. "What CI are you on today?"
3. "Who owns devtool / platform decisions?"
4. "What's your monthly tooling budget?"
5. "Have you tried X / Y / Z before? What happened?"

## ICP score (0-5)
For any prospect, score:
- Firmographic match: __ / 5
- Trigger present: __ / 5
- Tech stack fit: __ / 5
- Champion identified: __ / 5
- **Total: __ / 20** (≥ 14 = ICP, < 10 = disqualify)

## Next
- Buyer detail → `/buyer-persona-deep`
- Sales motion → `/gtm-motion-pick`
- Outreach targets → `/cold-outreach-test`
```

## Verification
- Reverse-engineered from ≥ 3 named wins.
- Firmographic, behavioral, technographic all populated.
- ≥ 3 trigger events listed.
- Anti-ICP explicit.
- Disqualification questions actionable in 5 min call.
