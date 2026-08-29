## Context

See proposal.md — Why. All actions live in `plugins/boards-backend/src/actions.ts` and delegate to `BoardsService`, whose API is id-based and shared with the REST router and frontend. Relevant service facts:

- `BoardsService.getBoard(principal, boardId)` returns a `BoardWithContext` including `columns` (with `id`, `title`, `color`, `position`) and `priorities` (with `id`, `name`, `color`, `order`), and enforces read access.
- Column titles and priority names carry no uniqueness constraint in storage (`addColumn`/`updateColumn` only trim and reject empty), so name resolution can be ambiguous.
- Permission entries are unique per `(board_id, principal_ref)` (`addPermission` throws `ConflictError` on duplicates), and `listPermissions(principal, boardId)` requires `admin` — the same level the update/remove actions need.
- The actions surface is registered via the alpha `ActionsRegistryService`; there are no shipped external consumers to keep compatible.

## Goals / Non-Goals

**Goals:**
- Keep all name→id translation in the actions layer (`actions.ts`), leaving `BoardsService` untouched.
- Consistent naming across action inputs and outputs: `status` = column title, `priority` = priority name.
- Errors that a machine caller (e.g. an AI agent) can self-correct from: name the bad value and enumerate the valid ones.

**Non-Goals:**
- No changes to the REST API, database schema, frontend, or `BoardsService` signatures.
- No enforcement of unique column titles / priority names in storage — ambiguity is handled at the action boundary.
- No deprecation aliases for the old id-based inputs (`columnId`, `priorityId`, `permissionId`).

## Decisions

**Resolution lives in `actions.ts` helpers, not the service.** Two helpers, e.g. `resolveStatus(board, status)` and `resolvePriority(board, priority)`, operate on a `BoardWithContext` fetched once per action call via `service.getBoard`. Alternative — adding name-based overloads to `BoardsService` — was rejected: the service is the id-based core shared with the router/UI, and the string convenience is purely an external-surface concern. The extra `getBoard` roundtrip per mutating call is acceptable for an automation surface.

**Exact match after trimming; no case folding.** Matching is `input.trim() === stored value`. Case-insensitive matching would make `Done` and `done` collide and turns the "ambiguous" case into a policy question; exact matching keeps resolution predictable, and `list-statuses`/`list-priorities` give callers the exact strings to use. Errors throw Backstage's `NotFoundError` (unknown, message includes the available values) and `ConflictError` (ambiguous), which the actions registry maps to failed action invocations — satisfying "when the lookup fails, the action should fail".

**Permission entries addressed by `principalRef`.** `update-board-permission`/`remove-board-permission` resolve the entry via `service.listPermissions` (admin-gated, same as the mutation) and then call the existing id-based `updatePermission`/`removePermission`. Uniqueness per board is guaranteed by the service, so no ambiguity case exists here; a missing principal is `NotFoundError`. Alternative — changing the service methods to take `principalRef` — rejected for the same layering reason as above.

**Two listing actions rather than one `get-board`.** `list-statuses` and `list-priorities` mirror the user-facing vocabulary and keep outputs small and single-purpose for tool-calling agents. Outputs include `title`/`name` plus `color` and order so callers can render or rank, but deliberately omit the database ids.

**Items and comments stay id-addressed.** Item titles and comment texts are not unique and have no natural key; `itemId`/`commentId` are opaque handles returned by `add-item`, `list-items`, and `add-comment`. `boardId` likewise stays, per the request. This is the documented outcome of the id audit.

## Risks / Trade-offs

- [Renaming a column/priority mid-conversation breaks a caller holding the old string] → Same failure mode as deleting it; the strict error lists current values so the caller can re-resolve via `list-statuses`/`list-priorities`.
- [Boards can legitimately hold duplicate column titles, making those columns unaddressable via actions] → The ambiguity error tells the caller why; an admin can rename in the UI. Accepted over silently picking one.
- [Extra `getBoard` fetch per mutating action] → One indexed read per call on an automation path; negligible.
- [Breaking change for any early adopter of the alpha actions] → Called out in the proposal; schemas change shape so old callers fail loudly at input validation, not silently.
