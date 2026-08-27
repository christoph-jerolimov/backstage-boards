# Board Archival with 30-Day Purge

## Why

Deleting a board is currently instant and irreversible — one confirmation click destroys all items, comments, and history. Archiving first, with a 30-day grace window and a scheduled purge, protects against costly mistakes while keeping the data reachable for admins.

## What Changes

- Deleting a board now archives it (the "Delete board" flow becomes "Archive board").
- Archived boards disappear from all listings (board list, favorites, entity tab) and are reachable only via direct link; there they are **read-only for admins** — reads by non-admins fail as not-found and every write operation (items, columns, comments, permissions, settings) fails.
- The board page shows a warning alert stating when the board will be permanently deleted, with an admin-only "Delete now" action that hard-deletes immediately.
- A scheduled task permanently deletes boards archived more than 30 days ago (alongside the existing item purge).

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `boards/board-management`: board deletion becomes archival with a purge window, link-only admin read access, and an explicit delete-now escape hatch.
- `boards/board-sharing`: archived boards are hidden from non-admins entirely and reject all writes.

## Impact

- `plugins/boards-backend`: migration (`boards.archived_at/archived_by`), access-gate changes, `hardDeleteBoard`, purge extension, routes, tests.
- `plugins/boards-common`: `Board.archivedAt/archivedBy`.
- `plugins/boards`: archival alert with delete-now, read-only page state, updated delete dialog wording.
