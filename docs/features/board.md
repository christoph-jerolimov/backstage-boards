# Board views

A board shows its items either as a kanban board or as a table. The two
view-switch buttons next to the board menu toggle between them; both views
show the same items and respect the same filters.

## Kanban view

![The kanban view with three columns and badge-decorated cards](../screenshots/light/board-kanban.png)

Each column is one status, with its item count in the header and a colored
dot when the column has a color. Cards show the item's title and — when set —
its priority, due date (colored by urgency), checklist progress, assignee
avatars, and tags. **+ Add item** at the bottom of each column creates an
item directly in that column.

Drag a card to move it between columns or to reorder it; a drop indicator
shows where it will land. The same move is available without a pointer: the
item menu's **Move to column** entry is fully keyboard-operable. Moves and
edits apply optimistically — the UI updates immediately and rolls back if
the server rejects the change.

## Table view

![The table view with status, priority, due, assignees, and tags columns](../screenshots/light/board-table.png)

The table shows one row per item with its status, priority, due date,
assignees, and tags. Click a column header to sort. The column-picker button
above the table chooses which columns are shown; the leading selection
column and the trailing actions column always stay put.

Selecting rows with the checkboxes enables bulk actions: change the assignee
or the priority of every selected item at once (see
[Working with items](items.md)).

## Filter bar

Both views share the filter bar: free-text search over titles and
descriptions, a **Tags** filter, an **Assignees** filter, and — when the
board defines priorities — a **Priority** filter. An item must match the
text, carry **all** selected tags, and be assigned to **any** selected
assignee. Active filters are reflected in the item counts, and one click
clears them all.

## Grouping

The grouping dropdown in the board header regroups both views:

- **Not grouped** — plain columns and rows.
- **By assignee** — items grouped per assignee; an item with several
  assignees appears in each of their groups, items without one under
  "Unassigned".
- **By priority** — items grouped by priority, highest first:

![The kanban view grouped by priority, with priority group headers inside each column](../screenshots/light/board-grouped-by-priority.png)

Grouping only changes the visual arrangement — drag & drop and all other
actions keep working.

## The assignee matrix

The board menu offers an **Assignee matrix**: every column (status) as one
axis and every assignee as the other, each cell counting the matching items,
with sum rows and columns. An item with several assignees counts for each of
them, and items without an assignee show in a trailing **Unassigned** row.

![The assignee matrix dialog with per-status counts and sums](../screenshots/light/assignee-matrix.png)

The status and assignee badges are clickable: unselecting one leaves it out
of the sums (its own cells stay visible), and clicking again brings it back.
The matrix respects the currently active filters. Boards that define
priorities offer a second, analogous matrix — see
[Priorities](priorities.md).

## Board header

The header also carries the favorite star, the referenced entities and your
access level, the [watch control](watching-and-notifications.md), and the
board menu with board-level actions: settings, sharing, duplicating,
archiving, the matrices, [recent changes](comments-and-history.md), and the
[archived items](items.md) of the board.
