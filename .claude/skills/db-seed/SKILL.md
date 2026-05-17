---
name: db-seed
description: Idempotent seed script for dev/test fixtures. Auto-detects entities from schema. Re-runnable without dup. Production-guarded. Use when user says "seed data", "test fixtures", "demo data", "fixtures", "/db-seed", after schema change, or onboarding new dev. Writes <orm>/seed.<ext> + <orm>/seed-data/*.json.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 3h
---

# /db-seed — idempotent dev/test seed script

## Why you'd care

A fresh clone of the repo should produce a working app within one command. Without a seed script every dev hand-rolls fixtures, drifts apart, and bugs that depend on data shape go uncaught until prod. Idempotent seed = test fixtures + onboarding + demo prep, one file.

## Pre-flight

- **Stack auto-detect:** run `/stack-profile` first if uncertain. Worked example below uses Prisma + TypeScript + bcryptjs; adapt to your ORM (`alembic+sqlalchemy`, `django ORM`, `activerecord`, `gorm`, `knex`, etc.). The idempotency + ordering + prod-guard rules stay identical.
- **Schema source of truth.** Find your schema file — `prisma/schema.prisma`, `models.py`, `db/schema.rb`, `*.sql` migrations. Read it. Every seedable entity comes from there.
- **Entity auto-detect:** list models. Universal slots that almost every app has: `User`/`Account`, `Session` (skip — regenerable). Domain slots vary — `Restaurant + Menu + Booking + Table` (services), `Product + Order + Cart` (ecommerce), `Workspace + Subscription + Invoice` (SaaS), `Wallet + Transfer + Beneficiary` (fintech), `Course + Lesson + Enrollment` (edtech).
- **Decide if seed runs in prod.** Default: NO. Override env var: `ALLOW_PROD_SEED=true`.
- **Decide seed scope** — minimal vs realistic vs load-test.

## Inputs

- Schema file path (`prisma/schema.prisma` or equivalent).
- Entity list (auto-detect, then confirm).
- Scope (minimal / realistic / load-test).
- Production-guard policy (default refuse).

## Process

1. **Read schema.** Identify entities + FK relations + unique constraints.
2. **Decide seed scope:**
   - **Minimal:** 1 of each top-level entity, 5 of each child, 1 admin + 2 normal users.
   - **Realistic:** 3 of each top-level, 20–50 of each child, 10 users, mix of past + upcoming records where time-relevant.
   - **Load test:** 1000+ rows. Put in separate `seed-bulk.<ext>` — not the default seed.
3. **Externalize data.** Static fixtures in `<orm>/seed-data/*.json` so non-engineers can edit. JSON, not code.
4. **Idempotent upserts.** Every write keyed by a stable unique field (slug, email, externalId) — never by auto-increment id.
5. **Order by FK dependency.** Parents before children: e.g. Workspace → User → Membership → Resource. Run a topological sort if entity graph is non-trivial.
6. **Time-relative dates.** For records with `createdAt`/`scheduledAt`/`dueAt`, generate offsets from `new Date()` so the seed always shows fresh-looking data instead of going stale on a hard-coded date.
7. **Money realistic.** Cents/minor-unit (2099 = $20.99), integer math, no float drift.
8. **Hash secrets properly.** Even in dev — real bcrypt/argon2/scrypt so login behavior matches prod.
9. **Test data only for external vendors.** `cust_test_xxx`, not real customer IDs from any processor.
10. **Production guard.** Refuse to run if `NODE_ENV=production` (or equivalent) and `ALLOW_PROD_SEED !== 'true'`.

## Output Format — `prisma/seed.ts` (Prisma + TypeScript worked example)

```typescript
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { addDays, subDays, setHours } from "date-fns";

// Fixtures externalized so non-engineers can edit.
// Adjust file names to your domain — Restaurant has restaurants.json,
// SaaS has workspaces.json, ecommerce has products.json, etc.
import parents from "./seed-data/parents.json";
import children from "./seed-data/children.json";
import users from "./seed-data/users.json";

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PROD_SEED !== "true") {
    throw new Error("Refusing to seed production. Set ALLOW_PROD_SEED=true to override.");
  }

  console.log("🌱 Seeding…");

  // 1. Top-level entities (parents) — upsert by stable unique field.
  for (const p of parents) {
    await prisma.parent.upsert({
      where: { slug: p.slug },
      update: p,
      create: p,
    });
  }

  // 2. Child entities — upsert by composite unique (parentId, slug).
  for (const c of children) {
    const parent = await prisma.parent.findUniqueOrThrow({ where: { slug: c.parentSlug } });
    await prisma.child.upsert({
      where: { parentId_slug: { parentId: parent.id, slug: c.slug } },
      update: { name: c.name, priceCents: c.priceCents },
      create: { parentId: parent.id, slug: c.slug, name: c.name, priceCents: c.priceCents },
    });
  }

  // 3. Users — hash passwords properly.
  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role },
      create: { email: u.email, name: u.name, role: u.role, passwordHash },
    });
  }

  // 4. Time-relative records — past + upcoming relative to today.
  const customer = await prisma.user.findUniqueOrThrow({ where: { email: "demo@example.com" } });
  const parent = await prisma.parent.findFirstOrThrow();

  const records = [
    { offset: -7, hour: 19, status: "completed" },
    { offset: -2, hour: 20, status: "completed" },
    { offset: 1,  hour: 19, status: "confirmed" },
    { offset: 3,  hour: 12, status: "confirmed" },
    { offset: 7,  hour: 21, status: "confirmed" },
  ];

  for (const r of records) {
    const at = setHours(r.offset >= 0 ? addDays(new Date(), r.offset) : subDays(new Date(), -r.offset), r.hour);
    await prisma.timedRecord.upsert({
      where: { userId_parentId_at: { userId: customer.id, parentId: parent.id, at } },
      update: { status: r.status as any },
      create: { userId: customer.id, parentId: parent.id, at, status: r.status as any },
    });
  }

  console.log("✅ Seed complete");
}

main()
  .catch((e) => { console.error("❌ Seed failed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
```

### Domain-instantiation table — adapt `parents` / `children` / `timedRecord` to your vertical

| Vertical | Parent entity | Child entity | Timed record |
|----------|---------------|--------------|--------------|
| Services (restaurant/salon) | Venue | MenuItem / Service | Booking |
| Ecommerce | Store / Brand | Product | Order |
| SaaS B2B | Workspace | Resource | Subscription / Invoice |
| Marketplace | Seller | Listing | Transaction |
| Fintech | Account | Wallet | Transfer |
| Edtech | Course | Lesson | Enrollment |
| Healthcare | Practice | Provider / Service | Appointment |

Pick the row that matches; rename the JSON files + Prisma calls to match. Rest of script unchanged.

### Stack-adaptation notes

- **Django:** put seed in `management/commands/seed.py` with `BaseCommand`. `Model.objects.update_or_create()` is the upsert primitive.
- **Rails:** `db/seeds.rb` + `Model.find_or_create_by!(unique_field: x) { |m| m.attr = y }`.
- **SQLAlchemy:** `session.merge()` for upsert; commit per batch.
- **gorm:** `db.Where(...).FirstOrCreate(&model)` or `db.Clauses(clause.OnConflict{...}).Create(&model)`.

## Output Format — `prisma/seed-data/parents.json` (template, replace with your entity)

```json
[
  { "slug": "parent-a", "name": "Parent A", "addressLine": "123 Main St", "city": "Springfield" },
  { "slug": "parent-b", "name": "Parent B", "addressLine": "456 Oak Ave", "city": "Springfield" },
  { "slug": "parent-c", "name": "Parent C", "addressLine": "789 Pine Rd", "city": "Springfield" }
]
```

## Output Format — `prisma/seed-data/users.json`

```json
[
  { "email": "admin@example.com",     "name": "Admin User",     "role": "admin",    "password": "DevPassword123!" },
  { "email": "demo@example.com",      "name": "Demo Customer",  "role": "customer", "password": "DevPassword123!" },
  { "email": "staff@example.com",     "name": "Staff User",     "role": "staff",    "password": "DevPassword123!" }
]
```

## Boundaries

- **Idempotent always.** Every write is `upsert` keyed on a stable unique field. Never `create()` without dedupe.
- **No real PII.** `demo@example.com`, not real customer emails.
- **No real third-party IDs.** Test-mode IDs only.
- **Production guard mandatory.** Default refuse; override via env var.
- **Don't seed regenerable data** (sessions, rate-limit buckets, cache, search indexes).
- **Dates relative to today.** Avoid hard-coded dates that go stale.
- **Passwords hashed.** Real bcrypt/argon2 even in dev so login matches prod.

## Re-run Behavior

- Re-running with unchanged input = no-op.
- After schema change, regenerate ORM client first (e.g. `prisma generate`, `alembic upgrade head`), then re-run seed.
- For test isolation prefer per-test transactions or schema reset over re-seeding between tests.

## Auto-chain

- Schema change → re-run seed, surface stale fixtures
- New entity in schema → propose seed addition
- Test infra needing fixtures → reuse seed helpers (extract to `<orm>/seed-helpers.<ext>`)
- Bulk load testing → separate `seed-bulk.<ext>`
- Domain unclear → `/data-model-design` first

## Verification

After running:

1. Schema migrations applied (e.g. `prisma migrate deploy` clean).
2. `pnpm db:seed` (or equivalent) succeeds with no errors.
3. Re-run immediately → no errors, no duplicate rows (row counts unchanged).
4. App boots + login works with seeded credentials.
5. Time-relative records show recent dates (not stale).

## Example Trigger

User: "set up seed data so I have a working app on a fresh DB"
→ Read schema, detect entities, build idempotent seed with the right domain table from §Output Format, externalize JSON fixtures, add prod guard, write `prisma/seed.ts` (or stack equivalent).
