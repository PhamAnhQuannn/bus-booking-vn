> ← [Previous](../15-notifications/) | [Index](../README.md) | [Next →](../17-file-storage/)

## 16. Background Jobs & Scheduling

### 16.1 Why Background Jobs?

Some operations are too slow, too unreliable, or too timing-sensitive to run inside a user request:

| Job | Why Background |
|-----|---------------|
| Hold expiry sweeper | Runs every 1-2 min, checks all expired holds |
| Payment reconciliation | Polls PSP for stuck-pending payments every 5 min |
| Notification dispatch | Retries failed SMS/email sends every 30s |
| Payout T+1 sweep | Moves money from PENDING → AVAILABLE daily |
| Recurring trip generation | Creates future trips from templates weekly |
| PDF render | CPU-intensive, 2-5s per ticket |

### 16.2 At-Least-Once + Idempotent

**"Exactly once" is a myth** in distributed systems. Network failures, process crashes, and cron double-fires mean a job might run twice. Instead:

- **At-least-once**: The system guarantees the job runs at least once (retry on failure).
- **Idempotent**: Running the job twice produces the same result as running it once (via unique keys, status checks, conditional updates).

Example: The notification dispatcher checks `status = 'pending'` before sending. If it runs twice, the second run sees `status = 'sent'` and skips.

### 16.3 Cron Overlap Lock

**The problem**: A cron job runs every 1 minute. One run takes 90 seconds (maybe the DB is slow). The next tick fires while the first is still running → two copies processing the same data → duplicate sends, double-credits, etc.

**The solution**: An advisory lock or sentinel row. Before processing, the job acquires a lock:
- `SELECT pg_advisory_lock(42)` — if another copy holds lock 42, wait
- Or `SELECT ... FOR UPDATE SKIP LOCKED` on a `CronRun` row — if locked, skip this tick entirely

### 16.4 Stage Evolution

```
Stage 0 (now):     DB job table + cron endpoints (/api/cron/*)
                   Simple, zero infrastructure, sufficient for years

Stage 1 (later):   BullMQ (Redis-backed queue) + dedicated worker process
                   Same lib/<domain> job handlers, new execution layer
                   Needed when: job latency matters or volume exceeds cron throughput

Stage 2 (if ever): Per-job-type workers with independent scaling
                   Needed when: PDF renders or notifications saturate one worker
```
