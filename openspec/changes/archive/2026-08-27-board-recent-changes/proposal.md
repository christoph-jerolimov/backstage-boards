# Board-Wide Recent Changes

## Why

Change history exists only per item; there is no way to see what happened on a board as a whole. A recent-changes modal gives readers a quick audit view of the latest activity.

## What Changes

- New backend endpoint returning a board's most recent change records (across all items, newest first, with item titles).
- The board's three-dot more menu gains a "Recent changes…" entry (visible to everyone with read access — the menu is no longer admin-only) opening a modal that lists actor, change summary, item, and time; clicking an item opens its drawer.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `boards/comments-and-history`: a board-wide recent-changes view is available to all readers.

## Impact

- `plugins/boards-backend`: `getBoardChanges` service method + route + tests.
- `plugins/boards`: shared `changeSummary` helper, `RecentChangesDialog`, more-menu restructure in `BoardPage`.
- `plugins/boards-common`: `BoardChangeEntry` type.
