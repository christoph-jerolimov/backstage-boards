# Board Item Priorities

## Why

Boards currently have no way to express how urgent an item is relative to the others — teams fall back on tags or title prefixes, which cannot be ordered, filtered, or styled consistently. Per-board configurable priorities give admins a first-class, ordered signal (critical → low) that every surface — cards, tables, filters, grouping, home page — can use.

## What Changes

- **Priority definitions per board**: a board holds an ordered list of up to 10 priorities, each with a name, an optional color, and an order number 1–10 (1 = highest). Order numbers are assigned automatically from the list position; admins manage the list (create, rename, recolor, rearrange, delete) in the board settings.
- **Defaults for new boards**: new boards start with `critical` (red, 1), `high` (orange, 2), `medium` (no color, 3), `low` (no color, 4). A board with no priorities at all is valid — the whole feature disappears from the UI then.
- **Items reference priorities by id**: an item optionally carries a priority id (never the name), so renaming/recoloring a priority updates everywhere instantly.
- **Safe deletion**: deleting a priority that items still use makes the admin choose — reassign those items to another priority or drop the priority from them.
- **Display**: kanban cards show the item's priority; the board table and the my-items table show a priority column only when priorities are in use; the "Assigned items" home page widget shows each item's priority.
- **Filter**: the board filter bar gains a priority filter (offered only when the board defines priorities), ordered by priority order number ascending.
- **Grouping**: board and table views can group items by priority; the group dropdown lists priorities highest first, each with the count of items holding it.
- **Editing**: an item's priority can be changed from the item details drawer and from the item context menu.
- **Priority matrix dialog**: a new dialog, opened from the board menu, showing a matrix of all columns (statuses) against all priorities with the board's items placed in the cells.

## Capabilities

### New Capabilities

- `boards/item-priorities`: Per-board priority definitions (configuration in board settings, defaults, ordering, safe deletion with reassignment), the optional priority field on items, and every surface that uses it: card/table/my-items/home-widget display, filtering, grouping with counts, editing from drawer and item menu, and the status × priority matrix dialog.

### Modified Capabilities

<!-- none -->

None. Existing requirements are not changed: the item field is additive (the actions/API "update an item's fields" requirements already cover new fields generically), tables/filter/grouping additions are new requirements layered on top, and the assigned-items widget requirement already says "at least" title, status, due date.

## Impact

- **Common package**: new `Priority` type; `Board` gains `priorities`; `Item`/item-update types gain optional `priorityId`.
- **Backend**: migration for a priorities table (or board-scoped priority storage) and an item `priority_id` column; board endpoints to manage priorities (admin-only) including reorder and delete-with-reassign/drop; items endpoints accept/filter by priority; change history records priority changes.
- **Frontend**: board settings dialog gains a priorities section; kanban card, board table, my-items table, filter bar, group-by control, item drawer, item menu, board menu (new matrix dialog), assigned-items home widget.
- **No breaking changes**: boards without priorities behave exactly as today; existing items simply have no priority.
