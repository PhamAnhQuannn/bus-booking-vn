---
priority: must
source: architect-review
fingerprint: layer-dashboard-prisma-direct
severity: P1
---

## Parent PRD

`issues/prd.md` (fix-issue derived from PR #4 architect-review — no parent slice)

## What to build

Fix: `app/op/(console)/dashboard/page.tsx:29,76` imports `prisma` and queries directly:
```ts
const routes = routeIds.length
  ? await prisma.route.findMany({
      where: { id: { in: routeIds }, operatorId: session.operatorId },
      select: { id: true, origin: true, destination: true },
    })
  : []
```

This is the ONLY `page.tsx` in the entire repo that imports prisma directly. Every
other server-component page (including this same dashboard before the redesign, and
the new activity page in this PR) routes through a `lib/op/*` or `lib/<domain>/*`
helper. The dashboard itself already correctly uses 8 lib helpers; the redesign added
one direct prisma query on top, breaking the convention the rest of the file upholds.

Suggested fix: extract the route-enrichment query into `lib/op/listRoutesForTripIds.ts`
(or fold it into whichever helper produces `todayCandidates` so the consumer never
sees raw routeIds). Drop the prisma import from the page.

```ts
// lib/op/listRoutesForTripIds.ts
export async function listRoutesForTripIds(
  operatorId: string,
  routeIds: string[]
): Promise<{ id: string; origin: string; destination: string }[]> {
  if (routeIds.length === 0) return [];
  return prisma.route.findMany({
    where: { id: { in: routeIds }, operatorId },
    select: { id: true, origin: true, destination: true },
  });
}
```

## Acceptance criteria

- [ ] `app/op/(console)/dashboard/page.tsx` no longer imports `prisma`.
- [ ] Behavior unchanged (route enrichment identical; dashboard renders the same).
- [ ] /architect-review no longer emits fingerprint `layer-dashboard-prisma-direct`.

## Blocked by

None - can start immediately.
