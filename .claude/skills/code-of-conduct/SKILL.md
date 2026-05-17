---
name: code-of-conduct
description: Code of conduct — expected behavior, prohibited conduct, reporting, enforcement ladder, scope (internal + community). Outputs to `docs/inception/code-of-conduct-<project>.md`. Use when user says "code of conduct", "CoC", "community guidelines", "harassment policy", "/code-of-conduct", or before first hire / public community launch.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /code-of-conduct — Bad Behavior Costs You The Best Hire. Write It Down Before The Incident.

## Why you'd care

The first harassment or hostile-behavior incident costs you a hire, a customer, or a Twitter thread — and writing the policy under pressure looks exactly like the cover-up it usually isn't. Pre-incident clarity is what makes the enforcement defensible when the moment comes.

CoC ≠ legal CYA. CoC = the line you draw before an incident forces you to draw it under pressure. Pre-incident clarity beats post-incident scrambling every time.

## Pre-flight
Run before first hire OR before opening a public community. Pairs with `/values-charter`, `/employee-handbook-skeleton`.

## Inputs
- Team headcount + remote/local split.
- Community surfaces (Discord / Slack community / GitHub / Forum).
- Industry norms (e.g. OSS = Contributor Covenant baseline).
- Jurisdiction (employment law floor).

## Process
1. **Define scope** — internal team only / community only / both.
2. **List expected behavior** (positive frame).
3. **List prohibited behavior** (explicit, not vague).
4. **Set reporting channels** — multiple, at least 1 anonymous.
5. **Define enforcement ladder** — warning → suspension → termination.
6. **Name CoC owner + investigator** — not the alleged offender's manager.
7. **Publish + require sign-on** at hire / community join.

## Output
Write `docs/inception/code-of-conduct-<project>.md`:

```markdown
# Code of Conduct — <project>
**Scope:** <internal team / community / both>
**Owner:** <CEO / Head of People / Founder>
**Effective date:** <YYYY-MM-DD>
**Version:** 1.0

## Why we have this
- Set a clear line before incidents force ad-hoc decisions
- Protect people who report from retaliation
- Make expected behavior explicit, not implicit

## Scope
Applies to:
- Internal: all employees, contractors, board, advisors
- External: customer interactions, community channels, conferences, online presence representing the co
- Off-hours: if it affects the co or another member

Does NOT apply to:
- Purely personal life unconnected to the co
- Legal disputes (those go through counsel, not CoC)

## Expected behavior
- Be respectful, even in disagreement
- Assume good intent, ask before accusing
- Credit others' work; don't take credit for theirs
- Speak up when you see harm
- Honor commitments or renegotiate early
- Welcome new members + perspectives
- Keep confidential info confidential

## Prohibited behavior
**Harassment:**
- Unwelcome sexual attention or advances
- Comments on appearance, body, personal life
- Slurs / insults based on protected class (race, gender, sex orientation, religion, age, disability, national origin)
- Deliberate misgendering / dead-naming
- Sustained disruption of meetings / channels

**Discrimination:**
- Adverse treatment based on protected class
- Exclusion from opportunities

**Threats + violence:**
- Threats of physical harm
- Stalking / following
- Doxxing (sharing someone's private info)

**Abuse of power:**
- Retaliation for reporting a CoC violation
- Quid pro quo (favors for compliance)
- Using authority to silence dissent

**Other:**
- Intoxication that endangers others
- Theft, fraud, falsification of records
- Violation of confidentiality / IP / customer data

## Reporting
Multiple channels — pick whichever feels safe:
| Channel | When to use |
|---------|-------------|
| Email: conduct@<co>.com | Default reporting |
| Direct to CEO | When the issue is below CEO level |
| Direct to board (independent director) | When CEO is involved |
| External: <ombuds firm / EthicsPoint> | Anonymous reporting |
| Local HR (if outsourced) | For employment law issues |

Anonymous reporting available via <vendor>. We treat all reports seriously, but anonymous reports limit our ability to follow up.

## What happens after a report
1. Acknowledge receipt within 24 hr
2. Assign investigator (NOT the alleged offender's manager)
3. Interview reporter, alleged, witnesses (within 7 days)
4. Document findings
5. Decide outcome (within 14 days of report)
6. Communicate outcome to reporter (within ability to share)
7. Implement enforcement

Investigator picks:
- Internal: Head of People (if hired)
- External: employment lawyer or HR consultant (default for small co)
- Board independent director (if CEO involved)

## Enforcement ladder
| Severity | Action |
|----------|--------|
| Minor / first offense | Private verbal warning + documented |
| Repeat minor / single moderate | Written warning + improvement plan |
| Serious | Suspension (paid pending investigation) |
| Severe / repeated | Termination |
| Criminal | Termination + law enforcement referral |

**Severe = automatic termination:**
- Physical violence
- Sexual harassment with evidence
- Theft / fraud
- Doxxing
- Retaliation against a reporter

Enforcement decided by: CoC owner + 1 other independent (legal counsel or board).

## Anti-retaliation
- No adverse action against reporters or witnesses
- Retaliation = severe violation → termination
- 90-day check-in with reporter after report

## Confidentiality
- Reporter identity held confidential to extent possible
- Investigation details on need-to-know
- Outcome may be shared in aggregate (e.g. "X took action on a CoC report this quarter")
- Some disclosure required by law (subpoena, regulators)

## False reports
Knowingly false reports = CoC violation. Mistaken reports made in good faith ≠ violation.

## Community-specific (if applicable)
| Rule | What |
|------|------|
| No spam | Don't promo product / service without disclosure |
| No NSFW | Family-friendly channel |
| No politics off-topic | Stay on product / domain |
| Use the right channel | Help in #help, off-topic in #off-topic |
| Mod authority | Mods can warn, mute, ban without appeal in real-time |
| Appeals | Email community@<co>.com within 7 days |

## OSS / Contributor variant
Base: Contributor Covenant 2.1 (https://www.contributor-covenant.org/)
Enforcement: <maintainer team / email>
Add: this CoC also applies on Discord, Twitter, conferences when representing the project.

## Sign-on
Every new hire signs CoC ack at offer signing. Community members ack via:
- Discord: bot-gated /agree
- Forum: registration checkbox
- GitHub: PR template line

## Annual review
Year-end: CoC owner reviews
- Reports filed (count, type, outcome)
- Trends (recurring issues)
- Updates needed for new surfaces / law

Publish anonymized stats annually for trust.

## Template sources (don't reinvent)
- Contributor Covenant (OSS standard)
- TODO Group sample
- GitHub Community guidelines
- Y Combinator handbook section

## Pitfalls flagged
- [ ] Scope defined (internal / community / both)
- [ ] Expected behavior + prohibited behavior listed
- [ ] Multiple reporting channels including anonymous
- [ ] Investigator ≠ alleged offender's manager
- [ ] Enforcement ladder published
- [ ] Anti-retaliation clause
- [ ] Annual review scheduled

## Anti-patterns
- ❌ Vague "be respectful" with no specifics
- ❌ Single reporting channel = CEO
- ❌ No anonymous option
- ❌ CoC owner = the most senior alleged offender
- ❌ "We've never had an incident" → not having a CoC
- ❌ Enforcement lottery (same offense, different outcomes)
- ❌ Retaliation against reporters

## Next
- Values → `/values-charter`
- Employee handbook → `/employee-handbook-skeleton`
- Reporting infra → ombuds vendor pick
```

## Verification
- Scope defined.
- Expected + prohibited behavior listed.
- Reporting channels including anonymous.
- Enforcement ladder.
- Anti-retaliation clause.
- Investigator independence.
- Annual review.
