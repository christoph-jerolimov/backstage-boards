## ADDED Requirements

### Requirement: Filter and search items
The board page SHALL provide a filter bar with free-text search matching item titles and descriptions (case-insensitive), a tag filter offering the tags in use on the board, and label `key=value` filters. Active filters SHALL apply to both the board view and the table view; an item matches only if it satisfies every active filter (all selected tags, all label pairs, and the text). The items API SHALL accept the same filters.

#### Scenario: Text search
- **WHEN** a user types "login" into the search field
- **THEN** only items whose title or description contains "login" (case-insensitive) remain visible in the active view

#### Scenario: Tag filter
- **WHEN** a user selects the tags "bug" and "urgent"
- **THEN** only items carrying both tags remain visible

#### Scenario: Label filter
- **WHEN** a user activates the label filter `priority=high`
- **THEN** only items with label `priority` equal to `high` remain visible

#### Scenario: Filters combine and clear
- **WHEN** text, tag, and label filters are active and the user clears them
- **THEN** matching intersects all filters while active, and clearing restores the full item set

#### Scenario: API filtering
- **WHEN** the items endpoint is called with `?text=…&tag=…&label=key=value`
- **THEN** only matching items are returned
