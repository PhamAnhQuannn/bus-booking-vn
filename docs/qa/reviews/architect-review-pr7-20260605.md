ARCHITECT REVIEW — PR #7 "feat: push rebuild backlog + OTA polish + pay/profile/OTP fixes" @ 3fc5afba
─────────────────────────────
Base: master  ·  Head: feat/rebuild-complete  ·  State: open (not draft)
URL: https://github.com/PhamAnhQuannn/bus-booking-vn/pull/7
Audited HEAD in place (PR head == current local HEAD; no temp-branch fetch needed). Working tree clean.

Scanned: 32 lib-domain barrels, ~553 source files changed since PR#6. Boundaries + no-cycle ENFORCED at error.

PRIORITY 1 — Block push, fix first:
  (none)

  Invariant sweep — all clean:
    - no-module-cycles: import-x/no-cycle at error (maxDepth Infinity); lint reports 0 errors.
    - ui-not-import-db: no client component imports @/lib/core/db; greppable guard returns zero.
    - use-client-no-server-barrel-leak: the 2026-06-04 operator-smoke regression (use-client →
      @/lib/auth barrel pulling server-only into client bundle) is FIXED — guard returns zero.
    - payment-crypto: HMAC/signature verify isolated to lib/payment/adapters/{momo,stub}.ts,
      invoked by the webhook route (correct adapter pattern — NOT a scattered-crypto violation).
      Other createHmac hits are auth/otp/holdCookie/storage-signing, not payment.
    - no-ddl-in-app-code: no $executeRaw DDL (CREATE/ALTER/DROP) in app/ or lib/.
    - no-secrets-in-client: clean.

PRIORITY 2 — Fix before next release:
  [ADR COVERAGE GAP] No docs/adr/ directory exists.
    Architecturally-significant decisions made across this rebuild have no ADR record:
      - custom JWT auth with 3 distinct realms (customer / operator / admin)
      - Prisma + Postgres as datastore + the lib/core/db consolidation (issue 091)
      - MoMo payment adapter + stub-gateway abstraction (PAYMENTS_STUB)
      - custom FeatureFlag store (issue 060) instead of LaunchDarkly/Unleash
      - run-locked cron job model (JobRunLog + advisory lock) instead of BullMQ/Inngest
      - signed-URL storage (keys-in-DB, no byte-proxy) instead of direct blob storage
    rebuild-plan.md (section-indexed) + docs/runbook/* partially substitute as the design record,
    so this is advisory, not blocking.
    Fix: /adr-writer to backfill an ADR per decision above (or one consolidated "rebuild
    architecture" ADR), so the *why* survives independent of rebuild-plan.md.

PRIORITY 3 — Track on roadmap:
  [GOD-MODULE WATCH] @/lib/auth imported ~169× (~30% of source files).
    Under the 70% god-module threshold — NOT a violation — but it is the single most-imported
    barrel. As more realms/routes land it could cross the line.
    Fix: none required now. Monitor; if it crosses ~50%, consider splitting client-safe
    (csrfClient, labels) from server-only (session/HOF) export surfaces more aggressively.

DRIFT vs prior snapshot (PR#6 @ 02e6eab5, 2026-06-01):
  - STRUCTURAL: db layer relocated lib/db/** → lib/core/db/** (issue 091). The prior snapshot's
    layer_map was stale on this path — corrected in the refreshed arch-graph.json.
  - ADDED: new domains since PR#6 — admin realm, ledger, charter, onboarding/KYB, places, jobs,
    storage, notification — all introduced UNDER the enforced barrel boundaries (no new cycles,
    no new layer crossings).
  - RESOLVED: prior P2 "recharts adr-missing" is moot — recharts dep + orphan chart components
    deleted (issue 041).
  - No new boundary-crossing edges, no new cycles.

SUMMARY: 0 P1, 1 P2, 1 P3
Graph snapshot updated → docs/qa/arch-graph.json

RECOMMENDED NEXT STEPS:
  → Architecture is the STRONG dimension of this PR: cycles + cross-domain access are lint-gated
    at error, not just convention. No structural blocker to merge.
  → /adr-writer to backfill the ADR-coverage gap (non-blocking, do post-merge).
  → Keep the @/lib/auth import fan-in on the watch list.
