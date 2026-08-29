# Actions

The boards backend registers all board and item operations in the Backstage
actions registry. That makes them callable from **other backend plugins**,
from **scaffolder templates** (as template actions — for example to create a
board for a component as part of scaffolding it), and from automation such
as MCP clients.

Every action enforces the same permission rules as the REST API for the
calling credentials, and mutations produce the same change history and
notifications as changes made through the UI. The registry namespaces
action names with the plugin id, so the full id of `create-board` is
`boards:create-board`.

Columns and priorities are referenced by name, never by database id: item
actions take a `status` (the column title, e.g. `To do`) and a `priority`
(the priority name, e.g. `high`), and permission actions address entries
by the principal's entity ref. Values are matched exactly after trimming;
a value that matches nothing fails the action with an error listing the
valid values, and one that matches more than one column or priority
(titles and names are not unique) fails as ambiguous. Use `list-statuses`
and `list-priorities` to discover the valid values for a board. Boards
are addressed by their `boardId`; items and comments by the opaque ids
the actions themselves return.

## Available actions

| Action                    | Description                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `create-board`            | Creates a new board with optional columns, visibility, entity assignment, and admin grants.                        |
| `update-board`            | Updates a board's name, referenced catalog entities, or visibility.                                                |
| `delete-board`            | Archives a board; it becomes read-only for admins and is permanently deleted after 30 days.                        |
| `add-board-permission`    | Grants a user or group a permission level (read, write, admin) on a board.                                         |
| `update-board-permission` | Changes the level of a principal's existing board permission entry.                                                |
| `remove-board-permission` | Removes a principal's permission entry from a board.                                                               |
| `list-items`              | Lists the items of a board, optionally filtered by text and tags (all must match).                                 |
| `add-item`                | Adds an item to a board status column. Service callers may mark items as externally managed (read-only for users). |
| `update-item`             | Updates an item's title, description, creator, assignees, due date, or priority.                                   |
| `move-item`               | Moves an item to another status column and/or position.                                                            |
| `delete-item`             | Deletes an item from a board.                                                                                      |
| `add-comment`             | Adds a comment to a board item.                                                                                    |
| `update-comment`          | Edits an existing comment; the previous version is kept in the comment history.                                    |
| `set-item-tags`           | Replaces the tags of an item.                                                                                      |
| `list-statuses`           | Lists a board's status columns in board order; their titles are the valid `status` values for the item actions.    |
| `list-priorities`         | Lists a board's priorities ordered from highest to lowest; their names are the valid `priority` values.            |

## `create-board`

Creates a new board with optional columns, visibility, entity assignment,
and admin grants.

**Input**

| Field        | Type     | Required | Description                                                                       |
| ------------ | -------- | -------- | --------------------------------------------------------------------------------- |
| `name`       | string   | yes      | Name of the board.                                                                |
| `columns`    | string[] | no       | Initial column titles, in order.                                                  |
| `entityRefs` | string[] | no       | Catalog entity refs the board references.                                         |
| `visibility` | enum     | no       | `private`, `logged-in-read`, `logged-in-write`, `public-read`, or `public-write`. |
| `admins`     | string[] | no       | User/group entity refs granted admin access.                                      |

**Output**

| Field  | Type   | Description            |
| ------ | ------ | ---------------------- |
| `id`   | string | Id of the new board.   |
| `name` | string | Name of the new board. |

## `update-board`

Updates a board's name, referenced catalog entities, or visibility.

**Input**

| Field        | Type     | Required | Description                                                                       |
| ------------ | -------- | -------- | --------------------------------------------------------------------------------- |
| `boardId`    | string   | yes      | Id of the board.                                                                  |
| `name`       | string   | no       | New board name.                                                                   |
| `entityRefs` | string[] | no       | Replaces the full list of referenced entity refs.                                 |
| `visibility` | enum     | no       | `private`, `logged-in-read`, `logged-in-write`, `public-read`, or `public-write`. |

**Output**

| Field | Type   | Description              |
| ----- | ------ | ------------------------ |
| `id`  | string | Id of the updated board. |

## `delete-board`

Archives a board; it becomes read-only for admins and is permanently
deleted after 30 days. Marked as destructive.

**Input**

| Field     | Type   | Required | Description      |
| --------- | ------ | -------- | ---------------- |
| `boardId` | string | yes      | Id of the board. |

**Output** — empty object.

## `add-board-permission`

Grants a user or group a permission level (read, write, admin) on a board.

**Input**

| Field          | Type   | Required | Description                                         |
| -------------- | ------ | -------- | --------------------------------------------------- |
| `boardId`      | string | yes      | Id of the board.                                    |
| `principalRef` | string | yes      | User or group entity ref, e.g. `user:default/jane`. |
| `level`        | enum   | yes      | `read`, `write`, or `admin`.                        |

**Output**

| Field          | Type   | Description                       |
| -------------- | ------ | --------------------------------- |
| `principalRef` | string | Principal the entry was made for. |

## `update-board-permission`

Changes the level of a principal's existing board permission entry. Fails
if the principal has no entry on the board.

**Input**

| Field          | Type   | Required | Description                                         |
| -------------- | ------ | -------- | --------------------------------------------------- |
| `boardId`      | string | yes      | Id of the board.                                    |
| `principalRef` | string | yes      | User or group entity ref, e.g. `user:default/jane`. |
| `level`        | enum   | yes      | `read`, `write`, or `admin`.                        |

**Output**

| Field          | Type   | Description                        |
| -------------- | ------ | ---------------------------------- |
| `principalRef` | string | Principal whose entry was updated. |

## `remove-board-permission`

Removes a principal's permission entry from a board. Fails if the
principal has no entry on the board. Marked as destructive.

**Input**

| Field          | Type   | Required | Description                                         |
| -------------- | ------ | -------- | --------------------------------------------------- |
| `boardId`      | string | yes      | Id of the board.                                    |
| `principalRef` | string | yes      | User or group entity ref, e.g. `user:default/jane`. |

**Output** — empty object.

## `list-items`

Lists the items of a board, optionally filtered. Marked as read-only.

**Input**

| Field        | Type     | Required | Description                                          |
| ------------ | -------- | -------- | ---------------------------------------------------- |
| `boardId`    | string   | yes      | Id of the board.                                     |
| `text`       | string   | no       | Free-text filter over titles and descriptions.       |
| `tags`       | string[] | no       | Only items carrying **all** of these tags.           |
| `priorities` | string[] | no       | Priority names; items matching **any** are returned. |

**Output**

| Field   | Type     | Description                                                                                                                |
| ------- | -------- | -------------------------------------------------------------------------------------------------------------------------- |
| `items` | object[] | The matching items, each with `id`, `title`, `status` (column title), `tags`, `assignees`, and optional `priority` (name). |

## `add-item`

Adds an item to a board status column. Service callers may mark items as
externally managed (read-only for users).

**Input**

| Field             | Type     | Required | Description                                                |
| ----------------- | -------- | -------- | ---------------------------------------------------------- |
| `boardId`         | string   | yes      | Id of the board.                                           |
| `status`          | string   | yes      | Title of one of the board's columns, e.g. `To do`.         |
| `title`           | string   | yes      | Title of the item.                                         |
| `creatorRef`      | string   | no       | Creator as an entity ref or `text:` identity.              |
| `assignees`       | string[] | no       | Assignees as entity refs or `text:` identities.            |
| `tags`            | string[] | no       | Tags of the item.                                          |
| `priority`        | string   | no       | Name of one of the board's priorities.                     |
| `externalManager` | string   | no       | Identifier of the external managing system, e.g. `github`. |

**Output**

| Field | Type   | Description         |
| ----- | ------ | ------------------- |
| `id`  | string | Id of the new item. |

## `update-item`

Updates an item's title, description, creator, assignees, due date, or
priority.

**Input**

| Field         | Type           | Required | Description                                                |
| ------------- | -------------- | -------- | ---------------------------------------------------------- |
| `boardId`     | string         | yes      | Id of the board.                                           |
| `itemId`      | string         | yes      | Id of the item.                                            |
| `title`       | string         | no       | New title.                                                 |
| `description` | string         | no       | Markdown description; empty string clears it.              |
| `creatorRef`  | string \| null | no       | New creator; `null` clears it.                             |
| `assignees`   | string[]       | no       | Replaces the full assignee list.                           |
| `dueDate`     | string \| null | no       | Due date as `YYYY-MM-DD`, or `null` to clear it.           |
| `priority`    | string \| null | no       | Name of one of the board's priorities, or `null` to clear. |

**Output**

| Field | Type   | Description             |
| ----- | ------ | ----------------------- |
| `id`  | string | Id of the updated item. |

## `move-item`

Moves an item to another status column and/or position.

**Input**

| Field      | Type   | Required | Description                                       |
| ---------- | ------ | -------- | ------------------------------------------------- |
| `boardId`  | string | yes      | Id of the board.                                  |
| `itemId`   | string | yes      | Id of the item.                                   |
| `status`   | string | yes      | Title of one of the board's columns, e.g. `Done`. |
| `position` | number | no       | Position within the column; end if omitted.       |

**Output**

| Field    | Type   | Description                             |
| -------- | ------ | --------------------------------------- |
| `id`     | string | Id of the moved item.                   |
| `status` | string | Title of the column the item is in now. |

## `delete-item`

Deletes (archives) an item from a board. Marked as destructive.

**Input**

| Field     | Type   | Required | Description      |
| --------- | ------ | -------- | ---------------- |
| `boardId` | string | yes      | Id of the board. |
| `itemId`  | string | yes      | Id of the item.  |

**Output** — empty object.

## `add-comment`

Adds a comment to a board item.

**Input**

| Field     | Type   | Required | Description       |
| --------- | ------ | -------- | ----------------- |
| `boardId` | string | yes      | Id of the board.  |
| `itemId`  | string | yes      | Id of the item.   |
| `text`    | string | yes      | The comment text. |

**Output**

| Field | Type   | Description            |
| ----- | ------ | ---------------------- |
| `id`  | string | Id of the new comment. |

## `update-comment`

Edits an existing comment; the previous version is kept in the comment
history.

**Input**

| Field       | Type   | Required | Description           |
| ----------- | ------ | -------- | --------------------- |
| `boardId`   | string | yes      | Id of the board.      |
| `itemId`    | string | yes      | Id of the item.       |
| `commentId` | string | yes      | Id of the comment.    |
| `text`      | string | yes      | The new comment text. |

**Output**

| Field | Type   | Description                |
| ----- | ------ | -------------------------- |
| `id`  | string | Id of the updated comment. |

## `set-item-tags`

Replaces the tags of an item.

**Input**

| Field     | Type     | Required | Description                 |
| --------- | -------- | -------- | --------------------------- |
| `boardId` | string   | yes      | Id of the board.            |
| `itemId`  | string   | yes      | Id of the item.             |
| `tags`    | string[] | yes      | Replaces the full tag list. |

**Output**

| Field | Type   | Description             |
| ----- | ------ | ----------------------- |
| `id`  | string | Id of the updated item. |

## `list-statuses`

Lists a board's status columns in board order; their titles are the valid
`status` values for the item actions. Marked as read-only.

**Input**

| Field     | Type   | Required | Description      |
| --------- | ------ | -------- | ---------------- |
| `boardId` | string | yes      | Id of the board. |

**Output**

| Field      | Type     | Description                                                                                |
| ---------- | -------- | ------------------------------------------------------------------------------------------ |
| `statuses` | object[] | The columns in board order, each with `title`, optional `color`, and `position` (1-based). |

## `list-priorities`

Lists a board's priorities ordered from highest to lowest; their names are
the valid `priority` values for the item actions. Marked as read-only.

**Input**

| Field     | Type   | Required | Description      |
| --------- | ------ | -------- | ---------------- |
| `boardId` | string | yes      | Id of the board. |

**Output**

| Field        | Type     | Description                                                                                   |
| ------------ | -------- | --------------------------------------------------------------------------------------------- |
| `priorities` | object[] | The priority definitions, each with `name`, optional `color`, and `order` (1 is the highest). |
