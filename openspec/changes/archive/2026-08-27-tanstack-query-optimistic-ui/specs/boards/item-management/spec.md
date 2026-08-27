## ADDED Requirements

### Requirement: Optimistic item moves
Moving an item (drag & drop, move menu, or status change) SHALL update the visible board immediately without waiting for the server. If the server rejects the move, the item SHALL revert to its previous position and the error SHALL be surfaced. Other mutations SHALL refresh only the affected data rather than reloading the entire page state.

#### Scenario: Move renders instantly
- **WHEN** a user moves an item to another column
- **THEN** the card appears in the target column immediately, and the server state reconciles in the background

#### Scenario: Rejected move rolls back
- **WHEN** the server rejects a move (e.g. permissions changed concurrently)
- **THEN** the item returns to its previous column and an error message is shown
