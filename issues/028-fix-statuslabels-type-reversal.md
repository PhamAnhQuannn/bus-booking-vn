---
priority: should
source: architect-review
fingerprint: arch-statuslabels-ui-type-reversal
severity: P2
---

## Parent PRD

`issues/prd.md` (fix-issue derived from PR #4 architect-review)

## What to build

Fix: `lib/op/statusLabels.ts:3` imports `import type { badgeVariants } from
"@/components/ui/badge"` — service layer (lib) reaches up into the UI layer
(components) to borrow a type. `import type` strips at build time so runtime is
clean, but the type dependency points the wrong way: the data dictionary should
OWN the variant vocabulary; the badge should consume it.

Suggested fix (invert the dep):
- Define `type StatusBadgeVariant = 'success' | 'warning' | 'danger' | 'neutral' | 'pending'`
  locally in `lib/op/statusLabels.ts`; export it.
- Have `components/ui/badge` (or a thin wrapper) import `StatusBadgeVariant` from
  the lib instead of exporting `badgeVariants` for lib to consume.

Behavior-neutral refactor; affects only type-import direction.

## Acceptance criteria

- [ ] `lib/op/statusLabels.ts` no longer imports from `@/components/**`.
- [ ] The badge variant set lives in `lib/op/statusLabels.ts` (or a shared lib types
      module).
- [ ] All existing badge usages typecheck unchanged.
- [ ] /architect-review no longer emits fingerprint `arch-statuslabels-ui-type-reversal`.

## Blocked by

None - can start immediately.
