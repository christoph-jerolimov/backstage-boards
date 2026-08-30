## Context

`createBoard` already takes columns and priorities; `createItem`
handles fields, associations, and checklists; the description path
writes version rows. Column WIP limits are set through
`updateColumn`. The board menu (`BoardHeader`) hosts board-level
dialogs via `BoardDialogs`; the board list page has a Create button.
The frontend talks to the backend through `BoardsClient` (JSON
responses).

## Goals / Non-Goals

**Goals:**
- Lossless-enough JSON round-trip for board structure and item fields;
  CSV for spreadsheets; import as a new board.

**Non-Goals:**
- No comments/history/watches in the export (the move feature covers
  in-instance migration with history).
- No direct GitHub/Jira/Trello importers — the documented JSON format
  is the integration point.
- No merging into existing boards.

## Decisions

- **Format**: `{ format: 'backstage-boards', version: 1, board: {…},
  items: […] }`; statuses and priorities referenced by name so the
  document is instance-independent. `version` guards future changes.
- **Endpoints**: `GET /boards/:boardId/export?format=json|csv`
  (read-gated; CSV sets a text/csv content type) and
  `POST /boards/import` `{ document, name? }` returning the new board.
  Import builds on `createBoard` + `updateColumn` (limits/colors) +
  `createItem` per item, then sets the description; a validation pass
  runs before anything is created so failures create nothing.
- **CSV** hand-rolled with standard quoting (fields containing
  `",\n` quoted, quotes doubled); one row per item, assignees and tags
  joined with `;`.
- **Frontend**: an Export dialog (two download buttons building a Blob
  from the API responses) opened from the board menu; an Import dialog
  (file input → JSON.parse → API) on the board list, navigating to the
  new board.

## Risks / Trade-offs

- Assignee refs travel verbatim; on another instance unknown users
  simply render unresolved, matching existing free-ref behavior.
- Import creates items sequentially; board-sized imports are fine, no
  bulk API needed.
