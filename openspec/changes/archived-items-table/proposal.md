# Archived Items as a Table

## Why

The archived-items dialog stacks each item as a free-form row where the
title, the archival timestamp, and the actor run together in a sentence,
while the sibling recent-changes dialog already presents the same kind of
data as an aligned table. Columns make archived items scannable and make
the two dialogs consistent.

## What Changes

- The dialog's content becomes a BUI table with Title, Archived by,
  Archived, and Actions columns; the Actions cell keeps the per-row
  Restore button.
- The 30-day purge note and the loading and empty states stay as they are.
- No API, permission, or data change: restore still calls
  `restoreItem` and refreshes the list and the board.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None — presentation only. The `boards/item-management` requirement for
viewing and restoring archived items (with who archived them and when) is
unchanged, so the change sets `skip_specs: true`.

## Impact

- `plugins/boards`: `ArchivedItemsDialog` rendering and its test.
