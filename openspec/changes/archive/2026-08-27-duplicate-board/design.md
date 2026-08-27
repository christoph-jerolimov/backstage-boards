# Design

## Context

See proposal. Board/column/permission creation paths all exist; the more menu hosts board-scoped actions.

## Goals / Non-Goals

**Goals:** structure-only duplication with explicit choices.
**Non-Goals:** copying items, comments, watches, or favorites; a duplicate action in the actions registry (later if needed).

## Decisions

- `duplicateBoard(principal, boardId, { name?, copyColumns, copyPermissions })`: requires read on the source; `copyPermissions` additionally requires admin (checked before writing). Default name `"<source name> (copy)"`. With `copyColumns` the source's columns (title/position/color) are cloned, otherwise the default columns are created. With `copyPermissions` visibility + entries are cloned (deduped against the duplicator's own admin grant), otherwise the copy is private.
- Route `POST /boards/:boardId/duplicate`; response is the new `BoardWithContext`.
- UI: "Duplicate board…" menu item (any access) → dialog with name field (prefilled) and two checkboxes; the share checkbox only renders for source admins. On success navigate to the new board.

## Risks / Trade-offs

- [Copied grants could surprise the source admins] → only source admins may copy them, and they become visible in the copy's share dialog immediately.
