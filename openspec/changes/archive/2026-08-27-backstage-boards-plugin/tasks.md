## 1. Package scaffolding

- [x] 1.1 Create `plugins/boards-common` package with shared types (`Board`, `BoardColumn`, `BoardItem`, `Comment`, `CommentVersion`, `ChangeRecord`, `PermissionEntry`, `BoardVisibility`, watch/favorite types), `text:` ref helpers, and API path constants; verify `yarn tsc` passes for the workspace
- [x] 1.2 Scaffold `plugins/boards-backend` (via `yarn new`, kind backend-plugin, id `boards`) depending on boards-common; verify it registers in `packages/backend/src/index.ts` and the backend starts (`yarn workspace backend start` boots without errors)
- [x] 1.3 Scaffold `plugins/boards` as an NFS-only frontend plugin (`createFrontendPlugin`, no legacy exports) depending on boards-common and `@backstage/ui` + `react-aria-components`; register it in `packages/app` and verify a placeholder `/boards` page renders in `yarn start`

## 2. Backend: database and domain services

- [x] 2.1 Write Knex migrations for `boards`, `board_columns`, `board_permissions`, `items`, `item_assignees`, `item_labels`, `item_tags`, `comments`, `comment_versions`, `changes`, `favorites`, `watches` per design D2 with cascade FKs; verify migrations run on SQLite via a migration test
- [x] 2.2 Implement `BoardAccessResolver` (effective level = max of visibility mode, direct user grant, ownership-group grants; unauthenticated only for `public-*`; never admin from public modes) with unit tests covering each scenario in the board-sharing spec, including last-admin protection helper
- [x] 2.3 Implement `BoardsService` board operations: create (creator gets admin + default columns), get, list-accessible (SQL filter matching resolver semantics), rename, delete (cascades), visibility change, entity assignment, favorites; verify with service-level unit tests
- [x] 2.4 Implement column operations (add, rename, reorder, delete with required item re-target or empty-only rule); verify with unit tests including the non-empty-column deletion scenario
- [x] 2.5 Implement item operations: create (audit fields, validation of title and assignee/creator refs incl. `text:` prefix), update, move (column + position), delete, labels/tags/assignees set operations; every mutation writes a `changes` record; verify unit tests assert change records for field updates and moves
- [x] 2.6 Implement comment operations: add, edit (append `comment_versions`, only author or board admin), delete, and the unified timeline query (comments + changes interleaved chronologically); verify unit tests cover version retention and the author/admin edit rule
- [x] 2.7 Enforce externally managed items: `external_manager` set only by service principals; user mutations on such items rejected; verify unit tests for the external-item scenarios

## 3. Backend: HTTP API, notifications, actions

- [x] 3.1 Implement the Express router under `/api/boards` covering boards, columns, permissions, items, comments, favorites, watches, and timeline, with resolver checks on every route; verify with supertest-style router tests for the main permission scenarios (read-only rejected on mutation, private board hidden)
- [x] 3.2 Add unauthenticated access scoped to public boards (`httpRouter.addAuthPolicy` + `allow: ['user', 'none']` credentials) so `public-read` boards are readable and `public-write` boards writable without login (actor recorded as `text:anonymous`); verify with router tests
- [x] 3.3 Implement watch/unwatch endpoints and notification fan-out on item mutations (item + board watchers, deduped, actor excluded, link to `/boards/<id>?item=<id>`) using `@backstage/plugin-notifications-node`; verify unit tests for watcher collection incl. the one-notification-per-change scenario
- [x] 3.4 Register actions via `actionsRegistryServiceRef`: create/update/delete board, add/update/remove permission, set visibility, add/update/move/delete item, add/update comment, set labels, set tags — thin wrappers over `BoardsService` with zod schemas; verify unit tests that an action invocation produces the same change records/permission errors as the REST path

## 4. Frontend: boards list and board page

- [x] 4.1 Implement `boardsApiRef` typed client (fetch + discovery) and the `ApiBlueprint`, `PageBlueprint`, `NavItemBlueprint` extensions; verify the plugin loads in the app and `/boards` fetches from the backend
- [x] 4.2 Build the board list page: Favorites/All tabs, board name, entity link, access level, favorite toggle, create-board flow, delete/rename for admins; verify against a running backend (create → appears; favorite → persists across reload)
- [x] 4.3 Build the board page shell: header with inline-editable name (admin), entity assignment editor, visibility selector, view switcher (board/table), group-by-assignee toggle, watch toggle; verify inline rename and visibility change round-trip
- [x] 4.4 Build the share dialog: list entries, add user/group by entity ref with level picker, inline level change, remove entry, surfacing the last-admin error; verify share-with-user grants access when tested with a second (guest) login
- [x] 4.5 Build the kanban board view: column lanes with inline column add/rename/reorder/delete (re-target flow for non-empty), item cards, drag-and-drop via react-aria with a menu-based accessible "Move to column" fallback, inline item add and title edit; verify moving an item persists status and order after reload
- [x] 4.6 Build the table view with the same item set and group-by-assignee (multi-assignee items appear per group, plus "Unassigned"); verify switching views keeps data consistent and grouping matches the spec scenarios
- [x] 4.7 Add swimlane group-by-assignee to the board view; verify a two-assignee item shows in both lanes and edits from either lane affect the single item

## 5. Frontend: item detail, comments, history

- [x] 5.1 Build the item detail drawer (deep-linkable via `?item=`) with inline-editable fields: title, assignees/creator (entity ref or `text:` chips), labels (key-value editor), tags; externally managed items render read-only with an indicator; verify field edits persist and the external item shows no edit controls
- [x] 5.2 Implement the markdown-subset comment renderer with catalog entity auto-linking (`system:default/example`, `user:christoph`; `text:` never linked; no raw HTML) as a pure function with unit tests for linking and escaping
- [x] 5.3 Build the unified timeline in the drawer: interleaved comments and change records with actor/timestamp, comment add/edit/delete with edited indicator and prior-version view; verify editing a comment keeps the old version accessible and the timeline order is chronological
- [x] 5.4 Add item watch toggle and verify end-to-end: watching user receives a Backstage notification (visible in the notifications plugin UI) when another user changes the item, and no self-notification occurs
- [x] 5.5 Add the `EntityContentBlueprint` catalog tab listing boards assigned to the current entity; verify a board assigned to an example entity appears on that entity's page

## 6. Integration and verification

- [x] 6.1 Run `yarn tsc:full`, `yarn lint:all`, and `yarn test:all`; fix all reported issues in the new packages
- [x] 6.2 Manual end-to-end pass with two users (guest + configured login) covering: create/share/favorite board, public read-only board without login, column config, item CRUD + move, comments with entity autolink, timeline, watch notification; record results in the change notes
- [x] 6.3 Verify actions are listed by the actions registry (e.g. via `plugin-mcp-actions-backend` endpoint) and invoke `boards:add-item` with an external-manager marker to confirm a read-only item appears in the UI
