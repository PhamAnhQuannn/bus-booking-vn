---
name: customer-health-score
description: Per-account health score (usage + sentiment + support + payment) so CS knows who is about to churn before they tell you. Outputs to `docs/cs/health-score.md`. Reads `/project-classify` to skip XS. Use when user says "health score", "customer health", "churn prediction", "red/yellow/green accounts", "/customer-health-score", or before first CS hire.
output_size:
  XS: skip
  S: 1h
  M: 4h
  L: 8h
  XL: 8h
---

# /customer-health-score — Account Health Index

## Why you'd care

The first CSM hire without a health score spends their week on whoever emailed loudest yesterday — and the quiet $80k account that hasn't logged in for 21 days churns at renewal with no save attempt because nobody noticed the silence. A single per-account number built from usage + sentiment + support + payment signals is what turns CS from reactive firefighting into a daily red-list workflow, and the difference shows up in gross retention 6 months later.

Invoke as `/customer-health-score`. Health score is a single number per account that predicts churn 30-90 days out. Built from signals, not vibes. CS team works the red list daily.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS → SKIP.
2. Usage telemetry exists (events per tenant).
3. Support ticket + payment data accessible.

## Inputs
- Definition of "churn" (cancel? downgrade? non-renewal?)
- Time horizon for prediction (30 / 60 / 90 days)
- Account segments (enterprise vs SMB scored differently)
- Data sources available (product events, support, NPS, payment, login)

## Process

1. **Signal categories** — four buckets, balanced:

   | Category | Weight | Examples |
   |---|---|---|
   | Usage | 40% | logins/wk, DAU/MAU, feature breadth, key-action freq |
   | Sentiment | 20% | NPS, CSAT, exec sponsor sentiment, QBR scores |
   | Support | 20% | ticket volume trend, sev1 count, time-to-resolve |
   | Commercial | 20% | payment timeliness, contract length, plan changes |

   Tune weights per segment (enterprise weights sentiment heavier; SMB weights usage heavier).

2. **Per-signal scoring** — normalize to 0-100:

   | Signal | Score 100 | Score 0 |
   |---|---|---|
   | Weekly active users / seat | ≥80% | ≤10% |
   | Key action last 7d | yes | no in 14d |
   | NPS | ≥9 | ≤6 |
   | Open sev1 tickets | 0 | ≥2 |
   | Last payment late | no | >7d late |
   | Days since exec contact | <30 | >90 |

   Use percentile cuts on your own population, not absolute thresholds (changes as you grow).

3. **Composite score** — weighted sum:
   ```
   health = 0.4*usage + 0.2*sentiment + 0.2*support + 0.2*commercial
   ```
   Bucket:
   - 80-100: green (healthy, expansion candidate)
   - 50-79: yellow (watch list)
   - 0-49: red (intervene now)

4. **Trend matters more than level** — score delta over 30d:
   - Falling fast (Δ < -15) in 30d → escalate even if currently yellow
   - Stable green for 60d → expansion outreach
   - Stable red → contract risk; CS exec call

5. **Per-account dashboard** — what CSM sees:

   | Column | Source |
   |---|---|
   | Account name + ARR | CRM |
   | Health score + 30d delta | scoring job |
   | Top 3 negative signals | scoring job |
   | Last login / key action | product telemetry |
   | Open tickets (count + sev) | support tool |
   | Renewal date | CRM |
   | Last CSM touch | CRM activity |
   | Action: who owns next step | CSM-set |

6. **Automation hooks**:
   - Red score for 7d → auto-Slack #cs-red channel with account summary
   - Score drop > 15 in 7d → page CSM next business day
   - Green > 60d + usage ↑ → trigger expansion play in CRM
   - Renewal 90d out + yellow/red → escalate to AE + CS leadership

7. **Calibration loop** — score must predict actual churn:
   - Backtest quarterly: of accounts red 60d before churn, how many actually churned?
   - Target precision ≥ 60% (most reds churn) + recall ≥ 70% (most churners were red)
   - Tune weights when miss rate climbs
   - Document calibration in `docs/cs/health-score-calibration.md`

8. **Anti-patterns**:
   - One signal masquerading as health (e.g., "DAU only") — fragile
   - Score updated quarterly — too slow; daily or weekly
   - Score not actionable — no "what should CSM do today" view
   - Same threshold for all segments — enterprise 50% usage = catastrophe; SMB = normal
   - No backtest — score correlates with nothing, hides churn
   - Sentiment from surveys only — slow; mix in support transcripts/NPS verbatims

## Output

Write `docs/cs/health-score.md`:

```markdown
# Customer Health Score
**Date:** <YYYY-MM-DD> | **Owner:** <CS team>

## Categories + weights
| Category | Weight |
|---|---|
| Usage | 40% |
| Sentiment | 20% |
| Support | 20% |
| Commercial | 20% |

## Signal inventory
- Usage: WAU/seat, key-action freq, feature breadth
- Sentiment: NPS, CSAT, QBR
- Support: ticket trend, sev1, MTTR
- Commercial: payment timing, plan changes

## Scoring
- Each signal 0-100 (percentile-based)
- Weighted composite → green/yellow/red
- 30d delta tracked separately

## Buckets
- Green: 80-100 (expansion candidate)
- Yellow: 50-79 (watch)
- Red: 0-49 (intervene)

## Triggers
- Red ≥7d → Slack #cs-red
- Δ < -15 in 7d → page CSM
- Green >60d + Δ>0 → expansion play
- Renewal 90d + yellow/red → AE escalation

## Dashboard
Per-account: score, delta, top negative signals, last activity, ticket state, renewal date, next action owner.

## Calibration
- Backtest quarterly
- Target precision ≥60%, recall ≥70%
- Tune weights when miss rate climbs

## Anti-patterns
- One signal only
- Quarterly cadence
- Same thresholds across segments
- No backtest
```

## Verification
- Four signal categories with explicit weights.
- Each signal normalized 0-100 using percentile cuts.
- 30d delta tracked alongside absolute score.
- Auto-triggers wired to Slack / CRM.
- Backtest scheduled quarterly with precision/recall target.
- Per-segment weight tuning documented.
