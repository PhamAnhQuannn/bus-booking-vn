# Classification — Bus Booking VN

**Class: M**
**Score: 11 / 20**
**Date: 2026-05-17**

## Axis scores

| Axis        | Score | Rationale                                                                                  |
|-------------|------:|--------------------------------------------------------------------------------------------|
| Users       |     2 | Indie launch target — multiple VN operators (5-50 buses each), low-thousands customers Y1. |
| Revenue     |     2 | Platform take-rate 6% with T+3 payouts; indie-SaaS revenue band, not enterprise contract.  |
| Regulation  |     3 | PDPD 2023 PII + payment gateways (MoMo/ZaloPay) + transport sector + SMS OTP storage.      |
| Concurrency |     2 | Many users, async; 10-min seat holds + conflict resolution but no realtime/websocket need. |
| Lifetime    |     2 | Marketplace expected 1-3+ years; booking history legally retained even after acct delete.  |

## Implications

- **Skills that auto-skip at this class:** none (M is the default working band for most inception/build skills).
- **Skills that activate at this class:**
  - Inception: `/competitor-scan`, `/risk-register`, `/problem-validation`, `/jtbd`, `/lean-canvas`, `/positioning-statement`.
  - Regulation/payment-aware: `/pii-inventory`, `/gdpr-preflight` (PDPD-equivalent), `/pci-preflight`, `/threat-model-pre`, `/payment-reconciliation`, `/idempotency-key-design`.
  - Build: `/write-a-prd`, `/prd-to-issues`, `/prioritize`, `/data-model-design`, `/api-contract`, `/tdd`, `/migration-author`.
  - Pre-launch: `/launch-checklist`, `/rollback-plan`, `/observability-design`, `/incident-runbook`, `/backup-restore`.
- **Next recommended skill:** `/problem-validation` (evidence the pain before deeper inception work).

## Re-classify when

- Cross 10k MAU or expand beyond VN → bump toward L.
- Take direct card payments (PCI-DSS scope) → regulation +1.
- Add realtime seat-map / live tracking → concurrency +1.
- Pivot to enterprise contracts with fleet operators >100 buses → revenue +1.
