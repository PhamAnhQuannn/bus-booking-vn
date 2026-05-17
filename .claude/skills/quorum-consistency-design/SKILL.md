---
name: quorum-consistency-design
description: Quorum + consistency design for replicated stateful systems — N/R/W tuning, CAP/PACELC tradeoff, consistency model selection (linearizable / sequential / causal / eventual), conflict resolution (LWW / vector clock / CRDT), sloppy quorum + hinted handoff, read repair, anti-entropy, system-fit (Cassandra / DynamoDB / Riak / Scylla / CockroachDB / Spanner / etcd / Consul). Outputs `docs/design/quorum-consistency-<system>.md`. Use when picking or tuning a replicated store, when a workload spans multi-region or multi-AZ, or when "we need HA + low-latency writes" appears. Reads `/project-classify`; skip XS+S unless multi-region.
output_size:
  XS: skip
  S: skip
  M: 1h
  L: 3h
  XL: 6h
---

# /quorum-consistency-design — Quorum + Consistency Design

Invoke as `/quorum-consistency-design`. Required when a replicated data store underpins the workload and a single primary's failover SLA is not acceptable, or when multi-region writes are on the table. Covers the math (N/R/W), the model (CAP/PACELC), the mechanics (read-repair, anti-entropy, hinted handoff), and the system fit.

## Why you'd care
Wrong R+W can silently corrupt invariants. "Eventually consistent" without a conflict-resolution plan is "eventually wrong". CAP is not "pick 2" — under partition you pick C or A; otherwise (PACELC) you trade Latency vs Consistency on every request. Most outages in Dynamo-family stores trace to operators picking ONE=ONE for hot paths and discovering write loss only during a node replacement. Senior teams write down N, R, W, the consistency model, the conflict-resolution policy, and the recovery path BEFORE touching the cluster.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS / single-region S → SKIP. Single Postgres primary + sync replica covers you.
2. Read `docs/design/architecture-<project>.md` for service+data map.
3. Read `docs/design/capacity-<project>.md` for RPS + payload size + retention.
4. Read `docs/design/failure-<project>.md` (RTO/RPO targets).
5. Read `docs/design/idempotency-key-design-<project>.md` (writes must be idempotent under retry).

## Inputs
- Workloads in scope (name, read RPS, write RPS, p99 latency target, payload size).
- Topology: # regions, # AZs/region, latency between them, partition probability.
- Durability requirement: RPO (max acceptable data loss in seconds/writes).
- Availability requirement: RTO (max acceptable downtime).
- Consistency requirement per workload: strong / read-your-writes / monotonic / causal / eventual.
- Invariant inventory (uniqueness, balance ≥ 0, no double-spend) — these constrain conflict resolution.

## Process
1. **Identify the actual consistency requirement per workload.** Most workloads do NOT need linearizable. Build a table:
   - Auth / session token / unique username → strong (linearizable or serializable).
   - Account balance / inventory count → strong or use CRDT counter with explicit overflow check.
   - Shopping cart → causal + LWW per key (Amazon Dynamo paper case).
   - Activity feed / timeline → causal or eventual.
   - View counter / like count → eventual + CRDT G-Counter.
   - Audit log → append-only, eventual + total-order via timestamp+UUID tiebreak.
   - **Rule:** never weaken consistency for a workload that backs a uniqueness or money invariant.

2. **Pick N (replication factor) per keyspace.**
   - N=3 default (tolerate 1 failure with R=W=2 quorum; tolerate 2 failures for reads with R=1).
   - N=5 for cross-region critical paths (tolerate 1 region loss + 1 AZ loss).
   - N=1 only for cache / ephemeral.
   - Cost: storage × N; cross-region egress × (N-1) per write.

3. **Compute R + W for your consistency target:**
   - **R + W > N** → quorum overlap → strong consistency for single-row (Dynamo-style).
   - R = W = quorum (⌊N/2⌋ + 1) — balanced; e.g., N=3 → R=W=2.
   - R = 1, W = N → fast reads, slow + fragile writes.
   - R = N, W = 1 → slow reads, fast writes, write loss on node failure.
   - R = W = 1 → no overlap; eventual only; tunable per query in Cassandra (`LOCAL_ONE` etc).
   - **Per-region quorum** (LOCAL_QUORUM in Cassandra): R+W>N within a region; async replicate to other regions. Best latency; relaxes cross-region consistency.

4. **Decide CAP posture under partition + PACELC latency-vs-consistency tradeoff:**
   - **CP** (Spanner, CockroachDB, etcd, ZK, MongoDB w/ majority): refuse writes when quorum not reachable. Pick when invariants exist.
   - **AP** (Cassandra, DynamoDB w/ eventual, Riak): accept writes on any reachable replica; resolve conflicts later. Pick when uptime > correctness.
   - **PACELC (no partition):** EL (Cassandra, DynamoDB eventual) = low latency, eventual. EC (Spanner, Cockroach) = higher latency, strong.
   - Document explicitly: "Under network partition between us-east and us-west, account-balance writes will REJECT (CP); cart writes will ACCEPT and merge on heal (AP+LWW)."

5. **Conflict resolution strategy per data type** (only relevant if AP or async multi-region):
   - **Last-Write-Wins (LWW)** by wall-clock timestamp: simple but DROPS WRITES on clock skew. Acceptable for: presence, cache, idempotent overwrites. **Unacceptable for: counters, sets, balances.**
   - **Vector clocks / version vectors**: detect concurrent writes, return siblings to client, client merges (Dynamo, early Riak). High operational cost — clients must merge.
   - **CRDTs**:
     - G-Counter / PN-Counter for counts.
     - G-Set / OR-Set for collections (OR-Set handles concurrent add/remove correctly).
     - LWW-Register only when LWW semantics are fine.
     - LWW-Map for keyed maps.
     - Sequence CRDTs (RGA, Logoot) for collaborative text.
     - Riak built-in (riak_dt), Redis CRDB (Enterprise), Automerge / Yjs for client-side.
   - **Operational transform (OT)**: collaborative editors (Google Docs); complex, prefer CRDT for new builds.
   - **Server-side merge function**: write a domain-specific reducer; review with same rigor as a DB migration.

6. **Hot-path mechanics — pick all that apply:**
   - **Hinted handoff** (Cassandra, Dynamo): downed replica's writes buffered on a peer with a "hint", replayed on recovery. Caveat: hint TTL (default 3h in Cassandra) — beyond TTL, repair handles it. If node out >TTL, you NEED anti-entropy.
   - **Read repair** (sync foreground or async background): on quorum read, if replicas disagree, push freshest value to laggards. Cost: extra writes; benefit: convergence.
   - **Anti-entropy / Merkle-tree repair** (Cassandra `nodetool repair`, DynamoDB internal): scheduled background repair to converge silent divergence. **Required cadence: < hint TTL** (typical: weekly full repair, daily incremental).
   - **Sloppy quorum** (Dynamo): when preferred replicas down, write to "next available" nodes, hand back later. Trades durability for availability under failure; turn OFF if invariants depend on quorum.
   - **Tunable consistency per-query** (Cassandra `CL=ONE|QUORUM|ALL|LOCAL_QUORUM|EACH_QUORUM`, DynamoDB `ConsistentRead`): use to give hot reads a cheap path while keeping writes safe.

7. **Time + ordering primitives:**
   - **Wall-clock** (NTP, ~10ms skew typical, 100ms+ under stress): only for hints + LWW where collision is rare.
   - **Hybrid Logical Clocks (HLC)**: CockroachDB, MongoDB cluster time — combine physical + logical; provide causal ordering.
   - **TrueTime** (Spanner): hardware-assisted bounded clock skew (~7ms) → external consistency.
   - **Lamport / vector clocks**: causal ordering without wall-clock; no real-time semantics.
   - Document the clock-skew alert threshold (typical: page on >250ms drift).

8. **System selection — match workload to engine:**
   | System | Model | R/W tuning | Multi-DC | Conflict res | Best fit |
   |---|---|---|---|---|---|
   | Postgres + sync replica | Linearizable (primary) | n/a | Single-DC primary; logical-rep DR | n/a (single-primary) | OLTP, invariants |
   | CockroachDB | Serializable | per-zone | Native multi-region | n/a (Raft) | OLTP across regions |
   | Spanner | External-consistent | n/a | Native global | n/a (Paxos+TrueTime) | Global OLTP, budget OK |
   | Cassandra / Scylla | Tunable | CL per query | LOCAL_QUORUM | LWW (timestamp) | High-write, time-series |
   | DynamoDB | Tunable (Eventual default, Strong opt-in) | ConsistentRead | Global Tables (LWW) | LWW | Serverless, predictable scale |
   | Riak | Tunable, CRDT-native | per-bucket | Multi-DC repl | CRDT (riak_dt) / vector clock | Shopping cart, CRDT-first |
   | MongoDB | Tunable (Strong default in modern versions) | writeConcern + readConcern majority | Replica set + sharding | n/a (single-primary per shard) | Document OLTP |
   | etcd / ZK / Consul | Linearizable (Raft / Zab) | n/a | Single-DC; multi-DC stretch fragile | n/a | Config, locks, leader election |
   | Redis (single) | Single-primary | n/a | Async replica | n/a | Cache, ephemeral |
   | Redis Cluster | Eventual on async repl | n/a | n/a | Last-write | Cache, leaderboard (CRDT in Enterprise) |
   | FoundationDB | Serializable | n/a | Single-DC primary | n/a | Multi-model OLTP |

9. **Failure scenarios — walk through each:**
   - **1 replica down, N=3, R=W=2**: still operational; hinted handoff buffers writes.
   - **2 replicas down, N=3, R=W=2**: writes REJECT (CP) or fall to sloppy quorum (AP); reads stale.
   - **Network partition splits 2-1**: minority side rejects (CP) or accepts + diverges (AP, merge on heal).
   - **Region loss, N=5 (2+2+1 across 3 regions)**: surviving 2 regions have 4 replicas → quorum (3) maintained.
   - **Clock skew spike**: LWW drops writes silently → monitor + page; pivot affected keys to CRDT.
   - **Slow replica (GC pause, disk full)**: removed from quorum by timeout; rejoins via repair.
   - **Silent corruption / bit-rot**: caught by Merkle-tree repair; document scrub cadence.

10. **Observability per cluster:**
    - Metrics: per-CL read/write p50/p99 latency, pending hints, hint TTL exhausted count, repair lag, read-repair rate, dropped mutation count, replica lag (HLC or LSN), quorum-unavailable events.
    - Alerts:
      - Quorum unavailable >30s → page.
      - Pending hints > 10k or oldest > 1h → page.
      - Repair lag > hint TTL → page (silent divergence risk).
      - Replica clock skew > 250ms → page.
      - Read-repair rate >1% of reads → investigate write path.
    - Dashboards: per-keyspace consistency posture (target vs observed).

11. **Capacity + cost model:**
    - Storage = raw × N × (1 + compaction overhead, typ. 1.5×).
    - Cross-region egress = W × payload × cross-region-fraction; price per GB ($0.02–$0.09).
    - Repair traffic: schedule during off-peak; budget 10–20% of normal IO.
    - Spanner / Cockroach / DynamoDB Global Tables: priced per request + storage; model break-even vs self-managed Cassandra.

12. **Migration / cluster lifecycle:**
    - Add replica: streaming bootstrap; throttle to avoid impact; monitor pending compactions.
    - Remove replica: decommission, NOT remove — let it stream out.
    - Increase RF: requires repair to fill new replicas; do it in low-traffic window.
    - Schema change: most stores allow online; review per-engine.
    - Backup: snapshot per replica + S3 (or vendor managed); test restore quarterly (see `/dr-drill`).

## Output
Write `docs/design/quorum-consistency-<system>.md`:

```markdown
# Quorum + consistency design — <system / keyspace>
**Date:** <YYYY-MM-DD>
**Author:** <name>
**Status:** draft | accepted | superseded

## Scope
Engine: <Cassandra 4.1 | DynamoDB | CockroachDB | …>
Keyspaces: <list>
Regions: <us-east-1, us-west-2, eu-central-1>
Replicas per region: <2,2,1>

## Workloads + consistency table
| Workload | Read RPS | Write RPS | p99 read | p99 write | Consistency required | CL/posture | Conflict resolution |
|---|---|---|---|---|---|---|---|
| account_balance | 10k | 1k | 20ms | 50ms | linearizable | LOCAL_QUORUM RW + LWT on transitions | LWT (Paxos) |
| user_session | 50k | 5k | 10ms | 30ms | read-your-writes (single region) | LOCAL_QUORUM | LWW |
| activity_feed | 5k | 2k | 50ms | 100ms | causal | LOCAL_ONE read, LOCAL_QUORUM write | LWW |
| like_counter | 100k | 20k | 10ms | 20ms | eventual | LOCAL_ONE | CRDT (PN-Counter) |
| audit_log | 0 | 5k | n/a | 50ms | append-only eventual | LOCAL_QUORUM | none (immutable) |

## N, R, W
- N (RF) per region: 3; total replicas across 3 regions: 9 (3+3+3) for global keyspaces; 3 (single region) for region-pinned.
- R, W defaults: LOCAL_QUORUM (2 of 3 within region).
- Strong cross-region: EACH_QUORUM on writes, LOCAL_QUORUM on reads (for account_balance only).
- Per-query overrides allowed via app annotation; logged + monitored.

## CAP/PACELC posture
- Under partition: CP for account_balance + audit_log (reject writes if no LOCAL_QUORUM); AP for everything else.
- No partition: EL — favor latency; eventual within region for low-criticality reads.

## Conflict resolution policies
- account_balance: LWT (compare-and-set on version column) — Paxos round; rejects on concurrent.
- user_session: LWW; clock-skew alert at 250ms.
- like_counter: CRDT PN-Counter; safe under any concurrency.
- activity_feed: LWW per (user_id, event_id); duplicates suppressed by event_id idempotency.
- audit_log: immutable; conflicts impossible.

## Mechanics
- Hinted handoff: enabled, TTL 3h.
- Read repair: 10% sample on LOCAL_QUORUM reads.
- Anti-entropy repair: `nodetool repair --full` weekly + incremental daily; alert if repair lag > 2h.
- Sloppy quorum: DISABLED for account_balance keyspace; enabled elsewhere.
- Compaction strategy: SizeTieredCompaction default; LeveledCompaction for read-heavy.

## Clock + ordering
- NTP via chrony, 4 stratum-2 peers, alert on drift >100ms, page >250ms.
- HLC not applicable (Cassandra uses wall-clock).
- LWT uses Paxos round → no clock dependency.

## Failure scenarios (rehearsed)
| Scenario | Behavior | Impact | Recovery |
|---|---|---|---|
| 1 node down, RF=3, CL=LOCAL_QUORUM | Operational | None | Hint replay on rejoin (<3h) |
| 2 nodes down per region | Reads fail (CL=LOCAL_QUORUM); writes fail | Region degraded | Restore node OR fail over to other region |
| Region partition (us-east isolated) | LOCAL_QUORUM still works; cross-region writes (EACH_QUORUM) fail | account_balance unavailable in isolated region | Wait for heal; manual reconcile |
| Full region loss | Surviving regions handle traffic; missing replicas streamed on recovery | Higher tail latency | Bootstrap replacement, repair |
| Clock skew spike | LWW drops some writes | Silent data loss on activity_feed | Alert + repair from secondary index |

## Observability
- Metrics: pending_hints, dropped_mutations, repair_lag_seconds, read_repair_rate, lwt_contention, p99_per_cl.
- Alerts: quorum_unavailable_30s, hints_overflow, repair_lag_3h, clock_skew_250ms.
- Dashboards: per-keyspace observed CL distribution vs target.

## Capacity + cost
- Storage: 500 GB raw × 3 RF × 1.5 compaction = 2.25 TB/region.
- Cross-region egress for global keyspaces: ~50 GB/day × $0.02 = $30/month.
- Repair IO budget: 15% of normal.

## Operational runbook references
- `docs/ops/cassandra-runbook.md` (node add/remove/repair).
- `docs/ops/backup-restore-cassandra.md` (snapshot + S3).
- `docs/qa/dr-drill-<date>.md` (quarterly).

## Test plan
- Unit: CRDT counter under concurrent increment.
- Integration: write at CL=LOCAL_QUORUM, kill 1 replica, read returns latest.
- Chaos:
  - Partition us-east from us-west; verify CP keyspaces reject, AP accept.
  - Inject 500ms clock skew on 1 node; verify LWW behavior + alert.
  - Kill 2 of 3 replicas; verify writes reject (CL=LOCAL_QUORUM).
- Repair: induce divergence (write at CL=ONE), run repair, verify convergence.
- Hint TTL exhaustion: node down >3h, verify post-repair convergence.

## Open questions
- <item> — owner, due date.

## Sign-off
- Eng lead: <name> <date>
- SRE / on-call: <name> <date>
- Data owner (per keyspace): <name> <date>
```

## Verification
- Every workload mapped to required consistency model + chosen CL/posture.
- N, R, W written down per keyspace; R+W>N where strong needed.
- Conflict-resolution policy per data type (LWW / vector clock / CRDT / LWT) explicit.
- Hint TTL < repair cadence (no silent divergence window).
- Failure-scenario table walked + signed off by on-call.
- Observability covers quorum-unavailable + repair-lag + clock-skew + hint-overflow.
