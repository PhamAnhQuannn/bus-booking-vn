---
name: codegen-from-schema
description: Reads ORM schema (Prisma/Drizzle/SQLAlchemy/sqlc/raw SQL) and emits matching validators, form field maps, and an admin CRUD scaffold. Stack-branched via `/stack-profile`. Skip-when no schema file. Use when user says "generate from schema", "scaffold CRUD", "form from schema", "/codegen-from-schema", or after a `prisma migrate dev` lands new models.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /codegen-from-schema — Schema → Code

## Why you'd care

Validators, form maps, and admin CRUDs hand-written against a schema get out of sync the first time a column is added. Generating them off the canonical model means migrations and code stay aligned without a per-PR audit.

Invoke as `/codegen-from-schema`. Reads the canonical data model and emits derived code so schema is the single source of truth.

---

## Pre-flight

1. Read `docs/stack/profile.md`. Missing → run `/stack-profile`, halt.
2. Detect schema file by ORM in profile:
   - Prisma → `prisma/schema.prisma`
   - Drizzle → `drizzle/schema.ts` or `db/schema.ts`
   - SQLAlchemy → `app/models.py` or `app/db/models.py`
   - sqlc → `db/queries.sql` + `db/schema.sql`
   - raw SQL → `db/schema.sql`
3. If ORM in profile = `raw / none` → halt with note: "no schema layer to derive from".
4. If schema unchanged since prior run (hash match in `docs/qa/codegen-schema-<date>.md`) → halt: "no drift".

---

## Inputs

- ORM schema file (path resolved in pre-flight)
- Stack profile (Frontend, Backend, Validator preference)
- Optional `--models <list>` to limit emit; default = all models
- Optional `--no-admin` to skip CRUD scaffold

---

## Emit map per ORM × stack

| ORM      | Validator out             | Form field map out             | Admin CRUD out                       |
|----------|---------------------------|--------------------------------|--------------------------------------|
| Prisma   | `lib/validators/<model>.ts` (Zod from Prisma types) | `lib/forms/<model>.fields.ts` | `app/admin/<model>/{page,new,edit}.tsx` + `app/api/admin/<model>/route.ts` |
| Drizzle  | `lib/validators/<model>.ts` (drizzle-zod) | `lib/forms/<model>.fields.ts` | same Next.js shape                   |
| SQLAlchemy | `app/schemas/<model>.py` (Pydantic) | `app/forms/<model>.py` (wtforms) | `app/admin/<model>.py` (FastAPI router) |
| sqlc     | `internal/<model>/validate.go` | n/a (Go = no JSX) | `internal/admin/<model>.go` (chi handlers + templ) |

---

## Field-type → form-widget mapping

| DB type            | Form widget       | Zod / Pydantic rule          |
|--------------------|-------------------|------------------------------|
| `string` / `text`  | text input        | `z.string().min(1)`          |
| `string` (email)   | email input       | `z.string().email()`         |
| `string` (url)     | url input         | `z.string().url()`           |
| `int` / `integer`  | number input      | `z.number().int()`           |
| `decimal` / `money`| money input       | `z.number().nonnegative()`   |
| `boolean`          | checkbox / switch | `z.boolean()`                |
| `datetime` / `date`| date picker       | `z.coerce.date()`            |
| `enum`             | select            | `z.enum([...])`              |
| `relation` (FK)    | combobox          | `z.string().uuid()` or id ref|
| `json`             | textarea (JSON)   | `z.record(z.unknown())`      |

---

## Workflow

1. Parse schema → AST → list of `{model, fields[], relations[], enums[]}`.
2. For each model:
   - Emit base validator (create + update variants — update is `.partial()`).
   - Emit form field map array consumed by `<DynamicForm>`.
   - If `--no-admin` absent: emit list page (table), new page (form), edit page (form prefilled), and CRUD API route.
3. Emit one shared `<model>.types.ts` re-exporting Prisma/Drizzle inferred types.
4. Update `lib/validators/index.ts` barrel.
5. Record schema hash in output report so re-runs detect drift.

---

## File template (Prisma + Next.js)

`lib/validators/<model>.ts`:

```ts
import { z } from 'zod';
export const <Model>Create = z.object({
  /* TODO(codegen): fields per schema */
});
export const <Model>Update = <Model>Create.partial();
export type <Model>CreateT = z.infer<typeof <Model>Create>;
export type <Model>UpdateT = z.infer<typeof <Model>Update>;
```

`lib/forms/<model>.fields.ts`:

```ts
import type { FieldDef } from '@/lib/forms/types';
export const <model>Fields: FieldDef[] = [
  // TODO(codegen): { name, label, type, required } per field
];
```

`app/admin/<model>/page.tsx`:

```tsx
import { prisma } from '@/lib/db';
export default async function <Model>List() {
  const rows = await prisma.<model>.findMany();
  return <table>{/* TODO(codegen): columns */}</table>;
}
```

### SQLAlchemy + FastAPI router wiring

Rule: parse `Column(...)` → emit Pydantic `BaseModel` → mount FastAPI router with 5 CRUD endpoints → emit admin form scaffold.

`app/models.py` (input):

```py
class Order(Base):
    __tablename__ = "orders"
    id = Column(UUID, primary_key=True)
    total = Column(Numeric(10, 2), nullable=False)
    status = Column(Enum("pending", "paid", name="order_status"))
```

`app/schemas/order.py` (emit — Pydantic v2):

```py
class OrderCreate(BaseModel):
    total: Decimal = Field(ge=0)
    status: Literal["pending", "paid"]
class OrderUpdate(OrderCreate.__class__): ...  # all-optional via model_config
```

`app/admin/order.py` (emit — router + endpoints):

```py
router = APIRouter(prefix="/admin/orders", tags=["order"])
@router.get("/")            ; @router.get("/{id}")
@router.post("/", 201)      ; @router.patch("/{id}")
@router.delete("/{id}", 204)
# each: Depends(get_db), Depends(require_admin), pydantic in/out
```

Admin form scaffold — pick one per stack profile:
- Jinja: `app/templates/admin/order_form.html` with `{% for f in fields %}` loop over emitted `fields: list[FieldDef]`.
- React Admin: `app/admin/order.tsx` with `<SimpleForm>` + `<TextInput source="total">` per field.

Generation rule (not full code): one field row per `Column` → widget chosen via the field-type table above → `nullable=True` flips `required: false`.

### Date-range + multi-select widget patterns

Rule: when emitting two adjacent date columns named `*_start` / `*_end` → emit a paired range widget. When emitting an FK to a many-to-many join → emit multi-select combobox.

TS side (`lib/forms/listing.fields.ts`):

```ts
{ name: 'available', type: 'date-range', from: 'available_start', to: 'available_end',
  rule: z.object({ from: z.coerce.date(), to: z.coerce.date() })
        .refine(v => v.from <= v.to, 'from must be <= to') }
{ name: 'tags', type: 'multi-select', source: 'tags', component: 'HeadlessCombobox',
  rule: z.array(z.string().uuid()).min(1).max(10) }
```

HTML5 emit: two `<input type="date" min={from} max={today}>` bound to the same `react-hook-form` group; Headless UI `<Combobox multiple>` for tags with `displayValue` returning `selected.map(t => t.name).join(', ')`.

Python side (`app/schemas/listing.py`):

```py
class ListingFilter(BaseModel):
    available_start: date; available_end: date
    tags: list[UUID] = Field(min_length=1, max_length=10)
    @model_validator(mode="after")
    def _range(self): assert self.available_start <= self.available_end; return self
```

Server-side range validation runs in both Zod `.refine` and Pydantic `model_validator` — emit both, never trust client-only.

### i18n label scaffold

Rule: every emitted form field → `label: t('<model>.<field>.label')` + auto-append key to `locales/<lang>/<model>.json`. Default lang seeded from English-cased field name.

Emit pattern (TS):

```ts
{ name: 'email', label: t('user.email.label'), type: 'email',
  placeholder: t('user.email.placeholder') }
```

Emit pattern (Python / Jinja):

```py
{"name": "email", "label_key": "user.email.label", "type": "email"}
# template: {{ _(field.label_key) }}
```

Locale-file side effect — for each new field, append (skip if key present):

```json
// locales/en/user.json
{ "email": { "label": "Email", "placeholder": "you@example.com" } }
```

Pair with `/i18n-design` for tone/voice rules; `/codegen-from-schema` only seeds keys, never overwrites translated values. Codegen run records `i18n keys added: <N>` in the QA report.

---

## Output

Side-effect = source files. After emit, write `docs/qa/codegen-schema-<date>.md`:

```markdown
# /codegen-from-schema run — <YYYY-MM-DD>
- Schema: <path> (hash: <sha256-short>)
- Models emitted: <N>
- Files written: <list>
- Drift since last run: <yes|no>
- Smoke: lint <pass|fail>, typecheck <pass|fail>
```

---

## When to re-run

- After `prisma migrate dev` / Drizzle migration / model edit.
- After ORM swap (re-detects in pre-flight).
- Hash mismatch → drift → re-run safe.
