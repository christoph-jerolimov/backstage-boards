# boards/watching-and-notifications Specification

## Purpose
Lets users watch boards and individual items and receive Backstage notifications when watched items change, so they can follow work without polling.

## Requirements

### Requirement: Watch a board or an item
Any user with at least read access SHALL be able to watch and unwatch a board and to watch and unwatch individual items, from the UI. Watch state SHALL be per-user and persisted.

#### Scenario: Watch an item
- **WHEN** a user with read access enables "watch" on an item
- **THEN** the watch is stored for that user and the UI reflects the watching state on subsequent visits

#### Scenario: Unwatch
- **WHEN** a watching user disables "watch"
- **THEN** the user receives no further notifications for that board/item

### Requirement: Notifications on item changes
When an item changes — field update, move, deletion, or a new/edited comment — the backend SHALL send a notification through the Backstage notifications service to every user watching that item and every user watching the item's board, excluding the user who made the change. The notification SHALL name the item and board, summarize the change, and link to the item.

#### Scenario: Item watcher is notified
- **WHEN** user A watches an item and user B moves that item to another column
- **THEN** user A receives a notification describing the move with a link to the item

#### Scenario: Board watcher is notified about item changes
- **WHEN** user A watches a board and user B creates or changes any item on that board
- **THEN** user A receives a notification for the change

#### Scenario: Actor is not notified about own change
- **WHEN** a user who watches an item changes that item themselves
- **THEN** that user receives no notification for their own change

#### Scenario: One notification per change
- **WHEN** a user watches both a board and an item on it and the item changes
- **THEN** the user receives a single notification for that change, not two

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

### Requirement: Live board updates
When a board's content changes (items, comments, columns, or board settings), the backend SHALL publish a lightweight signal identifying the board (ids only, no content), and open board views SHALL refresh automatically upon receiving a signal for the board they display. Data access SHALL remain gated by the permission-checked API — signals themselves carry no board content.

#### Scenario: Another user's change appears without reload
- **WHEN** user A has a board open and user B adds or moves an item on that board
- **THEN** user A's view refreshes automatically and shows the change without a manual reload

#### Scenario: Signals carry no content
- **WHEN** a board mutation is signalled
- **THEN** the signal contains only the board (and optionally item) id, and clients fetch actual data through the authorized API
