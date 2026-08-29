# boards/item-management Specification (delta)

## ADDED Requirements

### Requirement: Configurable item table columns
The board table view and the my-items listing SHALL each offer these data columns: the title column ("Title" on a board, "Item" on the my-items listing), Status, Priority, Due, Assignees, Tags, Created by, Created, Updated by, and Updated. By default only the title column, Status, Priority, Due, Assignees, and Tags SHALL be visible. Each view SHALL offer a small dropdown menu from which the user can show and hide each column, marked with the current visibility; the title column SHALL always be shown and SHALL NOT be offered for hiding. The trailing actions column is a control rather than a data column and SHALL NOT be offered; on the my-items listing the conditional board column stays governed by the grouping and SHALL NOT be offered either. The Priority entry remains subject to the priority feature's own rules (no priority column when no listed item has one).

The set of visible columns SHALL be stored per user through the user settings storage, so it survives closing the page and reloading the browser and does not affect other users. Board tables SHALL keep an independent choice per board; the my-items listing SHALL keep one choice of its own, shared by the sub-page and the boards page's "My items" tab.

#### Scenario: Default columns

- **WHEN** a user opens a board's table view for the first time
- **THEN** the table shows Title, Status, Priority (when used), Due, Assignees, and Tags — and no Created by, Created, Updated by, or Updated columns

#### Scenario: Show an audit column

- **WHEN** the user opens the column menu and enables "Created"
- **THEN** the table gains a Created column showing each item's creation time

#### Scenario: Hide a default column

- **WHEN** the user disables "Tags" in the column menu
- **THEN** the Tags column disappears from the table while the other columns stay

#### Scenario: Choice persists per user and board

- **WHEN** the user enables "Updated by" on board A and reloads the browser
- **THEN** board A's table still shows the Updated by column, while board B's table keeps its own column set and other users' views are unaffected

#### Scenario: My-items columns configurable with its own stored choice

- **WHEN** the user hides "Tags" on the my-items listing and reloads the browser
- **THEN** the my-items tables show no Tags column — on the sub-page and on the boards page's "My items" tab alike — while every board's own table view keeps its stored column set

#### Scenario: Title cannot be hidden

- **WHEN** the user opens the column menu on either view
- **THEN** no entry offers hiding the title column and the tables always render it

## MODIFIED Requirements

### Requirement: Table sorting
The table view SHALL allow sorting by the Title, Status, Due, Created by, Created, Updated by, and Updated columns via their headers, toggling between ascending and descending. Sorting SHALL combine with active filters, and with group-by-assignee enabled it SHALL order the items within each group.

#### Scenario: Sort by title
- **WHEN** a user activates the Title header
- **THEN** rows order alphabetically by title, and activating it again reverses the order

#### Scenario: Sort by creation time
- **WHEN** the Created column is visible and the user activates its header
- **THEN** rows order by creation time, and activating it again reverses the order

#### Scenario: Sorting within groups
- **WHEN** group-by-assignee is active and a sort is applied
- **THEN** each assignee group's rows are ordered by the selected sort

### Requirement: My items sub-page

The frontend SHALL offer a "My items" sub-page under the boards page that
lists the user's items with — by default — their status, priority, due
date (with the standard urgency colors), assignees, and tags, subject to
the user's my-items column configuration, and opens the item's detail
drawer in place when an item is clicked — without navigating to the
item's board. The
drawer SHALL offer the same detail view as on the board, editable when
the user has write access to that item's board and read-only otherwise;
closing it SHALL leave the user on the listing. The listing SHALL be
grouped by board by default, with each board heading linking to its
board. Each group SHALL be rendered as a table whose last column is an
actions column holding a menu button, and that menu SHALL also open at
the pointer on right-click. That menu SHALL offer the same item actions
as the item menu on a board — open details (in place, as above), move to
another column, set or clear the due date, change assignees, and delete
the item — subject to the same write-access and externally-managed
restrictions, plus an entry that opens the item's board. Those actions
and restrictions SHALL be resolved per item from the board that item
belongs to, so they are unaffected by a grouping that mixes items from
several boards. After such an action — including edits made in the
drawer — the listing SHALL reflect the result, including removing an
item that is no longer assigned to the user. When the listing is not
grouped by board, the table SHALL additionally carry a board column
linking to each item's board, so every row still names where it lives.
The boards page SHALL reach the same listing — with the same filter bar
and grouping control — through its "My items" tab; a separate button link
to the sub-page is not required.

#### Scenario: Open an item from the sub-page

- **WHEN** the user clicks one of their items on the my-items page
- **THEN** that item's detail drawer opens over the listing, without
  navigating to the item's board

#### Scenario: Editing in the drawer updates the listing

- **WHEN** the user moves an item to another column from a drawer opened
  on the my-items page
- **THEN** the change is saved to the item's board and the row's status
  cell shows the new column

#### Scenario: Row actions menu

- **WHEN** the user activates the menu button in a my-items row's actions
  column, or right-clicks the row
- **THEN** a menu opens (at the pointer for right-click) offering to open
  the item's details in place, move it to another column, change its due
  date and assignees, delete it, and open its board

#### Scenario: Change status from the my-items table

- **WHEN** the user moves one of their items to another column from the
  my-items row menu
- **THEN** the item's status changes on its board and the row's status
  cell shows the new column

#### Scenario: Unassigning removes the row

- **WHEN** the user removes themselves as an assignee from the my-items
  row menu, and no group of theirs is assigned to that item
- **THEN** the row disappears from the listing

#### Scenario: Read-only board offers navigation only

- **WHEN** the user opens the row menu for an item on a board they can
  only read, or for an externally managed item
- **THEN** the menu offers to open the item's details (read-only, in
  place) and its board, and no action that would modify the item

#### Scenario: Row actions across a mixed group

- **WHEN** the grouping puts items from two different boards in one group
  and the user opens the row menu of each
- **THEN** each menu offers the columns of that item's own board and
  respects that board's write access

#### Scenario: Board shown per row when not grouped by board

- **WHEN** the user switches the my-items grouping away from board
- **THEN** each row shows the name of the board its item belongs to,
  linking to that board

#### Scenario: Same controls on the boards page tab

- **WHEN** the user opens the boards page's "My items" tab
- **THEN** the listing offers the same filter bar and grouping control as
  the my-items sub-page, and clicking an item opens its detail drawer in
  place on that tab
