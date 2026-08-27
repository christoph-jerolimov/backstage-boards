## ADDED Requirements

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
