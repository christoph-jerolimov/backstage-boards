# boards/catalog-entity-tab Delta

## MODIFIED Requirements

### Requirement: The Boards tab is shown only for marked entities
The catalog "Boards" tab SHALL be offered only on entities carrying the `boards/is-referenced: "auto-detected"` label, and SHALL be absent on all other entities. The condition SHALL be overridable through app configuration so a deployment can widen or narrow it. In addition, when the permission framework is in use, the tab SHALL NOT expose any board data to a user denied the `boards.use` permission: its content SHALL render an access-restricted state instead of board content, no boards API calls SHALL be made for that user, and where the app framework supports permission-aware tab visibility the tab SHALL be hidden entirely.

#### Scenario: Tab on a referenced entity
- **WHEN** a user opens an entity carrying the `boards/is-referenced` label
- **THEN** the "Boards" tab is offered and lists the boards for that entity the user can access

#### Scenario: No tab on an unreferenced entity
- **WHEN** a user opens an entity without the `boards/is-referenced` label
- **THEN** no "Boards" tab is offered, and its route is not reachable for that entity

#### Scenario: Deployment overrides the condition
- **WHEN** an operator configures a different entity filter for the boards entity content extension
- **THEN** the configured filter decides where the tab appears, replacing the default label condition

#### Scenario: No board data without the use permission
- **WHEN** a user whose permission policy denies `boards.use` opens the "Boards" tab route of an entity carrying the `boards/is-referenced` label
- **THEN** the tab content shows an access-restricted state, no board data is shown, and no boards API requests are issued
