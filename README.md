# Backstage Boards

A [Backstage](https://backstage.io) app built around **boards** — shareable
kanban boards that live inside the developer portal and can be assigned to
catalog entities.

The app itself is a standard Backstage instance running on the
[new frontend system](https://backstage.io/docs/frontend-system/); everything
board-specific lives in `plugins/`.

## Features

- **Board management** — create, rename, duplicate (optionally copying items
  and entity references), and delete boards; archive them with a grace window
  before purge; per-board configurable columns with colors; per-user
  favorites; and a paginated board list with "Favorites"/"All" tabs,
  per-status item counts, and filtering by search, entity, and creator.
- **Items** — kanban and table views with drag & drop (plus an accessible
  "Move to column" menu fallback), inline editing, grouping by assignee or
  priority, filtering and search, table sorting with configurable columns,
  multi-select rows with bulk assignee and priority changes, item archival
  and restore, and a structured item detail drawer.
- **Due dates** — per-item due dates with urgency-colored display, a quick
  due-date menu on cards, and relative dates in the details view.
- **Priorities** — an ordered, per-board set of priority definitions items
  can optionally carry, surfaced on cards, tables, filters, grouping, the
  home page widget, and a status × priority matrix dialog.
- **Checklists** — an optional per-item checklist edited in the details
  drawer, summarized as a done-count progress badge on the kanban card and
  tracked in item history.
- **My items** — a cross-board view of everything assigned to you, with its
  own filter bar, grouping, and an assignee × status matrix dialog.
- **Comments and history** — editable, versioned comments with catalog-entity
  auto-linking and @-mentions, an audit log of every other item change merged
  into one timeline, description version history, drafts that survive
  reloads, and a board-wide recent-changes view.
- **Sharing** — per-user and per-group `read`/`write`/`admin` grants and
  board-wide visibility modes (`private`, `logged-in-read`, `logged-in-write`,
  `public-read`, `public-write`), all enforced server-side, with
  catalog-backed user and group pickers.
- **Catalog integration** — a "Boards" tab on entities a board references,
  with the reference derived by a catalog processor rather than declared in
  `catalog-info.yaml`, and entity display names resolved from the catalog
  throughout the UI.
- **Watching, notifications, and live updates** — watch a board or a single
  item and get Backstage notifications on changes and mentions, optional
  scheduled reminders about due and overdue items, and live board updates
  pushed over Backstage signals.
- **Home page widgets** — configurable "Assigned items" and "Boards" cards
  for the Backstage home page, with scope (favorites or all), grouping, and
  item-count settings.
- **Actions** — board, permission, and item operations are registered in the
  Backstage actions registry, so other plugins, automation, and MCP clients
  can drive boards programmatically.

## Repository layout

| Path                                    | Contents                                                                      |
| --------------------------------------- | ----------------------------------------------------------------------------- |
| `packages/app`                          | The frontend app shell (new frontend system).                                 |
| `packages/backend`                      | The backend, wiring up core plugins and the boards plugins.                   |
| `plugins/boards`                        | Boards frontend: `/boards`, the board view, the share dialog, the entity tab. |
| `plugins/boards-backend`                | Boards backend: storage, `/api/boards` REST API, permissions, notifications.  |
| `plugins/boards-common`                 | Types and helpers shared by the frontend, backend, and future sync modules.   |
| `plugins/catalog-backend-module-boards` | Catalog processor labelling the entities a board references.                  |
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

## Specs

The project is developed spec-first with OpenSpec.
`openspec/specs/boards/` holds the current behaviour of each capability —
board management, item management, item priorities, item checklists, sharing,
comments and history, the catalog entity tab, watching and notifications,
home page widgets, and actions — and
`openspec/changes/archive/` records how it got there. When you change
behaviour, update the spec in the same change.
