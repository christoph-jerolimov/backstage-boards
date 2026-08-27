## ADDED Requirements

### Requirement: Board-wide recent changes
Users with read access SHALL be able to open a recent-changes view for a board from the board's more menu, listing the most recent change records across all items (newest first) with actor, change summary, affected item, and timestamp. Selecting an entry SHALL open the affected item's detail view.

#### Scenario: View recent board changes
- **WHEN** a user with read access opens "Recent changes" from the board's more menu
- **THEN** they see the latest changes across all items of the board, newest first, each naming the actor and the item

#### Scenario: Jump to the item
- **WHEN** a user selects an entry in the recent-changes view
- **THEN** the corresponding item's detail view opens

#### Scenario: Requires read access
- **WHEN** a principal without read access requests a board's change feed
- **THEN** the request is rejected
