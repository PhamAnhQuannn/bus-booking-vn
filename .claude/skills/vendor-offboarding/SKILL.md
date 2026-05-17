---
name: vendor-offboarding
description: Procedure to remove a SaaS/cloud vendor cleanly: data export, account close, billing stop, key revocation, contract termination. Outputs to `docs/ops/vendor-offboarding-<vendor>.md`. Reads `/project-classify` to skip XS. Use when user says "drop vendor", "cancel SaaS", "switch from X to Y", "vendor offboarding", "/vendor-offboarding", or before contract renewal you don't intend to take.
output_size:
  XS: skip
  S: 1h
  M: 2h
  L: 4h
  XL: 4h
---

# /vendor-offboarding — Clean Vendor Exit

Invoke as `/vendor-offboarding`. Cancelled SaaS lingers as recurring charges, leaked tokens, and ghost integrations. Run the checklist once; sleep better.

## Why you'd care

Cancelling a SaaS without exporting data, revoking keys, and stopping billing is how dormant accounts leak credentials and silently bill for years. An offboarding procedure is the closing-bracket every vendor needs.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS → SKIP.
2. Vendor inventory list exists (or build from billing / SSO directory).
3. Contract terms reviewed (notice period, data retention obligation).

## Inputs
- Target vendor name + service category
- Replacement decided (if any) — or "pure exit"
- Data in vendor (DB rows? logs? attachments? configs?)
- Integration surface (webhooks, API keys, SSO, OAuth apps)

## Process

1. **Pre-exit inventory** — what does this vendor touch?

   | Touchpoint | Action |
   |---|---|
   | Data stored there | export + verify restore-ability |
   | API keys issued by them | list + plan revoke |
   | API keys WE issued to them | list + plan revoke |
   | Webhooks from us → them | disable in our system |
   | Webhooks from them → us | disable on their dashboard |
   | OAuth app installed | revoke from app store |
   | SSO integration | unlink + verify users still have access |
   | DNS records pointing to them | update + wait for TTL |
   | Embeds / scripts on our site | remove from code |
   | Subscriptions / cron jobs we depend on | cut over to replacement |

2. **Contract review** — read before clicking cancel:
   - Notice period (often 30-90 days for annual contracts)
   - Auto-renewal date (cancel before this date)
   - Data retention obligation (do they keep our data after? for how long?)
   - Termination fees / early-exit clauses
   - Data return clause (what format, what timeline?)
   - Confidentiality obligations (NDA survives termination)

3. **Data export** — before clicking cancel:
   - Full data dump in machine-readable format (JSON / CSV / native dump)
   - Validate completeness: row counts, file counts, checksum where possible
   - Store in our cold archive (S3 + lifecycle policy)
   - Test restore into replacement (if applicable)
   - Document export location + retention in this runbook

4. **Cutover sequence** — order matters:
   1. Stand up replacement / fallback (if any)
   2. Dual-run for N days (both vendors active; validate parity)
   3. Switch writes to new vendor; old vendor read-only
   4. Switch reads to new vendor
   5. Disable webhooks both directions
   6. Revoke API keys (theirs first; ours second)
   7. Remove vendor's code/SDK from our repo
   8. Update DNS / config / env vars
   9. Cancel subscription in their dashboard
   10. Confirm billing stop in our next statement

5. **Identity + access cleanup**:
   - Revoke their access to our systems (any SSO group membership)
   - Revoke our team's access to their dashboard (mark accounts deactivated)
   - Remove from password manager
   - Update vendor inventory list
   - Cancel any auto-renew payment methods on file with them

6. **Notification** — who needs to know:

   | Audience | Notification |
   |---|---|
   | Internal team | Slack #ops + #eng with cutover date |
   | Customers (if user-facing) | email + status page note 14d ahead |
   | Finance | invoice expected; budget update |
   | Security | remove from vendor risk register |
   | Compliance | update SOC2 vendor list |

7. **Post-cutover verification** — 7-30d watch:
   - No traffic going to old vendor (firewall log / SDK metrics)
   - No bills from old vendor (next billing cycle)
   - No support tickets referencing missing functionality
   - All exports archived + readable

8. **Data deletion request** — close the loop:
   - Within retention window from contract, request deletion of our data
   - Get written confirmation (email is fine)
   - File confirmation in compliance folder
   - For GDPR / sensitive data: confirm certificate of destruction if available

9. **Anti-patterns**:
   - Cancel via dashboard click without exporting data first — data gone
   - Cancel without revoking integration tokens — orphan creds float
   - Stop paying without sending notice — auto-renew kicks in; contract dispute
   - Replace vendor before validating new one — outage when old turns off
   - "We'll get to it later" cleanup — old SDK still in codebase 2 years later
   - Forget DNS records / CNAMEs — vendor still routes traffic somewhere

## Output

Write `docs/ops/vendor-offboarding-<vendor>.md`:

```markdown
# Vendor Offboarding — <vendor>
**Date initiated:** <YYYY-MM-DD> | **Owner:** <name>
**Target exit date:** <YYYY-MM-DD>
**Replacement:** <vendor or N/A>

## Touchpoint inventory
| Touchpoint | Status |
|---|---|
| Data stored | [ ] exported |
| API keys (theirs) | [ ] revoked |
| API keys (ours to them) | [ ] revoked |
| Webhooks out | [ ] disabled |
| Webhooks in | [ ] disabled |
| OAuth app | [ ] revoked |
| SSO | [ ] unlinked |
| DNS | [ ] updated |
| Code SDK | [ ] removed |
| Cron / scheduled jobs | [ ] cut over |

## Contract
- Notice period: <N> days
- Cancel-by date: <YYYY-MM-DD>
- Data retention obligation: <duration>
- Termination fee: <amount or none>

## Data export
- Location: s3://archive/vendor-<name>/<date>
- Format: JSON + CSV
- Row counts: <table>
- Checksum: <sha256>
- Restore tested: yes/no

## Cutover sequence
- [ ] Replacement live + dual-run started
- [ ] Writes flipped
- [ ] Reads flipped
- [ ] Webhooks disabled
- [ ] Keys revoked
- [ ] Code removed
- [ ] DNS updated
- [ ] Subscription cancelled
- [ ] First bill-free statement confirmed

## Notifications
- [ ] Internal team
- [ ] Customers (if applicable)
- [ ] Finance
- [ ] Security
- [ ] Compliance

## Post-cutover watch (30d)
- [ ] No traffic to old endpoint
- [ ] No billing
- [ ] No support tickets

## Data deletion
- [ ] Requested <date>
- [ ] Confirmed <date>
- [ ] Filed in compliance/

## Lessons / followups
[Notes for future vendor exits]
```

## Verification
- Inventory of touchpoints complete before any cancel click.
- Data exported + verified before subscription cancel.
- API keys revoked both directions.
- Code/SDK removed from repo (grep clean).
- DNS records updated; old TTLs expired.
- Final bill confirmed zero.
- Data deletion confirmation filed.
- Vendor removed from risk register + SOC2 list.
