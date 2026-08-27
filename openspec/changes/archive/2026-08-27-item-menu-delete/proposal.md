# Delete Option in the Item Menu

## Why

Deleting an item currently requires opening the details drawer; the
item menu (card, table row, right-click) has no delete entry.

## What Changes

- The shared item menu gains a danger-colored "Delete item" entry
  (writers only) that archives the item like the drawer's delete button
  (soft delete, restorable for 30 days).

## Impact

- `plugins/boards`: `BoardActions.deleteItem`, wired in BoardPage,
  rendered in `ItemMenu`.
