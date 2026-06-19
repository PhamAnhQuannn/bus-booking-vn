> ← [Previous](../20-observability/) | [Index](../README.md) | [Next →](../22-charter/)

## 21. Configuration & Feature Flags

### 21.1 What Are Feature Flags?

A feature flag is a toggle that enables or disables a feature without deploying new code. Think of it as a light switch for functionality.

**Why they matter**:
- **Kill switch**: If a payment rail has a bug in production, flip the flag → rail disabled → site stays up.
- **Gradual rollout**: Enable a new feature for 10% of users, monitor, then increase.
- **Development**: Build a feature behind a flag, deploy it (invisible to users), test in production, then flip.

### 21.2 Our Flags

| Flag | What It Controls | Default |
|------|-----------------|---------|
| `PAYMENTS_STUB` | When `true`, payments use a local stub gateway (no real money moves) | `true` in dev, `false` in prod |
| `NOTIFY_STUB` | When `true`, notifications are logged but not actually sent (no real SMS/email) | `true` in dev, `false` in prod |
| Payment rail toggles | Enable/disable specific payment rails (MoMo, VietQR, card) | Per-rail |
| Feature gates | Enable/disable features (charter requests, customer accounts) | Per-feature |

### 21.3 FeeConfig Is NOT a Flag

The platform fee rate (e.g., 6%) is not a feature flag — it's business data with audit requirements:
- Effective-dated (a rate change applies from date X, not retroactively)
- Per-operator overridable (operator A gets 4%, everyone else gets 6%)
- Change-audited (who changed the rate, when, from what to what)
- Read at credit time and recorded on each ledger entry

This lives in a proper `FeeConfig` database table, not in the feature flag system.
