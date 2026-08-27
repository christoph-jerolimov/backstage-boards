# Board Management

## ADDED Requirements

### Requirement: Multiple entity references per board

A board SHALL reference zero or more catalog entities (for example a
component and the owning team). Admins SHALL manage the list through a
board settings dialog (add via catalog-backed picker, remove per entry)
and through the API, where an update replaces the whole list. The board
header SHALL show the referenced entities as catalog links. Filtering
boards by an entity SHALL match every board whose list contains that
entity. Invalid entity refs SHALL be rejected.

#### Scenario: Reference a component and a team

- **WHEN** an admin adds `component:default/service-a` and
  `group:default/team-a` to a board's settings
- **THEN** the board lists both entities and appears in entity-filtered
  listings for either of them

#### Scenario: Remove a reference

- **WHEN** an admin removes an entity from the board settings
- **THEN** the board no longer appears in that entity's filtered listing

#### Scenario: Existing assignment migrated

- **WHEN** the migration runs on a board with a legacy single entity
  assignment
- **THEN** the board's entity list contains that entity
