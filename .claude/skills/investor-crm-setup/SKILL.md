---
name: investor-crm-setup
description: Investor CRM — pipeline stages, contact log, follow-up cadence. Outputs to `docs/inception/investor-crm-setup-<project>.md`. Use when user says "investor CRM", "fundraise pipeline", "investor tracker", "/investor-crm-setup", or pre-raise / mid-raise.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /investor-crm-setup — A Raise Is A Sales Funnel. Run It Like One.

## Why you'd care

Raises break down when founders lose track of who said what when, miss follow-ups by a week, and stale-out warm intros. A simple CRM with pipeline stages prevents the avoidable drop-offs.

Fundraising = managing 50-100 conversations across 4-8 weeks. Without CRM = forget who you talked to, miss follow-ups, deal dies.

## Pre-flight
Run after `/investor-target-list`. Pairs with `/warm-intro-map`, `/investor-update-cadence`.

## Inputs
- Target investor list (100-200 names).
- Round size + cap.
- Lead status.

## Process
1. **Pick tool:** Airtable / Notion / Streak (Gmail) / Affinity (paid). Solo founder: Airtable + Streak.
2. **Pipeline stages** — be ruthless about advancing/killing.
3. **Contact log per investor** — every email, call, meeting.
4. **Follow-up cadence** — 7 days, 14 days, 30 days.
5. **Score investors** — fit × signal strength.
6. **Track via funnel** — conversion rates per stage.

## Output
Write `docs/inception/investor-crm-setup-<project>.md`:

```markdown
# Investor CRM — <project>
**Tool:** Airtable / Notion / Streak
**Round:** $1.5M seed @ $12M cap
**Status:** <date> · X committed of $1.5M

## Pipeline stages (left → right)
1. **Sourced** — name in list, not contacted
2. **Intro-needed** — warm intro path identified, not requested
3. **Intro-sent** — intro requested from mutual
4. **Initial meeting scheduled** — calendar held
5. **Initial meeting done** — pitched, awaiting follow-up
6. **Follow-up / diligence** — sent materials, in due diligence
7. **Partner meeting** — escalated internally
8. **Term sheet** — verbal or written offer
9. **Closing** — signing docs
10. **Closed** — wired
11. **Pass** — declined (note why)

## Columns (per investor row)
| Field | Type | Notes |
|-------|------|-------|
| Name | text | First Last |
| Firm | text | |
| Title | text | Partner / Principal / Scout |
| Stage | select | one of 11 pipeline stages |
| Check size | currency | typical |
| Lead? | bool | can they lead? |
| Fit score | 1-5 | sector + stage + check |
| Signal | 1-5 | response speed, follow-up energy |
| Source | text | warm intro / cold / inbound |
| Intro by | text | who connected |
| First touch | date | |
| Last touch | date | |
| Next touch | date | scheduled |
| Materials sent | multi | deck / one-pager / model |
| Notes | text | freeform |
| LinkedIn | url | |
| Twitter | url | |

## Sample row
| Name | Firm | Stage | Check | Fit | Signal | Next touch |
|------|------|-------|-------|-----|--------|-----------|
| Jane Smith | Acme Ventures | Partner mtg | $500k | 5 | 4 | 2026-05-15 |

## Follow-up cadence
| Days since last contact | Action |
|-------------------------|--------|
| 7 | Soft nudge: "any thoughts?" |
| 14 | Update with new traction milestone |
| 30 | "Closing in 2 weeks — want to revisit?" |
| 45 | Move to "pass" if no response |

## Investor scoring
**Fit score (1-5):**
- 5 = leads our stage, our sector, our check size
- 4 = follows our stage + sector
- 3 = right sector, wrong stage
- 2 = right stage, wrong sector
- 1 = generalist far from our space

**Signal score (1-5):**
- 5 = first response < 24 hr + asks substantive questions
- 4 = responds within a week, schedules quickly
- 3 = responds, takes time
- 2 = slow + lukewarm
- 1 = ghosting

**Prioritize fit ≥ 4 AND signal ≥ 4.** Cut fit < 3 entirely.

## Conversion benchmarks (median seed raise)
| Stage transition | Conversion |
|------------------|-----------|
| Sourced → intro-sent | 60% |
| Intro-sent → meeting | 70% |
| Meeting → 2nd meeting | 40% |
| 2nd meeting → partner mtg | 50% |
| Partner mtg → term sheet | 30% |
| Term sheet → closed | 90% |
| **Overall:** | ~2-4% |

So 100 sourced → 2-4 closed. Plan accordingly.

## Funnel report (refresh weekly)
| Stage | Count | Velocity |
|-------|-------|----------|
| Sourced | 200 | — |
| Intro-needed | 80 | |
| Intro-sent | 50 | 5/week |
| Meeting scheduled | 30 | 3/week |
| Meeting done | 25 | |
| Follow-up | 18 | |
| Partner mtg | 6 | |
| Term sheet | 2 | |
| Closed | 1 | $250k |
| Pass | 80 | |

## Investor update batches
Every 2 weeks, BCC update to all investors at "meeting done" + "follow-up" stage. Shows momentum.

## Pass reasons taxonomy (track for pattern detection)
- Stage mismatch (too early / too late)
- Sector pass
- Conflict of interest (portfolio)
- Round too small / too large
- Need more traction
- Team gap (e.g., no tech co-founder)
- Market thesis disagreement
- "Will revisit" (real or polite)
- No reason given (re-classify after 30 days)

If same reason 5+ times → adjust pitch or target list.

## Pitfalls flagged
- [ ] One source of truth (not 3 conflicting sheets)
- [ ] Pipeline updated weekly
- [ ] Next-touch dates filled per active investor
- [ ] Pass reasons tracked
- [ ] Funnel benchmarks compared
- [ ] No investor "stuck" > 30 days without action

## Anti-patterns
- ❌ "I'll remember" — you won't
- ❌ Sending materials before warm intro
- ❌ Identical follow-up template (personalize each)
- ❌ Skipping pass-reason logging
- ❌ No update cadence to in-pipeline investors
- ❌ Letting a hot investor wait 2 weeks

## Next
- Target list → `/investor-target-list`
- Warm intro map → `/warm-intro-map`
- Update cadence → `/investor-update-cadence`
- Diligence prep → `/diligence-checklist`
```

## Verification
- 11-stage pipeline.
- Per-investor row schema.
- Fit + signal scoring.
- Cadence rules.
- Conversion benchmarks.
- Weekly funnel report.
