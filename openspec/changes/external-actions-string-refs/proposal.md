## Why

The externally accessible actions (Backstage actions registry — used by automation, AI agents, and future sync modules) currently require opaque database ids for columns (`columnId`), priorities (`priorityId`), and permission entries (`permissionId`). These ids are internal storage details: an external caller has no way to discover them through the actions surface (there is no action that lists a board's columns or priorities), and referencing "the Done column" or "high priority" should not require knowing a UUID. Boards themselves stay addressed by `boardId` — that id is returned by `create-board` and shown in board URLs, so it is the natural external handle.

## What Changes

- **BREAKING**: `add-item` and `move-item` accept a `status` string (the column title) instead of `columnId`; `add-item` and `update-item` accept a `priority` string (the priority name) instead of `priorityId`; the `list-items` `priorities` filter takes priority names instead of ids.
- **BREAKING**: action outputs return the human-readable strings instead of ids: `list-items` items return `status` (column title) and `priority` (name) instead of `columnId`/`priorityId`; `move-item` returns the resulting `status` instead of `columnId`.
- Name lookup is strict: when no column/priority on the board matches the given string, the action fails with an error that names the available values; when more than one matches (titles/names are not unique in storage), the action fails as ambiguous rather than guessing.
- New read-only actions `list-statuses` and `list-priorities` return a board's column titles and priority names (with color and order), so external callers can discover the valid values before mutating.
- **BREAKING**: `update-board-permission` and `remove-board-permission` reference the entry by `principalRef` (user/group entity ref, unique per board) instead of `permissionId` — the remaining database id found by auditing the action surface.
- Audit result for everything else: `boardId` is kept by request as the board handle; `itemId` and `commentId` remain as ids because items and comments have no natural unique key (titles and texts can repeat) — they are opaque handles minted and returned by the actions themselves (`add-item`, `list-items`, `add-comment`).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `boards/actions`: item and permission actions reference columns, priorities, and permission entries by human-readable strings (column title, priority name, principal ref) instead of database ids, failing on unknown or ambiguous names; new read-only actions list a board's statuses and priorities.

## Impact

- `plugins/boards-backend/src/actions.ts`: schema changes for `add-item`, `update-item`, `move-item`, `list-items`, `update-board-permission`, `remove-board-permission`; new `list-statuses` and `list-priorities` actions; name→id resolution helpers built on `BoardsService.getBoard` / `listPermissions`.
- `plugins/boards-backend/src/actions.test.ts`: updated and extended coverage.
- No REST API, service-layer, database, or frontend changes — `BoardsService` keeps its id-based API used by the router and UI.
- External consumers of the actions must switch to the new input/output shapes (the actions surface is alpha; no compatibility shim is kept).
