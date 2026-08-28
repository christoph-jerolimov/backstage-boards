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
The board page SHALL provide a filter bar with free-text search matching item titles and descriptions (case-insensitive), a tag filter offering the tags in use on the board, and an assignee filter offering the assignees in use on the board. The assignee filter SHALL list each assignee referenced by at least one of the board's items — catalog refs by their resolved display name, free-text refs by their display text — sorted alphabetically by that label, and SHALL be offered only while at least one item has an assignee.

An item matches the assignee filter if it is assigned to ANY of the selected assignees; it matches the tag filter only if it carries ALL selected tags. The filters combine with AND: an item is visible only if it satisfies the text, the tags, and the assignees. Active filters SHALL apply to both the board view and the table view, SHALL be reflected in the count of matching items, and SHALL all be reset by the filter bar's clear action. The items API SHALL accept the same filters.

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

#### Scenario: API filtering
- **WHEN** the items endpoint is called with `?text=…&tag=…&assignee=…`
- **THEN** only items matching the text, carrying every requested tag, and assigned to at least one requested assignee are returned

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
The table view SHALL allow sorting by the Title, Status, Created by, and Updated columns via their headers, toggling between ascending and descending. Sorting SHALL combine with active filters, and with group-by-assignee enabled it SHALL order the items within each group.

#### Scenario: Sort by title
- **WHEN** a user activates the Title header
- **THEN** rows order alphabetically by title, and activating it again reverses the order

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

The item details drawer SHALL let users with write access pick any
calendar date as the due date, or clear it.

#### Scenario: Pick a date in the drawer

- **WHEN** a user selects a date three weeks out in the drawer's due-date
  field
- **THEN** the item's due date is updated to that date

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
lists the user's items with their status, due date (with the standard
urgency colors), and tags, and opens an item on its board when clicked.
The listing SHALL be grouped by board by default, with each board heading
linking to its board. Each group SHALL be rendered as a table whose last
column is an actions column holding a menu button, and that menu SHALL
also open at the pointer on right-click. That menu SHALL offer the same
item actions as the item menu on a board — open details, move to another
column, set or clear the due date, change assignees, and delete the item
— subject to the same write-access and externally-managed restrictions,
plus an entry that opens the item's board. Those actions and restrictions
SHALL be resolved per item from the board that item belongs to, so they
are unaffected by a grouping that mixes items from several boards. After
such an action the listing SHALL reflect the result, including removing
an item that is no longer assigned to the user. When the listing is not
grouped by board, the table SHALL additionally carry a board column
linking to each item's board, so every row still names where it lives.
The boards page SHALL reach the same listing — with the same filter bar
and grouping control — through its "My items" tab; a separate button link
to the sub-page is not required.

#### Scenario: Open an item from the sub-page

- **WHEN** the user clicks one of their items on the my-items page
- **THEN** the app navigates to the item's board with that item's details
  open

#### Scenario: Row actions menu

- **WHEN** the user activates the menu button in a my-items row's actions
  column, or right-clicks the row
- **THEN** a menu opens (at the pointer for right-click) offering to open
  the item's details, move it to another column, change its due date and
  assignees, delete it, and open its board

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
- **THEN** the menu offers to open the item's details and its board, and
  no action that would modify the item

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
  the my-items sub-page

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
