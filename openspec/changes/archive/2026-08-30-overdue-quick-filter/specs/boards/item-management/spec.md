## MODIFIED Requirements

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
