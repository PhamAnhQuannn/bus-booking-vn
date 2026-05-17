---
name: rbac-model
description: Role/permission matrix + enforcement points so every protected action has one obvious owner. Outputs to `docs/design/rbac.md` + `lib/authz.ts`. Reads `/project-classify` to skip XS. Use when user says "RBAC", "roles", "permissions", "authorization", "policy", "/rbac-model", or before second user type joins the app.
output_size:
  XS: skip
  S: 1h
  M: 4h
  L: 8h
  XL: 8h
---

# /rbac-model — Role-Based Access Control

Invoke as `/rbac-model`. Authentication says who you are. Authorization says what you can do. Without a model, you ship `if (user.email === 'me@me.com')` and call it security.

## Why you'd care

Authorization that lives in scattered `if (user.role === 'admin')` checks across the codebase is how privilege-escalation bugs ship. One enforcement point with a written model is what makes the next protected feature safe by default.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS → SKIP.
2. User model exists (auth in place).
3. Tenant model decided (single-tenant / multi-tenant per org).

## Inputs
- List of protected resources (orders, invoices, users, settings)
- List of actor types (admin, member, billing-admin, read-only, support, system)
- Tenancy boundary (org-scoped vs global roles)

## Process

1. **Resource × action matrix** — first column is resources, top row actions:

   | Resource | create | read | update | delete | list-all |
   |---|:--:|:--:|:--:|:--:|:--:|
   | Order | member | member (own) / admin (all) | admin | admin | admin |
   | Invoice | system | billing-admin | billing-admin | NEVER | billing-admin |
   | User (within org) | admin | member | admin | admin | member |
   | Settings | — | member | admin | — | — |
   | Audit log | system | admin (read-only) | NEVER | NEVER | admin |

   "own" qualifier matters — ownership check is separate from role check.

2. **Role pick** — keep small, expand reluctantly:

   | Role | Scope | Includes |
   |---|---|---|
   | `owner` | org | all permissions + billing + delete-org |
   | `admin` | org | user mgmt + settings + all resources |
   | `member` | org | core product (read+write own, read others) |
   | `billing-admin` | org | invoices + payment method only |
   | `read-only` | org | read everything, write nothing |
   | `support` | global | impersonation read-only, audit-logged |
   | `system` | global | webhook handlers, cron, internal calls |

   Default new user → `member`. First user in org → `owner`. Resist "role per feature" — leads to combinatorial explosion.

3. **Permission key naming** — `resource:action[:scope]`:
   - `order:read:own`, `order:read:all`
   - `user:invite`, `user:delete`
   - `billing:read`, `billing:update`
   - `audit:read`
   - Wildcards in role definition only: `owner` has `*:*`; never resolve `*` at check site.

4. **Enforcement points** — every protected call passes through:

   | Layer | What |
   |---|---|
   | Route handler middleware | Coarse: "is user signed in?" |
   | Service-layer guard | Fine: "can this user perform this action on this resource?" |
   | DB row filter (RLS or scoped query) | "user only sees rows in their org" |
   | UI render gate | hide buttons user can't use (UX, not security) |

   Server is source of truth. UI hide is courtesy; never trust the client.

5. **`lib/authz.ts` scaffold**:
   ```ts
   type Permission = `${string}:${string}` | `${string}:${string}:${string}`

   const ROLE_PERMS: Record<Role, Set<Permission>> = {
     owner: new Set(['*:*']),
     admin: new Set(['user:invite','user:delete','order:*','settings:*','audit:read']),
     member: new Set(['order:create','order:read:own','order:update:own','settings:read']),
     'billing-admin': new Set(['billing:read','billing:update','invoice:read']),
     'read-only': new Set(['*:read']),
   }

   export function can(user: User, perm: Permission, resource?: { ownerId?: string; orgId: string }): boolean {
     if (user.orgId !== resource?.orgId) return false   // tenancy fence
     const perms = ROLE_PERMS[user.role]
     if (perms.has('*:*')) return true
     if (perms.has(perm)) return true
     if (perm.endsWith(':own') && resource?.ownerId === user.id && perms.has(perm.replace(':own',':own'))) return true
     // wildcard within resource (admin has order:*)
     const [res] = perm.split(':')
     return perms.has(`${res}:*` as Permission) || perms.has(`*:${perm.split(':')[1]}` as Permission)
   }

   export function assert(user: User, perm: Permission, resource?: any): void {
     if (!can(user, perm, resource)) throw new ForbiddenError(perm)
   }
   ```
   Call `assert()` at the top of every service method. Tests verify it fires.

6. **Impersonation (support)** — controlled, audited:
   - Only `support` role can impersonate
   - Generates a short-lived session token bound to (support_user_id, target_user_id, reason)
   - Every write during impersonation: log original support_user_id + target
   - Read-only impersonation default; write requires explicit "elevate" with TTL

7. **Group memberships (optional)** — only if needed:
   - Org → Teams → Users; resource owned by team
   - `can(user, 'doc:read', doc)` returns true if user in `doc.team_id`
   - Avoid until you have evidence; flat user-in-org is enough for first 100 customers

8. **Anti-patterns**:
   - `if (user.email === 'admin@')` — sticks forever
   - Permission check only in UI — API still callable
   - One mega-role "admin" gets everything — billing-admin is a separate scope
   - Permission stored on user, not derived from role — drift inevitable
   - No tenancy fence — cross-tenant data leak waiting to happen

## Output

Write `docs/design/rbac.md`:

```markdown
# RBAC — <project>
**Date:** <YYYY-MM-DD> | **Owner:** <auth/platform team>

## Roles
| Role | Scope | Description |
|---|---|---|
| owner | org | all + billing + delete-org |
| admin | org | user mgmt + all resources |
| member | org | own resources + read others |
| billing-admin | org | invoices + payment method |
| read-only | org | read all, no write |
| support | global | impersonation, audit-logged |
| system | global | webhooks/cron |

## Permission matrix
| Resource | create | read | update | delete |
|---|---|---|---|---|
| Order | member | member(own)/admin(all) | admin | admin |
| Invoice | system | billing-admin | billing-admin | NEVER |
| User | admin | member | admin | admin |

## Enforcement
- Middleware: auth-required
- Service: `assert(user, 'order:update', order)`
- DB: row scoped by orgId
- UI: hide buttons (courtesy)

## Impersonation
- Only `support` role
- Read-only default; elevate w/ reason + TTL
- Every action audit-logged with both IDs

## Tenancy fence
- Every `can()` check verifies `user.orgId === resource.orgId`

## Default new user
- Member role on join
- First user of new org → owner
```

Write `lib/authz.ts` with the scaffold from Process #5.

## Verification
- Every protected service method calls `assert()` at top.
- Tenancy fence verified in `can()`.
- Permission matrix covers every resource × action.
- Impersonation logs both IDs.
- Tests cover allow + deny per role per resource.
- UI gating exists but is NOT the only check.
