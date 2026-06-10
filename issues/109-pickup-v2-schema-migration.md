---
depends-on: [104-pickup-schema-migration-pickuppoint-removal]
type: FEATURE
labels: [pickup-areas, schema, migration]
---

## Parent PRD

`issues/prd-pickup-areas.md` · design `docs/design/pickup-points-v2.md` §2 / §2.4

## What to build

Schema + migration foundation for Pickup Points v2. Splits cleanly from the feature work (mirrors how
v1 isolated the schema in issue 104) so 110 (station-as-kind) and 111 (custom-request) build on a
landed, parity-checked migration. **No app behavior change in this issue** — columns + enum values only.

- **`PickupPlaceKind` enum** `{ station, pickup }` + `OperatorPickupArea.kind PickupPlaceKind @default(pickup)`.
- **Snapshot kind** on `TripPickupArea.kind` + `TemplatePickupArea.kind` (same enum, `@default(pickup)`).
- **`PickupKind` evolution**: `area` → `point` rename (in-place, atomic) + `ADD VALUE 'custom'`.
- **`customPickupRequested Boolean @default(false)`** on `Booking` + `Hold` with
  `@@index([tripId, customPickupRequested])`.
- **CHECK** `custom-requires-detail` on `Booking` + `Hold` (see AC; SQL-only per Issue-007 partial-index rule).

### Migration file split (hard requirement — QA P2-5 / P2-1)

Postgres `ADD VALUE` is unusable in the same transaction as any *use* of the new value. Prisma wraps
each migration file in one txn. Split into **two** migration directories:

1. **Migration A** — enum + plain columns ONLY, no statement references the literal `'custom'`:
   ```sql
   CREATE TYPE "PickupPlaceKind" AS ENUM ('station', 'pickup');
   ALTER TABLE "OperatorPickupArea" ADD COLUMN "kind" "PickupPlaceKind" NOT NULL DEFAULT 'pickup';
   ALTER TABLE "TripPickupArea"     ADD COLUMN "kind" "PickupPlaceKind" NOT NULL DEFAULT 'pickup';
   ALTER TABLE "TemplatePickupArea" ADD COLUMN "kind" "PickupPlaceKind" NOT NULL DEFAULT 'pickup';
   ALTER TYPE "PickupKind" RENAME VALUE 'area' TO 'point';
   ALTER TYPE "PickupKind" ADD VALUE 'custom';
   ALTER TABLE "Booking" ADD COLUMN "customPickupRequested" BOOLEAN NOT NULL DEFAULT false;
   ALTER TABLE "Hold"    ADD COLUMN "customPickupRequested" BOOLEAN NOT NULL DEFAULT false;
   CREATE INDEX "Booking_tripId_customPickupRequested_idx" ON "Booking" ("tripId", "customPickupRequested");
   ```
2. **Migration B** — the CHECK constraint (references `'custom'` indirectly via the boolean, so it must
   commit *after* A):
   ```sql
   ALTER TABLE "Booking" ADD CONSTRAINT "Booking_custom_requires_detail"
     CHECK (NOT "customPickupRequested" OR ("pickupDetail" IS NOT NULL AND length(btrim("pickupDetail")) >= 5));
   ALTER TABLE "Hold" ADD CONSTRAINT "Hold_custom_requires_detail"
     CHECK (NOT "customPickupRequested" OR ("pickupDetail" IS NOT NULL AND length(btrim("pickupDetail")) >= 5));
   ```

### schema.prisma parity (Issue-007)

Declare the three `kind` fields, both `customPickupRequested` booleans, the `@@index`, and both new
`PickupKind` members in `schema.prisma`. The two CHECK constraints stay SQL-only (Prisma DSL can't model
CHECK) — document each with a `///` model comment so a future reader doesn't "clean up" the orphan rule.

## Acceptance criteria

- [ ] `PickupPlaceKind` enum + `kind` column on `OperatorPickupArea`, `TripPickupArea`, `TemplatePickupArea`,
      all `@default(pickup)`, declared in `schema.prisma` AND in migration A SQL.
- [ ] `PickupKind` `area`→`point` renamed in-place; existing `area` rows read back as `point` (no data copy).
- [ ] `PickupKind` gains `custom`; both new members declared in `schema.prisma`.
- [ ] `customPickupRequested Boolean @default(false)` on `Booking` + `Hold` + composite index, in schema AND SQL.
- [ ] **Two** migration directories: A (enum+columns, no `'custom'` use) and B (CHECK). `ADD VALUE` lives in A only.
- [ ] CHECK `custom-requires-detail` on both tables; documented `///` comment on each model.
- [ ] Manual schema↔SQL parity audit passes (Issue-012: `prisma migrate diff` flags drifted in 7.x — read
      `@@index`/column decls vs `CREATE`/`ALTER` side-by-side; the diff CLI flags are removed in Prisma 7.8).
- [ ] `customPickupRequested BOOLEAN ... DEFAULT false` has a default → existing e2e/seed raw INSERTs unaffected
      (Issue-012/013 NOT-NULL-grep: confirm no `INSERT INTO "Booking"/"Hold"` breaks; defaults cover them).
- [ ] `pnpm tsc --noEmit` green. (Behavior unchanged — no test flips in this issue; the `area`→`point`
      literal sweep lands in 111 alongside the readers.)

## Blocked by

- Blocked by `issues/104-pickup-schema-migration-pickuppoint-removal.md` (the v1 Hold/Booking pickup fields this extends).

## QA provenance

Synthesizes the migration-safety findings from the 2026-06-09 4-agent QA of `docs/design/pickup-points-v2.md`:
edge-case P2-1 (ADD VALUE txn), P2-3/P1-3 (CHECK constraint), consistency Claim-6 (Issue-007/012/013 compliance).
