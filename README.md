# Backstage Boards

A [Backstage](https://backstage.io) app built around **boards** — shareable
kanban boards that live inside the developer portal and can be assigned to
catalog entities.

The app itself is a standard Backstage instance running on the
[new frontend system](https://backstage.io/docs/frontend-system/); everything
board-specific lives in `plugins/`.

## Features

- **Boards and items** — kanban and table views with per-board configurable
  columns, group-by-assignee, inline editing, drag & drop (with an accessible
  "Move to column" menu fallback), and an item detail drawer.
- **Comments and history** — editable, versioned comments with catalog-entity
  auto-linking, plus an audit log of every other item change, merged into one
  timeline.
- **Sharing** — per-user and per-group `read`/`write`/`admin` grants and
  board-wide visibility modes (`private`, `logged-in-read`, `logged-in-write`,
  `public-read`, `public-write`), all enforced server-side.
- **Catalog integration** — a "Boards" tab on entities a board references, with
  the reference derived by a catalog processor rather than declared in
  `catalog-info.yaml`.
- **Watching and notifications** — watch a board or a single item and get
  Backstage notifications on changes, plus optional scheduled reminders about
  due and overdue items.
- **Actions** — board and item operations are registered in the Backstage
  actions registry, so other plugins, automation, and MCP clients can drive
  boards programmatically.

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
board management, item management, sharing, comments and history, the catalog
entity tab, watching and notifications, and actions — and
`openspec/changes/archive/` records how it got there. When you change
behaviour, update the spec in the same change.
