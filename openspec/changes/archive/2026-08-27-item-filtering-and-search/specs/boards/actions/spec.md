## ADDED Requirements

### Requirement: List items action
The backend SHALL register a read-only `list-items` action that returns a board's items, honoring the same text, tag, and label filters as the items endpoint and the same permission rules.

#### Scenario: List with filters
- **WHEN** the `list-items` action is invoked with a board id and a tag filter
- **THEN** it returns only the matching items for callers with read access, and fails with a permission error otherwise
