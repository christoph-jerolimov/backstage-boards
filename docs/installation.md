# Installation

How to install the boards plugins into your Backstage app. Once installed,
continue with the boards-specific options in
[Configuration](configuration.md).

## The plugins

Boards ships as five packages:

| Package                                          | Side     | Purpose                                                          |
| ------------------------------------------------ | -------- | ---------------------------------------------------------------- |
| `@internal/plugin-boards`                        | frontend | The `/boards` pages, the entity tab, and the home page cards.    |
| `@internal/plugin-boards-backend`                | backend  | Storage, the `/api/boards` REST API, permissions, notifications. |
| `@internal/plugin-boards-common`                 | shared   | Types and helpers used by both sides.                            |
| `@internal/plugin-boards-react`                  | frontend | Reusable UI building blocks, usable from other frontend plugins. |
| `@internal/plugin-catalog-backend-module-boards` | backend  | Catalog processor marking the entities a board references.       |

Add them to the right workspaces of your app (the common and react
packages come along as dependencies):

```sh
yarn --cwd packages/app add @internal/plugin-boards
yarn --cwd packages/backend add @internal/plugin-boards-backend \
  @internal/plugin-catalog-backend-module-boards
```

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
`app.packages: all` in your `app-config.yaml` the plugin is discovered
automatically from your app package's dependencies; there is no manual
route wiring.

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
