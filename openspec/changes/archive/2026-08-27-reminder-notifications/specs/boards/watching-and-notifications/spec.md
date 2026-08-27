# Watching and Notifications

## ADDED Requirements

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
