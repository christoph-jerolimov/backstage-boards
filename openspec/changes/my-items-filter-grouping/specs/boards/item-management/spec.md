# Item Management

## MODIFIED Requirements

### Requirement: My items sub-page
The frontend SHALL offer a "My items" sub-page under the boards page that lists the user's items with their status, due date (with the standard urgency colors), and tags, and opens an item on its board when clicked. The listing SHALL be grouped by board by default; each board group heading SHALL link to its board. Each group SHALL be rendered as a table whose last column is an actions column holding a menu button, and that menu SHALL also open at the pointer on right-click. When the listing is not grouped by board, the table SHALL additionally carry a board column so every row still names the board its item lives on. The boards page SHALL reach the same listing — with the same filter bar and grouping control — through its "My items" tab; a separate button link to the sub-page is not required.

#### Scenario: Open an item from the sub-page
- **WHEN** the user clicks one of their items on the my-items page
- **THEN** the app navigates to the item's board with that item's details open

#### Scenario: Row actions menu
- **WHEN** the user activates the menu button in a my-items row's actions column, or right-clicks the row
- **THEN** a menu opens (at the pointer for right-click) offering to open the item's details and to open its board

#### Scenario: Board shown per row when not grouped by board
- **WHEN** the user switches the my-items grouping away from board
- **THEN** each row shows the name of the board its item belongs to, linking to that board

#### Scenario: Same controls on the boards page tab
- **WHEN** the user opens the boards page's "My items" tab
- **THEN** the listing offers the same filter bar and grouping control as the my-items sub-page

## ADDED Requirements

### Requirement: My items filter bar
The my-items listing SHALL provide a filter bar with free-text search matching item titles and descriptions (case-insensitive) and a tag filter offering the tags in use on the listed items. An item matches only if it satisfies every active facet, and it carries ALL selected tags. While any filter is active the listing SHALL show how many of the user's items remain visible and SHALL offer a control that clears all filters at once. When filters exclude every item the listing SHALL say so rather than appear empty.

Filtering SHALL apply to the loaded listing without requesting it again from the server, and SHALL be applied before grouping, so a group whose items are all filtered out is not rendered.

#### Scenario: Text search
- **WHEN** the user types "login" into the my-items search field
- **THEN** only their items whose title or description contains "login" (case-insensitive) remain visible

#### Scenario: Tag filter
- **WHEN** the user selects the tags "bug" and "urgent"
- **THEN** only their items carrying both tags remain visible

#### Scenario: Count and clearing
- **WHEN** a text or tag filter is active
- **THEN** the listing reports the number of matching items out of the total, and clearing the filters restores the full listing

#### Scenario: Nothing matches
- **WHEN** the active filters match none of the user's items
- **THEN** the listing states that no items match the filters instead of stating that nothing is assigned

#### Scenario: Empty groups disappear
- **WHEN** a filter excludes every item of one board while other boards keep matching items
- **THEN** that board's group is not rendered at all

### Requirement: My items assignee filter
Because an item can be in the my-items listing through the user's own ref or through any of their ownership group refs, the filter bar SHALL offer an assignee filter over exactly those of the user's own identity refs that appear as an assignee on at least one listed item. The filter SHALL be offered only when two or more such refs are present, since with one it could exclude nothing. Selecting several refs SHALL keep items assigned to ANY of them. Assignees that are not one of the user's own identity refs SHALL NOT be offered.

#### Scenario: Offered for a user with several identities
- **WHEN** the user's listing contains items assigned to them directly and items assigned to a group they belong to
- **THEN** the filter bar offers an assignee filter listing both refs

#### Scenario: Hidden for a single identity
- **WHEN** every item in the user's listing is assigned through the same single ref of theirs
- **THEN** no assignee filter is offered

#### Scenario: Filtering by one identity
- **WHEN** the user selects only their group ref in the assignee filter
- **THEN** only items assigned to that group remain visible, and items assigned to them personally are hidden

#### Scenario: Several identities combine permissively
- **WHEN** the user selects two of their refs
- **THEN** items assigned to either ref remain visible

#### Scenario: Co-assignees are not offered
- **WHEN** one of the user's items is also assigned to a colleague who is not one of the user's own identity refs
- **THEN** that colleague is not offered as an assignee filter option

### Requirement: My items grouping
The my-items listing SHALL offer a grouping control, in the same control shape the board page uses, with the options: by board (the default), not grouped, by due date, and by tags. The chosen grouping SHALL only change how the listing is arranged, never which items it contains.

Grouping by tags SHALL place an item with several tags into each of its tags' groups and SHALL collect items without tags in a trailing "Untagged" group. Grouping by due date SHALL order groups chronologically so the most overdue come first, and SHALL collect items without a due date in a trailing "No due date" group. Not grouping SHALL render the items as a single table without a group heading.

#### Scenario: Default grouping
- **WHEN** the user opens the my-items listing without touching the grouping control
- **THEN** the items are grouped by board

#### Scenario: Group by due date
- **WHEN** the user groups by due date and has an overdue item, an item due next week, and an item with no due date
- **THEN** the overdue group comes first, the later due date follows, and the "No due date" group comes last

#### Scenario: Group by tags with a multi-tag item
- **WHEN** the user groups by tags and one item carries both "bug" and "urgent"
- **THEN** the item appears under both tag groups, and items with no tags appear under a trailing "Untagged" group

#### Scenario: Not grouped
- **WHEN** the user selects the not-grouped option
- **THEN** all their matching items are shown in a single table with no group headings, each row naming its board

#### Scenario: Grouping preserves the item set
- **WHEN** the user switches between the grouping options with no filter active
- **THEN** every one of their items remains reachable in each arrangement
