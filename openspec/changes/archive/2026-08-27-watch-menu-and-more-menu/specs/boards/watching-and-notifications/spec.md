## ADDED Requirements

### Requirement: List watchers
Users with at least read access to a board SHALL be able to see who is watching the board and who is watching each of its items. The watch control in the UI SHALL be a combined button: activating its main segment toggles the current user's watch state, and its menu segment opens a dropdown listing all current watchers. The same control SHALL be used on the board header and in the item detail view.

#### Scenario: View board watchers
- **WHEN** a user with read access opens the watchers dropdown on the board header
- **THEN** they see the list of users currently watching the board, or an empty state if there are none

#### Scenario: View item watchers
- **WHEN** a user with read access opens the watchers dropdown in an item's detail view
- **THEN** they see the list of users currently watching that item

#### Scenario: Toggle via the same control
- **WHEN** a user activates the main segment of the watch button
- **THEN** their watch state toggles and the watcher list reflects the change

#### Scenario: Watchers hidden without access
- **WHEN** a user without read access requests a board's or item's watcher list
- **THEN** the request is rejected
