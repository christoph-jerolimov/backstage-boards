## Why

The bulk-actions bar covers status, priority, assignee, and due date, but
not tags — the one obvious omission. Cleanup workflows ("tag these 12
items `q3-carryover`") currently require opening every item's drawer and
editing tags one at a time.

## What Changes

- Add a **Tags** dropdown to the bulk-actions bar, shown between the
  due-date dropdown and the Archive button.
- The dropdown lists every tag already used on the board's items with the
  same ✓/– match markers the status and assignee dropdowns use, and
  toggles them with the same semantics as bulk assignees: choosing a tag
  adds it to every selected item missing it, except when all selected
  items already carry it, in which case it removes it from every selected
  item.
- An **Add tag…** entry lets the user type a new tag (normalized the same
  way as the drawer's tags editor) and applies it to every selected item.
- A **Remove all tags** entry clears tags on every selected item.
- All updates go through the existing bulk fan-out (`bulk.updateItems`),
  so per-item failures surface as errors while the rest still update.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `boards/item-management`: the "Bulk actions on selected items"
  requirement gains a tags dropdown, and a new "Bulk tag change"
  requirement specifies the toggle/add/clear semantics.

## Impact

- `plugins/boards/src/components/BulkActionsBar.tsx` — new Tags menu.
- `plugins/boards/src/components/BoardPage.tsx` — pass the board's tag
  pool to the bar.
- Frontend only: the existing `updateItem` API already accepts `tags`,
  and the bulk fan-out already handles partial failures.
- README feature list gains a mention of bulk tag actions.
