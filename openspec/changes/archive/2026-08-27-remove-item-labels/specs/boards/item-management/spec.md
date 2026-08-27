# Item Management

## MODIFIED Requirements

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

### Requirement: Board view and table view
All items of a board SHALL be viewable as a kanban board (one lane per column, items as cards) and as a table (items as rows with their fields as columns). The user SHALL be able to switch between the two views, and the chosen view SHALL not change the underlying data.

#### Scenario: Switch views
- **WHEN** a user switches from board view to table view
- **THEN** the same set of items is shown as table rows including title, status, assignees, and tags

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
