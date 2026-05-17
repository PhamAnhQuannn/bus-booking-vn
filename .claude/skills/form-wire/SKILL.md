---
name: form-wire
description: Schema → form wire-up. RHF+Zod / Formik / vee-validate / wtforms / Go templ. Reads `lib/forms/<model>.fields.ts` from `/codegen-from-schema` (or hand-written). Emits typed form component + submit handler + error display. Stack-branched via `/stack-profile`. Skip-when no UI in stack. Use when user says "wire form", "form for X", "react-hook-form", "/form-wire <model>".
---

# /form-wire — Schema-Driven Form Wire-up

## Why you'd care

Hand-wiring forms against a schema is where typos, drift, and silent type mismatches enter the codebase. A generated, typed form component keeps the schema and the UI honest in one step.

Invoke as `/form-wire <model>`. Turns a field map into a typed, validated form with first-class error UX.

---

## Pre-flight

1. Read `docs/stack/profile.md`. Frontend = `none` / `cli` → halt.
2. Resolve field map:
   - JS: `lib/forms/<model>.fields.ts` (from `/codegen-from-schema`)
   - Python: `app/forms/<model>.py`
3. If field map missing → ask user: "run `/codegen-from-schema` first, or pass `--inline` to hand-spec fields".
4. If form component already exists at target path → ask: overwrite, augment, or rename.

---

## Inputs

- Model name (`<model>`)
- Field map source
- Stack profile (Frontend, Validator)
- Optional `--multistep` for wizard-style
- Optional `--server-action` (Next.js) uses server actions instead of fetch

---

## Stack branch

| Frontend         | Form lib              | Validator     | File path                                    |
|------------------|-----------------------|---------------|----------------------------------------------|
| Next.js + React  | react-hook-form       | Zod resolver  | `components/forms/<Model>Form.tsx`           |
| Vue 3            | vee-validate          | Zod schema    | `components/forms/<Model>Form.vue`           |
| SvelteKit        | sveltekit-superforms  | Zod schema    | `lib/components/forms/<Model>Form.svelte`    |
| FastAPI + Jinja  | wtforms               | wtforms validators | `app/templates/forms/<model>.html`     |
| Go + templ       | net/http + go-playground/form | go-playground/validator | `internal/<model>/form.templ` |

---

## Workflow

1. Parse field map → `[{name, label, widget, required, validation}]`.
2. Emit form component:
   - `useForm` (RHF) with `zodResolver(<Model>Create)`.
   - Per field: `<Controller>` or `<input {...register('name')}>`.
   - Per field: error message slot below input.
   - Disabled submit while `formState.isSubmitting`.
   - Top-level "form-level error" slot for server errors.
3. Emit submit handler:
   - Calls the typed client SDK from `/codegen-from-contract` if present, else `fetch`.
   - On success → `router.push` or `onSuccess` callback.
   - On 4xx with `issues[]` → `setError(fieldName, ...)` per issue.
   - On 5xx → form-level error slot.
4. Emit story/sandbox file if Storybook configured.
5. Smoke: typecheck the new file only.

---

## File templates (Next.js + RHF + Zod)

`components/forms/<Model>Form.tsx`:

```tsx
'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { <Model>Create, type <Model>CreateT } from '@/lib/validators/<model>';
import { <model>Fields } from '@/lib/forms/<model>.fields';
import { create<Model> } from '@/lib/api/<model>.client';

export function <Model>Form({ onSuccess }: { onSuccess?: (id: string) => void }) {
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } =
    useForm<<Model>CreateT>({ resolver: zodResolver(<Model>Create) });

  async function onSubmit(values: <Model>CreateT) {
    try {
      const r = await create<Model>(values);
      onSuccess?.(r.id);
    } catch (e: any) {
      if (e?.issues) e.issues.forEach((i: any) => setError(i.path[0], { message: i.message }));
      else setError('root', { message: e?.message ?? 'Failed' });
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      {<model>Fields.map((f) => (
        <div key={f.name}>
          <label htmlFor={f.name}>{f.label}{f.required && ' *'}</label>
          <input id={f.name} type={f.type} {...register(f.name as any)} aria-invalid={!!errors[f.name as keyof typeof errors]} />
          {errors[f.name as keyof typeof errors] && (
            <p role="alert">{(errors[f.name as keyof typeof errors] as any).message}</p>
          )}
        </div>
      ))}
      {errors.root && <p role="alert">{errors.root.message}</p>}
      <button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Save'}</button>
    </form>
  );
}
```

---

### Vue 3 (FormKit + Pinia) worked example

`components/forms/CheckoutForm.vue` (model: `checkout`):

```vue
<script setup lang="ts">
import { FormKit, FormKitSchema } from '@formkit/vue';
import { useCheckoutStore } from '@/stores/checkout';
import { checkoutFields } from '@/lib/forms/checkout.fields';
import { submitCheckout } from '@/lib/api/checkout.client';

const store = useCheckoutStore();
const schema = checkoutFields.map((f) => ({
  $formkit: f.widget, name: f.name, label: f.label,
  validation: f.required ? `required|${f.rule ?? ''}` : f.rule,
  'aria-describedby': `${f.name}-err`,
}));

async function onSubmit(values: Record<string, unknown>, node: any) {
  try { const r = await submitCheckout(values); store.markPaid(r.id); }
  catch (e: any) {
    if (e?.issues) node.setErrors({}, Object.fromEntries(e.issues.map((i: any) => [i.path[0], i.message])));
    else node.setErrors([e?.message ?? 'Failed']);
  }
}
</script>

<template>
  <FormKit type="form" @submit="onSubmit" :actions="false">
    <FormKitSchema :schema="schema" />
    <button type="submit" :disabled="store.submitting">Pay</button>
  </FormKit>
</template>
```

Pinia store holds cross-step draft + submit flag. FormKit emits `aria-invalid` + error region automatically.

---

### Async field validation (debounce + remote check)

Pattern: user types `username` → wait 300ms idle → fire `GET /api/username?q=…` → abort prior request → only apply result if response matches latest query (race-safe).

React (RHF, model: `signup`):

```tsx
const ctrl = useRef<AbortController | null>(null);
const seq = useRef(0);

const checkUsername = useMemo(() => debounce(async (value: string) => {
  ctrl.current?.abort();
  ctrl.current = new AbortController();
  const my = ++seq.current;
  try {
    const r = await fetch(`/api/username?q=${encodeURIComponent(value)}`, { signal: ctrl.current.signal });
    const { available } = await r.json();
    if (my !== seq.current) return; // stale
    if (!available) setError('username', { message: 'Taken' });
    else clearErrors('username');
  } catch (e: any) { if (e.name !== 'AbortError') setError('username', { message: 'Check failed' }); }
}, 300), []);

<input {...register('username', { onChange: (e) => checkUsername(e.target.value) })} />
```

Vue (FormKit async rule, model: `signup`):

```ts
import { debounce } from 'lodash-es';
let ctrl: AbortController | null = null;
let seq = 0;

export const usernameAvailable = debounce(async (node: any) => {
  ctrl?.abort(); ctrl = new AbortController();
  const my = ++seq;
  const r = await fetch(`/api/username?q=${node.value}`, { signal: ctrl.signal });
  const { available } = await r.json();
  if (my !== seq) return true; // stale → don't overwrite
  return available;
}, 300);
// schema: validation: [['required'], ['usernameAvailable']]
```

Rule: always increment `seq` *before* await, compare *after* — guards out-of-order responses.

---

### Multi-step form state persistence

Three strategies for `--multistep` (model: `profile-edit`):

| Strategy            | Refresh-safe | Share-link | Cross-device | Best for            |
|---------------------|--------------|------------|--------------|---------------------|
| URL query (`?step=2&name=…`) | yes  | yes        | yes (via link) | Short, non-sensitive |
| `sessionStorage`    | yes (tab)    | no         | no           | Default; PII-light   |
| Server draft endpoint (`POST /drafts`) | yes | yes (draft id) | yes (auth)   | Long forms, logged-in |

- URL: `router.replace({ query: { step, ...values } })` — never put passwords/PII here.
- sessionStorage: key `<model>-draft`, hydrate on mount, clear on submit success.
- Server draft: `PATCH /drafts/<id>` per step; final step `POST /<model>` referencing draft id; TTL the draft server-side.

Combine: sessionStorage for instant resume + server draft on `blur` of last field per step for cross-device.

---

### ARIA + a11y cross-ref

Every emitted input gets:

- `<label htmlFor={id}>` ↔ `<input id={id}>` — explicit association (no implicit wrapping).
- `aria-invalid={hasError}` on input.
- `aria-describedby="<id>-err <id>-hint"` pointing at error + hint regions.
- Error region: `<p id="<id>-err" role="alert">{msg}</p>` — `role="alert"` makes SR announce on appearance.
- Form-level error: `role="alert"` + `aria-live="assertive"`.
- Submit button: `aria-busy={isSubmitting}` while pending.

Full a11y pass (focus order, color contrast, keyboard traps, error-summary at top) → see `/a11y-design`.

---

## Widget map (field type → JSX)

| widget   | input element                                          |
|----------|--------------------------------------------------------|
| text     | `<input type="text" />`                                |
| email    | `<input type="email" />`                               |
| url      | `<input type="url" />`                                 |
| number   | `<input type="number" {...register(n,{valueAsNumber:true})} />` |
| money    | `<input type="number" step="0.01" />`                  |
| date     | `<input type="date" {...register(n,{valueAsDate:true})} />` |
| boolean  | `<input type="checkbox" />`                            |
| enum     | `<select>{options}</select>`                           |
| relation | `<Combobox>` (async fetcher)                           |
| json     | `<textarea>` + try/catch parse on submit               |

---

## Multistep variant (`--multistep`)

Adds a `step` state, slices field array per step, persists draft to `sessionStorage` keyed by `<model>-draft`. Final step calls submit.

---

## Output

Side-effect = form file (+ optional story). After emit, print:

```
Form wired: <Model>Form at <path>. Fields: <N>. Submit → <client/server-action>.
Next: import where needed; /smoke-test the happy path.
```

---

## When to re-run

- Field map changes (re-run after `/codegen-from-schema`).
- Switching form lib (`--lib`).
- Do NOT hand-edit emitted file — re-spec field map and re-run.
