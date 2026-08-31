# Components

## Entity forms read the store, not props

Habit and Moment forms follow one pattern — deviate only with a reason:

- Form state lives in `infrastructure/state/ui-store.ts` (`habitFormState$` / `momentFormState$`),
  never in component state. Fields are set directly (`habitFormState$.name.set(v)`).
- Open via the helpers — `openHabitFormCreate({ areaId })` / `openHabitFormEdit(id, habit)` — not by
  toggling an `open` prop.
- The dialog takes **only** `onSave` and `onDelete`. See `components/HabitFormDialog.tsx`.
- Local state is for popovers and validation only.

**Areas are the exception**: inline editing, not dialogs, per the "no modals, flat UI" constraint —
simple properties contextual to one card, so local state is correct there.
