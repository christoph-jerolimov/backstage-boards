# boards/catalog-entity-tab Specification

## Purpose
Governs when the catalog "Boards" tab is offered on an entity: entities that at least one board references are marked in the catalog, the mark is kept current as board assignments change, and the tab's empty state accounts for boards the viewer cannot access.

## Requirements

### Requirement: Referenced entities are marked in the catalog
The system SHALL mark every catalog entity that is referenced by at least one non-archived board with the label `boards/is-referenced: "auto-detected"`, and SHALL NOT carry that label on any other entity. The label SHALL be derived by the system on every processing run; a value present in the entity's source description SHALL be ignored and replaced by the derived value.

#### Scenario: Referenced entity gets the label
- **WHEN** a catalog entity is processed while a non-archived board references it
- **THEN** the stored entity carries the label `boards/is-referenced: "auto-detected"`

#### Scenario: Unreferenced entity carries no label
- **WHEN** a catalog entity is processed while no non-archived board references it
- **THEN** the stored entity carries no `boards/is-referenced` label, including when its source description declared one

#### Scenario: Source-declared label is not trusted
- **WHEN** an entity whose `catalog-info.yaml` declares `boards/is-referenced: "auto-detected"` is processed and no board references it
- **THEN** the label is removed from the stored entity

#### Scenario: Archived boards do not mark their entities
- **WHEN** the only boards referencing an entity are archived
- **THEN** the entity is processed as unreferenced and carries no `boards/is-referenced` label

### Requirement: Board references are only readable service-to-service
The boards backend SHALL expose the lookup of whether an entity ref is referenced by a board only to service-to-service callers. Requests carrying user credentials or no credentials SHALL be rejected without disclosing whether any board references the entity.

#### Scenario: Service caller may query
- **WHEN** a backend plugin calls the lookup with valid service credentials for an entity referenced by a non-archived board
- **THEN** the response reports the entity as referenced

#### Scenario: Service caller sees unreferenced entities as such
- **WHEN** a backend plugin calls the lookup for an entity no non-archived board references
- **THEN** the response reports the entity as not referenced

#### Scenario: User request is rejected
- **WHEN** a logged-in user calls the lookup directly
- **THEN** the request is rejected as not allowed and no reference information is returned

#### Scenario: Unauthenticated request is rejected
- **WHEN** an unauthenticated client calls the lookup
- **THEN** the request is rejected as not allowed and no reference information is returned

#### Scenario: Board visibility does not affect the answer
- **WHEN** the only board referencing an entity is private to another user
- **THEN** the service lookup still reports the entity as referenced, because the answer is never exposed to end users directly

### Requirement: Entity marks follow board assignment changes
Whenever an entity gains or loses its board references, the boards backend SHALL request a catalog refresh of the affected entity refs so that the derived label converges without waiting for the next scheduled processing sweep. This SHALL apply to board creation, changes to a board's assigned entities, board archival, unarchival, duplication that copies entity assignments, and permanent deletion. A refresh that fails (for example for an entity ref unknown to the catalog) SHALL be logged and SHALL NOT fail the board operation.

#### Scenario: New board with an entity
- **WHEN** a board is created that references `component:default/payments`
- **THEN** a catalog refresh is requested for `component:default/payments`

#### Scenario: Entity assignment changed
- **WHEN** a board's assigned entities change from `component:default/a` to `component:default/b`
- **THEN** a catalog refresh is requested for both `component:default/a` and `component:default/b`

#### Scenario: Board archived and unarchived
- **WHEN** a board referencing an entity is archived, and later unarchived
- **THEN** a catalog refresh is requested for that entity on each of the two operations

#### Scenario: Board permanently deleted
- **WHEN** an archived board that references an entity is permanently deleted
- **THEN** a catalog refresh is requested for that entity

#### Scenario: Refresh failure does not break the operation
- **WHEN** the catalog refresh request fails for a referenced entity ref
- **THEN** the board operation still succeeds and the failure is logged

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

### Requirement: Empty tab states the access caveat
Because the tab is shown based on board references rather than on the viewer's access, the tab MAY be empty for a user who cannot access any of the referencing boards. The empty state SHALL tell the user that no boards they can access are assigned to the entity, rather than claiming the entity has no boards.

#### Scenario: Referenced entity, no accessible board
- **WHEN** a user opens the "Boards" tab of an entity that is only referenced by boards they cannot read
- **THEN** the tab explains that no boards assigned to this entity are accessible to them

#### Scenario: Accessible boards are listed
- **WHEN** a user opens the "Boards" tab of an entity referenced by a board they can read
- **THEN** that board's content is shown instead of the empty state
