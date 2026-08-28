## Why

An item can carry a status, assignees, tags, and a due date, but nothing
says how important it is. Teams work around that with tags ("urgent",
"p1"), which every board spells differently, cannot be ordered, and are
multi-valued where importance is single-valued. A board-level priority
list gives each board one ordered, renamable vocabulary that the card,
the tables, the filter, the grouping, and the home page can all speak.

## What Changes

- Boards gain an ordered list of **priorities**. A priority has a name,
  an optional color from the existing palette, and an order number
  starting at 1 (the highest). Order is assigned automatically from the
  list position and stays contiguous; a board holds at most 10.
- New boards start with **critical** (red), **high** (orange),
  **medium** (no color), **low** (no color). A board with no priorities
  at all is valid, and existing boards get none by the migration.
- Priorities are configured in **board settings** (admin only): rename,
  recolor, rearrange, add, and remove. Removing a priority that is in
  use forces a choice — reassign all its items to another priority, or
  drop the priority from them.
- Items gain an **optional** priority, referenced by id so that a
  rename or recolor never touches an item. Setting it needs write
  access and is available from the item drawer and the item menu (card,
  table row, right-click, and the my-items rows).
- Priorities show up only where a board actually uses them: a badge on
  board cards, a **Priority** column in the board table and the my-items
  tables, a priority badge in the "Assigned items" home page card.
- The board filter bar gains a **Priority** filter (priorities first by
  order, then "No priority", each with its item count). Selecting
  several matches any of them, and the priority filter combines with
  the text and tag filters by AND.
- **Group by priority** joins the group-by dropdown, ordering groups by
  order number with "No priority" last and showing per-group counts.
- A new **priority matrix** dialog from the board menu shows item counts
  for every status (column) against every priority, with row, column,
  and grand totals.

## Capabilities

### New Capabilities

- `boards/priorities`: the board priority list and its configuration,
  the item's optional priority, where priorities are displayed,
  filtering and grouping by priority, and the status × priority matrix.

### Modified Capabilities

- `boards/board-management`: "Create a board" — a new board also starts
  with the default priority set. "Duplicate a board" — a copy carries
  the source board's priorities, and copied items keep theirs.
- `boards/item-management`: "Item fields" — an item may carry one
  optional priority. "Filter and search items" — the filter bar and the
  items API also accept a priority filter. "Table sorting" — the table
  can be sorted by priority. "My items across boards" — each entry
  carries its item's resolved priority. "My items sub-page" — the
  tables show a priority column and the row menu can change it.
- `boards/homepage-widgets`: "Assigned items widget" — a listed item
  also shows its priority when it has one.

## Impact

- **Database**: new `board_priorities` table and a nullable
  `items.priority_id`; one migration, no backfill for existing boards.
- **`plugins/boards-common`**: `BoardPriority`, `priorityId` on
  `BoardItem` / `NewItem` / `ItemUpdate`, `priorities` on
  `BoardWithContext`, resolved `priority` on `MyBoardItem`,
  `priorityIds` on `ItemFilter`.
- **`plugins/boards-backend`**: priority CRUD and reorder in
  `BoardsService` plus its REST routes, default priorities on board
  creation, priority carry-over in duplication, priority changes in the
  item change history, and `priorityId` on the update-item action.
- **`plugins/boards`**: `BoardSettingsDialog` (priority editor),
  `BoardPage` (filter, group-by option, matrix entry),
  `BoardView`/`TableView`/`MyItemsPage` (badge and column),
  `ItemMenu`, `ItemDrawer`, `AssignedItemsWidget`, `grouping.ts`,
  `GroupLabel`, and a new `PriorityBadge` and `PriorityMatrixDialog`.
- **No new dependency**, no config, and no change for a board that has
  no priorities.
