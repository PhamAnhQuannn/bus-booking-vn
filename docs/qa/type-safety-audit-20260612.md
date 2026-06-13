# Type Safety Audit — Refresh
Date: 2026-06-12
Scope: Full codebase (prior audit: 2026-06-05)

## Summary
The codebase is in good overall shape: zero `@ts-ignore`/`@ts-expect-error` suppressions, strict mode active throughout, and all financial/payment code has explicit return types. The dominant pattern is untyped `catch (e)` blocks — 79 occurrences across `lib/` and `app/api/` — which weakens error narrowing but does not cause runtime errors when code is structured defensively (which it is). The two P2 findings from the prior audit are both fixed. One new P2 (`tx as any` in the payment webhook for a missing Prisma model) and several P3 hygiene issues are introduced since the last audit.

## Metrics
- Total `any` occurrences: **12** (all in lib/ interface definitions or test mocks; zero in app/ production logic)
- Total `as unknown as` casts: **82** (majority in test files; 6 in production lib/ code)
- Total `@ts-ignore`/`@ts-expect-error`: **0**
- Total `!` non-null assertions: **~87** (all confined to test files and scripts; 2 in production UI components)
- Untyped `catch (e)` blocks: **79** (13 lib/, 55 app/api/, 11 app/ client components)

## Prior Findings Status

| Finding | Status |
|---------|--------|
| `app/op/(console)/routes/RoutesClient.tsx:101` — `as unknown as RouteItem[]` double-cast | **FIXED** — cast is gone; no longer present |
| `lib/ratelimit/index.ts:75` — `private rl: any` | **FIXED** — now typed as `private rl: UpstashRatelimitClient \| null = null` |

---

## P1 — Type Safety Holes (can cause runtime errors)

None found. No `@ts-ignore`, no unsafe widening in hot paths that could mask runtime type errors.

---

## P2 — Type Weakness (defeat static analysis)

**P2-1** `lib/payment/processWebhook.ts:157` — `(tx as any).paymentEvent.create(...)`

The transaction client `tx` is cast to `any` to access `.paymentEvent.create`. The `PaymentEvent` model exists in the schema but the `tx` handle (typed as `Prisma.TransactionClient`) does not expose it — this indicates `PaymentEvent` may be missing from `schema.prisma`'s generated client surface or the import is stale. The `as any` cast silences the type error rather than resolving why the model is absent from the transaction type. If the model is added/regenerated, the cast should be removed.

Fix: run `pnpm prisma generate`, confirm `PaymentEvent` appears on `Prisma.TransactionClient`, then remove the cast. If the model is intentionally a raw-SQL-only table, use `tx.$executeRaw` with a typed return.

**P2-2** `lib/flags/flags.ts:57,67` and `lib/ledger/setOperatorFeeOverride.ts:68`, `lib/ledger/setGlobalFee.ts:67`, `lib/ledger/addManualAdjustment.ts:69`, `lib/ledger/feeConfig.ts:102` — `(tx: any)` and `(args: any)` in interface definitions

Six minimal-surface Prisma interfaces use `any` for the `$transaction` callback tx parameter and `findUnique`/`findMany` args. The comment explains the motivation (both real client and test stub must satisfy the interface), but this defeats type-checking inside the callback body. These patterns propagate into 3 test files that copy the same interface mock.

Fix: use a conditional or generic approach: `$transaction: <T>(fn: (tx: Pick<PrismaClient, 'feeConfig' | 'adminAuditLog'>) => Promise<T>) => Promise<T>`. This narrows the tx handle to only the models each service touches while remaining assignable by both the real client and a typed mock.

**P2-3** `proxy.ts:156` — `new URL(request.url) as unknown as { pathname: string }`

`new URL()` already returns a `URL` object with a `.pathname: string` property. The cast is entirely unnecessary — `URL.pathname` is already typed as `string` in the standard lib. The cast is dead weight that suppresses any future type errors on the URL object.

Fix: `const { pathname } = new URL(request.url);` — remove the cast entirely.

**P2-4** `app/api/op/kyb/upload-url/route.ts:38` — `(await req.json()) as UploadUrlBody` without Zod validation

This is the only `req.json()` call in `app/api/` that casts directly to a typed interface rather than routing through `unknown` + Zod `safeParse`. All other API routes correctly use `let body: unknown` then Zod. The manual type check that follows (`typeof type !== 'string'` etc.) provides runtime safety but loses the Zod error shape and creates a manual maintenance burden.

Fix: introduce a `UploadUrlBodySchema = z.object({ type: z.string(), contentType: z.string(), sizeBytes: z.number() })` and use `safeParse`, consistent with every other route handler in the codebase.

---

## P3 — Type Hygiene (improvement opportunities)

**P3-1** 79 untyped `catch (e)` blocks

TypeScript's `useUnknownInCatchVariables` (implied by `strict: true`) means `e` is `unknown`, not `any`. The code is correct at runtime (each catch site inspects `e` before using it), but the pattern `} catch (e) {` followed by `e as SomeType` or `e instanceof SomeClass` is slightly less clear than `} catch (e: unknown) {` which makes the assumption explicit and satisfies `strict` mode requirements uniformly. This is a style/signal issue, not a bug.

Notable cases: `lib/trips/createTrip.ts:142` casts `e as { _trip?: string }` which is sound (the tagged-object pattern) but would read more clearly as `e instanceof TripServiceError`.

**P3-2** `withErrorHandler` in `lib/withErrorHandler.ts:15` erases route handler type

`withErrorHandler(handler: Handler): Handler` where `Handler = (req: NextRequest) => Promise<Response>` means any route with a more specific return type (e.g., returning typed `NextResponse<SpecificBody>`) gets widened to `Promise<Response>`. This is a P3 because the HOF is only used for error wrapping and the API contracts are validated via Zod at the route level anyway, but callers lose the narrower return-type signal.

**P3-3** Enum casts at DTO boundaries

`lib/booking/toBookingDto.ts:53-59`, `lib/trips/toTripDto.ts:40`, `lib/booking/listCustomerBookings.ts:87-88`, `lib/booking/toBookingQueueRow.ts:47-49` — all use `row.status as BookingDto['status']` style casts to narrow Prisma enum strings to DTO union types. This pattern is sound (the DB can only contain valid enum values if the schema is correct) but it bypasses a compile-time check that the DB enum and DTO union are in sync. If a new enum value is added to the Prisma schema but not to the DTO union, the cast silences what would otherwise be a tsc error.

Preferred fix: use an exhaustive mapper `const STATUS_MAP: Record<PrismaBookingStatus, BookingDtoStatus> = { ... }` which will produce a compile error when either side gains a value the other lacks.

**P3-4** `lib/auth/refreshToken.ts:110`, `lib/auth/operatorSession.ts:67`, `lib/auth/adminSession.ts:69` — `JSON.parse(...) as RefreshPayload`

Refresh token payloads are HMAC-verified before parsing, so the source is trusted — a malformed payload would be rejected before reaching these lines. However, the cast assumes shape without validation. A future schema change (adding/removing a field) would silently pass the cast. Low risk in practice because these types are internal and the HMAC prevents external tampering.

**P3-5** `lib/jobs/reconcilePayments.ts:132` — `JSON.parse(row.rawBody) as Record<string, unknown>`

Raw webhook body parsed and cast to loose map, then accessed via `parsed.amount` and `parsed.resultCode` with `Number()` coercions. Pattern is internally correct but unvalidated — a malformed stored payload would produce `NaN` values that propagate silently. A `z.object({ amount: z.number().optional(), resultCode: z.number().optional() }).safeParse(parsed)` would make the failure explicit.

**P3-6** `app/op/(console)/buses/BusesClient.tsx` and `app/op/(console)/routes/RoutesClient.tsx` — `catch (e)` followed by `e as ApiError`

Production client components cast caught errors to `ApiError` to extract `.message`. If the thrown value is not an `ApiError` (e.g., a network `TypeError`), `e.message` may still exist (Error base class) but `e.code` would be undefined. This is defensive code that works but would benefit from an `instanceof ApiError` guard.

---

## `any` Usage Inventory

| File:Line | Context | Necessary? | Proper Type |
|-----------|---------|------------|-------------|
| `lib/flags/flags.ts:57` | `FeatureFlagReader.featureFlag.findUnique` arg | Debatable | `Prisma.FeatureFlagFindUniqueArgs` |
| `lib/flags/flags.ts:67` | `FeatureFlagWriter.$transaction` tx param | Debatable | `Pick<PrismaClient, 'featureFlag' \| 'adminAuditLog'>` |
| `lib/ledger/setOperatorFeeOverride.ts:68` | `FeeOverridePrisma.$transaction` tx param | No | `Pick<PrismaClient, 'feeConfig' \| 'adminAuditLog'>` |
| `lib/ledger/setGlobalFee.ts:67` | Same pattern for global fee | No | Same fix |
| `lib/ledger/addManualAdjustment.ts:69` | Same pattern for manual adjustment | No | Same fix |
| `lib/ledger/feeConfig.ts:102` | `FeeConfigReader.feeConfig.findMany` arg | Debatable | `Prisma.FeeConfigFindManyArgs` |
| `lib/payment/processWebhook.ts:157` | `(tx as any).paymentEvent.create` | No — bug signal | Remove after `prisma generate` |
| `lib/charter/__tests__/declineCharter.test.ts:27` | Empty prisma mock | Acceptable in tests | `Partial<PrismaClient>` |
| `lib/charter/__tests__/createCharterRequest.test.ts:53-152` | `(args as any).data` | No | type the mock fn arg properly |
| `lib/charter/__tests__/charterStatus.test.ts:54` | `mockPrisma as any` | Acceptable in tests | typed partial mock |
| `lib/booking/__tests__/checkIn.test.ts:43` | `{} as any` mock | Acceptable in tests | `Partial<...>` |

Note: comment-only occurrences (`lib/trips/searchTrips.ts:29`, `lib/onboarding/payoutAccount.ts:8`) are false positives — they are English prose in JSDoc.

---

## Unsafe Cast Inventory

| File:Line | Cast Expression | Justification | Fix |
|-----------|----------------|---------------|-----|
| `proxy.ts:156` | `new URL(req.url) as unknown as { pathname: string }` | None — URL already has `.pathname` | Remove cast entirely |
| `lib/payment/processWebhook.ts:157` | `(tx as any).paymentEvent.create` | Missing Prisma model on tx type | Run `prisma generate`; remove cast |
| `lib/ledger/setOperatorFeeOverride.ts:79` | `defaultPrisma as unknown as FeeOverridePrisma` | Structural typing workaround | Acceptable at default-param boundary |
| `lib/ledger/setGlobalFee.ts:78` | Same pattern | Same | Acceptable |
| `lib/ledger/addManualAdjustment.ts:80` | Same pattern | Same | Acceptable |
| `lib/ledger/ledgerRepo.ts:116` | `prisma as unknown as LedgerEntryWriter` | Structural narrowing | Acceptable |
| `lib/ledger/feeConfig.ts:141` | `prisma as unknown as FeeConfigReader` | Structural narrowing | Acceptable |
| `lib/core/db/client.ts:9` | `globalThis as unknown as { prisma: PrismaClient }` | Standard Next.js global pattern | Acceptable |
| `lib/flags/flags.ts:135,156` | `prisma as unknown as FeatureFlagReader` | Structural narrowing | Acceptable |
| `lib/notification/esms.ts:63` | `globalThis as unknown as { _esmsClient: ... }` | Global singleton pattern | Acceptable |
| DTO files (toBookingDto, toTripDto, etc.) | `row.status as DtoStatus` | Prisma enum → DTO union | Replace with exhaustive record map (P3-3) |
| Auth files (refreshToken, operatorSession, adminSession) | `JSON.parse(...) as RefreshPayload` | HMAC-verified source | Acceptable; see P3-4 for improvement |

Test-file `as unknown as` casts (50+) are standard Vitest mock patterns and are omitted from this table.

---

## JSON.parse Safety

| File:Line | Parsed What | Validated? | Typed? |
|-----------|-------------|------------|--------|
| `lib/auth/refreshToken.ts:110` | HMAC-verified refresh token payload | HMAC verifies integrity (not shape) | Cast to `RefreshPayload` — no Zod |
| `lib/auth/operatorSession.ts:67` | HMAC-verified op refresh payload | Same | Cast to `OpRefreshPayload` |
| `lib/auth/adminSession.ts:69` | HMAC-verified admin refresh payload | Same | Cast to `AdminRefreshPayload` |
| `lib/payment/adapters/momo.ts:104` | MoMo webhook raw body | Signature verified before shape access | Cast to `Record<string, unknown>` — fields accessed safely |
| `lib/payment/adapters/stub.ts:137` | Stub adapter raw body | Try/catch wraps | Cast to `Record<string, unknown>` |
| `lib/jobs/reconcilePayments.ts:132` | Stored PaymentEvent.rawBody | Try/catch; fields coerced with `Number()` | Cast to `Record<string, unknown>` — no Zod |
| `app/api/admin/operators/[id]/confirm-payout-account/route.ts:45` | Optional request body | Try/catch; Zod `safeParse` follows immediately | Assigned to `unknown` then Zod-validated ✓ |
| All other `req.json()` in `app/api/` | Request bodies | Assigned to `unknown` then Zod `safeParse` ✓ | Properly untyped then validated |

All `req.json()` calls (except `upload-url/route.ts:38`, flagged as P2-4) correctly use `unknown` before Zod validation. JWT payload parses are trusted-source but unvalidated by Zod. Webhook body parses use a `Record<string, unknown>` cast with downstream field-level access guards.

---

## Recommendations

### Immediate (before go-live)
1. **P2-1**: Investigate `PaymentEvent` missing from `Prisma.TransactionClient` — run `pnpm prisma generate` and confirm the model is present. Remove `(tx as any)` in `processWebhook.ts:157`. This is the only `as any` cast in production payment code.
2. **P2-3**: Remove the pointless `as unknown as { pathname: string }` cast in `proxy.ts:156` — one-line fix, zero risk.
3. **P2-4**: Replace the direct `as UploadUrlBody` cast in `kyb/upload-url/route.ts:38` with a Zod schema — makes it consistent with all other route handlers.

### Short-term (next sprint)
4. **P2-2**: Narrow the `$transaction: (tx: any)` interfaces in `lib/ledger/` and `lib/flags/` to `Pick<PrismaClient, '<model1>' | '<model2>'>`. This eliminates 6 of the 12 `any` occurrences and strengthens test mock type-checking.
5. **P3-3**: Replace all `row.status as DtoStatus` casts in DTO mapper files with exhaustive `Record<PrismaEnum, DtoEnum>` maps. This will surface mismatches at compile time when either enum grows.

### Maintenance
6. **P3-1**: Add `catch (e: unknown)` consistently — low priority but signals explicit acknowledgement of the strict-mode catch type. A project-wide sed/codemod would do it in one pass.
7. **P3-4/P3-5**: Add Zod validation for JWT refresh payloads and stored webhook bodies. Worth doing before issue 094 (go-live) when tampered tokens could originate from real users.
