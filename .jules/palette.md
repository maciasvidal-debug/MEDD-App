## 2024-06-01 - Missing ARIA Labels on Dynamic List Item Deletion Buttons
**Learning:** Icon-only buttons used for deleting items in dynamic lists (like medications) often lack screen-reader context if they don't explicitly reference the item being deleted. Simply having a trash icon is not enough; the `aria-label` should uniquely identify the item to be removed (e.g., `aria-label={'Eliminar medicamento ' + item.name}`).
**Action:** Always ensure that destructive actions on list items have a descriptive `aria-label` that includes the item's name or identifier.

## 2024-05-18 - Missing ID associations on generic fields
**Learning:** Reusable UI components like `<Field>` wrappers often lack `id` and `htmlFor` defaults, leading to disconnected labels on implementation unless explicitly provided.
**Action:** Always verify `htmlFor` and `id` mapping exists in forms, and add `role="alert"` with `aria-live` to dynamic feedback elements like error messages.

## 2024-06-03 - Missing role="progressbar" for custom icons acting as loading states
**Learning:** Screen readers won't announce custom `<i>` tag icons that visually serve as a spinner.
**Action:** Always add `role="progressbar"` to icons used for loading states so screen readers interpret them properly, and use reusable components instead of duplicating `<i>` implementations.
