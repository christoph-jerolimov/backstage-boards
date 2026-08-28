## Why

`add-column-only-when-empty` hid the trailing "+ Add column" lane on
boards that already have columns, leaving no way to add a column to such
a board at all: the column menu offers Move left, Move right, Color and
Delete, but nothing that creates a column. That contradicts the standing
requirement that columns be "creatable, renamable, reorderable, and
deletable inline in the board view", and a board whose statuses need to
grow is currently stuck.

The earlier change was right that a permanent lane at the end of the
board is not worth its horizontal space. Putting creation in the column
menu restores the capability without giving the space back.

## What Changes

- Add "Insert column before" and "Insert column after" entries to the
  kanban column menu, above the existing Move left / Move right entries.
- Choosing either reveals the same inline title field the empty-board
  affordance uses, positioned in the new column's slot; committing
  creates the column there and cancelling (Escape or an empty title)
  creates nothing.
- The new column is created directly at its target position rather than
  appended and then moved, so it never appears at the end of the board
  first.
- Keep the "+ Add column" affordance on empty boards as-is — it is the
  only entry point when there is no column menu to open.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `boards/board-management`: "Configurable columns per board" gains the
  two insert positions as the named creation affordance on a board that
  already has columns, replacing the scenario's reliance on the removed
  trailing button.

## Impact

- **Frontend only.** `plugins/boards/src/components/BoardView.tsx`: the
  column menu in `ColumnLane`, and the add-column state in `KanbanView`
  which becomes per-slot instead of a single boolean.
- **No backend or API change.** `POST /boards/:boardId/columns` already
  accepts `position`, `BoardsService.addColumn` already honors it, and
  `BoardsApi.addColumn` already forwards it; only `BoardActions.addColumn`
  in `BoardPage.tsx` needs to stop dropping the argument.
- **No migration, no config, no new dependency.**
