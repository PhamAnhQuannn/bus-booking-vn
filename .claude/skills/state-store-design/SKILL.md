---
name: state-store-design
description: Frontend state store wire-up. Zustand/Redux Toolkit/Pinia/MobX per `docs/stack/profile.md`. Emits store + slices/actions + selectors + devtools + persist middleware (opt-in). Skip-when no frontend in stack. Use when user says "state store", "zustand setup", "redux slice", "pinia store", "/state-store-design <slice>", or before wiring a feature that needs cross-component state.
---

# /state-store-design — Frontend Store Wire-up

Invoke as `/state-store-design <slice>` (e.g. `/state-store-design cart`). Drops a typed, devtools-enabled store slice ready for component import.

---

## Why you'd care

A frontend without a deliberate state store accumulates prop-drilling and context-soup until every refactor breaks four components. Wiring it up once with selectors and devtools is what keeps the UI tractable.

## Pre-flight

1. Read `docs/stack/profile.md`. Frontend = `none` / `cli` → halt: "no frontend, no store".
2. Detect existing store lib:
   - JS: scan `package.json` for `zustand`, `@reduxjs/toolkit`, `mobx`, `jotai`, `valtio`.
   - Vue: scan for `pinia`, `vuex`.
3. If store already wired AND a slice named `<slice>` exists → ask: overwrite, augment, or rename.
4. If no store lib detected → propose default per stack table; ask before installing.

---

## Inputs

- Slice name (`<slice>`)
- Stack profile (Frontend, framework version)
- Optional `--persist` adds local/session storage middleware
- Optional `--lib <zustand|rtk|pinia|mobx|jotai>` overrides default

---

## Lib pick per stack

| Frontend stack       | Default lib        | Why                                                  |
|----------------------|--------------------|------------------------------------------------------|
| Next.js / React 18+  | Zustand            | Minimal API, no Provider, RSC-friendly               |
| Large React + complex flows | Redux Toolkit | Time-travel devtools, RTK Query, team familiarity   |
| React + atomic state | Jotai              | Per-atom reactivity, no global tree                  |
| Vue 3                | Pinia              | Official, devtools-native, composition-API           |
| Vue 2                | Vuex 4             | Last legacy support tier                             |
| Svelte               | Built-in stores    | No external lib needed                               |
| Solid                | createStore        | Built-in fine-grained reactivity                     |

---

## Slice anatomy (uniform across libs)

| Concept       | Lives in                                          |
|---------------|---------------------------------------------------|
| State shape   | typed interface at top                            |
| Actions       | functions that mutate state                       |
| Derived       | selectors / computed / getters                    |
| Async ops     | thunks (RTK) / store action (Zustand/Pinia)        |
| Devtools      | enabled in dev only                               |
| Persist       | opt-in, only for UI prefs and unsubmitted drafts  |

Rule: no derived state stored. Compute via selector. Persist nothing that is server-truth (user, orders, lists).

---

## Workflow

1. Resolve lib + slice path per stack table.
2. Emit store slice file.
3. Emit selector file (`<slice>.selectors.ts`) if non-trivial derived state.
4. Wire into root if framework requires (RTK `configureStore`, Pinia `app.use(pinia)`).
5. Emit one usage example as a comment block in the slice file.
6. Smoke: typecheck the new files only.

---

## File templates

### Zustand (Next.js / React)

`lib/stores/<slice>.store.ts`:

```ts
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

type <Slice>State = {
  items: string[];
  loading: boolean;
};

type <Slice>Actions = {
  add: (item: string) => void;
  remove: (item: string) => void;
  reset: () => void;
};

const initial: <Slice>State = { items: [], loading: false };

export const use<Slice>Store = create<<Slice>State & <Slice>Actions>()(
  devtools(
    // persist( /* uncomment if --persist */
    (set) => ({
      ...initial,
      add: (item) => set((s) => ({ items: [...s.items, item] }), false, '<slice>/add'),
      remove: (item) => set((s) => ({ items: s.items.filter((x) => x !== item) }), false, '<slice>/remove'),
      reset: () => set(initial, false, '<slice>/reset'),
    }),
    // , { name: '<slice>-store' })
    { name: '<slice>-store' },
  ),
);

// Usage: const items = use<Slice>Store((s) => s.items);
```

Selectors file (`lib/stores/<slice>.selectors.ts`):

```ts
import { use<Slice>Store } from './<slice>.store';

export const selectItemCount = () => use<Slice>Store((s) => s.items.length);
export const selectHasItems = () => use<Slice>Store((s) => s.items.length > 0);
```

### Pinia (Vue 3) equivalent

Setup-store form (composition API) — preferred for Vue 3 + Vite + `<script setup>`.

`stores/<slice>.ts`:

```ts
import { defineStore, acceptHMRUpdate } from 'pinia';
import { ref, computed } from 'vue';

export const use<Slice>Store = defineStore('<slice>', () => {
  const items = ref<string[]>([]);
  const loading = ref(false);

  const itemCount = computed(() => items.value.length);
  const hasItems = computed(() => items.value.length > 0);

  function add(item: string) { items.value.push(item); }
  function remove(item: string) { items.value = items.value.filter((x) => x !== item); }
  function reset() { items.value = []; loading.value = false; }

  return { items, loading, itemCount, hasItems, add, remove, reset };
});

if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(use<Slice>Store, import.meta.hot));
```

Options-store form — pick when team prefers Vuex-shaped mental model or legacy port:

```ts
export const use<Slice>Store = defineStore('<slice>', {
  state: () => ({ items: [] as string[], loading: false }),
  getters: {
    itemCount: (s) => s.items.length,
    hasItems: (s) => s.items.length > 0,
  },
  actions: {
    add(item: string) { this.items.push(item); },
    remove(item: string) { this.items = this.items.filter((x) => x !== item); },
    reset() { this.items = []; this.loading = false; },
  },
});
```

Wire `main.ts` (devtools auto-attach in dev):

```ts
import { createPinia } from 'pinia';
const pinia = createPinia();
app.use(pinia);
```

Component use: `const store = use<Slice>Store(); const { itemCount } = storeToRefs(store);` — `storeToRefs` preserves reactivity on destructure.

### Redux Toolkit Slice equivalent

`src/store/<slice>Slice.ts`:

```ts
import { createSlice, createSelector, type PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from './index';

type <Slice>State = { items: string[]; loading: boolean };
const initialState: <Slice>State = { items: [], loading: false };

const <slice>Slice = createSlice({
  name: '<slice>',
  initialState,
  reducers: {
    add: (s, a: PayloadAction<string>) => { s.items.push(a.payload); },
    remove: (s, a: PayloadAction<string>) => { s.items = s.items.filter((x) => x !== a.payload); },
    reset: () => initialState,
  },
});

export const { add, remove, reset } = <slice>Slice.actions;
export default <slice>Slice.reducer;

// Selector pattern — memoized, co-located with slice
const selectSelf = (s: RootState) => s.<slice>;
export const selectItems = createSelector(selectSelf, (x) => x.items);
export const selectItemCount = createSelector(selectItems, (xs) => xs.length);
```

RTK Query for server state (drop-in replacement for hand-rolled thunks):

```ts
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const <slice>Api = createApi({
  reducerPath: '<slice>Api',
  baseQuery: fetchBaseQuery({ baseUrl: '/api/' }),
  tagTypes: ['<Slice>'],
  endpoints: (b) => ({
    list<Slice>: b.query<string[], void>({ query: () => '<slice>', providesTags: ['<Slice>'] }),
    add<Slice>: b.mutation<void, string>({
      query: (item) => ({ url: '<slice>', method: 'POST', body: { item } }),
      invalidatesTags: ['<Slice>'],
    }),
  }),
});

export const { useList<Slice>Query, useAdd<Slice>Mutation } = <slice>Api;
```

`src/store/index.ts` (emit if absent):

```ts
import { configureStore } from '@reduxjs/toolkit';
import <slice>Reducer from './<slice>Slice';
import { <slice>Api } from './<slice>Slice';

export const store = configureStore({
  reducer: { <slice>: <slice>Reducer, [<slice>Api.reducerPath]: <slice>Api.reducer },
  middleware: (gDM) => gDM().concat(<slice>Api.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

When RTK still earns its weight: existing Redux codebase (migration cost > benefit), opinionated time-travel devtools required, large team needing one rigid shape, RTK Query already replacing axios + react-query layer. Greenfield small-to-mid React → prefer Zustand + TanStack Query.

### Jotai (React atomic)

`lib/atoms/<slice>.ts`:

```ts
import { atom } from 'jotai';

export const <slice>ItemsAtom = atom<string[]>([]);
export const <slice>LoadingAtom = atom(false);
export const <slice>CountAtom = atom((get) => get(<slice>ItemsAtom).length);
```

### Store hydration template

Three orthogonal hydration vectors. Pick per slice; combine carefully.

**1. SSR rehydration** — server-rendered initial state picked up client-side without refetch.

Next.js (Zustand): per-request factory, never a singleton; serialize into `__NEXT_DATA__`.

```tsx
export const create<Slice>Store = (preloaded?: Partial<<Slice>State>) =>
  create<<Slice>State & <Slice>Actions>()((set) => ({ ...initial, ...preloaded, /* actions */ }));
// app/layout.tsx (RSC): const preloaded = await fetchInitial();
// return <StoreProvider preloaded={preloaded}>{children}</StoreProvider>;
```

Nuxt (Pinia): `@pinia/nuxt` auto-serializes server state into `window.__NUXT__.pinia`, rehydrates client-side, zero manual wiring.

Redux Toolkit (Next.js): `next-redux-wrapper` or per-request `makeStore()` — singleton reuse leaks state across users.

**2. Persisted-storage rehydration** — `localStorage` / `sessionStorage` / IndexedDB survives reload.

```ts
// Zustand
import { persist, createJSONStorage } from 'zustand/middleware';
persist(creator, {
  name: '<slice>-store',
  storage: createJSONStorage(() => localStorage),
  partialize: (s) => ({ theme: s.theme, sidebarOpen: s.sidebarOpen }),
  version: 2,
  migrate: (persisted, from) => persisted,
});

// Pinia: createPinia().use(piniaPluginPersistedstate); persist: { paths: ['theme'] }
// Redux: persistReducer({ key: '<slice>', storage, whitelist: ['theme'] }, reducer);
```

Do NOT persist:
- Auth tokens — httpOnly Secure cookie only (`localStorage` is XSS-readable).
- Server-truth data — SWR/TanStack Query owns its cache; double-source = stale bugs.
- PII — minimize footprint, shared browser profiles leak it.
- TTL-bound data — cache layer's job.

**3. Cross-tab sync** — two open tabs stay consistent.

```ts
// BroadcastChannel — modern, structured-clone, no quota cost
const bc = new BroadcastChannel('<slice>-sync');
use<Slice>Store.subscribe((s) => bc.postMessage({ items: s.items }));
bc.onmessage = (e) => use<Slice>Store.setState(e.data, false, '<slice>/sync');

// storage event fallback — fires only in OTHER tabs
window.addEventListener('storage', (e) => {
  if (e.key !== '<slice>-store' || !e.newValue) return;
  use<Slice>Store.setState(JSON.parse(e.newValue).state, true, '<slice>/storage-sync');
});
```

Zustand `persist` already emits storage events; Pinia plugin + manual listener; Redux needs explicit subscribe-and-broadcast.

**4. Mismatch detection + recovery**. Symptoms: React "Hydration failed", Vue "Hydration node mismatch", flicker of default → persisted state.

```ts
// React: gate persist-dependent UI until client mount
const [hydrated, setHydrated] = useState(false);
useEffect(() => setHydrated(use<Slice>Store.persist.hasHydrated()), []);
if (!hydrated) return <Skeleton />;

// Zustand: onRehydrateStorage wipes corrupt blob
persist(creator, {
  onRehydrateStorage: () => (_, error) => {
    if (error) localStorage.removeItem('<slice>-store');
  },
});
```

Recovery: version-bump + `migrate` (throw → clear + fall back to `initial`); try/catch `JSON.parse`; never render persisted state during SSR pass (server has no `localStorage`); zod `safeParse` on rehydrate drops unknown fields.

---

## Persist policy

Persist allow-list:
- UI prefs (theme, sidebar collapsed)
- Unsubmitted form drafts
- Wizard step progress

Persist deny-list:
- Auth tokens / session
- Server-truth lists (orders, posts, users)
- Anything with PII

If `--persist` and slice fails policy → halt with warning.

---

## Async pattern (Zustand example)

```ts
load: async () => {
  set({ loading: true });
  try {
    const items = await fetch('/api/<slice>').then((r) => r.json());
    set({ items, loading: false });
  } catch (e) {
    set({ loading: false });
    throw e;
  }
},
```

Note: prefer React Query / SWR / TanStack Query for server state. Stores hold client state only.

---

## Output

Side-effect = store file (+ selectors, + root wiring if needed). After emit, print:

```
Store wired: <Slice> via <lib>. Files: <list>. Devtools: on. Persist: <on|off>.
Next: import use<Slice>Store from components; pair with React Query for server state.
```

---

## When to re-run

- Adding a new slice (`/state-store-design <new-slice>`).
- Switching store lib (`--lib`).
- Do NOT hand-edit emitted slice file beyond TODO markers — re-spec and re-run.
