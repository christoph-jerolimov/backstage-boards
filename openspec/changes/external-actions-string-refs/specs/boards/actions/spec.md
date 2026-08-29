## ADDED Requirements

### Requirement: Status and priority listing actions
The backend SHALL register read-only actions `list-statuses` and `list-priorities` that return, for a given board id, the board's column titles and priority names respectively, each with its color and order, honoring the same read-permission rules as the REST API. These actions let external callers discover the valid `status` and `priority` values before invoking mutating actions.

#### Scenario: List statuses via action
- **WHEN** the `list-statuses` action is invoked with a board id by a caller with read access
- **THEN** it returns the board's columns in board order, each with its title, color, and position

#### Scenario: List priorities via action
- **WHEN** the `list-priorities` action is invoked with a board id by a caller with read access
- **THEN** it returns the board's priority definitions ordered by priority order (1 = highest), each with its name, color, and order

### Requirement: String references resolve strictly
Actions that accept a `status` (column title) or `priority` (name) SHALL resolve the string against the target board's columns or priorities using an exact match on the stored value after trimming surrounding whitespace. When no column or priority matches, the action SHALL fail with an error that names the unknown value and lists the available values, and no data SHALL be changed. When more than one column or priority matches (stored titles/names are not unique), the action SHALL fail as ambiguous rather than picking one.

#### Scenario: Unknown status fails the action
- **WHEN** `add-item` is invoked with a `status` that matches none of the board's column titles
- **THEN** the action fails with an error naming the unknown status and the board's available column titles, and no item is created

#### Scenario: Ambiguous priority fails the action
- **WHEN** `update-item` is invoked with a `priority` that matches more than one of the board's priority names
- **THEN** the action fails with an error stating the reference is ambiguous, and the item is unchanged

## MODIFIED Requirements

### Requirement: Permission actions
The backend SHALL register actions to add, update, and remove board permission entries (user/group + level) and to change a board's public visibility mode. These actions SHALL require `admin` access on the target board. `update-board-permission` and `remove-board-permission` SHALL reference the entry by the principal's entity ref (`principalRef`), which is unique per board, and SHALL fail with a not-found error when no entry for that principal exists on the board.

#### Scenario: Grant access via action
- **WHEN** the `add-board-permission` action is invoked by a board admin with `group:default/team-a` and level `write`
- **THEN** the permission entry is created and effective immediately

#### Scenario: Update access by principal ref
- **WHEN** the `update-board-permission` action is invoked with `group:default/team-a` and level `admin`
- **THEN** the existing entry for that principal is updated; if no entry for that principal exists on the board, the action fails with a not-found error

### Requirement: Item actions
The backend SHALL register actions to add an item, update an item's fields, move an item (status and position), and delete an item, as well as actions to add or edit a comment, and to set an item's tags. Actions SHALL reference the target column by its title via a `status` string and a priority by its name via a `priority` string — never by database id — resolving them per the string-resolution requirement. Boards SHALL be referenced by their `boardId`; items and comments SHALL be referenced by the opaque ids the actions themselves return, as they have no natural unique key. Item mutations performed through actions SHALL produce the same change records and notifications as UI mutations. Actions invoked by an integration marked as an external manager SHALL be able to create and update items with the external-management marker.

#### Scenario: Add item via action
- **WHEN** the `add-item` action is invoked with a board id, a `status` matching a column title, and a title
- **THEN** the item is created in that column, a change record is written, and watchers are notified per the notification rules

#### Scenario: Move item via action
- **WHEN** the `move-item` action is invoked with a board id, item id, and a `status` matching a column title
- **THEN** the item moves to that column and the output reports the resulting `status` as the column title

#### Scenario: External module creates a read-only item
- **WHEN** a sync integration invokes `add-item` with an external-management marker
- **THEN** the item is created as externally managed and is read-only for regular users

#### Scenario: Update comment via action
- **WHEN** the `update-comment` action is invoked for an existing comment
- **THEN** the previous comment version is retained and the new text becomes current, matching the UI editing behavior

### Requirement: List items action
The backend SHALL register a read-only `list-items` action that returns a board's items, honoring the same text and tag filters as the items endpoint and the same permission rules. The priority filter SHALL accept priority names (resolved per the string-resolution requirement), and each returned item SHALL report its column as a `status` string (the column title) and its priority as a `priority` string (the name) instead of database ids.

#### Scenario: List with filters
- **WHEN** the `list-items` action is invoked with a board id and a tag filter
- **THEN** it returns only the matching items for callers with read access, and fails with a permission error otherwise

#### Scenario: Items report status and priority as strings
- **WHEN** the `list-items` action returns items for a board with columns and priorities
- **THEN** each item carries the title of its column as `status` and, when set, its priority's name as `priority`, with no column or priority database ids in the output
