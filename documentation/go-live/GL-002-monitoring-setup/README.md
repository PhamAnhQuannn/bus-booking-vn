# GL-002: Monitoring Setup

> Status: NOT_STARTED | References: ADR-007, SI-003 §11, SI-006 §9.4

## Purpose

Verify that monitoring tooling is deployed and configured to meet the 2-minute incident detection target (SI-006 §9.4) before production launch.

> **2026-06-21 Note**: Production is Vercel Pro + Neon + Upstash (ADR-020 D11). Vercel provides built-in analytics and function logs. Sentry and BetterStack remain the primary monitoring tools.

## Skill Invocation

- **Primary**: `/observability-design` -- monitoring architecture and alert configuration

## Acceptance Criteria

### Log Pipeline (ADR-007)

- [ ] Structured JSON logs on stdout (application-level)
- [ ] Log shipping to BetterStack (or equivalent) configured
- [ ] PII redaction verified at serialization layer
- [ ] 5 retention tiers configured (ADR-007):
  - Tier 1: Security events -- 365 days
  - Tier 2: Payment events -- 365 days
  - Tier 3: Application logs -- 90 days
  - Tier 4: Debug logs -- 30 days
  - Tier 5: Ephemeral (dev) -- 7 days

### Error Tracking (ADR-007)

- [ ] Sentry (or equivalent) configured for production environment
- [ ] Source maps uploaded to error tracker (Next.js build integration)
- [ ] Error grouping configured (avoid alert fatigue from duplicate errors)
- [ ] PII scrubbing configured in error tracker (no user data in error reports)

### Alerting

- [ ] Health check non-200 → alert within 2 minutes
- [ ] 5xx error rate > 5% → alert within 2 minutes
- [ ] Cron job missed run → alert within 2x job interval (ADR-007 P4)
- [ ] Payment webhook error rate > 1% → alert immediately
- [ ] Disk space > 80% → alert
- [ ] Tet-aware adaptive thresholds configured (ADR-007)

### Uptime Monitoring

- [ ] External uptime monitor (BetterStack or similar) configured
- [ ] Checking `/api/health` endpoint from external location
- [ ] 99.5% availability target tracked (normal ops)
- [ ] 99.9% availability target tracked (Tet period)

### Dashboard

- [ ] Key metrics dashboard configured:
  - Request rate, error rate, latency (p50/p95/p99)
  - Active bookings, active holds, payment success rate
  - Cron job execution times and success rates
  - Database connection pool usage

## Verdict

**PASS** when log pipeline, error tracking, alerting, and uptime monitoring are all deployed and verified to support 2-minute incident detection.

## Cross-References

- ADR-007 -- observability architecture
- SI-006 §9.4 -- NFR: 2-minute incident detection target
- SI-003 §11 -- post-deploy verification
