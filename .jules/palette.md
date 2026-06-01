## 2024-06-01 - Missing ARIA Labels on Dynamic List Item Deletion Buttons
**Learning:** Icon-only buttons used for deleting items in dynamic lists (like medications) often lack screen-reader context if they don't explicitly reference the item being deleted. Simply having a trash icon is not enough; the `aria-label` should uniquely identify the item to be removed (e.g., `aria-label={'Eliminar medicamento ' + item.name}`).
**Action:** Always ensure that destructive actions on list items have a descriptive `aria-label` that includes the item's name or identifier.
