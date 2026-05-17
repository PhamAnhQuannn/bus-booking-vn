---
name: deterministic-replay-design
description: Event-sourced trading system replay architecture — total-order log (Kafka log compaction / Aeron Archive), snapshot+log pattern, canonical state machine, FIX session replay, idempotent message replay rules, gap-detection via sequence number, reconciliation against exchange drop-copy reports, trade-break investigation runbook. Outputs to `docs/design/deterministic-replay-<project>.md`. Reads `/project-classify` to skip XS+S+M. Use when user says "event sourcing", "replay log", "Kafka log compaction", "Aeron archive", "FIX replay", "drop copy reconciliation", "trade break investigation", "gap detection", "sequence number gap", "/deterministic-replay-design", or before standing up matching kernel / OMS / EMS / smart order router. Pairs with `/matching-engine-invariants` (correctness contract), `/court-admissible-logging` (evidence-grade retention), `/regulator-relations-trading` (reg replay obligations).
output_size:
  XS: skip
  S: skip
  M: skip
  L: 4h
  XL: 8h
---

# /deterministic-replay-design — Event-Sourced Trading System Replay Architecture

Invoke as `/deterministic-replay-design`. The matching engine's correctness contract (`/matching-engine-invariants`) demands that `replay(snapshot, events) ≡ state`. This skill designs the surrounding plumbing — the total-order log, the snapshot cadence, the FIX session re-sequencer, the drop-copy reconciler, and the trade-break runbook — so that contract actually holds in production under partial failure, restart, regulator subpoena, and disputed fill.

## Why you'd care
Trading systems live or die by replayability. When a customer disputes a fill, a regulator subpoenas history, or your matching kernel crashes mid-session, you need to reproduce every state byte-identically from a known prefix. Without a deterministic replay design, you get: 4-hour outages because the snapshot disagrees with the log, multi-million-dollar trade breaks that can't be reconciled to exchange reports, and a CAT data-quality letter you can't answer. With one: bring up a fresh kernel in <60s, prove every fill from its source event, and answer the regulator in 24h instead of 30 days.

## Effort caveat — regulator + venue timelines dominate
- **FINRA exam cycle:** 12 months between routine BD/ATS exams; deficiency response 30 calendar days
- **SEC OCIE (now Examinations Division):** 24-month average cycle for medium BD/ATS, 36+ for SCI entities
- **CAT reprocessing window:** corrections accepted T+5 calendar days; >T+5 = DQ letter
- **Drop-copy reconciliation SLA (typical exchange):** T+1 end-of-day match; breaks escalate at T+2
- **Litigation hold replay requests:** counsel typically asks for "from session start to event N" with 7-14 day turnaround; you can't negotiate this down
- **FIX 4.2/4.4 ResendRequest window:** session-level, must respond within session-recovery timeout (usually 30s) or counterparty drops session
- Real-world: greenfield event-sourced OMS → first reliable replay takes 4-6 months of L/XL effort; do not under-budget snapshot canonicalization

## Pre-flight
1. Read `docs/classify/<project>.md`. XS/S/M → SKIP. This is L/XL-class infrastructure for venues, broker-dealers, prop shops, market-makers.
2. Read `docs/design/matching-engine-invariants-<project>.md` if matching kernel in scope — the DR-1/DR-2 invariants there are the contract this skill operationalizes.
3. Read `docs/compliance/court-admissible-logging-<project>.md` if regulated — WORM retention rules constrain log architecture.
4. Read `docs/compliance/regulator-relations-trading-<project>.md` for CAT / 15c3-5 / MiFID II RTS 6 obligations on replay completeness.
5. Confirm: is this a regulated venue/BD (SEC/CFTC/FINRA/FCA/ESMA), or unregulated (crypto, internal prop)? Determines retention floor + replay-SLA contract.

## Inputs
- Trading domain: cash equities / options / futures / FX / crypto / fixed-income / OTC swaps — drives message rates + retention
- Throughput targets: peak msg/sec ingress, peak msg/sec replay (often 10-100× live)
- Counterparties: client OMSs (FIX), market-data feeds, drop-copy from exchange, internal smart router, risk gateway
- Retention floor: 7 yr (SEC Rule 17a-4), 5 yr (MiFID II RTS 6), 5 yr (CFTC Reg 1.31), 5 yr from creation + 2 yr post-account-close
- Determinism budget: how much wall-clock can a full session replay take vs original? (typical: ≤2× wall-clock for L, ≤1× for XL hot-replay)
- Failover model: cold restart, warm-standby, hot-hot, Raft/Paxos quorum

## Process

1. **Pick the total-order log substrate** — this is the load-bearing decision:

   | Substrate | Strengths | Weaknesses | Where used |
   |---|---|---|---|
   | **Apache Kafka + log compaction** | Battle-tested, partition scaling, tiered storage, ecosystem | µs latency floor ~1ms, partition order ≠ total order | Coinbase, Robinhood OMS, most crypto venues |
   | **Aeron + Aeron Archive** | <10µs publication, archive replay-by-position, RAFT cluster | Smaller ops community, JVM-centric, less ecosystem | LMAX Exchange, Adaptive, Hydra, IG Group |
   | **Chronicle Queue** | µs persistence, off-heap, replicable | Single-writer/partition, JVM-centric | Bank prop desks, HFT shops |
   | **AWS Kinesis / GCP Pub-Sub** | Managed, autoscale | ms latency, no log compaction equivalent, ordering caveats | Avoid for hot trading path; OK for downstream analytics |
   | **Custom WAL + replication** | Total control, no JVM | You will rebuild Aeron poorly | Avoid unless team has 5+ yrs of distributed-log experience |

   Default for crypto/HFT: Aeron + Aeron Archive. Default for cash equities BD/ATS at moderate rate: Kafka with single-partition-per-instrument + log compaction for snapshot state. Document the choice.

2. **Establish the canonical event schema** — replay determinism dies in serialization drift:
   - Schema registry mandatory (Confluent Schema Registry, Buf Schema Registry, or homegrown with version pins)
   - Wire format: FlatBuffers, Cap'n Proto, SBE (Simple Binary Encoding) — NOT JSON, NOT Protobuf-without-canonical, NOT Avro-without-fixed-default-handling
   - Every event has: `seq_no` (monotonic), `event_id` (UUID v7), `partition_key` (instrument / account), `wall_clock_ns`, `logical_clock` (Lamport or hybrid logical clock), `producer_id`, `schema_version`
   - **Canonicalization rule (per RFC 8785 JCS spirit, applied to binary):** field order frozen by schema, no optional fields with default-omission ambiguity, NaN forbidden, denormal floats forbidden, time always int64 nanoseconds UTC, decimals as int64 + scale (never float)
   - Schema evolution: additive only within major version. Major bump = new topic / partition family + replay-compatibility shim

3. **Snapshot + log discipline** — the only sane replay strategy at venue scale:
   - **Snapshot cadence:** every N events (typical N = 10M-100M) AND every wall-clock T (typical T = 1h-6h). Whichever fires first.
   - **Snapshot canonical form:** byte-identical regardless of which kernel instance produced it. Pre-image: full state machine (order books, position tables, risk counters, sequence numbers). Format: SBE / Cap'n Proto frozen schema. Hash + sign + WORM-store.
   - **Snapshot proof:** every snapshot includes `(start_seq, end_seq, sha256(state), prev_snapshot_hash)` forming a hash chain. Verify on load.
   - **Log retention vs snapshot retention:** keep log forever (regulatory). Keep snapshots at decreasing density: hourly for 7d, daily for 90d, weekly for 7y. Log is authoritative; snapshots are accelerators.
   - **Replay equation (the contract):** `replay(snapshot_k, events[seq_k+1 .. seq_n]) ≡ state_n` — byte-identical state machine at end. Tested in CI on every kernel build.

4. **Kafka-specific patterns** if Kafka is the substrate:
   - One partition per instrument (NOT per account, NOT per session) — guarantees per-instrument total order for matching
   - **Log compaction** on snapshot topics keyed by `instrument:state-key`; retains latest snapshot per key
   - `min.insync.replicas=3`, `acks=all`, `enable.idempotence=true`, `max.in.flight=1` for producer to preserve order under retry
   - Offset-based replay: consumer commits the last applied `(topic, partition, offset)` atomically with state mutation (transactional outbox or Kafka Streams exactly-once-v2)
   - **Tiered storage** (Confluent or KIP-405 since 3.6) for cold log shifts old segments to S3/GCS; verify retrieval SLA < replay window
   - Drift hazard: brokers running different Kafka versions can produce subtly different compaction outputs; pin broker version in change control

5. **Aeron-specific patterns** if Aeron is the substrate:
   - **Aeron Archive** stores recordings of streams; replay by `(recordingId, position, length)` — no offset translation needed
   - **Cluster mode** (Aeron Cluster) gives Raft consensus across 3 or 5 nodes; leader appends, followers mirror, snapshots taken on quorum
   - Replay path: load latest snapshot → replay archive log from `snapshot.position + 1` → live position
   - **Position is authoritative; wall-clock is not.** Two clones with identical position must agree on state byte-for-byte
   - Recovery on restart is built-in: `ClusteredService.onLoadSnapshot()` + `onSessionMessage()` replay → live
   - Cold-archive eviction: write Aeron archive segments to S3/GCS on roll; recover on demand

6. **FIX session replay** — the wire protocol the exchange/counterparty actually speaks:
   - **Session level:** FIX 4.2/4.4 uses per-session `MsgSeqNum`. Gaps detected by counterparty's `ResendRequest (35=2)`. You MUST respond with original messages OR `SequenceReset-GapFill (35=4, 123=Y)` for admin messages
   - **Application messages:** never gap-fill — must resend original `NewOrderSingle`, `OrderCancelRequest`, `ExecutionReport` etc., reconstructed from the canonical event log
   - **PossDupFlag (43=Y)** mandatory on resends; counterparty deduplicates by `(SenderCompID, MsgSeqNum)` or `ClOrdID`
   - **PossResend (97=Y)** when message content is the same but business-level retransmission (different transport context)
   - **Logon recovery:** if local sequence number < expected, send `Logon (35=A, 141=Y)` with `ResetSeqNumFlag=Y` only with explicit operator approval — otherwise replay
   - Store every inbound FIX message verbatim (raw bytes) AND its parsed canonical event — never drop the wire form, regulators ask for it
   - Resend-window discipline: typical 30-60s before counterparty drops session; tune your replay path latency to fit

7. **Idempotent message replay rules** — when replay happens at any layer:
   - **Producer idempotence:** every message has `producer_msg_id` (UUID v7); downstream dedupes on this. Replays MUST reuse the original `producer_msg_id`, not generate new ones
   - **Consumer idempotence:** apply-once contract — consumer maintains `(producer_id → last_applied_seq)` map; rejects already-applied
   - **Side effects:** all external calls (post to drop-copy bus, ack to FIX counterparty, position update to risk) gated through outbox table flushed atomically with state mutation; replay reads outbox status, doesn't re-emit
   - **Acks must be replay-safe:** if you ack a FIX `ExecutionReport` once with `ExecID=E1`, replay must produce the same `ExecID=E1` (deterministic derivation, not RNG)
   - **Wall-clock-derived fields:** `TransactTime`, `SendingTime` etc. derive from the canonical event's `wall_clock_ns` — NEVER `now()` at replay time

8. **Gap detection** — find missing events before regulators do:
   - **Per-producer sequence:** every producer emits monotonic `seq_no`; consumer detects gap as `seq_n+1 ≠ last_seq + 1` → halt + alert
   - **Heartbeat sequence:** producers emit `Heartbeat` event every 1s with current `seq_no` even when idle — detects silent-producer failure
   - **End-of-day reconciliation:** total events ingressed vs total events in archive vs total events in WORM tier, per topic/instrument
   - **Drop-copy gap detection:** exchange drop-copy is independent ground-truth; if exchange says you sent 1,247 orders today and your log says 1,246 → gap. Investigate before sleep.
   - **Tooling:** dedicated gap-scanner daemon, runs continuously, page on first detected gap

9. **Drop-copy reconciliation** — the daily forcing function:
   - **What it is:** exchanges (CME, NYSE, NASDAQ, ICE, LME, Eurex) provide a real-time or end-of-day copy of every order/cancel/modify/fill they processed for your firm
   - **Reconciler architecture:** ingest drop-copy stream → canonical event form → diff against internal event log keyed on `(exchange_order_id, ClOrdID, ExecID)`
   - **Match buckets:** EXACT-MATCH, MATCH-WITH-FIELD-DIFF (which fields?), UNMATCHED-INTERNAL (we sent, they didn't ack), UNMATCHED-EXCHANGE (they have, we don't)
   - **SLA:** EOD T+1 cutoff; UNMATCHED-EXCHANGE = immediate page (silent kill of internal copy = real exposure)
   - **Output:** reconciliation report into evidence locker (per `/court-admissible-logging`); exception aging dashboard
   - **Anti-pattern:** "we'll reconcile if a customer complains" — by then your CAT report is wrong, FINRA opens a 5210 review, and your BD is in deficiency

10. **Replay-driven testing in CI** — the contract enforced on every kernel commit:
    - **Property test:** `for all valid event_sequences: replay(snapshot, events) == state_after_live_apply(events)` (byte-equal)
    - **Snapshot crash-test:** kill kernel at random offset 1,000 times; recovery from each kill point → byte-identical state
    - **Schema-evolution test:** load N-1 schema snapshot → apply N events → snapshot → reload with N schema → equal
    - **Production replay drill:** monthly, restore a sealed production snapshot + N hours of log into staging cluster; diff state vs live. Block release on drift.
    - **Determinism budget:** track CI-measured `replay_time / live_time` per kernel version; alert on regression >10%

11. **Trade-break investigation runbook** — when a fill is disputed:
    - **T+0min:** receive break notice (customer ticket, drop-copy mismatch, regulator inquiry). Open incident.
    - **T+5min:** identify scope — single `ClOrdID`, single session, single instrument, or systemic?
    - **T+15min:** pull canonical event log slice covering claimed event ± 5min. Verify hash chain integrity (`/court-admissible-logging`).
    - **T+30min:** replay kernel from prior snapshot up to disputed event; compare produced `ExecutionReport` to disputed one. Mismatch = bug; match = customer/counterparty error.
    - **T+1h:** cross-check against exchange drop-copy. Three-way: internal log / kernel replay / exchange drop-copy. Majority wins; if all three differ, escalate to engineering + counsel.
    - **T+4h:** root cause narrative + remediation plan. If financial impact, page risk + treasury.
    - **T+24h:** customer/counterparty written response. Internal post-mortem within 5 business days.
    - **T+5d:** if exchange-side error, file claim via exchange dispute procedure (each venue has its own SLA). If internal error, file SEC Rule 17a-7 / FINRA 4530 self-report if threshold crossed.

12. **Retention + WORM coupling** — where this skill hands off to `/court-admissible-logging`:
    - Canonical event log goes to WORM (S3 Object Lock Compliance mode / Azure Immutable Blob / on-prem WORM appliance) within T+1
    - Snapshot files go to WORM same SLA
    - Hash-chain anchoring (Merkle root → RFC 3161 TSA per `/court-admissible-logging`) executes daily
    - Cold-tier replay budget: WORM retrieval must complete inside regulator-typical 30-day production window — load-test this quarterly

## Output

Write `docs/design/deterministic-replay-<project>.md`:

```markdown
# Deterministic Replay Design — <project>
**Date:** <YYYY-MM-DD> | **Owner:** Trading Infra + Engineering Lead | **Approved:** CTO + Head of Compliance <date>

## Scope
- In-scope kernels: <matching engine / OMS / EMS / SOR / risk gateway>
- Regulatory regime: <SEC 17a-4 / CFTC Reg 1.31 / MiFID II RTS 6 / FCA SYSC 9 / unregulated>
- Replay SLA contract: cold-start full session replay ≤ <N> hours; partial replay (last 24h) ≤ <M> minutes
- Determinism budget: `replay_time / live_time` ≤ <ratio>

## Total-order log substrate
- Substrate: <Aeron Cluster | Kafka log-compacted | Chronicle Queue>
- Partition key strategy: <one per instrument | one per session | one per account>
- Cluster topology: <3-node Raft | 5-node Raft | Kafka 3xRF MIR=2>
- Retention: hot tier <N days>, warm tier <M days>, cold WORM tier <7 years>
- Tiered storage destination: <S3 Object Lock | Azure Immutable Blob | on-prem WORM>

## Canonical event schema
- Wire format: <SBE / Cap'n Proto / FlatBuffers>
- Schema registry: <Confluent / Buf / homegrown> at <URL>
- Versioning policy: additive-only within major; major bump → new topic family
- Mandatory fields: seq_no, event_id (UUIDv7), partition_key, wall_clock_ns, logical_clock, producer_id, schema_version
- Canonicalization: field-order frozen, NaN/denormal forbidden, decimals = int64+scale, time = int64 ns UTC

## Snapshot + log discipline
- Snapshot cadence: every <N>M events OR every <T> hours, whichever first
- Snapshot format: <SBE-frozen / Cap'n Proto>; canonical bytes; SHA-256 + producer-key signature
- Snapshot chain: every snapshot includes prev_snapshot_hash → hash chain anchored to TSA daily
- Retention densities: hourly 7d / daily 90d / weekly 7y
- Replay contract: `replay(snapshot_k, events[k+1..n]) ≡ state_n` byte-equal, tested in CI

## Idempotent replay rules
- Producer messages carry `producer_msg_id` (UUIDv7); replay reuses, never regenerates
- Consumer state: `(producer_id → last_applied_seq)` table; reject already-applied
- Side-effect outbox: external emissions gated by outbox status; replay reads, doesn't re-emit
- Acks deterministic: ExecID/match-id derived from event hash, never random
- Wall-clock fields sourced from event.wall_clock_ns, never `now()` at replay

## FIX session replay
- FIX versions supported: <4.2 / 4.4 / 5.0SP2>
- ResendRequest handling: application messages = resend originals from canonical log; admin = SequenceReset-GapFill
- PossDupFlag, PossResend set per FIX spec
- Raw FIX bytes + parsed canonical event both persisted (regulator demand)
- Logon ResetSeqNum: operator approval gate; never auto

## Gap detection
- Producer monotonic seq + heartbeat every 1s
- Consumer halts on `seq != last+1`; pages on-call
- Daily ingress/archive/WORM event-count three-way reconciliation
- Drop-copy gap scanner runs continuously on exchange drop-copy stream

## Drop-copy reconciliation
- Sources: <CME drop-copy / NYSE FIX drop-copy / NASDAQ ITCH-derived / per venue>
- Match keys: (ExchOrderID, ClOrdID, ExecID)
- Buckets: EXACT / MATCH-WITH-FIELD-DIFF / UNMATCHED-INTERNAL / UNMATCHED-EXCHANGE
- SLA: T+1 EOD match; UNMATCHED-EXCHANGE = immediate page
- Output: daily reconciliation report into evidence locker
- Owner: Trading Ops; backstop: Risk

## Replay testing in CI
- Per-commit: property test `replay ≡ live` on 100 random sequences
- Per-commit: 1,000 random kill-point recovery → byte-equal state
- Per-release: schema-evolution test N-1 → N → N-1 round-trip
- Monthly: production-snapshot replay drill in staging; block release on drift
- Determinism budget tracking: replay/live ratio per kernel version

## Trade-break runbook
| T+ | Action | Owner |
|---|---|---|
| 0min | Open incident, scope (single ClOrdID / session / instrument / systemic) | IC |
| 5min | Tier-1: customer ticket, drop-copy mismatch, or regulator inquiry classification | Trading Ops |
| 15min | Pull canonical event slice ±5min; verify hash chain | Trading Infra |
| 30min | Replay from prior snapshot; compare produced ExecutionReport | Engineering |
| 1h | Three-way diff: internal log / kernel replay / exchange drop-copy | Trading Ops + Eng |
| 4h | Root cause + remediation plan; risk + treasury page if financial impact | IC + Risk |
| 24h | Written customer/counterparty response | Sales Trading + Counsel |
| 5d | Internal post-mortem + Rule 4530 / 17a-7 self-report eval if threshold | Compliance |

## Retention coupling
- WORM SLA: events + snapshots in compliance-mode WORM within T+1
- Hash-chain anchor: daily Merkle root → RFC 3161 TSA (see `/court-admissible-logging`)
- Cold replay budget: WORM retrieval inside 30d regulator production window; quarterly load test
- Retention floor: <7 yr SEC 17a-4 / 5 yr MiFID II / 5 yr CFTC 1.31>

## Anti-patterns flagged
- JSON or non-canonical Protobuf on the canonical event path
- `now()` at replay time
- Snapshot without hash chain
- Drop-copy reconciliation deferred to customer complaint
- Per-account partitioning (breaks per-instrument total order)
- Generating new ExecID on replay
- FIX Logon ResetSeqNum auto-handler
- Mixed Kafka broker versions on the canonical log path
```

## Verification
1. Substrate picked with explicit tradeoff justification; partition strategy named (per-instrument default).
2. Canonical event schema specified with binary wire format + frozen field order + version policy; JSON forbidden.
3. Snapshot cadence (N events AND T hours) named with hash-chain anchoring.
4. Replay contract `replay(snapshot, events) ≡ state` documented and tested in CI on every commit.
5. FIX session replay handles ResendRequest distinguishing application (resend originals) vs admin (gap-fill).
6. Drop-copy reconciliation runs continuously with three match buckets and SLA per venue.
7. Trade-break runbook has time-boxed steps with named owners ≤ T+5d to root cause.
8. WORM retention coupling explicit; cold-tier retrieval load-tested for 30-day regulator window.
