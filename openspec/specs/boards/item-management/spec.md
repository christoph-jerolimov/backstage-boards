# boards/item-management Specification

## Purpose
Defines the work items on a board — their fields, lifecycle, read-only externally-managed items, and how items are displayed in board (kanban) and table views with grouping.

## Requirements

### Requirement: Item fields
An item SHALL belong to exactly one board and one of its columns (the item's status). An item SHALL have: a required title; audit fields (created by, created at, updated by, updated at); tags as a flat list of strings; an optional creator; and one or more assignees. Creator and assignees SHALL be entity refs (e.g. `user:default/christoph`, `group:default/team-a`) or free-text identities using the `text:` prefix (e.g. `text:External Contractor`).

#### Scenario: Create an item
- **WHEN** a user with write access adds an item with title "Fix login bug" to the "Todo" column
- **THEN** the item is persisted with status "Todo", created by/created at set from the caller identity and current time, and appears in the board immediately

#### Scenario: Title is required
- **WHEN** a user attempts to create an item with an empty title
- **THEN** the request is rejected with a validation error

#### Scenario: Text-prefixed assignee
- **WHEN** a user assigns an item to `text:Jane (agency)`
- **THEN** the assignee is stored and displayed as plain text without a catalog link, while catalog-ref assignees on the same item render as entity links

### Requirement: Update, move, and delete items
Users with write access SHALL be able to update item fields inline, move items between columns and reorder them within a column (in the board view via drag and drop or an equivalent accessible control), and delete items. Moving an item to another column SHALL update its status.

#### Scenario: Move an item between columns
- **WHEN** a user with write access moves an item from "Todo" to "In Progress"
- **THEN** the item's status becomes "In Progress", its position in the target column is persisted, and the change is recorded in the item's history

#### Scenario: Inline title edit
- **WHEN** a user with write access edits an item's title inline and confirms
- **THEN** the new title is saved without leaving the current view

#### Scenario: Delete an item
- **WHEN** a user with write access deletes an item
- **THEN** the item no longer appears in any view of the board

### Requirement: Externally managed read-only items
An item SHALL support an external-management marker identifying the managing system (e.g. a GitHub or Jira sync module). Items marked as externally managed SHALL be read-only in the UI for all users: their fields cannot be edited, moved, or deleted through the normal user flows, and the UI SHALL visibly mark them as externally managed. Mutations to such items SHALL only be accepted from the managing integration (via the REST API or actions using a service identity).

#### Scenario: External item is read-only in the UI
- **WHEN** a user with write access views an item marked as managed by an external system
- **THEN** edit, move, and delete controls are disabled or hidden and the item shows an "externally managed" indicator

#### Scenario: User mutation of an external item is rejected
- **WHEN** a user attempts to update an externally managed item through the item update endpoint
- **THEN** the backend rejects the request

### Requirement: Board view and table view
All items of a board SHALL be viewable as a kanban board (one lane per column, items as cards) and as a table (items as rows with their fields as columns). The user SHALL be able to switch between the two views, and the chosen view SHALL not change the underlying data.

#### Scenario: Switch views
- **WHEN** a user switches from board view to table view
- **THEN** the same set of items is shown as table rows including title, status, assignees, and tags

### Requirement: Group items by assignee
Both the board view and the table view SHALL offer an option to group items by assignee. An item with multiple assignees SHALL appear in each of its assignees' groups; an item with no assignee SHALL appear in an "Unassigned" group.

#### Scenario: Group board view by assignee
- **WHEN** a user enables group-by-assignee in the board view
- **THEN** items are grouped into per-assignee sections (swimlanes) within each column, including an "Unassigned" section

#### Scenario: Multi-assignee item appears in each group
- **WHEN** an item has two assignees and grouping by assignee is enabled
- **THEN** the item is visible under both assignees' groups

### Requirement: Catalog-backed assignee selection
The assignee editor SHALL offer autocomplete over the catalog's User and Group entities, and SHALL additionally allow committing the current input as a free-text `text:` identity. Selected assignees SHALL be shown as chips that can be removed individually by users with write access.

#### Scenario: Pick an assignee from the catalog
- **WHEN** a user with write access types part of a user's name into the assignee picker
- **THEN** matching catalog users and groups are suggested and selecting one adds it as an assignee

#### Scenario: Free-text assignee via picker
- **WHEN** a user types a name that matches no catalog entity and chooses the free-text option
- **THEN** the value is added as a `text:` assignee, displayed without a catalog link

#### Scenario: Remove an assignee chip
- **WHEN** a user with write access removes an assignee chip
- **THEN** the assignee is removed from the item and the change is recorded

### Requirement: Entity display names for refs
Wherever the boards UI names a creator or assignee ref itself — the assignee avatars, the assignee filter, and the item menu's assignee submenu — it SHALL use the catalog entity's display name: `spec.profile.displayName` for `User` and `Group` entities, `metadata.title` for entities of any other kind, then `metadata.name`. When the entity is unknown, not yet loaded, or carries none of those fields, the ref's own name SHALL be shown as before, and a `text:` ref SHALL show its text. Lists ordered by these names SHALL order by the resolved name, so the same people read and sort the same way on every surface.

Each of those surfaces SHALL make the full entity ref available as a tooltip on the displayed name, so the underlying identity stays reachable. A `text:` ref SHALL NOT carry a tooltip. Surfaces that delegate naming to Backstage's own entity links are not affected by this requirement.

#### Scenario: User display name from the profile
- **WHEN** an item is assigned to `user:default/csmith` whose catalog entity has `spec.profile.displayName` "Christoph Smith"
- **THEN** the assignee reads "Christoph Smith" on the card, in the assignee filter, and in the assignee submenu

#### Scenario: Group display name from the profile
- **WHEN** an item is assigned to `group:default/team-a` whose catalog entity has `spec.profile.displayName` "Team Alpha"
- **THEN** the assignee reads "Team Alpha" rather than "team-a"

#### Scenario: Title for entities without a profile display name
- **WHEN** a ref points at an entity that has no `spec.profile.displayName` but has `metadata.title`
- **THEN** the title is shown

#### Scenario: Fallback for unknown or unresolved entities
- **WHEN** a ref's entity is not in the catalog, has neither a profile display name nor a title, or has not been loaded yet
- **THEN** the name from the ref is shown: the text of a `text:` ref, otherwise the entity name out of the ref

#### Scenario: Full ref as a tooltip
- **WHEN** a user hovers a resolved assignee name or its avatar
- **THEN** the full entity ref (e.g. `user:default/csmith`) is shown, and for a stacked avatar the display name is shown with it

#### Scenario: Free-text assignees carry no tooltip
- **WHEN** a `text:` assignee is displayed
- **THEN** its text is shown as the label and no ref tooltip is offered

#### Scenario: One order everywhere
- **WHEN** a board's assignees are listed in the assignee submenu and in the assignee filter
- **THEN** both list them in the same order, by resolved display name

### Requirement: Item description
An item SHALL have an optional markdown description using the same markdown subset and catalog-entity auto-linking as comments. Users with write access SHALL be able to add, edit, and clear the description inline in the item detail view; externally managed items SHALL show their description read-only.

#### Scenario: Add a description
- **WHEN** a user with write access enters a markdown description and saves
- **THEN** the description is persisted and rendered with markdown formatting and entity links

#### Scenario: Read-only for readers and external items
- **WHEN** a user with only read access, or any user on an externally managed item, views the description
- **THEN** the description is rendered without any edit controls

### Requirement: Filter and search items
The board page SHALL provide a filter bar with free-text search matching item titles and descriptions (case-insensitive), a tag filter offering the tags in use on the board, an assignee filter offering the assignees in use on the board, and an overdue quick filter. The assignee filter SHALL list each assignee referenced by at least one of the board's items — catalog refs by their resolved display name, free-text refs by their display text — sorted alphabetically by that label, and SHALL be offered only while at least one item has an assignee.

The overdue quick filter SHALL be a single toggle labelled with the live count of overdue listed items (for example "Overdue (4)"), offered only while at least one listed item is overdue or the toggle is active. An item is overdue when its due date lies before the current day. While the toggle is active, only overdue items match.

An item matches the assignee filter if it is assigned to ANY of the selected assignees; it matches the tag filter only if it carries ALL selected tags. The filters combine with AND: an item is visible only if it satisfies the text, the tags, the assignees, and the overdue toggle. Active filters SHALL apply to both the board view and the table view, SHALL be reflected in the count of matching items, and SHALL all be reset by the filter bar's clear action. The items API SHALL accept the same filters.

#### Scenario: Text search
- **WHEN** a user types "login" into the search field
- **THEN** only items whose title or description contains "login" (case-insensitive) remain visible in the active view

#### Scenario: Tag filter
- **WHEN** a user selects the tags "bug" and "urgent"
- **THEN** only items carrying both tags remain visible

#### Scenario: Assignee filter offers the board's assignees
- **WHEN** a user opens the assignee filter on a board whose items are assigned to a catalog user and a free-text assignee
- **THEN** both are offered, labelled by display name and by display text respectively, and nobody who is not assigned on this board is offered

#### Scenario: Assignee filter matches any selected assignee
- **WHEN** a user selects two assignees
- **THEN** items assigned to either of them remain visible, and items assigned to neither are hidden

#### Scenario: No assignee filter on a board without assignees
- **WHEN** a user views a board on which no item has an assignee
- **THEN** the filter bar offers no assignee filter

#### Scenario: Filters combine and clear
- **WHEN** text, tag, and assignee filters are active and the user clears them
- **THEN** matching intersects all filters while active, and clearing restores the full item set

#### Scenario: Overdue toggle narrows to overdue items
- **WHEN** a board lists two items due before today, one due today, and one without a due date, and the user toggles "Overdue (2)"
- **THEN** only the two overdue items remain visible in either view, the match count reads 2, and toggling again or clearing filters restores the full set

#### Scenario: Overdue toggle hidden without overdue items
- **WHEN** no listed item has a due date before today and the toggle is not active
- **THEN** the filter bar offers no overdue toggle

#### Scenario: API filtering
- **WHEN** the items endpoint is called with `?text=…&tag=…&assignee=…&overdue=true`
- **THEN** only items matching the text, carrying every requested tag, assigned to at least one requested assignee, and due before the current day are returned

### Requirement: Item archival, restore, and purge
Deleting an item SHALL archive it rather than remove it: the item disappears from the board, table, and filter views but retains its fields, comments, and history. Users with write access SHALL be able to view a board's archived items (with who archived them and when) and restore them; archival and restore SHALL be recorded in the item's change history. Items archived more than 30 days ago SHALL be permanently removed by a scheduled backend task, including their comments, versions, changes, and watches.

#### Scenario: Delete archives
- **WHEN** a user with write access deletes an item
- **THEN** the item disappears from all board views but appears in the archived-items view with actor and timestamp

#### Scenario: Restore an archived item
- **WHEN** a user with write access restores an archived item
- **THEN** the item reappears in its column with all fields, comments, and history intact, and the timeline shows the archive and restore entries

#### Scenario: Read-only users cannot restore
- **WHEN** a user with only read access attempts to restore an archived item
- **THEN** the request is rejected

#### Scenario: Purge after 30 days
- **WHEN** the purge task runs and an item has been archived for more than 30 days
- **THEN** the item and all its data are permanently removed, while more recently archived items remain restorable

### Requirement: Optimistic item moves
Moving an item (drag & drop, move menu, or status change) SHALL update the visible board immediately without waiting for the server. If the server rejects the move, the item SHALL revert to its previous position and the error SHALL be surfaced. Other mutations SHALL refresh only the affected data rather than reloading the entire page state.

#### Scenario: Move renders instantly
- **WHEN** a user moves an item to another column
- **THEN** the card appears in the target column immediately, and the server state reconciles in the background

#### Scenario: Rejected move rolls back
- **WHEN** the server rejects a move (e.g. permissions changed concurrently)
- **THEN** the item returns to its previous column and an error message is shown

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

### Requirement: Item due date

Items SHALL support an optional due date (a calendar date without a time
component). The due date SHALL be settable and clearable by any user with
write access, exposed through the REST API and the item actions, and
changes to it SHALL be recorded in the item change history. Invalid date
values SHALL be rejected.

#### Scenario: Set and clear a due date

- **WHEN** a user with write access sets an item's due date to a valid
  `YYYY-MM-DD` date
- **THEN** the item stores that date and a change entry records the update
- **WHEN** the user clears the due date
- **THEN** the item has no due date and a change entry records the removal

#### Scenario: Invalid due date rejected

- **WHEN** a caller submits a due date that is not a valid calendar date
- **THEN** the request fails with an input error and the item is unchanged

### Requirement: Due date display with urgency colors

The kanban card and the table view SHALL show an item's due date. A due
date of today SHALL render in the warning color, a past due date in the
error color, and a future due date in neutral styling.

#### Scenario: Overdue item highlighted

- **WHEN** an item's due date is before today
- **THEN** the card and the table row show the due date in the error color

#### Scenario: Due-today item highlighted

- **WHEN** an item's due date is today
- **THEN** the card and the table row show the due date in the warning color

### Requirement: Quick due-date menu on cards

Each kanban card SHALL offer users with write access a quick due-date
menu with the options: today, tomorrow, this week (the upcoming Friday,
or today when today is Friday), and remove (only shown when a due date is
set).

#### Scenario: Quick-set to Friday

- **WHEN** a user picks "This week (Fri)" from a card's due-date menu on a
  Wednesday
- **THEN** the item's due date becomes the Friday of the current week

### Requirement: Arbitrary due date in details view

The item details drawer SHALL present the item's due date as a single combined display-and-editor control: the due-date badge itself (or a "No due date" placeholder). For users with write access on a non-externally-managed item, the badge SHALL open a menu on click and on right-click offering today, tomorrow, this week (the upcoming Friday), a "pick a date" entry, and — when a due date is set — a remove entry; it SHALL be keyboard-focusable and operable via the keyboard and SHALL carry a visible affordance making its select capability discoverable. The "pick a date" entry SHALL replace the badge with a focused date input so the user can pick any calendar date; leaving the input SHALL restore the badge. Read-only users and externally managed items SHALL see only the plain due-date display without a picker.

#### Scenario: Quick option from the badge

- **WHEN** a user with write access opens the drawer's due-date control and picks "Tomorrow"
- **THEN** the item's due date becomes tomorrow's date and the badge shows it

#### Scenario: Pick a date in the drawer

- **WHEN** a user with write access chooses "Pick a date…" and selects a date three weeks out in the focused date input
- **THEN** the item's due date is updated to that date and the badge shows it

#### Scenario: Remove the due date

- **WHEN** a user with write access opens the due-date control of an item with a due date and picks the remove entry
- **THEN** the item has no due date and the control shows the "No due date" placeholder

### Requirement: My items across boards

The system SHALL provide logged-in users a view of all items assigned to
them — via their user ref or any of their ownership group refs — across
every non-archived board they can read. Items on boards the user cannot
access SHALL NOT appear. Archived items SHALL NOT appear. Each entry
SHALL carry the board name and column title so the item is understandable
without opening the board.

#### Scenario: Items collected across boards

- **WHEN** a user is assigned items on two boards they can read and one
  item on a private board they cannot read
- **THEN** the my-items listing contains the items from the two readable
  boards and not the item from the private board

#### Scenario: Group assignment counts as mine

- **WHEN** an item is assigned to a group the user belongs to
- **THEN** it appears in the user's my-items listing

#### Scenario: Anonymous callers rejected

- **WHEN** an anonymous caller requests the my-items listing
- **THEN** the request fails with a not-allowed error

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

### Requirement: My items filter bar

The my-items listing SHALL provide the same filter bar the board page
provides — free-text search over item titles and descriptions
(case-insensitive), a tag filter over the tags in use on the listed
items, and an assignee filter over the assignees in use on them, labelled
by resolved display name and sorted by that label — with the same
matching rules: an item must satisfy every active facet, carry ALL
selected tags, and be assigned to ANY of the selected assignees. While
any filter is active the bar SHALL report how many of the user's items
match out of the total and SHALL offer a control that clears every filter
at once.

The assignee filter SHALL be offered only when the listed items carry
more than one distinct assignee. Every listed item is assigned to the
viewer, so a single option would match every row and could exclude
nothing; the board page's rule (offered whenever any item has an
assignee) SHALL be unchanged, because there a single option still
excludes the unassigned items.

Filtering SHALL apply to the already-loaded listing without requesting it
again from the server, and SHALL be applied before grouping, so a group
whose items all filter out is not rendered. When filters exclude every
item the listing SHALL say that nothing matches the filters, rather than
report that nothing is assigned to the user.

#### Scenario: Text search

- **WHEN** the user types "login" into the my-items search field
- **THEN** only their items whose title or description contains "login"
  (case-insensitive) remain visible

#### Scenario: Tag filter

- **WHEN** the user selects the tags "bug" and "urgent"
- **THEN** only their items carrying both tags remain visible

#### Scenario: Assignee filter offered for several assignees

- **WHEN** the user's items are assigned to them personally and to a
  group they belong to
- **THEN** the filter bar offers an assignee filter listing both, and
  selecting the group leaves only the items assigned to that group

#### Scenario: Assignee filter hidden for a single assignee

- **WHEN** every item in the user's listing carries the same single
  assignee
- **THEN** no assignee filter is offered

#### Scenario: Count and clearing

- **WHEN** any filter is active
- **THEN** the bar reports the number of matching items out of the total,
  and clearing restores the full listing

#### Scenario: Nothing matches

- **WHEN** the active filters match none of the user's items
- **THEN** the listing states that no items match the filters instead of
  stating that nothing is assigned

#### Scenario: Empty groups disappear

- **WHEN** a filter excludes every item of one board while other boards
  keep matching items
- **THEN** that board's group is not rendered at all

### Requirement: My items grouping

The my-items listing SHALL offer a grouping control, in the same control
shape the board page uses, with the options: by board (the default), not
grouped, by due date, and by tags. The chosen grouping SHALL only change
how the listing is arranged, never which items it contains.

Grouping by tags SHALL place an item carrying several tags into each of
its tags' groups and SHALL collect items without tags in a trailing
"Untagged" group. Grouping by due date SHALL order groups
chronologically so the most overdue come first, label them by their
urgency the way board groups are labelled, and collect items without a
due date in a trailing "No due date" group. Not grouping SHALL render
the items as a single table without a group heading.

#### Scenario: Default grouping

- **WHEN** the user opens the my-items listing without touching the
  grouping control
- **THEN** the items are grouped by board

#### Scenario: Group by due date

- **WHEN** the user groups by due date and has an overdue item, an item
  due next week, and an item with no due date
- **THEN** the overdue group comes first, the later due date follows, and
  the "No due date" group comes last

#### Scenario: Group by tags with a multi-tag item

- **WHEN** the user groups by tags and one item carries both "bug" and
  "urgent"
- **THEN** the item appears under both tag groups, and items with no tags
  appear under a trailing "Untagged" group

#### Scenario: Not grouped

- **WHEN** the user selects the not-grouped option
- **THEN** all their matching items are shown in a single table with no
  group headings, each row naming its board

#### Scenario: Grouping preserves the item set

- **WHEN** the user switches between the grouping options with no filter
  active
- **THEN** every one of their items remains reachable in each arrangement

### Requirement: Assignee and status matrix dialog

The board menu SHALL offer, on every board, a matrix dialog showing all
of the board's columns (statuses) as one axis and the assignees carrying
the board's items — ordered as the board's group-by-assignee grouping
orders its groups, plus a trailing "Unassigned" row when items without an
assignee exist — as the other. Each cell SHALL show the number of the
board's non-archived items that have that status and that assignee,
respecting the currently active filters; the items themselves SHALL NOT
be listed in the cells. An item with several assignees SHALL be counted
in each of their rows, so the overall total MAY exceed the number of
items, and the dialog SHALL say so.

The matrix SHALL carry a trailing sum column giving each assignee row's
total across the selected statuses, a trailing sum row giving each status
column's total across the selected assignees, and an overall total of the
selected combinations where sum row and sum column meet.

The status headers and the assignee headers SHALL be clickable and SHALL
toggle that status or assignee between selected and unselected;
everything SHALL start selected each time the dialog opens, and a toggle
SHALL be reversible. An unselected status or assignee SHALL be excluded
from the sum column, the sum row, and the overall total, and SHALL be
visibly marked as unselected; its cells' own counts SHALL remain visible.

Assignees SHALL be labelled by their resolved catalog display name,
falling back to the ref's own name, and free-text `text:` assignees by
their text — the same labelling the assignee filter uses. The dialog
SHALL NOT change any item.

#### Scenario: Matrix shows items per status and assignee

- **WHEN** a user opens the assignee matrix on a board with columns
  "Todo"/"Done" where Alice has two items in "Todo" and one in "Done"
- **THEN** Alice's Todo cell shows 2, her Done cell shows 1, and no item
  titles or buttons appear in any cell

#### Scenario: Sum row, sum column, and overall total

- **WHEN** the board has one Todo item assigned to Alice, one Done item
  assigned to Alice, and one Todo item assigned to Bob
- **THEN** Alice's row sums to 2, Bob's row to 1, the Todo column to 2,
  the Done column to 1, and the overall total shows 3

#### Scenario: An item with two assignees counts in both rows

- **WHEN** a single "Todo" item is assigned to both Alice and Bob
- **THEN** both Alice's and Bob's Todo cells show 1, the overall total
  shows 2, and the dialog states that items with several assignees are
  counted for each of them

#### Scenario: Items without an assignee

- **WHEN** the board has items with no assignee
- **THEN** the matrix shows their counts in a trailing "Unassigned" row
  under their status columns, and that row participates in sums and
  toggling like an assignee row

#### Scenario: Every assignee is assigned

- **WHEN** every item on the board has at least one assignee
- **THEN** the matrix shows no "Unassigned" row

#### Scenario: Unselecting a status excludes it from the sums

- **WHEN** the user clicks the "Done" status header in the matrix of the
  sum scenario
- **THEN** "Done" is marked unselected, Alice's row sum becomes 1, the
  Done column sum reflects no selected combinations, and the overall
  total shows 2
- **WHEN** the user clicks the "Done" header again
- **THEN** the sums return to their previous values

#### Scenario: Unselecting an assignee excludes them from the sums

- **WHEN** the user clicks Bob's row header
- **THEN** the Todo column sum and the overall total no longer count
  Bob's Todo item, while Bob's own cell counts stay visible

#### Scenario: Selection resets on reopen

- **WHEN** a user unselects a status, closes the matrix, and opens it
  again
- **THEN** every status and assignee is selected again

#### Scenario: Active filter narrows the matrix

- **WHEN** a search, tag, or assignee filter is active on the board and
  the user opens the matrix
- **THEN** only the items the board is currently showing are counted

#### Scenario: Read-only access

- **WHEN** a user with only read access opens the board's actions menu
- **THEN** the assignee matrix entry is offered, and opening it changes
  no item

### Requirement: Item menu in details drawer
The item details drawer SHALL offer the same item actions menu as the item's card and table row — move to another column, the quick due-date entries, the priority submenu (when the board defines priorities), the assignee submenu, and delete — subject to the same write-access and externally-managed restrictions as elsewhere. The "Open details" entry SHALL be omitted, since the details are already open. The drawer SHALL NOT show a standalone delete button; deletion is offered through the menu. Deleting the item from the drawer's menu SHALL close the drawer. For users who cannot modify the item (read-only access or an externally managed item) the drawer SHALL NOT offer an empty menu.

#### Scenario: Drawer menu offers the full action set
- **WHEN** a user with write access opens the item menu in the details drawer
- **THEN** it offers moving the item to another column, the due-date shortcuts, the priority submenu (on a board with priorities), the assignee submenu, and deleting the item — and no "Open details" entry

#### Scenario: Delete via the drawer menu
- **WHEN** a user with write access deletes the item from the drawer's menu
- **THEN** the item is deleted and the drawer closes

#### Scenario: No standalone delete button
- **WHEN** a user with write access views the details drawer
- **THEN** no standalone "Delete item" button is shown outside the menu

#### Scenario: Read-only users get no empty menu
- **WHEN** a user with only read access, or any user on an externally managed item, views the details drawer
- **THEN** no item actions menu with zero usable entries is offered

### Requirement: Structured details drawer
The item details drawer SHALL group its content into visually separated sections so each block is identifiable at a glance, in this order: the item's fields (status, priority, due date badges, then assignees and tags), the description, the checklist, and the activity block. Assignees and tags SHALL render as a borderless label/value table — the labels on the left, the chips and their add controls on the right of the same row. The description's heading row SHALL carry the description's edit and history controls on its right. The activity block is identified by its tabs; the drawer SHALL NOT show a separate "Activity" heading and SHALL NOT show a created-by/updated-by metadata block. The watch control SHALL sit in the drawer header, beside the item menu and close buttons.

#### Scenario: Sections and field table
- **WHEN** a user opens the item details drawer
- **THEN** the field area, description, and checklist each appear under a visible heading or label, the assignees and tags form a borderless label/value table with their add controls in the value column, and the activity tabs follow without an extra heading or metadata lines

#### Scenario: Description controls beside the heading
- **WHEN** a user with write access views an item with an edited description
- **THEN** the "Description" heading row offers the edit control and the history toggle on its right side

#### Scenario: Watch control in the header
- **WHEN** a user opens the item details drawer
- **THEN** the watch control appears in the drawer header next to the item menu and close buttons

### Requirement: Combined status display and editor in details drawer
The item details drawer SHALL show the item's status as a single control: the status badge itself. For users with write access on a non-externally-managed item, the badge SHALL open a status picker listing the board's columns on click and on right-click, SHALL be keyboard-focusable and operable via the keyboard, and SHALL carry a visible affordance (such as a dropdown indicator) making its select capability discoverable. Choosing a column SHALL move the item to that column. The drawer SHALL NOT additionally show a separate status select. For read-only users and externally managed items the plain, non-interactive badge SHALL be shown without a picker or affordance.

#### Scenario: Change status via the badge
- **WHEN** a user with write access activates the drawer's status badge and picks another column
- **THEN** the item moves to that column and the badge shows the new status

#### Scenario: Keyboard operation
- **WHEN** a user with write access focuses the status badge via the keyboard and opens it with the keyboard
- **THEN** the status picker opens and a column can be chosen without a pointer

#### Scenario: Right-click opens the picker
- **WHEN** a user with write access right-clicks the drawer's status badge
- **THEN** the status picker opens instead of the browser context menu

#### Scenario: Read-only status badge
- **WHEN** a read-only user or any user on an externally managed item views the drawer
- **THEN** the status badge is plain and non-interactive, with no dropdown affordance and no separate status select

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

### Requirement: Table row selection
The board's table view SHALL let users with write access select item
rows via a leading checkbox per row, tracked by item id. Each rendered
table SHALL offer a select-all checkbox in its header that selects or
clears all selectable rows it shows and renders an indeterminate state
when only some of them are selected. The selection SHALL be one shared,
id-based selection for the whole board page: the board view SHALL show
the same selection on its cards with a visible selected marking, items
SHALL be selectable from either view (checkbox in the table, keyboard
Space in both views), and switching between board and table view SHALL
preserve the selection. Selection SHALL be preserved when the group-by
option changes, and an item appearing in more than one group SHALL
count as a single selection reflected in every group that shows it.
Externally managed items SHALL NOT be selectable, and users without
write access SHALL see no selection checkboxes and no selected
markings. Row selection SHALL NOT open the item drawer.

#### Scenario: Select items and switch grouping
- **WHEN** a writer selects two items in the table and then changes the
  group-by option from "None" to "Assignee"
- **THEN** the same two items remain selected in the regrouped table

#### Scenario: Selection survives switching views
- **WHEN** a writer selects two items in the table view and switches to
  the board view
- **THEN** the same two items' cards show the selected marking, and
  switching back to the table shows both checkboxes still checked

#### Scenario: Multi-group item is one selection
- **WHEN** grouping by assignee shows an item with two assignees in two
  groups and the user selects it in one group
- **THEN** its checkbox is checked in both groups and the selection
  counts one item

#### Scenario: Select all within a group
- **WHEN** the user checks the select-all checkbox of one group's table
- **THEN** all selectable items of that group become selected, and after
  deselecting one row the group's select-all checkbox shows an
  indeterminate state

#### Scenario: Read-only surfaces offer no selection
- **WHEN** a reader views the table, or a writer views a row for an
  externally managed item
- **THEN** the reader sees no checkboxes, and the external item's
  checkbox is disabled so it cannot be selected

### Requirement: Bulk actions on selected items
While at least one item is selected, the board page SHALL show a
bulk-actions bar — in the board view and in the table view alike —
with the number of selected items, a way to clear the selection, and
actions that apply to every selected item: a status dropdown listing
all board columns, an assignee dropdown, a due-date dropdown with the
quick due-date choices (Today, Tomorrow, This week, Remove due date),
a tags dropdown, and an Archive button. The bar SHALL be hidden while
nothing is selected. In the status dropdown, a column SHALL show a
checkmark when all selected items are in it and a dash when only some
are. Choosing a status SHALL move all selected items to that column,
choosing a due-date option SHALL set (or remove) the due date on all
selected items, and Archive SHALL archive all selected items and clear
the selection. Failures of individual item updates SHALL surface as an
error while the remaining items still update, and the views SHALL
reflect all resulting changes.

#### Scenario: Bar appears only with a selection
- **WHEN** no items are selected
- **THEN** no bulk-actions bar is shown, and it appears as soon as one
  item is selected

#### Scenario: Bulk actions from the board view
- **WHEN** a writer selects three cards in the board view and chooses a
  status from the bulk-actions bar's status dropdown
- **THEN** all three items move to that column on the board

#### Scenario: Bulk status change with mixed indicator
- **WHEN** two selected items are in "Todo" and one in "Doing" and the
  user opens the status dropdown
- **THEN** "Todo" shows a dash, "Doing" shows a dash, other columns show
  no marker, and choosing "Done" moves all three items to "Done"

#### Scenario: Uniform status shows a checkmark
- **WHEN** all selected items are in the "Doing" column and the user
  opens the status dropdown
- **THEN** "Doing" shows a checkmark

#### Scenario: Bulk due date
- **WHEN** the user picks "Tomorrow" from the due-date dropdown
- **THEN** every selected item's due date becomes tomorrow's date, and
  picking "Remove due date" afterwards clears it on every selected item

#### Scenario: Bulk archive
- **WHEN** the user presses the Archive button with three items selected
- **THEN** all three items are archived, disappear from the views, the
  selection is cleared, and the bulk-actions bar disappears

### Requirement: Bulk assignee change
The bulk assignee dropdown SHALL list "Me" (the current user) first,
then the board's other assignees, then a "No assignee" entry. An
assignee entry SHALL show a checkmark when every selected item includes
that assignee and a dash when only some do; the "No assignee" entry
SHALL show a checkmark when no selected item has any assignee and a
dash when only some have none. Choosing an assignee SHALL add them to
every selected item, except when all selected items already include
them, in which case it SHALL remove them from every selected item.
Choosing "No assignee" SHALL clear all assignees from every selected
item.

#### Scenario: Assign to all
- **WHEN** an assignee is present on some but not all selected items
  (shown with a dash) and the user chooses that assignee
- **THEN** the assignee is added to every selected item that was missing
  them, and reopening the dropdown shows a checkmark for that assignee

#### Scenario: Toggle off a uniform assignee
- **WHEN** every selected item includes an assignee (shown with a
  checkmark) and the user chooses that assignee
- **THEN** the assignee is removed from every selected item

#### Scenario: Clear assignees
- **WHEN** the user chooses "No assignee" while some selected items have
  assignees
- **THEN** all assignees are removed from every selected item, and
  reopening the dropdown shows a checkmark on "No assignee"

### Requirement: Drag-and-drop drop indicator
While a card is being dragged on the board view, the board SHALL show
a clear insertion indicator at the exact position the card would take
if dropped: before the first card, between any two cards, after the
last card of a column, and in an empty column. The indicator SHALL
follow the pointer as the drag moves and disappear when the drag ends.
Dropping SHALL insert the card exactly where the indicator showed —
also when the lane is grouped, where the drop position SHALL respect
the visible card order of the hovered group. The dragged card itself
SHALL remain visually distinguishable (e.g. dimmed) during the drag.

#### Scenario: Indicator between two cards
- **WHEN** a writer drags a card over the gap between the second and
  third card of a column
- **THEN** an insertion indicator appears between those two cards, and
  dropping places the card between them

#### Scenario: Drop at the end of a column
- **WHEN** a writer drags a card below the last card of a column
- **THEN** an insertion indicator appears after the last card, and
  dropping appends the card at the end of that column

#### Scenario: Drop into an empty column
- **WHEN** a writer drags a card over a column with no cards
- **THEN** the column shows an insertion indicator, and dropping places
  the card there

#### Scenario: Drop position in a grouped lane
- **WHEN** the board is grouped and a writer drops a card between two
  cards of a group section
- **THEN** the card lands exactly between those two cards in that
  section's visible order

### Requirement: Bulk tag change
The bulk tags dropdown SHALL list every tag used on the board's items,
sorted alphabetically, followed by an "Add tag…" entry and a "Remove
all tags" entry. A tag entry SHALL show a checkmark when every selected
item carries that tag and a dash when only some do. Choosing a tag
SHALL add it to every selected item missing it, except when all
selected items already carry it, in which case it SHALL remove it from
every selected item. "Add tag…" SHALL let the user type a tag; the
typed value SHALL be normalized like tags added in the item details
drawer and then added to every selected item missing it. "Remove all
tags" SHALL clear the tags of every selected item.

#### Scenario: Tag a mixed selection
- **WHEN** a tag is present on some but not all selected items (shown
  with a dash) and the user chooses that tag
- **THEN** the tag is added to every selected item that was missing it,
  and reopening the dropdown shows a checkmark for that tag

#### Scenario: Toggle off a uniform tag
- **WHEN** every selected item carries a tag (shown with a checkmark)
  and the user chooses that tag
- **THEN** the tag is removed from every selected item

#### Scenario: Add a new tag to the selection
- **WHEN** the user chooses "Add tag…", types `q3-carryover`, and
  confirms
- **THEN** every selected item gains the `q3-carryover` tag, and the
  dropdown lists it with a checkmark afterwards

#### Scenario: Clear all tags
- **WHEN** the user chooses "Remove all tags" while some selected items
  have tags
- **THEN** every selected item ends up with no tags
