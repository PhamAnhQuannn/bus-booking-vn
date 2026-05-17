---
name: board-of-directors-setup
description: Board of directors setup — composition, seats, observer rights, indemnification, D&O, board consent matrix. Outputs to `docs/inception/board-of-directors-setup-<project>.md`. Use when user says "board setup", "board composition", "board seats", "observer rights", "indemnification", "/board-of-directors-setup", or post-seed.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /board-of-directors-setup — First Board Sets All Future Boards. Get Composition Right Or Live With It For 5 Years.

## Why you'd care

A board seat granted at seed has fiduciary teeth for the life of the company — and the right to fire the founder. Composition, observer rights, and the consent matrix decided now are nearly impossible to renegotiate without giving up something painful at the next round.

Board ≠ advisor. Board has fiduciary duty, voting power, and the right to fire the founder. Composition decisions made at seed live until exit.

## Pre-flight
Run at seed close or first priced round. Pairs with `/term-sheet-literacy`, `/cap-table-design`.

## Inputs
- Cap table (founders + investors + option pool).
- Term sheet (board seat clauses).
- Charter / certificate of incorporation.
- D&O insurance quote.

## Process
1. **Decide board size** — 3 / 5 / 7 (odd, never even).
2. **Map seats** — founder / investor / independent.
3. **Lock voting thresholds** — simple majority, supermajority items, unanimous items.
4. **Define observer rights** — non-voting, with NDA, limits per investor.
5. **Sign indemnification agreements** — every director.
6. **Bind D&O insurance** — before first board meeting.
7. **Draft board consent matrix** — who approves what.

## Output
Write `docs/inception/board-of-directors-setup-<project>.md`:

```markdown
# Board of Directors Setup — <project>
**Stage:** <pre-seed / seed / Series A>
**Board size:** <3 / 5 / 7>
**Composition formula:** <e.g. 2 founder + 1 investor + 2 independent>

## Board size by stage
| Stage | Recommended size | Why |
|-------|-----------------|-----|
| Pre-seed | 1 (founder only) or 3 | Don't bloat early |
| Seed | 3 | 2 founder + 1 investor |
| Series A | 5 | 2 founder + 2 investor + 1 independent |
| Series B | 5-7 | Add 1 more independent |
| Pre-IPO | 7-9 | Audit + comp committees |

Hard rule: always odd, never even (deadlocks kill).

## Seat composition matrix
| Seat type | Voting? | Who fills | Removable by |
|-----------|---------|-----------|--------------|
| Founder seat | Yes | Founder(s) | Voting majority of common holders |
| Investor seat | Yes | Lead investor's partner | Voting majority of preferred holders |
| Independent seat | Yes | Mutually agreed industry exec | Joint consent of common + preferred |
| Observer seat | No | Other investors | Lead investor + co revoke |

## Common-vs-preferred control balance
At seed (3-person board, 2 founder + 1 investor):
- Founders control common-elected seats (2 of 3)
- Investor controls preferred-elected seat (1 of 3)
- Common majority = 2 seats = controls board
- Result: founder-friendly

At Series A (5-person, 2 founder + 2 investor + 1 independent):
- 2 common-elected + 2 preferred-elected + 1 jointly elected
- Independent = swing vote
- Result: balanced, independent decides ties

DON'T accept: 1 founder + 2 investor + 0 independent at seed. Hard-tilted board.

## Voting thresholds
| Decision | Threshold | Why |
|----------|-----------|-----|
| Operating decisions | Simple majority | Default |
| Annual budget | Simple majority | Standard |
| Hiring CXO | Simple majority | Standard |
| New share class / equity raise | Preferred majority | Anti-dilution protection |
| Sale of company / IPO | Preferred majority + common majority | Both sides protected |
| Bankruptcy / dissolution | Unanimous | Protect all |
| Founder termination | Board majority (excluding founder vote) | Avoid conflict |
| Compensation > $X | Comp committee + board approval | Avoid founder over-pay |
| Related-party transactions | Disinterested directors only | Avoid self-deal |

## Observer rights (term sheet negotiation)
| Observer right level | What it allows |
|----------------------|----------------|
| Standard observer | Attend meetings, see materials, no vote |
| Information rights | Quarterly financials, annual budget, cap table |
| Limited information rights | Annual financials only |
| No observer | Lead investor only |

Negotiate:
- Cap observers at 2 per round
- All observers sign NDA
- Right to exclude observers from sensitive items (e.g. M&A discussion)
- Lose observer right at < N% ownership

## Indemnification agreement
Every director (and officer) must have:
- Indemnification agreement (broader than bylaws default)
- Mandatory advancement of legal fees during investigation
- Coverage for derivative + 3rd-party claims
- Severability if 1 clause unenforceable
- Survives termination

Template: Cooley GO, OpenAI Atrium, or Y Combinator have free templates.

## D&O insurance
Required before first board meeting. Sizing:
| Stage | Coverage | Annual premium |
|-------|----------|---------------|
| Pre-seed | $1-2M | $3K - $6K |
| Seed | $2-5M | $5K - $15K |
| Series A | $5-10M | $15K - $40K |
| Series B+ | $10-25M | $40K - $100K |

Broker: Embroker, Vouch, AON, Newfront.

Coverage components:
- Side A (direct director protection — not reimbursable to co)
- Side B (co reimbursement of director costs)
- Side C (entity coverage for securities claims)
- Employment Practices Liability (EPL) often bundled

## Board consent matrix
What requires which approval (sample, customize):
| Action | Founder solo | Board majority | Preferred majority | Stockholder majority |
|--------|--------------|----------------|---------------------|----------------------|
| Hire / fire non-exec | ✅ | — | — | — |
| Hire / fire CXO | — | ✅ | — | — |
| Annual budget | — | ✅ | — | — |
| Issue new shares (within authorized) | — | ✅ | — | — |
| Authorize more shares | — | — | ✅ | ✅ |
| New class of stock | — | — | ✅ | ✅ |
| Sale of co | — | ✅ | ✅ | ✅ |
| Take debt > $X | — | ✅ | — | — |
| Amend charter | — | — | ✅ | ✅ |
| Founder comp change | — | ✅ (excl. founder) | — | — |
| Issue options to founders | — | ✅ (excl. founder) | — | — |

## Per-director profile
For each board member:
```
# Director: <name>

## Role
- <Founder / Investor representative / Independent>
- Elected by: <common / preferred / jointly>
- Term: <until removed / until next election>

## Background
- <current role + co>
- <relevant experience for this co>
- <other boards>

## Conflicts
- <other portfolio cos in adjacent space?>
- <competitive board seats?>
- <financial relationships?>

## Compensation (if independent)
- Equity: <0.25 - 0.75% over 4 yrs, 1-yr cliff>
- Cash: <$0 - $25K / yr>
- Travel: <reimbursed>

## Indemnification + D&O
- Indemnification agreement: signed YYYY-MM-DD
- D&O policy: <carrier + limit>

## Committee assignments
- <Audit / Comp / Nominating>
```

## Independent director picking
**Pick for:**
- Domain experience your co lacks
- Operator background (not just investor)
- Has been on 2-5 other boards (knows the game)
- Geography matches stakeholders
- Will return calls / show up

**Avoid:**
- Big-name only on deck (no engagement)
- Active operator at competitor or customer
- Currently on 10+ boards (capacity)
- Personal friend of founder (independence shot)

**Compensation:**
- Equity: 0.25 - 0.75% (4-yr vest, 1-yr cliff)
- Cash retainer: $0 - $25K/yr (often $0 at seed)
- Out-of-pocket reimbursed
- Use Mosaic or similar for benchmarks

## First-board first-meeting agenda
1. Adopt bylaws
2. Elect officers (CEO, CFO, Secretary)
3. Authorize bank accounts + signatories
4. Approve option pool + first option grants
5. Approve D&O insurance binding
6. Approve indemnification agreements
7. Adopt insider trading policy
8. Adopt code of conduct
9. Schedule next 4 meetings

## Board secretary
Designate one person to:
- Send agendas + materials 1 week ahead
- Take minutes
- File minutes in corporate records
- Track action items between meetings

Usually CFO, COO, or external corp counsel. NOT the CEO (conflict + workload).

## Records to keep
- Board minutes (every meeting)
- Board resolutions (consent in lieu of meeting)
- Director signatures on indemnification + insider trading + COI policies
- Annual D&O renewal
- Cap table updates
- Stock plan grants

Store: Carta board portal, Notion, or shared drive with permission tiers.

## Pitfalls flagged
- [ ] Board size = odd, max 3-5 at seed
- [ ] Founder-friendly composition until Series A
- [ ] Voting thresholds defined per decision
- [ ] Observer rights capped
- [ ] Indemnification agreements signed
- [ ] D&O bound before first meeting
- [ ] Board consent matrix drafted
- [ ] Independent director picked, not coronated

## Anti-patterns
- ❌ Even-numbered board
- ❌ Investor seat without earned ownership
- ❌ Independent who's a friend
- ❌ No D&O insurance (board won't sit)
- ❌ Founder both Chair + CEO with no independent check
- ❌ Observer seats > 3 (meeting becomes theater)
- ❌ No board secretary / no minutes
- ❌ Skipping indemnification agreement

## Next
- Cadence → `/board-meeting-cadence`
- Term sheet review → `/term-sheet-literacy`
- Cap table → `/cap-table-design`
```

## Verification
- Board size + composition.
- Voting threshold matrix.
- Observer rights stated.
- Indemnification + D&O bound.
- Board consent matrix.
- Per-director profile.
- Independent director criteria.
