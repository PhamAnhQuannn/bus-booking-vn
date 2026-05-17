---
name: sso-saml-design
description: SAML 2.0 + OIDC + SCIM 2.0 + JIT provisioning so enterprise buyers can plug your app into their IdP without a custom integration. Outputs to `docs/design/sso-<service>.md`. Reads `/project-classify` to skip XS/S. Use when user says "SSO", "SAML", "OIDC", "SCIM", "JIT provisioning", "enterprise login", "/sso-saml-design", or when first enterprise prospect asks "do you support SSO?"
output_size:
  XS: skip
  S: skip
  M: 8h
  L: 8h
  XL: 8h
---

# /sso-saml-design — Enterprise SSO Contract

Invoke as `/sso-saml-design`. Enterprise buyers gate on SSO. Build SAML + OIDC + SCIM correctly once, sell to every Fortune 500 IT team that asks.

## Why you'd care

"Do you support SSO" is the first question every enterprise procurement team asks, and "not yet" is the answer that ends the call. SAML + OIDC + SCIM up-front is the price of admission to enterprise sales.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS/S → SKIP (gated feature, not for hobby projects).
2. Identity model exists (users, orgs/tenants).
3. Library decided: `saml2-js` / `passport-saml` / `node-saml` (Node), `python3-saml` (Py), `OneLogin/ruby-saml`, `pac4j` (JVM).

## Inputs
- Target IdP support matrix (which IdPs first)
- Existing auth model (password / magic-link / OAuth social)
- Tenant model (subdomain vs path vs explicit org-id)
- Group → role mapping rules

## Process

1. **Protocol pick** — what to support, in what order:

   | Protocol | Use case | Effort | Buyer ask % |
   |---|---|---|---|
   | SAML 2.0 | Enterprise (Okta, Azure AD, ADFS) | high | 90% of enterprise |
   | OIDC | Modern IdPs (Okta, Auth0, Google Workspace) | medium | 60% of enterprise |
   | SCIM 2.0 | Auto-provisioning + de-provisioning | medium | 40% (>1k seat deals) |
   | LDAP | Legacy, on-prem | high | 10% (avoid if possible) |

   Build order: SAML → SCIM → OIDC. SAML first because it unblocks the most deals.

2. **IdP support matrix** — test against each, document quirks:

   | IdP | SAML | OIDC | SCIM | Notes |
   |---|:--:|:--:|:--:|---|
   | Okta | YES | YES | YES | Reference impl; SCIM via "Provisioning" tab |
   | Azure AD / Entra | YES | YES | YES | Group claim format quirks; needs explicit attribute mapping |
   | Google Workspace | YES | YES | partial | SCIM via Cloud Identity Premium only |
   | OneLogin | YES | YES | YES | metadata URL format differs |
   | JumpCloud | YES | YES | YES | smaller deals, easy to support |
   | ADFS | YES | partial | NO | on-prem; assertion encryption common |
   | Ping | YES | YES | YES | enterprise; agentless SCIM |

3. **Initiation flows** — support both:

   | Flow | Triggered by | Use case |
   |---|---|---|
   | SP-initiated | User clicks "Login with SSO" on your site | Default; enter email → discover IdP → redirect |
   | IdP-initiated | User clicks tile in Okta/Azure dashboard | Unsolicited SAMLResponse to ACS URL |

   IdP-initiated requires: unsolicited response handling, no `InResponseTo` to validate against, careful CSRF mitigation (state in RelayState).

4. **Metadata exchange** — both directions, signed:
   - **SP metadata** (you publish): `https://<app>/sso/<tenant>/metadata.xml`
     - EntityID, ACS URL (POST binding), SLO URL, signing cert, NameID format
   - **IdP metadata** (admin uploads OR you fetch URL): EntityID, SSO URL, signing cert
   - Prefer metadata URL over copy-paste XML — cert rotation is automatic
   - Validate IdP cert chain on every assertion; alert when cert expires <30d

5. **Assertion mapping** — explicit, per tenant:

   | SAML claim | App field | Required | Notes |
   |---|---|:--:|---|
   | NameID (or `email` attr) | `users.email` | YES | unique key |
   | `firstName` / `lastName` | display | NO | best-effort |
   | `groups` (multi-valued) | `users.role` via mapping | YES (for RBAC) | tenant-configurable mapping |
   | `department` | optional tag | NO | filters/dashboards |

   Group → role mapping is per-tenant configuration (`admin-group` → `admin` role). Default to read-only role on first login; require admin to elevate.

6. **SCIM 2.0 endpoints** — for auto-provision:
   - `POST /scim/v2/Users` — create (idempotent on `externalId`)
   - `PATCH /scim/v2/Users/<id>` — update (active=false on offboard)
   - `DELETE /scim/v2/Users/<id>` — hard delete (or soft via PATCH active=false)
   - `GET /scim/v2/Users?filter=userName eq "x"` — lookup
   - `POST /scim/v2/Groups`, `PATCH /scim/v2/Groups/<id>` — group sync
   - Auth: bearer token per tenant (rotate-able)
   - Return SCIM error schema, not generic 500

7. **JIT provisioning** — first-login user creation:
   - If `email` in assertion not in DB AND tenant has JIT enabled → create user
   - Default role: `member` (or per-tenant default)
   - Mark `provisioned_via: 'sso-jit'` for audit
   - If SCIM is also enabled: prefer SCIM as source of truth; JIT only when SCIM hasn't synced yet

8. **Security must-haves** — non-negotiable:

   | Check | Why |
   |---|---|
   | Signed SAMLResponse (verify signature on Assertion AND Response) | tamper protection |
   | Validate `Issuer` matches expected IdP EntityID | wrong IdP rejection |
   | Validate `Audience` = your SP EntityID | replay across services |
   | Validate `NotBefore` / `NotOnOrAfter` (clock skew ≤ 3min) | replay window |
   | Track Assertion ID in cache for `NotOnOrAfter` duration | replay prevention |
   | Validate `InResponseTo` matches AuthnRequest ID (SP-initiated only) | CSRF |
   | Encrypted assertions if IdP requires (ADFS) | confidentiality |
   | Reject unsigned assertions in prod | always |

9. **Session + logout**:
   - Local session TTL ≤ IdP-asserted `SessionNotOnOrAfter` (default 8h if absent)
   - Single Logout (SLO): SP-initiated logout sends LogoutRequest to IdP; IdP-initiated logout posts LogoutRequest to your SLO endpoint
   - SLO is brittle across IdPs — also support local "sign out" that revokes local session only
   - Refresh: re-authenticate via SAML if session expires; do not silent-refresh with stored creds

10. **Anti-patterns**:
    - Per-tenant code branches (forks per IdP) — use config not code
    - Skipping signature verification "for testing" left in prod — disaster
    - One global SAML config — must be per-tenant
    - JIT without role default — every new user gets admin
    - No SCIM de-provision path — ex-employees retain access

## Output

Write `docs/design/sso-<service>.md`:

```markdown
# SSO — <service>
**Date:** <YYYY-MM-DD> | **Owner:** <auth team>

## Supported protocols
- SAML 2.0 (primary)
- OIDC (secondary)
- SCIM 2.0 (auto-provision)

## IdP matrix
| IdP | SAML | OIDC | SCIM | Tested |
|---|:--:|:--:|:--:|:--:|
| Okta | YES | YES | YES | YES |
| Azure AD | YES | YES | YES | YES |
| Google | YES | YES | partial | YES |
| OneLogin | YES | YES | YES | partial |

## Endpoints
- SP metadata: `/sso/<tenant>/metadata.xml`
- ACS (POST): `/sso/<tenant>/acs`
- SLO: `/sso/<tenant>/slo`
- SCIM base: `/scim/v2/<tenant>/`

## Assertion mapping
| Claim | Field | Required |
|---|---|:--:|
| NameID | email | YES |
| groups | role (per-tenant map) | YES |

## Security
- [x] Signature verification on Response + Assertion
- [x] Audience + Issuer validation
- [x] Replay protection (assertion-id cache)
- [x] Clock skew ≤ 3min
- [x] InResponseTo validation (SP-initiated)

## JIT rules
- Default role: member
- Tag: `provisioned_via: sso-jit`
- Disabled if SCIM enabled

## Session
- Local TTL: 8h or IdP `SessionNotOnOrAfter`
- SLO: best-effort
- Local sign-out always supported

## Per-tenant config
- Stored in `tenant_sso_config` (encrypted)
- Cert rotation: prefer metadata URL
- Alert: cert expiry < 30d
```

## Verification
- SAML signature verified on BOTH Response and Assertion.
- Audience + Issuer + NotBefore/NotOnOrAfter validated.
- Replay cache holds assertion IDs.
- SP and IdP metadata exchange documented.
- SCIM endpoints implement Users + Groups + de-provision.
- JIT default role is least-privilege, not admin.
- Per-tenant config, not global.
- Cert-expiry alert wired.
