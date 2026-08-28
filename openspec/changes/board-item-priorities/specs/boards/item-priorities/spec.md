# boards/item-priorities Specification (delta)

## Purpose

Lets board admins define an ordered set of per-board priorities that items can optionally carry, and defines every surface that uses them: configuration in board settings, display on cards and tables, filtering, grouping, editing, the home page widget, and a status × priority matrix view.

## ADDED Requirements

### Requirement: Per-board priority definitions

A board SHALL hold an ordered list of zero to ten priorities. Each priority SHALL have a required name, an optional display color chosen from the same fixed palette as column colors, and an order number between 1 and 10, where 1 is the highest priority. Order numbers SHALL be assigned automatically from the list position — the first priority gets 1 — and SHALL be renumbered contiguously whenever the list changes; they SHALL NOT be edited directly. Each priority SHALL have a stable id; items reference priorities only by id, so renaming or recoloring a priority SHALL take effect everywhere it is displayed without touching any item.

Users with `admin` access SHALL manage the list — create, rename, change color, rearrange, delete — in the board settings. Creating an eleventh priority SHALL be rejected. Users without `admin` access SHALL NOT be able to change the priority definitions. A board with no priorities SHALL be valid; on such a board no priority UI (filter, grouping option, table column, matrix dialog, item editors) SHALL be offered.

#### Scenario: Admin adds a priority

- **WHEN** a board admin adds a priority named "blocker" to a board whose priorities are "critical" (1) and "high" (2)
- **THEN** "blocker" is appended with order number 3 and becomes selectable on the board's items

#### Scenario: Rearranging renumbers automatically

- **WHEN** an admin moves "blocker" to the top of the list
- **THEN** the order numbers become blocker 1, critical 2, high 3, without the admin editing any number

#### Scenario: Rename does not touch items

- **WHEN** an admin renames the priority "high" to "important" while items use it
- **THEN** those items immediately display "important" and keep their priority association

#### Scenario: At most ten priorities

- **WHEN** an admin attempts to add an eleventh priority
- **THEN** the request is rejected and the list is unchanged

#### Scenario: Non-admin cannot manage priorities

- **WHEN** a user with `write` access attempts to create, reorder, or delete a priority
- **THEN** the request is rejected with a permission error

#### Scenario: Board without priorities hides the feature

- **WHEN** a user views a board that defines no priorities
- **THEN** no priority filter, grouping option, table column, matrix dialog entry, or item priority editor is shown

### Requirement: Default priorities on new boards

A newly created board SHALL start with the priorities, in this order: "critical" (red, order 1), "high" (orange, order 2), "medium" (no color, order 3), "low" (no color, order 4). The admin SHALL be able to change or delete these like any other priority, including removing all of them.

#### Scenario: New board defaults

- **WHEN** a user creates a board
- **THEN** the board's priorities are critical (red, 1), high (orange, 2), medium (no color, 3), low (no color, 4)

#### Scenario: Defaults are not mandatory

- **WHEN** an admin deletes all four default priorities
- **THEN** the board has no priorities and behaves as a board without the feature

### Requirement: Optional item priority

An item SHALL optionally reference one of its board's priorities by id. Users with write access SHALL be able to set, change, and clear an item's priority; externally managed items SHALL be read-only as for other fields. Priority changes SHALL be recorded in the item's change history and SHALL be exposed through the REST API and the item actions like other item fields. A priority id that does not belong to the item's board SHALL be rejected.

#### Scenario: Set and clear a priority

- **WHEN** a user with write access sets an item's priority to "critical" and later clears it
- **THEN** the item stores the priority's id and then none, and both changes appear in the item's history

#### Scenario: Foreign priority rejected

- **WHEN** a caller submits a priority id belonging to a different board
- **THEN** the request fails with an input error and the item is unchanged

#### Scenario: Externally managed items stay read-only

- **WHEN** a user attempts to change the priority of an externally managed item through the UI or the item update endpoint
- **THEN** the mutation is rejected

### Requirement: Deleting a used priority

Deleting a priority that no item uses SHALL simply remove it. Deleting a priority that items still use SHALL require the admin to choose between reassigning all affected items to another of the board's priorities or dropping the priority from them (leaving those items with no priority); the deletion SHALL then apply that choice to every affected item, including archived ones, so no item is left referencing a deleted priority.

#### Scenario: Delete unused priority

- **WHEN** an admin deletes a priority no item uses
- **THEN** it is removed and the remaining priorities are renumbered contiguously

#### Scenario: Reassign on delete

- **WHEN** an admin deletes "high" while items use it and chooses to reassign to "medium"
- **THEN** every item that had "high" now has "medium" and "high" is gone

#### Scenario: Drop on delete

- **WHEN** an admin deletes "low" while items use it and chooses to drop
- **THEN** every item that had "low" has no priority afterwards

### Requirement: Priority display

The kanban card SHALL show its item's priority — the name, rendered with the priority's color when one is set and neutrally otherwise. The board table view and the my-items listing SHALL show a priority column only when at least one listed item has a priority; otherwise the column SHALL be absent. The item details drawer SHALL show the item's priority. The "Assigned items" home page widget SHALL show each item's priority when set.

#### Scenario: Card shows the priority

- **WHEN** an item with priority "critical" (red) is shown as a kanban card
- **THEN** the card shows "critical" rendered in red

#### Scenario: Table column only when used

- **WHEN** a user views the table of a board where no item has a priority
- **THEN** no priority column is shown
- **WHEN** at least one item has a priority
- **THEN** the priority column appears and shows each item's priority, empty for items without one

#### Scenario: My-items column only when used

- **WHEN** the my-items listing contains at least one item with a priority
- **THEN** the listing shows a priority column; when none of the listed items has a priority the column is absent

#### Scenario: Assigned-items widget shows priority

- **WHEN** the "Assigned items" home page widget lists an item that has a priority
- **THEN** the entry shows that priority alongside title, status, and due date

### Requirement: Filter by priority

The board filter bar SHALL offer a priority filter only while at least one of the board's items has a priority. The filter SHALL list the priorities in use, ordered by order number ascending (highest priority first), each showing how many items currently hold it. An item matches the filter if its priority is ANY of the selected ones. The priority filter SHALL combine with the other filters with AND, apply to both the board and the table view, and be reset by the filter bar's clear action. The items API SHALL accept the same filter.

#### Scenario: Filter offered and ordered

- **WHEN** items on the board use "low" (4) and "critical" (1)
- **THEN** the priority filter offers critical before low, each with its item count

#### Scenario: Filter matches any selected priority

- **WHEN** a user selects "critical" and "high"
- **THEN** only items with either priority remain visible in the active view

#### Scenario: No filter without used priorities

- **WHEN** the board defines priorities but no item has one
- **THEN** the filter bar offers no priority filter

### Requirement: Group items by priority

The board view and the table view SHALL offer grouping by priority, alongside the existing grouping options, on boards that define priorities. Groups SHALL be ordered by order number ascending (order 1 first); items without a priority SHALL be collected in a trailing "No priority" group. Each group label SHALL show the priority's name, its color when set, and the number of items it contains.

#### Scenario: Group board view by priority

- **WHEN** a user groups the board view by priority on a board with critical/high/medium/low
- **THEN** items appear in sections ordered critical, high, medium, low, then "No priority", each section labelled with its item count

#### Scenario: Empty priority groups

- **WHEN** grouping by priority and no item uses "medium"
- **THEN** the "medium" group shows zero items or is omitted, and the remaining groups keep their order

### Requirement: Edit priority from drawer and item menu

The item details drawer SHALL let users with write access pick one of the board's priorities or clear the priority. The item context menu (on cards, table rows, and the my-items rows) SHALL offer a priority submenu with the board's priorities ordered by order number ascending plus a clear entry, subject to the same write-access and externally-managed restrictions as other item actions; in the my-items listing the offered priorities SHALL be those of the item's own board.

#### Scenario: Change priority in the drawer

- **WHEN** a user with write access selects "high" in the drawer's priority field
- **THEN** the item's priority becomes "high" without leaving the view

#### Scenario: Change priority from the item menu

- **WHEN** a user opens an item's menu and picks "critical" from the priority submenu
- **THEN** the item's priority becomes "critical" and the card/row updates immediately

#### Scenario: Read-only users see no priority editor

- **WHEN** a user with only read access opens the drawer or item menu
- **THEN** no priority-changing control is offered

### Requirement: Duplication copies priorities

Duplicating a board with its columns SHALL also copy the board's priority definitions (names, colors, order). When items are copied too, each copied item SHALL carry the copied priority corresponding to its source item's priority.

#### Scenario: Priorities copied with columns

- **WHEN** a board with priorities critical/high is duplicated with copy columns and copy items, and an item has priority "high"
- **THEN** the copy defines critical and high in the same order and colors, and the copied item references the copy's "high"

### Requirement: Status and priority matrix dialog

The board menu SHALL offer, on boards that define at least one priority, a matrix dialog showing all of the board's columns (statuses) as one axis and all its priorities — ordered by order number ascending, plus a "No priority" row when items without a priority exist — as the other. Each cell SHALL show the board's non-archived items that have that status and that priority, respecting the currently active filters. Items in the matrix SHALL open their details when activated.

#### Scenario: Matrix shows items per status and priority

- **WHEN** a user opens the matrix dialog on a board with columns "Todo"/"Done" and priorities "critical"/"low", where one item is Todo+critical
- **THEN** the dialog shows a matrix of the two columns against the two priorities and that item appears in the Todo × critical cell

#### Scenario: Items without priority

- **WHEN** the board has items without a priority
- **THEN** the matrix shows them in a trailing "No priority" row under their status column

#### Scenario: No matrix without priorities

- **WHEN** a board defines no priorities
- **THEN** the board menu offers no matrix dialog entry
