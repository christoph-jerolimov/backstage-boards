# Backstage Boards

A [Backstage](https://backstage.io) app built around **boards** — shareable
kanban boards that live inside the developer portal and can be assigned to
catalog entities.

The app itself is a standard Backstage instance running on the
[new frontend system](https://backstage.io/docs/frontend-system/); everything
board-specific lives in `plugins/`.

## Features

### Boards

- **Board list** — paginated "Favorites" and "All" tabs, with per-status item
  counts on every row.
- **Board filters** — filter the list by free-text search, referenced entity,
  and creator, with the filter options scoped to your own boards.
- **Favorites** — per-user, toggled from the row menu.
- **Configurable columns** — add, rename, reorder, and remove columns per
  board, and insert a column at any position.
- **Column colors** — an optional color per column, shown as a dot in the
  kanban header and as the status badge color everywhere else.
- **Duplicate a board** — optionally copying items and entity references; the
  copy belongs to the duplicator.
- **Board archival** — deleting archives the board for 30 days, read-only and
  reachable only by direct link, with "Unarchive" and "Delete now" actions.
- **Entity assignment** — a board can reference any number of catalog
  entities.
- **Row and context menus** — board rows carry an actions menu that also opens
  at the pointer on right-click.

### Items

- **Kanban and table views** — two switchable views over the same items.
- **Drag & drop** — an insertion line shows exactly where the card will
  land: between two cards, after the last card, or in an empty column,
  also inside grouped lanes.
- **Keyboard navigation** — arrow keys walk the cards (and table rows,
  across groups) with a visible focus; shortcuts on the focused item move
  it between columns (`Ctrl+←`/`Ctrl+→`), select it (`Space`), open the
  item menu (`Enter`) and the status/assignee/due-date/priority pickers
  (`s`, `a`, `d`, `p`), set a priority by digit, and archive (`Delete`).
- **Optimistic updates** — moves and edits apply instantly and roll back on
  failure.
- **Item fields** — title, description, tags, creator, and multiple
  assignees, as catalog refs or free-text `text:` identities.
- **Filter bar** — free-text search plus tag (all must match) and assignee
  (any must match) filters, applied to both views and the API alike.
- **Grouping** — group the board by assignee or by priority.
- **Table sorting.**
- **Configurable table columns** — choose which columns the table shows.
- **Utility columns** — the table's leading selection and trailing actions
  columns stay put regardless of configuration.
- **Selection and bulk actions** — multi-select items with the table's
  checkboxes or `Space` in either view; the selection is shared between
  the kanban and table views, with bulk status, priority, assignee,
  due-date, and archive actions.
- **Item archival** — deleted items are archived, listed with who archived
  them and when, restorable for 30 days before purge.
- **Externally managed items** — items owned by an integration are read-only
  and marked as such.
- **Item detail drawer** — structured into fields, description, checklist,
  and activity sections, and openable in place from any view.
- **Combined badges** — status, priority, and due date in the drawer are
  badges that double as their own keyboard-operable editors.
- **Assignee avatars** — stacked on cards, with display name and full entity
  ref in the tooltip.
- **Assignee × status matrix** — a per-board dialog counting items per
  assignee and column, with clickable headers and sum rows.
- **"Add another"** — the create dialog can stay open to add several items in
  a row.
- **Card and row context menus** — the item menu also opens at the pointer on
  right-click.

### Due dates

- **Urgency colors** — due-date badges color by how close (or past) the date
  is.
- **Quick due-date menu** — Today, Tomorrow, and This week directly on the
  card.
- **Arbitrary dates** — a full date picker in the details drawer, plus a
  remove entry.
- **Group by due date** — overdue first, then by date, undated last.

### Priorities

- **Per-board definitions** — admins manage up to ten ordered priorities with
  name and color in the board settings.
- **Everywhere they matter** — priorities appear on cards, in the table, as a
  filter, as a grouping, and in the home page widget.
- **Status × priority matrix** — a dialog counting items per column and
  priority, with toggleable headers and sums.
- **Graceful absence** — a board without priorities shows no priority UI at
  all.

### Checklists

- **Per-item checklist** — plain-text entries ticked off in the details
  drawer.
- **Progress badge** — cards show a done count like `1/3`, styled when
  complete.
- **Tracked and copied** — checklist changes appear in item history and
  survive board duplication.

### My items

- **Cross-board page** — everything assigned to you, across all boards you
  can access.
- **Own filter bar and grouping** — including grouping by due date and by
  tags.
- **Menu parity** — the same item actions as on the board itself.

### Comments and history

- **Comments** — editable, with full version history.
- **Markdown subset** — bold, italics, code, links, lists, headings, and
  pipe tables render safely; raw HTML never does.
- **Auto-linking** — catalog entity refs in comment text become links.
- **Mentions** — `@`-mention users, groups, or any catalog entity
  (`@jane`, `@group:default/team-a`, `@component:webserver-example`);
  mentions render as entity links.
- **Change history** — every non-comment change is recorded with who, when,
  and what.
- **Unified timeline** — comments and changes merged in the item detail view.
- **Description history** — the item description is versioned too.
- **Drafts survive reload** — unsent comment and description edits are stored
  per user until saved or cancelled.
- **Recent changes** — a board-wide view of the latest activity.

### Sharing

- **Three levels** — `read`, `write`, and `admin`, granted per user or per
  group; the highest grant wins.
- **Public modes** — `private`, `logged-in-read`, `logged-in-write`,
  `public-read`, and `public-write`.
- **Server-side enforcement** — every API call is permission-checked, not
  just the UI.
- **Catalog-backed pickers** — share with users and groups picked from the
  catalog.
- **Optional permission framework integration** — `boards.use` gates the
  plugin per user like a feature flag, and `boards.new.create` decides who
  may create boards; with the allow-all policy nothing changes.

### Catalog integration

- **Entity "Boards" tab** — shown only on entities at least one board
  references.
- **Processor-derived marks** — the reference is computed by a catalog
  processor, not declared in `catalog-info.yaml`, and follows assignment
  changes.
- **Display names** — assignees and creators show their catalog display name,
  with the raw ref in a tooltip.
- **Honest empty state** — the tab notes that boards you cannot access may
  exist.

### Watching, notifications, and live updates

- **Watching** — watch a whole board or a single item; watchers are listed.
- **Change notifications** — watched changes arrive as Backstage
  notifications, grouped per user.
- **Mention notifications** — being mentioned in a comment notifies you;
  only user and group mentions notify.
- **Scheduled reminders** — optional, configurable reminders about due and
  overdue items.
- **Live updates** — open boards refresh via Backstage signals; the signals
  carry ids only, data stays permission-checked.

### Home page

- **Assigned items card** — your due work at a glance, with scope and
  grouping settings.
- **Boards card** — your favorite (or all) boards, with an item-count
  setting.
- **Well-behaved cards** — defined loading, empty, and failure states, and
  they refresh on board signals.

### Actions

- **Registry actions** — board, permission, item, comment, and tag operations
  in the Backstage actions registry with typed schemas.
- **Same rules as the API** — actions enforce the same permissions and
  produce the same history and notifications as the UI.
- **Name-based references** — statuses (column titles), priorities, and
  permission principals are passed as strings, never as database ids;
  unknown or ambiguous values fail the action with the valid values listed.
- **Read-only queries** — `list-items` honoring the item filters, plus
  `list-statuses` and `list-priorities` to discover a board's valid values.
- **External managers** — integrations can create and update items carrying
  the external-management marker.

## Repository layout

| Path                                    | Contents                                                                      |
| --------------------------------------- | ----------------------------------------------------------------------------- |
| `packages/app`                          | The frontend app shell (new frontend system).                                 |
| `packages/backend`                      | The backend, wiring up core plugins and the boards plugins.                   |
| `plugins/boards`                        | Boards frontend: `/boards`, the board view, the share dialog, the entity tab. |
| `plugins/boards-backend`                | Boards backend: storage, `/api/boards` REST API, permissions, notifications.  |
| `plugins/boards-common`                 | Types and helpers shared by the frontend, backend, and future sync modules.   |
| `plugins/catalog-backend-module-boards` | Catalog processor labelling the entities a board references.                  |
| `docs`                                  | User and admin documentation, served as TechDocs (`mkdocs.yml` at the root).  |
| `openspec/specs`                        | The behaviour specs the plugins are built against.                            |

Each plugin has its own README with the details.

## Getting started

Requires Node.js 22 or 24 and Yarn 4 (via
[Corepack](https://nodejs.org/api/corepack.html): `corepack enable`).

```sh
yarn install
yarn start
```

That starts the frontend on <http://localhost:3000> and the backend on
<http://localhost:7007>; boards are at <http://localhost:3000/boards>.

The default dev config in `app-config.yaml` uses an in-memory SQLite database,
so boards are gone after a backend restart. Point `backend.database` at
PostgreSQL (as `app-config.production.yaml` does) to keep them.

## Development

| Command               | What it does                                                      |
| --------------------- | ----------------------------------------------------------------- |
| `yarn start`          | Run frontend and backend together in watch mode.                  |
| `yarn start app`      | Run only the frontend (or `yarn start backend` for the backend).  |
| `yarn test`           | Unit tests for changed packages (`yarn test:all` for everything). |
| `yarn test:e2e`       | Playwright end-to-end tests; starts the dev servers as needed.    |
| `yarn lint`           | Lint what changed since `origin/main` (`yarn lint:all` for all).  |
| `yarn tsc`            | Typecheck and emit the declarations other packages consume.       |
| `yarn prettier:check` | Check formatting (`yarn fix` fixes lint and formatting).          |
| `yarn build:all`      | Build every package.                                              |
| `yarn new`            | Scaffold a new plugin or package.                                 |

CI (`.github/workflows/ci.yml`) runs formatting, lint, typecheck, unit tests, a
full build, and the end-to-end suite on every pull request.

## Configuration

App configuration lives in `app-config.yaml`, with production overrides in
`app-config.production.yaml`. Board-specific options — currently scheduled
reminders — are documented in `plugins/boards-backend/config.d.ts` and sketched
as a commented example at the end of `app-config.yaml`.

The boards backend and the catalog module belong together: without
`@internal/plugin-catalog-backend-module-boards` no entity is ever labelled and
the entity "Boards" tab appears nowhere. Both are already registered in
`packages/backend/src/index.ts`.

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

## Specs

The project is developed spec-first with OpenSpec.
`openspec/specs/boards/` holds the current behaviour of each capability —
board management, item management, item priorities, item checklists, sharing,
comments and history, the catalog entity tab, watching and notifications,
home page widgets, and actions — and
`openspec/changes/archive/` records how it got there. When you change
behaviour, update the spec in the same change.
