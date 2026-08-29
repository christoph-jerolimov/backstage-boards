# Installation

This page is for admins. It covers running this app as-is and installing the
boards plugins into an existing Backstage instance.

## Running this app

Requirements: Node.js 22 or 24 and Yarn 4 (via
[Corepack](https://nodejs.org/api/corepack.html): `corepack enable`).

```sh
yarn install
yarn start
```

This starts the frontend on <http://localhost:3000> and the backend on
<http://localhost:7007>. Boards are at <http://localhost:3000/boards>.

The default development configuration signs you in as the guest user and
stores boards in an in-memory SQLite database — see
[Configuration](configuration.md) for persistence and production settings.

## The plugins

Everything board-specific lives in four internal packages:

| Package                                          | Side     | Purpose                                                          |
| ------------------------------------------------ | -------- | ---------------------------------------------------------------- |
| `@internal/plugin-boards`                        | frontend | The `/boards` pages, the entity tab, and the home page cards.    |
| `@internal/plugin-boards-backend`                | backend  | Storage, the `/api/boards` REST API, permissions, notifications. |
| `@internal/plugin-boards-common`                 | shared   | Types and helpers used by both sides.                            |
| `@internal/plugin-catalog-backend-module-boards` | backend  | Catalog processor marking the entities a board references.       |

## Backend

Register the backend plugin and the catalog module in
`packages/backend/src/index.ts`:

```ts
backend.add(import('@internal/plugin-boards-backend'));
backend.add(import('@internal/plugin-catalog-backend-module-boards'));
```

Both belong together: without the catalog module no entity is ever marked as
referenced by a board, and the entity "Boards" tab appears nowhere (see
[Catalog integration](features/catalog-entities.md)).

The backend also expects the standard Backstage **notifications** and
**signals** plugins to be installed — notifications carry watch, mention,
and reminder messages, and signals power live board updates:

```ts
backend.add(import('@backstage/plugin-notifications-backend'));
backend.add(import('@backstage/plugin-signals-backend'));
```

## Frontend

The frontend is built exclusively on the Backstage
[new frontend system](https://backstage.io/docs/frontend-system/). With
`app.packages: all` (as in this app's `app-config.yaml`) the plugin is
discovered automatically from `packages/app/package.json`; there is no
manual route wiring.

The plugin contributes:

- the `/boards` page and its sub-pages,
- a "Boards" nav item with a kanban icon,
- the entity "Boards" tab (shown only on entities a board references),
- two home page widgets (see [Home page cards](features/home-page.md)).

For notifications and live updates the app should also install
`@backstage/plugin-notifications` and `@backstage/plugin-signals`.

## This documentation

These docs are built with [TechDocs](https://backstage.io/docs/features/techdocs/).
The repository root carries `mkdocs.yml`, the root `catalog-info.yaml` is
annotated with `backstage.io/techdocs-ref: dir:.`, and the app config
registers that entity, so the pages you are reading appear under **Docs**
inside Backstage itself.
