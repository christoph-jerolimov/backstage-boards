# @internal/plugin-boards-backend

Backend for the boards plugin. Stores boards, columns, priority definitions,
items (with tags, assignees, due dates, and checklists), versioned comments
and descriptions, a change audit log, permissions, favorites, and watches in
the plugin's own database. Exposes a REST API under `/api/boards` and
registers actions in the actions registry, both enforcing the same
permission rules.

Beyond request handling it also:

- sends notifications to watchers and mentioned users via the Backstage
  notifications service, grouped per user
- publishes ids-only signals on board changes so open board views refresh
  live
- runs optional scheduled reminders about due and overdue items (see
  [Scheduled reminders](#scheduled-reminders))
- purges boards and items 30 days after their soft delete via scheduled
  tasks

## Important notes

1. **Catalog users** — the sign-in resolver must map signed-in users to
   catalog user entities, or assignments and the "my" features (My items,
   the Assigned items card, reminders) have nothing to attach to.
2. **Security** — board access granted to a group follows the catalog's
   group membership: anyone who can create or edit group entities in the
   catalog can add themselves to a group and thereby gain access to every
   board shared with that group. Restrict who can register and modify
   catalog org data accordingly.
3. **Database** — all boards, items, comments, and history live in the
   plugin's own database. Point `backend.database` at a persistent database
   with backups: unlike catalog data, board content cannot be re-ingested
   from anywhere if it is lost.

## Features

The behaviour specs behind every feature live in `openspec/specs/boards/` in
the repository. The frontend counterpart is `@internal/plugin-boards`.

### Boards and items

- **Boards** — with configurable, optionally colored columns and per-user
  favorites.
- **Board listing** — paginated, filterable by free-text search, referenced
  entity, and creator, with per-status item counts; visibility is evaluated
  by the listing query itself.
- **Duplication** — copies columns, priorities, and optionally items (with
  checklists and tags) and entity references; the copy belongs to the
  duplicator.
- **Items** — title, description, tags, due date, priority, checklist, and
  creator/assignees as catalog refs or free-text `text:` identities.
- **Item filters on the API** — free-text plus tags (all must match) and
  assignees (any must match).
- **Per-board priorities** — up to ten ordered definitions with name and
  color, managed by admins.
- **Soft deletes** — deleting archives: boards get a 30-day grace window
  with unarchive and delete-now, items stay restorable; scheduled tasks
  purge both after 30 days.
- **Entity assignment** — a board can reference any number of catalog
  entities.
- **Externally managed items** — items carrying an `externalManager` marker
  (created by service callers such as sync integrations) are read-only for
  regular users.

### Sharing and permissions

- **Three levels** — `read`, `write`, and `admin`, granted per user or per
  group; the highest grant wins, with group membership resolved via the
  catalog.
- **Public modes** — `private`, `logged-in-read`, `logged-in-write`,
  `public-read`, and `public-write`.
- **Server-side enforcement** — every REST and action call is
  permission-checked; archived boards are read-only.

### Comments and history

- **Versioned comments** — editable, with every version kept; the item
  description is versioned the same way.
- **Change audit log** — every non-comment mutation is recorded with who,
  when, and what changed.
- **Mentions** — `@`-mentions in comments are parsed and stored.

### Notifications and live updates

- **Watches** — on boards and single items, with watcher listings; watched
  changes become Backstage notifications, grouped per user.
- **Mention notifications** — being mentioned in a comment notifies you.
- **Scheduled reminders** — about due and overdue items (see
  [Scheduled reminders](#scheduled-reminders)).
- **Signals** — ids-only signals on board changes so open board views
  refresh live; data access stays behind the permission-checked API.

### Actions registry

- **Registry actions** — board, permission, item, comment, and tag
  operations with typed schemas, enforcing the same permissions and
  producing the same history and notifications as the REST API; the full
  list is in [Actions](#actions) below.
- **External managers** — integrations can create and update items carrying
  the external-management marker.

### Catalog

- **Entity-references endpoint and proactive refreshes** — see
  [Catalog entity references](#catalog-entity-references).

## Actions

All actions registered in the Backstage actions registry, callable from
other backend plugins, scaffolder templates, and automation such as MCP
clients. The registry namespaces the names with the plugin id (e.g.
`boards:create-board`); full input and output schemas are documented on the
Actions page of the TechDocs (`docs/features/actions.md` in the
repository).

| Action                    | Description                                                                                                 |
| ------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `create-board`            | Creates a new board with optional columns, visibility, entity assignment, and admin grants.                 |
| `update-board`            | Updates a board's name, referenced catalog entities, or visibility.                                         |
| `delete-board`            | Archives a board; it becomes read-only for admins and is permanently deleted after 30 days.                 |
| `add-board-permission`    | Grants a user or group a permission level (read, write, admin) on a board.                                  |
| `update-board-permission` | Changes the level of an existing board permission entry.                                                    |
| `remove-board-permission` | Removes a permission entry from a board.                                                                    |
| `list-items`              | Lists the items of a board, optionally filtered by text and tags (all must match).                          |
| `add-item`                | Adds an item to a board column. Service callers may mark items as externally managed (read-only for users). |
| `update-item`             | Updates an item's title, description, creator, assignees, due date, or priority.                            |
| `move-item`               | Moves an item to another column and/or position.                                                            |
| `delete-item`             | Deletes an item from a board.                                                                               |
| `add-comment`             | Adds a comment to a board item.                                                                             |
| `update-comment`          | Edits an existing comment; the previous version is kept in the comment history.                             |
| `set-item-tags`           | Replaces the tags of an item.                                                                               |

## Scheduled reminders

Reminders are recurring notifications about a user's assigned items,
configured under `boards.reminders` (schema in `config.d.ts`). None are
configured by default. Each entry runs as its own scheduled task; an entry
without a valid `schedule` fails startup with a clear error.

```yaml
boards:
  reminders:
    - id: overdue-weekday-mornings
      schedule:
        frequency: { cron: '0 8 * * 1-5' } # or e.g. { minutes: 10 }
        timeout: { minutes: 5 }
      scope: overdue
      grouping: per-board
      userFilter:
        metadata.namespace: default
      excludeUsers:
        metadata.labels.boards/notifications: 'false'
```

Options per reminder:

- **`id`** (required) — unique name of the reminder; also names its
  scheduled task.
- **`schedule`** (required) — a standard Backstage scheduler configuration:
  `frequency` as a cron expression (`{ cron: '0 8 * * 1-5' }`) or a
  human duration (`{ minutes: 10 }`, `{ hours: 1 }`, …), a `timeout`
  duration, an optional `initialDelay`, and an optional task `scope`
  (`global` runs it once across all backend instances, `local` on each).
- **`scope`** — which of a user's assigned items to include: `all`
  (default), `with-due-date`, `due-today`, or `overdue`.
- **`grouping`** — `combined` (default) sends each user one message across
  all boards; `per-board` sends one message per user per board.
- **`userFilter`** — catalog entity filter selecting the recipients, merged
  with `kind: User` (e.g. `metadata.namespace: default`); without it every
  user in the catalog is considered.
- **`excludeUsers`** — users whose entity matches any of these field/value
  pairs are skipped; the example above lets users opt out via a
  `boards/notifications: 'false'` label on their user entity.

For each recipient a run collects the items assigned to them directly or via
one of their groups, on readable, non-archived boards, excluding archived
items, then applies the configured scope; users with no matching items get
no message.

## Catalog entity references

`GET /service/entity-references?entityRef=…` answers `{ referenced: boolean }`
for the catalog processor in
`@internal/plugin-catalog-backend-module-boards`, which turns that answer into
the `boards/is-referenced: "auto-detected"` label deciding where the entity
"Boards" tab appears.

The endpoint accepts **service-to-service credentials only**: its answer
deliberately ignores board visibility, so letting a user call it would reveal
that a board they cannot read references an entity. The plugin's router lets
unauthenticated requests through (public boards need that), so the handler
demands service credentials itself.

Whenever an entity gains or loses its board references — a board is created,
its assigned entities change, or it is archived, unarchived, duplicated with
entities, or permanently deleted — the plugin asks the catalog to refresh the
affected entity refs, so the label is re-derived within seconds instead of at
the next processing sweep. Refresh failures (an entity ref the catalog does
not know, for example) are logged and never fail the board operation.
