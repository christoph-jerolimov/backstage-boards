# Tasks: Add Permission Framework Support

## 1. Permission definitions (common package)

- [ ] 1.1 Add `@backstage/plugin-permission-common` to `plugins/boards-common/package.json`, create `src/permissions.ts` exporting `boardsUsePermission` (`boards.use`, basic), `boardsNewCreatePermission` (`boards.new.create`, `action: 'create'`), and `boardsPermissions`, re-export from `src/index.ts`; verify with `yarn tsc` and a unit test asserting the permission names and attributes.

## 2. Backend enforcement

- [ ] 2.1 Add `@backstage/plugin-permission-node` (and permission-common if needed) to `plugins/boards-backend/package.json`; in `src/plugin.ts` add `coreServices.permissions` and `coreServices.permissionsRegistry` deps, call `permissionsRegistry.addPermissions(boardsPermissions)`, and pass the permissions service into router and actions setup; verify the backend starts (`yarn start`) with no errors.
- [ ] 2.2 Implement `BoardsPermissionGuard` (`requireUse(credentials)`, `requireCreate(credentials)`) that skips service principals, authorizes user/anonymous credentials via `PermissionsService.authorize`, and throws `NotAllowedError` on DENY; verify with unit tests covering ALLOW, DENY, and service-principal bypass.
- [ ] 2.3 Mount a router middleware in `plugins/boards-backend/src/router.ts` calling `requireUse` for all user-facing routes while leaving `GET /service/entity-references` exempt, and add `requireCreate` to `POST /boards` and `POST /boards/:boardId/duplicate`; verify with router tests: a DENY decision yields 403 on a sampled set of endpoints (list, item mutation, comments), create/duplicate are refused with create denied but allowed with only use granted elsewhere, and the service endpoint still works with a service token under DENY-all.
- [ ] 2.4 Add `requireUse` to every action handler in `plugins/boards-backend/src/actions.ts` and `requireCreate` to `create-board`; verify with action tests that a denied caller gets a permission error and no data changes, and an allowed caller behaves as before.
- [ ] 2.5 Regression-verify optionality: run the existing backend test suite with the default (allow-all) permission setup and confirm all existing router/action/service tests pass unchanged, including anonymous access to a public board.

## 3. Frontend gating

- [ ] 3.1 Add `@backstage/plugin-permission-react` and `@internal/plugin-boards-common` permission imports to `plugins/boards`; confirm the permission API is available in the New Frontend System app (register the API factory in `packages/app` if missing); verify by logging/using `usePermission` in the running app.
- [ ] 3.2 Create a shared `RequireBoardsUse` gate component (usePermission-based: loading → progress/null, DENY → configurable fallback, error → fail open) and wrap the Boards page content in `BoardsPage.tsx` with an access-error fallback; verify with component tests for allow, deny, and error states.
- [ ] 3.3 Hide the boards sidebar item in `packages/app/src/modules/nav/Sidebar.tsx` when `boards.use` is denied; verify with an app test or manual check that the item disappears under a deny policy and remains under allow-all.
- [ ] 3.4 Gate `EntityBoardsContent` (access-restricted empty state, no API calls when denied) and both home page widgets (render nothing when denied) with the gate component; verify with component tests asserting no boards API request is issued on DENY.
- [ ] 3.5 Hide/disable the create-board affordance on the board list and the duplicate entry in the board more-menu when `boards.new.create` is denied; verify with component tests for both decisions.

## 4. Docs and validation

- [ ] 4.1 Add a `docs/permissions.md` page (permission names, what each gates, example policy snippet, optionality note, sharing stays authoritative within boards) and register it in `mkdocs.yml`; verify the page renders in the docs nav.
- [ ] 4.2 Run repo-wide checks — `yarn tsc`, `yarn lint`, `yarn test`, `yarn prettier:check` — and fix any fallout; verify all pass.
- [ ] 4.3 End-to-end sanity: with the dev app under allow-all, confirm page, tab, widgets, create, and duplicate all behave exactly as before; with a temporary test policy denying `boards.use`, confirm the sidebar item and page content are gone and API calls return 403.
