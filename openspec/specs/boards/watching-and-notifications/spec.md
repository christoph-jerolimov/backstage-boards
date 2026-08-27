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

### Requirement: Mention notifications
When a saved comment or item description contains @-mentions (`@user:...`, `@group:...`, or `@name` shorthand for `user:default/name`), the backend SHALL send a mention notification to each mentioned principal, whether or not they watch the item or board. The acting user SHALL NOT be notified for mentioning themselves, and a principal who is both mentioned and watching SHALL receive only the mention notification for that event.

#### Scenario: Non-watcher is notified on mention
- **WHEN** a user saves a comment containing `@user:default/carol` and carol watches neither the item nor the board
- **THEN** carol receives a "mentioned" notification linking to the item

#### Scenario: Shorthand mention
- **WHEN** a comment contains `@carol`
- **THEN** it is treated as a mention of `user:default/carol`

#### Scenario: No self- or double-notification
- **WHEN** a watching user is mentioned in a comment by another user
- **THEN** they receive exactly one notification for that comment (the mention), and the author receives none for mentioning themselves

### Requirement: Configurable item reminders

The backend SHALL support a `boards.reminders` configuration array. Each
entry SHALL define a schedule (cron expression or fixed frequency in
hours), a catalog-based user selection, an item scope, and a message
grouping. Each configured reminder SHALL run as its own scheduled task.
Invalid reminder entries SHALL fail startup with a clear error.

#### Scenario: Independent schedules

- **WHEN** two reminders are configured with different cron expressions
- **THEN** each runs on its own schedule as a separate scheduled task

### Requirement: Catalog-driven user selection

A reminder SHALL select recipients by querying catalog User entities with
the configured `userFilter`, and SHALL skip users matched by the
`excludeUsers` field matcher (for example
`metadata.labels.boards/notifications: 'false'`).

#### Scenario: Opt-out via label

- **WHEN** a user entity carries the label `boards/notifications: false`
  and the reminder excludes on that field/value
- **THEN** that user receives no reminder while other users do

### Requirement: Scoped item collection per user

For each selected user the reminder SHALL collect the items assigned to
them (directly or via one of their `memberOf` groups) on readable,
non-archived boards, excluding archived items, and SHALL then apply the
configured scope: `all` (every assigned item), `with-due-date` (items
that have a due date), `due-today` (due exactly today), or `overdue`
(due before today). Users with no matching items SHALL receive no
message.

#### Scenario: Overdue scope

- **WHEN** a reminder with scope `overdue` runs and a user has one
  overdue item and one due next week
- **THEN** the user's reminder mentions only the overdue item

#### Scenario: Nothing to report

- **WHEN** a selected user has no items matching the scope
- **THEN** no notification is sent to that user

### Requirement: Message grouping

With grouping `combined` the reminder SHALL send one notification per
user summarizing all matching items across boards. With grouping
`per-board` it SHALL send one notification per user per board containing
that board's matching items, each linking to the board.

#### Scenario: Per-board messages

- **WHEN** a per-board reminder runs for a user with matching items on
  two boards
- **THEN** the user receives two notifications, one per board
