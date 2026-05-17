---
name: market-microstructure-design
description: Trading-venue microstructure design — order book, price-time vs pro-rata vs hybrid matching, tick size, lot size, trading hours, LULD circuit breakers, odd-lot handling, FIFO vs allocation algos, queue-position fairness, NBBO interaction. Outputs to `docs/design/market-microstructure-<project>.md`. Reads `/project-classify` to skip XS+S. Use when user says "matching algorithm", "order book design", "microstructure", "tick size", "circuit breaker", "LULD", "FIFO", "pro-rata", "queue fairness", "/market-microstructure-design", or before standing up an exchange / ATS / SEF / MTF. Pairs with `/matching-engine-invariants` (correctness) and `/regulator-relations-trading` (venue registration).
output_size:
  XS: skip
  S: skip
  M: 4h
  L: 8h
  XL: 8h
---

# /market-microstructure-design — Trading Venue Order-Book + Matching Design

Invoke as `/market-microstructure-design`. The microstructure choices — tick, lot, matching algorithm, halts — determine whether your venue attracts liquidity or repels it. Get them wrong and you lose market-makers in week one; get them right and you mint network effects.

## Why you'd care
Market-makers route based on three signals: queue priority predictability, fee schedule clarity, and absence of adverse selection. Skip microstructure design and you ship a "venue" where (a) HFT picks off retail flow because queue rules are ambiguous, (b) market-makers leave because they can't model fill probability, and (c) your first IIROC / FINRA / FCA / MAS / ESMA exam finds you cannot articulate your matching policy in writing — a finding under Reg ATS Rule 301(b)(2) or MiFID II Art 19.

## Effort caveat — microstructure is a multi-year iteration
- **Hours in this skill** = design doc + tick/lot table + matching-algo decision + halt rules.
- **Real-world build:** 6–18 months for spec, 9–24 months for matching engine + surveillance + connectivity, 3–6 months for SRO rule filing (Reg ATS Form ATS / Form ATS-N, or full SEC Form 1 for exchange). Tick-size pilot programs (e.g., SEC Tick Size Pilot 2016) ran 2 years.
- Liquidity bootstrapping (market-maker incentives, lead-MM programs) is a separate multi-quarter commercial workstream.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS/S → SKIP.
2. Read `docs/compliance/regulatory-<project>.md` — confirm venue type (Reg NMS exchange, ATS, SEF, DCM, MTF, OTF, organized crypto exchange).
3. Read `docs/inception/regulator-relations-<project>.md` if registration-stage.
4. Identify product set: cash equities, options, futures, swaps, crypto spot, perpetual futures, FX spot.
5. Confirm clearing model (CCP-cleared, bilateral, principal book).

## Inputs
- Product type + tick conventions (US equities: $0.01 above $1.00 / $0.0001 below; options: $0.05 / $0.01 per strike; futures: contract-specific; FX: pip / fractional pip; crypto: venue-defined).
- Target participant mix (retail % / institutional % / market-maker % / HFT %).
- Latency budget (matching kernel p99: <100µs co-lo'd typical; <10ms for retail-friendly).
- Connectivity standards (FIX 4.2 / 4.4 / 5.0 SP2, OUCH 4.2, ITCH 5.0, MMTP, Pillar, native binary).
- Trading hours model (continuous, periodic auction, opening cross, closing cross).
- Regulatory anchor: Reg NMS Rules 600–612 (US equities), Reg ATS, CFTC Part 38 / 37, MiFID II RTS 1/2/11.

## Process

1. **Decide order-book model** — pick the structure first; matching algo comes next:

   | Model | When used | Key trait |
   |---|---|---|
   | Continuous Limit Order Book (CLOB) | most equity / futures / crypto venues | continuous matching, time-priority |
   | Periodic call auction | opening/closing cross, low-liquidity names, IEX D-Limit, Aquis MidPoint | matches every N seconds, single clearing price |
   | Frequent Batch Auction (FBA) | Budish-Cramton 2015 proposal; CBOE FBA-like cycles | sub-second batches; defeats latency arms race |
   | RFQ / RFS | swaps SEFs (CFTC Part 37), institutional FX | quote-driven, not order-driven |
   | Hybrid CLOB + auction | NYSE opening auction → continuous | imbalance + indicative price publication |
   | Dark / midpoint | NYSE Dark, Liquidnet, BIDS, IEX | mid-NBBO match, no pre-trade transparency |

2. **Pick the matching algorithm**:

   | Algorithm | Allocation rule | Used where | Pros / Cons |
   |---|---|---|---|
   | **Price-Time (FIFO)** | best price, then earliest timestamp | equities (NYSE, Nasdaq, BATS), most options, treasuries | rewards speed → HFT arms race; predictable queue position |
   | **Pro-rata** | best price, then pro-rata by size at price | short-rate futures (CME ED, SR3), some options | rewards size; favors institutional |
   | **Pro-rata with Top Order priority** | top-of-book gets a slice first, then pro-rata | CME Eurodollar legacy | hybrid; reduces "join the level and wait" |
   | **Price-Time-Pro-rata hybrid** | first slice to fastest, rest pro-rata | various energy / commodity | balances |
   | **Size-Time** | larger first, then time | rare; some dark pools | retail-friendly |
   | **Broker priority / Customer priority** | exchange member's customer fills first | CBOE options; floor heritage | floor-broker legacy |
   | **Volatility / midpoint auction** | uncrossing price max-volume | IEX, Aquis | reduces info-leak; slower fill |
   | **D-Limit (IEX)** | discretionary peg with crumbling-quote signal | IEX | anti-toxicity for liquidity providers |

   Decision drivers: market-maker preference (pro-rata for size-heavy products, FIFO for tight-spread products), regulator constraint (FINRA / SEC don't preference one; MiFID II requires "non-discriminatory rules" — must be documented), product depth (illiquid → pro-rata pulls size; liquid → FIFO works).

3. **Tick size table** — too tight = wasted depth, too wide = priced-out small orders:

   | Asset | Tick regime | Notes |
   |---|---|---|
   | US equities ≥$1.00 | $0.01 (Reg NMS Rule 612) | sub-penny prohibited for displayed orders |
   | US equities <$1.00 | $0.0001 | sub-penny permitted |
   | SEC 2024 amendment | $0.005 for tick-constrained names | implementation Nov 2025 phased |
   | Listed options | $0.01 for premium <$3 / $0.05 ≥$3 (Penny Pilot legacy) | per-class exceptions |
   | E-mini S&P (ES) | 0.25 index pts | CME-set |
   | UST 10Y future (ZN) | 1/64 of 32nds | quirky historical |
   | FX EURUSD | 0.00001 (fractional pip) | venue-set |
   | BTC/USD (Coinbase) | $0.01 | venue-set |
   | EU equities | MiFID II RTS 11 tick regime (liquidity band × price band) | mandatory grid |

4. **Lot size + odd-lot rules**:
   - **Round lot**: traditionally 100 shares US equities; SEC 2022 amendment introduced tiered round lots (100 / 40 / 10 / 1) by price band, effective with Rule 612 changes 2025.
   - **Odd lot**: <100 shares (or below tiered threshold). Pre-Dec-2024: not eligible for NBBO; SEC Rule 600 amendments now include odd-lot info in SIP feed via "odd-lot trades and aggregate odd-lot quotation information."
   - **Mixed lot**: round + odd combined.
   - Display + protection: do odd lots get the same Order Protection (Rule 611) treatment? Post-2024 amendments: better-priced odd lots protected.
   - Crypto venues typically: no lot concept (continuous), minimum quantity = exchange parameter.

5. **Trading hours model**:

   | Session | Hours (US eq) | Notes |
   |---|---|---|
   | Pre-market | 04:00–09:30 ET | ECN-only, no auction |
   | Opening auction | 09:30 ET | imbalance publication T-10min |
   | Continuous | 09:30–16:00 ET | LULD active 09:45–15:35 |
   | Closing auction | 16:00 ET | imbalance publication T-10min |
   | After-hours | 16:00–20:00 ET | ECN-only |

   Crypto: 24/7/365 (no halts model; design halt-on-issue protocol explicitly). Futures: nearly continuous with brief daily breaks. Document **every** transition state and what orders do at each.

6. **Volatility halts + circuit breakers** — Reg NMS LULD framework:

   - **Limit Up Limit Down (LULD)** — applies to NMS stocks 09:45–15:35 ET. Price bands ±5% (Tier 1: S&P 500 + Russell 1000 + select ETPs ≥$3) / ±10% (Tier 2 ≥$3) / ±20% or $0.15 (sub-$3) over 5-min rolling reference. Limit State on band touch; Trading Pause after 15s if no re-entry. Pause = 5 min.
   - **Market-Wide Circuit Breaker (MWCB)** — S&P 500 drops: Level 1 (−7%) 15-min halt, Level 2 (−13%) 15-min halt, Level 3 (−20%) close for day.
   - **Single-stock halts** (FINRA Rule 5260, exchange Rule 4120/4121 Nasdaq, Rule 7.12 NYSE) — news pending, regulatory, dissemination of related security.
   - **Straddle states** — when LULD band crosses NBBO mid; specific handling required.
   - For non-US: ESMA RTS 7 + venue-specific bands; Tokyo special quote system; HKEX cooling-off; ASX equilibrium price.
   - Crypto: design your own. Recommend: tiered price-band halts (±5% / ±10% from 5-min VWAP), max-position-change rate, off-band kill switch. Document policy.

7. **Order types + time-in-force** — minimum viable set:

   | Type | Behavior | Notes |
   |---|---|---|
   | Limit | rests at price | core |
   | Market | takes liquidity | route concern: NBBO compliance under Rule 611 |
   | Stop / Stop-Limit | triggered by trade at trigger | server-side or member-side |
   | MOO / MOC | participates in opening / closing auction only | |
   | LOO / LOC | limit version of above | |
   | Peg (midpoint / primary / market) | floating ref | midpoint = NBBO mid |
   | Pegged with discretion (IEX D-Limit, Nasdaq M-ELO) | floating + asymmetric ref | anti-toxicity |
   | Iceberg / Reserve / Display+Reserve | partial disclosure | min-display rules |
   | All-or-None (AON) / Minimum-Quantity (MQT) | execution-quantity gates | |
   | Time-in-Force: Day, IOC, FOK, GTC, GTD, GTX (extended), Auction-only | duration | |

   Document the **interaction matrix** — what happens when a midpoint-peg meets a hidden iceberg meets an IOC sweep? This is where bugs live. See `/matching-engine-invariants`.

8. **Self-trade prevention (STP)** — FINRA Rule 5210 / CME Rule 534 forbid wash trades:

   | STP mode | Behavior |
   |---|---|
   | Cancel Newest (CN) | new order canceled if would cross own resting |
   | Cancel Oldest (CO) | resting canceled, new order proceeds |
   | Cancel Both (CB) | both canceled |
   | Decrement-and-Cancel (DC) | both reduced by min(quantity); remainder rests |

   Required on every venue. Configure per-firm-ID or per-account-ID. Document handling in disclosed rulebook.

9. **NBBO / Order Protection (Rule 611) interaction**:
   - US Reg NMS Rule 611: no trade-through of a protected quote (Top of Book of automated venues, disseminated via SIPs CTA / UTP).
   - Intermarket Sweep Order (ISO) exempts member from trade-through by representing they've simultaneously routed to protected venues.
   - "Locked" market (bid = offer): exchange must avoid displaying lockable quotes (Rule 610). Crossed market: similar.
   - For non-NMS / non-US: venue stands alone; document own best-price policy.

10. **Pre-trade and post-trade transparency**:
    - **Pre-trade**: Reg NMS for NMS stocks (display via SIP); MiFID II RTS 1 for EU equities + RTS 2 for non-equities + waivers (LIS, NT, OMF, RPW); ATSs use ATS-N to disclose what's displayed.
    - **Post-trade**: trade reporting to SIP / TRF (FINRA) within 10 seconds (Rule 7130); MiFID II near-real-time + APA mechanism; CFTC Part 43 swap public dissemination.
    - Deferred publication windows for block trades (MiFID II LIS deferrals).

11. **Member / participant model**:
    - Direct members (SEC: BD with FINRA membership; SEF: ECP swap participants; DCM: clearing FCM).
    - Sponsored access (15c3-5 — broker takes risk for non-BD client).
    - Co-location + proximity hosting (Rule 610A fair-access for ATS).
    - DMA / SMA distinction.
    - Tier program (fee maker-taker, inverted, flat); maker-taker rebates as competitive lever.

12. **Surveillance baseline** — every microstructure choice creates a surveillance obligation (FINRA Rule 3110 / MAR Art 16 / CFTC §4c(a)):
    - Layering / spoofing detection (cancel-to-trade ratios, momentum-ignition patterns).
    - Marking the close (auction-period concentration).
    - Wash-trade and matched-trade detection.
    - Front-running / quote-fade vs liquidity-removal.
    - Cross-product manipulation (cash vs futures arb manipulation).
    - Reg SHO short-sale flagging (longs vs shorts vs short-exempt).

13. **Fee schedule** — design with intent:
    - Maker-taker (standard), inverted (taker rebates), flat, pro-rata-tiered, opening-priority fee.
    - Tier breakpoints by % ADV.
    - Auction fee differentials.
    - Filed with SEC under Rule 19b-4 (immediate effectiveness for fee changes typically).
    - Document in rulebook + member notices.

14. **Rulebook + filing artifacts** — the design isn't done until paper exists:
    - Exchange Form 1 (SEC) — full exchange registration. ATS: Form ATS / ATS-N.
    - SEF: Form SEF (CFTC). DCM: §38.3 application.
    - Rulebook chapters: Membership, Trading, Order Types, Halts, Surveillance, Disciplinary, Listings (if exchange).
    - SRO rule-filing pipeline: SR-filings with 60-day SEC review (or immediate effectiveness for narrow categories).

15. **Anti-patterns**:
    - "We'll figure out queue priority later." — Day-1 members ask, day-1 you must answer in writing.
    - "Sub-penny is fine, more granular = better." — Reg NMS prohibits sub-penny displayed orders ≥$1; institutional flow flees.
    - "We added a midpoint order type without IOC interaction rules." — silent priority inversion; surveillance dies.
    - "Halts are vendor concern." — halts are **your** rule; you publish + apply, vendor only reflects.
    - "We disclose only 'price-time' generically." — Reg ATS Rule 301 and MiFID II require *specific* matching policy disclosure.
    - "Crypto so we skip circuit breakers." — at first flash-crash, regulators ask why none; design + publish your halt policy day-1.
    - "Self-trade prevention is a client-side problem." — wash trades are venue-level FINRA Rule 5210 / CME 534 prohibitions; must be enforced at the book.

## Output

Write `docs/design/market-microstructure-<project>.md`:

```markdown
# Market Microstructure — <project>
**Date:** <YYYY-MM-DD> | **Venue type:** <Exchange / ATS / SEF / DCM / MTF / crypto>
**Regulator:** <SEC / CFTC / FCA / ESMA / MAS / venue-self> | **Rulebook ref:** <path>

## Order-book model
- Continuous CLOB + closing-cross periodic auction
- Dark midpoint pool (separate book, ref = SIP NBBO mid)
- Auction cycle: opening 09:30:00.000 ET; closing 16:00:00.000 ET; imbalance disseminated T-10:00

## Matching algorithm
- **Continuous book:** Price-Time (FIFO)
- **Auction:** maximum-volume uncrossing; ties broken by time
- **Dark pool:** Price-Time at NBBO midpoint; min-quantity gate $100k notional
- Rationale: <documented in rulebook §3.2>
- Self-trade prevention: Cancel-Newest default; member-configurable to CO / CB / DC

## Tick size
| Price band | Tick |
|---|---|
| ≥ $1.00 | $0.01 (or $0.005 for SEC-designated tick-constrained list 2025+) |
| < $1.00 | $0.0001 |
| Sub-penny midpoint orders | allowed at $0.0001 increments |

## Lot size + odd-lot
- Round lot: tiered per SEC 2024 amendment — 100 / 40 / 10 / 1 by price band
- Odd-lot quotation feed: included in SIP per Rule 600 amendments
- Better-priced odd lots: protected under Rule 611 enhancement

## Trading hours
| Session | Hours | Order types accepted |
|---|---|---|
| Pre-market | 04:00–09:30 ET | Limit / IOC only |
| Opening auction | 09:30:00 ET | MOO / LOO / continuous-priced orders |
| Continuous | 09:30:00–15:55:00 ET | full set |
| Closing auction | 16:00:00 ET | MOC / LOC + continuous |
| After-hours | 16:00–20:00 ET | Limit / IOC only |

## Volatility controls
- **LULD bands**: Tier 1 ±5%, Tier 2 ±10%, sub-$3 ±20% or $0.15; 5-min reference price; 5-min pause
- **MWCB**: Levels 1 (−7%), 2 (−13%), 3 (−20%)
- **Single-stock halts**: news-pending; regulatory; related-security
- **Custom rule-based halts**: <add e.g. closing-cross imbalance halt, IPO threshold>

## Order types + TIF
| Type | TIF allowed | Routes? |
|---|---|---|
| Limit | Day, IOC, FOK, GTC, GTD, EXT | yes (ISO option) |
| Market | Day, IOC | yes (with route-or-cancel rule) |
| Midpoint Peg | Day, IOC | no (dark) |
| Iceberg (min-display = max(round-lot, 100)) | Day, GTC | yes |
| MOO / LOO / MOC / LOC | auction-only | n/a |
| D-Peg-like (crumbling-quote signal aware) | Day | no |

## NBBO + protection
- Trade-through compliance per Rule 611
- ISO acceptance + tagging
- Locked/crossed market avoidance per Rule 610

## Pre-/post-trade transparency
- Pre-trade: top-of-book + 5 levels via direct feed; SIP submission for protected quotes
- Post-trade: trade dissemination ≤10s to SIP / TRF
- Block-trade reporting: timely per FINRA Rule 7130 with permitted print delays

## Member model
- Direct members: BD with FINRA membership
- Sponsored access: per 15c3-5 risk-check requirement
- Co-lo + proximity offered at <NJ4 / equivalent>; fair-access policy under Rule 610A

## Fee schedule (Rule 19b-4 filed)
- Maker rebate: ($0.0030)
- Taker fee: $0.0028
- Tier 1 (>1% ADV): maker rebate ($0.0034)
- Opening / Closing auction: $0.0000

## Surveillance hooks
- Real-time: layering, spoofing, momentum ignition, marking-close concentration
- T+1: cross-venue wash, Reg SHO breaches, opening-cross integrity
- Vendor: <Nasdaq SMARTS / Trillium Surveyor / in-house>
- Reporting: STORs (if EU dual-listed), CAT submission

## Connectivity
- FIX 4.4 (gateway-level) for buy-side
- Native binary order entry (OUCH-style) for HFT
- ITCH-style market data (level-3 by-order)
- Drop-copy via FIX 4.4 with delivery SLA <100ms

## Capacity / latency budget
- Matching kernel p50 / p99: <10µs / <100µs (co-lo'd)
- Gateway round-trip p99: <500µs
- Market-data tick-to-trade fan-out p99: <50µs
- Day capacity: 50M orders / 5M executions baseline

## Rulebook filing artifacts
- SR filings drafted: §3 (Trading), §4 (Order Types), §5 (Halts), §7 (Fees)
- ATS-N (if ATS): drafted and reviewed by counsel
- Member notices: <NTM-2026-001 quarterly cadence>

## Open design questions
- <items>

## Effort + cost band
| Activity | Estimate |
|---|--:|
| Microstructure design + rulebook drafting | 6–12 weeks (with outside counsel) |
| Matching engine spec → impl handoff | 12–24 weeks |
| Surveillance setup | 12–16 weeks (parallel) |
| SEC / CFTC / SRO rule filing | 60–180 days post-filing |
| Connectivity certification (FIX / native) | 8–12 weeks |
| Total to first live trade | 9–24 months end-to-end |
```

## Verification
- Matching algorithm and queue-priority policy are stated in writing and consistent with rulebook.
- Tick size table is reconciled with Reg NMS Rule 612 (US) or RTS 11 (EU); sub-penny rules respected.
- LULD / MWCB / single-stock halt rules are defined for every product class.
- Order-type interaction matrix (midpoint × iceberg × IOC × ISO × peg) reviewed and edge cases documented.
- Self-trade prevention configured at venue level (not member-only) and disclosed.
- Pre- and post-trade transparency obligations mapped to specific feed publication SLAs.
- Surveillance baseline addresses layering / spoofing / wash / marking-close minimums.
