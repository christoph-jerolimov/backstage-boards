## ADDED Requirements

### Requirement: Live board updates
When a board's content changes (items, comments, columns, or board settings), the backend SHALL publish a lightweight signal identifying the board (ids only, no content), and open board views SHALL refresh automatically upon receiving a signal for the board they display. Data access SHALL remain gated by the permission-checked API — signals themselves carry no board content.

#### Scenario: Another user's change appears without reload
- **WHEN** user A has a board open and user B adds or moves an item on that board
- **THEN** user A's view refreshes automatically and shows the change without a manual reload

#### Scenario: Signals carry no content
- **WHEN** a board mutation is signalled
- **THEN** the signal contains only the board (and optionally item) id, and clients fetch actual data through the authorized API
