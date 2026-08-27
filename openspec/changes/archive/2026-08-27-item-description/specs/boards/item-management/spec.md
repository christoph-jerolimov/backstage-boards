## ADDED Requirements

### Requirement: Item description
An item SHALL have an optional markdown description using the same markdown subset and catalog-entity auto-linking as comments. Users with write access SHALL be able to add, edit, and clear the description inline in the item detail view; externally managed items SHALL show their description read-only.

#### Scenario: Add a description
- **WHEN** a user with write access enters a markdown description and saves
- **THEN** the description is persisted and rendered with markdown formatting and entity links

#### Scenario: Read-only for readers and external items
- **WHEN** a user with only read access, or any user on an externally managed item, views the description
- **THEN** the description is rendered without any edit controls
