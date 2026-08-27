# Item Soft-Delete with 30-Day Purge

## Why

Deleting an item currently erases it and its whole history instantly, with no undo. Archiving instead — with a restore window and automatic purge after 30 days — protects against mistakes and preserves the audit trail while it still matters.

## What Changes

- Deleting an item now archives it: the item disappears from all views but keeps its data and history; a change record marks the archival.
- New "Archived items…" modal in the board more menu lists archived items with who/when; users with write access can restore them (recorded as a change).
- A scheduled backend task permanently purges items archived more than 30 days ago (cascade removes comments, versions, changes, watches).
- The `delete-item` action and DELETE endpoint keep their names but now archive.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `boards/item-management`: item deletion becomes archival with restore and time-based purge.

## Impact

- `plugins/boards-backend`: migration (`items.archived_at/archived_by`), archive/restore/purge service methods, scheduler task, routes, tests.
- `plugins/boards-common`: `BoardItem.archivedAt/archivedBy`, change types `archived`/`restored`.
- `plugins/boards`: `ArchivedItemsDialog` + more-menu entry, API client methods.
