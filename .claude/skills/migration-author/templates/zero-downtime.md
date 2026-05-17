# Zero-Downtime Migration Template — Expansion → Backfill → Contraction

Three-phase deploy pattern for non-trivial schema changes when downtime not acceptable. Each phase is its own deploy + observe window.

## Phase 1 — Expansion (add the new shape, additive only)

- Add new column / table / index, NULL-able or default-valued.
- Code: dual-write (write to old + new), read from old.
- `CONCURRENTLY` for indexes on >1M-row tables (PG) or equivalent.
- Deploy + observe ≥ 1 stable cycle (typically 24h–1wk).

## Phase 2 — Backfill (populate new shape from old)

- Batch job, paginated, idempotent, throttled (e.g. 1k rows / 100ms).
- Re-runnable. Monitor lag + DB load. Pause if replication lag spikes.
- Code: still dual-writing, still reading from old. Verify new column populated for all live + historical rows.
- Sanity SQL: row-count parity + sample diff.

## Phase 3 — Contraction (flip reads, drop old)

3a. Flip read path to new column. Deploy + observe.
3b. Stop dual-write (write only new). Deploy + observe.
3c. Drop old column / table / index. Deploy.

Each step its own deploy. Roll back to previous step by re-deploying prior commit; no DB rollback needed.

## When NOT to use this template

- Small table (<10k rows), low-traffic — single migration is fine.
- Column rename only (no semantic change) — see backfill-before-rename pattern in `SKILL.md`.
- Schema change behind feature flag — coordinate with `/feature-flag-rollout`.

## Cross-refs

- `/rollback-plan` — per-phase rollback contract.
- `/feature-flag-rollout` — gated read-flip.
- `/canary-deploy` — observe-window mechanics.
