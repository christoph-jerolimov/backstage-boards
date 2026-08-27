# Add Another Item Directly

## Why

Adding several items in a row currently takes two clicks per item: the
add form closes after each add, so the user must reopen it every time.

## What Changes

- After an item is added from a column's add form, the form stays open,
  the title field is cleared, and focus returns to the title input so
  the next title can be typed immediately.
- Escape or the Cancel affordance still closes the form.

## Impact

- `plugins/boards`: `AddItemRow` in `KanbanView.tsx` only.
