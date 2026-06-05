# Type Safety Audit — 2026-06-05

**Lang: ts** | **Project: D:\Bus-Booking** | **Scope: PR #7 feat/rebuild-complete @ 3fc5afba**
Context: PR body reports `pnpm tsc --noEmit` clean + `pnpm lint` 0 errors (42 pre-existing `_unused` warnings).

## Summary (non-test prod code)

| Pattern | Count | HIGH | MED | LOW |
|---------|------:|-----:|----:|----:|
| `: any`            | 7 (real) | -  | 1 | 6 |
| `as unknown as`    | 10       | -  | 1 | 9 |
| `as T` (wide)      | (not separately counted; tsc-clean) | - | - | - |
| `@ts-ignore` / `@ts-expect-error` | **0** | - | - | - |
| `eslint-disable` no-explicit-any (prod) | ~11 | - | - | 11 |
| `eslint-disable` no-explicit-any (test) | ~14 | - | - | 14 |
| **Total prod escape hatches** | ~28 | 0 | 2 | 26 |

## Delta vs prior
No prior `docs/qa/type-safety-*.md` — this is the baseline.

## Headline
**Zero `@ts-ignore` / `@ts-expect-error` in the entire codebase.** No type-suppression bug surface.
Every remaining escape hatch is (a) narrow `eslint-disable-next-line` scoped and (b) clustered in
two intentional patterns — the Prisma→narrow-interface DI seam, and the Next.js global singleton.

## P1 — fix soon
(none)

## P2 — review

| File:line | Pattern | Snippet | Suggested fix |
|-----------|---------|---------|----------------|
| `app/op/(console)/routes/RoutesClient.tsx:101` | `as unknown as` | `setRoutes(next as unknown as RouteItem[])` | Client double-casts an API response to `RouteItem[]` with NO runtime validation — if the route API shape drifts, this lies silently. Align the fetch-client return type to `RouteItem[]` (so no cast is needed) or validate with a Zod parse at the boundary. |
| `lib/ratelimit/index.ts:75` | `: any` | `private rl: any = null` | The Upstash Ratelimit instance is typed `any` on a field (lazy-init, optional dep). Type it `Ratelimit \| null` (or the InMemory union) so method calls on `this.rl` are checked. |

## P3 — accept (justified, isolated)

- **Prisma-DI narrowing (8 sites)** — `prisma as unknown as <NarrowReader>` + `(tx: any)` in
  `lib/flags/flags.ts`, `lib/ledger/{ledgerRepo,feeConfig,addManualAdjustment,setGlobalFee,setOperatorFeeOverride}.ts`.
  Deliberate: a hand-written minimal interface (`FeeConfigReader`, `LedgerEntryWriter`, …) is
  substituted for the full generated `PrismaClient` to make these repos unit-testable with a tiny
  mock. The `as unknown as` is the standard escape for "wide generated type → hand-written subset",
  and each `any` carries an `eslint-disable-next-line`. ACCEPTABLE.
  Nit: the disables state only the rule name, not a *reason*. Add a one-line justification per the
  skill's escape-hatch rule, e.g. `// DI seam: narrow PrismaClient to the read interface for mocking`.
- `lib/core/db/client.ts:9` — `globalThis as unknown as { prisma }` is the canonical Next.js dev
  hot-reload singleton guard. ACCEPT.
- `lib/notification/esms.ts:50` — `globalThis as unknown as { otpTestSink }` test-sink singleton
  (cross-route dedup, issue from this session). ACCEPT (test-support seam).
- `lib/payment/processWebhook.ts:154` — `eslint-disable no-explicit-any` on the canonical IPN
  payload typing. ACCEPT (provider payload is genuinely untyped at ingress; validated downstream).
- Test-file `eslint-disable no-explicit-any` (~14) — mock typing in `__tests__`. ACCEPT.

## Top hottest files
| Rank | File | Findings | Top severity |
|------|------|---------:|--------------|
| 1 | lib/ledger/* (5 files) | 8 | LOW (DI seam) |
| 2 | lib/flags/flags.ts | 4 | LOW (DI seam) |
| 3 | app/op/(console)/routes/RoutesClient.tsx | 1 | MED |
| 4 | lib/ratelimit/index.ts | 2 | MED |

## Next
- Fix the 2 P2s (RoutesClient unvalidated cast, ratelimit field type) — small, real.
- Optional hygiene: add reason text to the DI-seam eslint-disables.
- Type safety is a STRONG dimension: tsc-clean, zero ts-suppressions, all hatches narrow + intentional.

SUMMARY: 0 P1 · 2 P2 · 26 P3 (accepted)
