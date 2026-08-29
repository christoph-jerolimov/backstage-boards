# boards/actions Specification

## Purpose
Exposes board and item operations as actions in the Backstage actions registry so that other plugins, automation, and future sync modules (GitHub, Jira) can operate on boards programmatically.

## Requirements

### Requirement: Board actions
The backend SHALL register actions in the Backstage actions registry to create a board, update a board (name, visibility, entity assignment, columns), and delete a board. Each action SHALL declare typed input/output schemas and SHALL enforce the same permission rules as the REST API for the calling credentials.

#### Scenario: Create board via action
- **WHEN** the `create-board` action is invoked with a name and optional columns
- **THEN** a board is created exactly as if created through the UI, and the action output includes the new board's id

#### Scenario: Action permission enforcement
- **WHEN** an action mutating a board is invoked with credentials lacking the required permission level
- **THEN** the action fails with a permission error and no data is changed

### Requirement: Permission actions
The backend SHALL register actions to add, update, and remove board permission entries (user/group + level) and to change a board's public visibility mode. These actions SHALL require `admin` access on the target board.

#### Scenario: Grant access via action
- **WHEN** the `add-board-permission` action is invoked by a board admin with `group:default/team-a` and level `write`
- **THEN** the permission entry is created and effective immediately

### Requirement: Item actions
The backend SHALL register actions to add an item, update an item's fields, move an item (column and position), and delete an item, as well as actions to add or edit a comment, and to set an item's tags. Item mutations performed through actions SHALL produce the same change records and notifications as UI mutations. Actions invoked by an integration marked as an external manager SHALL be able to create and update items with the external-management marker.

#### Scenario: Add item via action
- **WHEN** the `add-item` action is invoked with a board id, column, and title
- **THEN** the item is created, a change record is written, and watchers are notified per the notification rules

#### Scenario: External module creates a read-only item
- **WHEN** a sync integration invokes `add-item` with an external-management marker
- **THEN** the item is created as externally managed and is read-only for regular users

#### Scenario: Update comment via action
- **WHEN** the `update-comment` action is invoked for an existing comment
- **THEN** the previous comment version is retained and the new text becomes current, matching the UI editing behavior

### Requirement: List items action
The backend SHALL register a read-only `list-items` action that returns a board's items, honoring the same text and tag filters as the items endpoint and the same permission rules.

#### Scenario: List with filters
- **WHEN** the `list-items` action is invoked with a board id and a tag filter
- **THEN** it returns only the matching items for callers with read access, and fails with a permission error otherwise

### Requirement: Actions honor plugin permissions

When the permission framework is in use, every registered boards action SHALL evaluate the `boards.use` permission for the calling credentials before executing, and actions that create a board SHALL additionally evaluate `boards.new.create`. A DENY decision SHALL fail the action with a permission error and change no data, matching the REST API's behavior for the same caller.

#### Scenario: Action denied without the use permission

- **WHEN** any boards action is invoked with credentials whose policy denies `boards.use`
- **THEN** the action fails with a permission error and no data is changed

#### Scenario: Create-board action honors the create permission

- **WHEN** the `create-board` action is invoked with credentials whose policy denies `boards.new.create`
- **THEN** the action fails with a permission error and no board is created
