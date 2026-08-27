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

### Requirement: Item description
An item SHALL have an optional markdown description using the same markdown subset and catalog-entity auto-linking as comments. Users with write access SHALL be able to add, edit, and clear the description inline in the item detail view; externally managed items SHALL show their description read-only.

#### Scenario: Add a description
- **WHEN** a user with write access enters a markdown description and saves
- **THEN** the description is persisted and rendered with markdown formatting and entity links

#### Scenario: Read-only for readers and external items
- **WHEN** a user with only read access, or any user on an externally managed item, views the description
- **THEN** the description is rendered without any edit controls

### Requirement: Filter and search items
The board page SHALL provide a filter bar with free-text search matching item titles and descriptions (case-insensitive) and a tag filter offering the tags in use on the board. Active filters SHALL apply to both the board view and the table view; an item matches only if it satisfies every active filter (all selected tags and the text). The items API SHALL accept the same filters.

#### Scenario: Text search
- **WHEN** a user types "login" into the search field
- **THEN** only items whose title or description contains "login" (case-insensitive) remain visible in the active view

#### Scenario: Tag filter
- **WHEN** a user selects the tags "bug" and "urgent"
- **THEN** only items carrying both tags remain visible

#### Scenario: Filters combine and clear
- **WHEN** text and tag filters are active and the user clears them
- **THEN** matching intersects all filters while active, and clearing restores the full item set

#### Scenario: API filtering
- **WHEN** the items endpoint is called with `?text=…&tag=…`
- **THEN** only matching items are returned

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
groups the user's items by board, shows status, due date (with the
standard urgency colors), and tags, links each board heading to the
board, and opens an item on its board when clicked. Each board group
SHALL be rendered as a table whose last column is an actions column
holding a menu button, and that menu SHALL also open at the pointer on
right-click. The boards page SHALL reach the same listing through its
"My items" tab; a separate button link to the sub-page is not required.

#### Scenario: Open an item from the sub-page

- **WHEN** the user clicks one of their items on the my-items page
- **THEN** the app navigates to the item's board with that item's details
  open

#### Scenario: Row actions menu

- **WHEN** the user activates the menu button in a my-items row's actions
  column, or right-clicks the row
- **THEN** a menu opens (at the pointer for right-click) offering to open
  the item's details and to open its board
