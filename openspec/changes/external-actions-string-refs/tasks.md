## 1. Resolution helpers

- [ ] 1.1 Add `resolveStatus(board, status)` and `resolvePriority(board, priority)` helpers in `plugins/boards-backend/src/actions.ts` (trimmed exact match against `board.columns[].title` / `board.priorities[].name`, `NotFoundError` listing available values on no match, `ConflictError` on multiple matches) and verify with unit tests covering the found, unknown, and ambiguous cases
- [ ] 1.2 Add a `resolvePermissionEntry(principal, boardId, principalRef)` helper built on `service.listPermissions` that returns the entry or throws `NotFoundError`, and verify with unit tests for the found and missing cases

## 2. Item action schemas

- [ ] 2.1 Change `add-item` to take `status` (column title) and `priority` (name) instead of `columnId`/`priorityId`, resolving via the helpers before calling `service.createItem`, and verify tests cover creation by status/priority plus failure on unknown values with nothing created
- [ ] 2.2 Change `update-item` to take `priority` (name, nullable to clear) instead of `priorityId`, and verify tests cover setting, clearing, and unknown-priority failure
- [ ] 2.3 Change `move-item` to take `status` instead of `columnId` and return `status` (resulting column title) instead of `columnId`, and verify tests cover a successful move and an unknown-status failure
- [ ] 2.4 Change `list-items` so the `priorities` filter takes priority names and each returned item carries `status` (column title) and optional `priority` (name) with no `columnId`/`priorityId`, and verify tests cover filtering by name and the string-shaped output

## 3. Permission action schemas

- [ ] 3.1 Change `update-board-permission` and `remove-board-permission` to take `principalRef` instead of `permissionId`, resolving the entry via the helper before calling the existing service methods, and verify tests cover update/remove by principal ref and a not-found failure for an unknown principal

## 4. Listing actions

- [ ] 4.1 Add the read-only `list-statuses` action returning the board's columns in order as `{ title, color?, position }` (no ids), and verify a test asserts order, content, and read-permission enforcement
- [ ] 4.2 Add the read-only `list-priorities` action returning the board's priorities ordered by `order` as `{ name, color?, order }` (no ids), and verify a test asserts order and content

## 5. Verification

- [ ] 5.1 Sweep `plugins/boards-backend/src/actions.ts` to confirm no input or output schema still exposes a column, priority, or permission database id (only `boardId`, `itemId`, `commentId` remain), and update every action description mentioning ids
- [ ] 5.2 Run `yarn workspace @internal/plugin-boards-backend test` (actions, service, router suites) and `yarn lint` / `yarn tsc` and verify all pass
