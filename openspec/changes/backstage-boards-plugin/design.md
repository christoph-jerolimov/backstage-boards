# Design: Backstage Boards Plugin

## Context

See `proposal.md` — Why. Current state of this repo:

- Backstage 1.54.0 monorepo (`packages/app`, `packages/backend`, empty `plugins/` workspace).
- The app already uses the **new frontend system** (`@backstage/frontend-defaults` `createApp` in `packages/app/src/index.tsx`).
- Already installed and usable: `@backstage/ui` (0.17.x), `@backstage/plugin-notifications(-backend)`, `@backstage/plugin-signals(-backend)`, permission framework (allow-all policy), `@backstage/plugin-mcp-actions-backend` (exposes actions-registry actions over MCP — meaning the backend supports the actions registry service).
- Database: default `better-sqlite3` in dev; the plugin must work on SQLite and PostgreSQL through the plugin-scoped `database` service (Knex).

Constraints from the request: NFS-only frontend; Backstage UI first, react-aria fallback; inline editing; backend-enforced sharing model with public modes; versioned comments + change audit; actions registry coverage; watch → notifications; external sync modules later.

## Goals / Non-Goals

**Goals:**

- Three packages: `plugins/boards` (frontend, NFS-only), `plugins/boards-backend`, `plugins/boards-common`.
- A single REST API used by the frontend, by registered actions (thin wrappers over the same service layer), and later by sync modules.
- Data model that supports versioned comments, a change log, per-board columns as first-class rows, and externally managed items from day one.
- Permission evaluation centralized in one backend service ("access resolver") used by routes and actions alike.

**Non-Goals:**

- No GitHub/Jira sync modules in this change (only the read-only external-item support they need).
- No old-frontend-system exports (no `createPlugin`/`createRoutableExtension` compat).
- No Backstage permission-policy integration (custom `PermissionPolicy` rules) beyond identity/credentials usage — board ACLs are plugin-internal. Can be revisited later.
- No real-time collaborative editing; signals-based live refresh is a stretch item, not required.
- No search indexing of items.

## Decisions

### D1: Package layout — standard three-package plugin

`plugins/boards-common` holds types (`Board`, `BoardColumn`, `BoardItem`, `Comment`, `ChangeRecord`, `PermissionEntry`, visibility enum, `text:` ref helpers) and API path constants. Frontend and backend depend on it; future sync modules depend only on common + REST/actions. Created with `yarn new` scaffolds, then the frontend package converted to NFS-only (`createFrontendPlugin` from `@backstage/frontend-plugin-api`; no legacy exports).

*Alternative:* frontend-only types duplicated in backend — rejected, sync modules need the shared contract.

### D2: Data model (Knex migrations, plugin-scoped DB)

Tables (all with `id` as UUID string, timestamps as ISO strings for SQLite compat):

- `boards`: `id, name, entity_ref (nullable), visibility ('private'|'logged-in-read'|'logged-in-write'|'public-read'|'public-write'), created_by, created_at, updated_at`.
- `board_columns`: `id, board_id (FK, cascade), title, position (float/int order key)`.
- `board_permissions`: `id, board_id, principal_ref (user:/group: entity ref), level ('admin'|'write'|'read')`, unique `(board_id, principal_ref)`.
- `items`: `id, board_id, column_id (FK), position, title, created_by, created_at, updated_by, updated_at, creator_ref (nullable), external_manager (nullable string, e.g. 'github', marks read-only)`.
- `item_assignees`: `item_id, assignee_ref` (unique pair) — one row per assignee, queryable for group-by-assignee.
- `item_labels`: `item_id, key, value` (unique `(item_id, key)`).
- `item_tags`: `item_id, tag` (unique pair).
- `comments`: `id, item_id, author_ref, created_at`.
- `comment_versions`: `id, comment_id, text, edited_by, edited_at` — current version = latest row; edits append. Deleting a comment removes the comment row (versions cascade).
- `changes`: `id, item_id, board_id, actor_ref, at, type ('created'|'updated'|'moved'|'deleted'|'comment-added'|'comment-edited'...), field (nullable), old_value (JSON text), new_value (JSON text)`.
- `favorites`: `user_ref, board_id` (unique pair).
- `watches`: `user_ref, target_type ('board'|'item'), target_id` (unique triple).

Rationale: assignees/labels/tags as rows (not JSON) so grouping and future filtering work in SQL on both SQLite and Postgres; comment versions as append-only child table gives "keep old versions" for free; `changes` keyed by both item and board makes board-level history cheap.

*Alternative:* JSON columns for labels/assignees — simpler writes but breaks group-by-assignee queries and cross-DB portability of JSON operators.

### D3: Access resolver — one permission gate

A backend `BoardAccessResolver` computes the effective level for credentials + board:

1. Unauthenticated (or no user principal): only `public-read`/`public-write` boards → read/write respectively, never admin.
2. Authenticated: start from visibility (`logged-in-*` modes), then max with direct `user:` entry, then max with entries matching any of the user's ownership groups (from `catalog` via `CatalogService.getEntityByRef` on the user entity / `identity.ownershipEntityRefs` claim in the credentials).
3. Board listing uses the same logic as a SQL filter (visibility in public/logged-in set OR permission row matching user/ownership refs).

Every route and every action calls `resolver.require(credentials, boardId, level)`. Externally managed items additionally require a **service** principal (or the managing module's token) for mutations — user principals get 403 regardless of level. "Last admin protection" is enforced in the permission-mutation service (refuse removing/downgrading the final admin row).

*Alternative:* Backstage permission framework with resource refs — heavier, and the deployed policy is allow-all; plugin-internal ACLs are the actual requirement. The API shape leaves room to add permission-framework integration later.

### D4: REST API + actions share one service layer

`BoardsService` (domain logic incl. change recording + notification fan-out) is used by:

- Express router (`httpRouter`) under `/api/boards`: CRUD for boards/columns/permissions/items/comments, favorites, watches, and a `GET /boards/:id/timeline?itemId=` unified feed. Public boards: routes use `credentials(allow: ['user', 'none'])` so unauthenticated read of `public-*` boards works (subject to `backend.auth.dangerouslyDisableDefaultAuthPolicy` being unnecessary — use `httpRouter.addAuthPolicy` with `allow: 'unauthenticated'` scoped to GET public paths, resolver still checks visibility).
- Actions registered via `actionsRegistryServiceRef` (`@backstage/backend-plugin-api/alpha`): `boards:create-board`, `update-board`, `delete-board`, `add-board-permission`, `update-board-permission`, `remove-board-permission`, `set-board-visibility`, `add-item`, `update-item`, `move-item`, `delete-item`, `add-comment`, `update-comment`, `set-item-labels`, `set-item-tags`. Zod input/output schemas; each action resolves credentials and delegates to the same service methods (identical permission + audit + notification behavior). This also makes them available over MCP via the installed `plugin-mcp-actions-backend`.

### D5: Notifications

On every item mutation (incl. comments), `BoardsService` collects watchers: `watches` rows for the item plus rows for the board, dedupes, removes the actor, and calls `notificationService.send` (from `@backstage/plugin-notifications-node`) with a payload linking to `/boards/<boardId>?item=<itemId>`. Fan-out happens after the DB transaction commits (best-effort; failures logged, not rolled back). One notification per change per user by construction (dedupe set).

### D6: Frontend — NFS extensions and views

`plugins/boards` exports a `createFrontendPlugin` with:

- `PageBlueprint` extension at `/boards`: board list page (Favorites / All tabs) and `/boards/:boardId` board page (react-router nested routes inside the page component).
- `NavItemBlueprint` extension for the sidebar.
- `ApiBlueprint` extension providing `boardsApiRef` (typed fetch client over the REST API using `fetchApi` + `discoveryApi`).
- `EntityContentBlueprint` (from `@backstage/plugin-catalog-react/alpha`) tab showing boards assigned to the current entity — cheap win for "board assigned to a catalog entity".

UI composition: Backstage UI (`@backstage/ui`) components (Button, TextField, Select, Card, Table, Tabs, Menu, etc.) first; where missing (drag-and-drop lists, drawer/modal overlay behavior, tag/combobox editors), use `react-aria`/`react-aria-components` (already a transitive foundation of Backstage UI, so visual consistency is reasonable). Inline editing via editable text fields (click-to-edit title, column headers, labels/tags chips). Item detail opens as a drawer (react-aria `Dialog` in a slide-over) preserving the board behind it; URL param `?item=` makes it deep-linkable (needed by notification links).

Board view: columns as vertical lanes, drag-and-drop via `react-aria` `useDrag`/`useDrop` (keyboard-accessible) — not an external DnD lib. Group-by-assignee renders swimlane sections per assignee (items with N assignees appear N times; mutation acts on the same item id). Table view: Backstage UI Table with the same group-by option. Comment rendering: small markdown-subset renderer with an entity-ref autolink pass (regex for `[kind:][namespace/]name` skipping `text:` prefix) — links via `entityRouteRef`/catalog route.

*Alternative for DnD:* `@dnd-kit` — mature, but the request pins react-aria as fallback library; react-aria's DnD hooks fit and keep the dependency set aligned.

### D7: Identity refs and `text:` principals

Creator/assignees stored as strings. Anything parseable as an entity ref (`user:`, `group:`, or any catalog kind) is treated as a catalog ref and rendered as `EntityRefLink`-style links; the reserved prefix `text:` marks free-text identities (displayed as plain chips, never linked, excluded from group ownership resolution). Validation on write: must be a syntactically valid entity ref or start with `text:`.

## Risks / Trade-offs

- [Unauthenticated access for public boards conflicts with default backend auth policy] → Scope an `allow: 'unauthenticated'` policy to the boards router only, and re-check visibility in the resolver on every request; mutations on `public-write` boards record actor as `text:anonymous`.
- [react-aria DnD complexity, esp. combined with swimlanes] → Implement move via DnD plus an always-available accessible fallback (item menu "Move to column…"), so board usability never depends on DnD polish.
- [Actions registry API is alpha and shifts between releases] → Pin to the workspace's Backstage version; wrap registration in one module so surface churn is localized.
- [Group membership resolution correctness (nested groups)] → Use the ownership entity refs from the user's identity claims (Backstage already flattens ownership); document that shares to groups follow ownership semantics.
- [SQLite vs Postgres differences (JSON, ordering, cascades)] → Store JSON as text, use explicit `position` floats with periodic renumber, define FKs with `onDelete('CASCADE')` and test migrations under SQLite in CI (`yarn test`).
- [Comment markdown injection/XSS] → Render through a whitelist markdown subset (no raw HTML), escape by default; autolinking runs on text nodes only.
- [Notification storms on bulk changes] → Fan-out is per-change but deduped per user; acceptable for v1, batching noted as future work.

## Migration Plan

Greenfield: migrations create all tables on first backend start; no data migration. Rollback = remove plugin from `packages/backend/src/index.ts` and app; tables remain but unused. No changes to existing plugins' behavior.

## Open Questions

- Exact notification grouping/scope topics (per-board topic vs per-item) can be tuned later without spec changes.
- Whether to emit signals (`@backstage/plugin-signals-node`) for live board refresh — additive later.
