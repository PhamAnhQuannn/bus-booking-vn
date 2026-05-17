---
name: matching-engine-invariants
description: Matching-engine correctness invariants — deterministic replay, cancel-replace atomicity, no-cross / no-trade-through, PriceCheckHi/Lo, pre-/post-trade risk gates, throttle + fat-finger, self-trade prevention, multi-account allocation atomicity, IOC/FOK/GTC time-in-force semantics. Outputs to `docs/design/matching-engine-invariants-<project>.md`. Reads `/project-classify` to skip XS only (S+ in scope). Use when user says "matching engine", "order book correctness", "deterministic replay", "cancel-replace", "trade-through", "self-trade prevention", "IOC FOK", "fat finger", "/matching-engine-invariants", or before writing matching kernel / before first prod trade. Pairs with `/market-microstructure-design` (policy), `/court-admissible-logging` (records), `/regulator-relations-trading` (15c3-5).
output_size:
  XS: skip
  S: 1h
  M: 2h
  L: 4h
  XL: 8h
---

# /matching-engine-invariants — Matching-Engine Correctness Contract

Invoke as `/matching-engine-invariants`. The matching engine is the only system in your stack where a 1-in-10⁹ race condition is a regulator finding, a class-action, and a margin call all at once. Specify the invariants before you write the kernel.

## Why you'd care
Matching engines fail in ways no other system fails: a duplicate fill is not "a bug to schedule" — it is a position you do not own that you must immediately bust or honor, a wash-trade you cannot defend, and a record you cannot reconstruct. The 2010 Flash Crash, 2012 Knight Capital ($440M / 45 min), 2013 Goldman options misroute, 2015 BATS opening-cross, 2020 IEX feed gap — every one was an invariant violation that passed code review and unit tests. The invariants in this doc are the non-negotiable contract.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS → SKIP; S+ → run (matching kernel is correctness-critical at any scale).
2. Read `docs/design/market-microstructure-<project>.md` for policy (tick, lot, matching algorithm, halts).
3. Read `docs/compliance/regulator-relations-trading-<project>.md` for 15c3-5 + Reg NMS posture.
4. Read `docs/compliance/court-admissible-logging-<project>.md` for replay / records linkage.
5. Confirm language + runtime (typically a single-threaded event-loop in C++ / Rust / Java with off-heap data structures).

## Inputs
- Order-book model + matching algorithm chosen.
- Product set (equities / options / futures / FX / crypto / swap).
- Latency budget (matching kernel p99 target).
- Multi-leg / spread products (Y/N).
- Cross-product / multi-account allocation (Y/N).
- Risk-gate vendor (in-house / Adenza / FlexTrade / DASH).
- Reg constraints: 15c3-5 (US BD), MiFID II Art 17 RTS 6 (EU), CFTC Reg AT (proposed; observe principles).

## Process

1. **Determinism + replay invariant** — the cornerstone:
   - Input event stream is the **only** source of state.
   - Given the same input sequence + same starting snapshot, output sequence is byte-identical.
   - Pin all sources of non-determinism: no wall-clock reads (use deterministic logical clock or read-timestamps from inputs), no random (seed from input), no thread-local state, no map/hash with random seed, no float-rounding mode drift.
   - Snapshot cadence: every N events or every wall-clock T; replayable from (snapshot_n + events_n+1..) → state_m.
   - **Invariant DR-1:** replay(snapshot, events) ≡ original state at end of events.
   - **Invariant DR-2:** snapshot is canonicalized (RFC 8785 JCS / Cap'n Proto / FlatBuffers fixed) so cross-machine replay is byte-identical.
   - Test: nightly replay of full prior day's tape against fresh process; fail build on hash divergence.

2. **Event ordering + sequence-number invariant**:
   - Every input event has a monotonically increasing sequence number assigned at the **single ingress** (gateway aggregator).
   - Matching kernel consumes in seq order; no out-of-order processing.
   - **Invariant SEQ-1:** seq(n+1) = seq(n) + 1, no gaps.
   - **Invariant SEQ-2:** kernel.last_processed_seq advances monotonically.
   - **Invariant SEQ-3:** market-data feed seq advances monotonically per channel; consumers detect gap → request retransmission.
   - Reg context: CAT linkage requires monotonic event chain; FIX 4.4 gap-fill protocol.

3. **Cancel-replace atomicity invariant**:
   - "Replace" is either (a) cancel-old-then-new-with-priority-loss or (b) modify-in-place with priority-preserve-if-price-unchanged-and-size-decreased.
   - FIX Order Cancel/Replace Request (35=G) semantics: same `ClOrdID` chain.
   - **Invariant CR-1:** A replace either fully succeeds (old removed, new placed) or fully fails (old remains); no partial state where both exist.
   - **Invariant CR-2:** Priority preservation rules are deterministic — same price + same-or-decreased size = keep priority; price change OR size increase = lose priority.
   - **Invariant CR-3:** Cross-cancel safety — if old has partially filled at cancel time, replace `OrderQty` minus already-filled = remaining; cannot go negative.
   - This is where Knight Capital broke (different code-path activation = uncontrolled state).

4. **No-cross + no-trade-through invariants**:
   - **Invariant NC-1:** book never publishes a crossed quote (best_bid ≥ best_ask).
   - **Invariant NC-2:** book never publishes a locked quote (best_bid = best_ask) unless venue policy allows; Reg NMS Rule 610 prohibits.
   - **Invariant TT-1 (Reg NMS only):** kernel does not execute at a price worse than NBBO unless an ISO is present (Rule 611).
   - **Invariant TT-2:** if NBBO data feed gaps, kernel either pauses or routes via configured fallback per pre-declared policy. Document the fallback explicitly.

5. **PriceCheckHi / PriceCheckLo guards**:
   - Pre-trade: incoming order price within ±X% of reference (last trade / NBBO mid / closing price). Reject + log if outside.
   - Per-product configurable: 5% for liquid US equities; 0.25% for treasuries; 20% for low-priced.
   - 15c3-5 requirement: erroneous-order controls.
   - **Invariant PC-1:** No order passes risk gate with price outside band without manual override + override log.
   - **Invariant PC-2:** Reference price update is atomic; window-edge orders see consistent ref.

6. **Quantity guards (fat-finger)**:
   - Max-shares per order (e.g., 100k).
   - Max-notional per order (e.g., $10M).
   - Max-order-rate per session-id (e.g., 1000/sec).
   - Max-cancels-per-second (anti-momentum-ignition; FINRA / SEC look at cancel-to-trade ratio).
   - **Invariant QG-1:** Reject + log every breach; surveillance alerts on rejected-fat-finger events (often signal of compromised credentials).

7. **Pre-trade vs post-trade risk gates**:
   - **Pre-trade** (15c3-5): every order checked before reaching book. Latency budget very tight (single-digit µs).
   - **Post-trade**: position-limit, mark-to-market margin, P&L breach. Slower OK (ms).
   - Both required; pre-trade is the gate, post-trade is the watchdog.
   - **Invariant RG-1:** Pre-trade gate is in the **synchronous critical path**, not async.
   - **Invariant RG-2:** Gate failure (vendor down, latency exceeded) → fail-closed (reject) not fail-open (accept).
   - **Invariant RG-3:** Override exists, requires named-approver-id, fully logged, time-boxed.

8. **Throttle + DoS protection**:
   - Per-session order-entry rate limit. Backpressure at gateway, not at kernel.
   - Burst budget + sustained budget (token bucket).
   - Per-product saturation: market-wide message rate target with QoS demotion.
   - **Invariant TH-1:** kernel is never blocked by gateway throttle; gateway absorbs.

9. **Self-trade prevention (STP) invariants** — FINRA Rule 5210 / CME Rule 534:
   - Each order tagged with prevention-key (typically firm-id or sub-account-id).
   - **Invariant STP-1:** If incoming aggressor would cross with rester having same prevention-key, apply configured mode (CN / CO / CB / DC). Configurable per-firm; default Cancel-Newest.
   - **Invariant STP-2:** STP application is logged as a discrete event (regulators ask for the STP log).
   - **Invariant STP-3:** STP does not change book state mid-match in a way that violates time-priority for *other* parties.

10. **Multi-account allocation atomicity** (institutional / give-up trades):
    - Block trade fills, then allocates across N sub-accounts per pre-disclosed scheme (pro-rata, prioritization, average price).
    - **Invariant ALLOC-1:** Σ(allocations) = Σ(fills). No allocation "lost" or "added."
    - **Invariant ALLOC-2:** Average-price allocation: each sub-account gets weighted-average; weights sum = 1.
    - **Invariant ALLOC-3:** Post-allocation, no sub-account allocation is later modified (re-allocation prohibited under FINRA Rule 5320 / SEC Rule 10b-10 unless error-correction with disclosure).

11. **Time-in-force semantics — IOC / FOK / GTC / GTD / Day / MOO / MOC**:
    - **IOC (Immediate-or-Cancel)** — match what you can, cancel the rest immediately. No book rest.
    - **FOK (Fill-or-Kill)** — match the full quantity at the limit price or better immediately, or cancel entirely. All-or-nothing.
    - **Day** — rest until end of session; cancel at session close.
    - **GTC (Good-til-Cancel)** — rest across sessions until matched, replaced, or canceled.
    - **GTD (Good-til-Date)** — explicit expiry timestamp.
    - **MOO (Market-on-Open)** — auction-only, opening cross.
    - **MOC (Market-on-Close)** — auction-only, closing cross.
    - **LOO / LOC** — limit version of above.
    - **AT-THE-OPENING** — opening cross + immediate cancel if not filled.
    - **Invariant TIF-1:** Each order has exactly one TIF that cannot be mutated post-acceptance (replace = new order semantically).
    - **Invariant TIF-2:** IOC cannot rest. Bug = silent over-resting on a "fast-cancel" path.
    - **Invariant TIF-3:** FOK is all-or-none; partial-fill-on-FOK is a defect.
    - **Invariant TIF-4:** Session boundaries clear Day orders; cross-session orders explicitly tagged GTC/GTD.

12. **Iceberg / reserve / hidden order invariants**:
    - Displayed slice rests at displayed quantity; replenished from reserve when displayed exhausted.
    - **Invariant ICE-1:** Replenishment is deterministic (time-stamped at original or at slice-replenish per policy; document which).
    - **Invariant ICE-2:** Hidden quantity is never displayed in market-data; surveillance audit log records full state.
    - **Invariant ICE-3:** Cross-priority — at the same price, displayed beats hidden of same time; pure hidden orders rank last unless policy says otherwise.

13. **Halt / pause state invariants**:
    - **Invariant HALT-1:** Halt is a kernel state; on entry, no new matches; new orders accepted to book OR rejected per policy.
    - **Invariant HALT-2:** Halt resume → opening-auction-like uncrossing OR continuous-resume per policy; document.
    - **Invariant HALT-3:** LULD Limit-State entry → only book-improving orders accepted (no aggressor through band).
    - **Invariant HALT-4:** MWCB → all matching halted across all products; state preserved for resume.

14. **Crash + recovery invariants**:
    - Kernel persists every accepted event to durable log before acknowledgement (log-before-ack).
    - **Invariant CR-1:** On restart, kernel replays from last snapshot + WAL → identical state.
    - **Invariant CR-2:** Acked orders that did not produce side-effects (e.g., crash mid-match) are re-played and reproduce identical outcome (idempotency at event level).
    - **Invariant CR-3:** No fill is observed by counterparty without being durable in records (no acknowledge-before-persist).
    - Hot-standby: leader-follower with consensus (Raft / Aeron Cluster); follower mirrors event log + state.

15. **Surveillance hooks**:
    - Every order, modify, cancel, execution emits an audit event with sequence number, timestamp, actor, price, qty, book-state-hash.
    - Cancel-to-trade ratio computed per session per product; threshold alerts (layering / spoofing).
    - Marking-the-close concentration alerts.
    - Cross-product reference-data integrity alerts.

16. **Property-based + simulation testing**:
    - **Property 1:** for any valid input sequence, no invariant above is violated.
    - **Property 2:** total quantity conservation — `Σ(buy fills) = Σ(sell fills)` per product per session.
    - **Property 3:** notional conservation — `Σ(price × qty) for buys = Σ(price × qty) for sells`.
    - **Property 4:** book monotonicity at the level — best_bid never decreases on a buy-add at higher price; best_ask never increases on a sell-add at lower price.
    - Tooling: QuickCheck-style (Rust `proptest`, Haskell QuickCheck, jqwik). Sustained chaos sim with 10⁹+ event runs before production.
    - Conformance test suite (CTS): every order type × every TIF × every state transition. CME, NASDAQ, IEX all publish CTS schemas; mirror for your venue.

17. **Anti-patterns**:
    - "We use threads for parallelism in the matcher." Non-deterministic; cannot replay. Use single-thread or strict input partitioning.
    - "Pre-trade risk-checks are async to keep matcher fast." 15c3-5 violation; risk-check must be synchronous in critical path.
    - "We swallow STP cancellations to keep the trade tape clean." Surveillance dies; regulators ask.
    - "We allow a partial fill on FOK if the rest cancels immediately." Defect; FOK is all-or-none.
    - "Replay uses production wall-clock for timestamps." Non-deterministic across runs.
    - "Our matcher rounds floats — IEEE 754 is everywhere." Use fixed-point integers for price × qty; never float in match path.
    - "Cancel-replace just deletes and inserts." Loses priority-preserve cases; member complaints + queue-jumping perception.
    - "Halt entry leaves resting orders eligible for matching." Bug; halt must freeze the book.
    - "We can fix a duplicate fill with a manual bust." Manual busts (FINRA Clearly Erroneous Execution rules) are last resort, not normal control.

## Output

Write `docs/design/matching-engine-invariants-<project>.md`:

```markdown
# Matching Engine Invariants — <project>
**Date:** <YYYY-MM-DD> | **Owner:** <Trading Tech lead + Architect>
**Engine:** <name> | **Language / runtime:** <C++ / Rust / Java + GC tuning>

## Determinism
- Single-threaded event loop per product partition
- Logical clock: ingress sequence number; no wall-clock in match path
- RNG: not used in match path (seeded only for non-critical analytics)
- Float: prohibited in match path; fixed-point i64 for price × qty
- Serialization: <Cap'n Proto / FlatBuffers / SBE — pinned schema>

## Snapshot + replay
- Snapshot cadence: every 100k events OR every 60s, whichever first
- Snapshot format: canonicalized; hash recorded
- Replay test: nightly full-tape against fresh kernel; fail build on hash divergence
- DR-1 / DR-2 invariants verified

## Event ingress
- Single gateway aggregator assigns monotonic seq
- Per-product partition (sharded by symbol hash)
- Within partition: strict FIFO
- Cross-partition events (e.g., spread products) handled by joint-clock protocol

## Order types supported
| Type | TIF | Risk-gate | Notes |
|---|---|---|---|
| Limit | Day/GTC/GTD/IOC/FOK | full | core |
| Market | Day/IOC | full + erroneous-price | route-or-cancel |
| Iceberg | Day/GTC | full | min-display = round-lot |
| Midpoint Peg | Day/IOC | full | reference = NBBO mid |
| MOO/LOO | auction | full | auction-only |
| MOC/LOC | auction | full | auction-only |
| ISO (Reg NMS) | IOC | full + ISO-flag-validation | venue tags |

## Pre-trade risk gates (15c3-5)
| Gate | Window | Action |
|---|---|---|
| Erroneous-price (vs NBBO ±%) | per-symbol band table | reject + log |
| Erroneous-size (max shares + max notional) | per-symbol config | reject + log |
| Per-customer credit limit | per-customer | reject + log |
| Firm credit limit | firm-wide | reject + halt session |
| Duplicate-order (hash 5-tuple, 50ms window) | per-session | reject + log |
| Reg SHO locate check | order-time | reject if uncovered |
| Restricted-list | order-time | reject + log |
| Order rate (token bucket) | per-session | reject overflow + log |
| Cancel rate | per-session | warn at 5x trade ratio |

## Self-trade prevention
- Default mode: Cancel-Newest
- Member-configurable: CO / CB / DC
- Tag key: firm_id + sub_account_id; configurable to session-id only
- STP-1 / STP-2 / STP-3 invariants verified

## Halt + LULD behavior
- HALT-1..4 invariants verified
- LULD Limit-State: book-improving aggressors only
- MWCB: all match halted; book frozen; resume via opening-cross-like uncross

## Allocation atomicity (block trades)
- Pre-disclosed allocation scheme per parent order
- Average-price computed at fill; allocated immediately on fill or at session close per scheme
- ALLOC-1..3 invariants verified
- Re-allocation prohibited absent error-correction process

## Cancel-replace semantics
- Same-price + same-or-decreased size = priority preserved
- Price change OR size increase = priority lost (new timestamp)
- Atomic: never observable as both-old-and-new present
- CR-1..3 invariants verified

## Crash + recovery
- WAL: every accepted event persisted before ack
- Leader-follower via <Raft / Aeron Cluster>
- Recovery test: nightly kill-and-restore; verify state hash matches
- CR-1..3 invariants verified

## Property tests
- Tool: <Rust proptest / jqwik / Hypothesis>
- Runs: 10⁹+ events nightly; 10⁷+ pre-merge
- Invariants checked: every numbered invariant in this doc

## Conformance test suite (CTS)
- Coverage: every order-type × every TIF × every state transition × every reject reason
- Schema: <internal / mirror of CME iLink CTS / Nasdaq OUCH CTS>
- Re-run on every release candidate

## Latency budget
- p50 / p99 in-kernel match: <µs> / <µs>
- p50 / p99 gateway-to-ack: <µs> / <µs>
- Risk-gate budget: <µs> per check
- Tail-jitter alarm: <ms>

## Surveillance event emission
- Per-event audit record with seq, ts, actor, side, price, qty, book-hash
- Linkage to <court-admissible-logging> chain (per-record-class)
- Real-time tap to surveillance engine <vendor / in-house>

## Operational runbooks
- Bad-order bust process (FINRA Clearly Erroneous Execution Rule 11.890 / similar)
- Mass-cancel-on-disconnect (FIX MassCancelRequest)
- Halt-resume drill (quarterly)
- Failover drill (quarterly)
- Replay-divergence incident response (P1)

## Open items
- <items>
```

## Verification
- Every numbered invariant in the doc maps to a property test or conformance test.
- Replay test runs nightly with byte-identical state-hash check.
- Pre-trade risk gates are synchronous in match-path and fail-closed on vendor / latency timeout.
- Self-trade-prevention default + override modes configured per-firm and logged.
- Cancel-replace atomicity proven by chaos-sim (no dual-existence window observed in 10⁸ trials).
- Halt + LULD + MWCB behaviors exercised in a quarterly drill.
- Conformance test suite (CTS) covers every order-type × TIF × state-transition.
