## ADDED Requirements

### Requirement: List boards by assigned entity
The board listing API SHALL accept an entity-ref filter returning only boards assigned to that catalog entity, still restricted to boards the caller can access. The catalog entity tab SHALL use this filter instead of client-side filtering.

#### Scenario: Filtered listing
- **WHEN** the board list is requested with `entityRef=system:default/payments`
- **THEN** only accessible boards assigned to that entity are returned

#### Scenario: Access still enforced
- **WHEN** a board assigned to the entity is not accessible to the caller
- **THEN** it is absent from the filtered listing
