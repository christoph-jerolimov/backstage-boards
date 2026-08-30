## Context

`createItem` already handles fields, associations, WIP capacity, and
the creation change record; the item drawer's description versioning
writes to `item_description_versions`. Duplicate-board's
`copyItemsInto` shows the copy semantics (no comments/history). The
item menu (`ItemMenu`) is shared by all surfaces.

## Goals / Non-Goals

**Goals:**
- One atomic server-side duplicate with the board's usual rules
  (validation, WIP limit, history, signals).

**Non-Goals:**
- No cross-board duplication (a separate move/copy feature).
- No bulk duplicate.

## Decisions

- **Service method `duplicateItem`** loads the source (mutable-item
  guard is not required — readonly external items may serve as
  templates; write access to the board is), then calls the existing
  `createItem` path with the copied fields, `position` right after the
  source (`positionBefore` semantics: source.position + half-step to
  the next item), and description written as a first version inside
  the same flow (an `updateItem` follow-up would create a second
  change record, so the description version row is written directly).
- **Route** `POST /boards/:boardId/items/:itemId/duplicate` returns
  the new item; the frontend calls it from the item menu and refreshes
  the board (`guarded`).
- The " (copy)" suffix matches duplicate-board's naming.

## Risks / Trade-offs

- Position collisions when many duplicates stack under one item are
  resolved like any drag reorder (positions are floats with periodic
  renormalization elsewhere — same behavior as drops).
