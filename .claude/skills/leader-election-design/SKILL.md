---
name: leader-election-design
description: Leader-election + singleton-task design for distributed workers — Raft/Paxos primer, fencing tokens, lease + renewal, split-brain prevention, failover cadence. Picks the right primitive (Postgres advisory lock vs Redis Redlock vs ZooKeeper vs etcd vs Consul vs Kubernetes Lease). Outputs `docs/design/leader-election-<job>.md`. Use when user says "leader election", "singleton", "active-passive", "cron singleton", "split brain", "fencing token", "/leader-election-design", or when a job/handler MUST run on exactly one node at a time. Reads `/project-classify`; skip XS+S.
output_size:
  XS: skip
  S: skip
  M: 1h
  L: 3h
  XL: 6h
---

# /leader-election-design — Singleton + Leader Election

## Why you'd care

Picking the wrong primitive for singleton tasks (or rolling your own) is how you get split-brain in prod and two workers running the nightly job. The decision tree picks the right tool for the failure-mode you can tolerate.

> **Why you'd care:** Two workers running the "send invoice" cron at the same time = double-send. Two workers writing the daily snapshot = corrupt data. Two workers holding the "release valve" lock = your safety mechanism becomes the cause of the outage. Leader election is the difference between a horizontally-scalable worker pool that's safe under partition vs one that silently double-acts.

> **Effort caveat:** A naive "first worker to claim wins" design has a 5-minute window of being correct followed by years of edge-case incidents (clock skew, GC pause, network partition, slow-shutdown). Don't ship past M without explicit fencing-token design.

Invoke as `/leader-election-design`. Required for: singleton background jobs (daily settlement, mass mailer), exactly-once-effective stream processors, primary-replica failover, distributed cron, schema migration runners, write-master in event sourcing, rate-limiter coordinators.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS/S → SKIP (one process = no election needed).
2. Read `docs/design/architecture-<project>.md` for the dependency map — already running Redis? Postgres? K8s? etcd? Don't introduce ZooKeeper unless the lift is justified.
3. Read `docs/design/idempotent-batch-<job>.md` if the leader runs a batch — idempotency belt-and-suspenders the leader correctness.
4. Read `docs/design/failure-<feature>.md` — what fails if the leader briefly double-elects?

## Inputs
- The task or role that needs a singleton (job name, write-role, coordinator scope).
- Maximum tolerable double-execution window (how long can two instances think they're leader?).
- Maximum tolerable downtime when leader dies (failover SLO).
- Available coordination infrastructure (Postgres / Redis / etcd / ZK / K8s / Consul).
- Side-effect class:
  - **Compensable** (DB writes that we can dedupe by idempotency key) — moderate strictness fine
  - **Non-compensable** (vendor calls, money transfers, customer-visible emails) — strict fencing required
- Cluster size + topology (single region / multi-region).

## Process

1. **First question: do you actually need leader election?**
   - **Alternative 1 — queue-of-one**: instead of "elect a leader to do X", post a single message to a queue and let workers race for it. Idempotency key on the message prevents double-process. Often simpler.
   - **Alternative 2 — partitioning**: split work by key (tenant_id % N) so each worker owns a partition. No leader needed; horizontal-shard the singleton.
   - **Alternative 3 — single-replica StatefulSet** (K8s): if downtime is acceptable, run replicas=1 and let K8s restart it. No election needed.
   - Choose election only if: a long-running role (>seconds), or coordinator role (not pure-task), or shared-state owner (cache primary, write-master).

2. **Decide failover SLO + double-act tolerance**:
   - Tight failover (<10s) + zero double-act → etcd/ZK fencing required.
   - Loose failover (60s+) + idempotent side-effects → Postgres advisory lock + idempotency key is enough.
   - Match the tool to the constraint; don't pay for etcd if Postgres covers it.

3. **Pick the primitive (decision tree)**:
   - **Postgres advisory lock** (`pg_try_advisory_lock(key)`) — already-have Postgres; session-scoped; auto-releases on disconnect; good for "exactly one writer per logical key"; failover ≈ TCP timeout (30-60s default). Best default for app teams already on Postgres.
   - **Redis Redlock / RedisJSON SET NX PX with fencing token** — sub-second failover; widely deployed; Redlock algorithm has documented edge cases (Martin Kleppmann critique 2016, Antirez response); ONLY safe with fencing token AND if you accept Redis isn't a consensus system. Use SETNX with monotonic fencing for single-Redis; avoid multi-Redis Redlock unless you've read the literature.
   - **etcd Lease + Lock** — Raft consensus; CP; fencing tokens via `lease.ID` + `revision`; built for this; <2s failover; depends on running etcd. Used by Kubernetes itself.
   - **ZooKeeper ephemeral znode + sequential** — Paxos-variant (Zab); pre-cloud-native default; ephemeral node disappears on session loss; sequence number is the fence token. Operational cost in 2026 is high vs etcd/Consul.
   - **HashiCorp Consul session-based lock** — Raft; session TTL drives failover; combines KV + service discovery; good if already on Consul.
   - **Kubernetes Lease object (`coordination.k8s.io/v1`)** — built into K8s API server (backed by etcd); used internally by controller-manager and scheduler; `kube-leader-election` library; failover ≈ leaseDurationSeconds (15s typical). Best for K8s-native apps.
   - **DynamoDB conditional update with TTL** — strong-consistency single-region; lease-as-row pattern; works at AWS scale; TTL cleanup native; good for serverless (Lambda).
   - **Google Cloud Storage / S3 conditional put** — only for very-coarse coordination; not a real distributed lock; skip.

4. **Design the lease lifecycle** (regardless of primitive):
   - **Lease duration** (`L`): max time a lease is held without renewal. Typical 10-30s.
   - **Renewal cadence** (`R`): leader re-extends at `R = L/3`. Three chances to renew before expiry.
   - **Grace period** (`G`): after losing lease, leader has `G` seconds to detect + stop side-effects. Typical `G = L/4`.
   - **Failover time**: in worst case, `L + new_election_time`. Tune `L` to match SLO.
   - **Clock-skew margin**: NTP-synced infra has ~10ms; allow `L > 10×skew_p99`.

5. **Fencing tokens — the critical invariant**:
   - Every leader-protected side-effect MUST be tagged with a monotonically-increasing token.
   - Downstream MUST reject any operation with token < latest seen.
   - **Why**: leader A acquires lease (token=42), GC-pauses 30s, lease expires, leader B elected (token=43), writes; then leader A wakes up and tries to write with token=42 — downstream rejects. Without this, A overwrites B's correct work.
   - **Sources of monotonic tokens**: etcd `revision`, Postgres `pg_logical_emit_message` LSN, Redis `INCR` on a separate "fence counter" key, ZK sequence number, DynamoDB conditional version increment.
   - Persist (leader_id, fence_token) on every protected write; downstream stores `last_seen_fence` per resource and rejects stale-token writes with HTTP 409 + log to anomaly stream.

6. **Implement the safety check on every side-effect**:
   ```
   def protected_write(resource_id, payload, my_fence):
     row = SELECT last_fence FROM fenced_resources WHERE id=resource_id FOR UPDATE
     if row and row.last_fence > my_fence:
         raise StaleLeaderError(my_fence, row.last_fence)
     UPDATE fenced_resources SET last_fence=my_fence, payload=payload WHERE id=resource_id
   ```
   - Run inside the same transaction as the side-effect.
   - For external-vendor calls: include fence in idempotency key so a replay with stale fence resolves to the new leader's already-completed call.

7. **Split-brain prevention checklist**:
   - **Network partition** — non-quorum side cannot acquire lease (Raft/Paxos provides this; Redis Redlock does NOT under all conditions — see Kleppmann 2016).
   - **GC pause / process freeze** — fence token in side-effects catches the resumed-zombie writes.
   - **Clock skew** — lease durations use monotonic clocks where possible; NTP-sync required; alert on >100ms drift.
   - **Slow shutdown** — leader receiving SIGTERM should: (1) stop accepting new work, (2) drain in-flight work, (3) release lease explicitly, (4) exit. Force-kill after `2 × L`.
   - **Stale connection** — TCP keepalive 30s; on connection loss to coordinator, leader must self-demote (stop side-effects) within `G`.

8. **Backup leader behavior**:
   - **Hot standby**: continuously reads cluster-state replica; ready to take over instantly. Used for write-master role.
   - **Warm**: subscribed to election channel but not loading state; promote latency ~ state-load time.
   - **Cold**: any worker can become leader on next election; promote latency includes warm-up. Acceptable for periodic jobs.

9. **Observability + alerting**:
   - **Metrics**: `leader_election_count_total`, `leader_lease_renewal_failures_total`, `leader_held_seconds`, `leader_change_total`, `fence_rejection_total`.
   - **Alerts**:
     - `leader_change_total > 3 in 10 min` → instability; page
     - `fence_rejection_total > 0 in 1 min` → split-brain attempt detected; page
     - `leader_held_seconds == 0 for > L` → no leader; page
     - `clock_skew_ms > 100` → page (NTP issue)
   - **Logs**: `{leader_id, fence_token, lease_until, event}` on every claim/renew/release.

10. **Test plan (critical — leader election is impossible to verify by inspection)**:
    - **Unit**: lease acquire/renew/release happy path.
    - **Property test**: any sequence of (acquire, lose, reacquire) preserves monotonic fence.
    - **Chaos**: pause leader process 2×L → second leader elected → first wakes → assert first cannot write (fence reject).
    - **Network partition (Jepsen-style)**: partition leader from coordinator → leader self-demotes within G; new leader elected; no double-act.
    - **Clock skew**: skew leader clock by 30s → ensure lease expiry math uses monotonic clock.
    - **Slow shutdown**: SIGTERM leader → assert clean release + new election within L.
    - **Burst**: 10 workers race to acquire empty lease → exactly one wins; others back off.

## Output
Write `docs/design/leader-election-<job>.md`:

```markdown
# Leader Election — <role_or_job>
**Date:** <YYYY-MM-DD>

## Role + scope
- Role: <singleton: daily settlement job / write-master / cron coordinator>
- Required guarantee: at most one active leader per <scope: globally / per-tenant>
- Failover SLO: leader available within <15s> of prior leader failure
- Double-act tolerance: <zero / idempotency-protected ≤ 5s>

## Alternatives considered
- Queue-of-one: rejected because <reason>
- Partitioning: rejected because <reason>
- Single replica: rejected because <reason>

## Primitive chosen
- **<Postgres advisory lock / etcd Lease / Redis SETNX+fence / K8s Lease>**
- Rationale: <already deployed / matches SLO / has fencing primitive / etc.>
- Failover characteristics: <X seconds typical / Y seconds worst-case>

## Lease parameters
| Param | Value | Rationale |
|---|---|---|
| Lease duration L | 15s | matches failover SLO |
| Renewal cadence R | 5s | L/3 — three renewal chances |
| Grace period G | 4s | leader self-demotes within G of lease loss |
| Worst failover | 15s + 1s (election) = 16s | within SLO |
| Force-kill timeout | 30s (2×L) | for SIGTERM laggards |

## Fencing token
- Source: <etcd revision / Postgres LSN / Redis INCR>
- Storage: `fenced_resources(id, last_fence_token, last_writer_leader_id, ts)`
- Reject rule: `if incoming_fence < last_fence_token then 409 + alert`
- Vendor-call binding: idempotency key includes fence token

## Implementation outline
```pseudo
on_start:
  lease, fence = coordinator.acquire(lease_name, L)
  start_renewal_loop(R, lease)
  start_leader_work(fence)

on_renewal_failure:
  stop_leader_work()  # within G
  exit(1)

on_sigterm:
  stop_accepting_new_work()
  drain_inflight()
  coordinator.release(lease)
  exit(0)

protected_write(resource_id, payload):
  TXN:
    last = SELECT last_fence FROM fenced_resources WHERE id=? FOR UPDATE
    if last >= my_fence: raise StaleLeaderError
    UPDATE fenced_resources SET last_fence=my_fence WHERE id=?
    apply payload  # side-effect
```

## Split-brain checklist
- [x] Quorum-required coordinator (etcd/Raft)
- [x] Monotonic fence on every side-effect
- [x] Leader self-demotion within G on renewal failure
- [x] Monotonic clock for lease math
- [x] NTP sync with skew alert at 100ms
- [x] Slow-shutdown sequence + force-kill at 2×L

## Backup leader
- Mode: <hot/warm/cold>
- Promotion latency: <state-load + election = N seconds>

## Observability
- Metrics: `leader_election_count_total`, `leader_lease_renewal_failures_total`, `leader_held_seconds`, `fence_rejection_total`, `leader_change_total`
- Alerts:
  - leader_change > 3/10min → page (instability)
  - fence_rejection > 0/min → page (split-brain attempt)
  - no_leader > L → page
  - clock_skew > 100ms → page

## Test plan
- [x] Unit: lease lifecycle
- [x] Property: monotonic fence under (acquire, lose, reacquire)
- [x] Chaos: pause leader 2L → fence rejects stale writes
- [x] Network partition: partition from coordinator → self-demote within G
- [x] Clock skew: 30s clock jump → lease math correct via monotonic clock
- [x] Slow shutdown: SIGTERM → clean release + new election within L
- [x] Burst: 10 workers race → exactly one wins

## Operator runbook
- **Force re-election**: <admin endpoint that bumps fence + releases lease>
- **Pause leadership** (for maintenance): <set drain flag → leader releases on next renewal>
- **Investigate split-brain alert**: query `fence_rejection_total` by leader_id; correlate with leader_change events; check NTP drift

## Sign-off
- Design approved: <name>, <date>
- Chaos test passed: <date>
- Production go-live: <date>
```

## Verification
- Lease duration + renewal cadence + grace period explicitly set, with `R ≈ L/3` and `G ≈ L/4`.
- Fence token source named; storage table or its equivalent specified; downstream reject rule documented.
- Coordinator primitive justified against alternatives + against SLO.
- Split-brain checklist covers partition, GC pause, clock skew, slow shutdown.
- Chaos test includes 2×L process pause + fence-rejection assertion.
- Alerts include leader-change rate, fence-rejection rate, no-leader gap, clock skew.
