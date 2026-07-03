# GL-004: Deployment Rollback Plan

**Status:** READY
**Date:** 2026-07-03
**References:** SI-003 §11.5, ADR-017, SI-006

---

## 1. Rollback Trigger Thresholds

| Trigger | Threshold | Action |
|---------|-----------|--------|
| Health check failure | Non-200 for 2 consecutive minutes | Rollback |
| 5xx error rate | > 5% in first 10 minutes post-deploy | Rollback |
| Cron contract violation | Any cron returns unexpected shape | Rollback |
| Prisma migration failure | Migration error during deploy | **Forward-fix** (cannot rollback) |
| Operator portal 500 | Any console page returns 500 | Rollback |

## 2. Rollback Procedure

### 2.1 Vercel Production (primary)

Vercel is the primary deployment target (ADR-020 D11, SI-006 §1.1).

1. **Instant rollback via Vercel dashboard:** Deployments → select previous known-good deployment → "Promote to Production"
2. **Or redeploy via git:** `git revert <bad-commit> && git push origin master`
3. **Verify health:** `curl -f https://<prod-url>/api/health`
4. **Run smoke test:** `./scripts/fresh-boot-smoke.sh https://<prod-url>`

### 2.2 FPT Cloud Backup (Docker fallback)

If Vercel is unavailable or for the FPT Cloud Docker deployment:

#### Pre-deployment checklist

Before every deployment:
1. Record current running image SHA: `docker inspect --format='{{.Image}}' bus-booking-app`
2. Verify at least 3 previous image SHAs exist in GHCR: `gh api /orgs/.../packages/container/bus-booking/versions | head -5`
3. Note the rollback SHA in the deployment log

#### Rollback steps

```bash
# 1. Pull previous known-good image
export ROLLBACK_SHA="sha256:<previous-known-good>"
docker compose -f docker-compose.prod.yml pull

# 2. Update docker-compose.prod.yml image tag to rollback SHA
# 3. Restart services
docker compose -f docker-compose.prod.yml up -d

# 4. Verify health
curl -f https://<prod-url>/api/health

# 5. Run smoke test
./scripts/fresh-boot-smoke.sh https://<prod-url>
```

**Target rollback time:** < 5 minutes from decision to healthy state.

## 3. Migration Rollback Constraints (ADR-017)

This project uses **forward-only migrations** — no DOWN migration scripts exist.

### Forward-fix procedure

When a migration causes issues:

1. **Identify** the breaking migration in `prisma/migrations/`
2. **Author** a corrective forward migration:
   ```bash
   pnpm prisma migrate dev --name fix_<description>
   ```
3. **Test** on shadow database:
   ```bash
   docker compose -f docker-compose.dev.yml exec shadow-pg psql -U postgres -d shadow
   # Apply migration manually, verify
   ```
4. **Deploy** the forward-fix migration to production

### Two-phase destructive changes (ADR-017 D2)

Destructive schema changes (DROP COLUMN, DROP TABLE) must be split:

| Phase | Action | Deploy |
|-------|--------|--------|
| Phase A | Remove all code references to the column/table | Deploy, verify no runtime errors |
| Phase B | Create migration to DROP the column/table | Deploy |

Never combine code removal and schema DROP in the same deployment.

## 4. Rollback Decision Authority

| Role | Authority |
|------|-----------|
| Primary maintainer | Full rollback authority |
| On-call engineer | Rollback authority for health check / 5xx triggers |
| Automated monitoring | Auto-alert on threshold breach; human confirms rollback |

## 5. Communication Templates

### Customer notification (extended downtime > 15 min)

```
[BusBookVN] We are currently experiencing a service disruption.
Our team is working to restore service. Existing bookings are safe.
We apologize for the inconvenience. Updates at: [status page URL]
```

### Operator notification (extended downtime > 15 min)

```
[BusBookVN Operator] Platform is temporarily unavailable.
Your routes, trips, and booking data are safe. No action needed.
Service will resume shortly. Contact: [support email]
```

## 6. Post-Rollback Verification

After any rollback:

1. Health check: `GET /api/health` returns 200
2. Smoke test: `./scripts/fresh-boot-smoke.sh https://<prod-url>` passes
3. Cron endpoints: verify at least 3 respond correctly
4. Operator portal: spot-check dashboard, bus list, trip list
5. Check `JobRunLog` for any failed cron runs during the incident

## 7. Rollback Drill Checklist

- [ ] Simulated deployment failure on staging
- [ ] Rollback executed using procedure above
- [ ] Rollback time measured: ____ minutes (target: < 5 min)
- [ ] Post-rollback health check verified
- [ ] Post-rollback smoke test passed
- [ ] Post-rollback cron jobs verified
- [ ] Drill results documented

---

## Verdict Criteria

**PASS** when:
- Rollback procedure documented (this document)
- Rollback drill executed on staging at least once
- Measured rollback time within 5-minute target
- Post-rollback verification passes
