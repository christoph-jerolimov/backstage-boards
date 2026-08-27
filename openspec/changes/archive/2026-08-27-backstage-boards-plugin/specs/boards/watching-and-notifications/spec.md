## Purpose

Lets users watch boards and individual items and receive Backstage notifications when watched items change, so they can follow work without polling.

## ADDED Requirements

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
