# HD-010: Infrastructure & Deployment Security

> Status: NOT_STARTED | References: ADR-008 D12, ADR-020, SI-006, GL-002

## Purpose

Verify production infrastructure security: FPT Cloud access controls, WAF configuration, TLS/SSL, secrets management, error monitoring, and Docker image hygiene. Covers the gap between application-level security (HD-001) and infrastructure-level controls.

## Skill Invocation

- **Primary**: `/security-review` -- infrastructure attack surface
- **Supplementary**: `/observability-review` -- monitoring stack verification

## Acceptance Criteria

### FPT Cloud Access Controls (ADR-020)

- [ ] MFA enabled on FPT Cloud console for all admin accounts (ADR-008 known gap)
- [ ] IP-based access control lockdown on FPT Cloud management console
- [ ] SSH key-based authentication only (no password SSH)
- [ ] Firewall rules: only ports 80, 443, 22 (restricted IP) exposed

### WAF & DDoS Protection

- [ ] Cloudflare WAF Pro ($20/mo) active on production domain
- [ ] OWASP Core Ruleset enabled
- [ ] Rate limiting rules configured at Cloudflare level (complement to application-level)
- [ ] Cloudflare SSL/TLS mode: Full (Strict) with origin certificate

### TLS/SSL

- [ ] Nginx reverse proxy: SSL with Let's Encrypt or Cloudflare Origin CA
- [ ] PostgreSQL connection: `sslmode=require` verified
- [ ] Redis connection: TLS enabled (if FPT managed Redis supports it)
- [ ] No plaintext internal traffic between containers (Docker network)

### Secrets Management (ADR-008 D7)

- [ ] No KMS/Vault -- env vars + Zod boot validation is current mechanism (documented limitation)
- [ ] All secrets validated at boot with min-length guards (Zod `superRefine`)
- [ ] Sandbox sentinel: `env.ts` rejects production deployment with test keys
- [ ] No secrets in Docker image layers (`docker history --no-trunc <image>` shows no env vars baked in)
- [ ] No secrets in `.tfstate` plaintext
- [ ] Secrets rotation runbook documented (6 JWT/HMAC secrets)
- [ ] 90-day rotation reminder: cron alert or calendar reminder configured
- [ ] Upgrade path documented: self-hosted HashiCorp Vault on FPT VM if investor diligence requires

### Error Monitoring & Uptime (FI-008 Gaps)

- [ ] Sentry deployed and capturing unhandled exceptions (FI-008: "no exception capture")
- [ ] BetterStack uptime monitoring active (2-min detection target per SI-006)
- [ ] Health check endpoint (`/api/health`) returning 200 with DB connectivity check
- [ ] Alert routing: Sentry -> Slack/email notification within 2 minutes

### Docker Image Security

- [ ] Image size < 500MB (SI-003 Section 10.1)
- [ ] Standalone output contains no devDependencies
- [ ] Base image pinned to specific digest (not `latest` tag)
- [ ] No unnecessary system packages in production image

### Edge vs Origin Security Boundary

- [ ] Edge middleware (`proxy.ts`): JWT decode, CSRF, rate limiting, redirect gates -- no DB access
- [ ] Origin (Node.js): Zod validation, `requireOperatorAuth`/`requireAdminAuth` with DB session verification
- [ ] `server-only` imports block server modules from leaking to client bundles
- [ ] Rate limiter fail-open behavior documented (Redis downtime = all requests pass unthrottled)
- [ ] Circuit-breaker for rate limiter: documented plan or explicit risk acceptance

## Verdict

**PASS** when: FPT Cloud access secured, WAF active, TLS verified, secrets validated at boot, error monitoring deployed. KMS/Vault deferral acceptable with documented upgrade path.

## Cross-References

- ADR-008 D12 -- infrastructure security requirements
- ADR-020 -- deployment architecture decisions
- SI-006 -- deployment configuration
- GL-002 -- monitoring setup (depends on Sentry + BetterStack)
- HD-001 -- application-level security (complementary)
- FI-008 -- payment integration (Sentry/BetterStack gaps)
