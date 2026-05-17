---
name: first-hire-plan
description: Pre-launch first-hire plan — role pick (eng/design/ops/sales vs founder-augment), W-2 vs contractor decision, comp framework (cash + equity), recruiting source, interview loop, reference protocol, 90-day evaluation gate, kill criteria. Outputs to `docs/inception/first-hire-plan-<project>.md`. Use when user says "first hire", "hire #1", "first employee", "hiring", "/first-hire-plan", or before posting first JD.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /first-hire-plan — Hire #1 Is The Highest-Variance Decision Of The First Year. Plan It Before You Post The JD.

## Why you'd care

Hire #1 sets the cultural and compensation precedent for everyone after them — get the role wrong and you're carrying the salary plus the team drag for 12+ months before you can unwind it. The plan forces the decision on paper before you post the JD.

First hire ≠ "find someone smart and cheap". First hire = decides whether founder time gets bought back, whether the next 3 hires recruit themselves, whether equity table burns or compounds. Bad hire #1 sets the culture, drains 6 months of founder energy, and kills momentum. Plan the decision before you write the JD.

## Pre-flight
Run before first job description is drafted OR before founder commits to "I'll just hire when I find someone". Pairs with `/contractor-vs-employee-decision`, `/equity-comp-philosophy`, `/employee-handbook-skeleton`, `/founders-agreement`, `/vesting-schedule`, `/skills-gap-inventory`, `/founder-time-allocation`.

## Inputs
- Founder skills-gap inventory (which role the founder is *worst* at = highest hire ROI).
- Founder time allocation today (what % is in lowest-leverage work).
- Current runway (months) + cash on hand.
- Stage (pre-revenue / first customers / post-PMF).
- Equity option pool size + already-granted.
- Geography (remote-first / hub city / regulated jurisdiction).
- Existing pipeline (network candidates already known? cold market?).

## Process
1. **Role pick** — match hire to founder's biggest gap, not "what's trendy".
2. **W-2 vs contractor decision** — IRS / IR35 / jurisdiction tests, not preference.
3. **Comp framework** — cash floor + equity grid + benefits posture.
4. **JD draft** — outcomes-first, not skills-list-first.
5. **Recruiting source** — warm network → community → broad market in that order.
6. **Interview loop design** — 5-7 conversations, founder + advisors + reference calls.
7. **Reference protocol** — 3 references, structured questions, what's-missing pattern.
8. **Offer + onboarding plan** — first 2 weeks ramp, 90-day evaluation gate.
9. **Kill criteria** — written threshold for parting ways before 6 months.

## Output
Write `docs/inception/first-hire-plan-<project>.md`:

```markdown
# First Hire Plan — <project>
**Owner:** founder
**Date:** <YYYY-MM-DD>
**Stage:** <pre-revenue / first customers / post-PMF>
**Runway:** <N months>
**Option pool remaining:** <X%>

## Why this exists
- Hire #1 sets cultural baseline for next 10 hires
- Founder time-allocation ROI from buying back lowest-leverage work
- Bad hire #1 costs 6 months + 1-2% equity + momentum + team trust
- Equity grant to hire #1 is the largest non-founder grant in the cap table
- First hire decides whether next hires recruit themselves or you cold-source forever

## Founder gap → role pick

### Step 1: identify highest-leverage gap
Score founder skill vs criticality (1-5 each):

| Function | Founder skill | Criticality | Gap × Crit |
|----------|---------------|-------------|------------|
| Engineering / product build | <1-5> | <1-5> | <product> |
| Design / UX | <1-5> | <1-5> | <product> |
| Sales / GTM | <1-5> | <1-5> | <product> |
| Customer success / support | <1-5> | <1-5> | <product> |
| Ops / finance / legal | <1-5> | <1-5> | <product> |
| Marketing / content | <1-5> | <1-5> | <product> |
| Data / analytics | <1-5> | <1-5> | <product> |

Highest Gap × Criticality score = hire role candidate.

### Step 2: gut-check against stage
| Stage | Most common right pick | Most common trap |
|-------|------------------------|-------------------|
| **Pre-revenue, tech-founder** | Designer or generalist PM (NOT another eng — clones founder, no leverage) | Hiring 2nd eng before product-market fit |
| **Pre-revenue, non-tech founder** | Senior eng / technical co-founder via founder-equity (NOT employee #1) | Hiring junior eng to "execute" while founder pitches |
| **First customers, tech-founder** | Sales-led founder hires SE/CSM. PLG founder hires growth eng or designer | Hiring VP Sales before founder has sold 10 deals |
| **First customers, non-tech founder** | Eng #2 + onboarding hire (founder cannot personally onboard at scale) | Hiring marketing before sales motion proven |
| **Post-PMF** | Whatever fire is burning hottest — likely ops or CS | Hiring "VP of X" before there's an X team |

**Our pick:** <role + level + IC vs lead>
**Why this role beats alternatives:** <1-3 sentences>

## Hire shape

| Dimension | Pick |
|-----------|------|
| **Role title** | <e.g. Founding Engineer / Senior Designer / Head of Sales> |
| **Level** | <IC senior / staff / first-line lead> |
| **W-2 vs contractor** | <decide via `/contractor-vs-employee-decision`> |
| **Full-time vs part-time** | <FT default; PT only if equity-low + cash-low> |
| **Remote / hybrid / in-office** | <pick + why> |
| **Geography constraint** | <country / timezone window> |
| **Start date target** | <YYYY-MM-DD> |

## Outcomes (NOT a skills list)
Write 3-5 outcomes the hire owns in their first year. Outcomes > skills:

- Outcome 1: <e.g. "Ship v1 mobile app to App Store + Play Store with < 5 P1 bugs in first 30 days post-launch">
- Outcome 2: <e.g. "Lead 8 customer discovery interviews monthly, distill into product spec updates">
- Outcome 3: <e.g. "Close first $50k ARR from outbound (not founder warm intros)">
- Outcome 4: <...>
- Outcome 5: <...>

Skills required to deliver outcomes — derived, not listed first:
- <skill 1>
- <skill 2>
- <skill 3>

## Compensation framework

### Cash floor by role + geo (2026 market signal)
| Role | SF / NYC | EU hub | Remote / LATAM | Remote / SEA |
|------|----------|--------|----------------|--------------|
| Founding eng (senior) | $180-220k | €100-140k | $80-120k | $50-80k |
| Founding eng (staff) | $220-280k | €130-170k | $100-150k | $70-110k |
| Senior designer | $150-190k | €90-120k | $70-110k | $45-75k |
| Founding sales (AE) | $120k base + $60-120k OTE | €80k+€40k | $60k+$40k | $40k+$30k |
| Sales lead | $160-200k base + $80-150k OTE | €110k+€60k | $80k+$50k | $55k+$40k |
| Customer success | $100-140k | €60-90k | $50-80k | $30-55k |
| Ops / chief of staff | $140-180k | €80-110k | $60-95k | $40-65k |

**Our cash floor:** <$ / role / geo>
**Why below / above market:** <stage + cash-conservation + equity-rich rationale>

### Equity grant (see `/equity-comp-philosophy`)
| Hire # | Stage | Typical grant | Vesting |
|--------|-------|---------------|---------|
| Hire #1 founding eng | Pre-seed | 1.0% - 2.5% | 4yr / 1yr cliff |
| Hire #1 founding eng | Seed | 0.5% - 1.5% | 4yr / 1yr cliff |
| Hire #1 founding eng | Series A | 0.25% - 0.75% | 4yr / 1yr cliff |
| Hire #1 senior IC | Seed | 0.3% - 1.0% | 4yr / 1yr cliff |
| Hire #1 first sales | Seed | 0.5% - 1.5% | 4yr / 1yr cliff + accel on involuntary termination |
| Hire #1 lead | Seed | 1.0% - 3.0% | 4yr / 1yr cliff |

**Our grant:** <X%>
**ISO vs NSO:** <pick — ISO default for US W-2; NSO for advisors/contractors>
**Vesting accelerators:** <single-trigger / double-trigger / none>
**Early exercise allowed:** <yes — preserves QSBS / 83(b) window>
**Exercise window post-termination:** <90 days standard / extended 10-yr>

### Benefits baseline
| Benefit | Pre-seed posture | Seed posture | Series A posture |
|---------|------------------|--------------|-------------------|
| Health insurance | Stipend only (US) / statutory (EU) | Full coverage employee | Full coverage employee + family |
| Dental / vision | Skip | Bundle | Bundle |
| Retirement / pension | None | Match start | 3-4% match |
| PTO | Per `/vacation-policy-pre` | Per `/vacation-policy-pre` | Per `/vacation-policy-pre` |
| Equipment | $2-3k allowance | $3-4k | $4-5k |
| Home office stipend | $500 one-time | $1k one-time + $50/mo | $1.5k + $75/mo |
| Learning budget | $500/yr | $1k/yr | $1.5k/yr |
| Mental health (`/mental-health-plan`) | EAP only | EAP + therapy stipend | Full coverage |

### Total comp model
Total = cash base + (equity strike × vested over 4yr) + benefits estimated value.
Communicate as range, not single point. Show 3-scenario equity outcomes (zero / fair / win) at exit valuations.

## JD draft (template)

```
**<Role title>** — <project> (<stage>)

**About us:** <2-3 sentences, problem + traction signal>

**About the role:** <1 paragraph — outcomes, not skills>

**You'll own:**
- <outcome 1>
- <outcome 2>
- <outcome 3>

**You probably have:**
- <skill 1>
- <skill 2>
- <skill 3>
- A bias toward shipping over perfection
- Comfort with ambiguity (pre-PMF reality)

**You don't need:**
- <commonly-listed-but-unnecessary requirement — explicitly disclaimed>
- Specific tech-stack experience (we'll train)
- <X years of experience> — show us work, not tenure

**Comp:** $<base> + <X%> equity + benefits
**Location:** <remote / hub / hybrid + timezone>
**Stage:** <round + ARR + team size>

**Hiring process:**
1. 30-min intro call with founder
2. 60-min role-relevant work session (paid if take-home)
3. 45-min reverse interview — you ask, founder answers
4. Reference calls (we call yours; you call ours)
5. Offer within 1 week of final round

**Apply:** <email / form / link>
```

## Recruiting source (warm → cold sequence)

### 1. Founder + co-founder + advisor network
- List 30-50 names from founder + co-founder + advisor LinkedIn
- DM personally, not mass-blast
- Ask for intros AND for "tell me if you know someone who's looking"
- Expected: 30-40% of hires come from this layer

### 2. Investor network
- Each existing investor / angel has portfolio = ~50 companies = ~500 candidates
- Email 1 personal request to each investor with the JD
- YC / Techstars / accelerator alumni networks if applicable

### 3. Community / niche
- Engineering: GitHub repos in stack, niche Slack groups, dev meetups
- Design: Dribbble, Read.cv, design community Discords
- Sales: RepVue, MEDDPICC community, Pavilion
- Ops: Generalist community, COO network

### 4. Job boards (cold market)
- **Founder-friendly:** Wellfound (ex-AngelList Talent), Y Combinator Work at a Startup, HN "Who is hiring"
- **Generalist:** LinkedIn (paid), Otta / Welcome to the Jungle (EU)
- **Niche:** Polywork, Read.cv, We Work Remotely (remote)
- **Skip:** Indeed for senior tech (signal-to-noise too low)

### 5. Recruiters / agencies
- Only after weeks 4-6 of above failing
- Contingency 20-25% of base, retained 25-33% for senior leadership
- Boutique > big agency for early-stage
- Negotiate replacement guarantee (90-180 day no-cost replace)

## Interview loop (5-7 conversations)

| Round | Length | Who | Purpose |
|-------|--------|-----|---------|
| 1. Intro / mutual interest | 30 min | Founder | Vibe check + role match |
| 2. Domain deep-dive | 45-60 min | Founder + advisor in domain | Probe outcomes from past work |
| 3. Work session | 90-120 min | Founder + 1 | Real problem from current backlog, paid if take-home |
| 4. Reverse interview | 45 min | Founder | Candidate questions = signal |
| 5. Team chemistry | 30 min | Co-founder | Co-founder veto power |
| 6. Reference calls | 30 min × 3 | Founder | Structured ref protocol |
| 7. Offer + negotiation | 30 min | Founder | Real-time, not async |

**Total time investment:** ~6-8 hours / candidate. Worth it.

### Work session design
- Use a real problem from current backlog — never a synthetic puzzle
- Time-box 90 min during interview OR 4-8 hours take-home (paid: $200-500)
- Ask candidate to present their approach + tradeoffs
- Watch for: clarifying questions asked, tradeoff articulation, willingness to say "I don't know"
- Red flags: jumps to solution without context, won't admit uncertainty, can't explain choices

## Reference call protocol

### Who to call
- 3 references minimum, candidate-provided
- Bonus: 1 back-channel reference (mutual connection candidate did NOT list)
- Mix: 1 manager + 1 peer + 1 direct report (if applicable)

### Structured questions (5 questions, 30 min)
1. "How did you work together — what was the context?"
2. "What did <name> deliver that you most remember?"
3. "On a scale of 1-10, would you hire them again — and why not 10?"
4. "Where did they need to grow / what's a development area?"
5. "If I called you in 2 years and said 'we're letting them go', what would you guess the reason was?"

### What to listen for
- **Hedging on Q3:** "would you hire them again" hedge = polite no
- **Vague Q2:** can't recall specific deliverables = low impact
- **Defensive Q4:** no growth areas = self-aware-deficit OR ref doesn't know candidate well
- **Pattern in Q5:** if 2/3 refs guess same failure mode = signal

## Offer + onboarding

### Offer letter must include
- Title, start date, comp (base + equity + benefits)
- Vesting schedule (4yr / 1yr cliff)
- At-will employment statement (US) / appropriate jurisdiction equivalent
- IP assignment (see `/ip-assignment-agreement`)
- Confidentiality (see `/nda-template` — usually integrated in offer)
- Reporting line + first 90-day goals
- Offer expiration (7-10 days standard)

### Day 1
- Equipment ready (laptop, accounts, badges)
- Calendar pre-populated week 1
- Onboarding doc (see `/employee-handbook-skeleton`)
- Founder lunch + co-founder coffee
- First small win identified (PR / customer call / deliverable in week 1)

### Week 1 ramp
- Day 1: setup + reading
- Day 2-3: shadow founder customer calls / pair on real code / sit in real meetings
- Day 4-5: small owned task delivered end-to-end
- Friday: 1:1 retro — what's confusing, what's working

### Week 2-4
- Owned project — 30-day deliverable
- Weekly 1:1 with founder (cadence per `/weekly-operating-rhythm`)
- Cultural integration — `/values-charter` + `/code-of-conduct` review

## 90-day evaluation gate

Written 30/60/90 plan signed at offer:

| Day | Expected delivery |
|-----|-------------------|
| 30 | Ramped — first owned deliverable shipped. Comfortable in codebase / customer base / tools. |
| 60 | Independent — second deliverable shipped without daily founder pairing. Team chemistry confirmed. |
| 90 | Compounding — proactively identifying problems, suggesting improvements, mentoring future hires. |

90-day review meeting → keep / coach / cut decision. Decide in advance what each looks like.

## Kill criteria (written before hiring)

Hire #1 is high-stakes. Pre-commit to firing thresholds — easier to enforce when written:

| Signal | Action |
|--------|--------|
| 30-day deliverable missed without flag | Coach + clarify expectations |
| 60-day deliverable missed | Performance improvement plan, 30 days |
| 90-day deliverable missed | Part ways. Don't drag it out. |
| Co-founder veto at any point with cause | Part ways. |
| Trust broken (lie / cover-up / values violation) | Part ways immediately. |
| Cultural toxicity (disrespect, gossip, bullying) | Part ways immediately. |
| Equity / comp renegotiation < 90 days | Yellow flag — examine fit |

**Severance posture for early termination:** 2-4 weeks pay + benefits continuation + accelerated vesting cliff partial credit. Be human. Reputation compounds.

## Founder-specific actions

### Before posting JD
- [ ] `/skills-gap-inventory` complete — role pick justified by gap, not preference
- [ ] `/founder-time-allocation` complete — clear which founder time gets bought back
- [ ] `/equity-comp-philosophy` decided
- [ ] Option pool sized — grant won't push dilution past comfort
- [ ] `/contractor-vs-employee-decision` made
- [ ] Cash runway covers 18 months at new burn rate post-hire
- [ ] `/founders-agreement` clean — IP / vesting / decision rights clear before bringing in employee #1
- [ ] `/employee-handbook-skeleton` drafted
- [ ] `/vacation-policy-pre` drafted
- [ ] `/on-call-philosophy-pre` decided if eng hire

### During search
- Founder runs all rounds 1-2 personally
- Don't outsource judgment to advisors — they have less skin
- Move fast: top candidates have 2-3 offers in flight, lose them in delay
- Cap search at 90 days — if no hire by day 90, reassess role / comp / market

### After hire starts
- Founder pairs daily week 1, daily week 2, 3x / week month 1
- Weekly 1:1 from week 2 onward — don't skip
- 30/60/90 calibration check-ins on the dot
- Resist hiring #2 until #1 is fully ramped (don't compound onboarding load)

## Anti-patterns
- ❌ Hire role founder is already great at — clone risk, no leverage
- ❌ Hire most prestigious resume, not best outcome match
- ❌ Hire pre-PMF for "scale" — wrong stage / different skillset
- ❌ Hire 2nd eng before product-market fit (use contractors)
- ❌ Hire VP-level before there's a team to lead
- ❌ Hire 1099 to skirt benefits — IRS / IR35 reclassification risk
- ❌ Skip reference calls "they're a friend"
- ❌ Skip work session "interviews are biased"
- ❌ Lowball cash hoping equity sells it — top candidates won't accept
- ❌ Over-grant equity hoping it's a steal — early-stage dilution math is brutal
- ❌ Hire without `/founders-agreement` + cap table clean
- ❌ Onboarding = "here's the laptop, good luck"
- ❌ Skip 30/60/90 plan = no kill criteria = drag bad fit for 9 months
- ❌ Friend-hire without process — destroys friendship + cap table
- ❌ Promise title inflation ("VP / Head of") for senior IC — title compression future hires
- ❌ Recruiter > founder in week 1-3 of search — founder must own top of funnel
- ❌ Async-only interview loop — chemistry signal lost

## Founder mistakes to anticipate
1. Hiring before knowing what you're hiring for ("we just need help")
2. Hiring 2nd of what you are (eng-founder hires eng — no leverage)
3. Underpaying cash thinking equity sells it
4. Over-granting equity to "make up for low cash" (1% vs 0.5% is huge at exit)
5. Skipping background / reference calls
6. Friend-hire without process
7. Hiring "VP of X" with no X team
8. Hiring on personality fit not outcome fit
9. No 30/60/90 plan → no kill criteria → drag for 9 months
10. Onboarding plan = "figure it out"

## Pre-launch checklist
- [ ] Role picked (matches founder skills-gap)
- [ ] W-2 vs contractor decided (per `/contractor-vs-employee-decision`)
- [ ] Cash floor + equity grant decided (per `/equity-comp-philosophy`)
- [ ] Benefits posture decided
- [ ] JD drafted (outcomes-first)
- [ ] Recruiting source sequence (warm → cold)
- [ ] Interview loop designed (5-7 rounds)
- [ ] Work session designed (real problem)
- [ ] Reference protocol (3 refs, 5 structured questions)
- [ ] Offer letter template + IP assignment + at-will language
- [ ] 30/60/90 day plan + kill criteria written
- [ ] Onboarding doc ready
- [ ] Option pool sized in cap table
- [ ] Runway recalculated post-hire (18-mo minimum)

## Hand-off
- Contractor vs employee decision → `/contractor-vs-employee-decision`
- Equity philosophy + grid → `/equity-comp-philosophy`
- IP assignment template → `/ip-assignment-agreement`
- NDA template → `/nda-template`
- Vesting schedule → `/vesting-schedule`
- Founders agreement (must be clean before hire) → `/founders-agreement`
- Employee handbook → `/employee-handbook-skeleton`
- Vacation policy → `/vacation-policy-pre`
- On-call setup if eng → `/on-call-philosophy-pre`
- Mental health plan → `/mental-health-plan`
- Operating rhythm → `/weekly-operating-rhythm`
- RACI → `/raci-chart`
```

## Verification
- Role pick justified by founder skills-gap × criticality, not preference.
- Cash floor + equity grant + benefits posture decided.
- JD outcomes-first, not skills-list-first.
- Interview loop 5-7 rounds including work session + reference calls.
- 30/60/90 plan + kill criteria written before hiring.
- All cross-skill hand-offs in place (`/contractor-vs-employee-decision`, `/equity-comp-philosophy`, `/founders-agreement`, `/employee-handbook-skeleton`).
- Runway recalculated 18-mo post-hire.
