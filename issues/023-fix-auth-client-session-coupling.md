---
priority: should
source: architect-review
fingerprint: arch-client-session-singleton-coupling
severity: P3
---

## Parent PRD

`issues/prd.md` (fix-issue derived from PR #2 architect-review + security-review findings — no parent slice)

## What to build

Fix: client auth-session state lives as module-level mutable singletons in a route module.
Surfaced by /architect-review (cross-page coupling) + /security-review (token-in-singleton)
at `app/auth/register/page.tsx:33` (`_accessToken`, `setAccessToken`, `_displayName`,
`setDisplayName`), imported by `app/auth/login/page.tsx:11`.

A page importing another page's module for shared mutable auth state is an architectural
smell — and the in-memory access token is readable by any same-bundle code. Lift the client
session state into `lib/auth/clientSession.ts` (or a React context); both login and register
import from there instead of from each other.

This is a refactor with no behavior change — NOT fixed in PR #2 (presentational redesign
only). Pre-existing; tracked so the redesign momentum doesn't entrench it.

## Acceptance criteria

- [ ] `getAccessToken/setAccessToken/getDisplayName/setDisplayName` live in `lib/auth/clientSession.ts`.
- [ ] `app/auth/login/page.tsx` no longer imports from `@/app/auth/register/page`.
- [ ] No behavior change: login/register/logout flows pass their existing tests.
- [ ] /architect-review no longer emits fingerprint `arch-client-session-singleton-coupling`.

## Blocked by

None - can start immediately.
