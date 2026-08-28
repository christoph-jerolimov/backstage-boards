# Item Management

## MODIFIED Requirements

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

## ADDED Requirements

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
