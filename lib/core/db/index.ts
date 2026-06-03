/**
 * [SYS20] lib/core/db — database primitive (prisma client + tenant-scope door).
 *
 * Cross-cutting DB access: the Prisma client singleton and the multi-tenancy tenant-scope
 * helper. Imported BY domains; imports NO domain. Re-exports the current prisma client living
 * at `@/lib/core/db/client` (the file does NOT move in this scaffold wave — later waves fold
 * `lib/db` into here). The prisma client is a core primitive, not a domain.
 *
 * Rule 5 (SYS20): every operator-owned repo query goes through `withOperatorScope` so a repo
 * can't forget the tenant filter.
 */

export { prisma } from '@/lib/core/db/client';
export { withOperatorScope } from './tenantScope';
