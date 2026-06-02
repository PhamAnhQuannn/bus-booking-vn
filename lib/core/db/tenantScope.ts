/**
 * [SYS20] Tenant-scope one-way door (SYS00 #1 / SYS20 rule 5).
 *
 * Multi-tenancy guard: every operator-owned read/write injects the operator filter through
 * this helper so a repo can't forget it. By threading the `operatorId` into the Prisma query
 * args' `where` clause in one place, a cross-operator data leak becomes a compile/review-time
 * concern instead of a silent runtime bug scattered across every repo.
 */

/**
 * Inject the operator tenant filter into a Prisma findMany/findFirst/count/etc. `where`.
 *
 * Preserves every other arg key (`select`, `orderBy`, `take`, ...) and merges the caller's
 * existing `where` filters with the mandatory `operatorId` predicate.
 *
 * @param operatorId the tenant whose rows the query may touch
 * @param args       optional Prisma query args (may carry a partial `where` + other keys)
 * @returns the same args object with `operatorId` merged into `where`
 */
export function withOperatorScope<W extends Record<string, unknown>>(
  operatorId: string,
  args?: ({ where?: W } & Record<string, unknown>) | undefined,
): { where: W & { operatorId: string } } & Record<string, unknown> {
  const rest = args ?? {};
  const existingWhere = (rest.where ?? {}) as W;
  return {
    ...rest,
    where: { ...existingWhere, operatorId },
  };
}
