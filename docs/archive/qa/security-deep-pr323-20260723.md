SECURITY-DEEP REVIEW — PR #323 "test(payments): lock the bank_transfer ref round trip + in-adapter guardrail"
──────────────────────────────────────────
Base/Head: master ← fix/bank-transfer-ref-hardening @ f72a8c72

Findings: 0 (P1:0 · P2:0 · P3:0)

No security-deep findings.
  • Cat 1 Crypto — none.
  • Cat 2 Threat-model — no new endpoint. The guardrail TIGHTENS the webhook (rejects a malformed
    ref as no_booking_ref_in_memo) — strictly defensive, no new surface. orderRef still flows into a
    parameterized findUnique.
  • Cat 3 Rate-limit — no new endpoint.
  • Cat 4 Audit-log — no new mutation handler.
  • Cat 5 Authz — no new handler.
  • Cat 6 PII — int test uses gitleaks-safe placeholder phones (+8490xxxxxx*) + test emails; no PII
    logs, no new column.

SUMMARY: 0 P1 · 0 P2 · 0 P3 · pinned to f72a8c72
