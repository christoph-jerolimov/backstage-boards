# Item Management

## MODIFIED Requirements

### Requirement: Item fields
An item SHALL belong to exactly one board and one of its columns (the item's status). An item SHALL have: a required title; audit fields (created by, created at, updated by, updated at); tags as a flat list of strings; an optional creator; an optional priority chosen from its board's priorities; and one or more assignees. Creator and assignees SHALL be entity refs (e.g. `user:default/christoph`, `group:default/team-a`) or free-text identities using the `text:` prefix (e.g. `text:External Contractor`).

#### Scenario: Create an item
- **WHEN** a user with write access adds an item with title "Fix login bug" to the "Todo" column
- **THEN** the item is persisted with status "Todo", created by/created at set from the caller identity and current time, and appears in the board immediately

#### Scenario: Title is required
- **WHEN** a user attempts to create an item with an empty title
- **THEN** the request is rejected with a validation error

#### Scenario: Priority is optional
- **WHEN** a user with write access adds an item without naming a priority
- **THEN** the item is created with no priority and is displayed without a priority badge

#### Scenario: Text-prefixed assignee
- **WHEN** a user assigns an item to `text:Jane (agency)`
- **THEN** the assignee is stored and displayed as plain text without a catalog link, while catalog-ref assignees on the same item render as entity links

### Requirement: Filter and search items
The board page SHALL provide a filter bar with free-text search matching item titles and descriptions (case-insensitive), a tag filter offering the tags in use on the board, and — for boards that have priorities — a priority filter. Active filters SHALL apply to both the board view and the table view; an item matches only if it satisfies every active filter (all selected tags, the text, and, when priorities are selected, any one of them). The items API SHALL accept the same filters.

#### Scenario: Text search
- **WHEN** a user types "login" into the search field
- **THEN** only items whose title or description contains "login" (case-insensitive) remain visible in the active view

#### Scenario: Tag filter
- **WHEN** a user selects the tags "bug" and "urgent"
- **THEN** only items carrying both tags remain visible

#### Scenario: Filters combine and clear
- **WHEN** text, tag, and priority filters are active and the user clears them
- **THEN** matching intersects all filters while active, and clearing restores the full item set

#### Scenario: API filtering
- **WHEN** the items endpoint is called with `?text=…&tag=…&priority=…`
- **THEN** only matching items are returned

### Requirement: Table sorting
The table view SHALL allow sorting by the Title, Status, Priority, Created by, and Updated columns via their headers, toggling between ascending and descending. The Priority header SHALL be offered only while the Priority column is shown, and SHALL order by the priorities' order numbers with unprioritized items last in both directions. Sorting SHALL combine with active filters, and with grouping enabled it SHALL order the items within each group.

#### Scenario: Sort by title
- **WHEN** a user activates the Title header
- **THEN** rows order alphabetically by title, and activating it again reverses the order

#### Scenario: Sort by priority
- **WHEN** a user activates the Priority header on a board whose priorities are critical, high, medium, low
- **THEN** rows order critical first and low last, with unprioritized items after them, and activating it again reverses the prioritized rows while leaving the unprioritized ones last

#### Scenario: Sorting within groups
- **WHEN** grouping is active and a sort is applied
- **THEN** each group's rows are ordered by the selected sort

### Requirement: My items across boards

The system SHALL provide logged-in users a view of all items assigned to
them — via their user ref or any of their ownership group refs — across
every non-archived board they can read. Items on boards the user cannot
access SHALL NOT appear. Archived items SHALL NOT appear. Each entry
SHALL carry the board name, the column title, and — when the item has
one — its priority resolved to name, color, and order number, so the
item is understandable without opening the board.

#### Scenario: Items collected across boards

- **WHEN** a user is assigned items on two boards they can read and one
  item on a private board they cannot read
- **THEN** the my-items listing contains the items from the two readable
  boards and not the item from the private board

#### Scenario: Group assignment counts as mine

- **WHEN** an item is assigned to a group the user belongs to
- **THEN** it appears in the user's my-items listing

#### Scenario: Entries carry their priority

- **WHEN** a user is assigned an item carrying the priority "high"
- **THEN** its my-items entry names that priority with its color and
  order number, without the caller having to load the item's board

#### Scenario: Anonymous callers rejected

- **WHEN** an anonymous caller requests the my-items listing
- **THEN** the request fails with a not-allowed error

### Requirement: My items sub-page

The frontend SHALL offer a "My items" sub-page under the boards page that
groups the user's items by board, shows status, due date (with the
standard urgency colors), priority, and tags, links each board heading to
the board, and opens an item on its board when clicked. The priority
column SHALL be shown only for board groups whose board has priorities.
Each board group SHALL be rendered as a table whose last column is an
actions column holding a menu button, and that menu SHALL also open at
the pointer on right-click. That menu SHALL offer the same item actions
as the item menu on a board — open details, move to another column, set
or clear the due date, change the priority, change assignees, and delete
the item — subject to the same write-access and externally-managed
restrictions, plus an entry that opens the item's board. After such an
action the listing SHALL reflect the result, including removing an item
that is no longer assigned to the user. The boards page SHALL reach the
same listing through its "My items" tab; a separate button link to the
sub-page is not required.

#### Scenario: Open an item from the sub-page

- **WHEN** the user clicks one of their items on the my-items page
- **THEN** the app navigates to the item's board with that item's details
  open

#### Scenario: Row actions menu

- **WHEN** the user activates the menu button in a my-items row's actions
  column, or right-clicks the row
- **THEN** a menu opens (at the pointer for right-click) offering to open
  the item's details, move it to another column, change its due date,
  priority and assignees, delete it, and open its board

#### Scenario: Change status from the my-items table

- **WHEN** the user moves one of their items to another column from the
  my-items row menu
- **THEN** the item's status changes on its board and the row's status
  cell shows the new column

#### Scenario: Change priority from the my-items table

- **WHEN** the user picks another priority for one of their items from
  the my-items row menu
- **THEN** the item's priority changes on its board and the row's
  priority cell shows the new priority

#### Scenario: Priority column only for boards that use priorities

- **WHEN** the user has items on one board with priorities and one
  without
- **THEN** only the first board's group renders a priority column

#### Scenario: Unassigning removes the row

- **WHEN** the user removes themselves as an assignee from the my-items
  row menu, and no group of theirs is assigned to that item
- **THEN** the row disappears from the listing

#### Scenario: Read-only board offers navigation only

- **WHEN** the user opens the row menu for an item on a board they can
  only read, or for an externally managed item
- **THEN** the menu offers to open the item's details and its board, and
  no action that would modify the item
