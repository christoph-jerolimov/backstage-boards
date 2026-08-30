## Context

Item descriptions already have the full pattern this feature needs: a
`description` column, an `item_description_versions` table written on
every change, a versions endpoint, and the shared `EditableMarkdown`
component (markdown render/edit, allowEmpty, version history dialog).
Board mutations flow through `updateBoard` (admin-gated) and the board
payload through `getBoard`.

## Goals / Non-Goals

**Goals:**
- One markdown description per board with the exact same editing UX and
  versioning as item descriptions.
- Editable with write access (like item descriptions), not admin.

**Non-Goals:**
- No description on the board list rows or widgets.
- No draft persistence for unsaved edits (items have it; the board
  description is short-lived editing under the header).
- No version copy on duplicate.

## Decisions

- **Dedicated service path** `updateBoardDescription` requiring `write`
  instead of widening admin-gated `updateBoard`: description is content
  (like items), not configuration; keeping `updateBoard` admin-only
  preserves its semantics. Route: `PUT
  /boards/:boardId/description` with `{ text }`; versions via `GET
  /boards/:boardId/description/versions`.
- **Storage**: `boards.description` (nullable text; empty saves store
  null) + `board_description_versions` (id, board_id, text, edited_by,
  edited_at), mirroring the item tables. Version rows are written on
  every effective change, including clears (empty text version), same
  as items.
- **Payload**: `description?: string` and `descriptionVersionCount:
  number` on `BoardWithContext` (hydrated in `getBoard`), leaving the
  list queries untouched.
- **UI**: `BoardPage` renders `EditableMarkdown` directly under the
  header row (`allowEmpty`, `emptyText` only for writers), saving
  through the new API method and refreshing the board query.
- **Duplicate** copies the current text and writes one version row
  attributed to the duplicator.

## Risks / Trade-offs

- Concurrent edits last-writer-wins, like item descriptions; the
  version history preserves both texts.
